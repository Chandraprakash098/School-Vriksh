const mongoose = require('mongoose');
const crypto = require('crypto');
const { decrypt } = require('../utils/encryption'); // Assuming you have an encryption utility
const logger = require('../utils/logger'); // Assuming you have a logger
const { sendPaymentConfirmation } = require('../utils/notifications'); // Assuming this exists
const { generateFeeSlip } = require('../config/s3Upload'); // Assuming this exists

const paytmCallback = async (req, res) => {
  try {
    const schoolId = req.school._id.toString(); // Assuming middleware sets req.school
    const connection = req.connection; // School-specific connection
    const PaymentModel = require('../models/Payment')(connection);
    const FeeModel = require('../models/Fee')(connection);
    const UserModel = require('../models/User')(connection);

    // Extract Paytm response parameters
    const {
      ORDERID,
      TXNID,
      TXNAMOUNT,
      STATUS,
      CHECKSUMHASH,
      RESPCODE,
      RESPMSG,
      TXNDATE,
    } = req.body;

    logger.info('Paytm callback received', {
      orderId: ORDERID,
      txnId: TXNID,
      status: STATUS,
      respCode: RESPCODE,
    });

    // Validate required fields
    if (!ORDERID || !STATUS || !CHECKSUMHASH) {
      logger.error('Missing required Paytm callback parameters', { body: req.body });
      return res.status(400).json({ message: 'Invalid callback parameters' });
    }

    // Fetch school payment configuration
    const ownerConnection = await getOwnerConnection();
    const School = require('../models/School')(ownerConnection);
    const school = await School.findById(schoolId).select(
      '+paymentConfig.details.paytmMerchantKey +paymentConfig.details.paytmMid'
    ).lean();

    if (!school) {
      logger.error('School not found for callback', { schoolId });
      return res.status(404).json({ message: 'School not found' });
    }

    const paymentConfig = school.paymentConfig.find(
      (config) => config.paymentType === 'paytm' && config.isActive
    );

    if (!paymentConfig || !paymentConfig.details.paytmMerchantKey) {
      logger.error('Paytm configuration missing', { schoolId });
      return res.status(400).json({ message: 'Paytm configuration not found' });
    }

    // Verify checksum
    const merchantKey = decrypt(paymentConfig.details.paytmMerchantKey);
    const paramString = Object.keys(req.body)
      .filter((key) => key !== 'CHECKSUMHASH')
      .sort()
      .map((key) => `${key}=${req.body[key]}`)
      .join('&');

    const generatedChecksum = crypto
      .createHmac('sha256', merchantKey)
      .update(paramString)
      .digest('hex');

    if (generatedChecksum !== CHECKSUMHASH) {
      logger.error('Invalid Paytm checksum', { orderId: ORDERID });
      return res.status(400).json({ message: 'Invalid checksum' });
    }

    // Find the payment record
    const payment = await PaymentModel.findOne({ orderId: ORDERID, school: schoolId });
    if (!payment) {
      logger.error('Payment record not found', { orderId: ORDERID });
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status === 'completed') {
      logger.warn('Payment already processed', { orderId: ORDERID, paymentId: payment._id });
      return res.redirect(`${process.env.FRONTEND_URL}/payment/success?orderId=${ORDERID}`);
    }

    // Start MongoDB transaction
    const session = await connection.startSession();
    try {
      await session.withTransaction(async () => {
        // Update payment status based on Paytm response
        payment.transactionId = TXNID || payment.transactionId;
        payment.paymentDate = TXNDATE ? new Date(TXNDATE) : new Date();
        payment.status = STATUS === 'TXN_SUCCESS' ? 'completed' : STATUS === 'TXN_FAILURE' ? 'failed' : 'awaiting_verification';
        payment.respCode = RESPCODE;
        payment.respMsg = RESPMSG;

        // If payment is successful, update fees
        if (payment.status === 'completed') {
          const uniqueFeeKeys = new Set();
          const feesPaid = payment.feesPaid.filter((feePaid) => {
            const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
            if (uniqueFeeKeys.has(key)) return false;
            uniqueFeeKeys.add(key);
            return true;
          });

          const feeUpdates = feesPaid.map(async (feePaid) => {
            const fee = await FeeModel.findOne({
              student: payment.student,
              school: schoolId,
              type: feePaid.type,
              month: feePaid.month,
              year: feePaid.year,
            }).session(session);

            if (fee) {
              fee.paidAmount += feePaid.amount;
              fee.remainingAmount = fee.amount - fee.paidAmount;
              fee.status = fee.paidAmount >= fee.amount ? 'paid' : 'partially_paid';
              fee.paymentDetails.push({
                transactionId: TXNID || `PAYTM-${ORDERID}`,
                paymentDate: payment.paymentDate,
                paymentMethod: 'paytm',
                receiptNumber: payment.receiptNumber || `REC-PAYTM-${Date.now()}`,
                amount: feePaid.amount,
              });
              await fee.save({ session });
            }
          });

          await Promise.all(feeUpdates);

          // Generate receipts
          const student = await UserModel.findById(payment.student)
            .select(
              '_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email'
            )
            .populate('studentDetails.class', 'name division')
            .session(session);

          const feesByMonthYear = feesPaid.reduce((acc, fee) => {
            const key = `${fee.month}-${fee.year}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(fee);
            return acc;
          }, {});

          const receiptUrls = {};
          for (const [key, fees] of Object.entries(feesByMonthYear)) {
            let attempts = 3;
            let feeSlip;
            while (attempts > 0) {
              try {
                feeSlip = await generateFeeSlip(
                  student,
                  payment,
                  fees.map((f) => ({
                    _id: f.feeId,
                    type: f.type,
                    month: f.month,
                    year: f.year,
                    amount: f.amount,
                  })),
                  schoolId,
                  key
                );
                break;
              } catch (uploadError) {
                logger.warn(
                  `Failed to generate fee slip for ${key}, attempt ${4 - attempts}: ${uploadError.message}`
                );
                attempts--;
                if (attempts === 0) throw uploadError;
              }
            }
            receiptUrls[key] = feeSlip.pdfUrl;
          }

          payment.receiptUrl = receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
          payment.receiptUrls = receiptUrls;
        }

        await payment.save({ session });

        // Send confirmation if payment is successful
        if (payment.status === 'completed') {
          const student = await UserModel.findById(payment.student)
            .select(
              '_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email'
            )
            .populate('studentDetails.class', 'name division')
            .session(session);

          await sendPaymentConfirmation(student, payment, payment.receiptUrl);
        }
      });

      // Redirect based on payment status
      const redirectUrl = `${process.env.FRONTEND_URL}/payment/${
        payment.status === 'completed' ? 'success' :
        payment.status === 'failed' ? 'failure' : 'pending'
      }?orderId=${ORDERID}`;

      logger.info('Paytm callback processed', {
        orderId: ORDERID,
        status: payment.status,
        redirectUrl,
      });

      res.redirect(redirectUrl);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    logger.error('Error processing Paytm callback', { error: error.message, stack: error.stack });
    res.redirect(`${process.env.FRONTEND_URL}/payment/failure?error=${encodeURIComponent(error.message)}`);
  }
};

module.exports = { paytmCallback };