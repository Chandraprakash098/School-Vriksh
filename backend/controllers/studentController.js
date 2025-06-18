const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const PaytmChecksum = require('paytmchecksum');
const Stripe = require('stripe');
const { calculateFine } = require('../utils/fineCalculator');
const Crypto= require('crypto');
const axios= require('axios');
const Fee = require("../models/Fee");
const User = require("../models/User");
const Payment = require("../models/Payment");
// const { generateFeeSlip } = require("../utils/helpers");
const { generateFeeSlip } = require("../utils/generateFeeSlip");
const { checkRTEExemption } = require("../utils/rteUtils");
const logger = require("../utils/logger");
const { sendPaymentConfirmation } = require("../utils/notifications");
const { getOwnerConnection } = require("../config/database");
const { decrypt } = require("../utils/encryption");
const Class = require("../models/Class");
const libraryModelFactory = require('../models/Library');
const {
  uploadToS3,
  getPublicFileUrl,
  streamS3Object,
} = require("../config/s3Upload");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const studentController = {
  getFeeTypes: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const PaymentModel = Payment(connection);

      logger.info(
        `getFeeTypes called with studentId: ${studentId}, month: ${month}, year: ${year}`
      );

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }

      // Validate student
      const student = await UserModel.findById(studentId).select(
        "name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
      );
      if (!student)
        return res.status(404).json({ message: "Student not found" });
      if (!student.studentDetails.class) {
        return res
          .status(400)
          .json({ message: "Student is not assigned to a class" });
      }

      // Check if student is RTE
      if (student.studentDetails.isRTE) {
        return res.json({
          message: "RTE students are exempted from fees",
          isRTE: true,
          feeTypes: [],
        });
      }

      // Aggregate unique fee definitions for the student's class
      const feeDefinitions = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            month: parseInt(month),
            year: parseInt(year),
            student: null,
            classes: {
              $elemMatch: {
                $eq: new mongoose.Types.ObjectId(student.studentDetails.class),
              },
            },
          },
        },
        {
          $group: {
            _id: {
              type: "$type",
              distanceSlab: "$transportationDetails.distanceSlab", // Include distanceSlab to handle transportation fees
            },
            type: { $first: "$type" },
            amount: { $first: "$amount" },
            description: { $first: "$description" },
            dueDate: { $first: "$dueDate" },
            transportationDetails: { $first: "$transportationDetails" },
          },
        },
        {
          $project: {
            _id: 0,
            type: 1,
            amount: 1,
            description: 1,
            dueDate: 1,
            transportationDetails: 1,
          },
        },
        { $sort: { type: 1 } },
      ]);

      // Get paid fees for the student
      const paidFees = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
        status: "completed",
      });

      // Create a set of paid fee types with their distance slabs for transportation
      const paidFeeTypes = new Set();
      paidFees.forEach((payment) => {
        payment.feesPaid.forEach((fee) => {
          const key =
            fee.type === "transportation" && fee.transportationSlab
              ? `${fee.type}_${fee.transportationSlab}`
              : fee.type;
          paidFeeTypes.add(key);
        });
      });

      const feeTypesWithStatus = feeDefinitions
        .filter(
          (fee) =>
            fee.type !== "transportation" ||
            (student.studentDetails.transportDetails?.isApplicable &&
              fee.transportationDetails?.distanceSlab ===
                student.studentDetails.transportDetails.distanceSlab)
        )
        .map((fee) => {
          const feeKey =
            fee.type === "transportation" &&
            fee.transportationDetails?.distanceSlab
              ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
              : fee.type;
          const isPaid = paidFeeTypes.has(feeKey);
          const payment = paidFees.find((p) =>
            p.feesPaid.some(
              (f) =>
                f.type === fee.type &&
                (f.type !== "transportation" ||
                  f.transportationSlab ===
                    fee.transportationDetails?.distanceSlab)
            )
          );
          const paymentDetails = isPaid
            ? payment?.feesPaid.find(
                (f) =>
                  f.type === fee.type &&
                  (f.type !== "transportation" ||
                    f.transportationSlab ===
                      fee.transportationDetails?.distanceSlab)
              )?.paymentDetails || null
            : null;

          return {
            type: fee.type,
            label:
              fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + " Fee",
            amount: fee.amount,
            description: fee.description,
            dueDate: fee.dueDate,
            isPaid,
            paymentDetails,
            ...(fee.transportationDetails?.distanceSlab && {
              transportationSlab: fee.transportationDetails.distanceSlab,
            }),
          };
        });

      res.json({
        feeTypes: feeTypesWithStatus,
        name: student.name,
        grNumber: student.studentDetails.grNumber,
        class: student.studentDetails.class,
        month: parseInt(month),
        year: parseInt(year),
      });
    } catch (error) {
      logger.error("getFeeTypes Error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  

  getPaymentMethods: async (req, res) => {
    try {
        const schoolId = req.school._id.toString();
        const ownerConnection = await getOwnerConnection();
        const School = require("../models/School")(ownerConnection);

        const school = await School.findById(schoolId).lean();
        if (!school) {
            return res.status(404).json({ message: "School not found" });
        }

        const paymentMethods = school.paymentConfig
            .filter(config => config.isActive)
            .map(config => ({
                paymentType: config.paymentType,
                isActive: config.isActive, // Add isActive field
                details: {
                    bankName: config.details?.bankName,
                    accountNumber: config.details?.accountNumber,
                    ifscCode: config.details?.ifscCode,
                    accountHolderName: config.details?.accountHolderName,
                    upiId: config.details?.upiId,
                    razorpayKeyId: config.paymentType === 'razorpay' ? decrypt(config.details?.razorpayKeyId) : undefined,
                    stripePublishableKey: config.paymentType === 'stripe' ? decrypt(config.details?.stripePublishableKey) : undefined,
                    paytmMid: config.paymentType === 'paytm' ? decrypt(config.details?.paytmMid) : undefined
                }
            }));

        res.json({ paymentMethods });
    } catch (error) {
        logger.error(`Error fetching payment methods: ${error.message}`, { error });
        res.status(500).json({ error: error.message });
    }
},

  // payFeesByType: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { feeTypes, month, year, paymentMethod, amounts } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const PaymentModel = Payment(connection);
  //     const UserModel = User(connection);
  //     const ClassModel = require("../models/Class")(connection);

  //     // Validate inputs
  //     if (!mongoose.Types.ObjectId.isValid(studentId)) {
  //       return res.status(400).json({ message: "Invalid student ID" });
  //     }
  //     if (!feeTypes || !Array.isArray(feeTypes) || feeTypes.length === 0) {
  //       return res.status(400).json({ message: "Fee types are required" });
  //     }
  //     if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
  //       return res
  //         .status(400)
  //         .json({ message: "Month and year must be valid numbers" });
  //     }
  //     if (parseInt(month) < 1 || parseInt(month) > 12) {
  //       return res
  //         .status(400)
  //         .json({ message: "Month must be between 1 and 12" });
  //     }
  //     if (!paymentMethod || paymentMethod === "cash") {
  //       return res.status(403).json({
  //         message:
  //           "Students can only pay via online methods. Contact the fee manager for cash payments.",
  //       });
  //     }

  //     // Validate student
  //     const student = await UserModel.findById(studentId)
  //       .select(
  //         "name email studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails"
  //       )
  //       .populate("studentDetails.class", "name division");
  //     if (!student) {
  //       return res.status(404).json({ message: "Student not found" });
  //     }
  //     if (!student.studentDetails.class) {
  //       return res
  //         .status(400)
  //         .json({ message: "Student is not assigned to a class" });
  //     }
  //     if (await checkRTEExemption(student, connection)) {
  //       return res
  //         .status(400)
  //         .json({ message: "RTE students are exempted from fees" });
  //     }

  //     // Aggregate fee definitions
  //     const feeDefinitions = await FeeModel.aggregate([
  //       {
  //         $match: {
  //           school: new mongoose.Types.ObjectId(schoolId),
  //           month: parseInt(month),
  //           year: parseInt(year),
  //           student: null,
  //           type: { $in: feeTypes },
  //           classes: {
  //             $elemMatch: {
  //               $eq: new mongoose.Types.ObjectId(
  //                 student.studentDetails.class._id
  //               ),
  //             },
  //           },
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: {
  //             type: "$type",
  //             distanceSlab: "$transportationDetails.distanceSlab",
  //           },
  //           type: { $first: "$type" },
  //           amount: { $first: "$amount" },
  //           description: { $first: "$description" },
  //           dueDate: { $first: "$dueDate" },
  //           transportationDetails: { $first: "$transportationDetails" },
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           type: 1,
  //           amount: 1,
  //           description: 1,
  //           dueDate: 1,
  //           transportationDetails: 1,
  //         },
  //       },
  //     ]);

  //     // Validate requested fee types
  //     const requestedFeeTypes = new Set(feeTypes);
  //     const availableFeeTypes = new Set(feeDefinitions.map((fee) => fee.type));
  //     const invalidFeeTypes = [...requestedFeeTypes].filter(
  //       (type) => !availableFeeTypes.has(type)
  //     );
  //     if (invalidFeeTypes.length > 0) {
  //       return res
  //         .status(404)
  //         .json({
  //           message: `Invalid or undefined fee types: ${invalidFeeTypes.join(
  //             ", "
  //           )}`,
  //         });
  //     }

  //     // Filter valid fee definitions
  //     const validFeeDefinitions = feeDefinitions.filter(
  //       (fee) =>
  //         fee.type !== "transportation" ||
  //         (student.studentDetails.transportDetails?.isApplicable &&
  //           fee.transportationDetails?.distanceSlab ===
  //             student.studentDetails.transportDetails.distanceSlab)
  //     );
  //     if (validFeeDefinitions.length === 0) {
  //       return res
  //         .status(400)
  //         .json({ message: "No valid fee types found for payment" });
  //     }

  //     // Fetch existing student fees
  //     const studentFees = await FeeModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       month: parseInt(month),
  //       year: parseInt(year),
  //       type: { $in: feeTypes },
  //     });

  //     // Check existing payments
  //     const existingPayments = await PaymentModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       "feesPaid.month": parseInt(month),
  //       "feesPaid.year": parseInt(year),
  //       "feesPaid.type": { $in: feeTypes },
  //       status: "completed",
  //     });

  //     const paidTypes = new Set(
  //       existingPayments.flatMap((p) =>
  //         p.feesPaid.map((f) =>
  //           f.type === "transportation" && f.transportationSlab
  //             ? `${f.type}_${f.transportationSlab}`
  //             : f.type
  //         )
  //       )
  //     );

  //     // Filter fees to pay
  //     const feesToPay = validFeeDefinitions.filter((fee) => {
  //       const feeKey =
  //         fee.type === "transportation" &&
  //         fee.transportationDetails?.distanceSlab
  //           ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
  //           : fee.type;
  //       return !paidTypes.has(feeKey);
  //     });
  //     if (feesToPay.length === 0) {
  //       return res
  //         .status(400)
  //         .json({ message: "All selected fees are already paid" });
  //     }

  //     // Map amounts by type
  //     const amountMap = amounts
  //       ? feeTypes.reduce((map, type, index) => {
  //           map[type] = amounts[index];
  //           return map;
  //         }, {})
  //       : {};

  //     // Validate payment amounts
  //     const paymentDetails = feesToPay.map((fee) => {
  //       const studentFee = studentFees.find((f) => f.type === fee.type);
  //       const amountToPay = amountMap[fee.type] || fee.amount;
  //       if (
  //         amountToPay <= 0 ||
  //         amountToPay > (studentFee?.remainingAmount || fee.amount)
  //       ) {
  //         throw new Error(
  //           `Invalid payment amount for ${fee.type}: ${amountToPay}`
  //         );
  //       }
  //       return {
  //         fee,
  //         studentFee,
  //         amountToPay,
  //       };
  //     });

  //     // Calculate total amount
  //     const totalAmountInINR = paymentDetails.reduce(
  //       (sum, { amountToPay }) => sum + amountToPay,
  //       0
  //     );
  //     const totalAmountInPaise = totalAmountInINR * 100;

  //     // Create Razorpay order
  //     const options = {
  //       amount: totalAmountInPaise,
  //       currency: "INR",
  //       receipt: `fee_${studentId.slice(-8)}_${month}${year}_${Date.now()
  //         .toString()
  //         .slice(-10)}`,
  //     };
  //     const order = await razorpay.orders.create(options);
  //     const receiptNumber = `FS-${studentId}-${Date.now()}`;

  //     // Update or create fee documents
  //     const updatedFees = await Promise.all(
  //       paymentDetails.map(async ({ fee, studentFee, amountToPay }) => {
  //         const paymentDetail = {
  //           transactionId: `PENDING-${order.id}`,
  //           paymentDate: new Date(),
  //           paymentMethod,
  //           receiptNumber,
  //           amount: amountToPay,
  //         };
  //         if (
  //           fee.type === "transportation" &&
  //           fee.transportationDetails?.distanceSlab
  //         ) {
  //           paymentDetail.transportationSlab =
  //             fee.transportationDetails.distanceSlab;
  //         }

  //         if (!studentFee) {
  //           const newFee = new FeeModel({
  //             school: schoolId,
  //             student: studentId,
  //             grNumber: student.studentDetails.grNumber,
  //             classes: [student.studentDetails.class._id],
  //             type: fee.type,
  //             amount: fee.amount,
  //             paidAmount: 0,
  //             remainingAmount: fee.amount,
  //             dueDate: fee.dueDate,
  //             month: parseInt(month),
  //             year: parseInt(year),
  //             description: fee.description,
  //             status: "pending",
  //             isRTE: student.studentDetails.isRTE || false,
  //             transportationDetails: fee.transportationDetails || null,
  //             paymentDetails: [paymentDetail],
  //           });
  //           await newFee.save();
  //           return newFee;
  //         } else {
  //           studentFee.paymentDetails.push(paymentDetail);
  //           await studentFee.save();
  //           return studentFee;
  //         }
  //       })
  //     );

  //     // Create payment record
  //     const payment = new PaymentModel({
  //       school: schoolId,
  //       student: studentId,
  //       grNumber: student.studentDetails.grNumber,
  //       amount: totalAmountInINR,
  //       paymentMethod,
  //       status: "pending",
  //       orderId: order.id,
  //       receiptNumber,
  //       feesPaid: updatedFees.map((fee) => ({
  //         feeId: fee._id,
  //         type: fee.type,
  //         month: parseInt(month),
  //         year: parseInt(year),
  //         amount: fee.paymentDetails[fee.paymentDetails.length - 1].amount,
  //         ...(fee.type === "transportation" &&
  //           fee.transportationDetails?.distanceSlab && {
  //             transportationSlab: fee.transportationDetails.distanceSlab,
  //           }),
  //       })),
  //     });

  //     await payment.save();

  //     // Send confirmation
  //     await sendPaymentConfirmation(student, payment, null);

  //     res.json({
  //       orderId: order.id,
  //       amountInPaise: totalAmountInPaise,
  //       amountInINR: totalAmountInINR,
  //       currency: "INR",
  //       key: process.env.RAZORPAY_KEY_ID,
  //       payment,
  //       message: "Payment initiated. Proceed with Razorpay checkout.",
  //     });
  //   } catch (error) {
  //     logger.error(`Error initiating payment: ${error.message}`, { error });
  //     res.status(error.status || 500).json({ error: error.message });
  //   }
  // },

payFeesByType : async (req, res) => {
  try {
    const { studentId } = req.params;
    const { feeTypes, month, year, amounts, selectedPaymentType } = req.body;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const FeeModel = Fee(connection);
    const PaymentModel = Payment(connection);
    const UserModel = User(connection);
    const ClassModel = require('../models/Class')(connection);

    logger.info('Starting payFeesByType', { studentId, selectedPaymentType, feeTypes });

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid student ID' });
    }
    if (!feeTypes || !Array.isArray(feeTypes) || feeTypes.length === 0) {
      return res.status(400).json({ message: 'Fee types are required' });
    }
    if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
      return res.status(400).json({ message: 'Month and year must be valid numbers' });
    }
    if (parseInt(month) < 1 || parseInt(month) > 12) {
      return res.status(400).json({ message: 'Month must be between 1 and 12' });
    }
    if (!selectedPaymentType) {
      return res.status(400).json({ message: 'Selected payment type is required' });
    }

    // Validate student
    const student = await UserModel.findById(studentId)
      .select(
        'name email studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails'
      )
      .populate('studentDetails.class', 'name division');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    if (!student.studentDetails.class) {
      return res.status(400).json({ message: 'Student is not assigned to a class' });
    }
    if (await checkRTEExemption(student, connection)) {
      return res.status(400).json({ message: 'RTE students are exempted from fees' });
    }

    // Fetch school payment configuration
    const ownerConnection = await getOwnerConnection();
    const School = require('../models/School')(ownerConnection);
    const school = await School.findById(schoolId)
    .select('+paymentConfig.details.razorpayKeySecret +paymentConfig.details.paytmMerchantKey +paymentConfig.details.stripeSecretKey')
    .lean();
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Add detailed logging for payment configuration
    logger.info('School payment config', { 
      paymentConfig: school.paymentConfig.map(pc => ({
        paymentType: pc.paymentType,
        isActive: pc.isActive,
        hasDetails: pc.details ? true : false,
        detailsKeys: pc.details ? Object.keys(pc.details) : []
      }))
    });

    const paymentConfig = school.paymentConfig.find(
      (config) => config.paymentType === selectedPaymentType && config.isActive
    );
    
    if (!paymentConfig) {
      return res.status(400).json({
        message: `Payment type ${selectedPaymentType} is not configured or active`,
      });
    }

    // Log the found payment config structure (without sensitive data)
    logger.info('Selected payment config', { 
      paymentType: paymentConfig.paymentType,
      isActive: paymentConfig.isActive,
      hasDetails: paymentConfig.details ? true : false,
      detailsKeys: paymentConfig.details ? Object.keys(paymentConfig.details) : []
    });

    // Aggregate fee definitions
    const feeDefinitions = await FeeModel.aggregate([
      {
        $match: {
          school: new mongoose.Types.ObjectId(schoolId),
          month: parseInt(month),
          year: parseInt(year),
          student: null,
          type: { $in: feeTypes },
          classes: {
            $elemMatch: {
              $eq: new mongoose.Types.ObjectId(student.studentDetails.class._id),
            },
          },
        },
      },
      {
        $group: {
          _id: {
            type: '$type',
            distanceSlab: '$transportationDetails.distanceSlab',
          },
          type: { $first: '$type' },
          amount: { $first: '$amount' },
          description: { $first: '$description' },
          dueDate: { $first: '$dueDate' },
          transportationDetails: { $first: '$transportationDetails' },
        },
      },
      {
        $project: {
          _id: 0,
          type: 1,
          amount: 1,
          description: 1,
          dueDate: 1,
          transportationDetails: 1,
        },
      },
    ]);

    // Validate requested fee types
    const requestedFeeTypes = new Set(feeTypes);
    const availableFeeTypes = new Set(feeDefinitions.map((fee) => fee.type));
    const invalidFeeTypes = [...requestedFeeTypes].filter(
      (type) => !availableFeeTypes.has(type)
    );
    if (invalidFeeTypes.length > 0) {
      return res.status(404).json({
        message: `Invalid or undefined fee types: ${invalidFeeTypes.join(', ')}`,
      });
    }

    // Filter valid fee definitions
    const validFeeDefinitions = feeDefinitions.filter(
      (fee) =>
        fee.type !== 'transportation' ||
        (student.studentDetails.transportDetails?.isApplicable &&
          fee.transportationDetails?.distanceSlab ===
            student.studentDetails.transportDetails.distanceSlab)
    );
    if (validFeeDefinitions.length === 0) {
      return res.status(400).json({ message: 'No valid fee types found for payment' });
    }

    // Fetch existing student fees
    const studentFees = await FeeModel.find({
      student: studentId,
      school: schoolId,
      month: parseInt(month),
      year: parseInt(year),
      type: { $in: feeTypes },
    });

    // Check existing payments
    const existingPayments = await PaymentModel.find({
      student: studentId,
      school: schoolId,
      'feesPaid.month': parseInt(month),
      'feesPaid.year': parseInt(year),
      'feesPaid.type': { $in: feeTypes },
      status: 'completed',
    });

    const paidTypes = new Set(
      existingPayments.flatMap((p) =>
        p.feesPaid.map((f) =>
          f.type === 'transportation' && f.transportationSlab
            ? `${f.type}_${f.transportationSlab}`
            : f.type
        )
      )
    );

    // Filter fees to pay
    const feesToPay = validFeeDefinitions.filter((fee) => {
      const feeKey =
        fee.type === 'transportation' && fee.transportationDetails?.distanceSlab
          ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
          : fee.type;
      return !paidTypes.has(feeKey);
    });
    if (feesToPay.length === 0) {
      return res.status(400).json({ message: 'All selected fees are already paid' });
    }

    // Map amounts by type
    const amountMap = amounts
      ? feeTypes.reduce((map, type, index) => {
          map[type] = amounts[index];
          return map;
        }, {})
      : {};

    // Validate payment amounts
    const paymentDetails = feesToPay.map((fee) => {
      const studentFee = studentFees.find((f) => f.type === fee.type);
      const amountToPay = amountMap[fee.type] || fee.amount;
      if (
        amountToPay <= 0 ||
        amountToPay > (studentFee?.remainingAmount || fee.amount)
      ) {
        throw new Error(`Invalid payment amount for ${fee.type}: ${amountToPay}`);
      }
      return {
        fee,
        studentFee,
        amountToPay,
      };
    });

    // Calculate total amount
    const totalAmountInINR = paymentDetails.reduce(
      (sum, { amountToPay }) => sum + amountToPay,
      0
    );
    const totalAmountInPaise = totalAmountInINR * 100;

    // Initialize payment based on selected payment type
    let order, paymentResponse;
    const receiptNumber = `FS-${studentId}-${Date.now()}`;

    logger.info('Initializing payment', { selectedPaymentType, totalAmountInINR });

    // Safely attempt to decrypt credentials
    const safeDecrypt = (encryptedText) => {
      try {
        if (!encryptedText || typeof encryptedText !== 'string') {
          logger.error('Invalid encrypted text', { encryptedText: typeof encryptedText });
          throw new Error('Invalid encrypted credentials');
        }
        return decrypt(encryptedText);
      } catch (error) {
        logger.error('Decryption error', { error: error.message });
        throw new Error('Failed to decrypt payment credentials');
      }
    };

   
     if (selectedPaymentType === 'razorpay') {
  try {
    // Log configuration details WITHOUT exposing sensitive data
    logger.info('Razorpay config details check', {
      hasDetails: paymentConfig.details ? true : false,
      hasKeyId: paymentConfig.details?.razorpayKeyId ? true : false,
      hasKeySecret: paymentConfig.details?.razorpayKeySecret ? true : false,
      keyIdType: typeof paymentConfig.details?.razorpayKeyId,
      keySecretType: typeof paymentConfig.details?.razorpayKeySecret
    });

    // Validate that credentials exist and are strings before decryption
    if (!paymentConfig.details || 
        !paymentConfig.details.razorpayKeyId || 
        !paymentConfig.details.razorpayKeySecret) {
      throw new Error('Razorpay credentials are missing');
    }
    
    const keyId = safeDecrypt(paymentConfig.details.razorpayKeyId);
    const keySecret = safeDecrypt(paymentConfig.details.razorpayKeySecret);

    logger.info('Razorpay credentials decrypted successfully');

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: totalAmountInPaise,
      currency: 'INR',
      receipt: `fee_${studentId.slice(-8)}_${month}${year}_${Date.now().toString().slice(-10)}`,
    };
    
    logger.info('Attempting to create Razorpay order', { options: { ...options, amount: options.amount } });

    order = await razorpay.orders.create(options);
    
    logger.info('Razorpay order created successfully', { orderId: order.id });
    
    paymentResponse = {
      orderId: order.id,
      amountInPaise: totalAmountInPaise,
      amountInINR: totalAmountInINR,
      currency: 'INR',
      key: keyId,
      message: 'Payment initiated. Proceed with Razorpay checkout.',
    };
  } catch (error) {
    logger.error('Razorpay initialization error', { error: error.message, stack: error.stack });
    return res.status(500).json({ 
      error: 'Failed to initialize Razorpay payment', 
      details: error.message 
    });
  }
}
     else if (selectedPaymentType === 'stripe') {
      try {
        // Log configuration details WITHOUT exposing sensitive data
        logger.info('Stripe config details check', {
          hasDetails: paymentConfig.details ? true : false,
          hasSecretKey: paymentConfig.details?.stripeSecretKey ? true : false,
          hasPublishableKey: paymentConfig.details?.stripePublishableKey ? true : false,
          secretKeyType: typeof paymentConfig.details?.stripeSecretKey,
          publishableKeyType: typeof paymentConfig.details?.stripePublishableKey
        });

        if (!paymentConfig.details || 
            !paymentConfig.details.stripeSecretKey || 
            !paymentConfig.details.stripePublishableKey) {
          throw new Error('Stripe credentials are missing');
        }

        const stripeSecretKey = safeDecrypt(paymentConfig.details.stripeSecretKey);
        const stripePublishableKey = safeDecrypt(paymentConfig.details.stripePublishableKey);

        logger.info('Stripe credentials decrypted successfully');

        const stripe = new Stripe(stripeSecretKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: totalAmountInPaise,
          currency: 'inr',
          payment_method_types: ['card'],
          metadata: {
            studentId,
            month,
            year,
            receipt: receiptNumber,
          },
        });
        paymentResponse = {
          clientSecret: paymentIntent.client_secret,
          amountInINR: totalAmountInINR,
          currency: 'INR',
          key: stripePublishableKey,
          message: 'Payment initiated. Proceed with Stripe checkout.',
        };
      } catch (error) {
        logger.error('Stripe initialization error', { error: error.message, stack: error.stack });
        return res.status(500).json({ 
          error: 'Failed to initialize Stripe payment', 
          details: error.message 
        });
      }
    } else if (selectedPaymentType === 'bank_account') {
      paymentResponse = {
        bankDetails: {
          bankName: paymentConfig.details.bankName,
          accountNumber: paymentConfig.details.accountNumber,
          ifscCode: paymentConfig.details.ifscCode,
          accountHolderName: paymentConfig.details.accountHolderName,
        },
        amountInINR: totalAmountInINR,
        receiptNumber,
        message: 'Please transfer the amount to the provided bank account and upload proof of payment.',
      };
    } else if (selectedPaymentType === 'upi') {
      paymentResponse = {
        upiId: paymentConfig.details.upiId,
        amountInINR: totalAmountInINR,
        receiptNumber,
        message: 'Please send the amount to the provided UPI ID and upload proof of payment.',
      };
   
    }
   // Complete PayTM implementation with exact specifications
else if (selectedPaymentType === 'paytm') {
  try {
    // Log configuration details WITHOUT exposing sensitive data
    logger.info('Paytm config details check', {
      hasDetails: paymentConfig.details ? true : false,
      hasMid: paymentConfig.details?.paytmMid ? true : false,
      hasMerchantKey: paymentConfig.details?.paytmMerchantKey ? true : false
    });

    if (!paymentConfig.details || 
        !paymentConfig.details.paytmMid || 
        !paymentConfig.details.paytmMerchantKey) {
      throw new Error('Paytm MID or Merchant Key is missing in payment configuration');
    }

    const mid = safeDecrypt(paymentConfig.details.paytmMid);
    const merchantKey = safeDecrypt(paymentConfig.details.paytmMerchantKey);

    logger.info('Paytm credentials decrypted successfully');

    // ====== IMPORTANT: Ensure orderId is 100% unique and properly formatted ======
    // Adding timestamp to ensure uniqueness - PayTM has strict requirements for order IDs
    const timestamp = Date.now();
    const sanitizedOrderId = `ORDER_${studentId.substring(0, 8)}_${timestamp}`;
    
    // Generate a unique transaction ID (required by PayTM)
    const txnId = `TXN_${timestamp}`;

    // ====== Properly format the request based on PayTM's exact specifications ======
    const requestParams = {
      MID: mid,
      ORDER_ID: sanitizedOrderId,
      CHANNEL_ID: 'WEB', // Standard channel for web-based transactions
      INDUSTRY_TYPE_ID: 'Retail', // Use Retail for educational institutions
      WEBSITE: 'DEFAULT',
      TXN_AMOUNT: totalAmountInINR.toFixed(2),
      CUST_ID: studentId,
      CALLBACK_URL: `${process.env.SERVER_URL}/api/payment/paytm/callback`,
      EMAIL: student.email || 'noemail@example.com', // PayTM often requires email
      MOBILE_NO: student.studentDetails?.parentDetails?.phoneNumber || '0000000000' // PayTM often requires mobile
    };
    
    logger.info('Paytm request params prepared', {
      orderId: requestParams.ORDER_ID,
      amount: requestParams.TXN_AMOUNT,
      hasEmail: !!requestParams.EMAIL,
      hasMobile: !!requestParams.MOBILE_NO
    });

    // ====== Use PayTM's official integration SDK approach ======
    // Create a simple checksum without relying on the problematic library
    const crypto = require('crypto');
    
    // 1. Sort keys in alphabetical order (required by PayTM)
    const sortedKeys = Object.keys(requestParams).sort();
    const sortedParams = {};
    sortedKeys.forEach(key => {
      sortedParams[key] = requestParams[key];
    });
    
    // 2. Create parameter string in format key=value|key2=value2|...
    const paramString = Object.keys(sortedParams)
      .map(key => `${key}=${sortedParams[key]}`)
      .join('&');
    
    logger.info('Generated param string for signature', { 
      paramStringLength: paramString.length
    });
    
    // 3. Generate checksum using SHA256 with merchant key
    const checksum = crypto
      .createHmac('sha256', merchantKey)
      .update(paramString)
      .digest('hex');
      
    logger.info('Generated checksum', {
      checksumLength: checksum.length
    });
    
    // 4. Add checksum to the params
    requestParams.CHECKSUMHASH = checksum;

    // ====== Add the PayTM transaction to our database ======
    // This is important for tracking the transaction before redirect
    const newFee = await FeeModel.findOneAndUpdate(
      {
        school: schoolId,
        student: studentId,
        month: parseInt(month),
        year: parseInt(year),
        type: feeTypes[0]  // Associate with the first fee type
      },
      {
        $push: {
          paymentDetails: {
            transactionId: txnId,
            paymentDate: new Date(),
            paymentMethod: 'paytm',
            receiptNumber: sanitizedOrderId,
            amount: totalAmountInINR,
            status: 'pending'
          }
        }
      },
      { new: true }
    );

    logger.info('Fee record updated with pending Paytm transaction', {
      feeId: newFee?._id || 'Not found',
      transactionId: txnId
    });

    // ====== Prepare the PayTM redirect form data ======
    // For PayTM, we need to return data for a form POST
    paymentResponse = {
      formData: requestParams, // All params including checksum
      merchantId: mid,
      orderId: sanitizedOrderId,
      txnId: txnId,
      amountInINR: totalAmountInINR,
      receiptNumber: sanitizedOrderId,
      message: 'Paytm payment initiated. Form data prepared for redirect.',
      // PayTM staging vs production URL
      gatewayUrl: process.env.PAYTM_ENV === 'production'
        ? 'https://securegw.paytm.in/theia/processTransaction'
        : 'https://securegw-stage.paytm.in/theia/processTransaction',
      environment: process.env.PAYTM_ENV || 'staging'
    };
    
    logger.info('Paytm payment response prepared successfully');
    
  } catch (error) {
    logger.error('Paytm API error', { 
      error: error.message, 
      stack: error.stack
    });
    return res.status(500).json({ 
      error: 'Failed to initialize Paytm payment', 
      details: error.message 
    });
  }
}
    else {
      return res.status(400).json({ message: `Unsupported payment type: ${selectedPaymentType}` });
    }

    logger.info('Payment response prepared', { 
      paymentMethod: selectedPaymentType,
      hasResponse: paymentResponse ? true : false,
      responseKeys: paymentResponse ? Object.keys(paymentResponse) : [] 
    });

    // Update or create fee documents
    const updatedFees = await Promise.all(
      paymentDetails.map(async ({ fee, studentFee, amountToPay }) => {
        const paymentDetail = {
          transactionId:
            selectedPaymentType === 'razorpay'
              ? `PENDING-${order?.id}`
              : `PENDING-${receiptNumber}`,
          paymentDate: new Date(),
          paymentMethod: selectedPaymentType,
          receiptNumber,
          amount: amountToPay,
        };
        if (fee.type === 'transportation' && fee.transportationDetails?.distanceSlab) {
          paymentDetail.transportationSlab = fee.transportationDetails.distanceSlab;
        }

        if (!studentFee) {
          const newFee = new FeeModel({
            school: schoolId,
            student: studentId,
            grNumber: student.studentDetails.grNumber,
            classes: [student.studentDetails.class._id],
            type: fee.type,
            amount: fee.amount,
            paidAmount: 0,
            remainingAmount: fee.amount,
            dueDate: fee.dueDate,
            month: parseInt(month),
            year: parseInt(year),
            description: fee.description,
            status: 'pending',
            isRTE: student.studentDetails.isRTE || false,
            transportationDetails: fee.transportationDetails || null,
            paymentDetails: [paymentDetail],
          });
          await newFee.save();
          return newFee;
        } else {
          studentFee.paymentDetails.push(paymentDetail);
          await studentFee.save();
          return studentFee;
        }
      })
    );

    // Create payment record
    const payment = new PaymentModel({
      school: schoolId,
      student: studentId,
      grNumber: student.studentDetails.grNumber,
      amount: totalAmountInINR,
      paymentMethod: selectedPaymentType,
      status: 'pending',
      orderId: order?.id || paymentResponse.clientSecret || receiptNumber,
      receiptNumber,
      feesPaid: updatedFees.map((fee) => ({
        feeId: fee._id,
        type: fee.type,
        month: parseInt(month),
        year: parseInt(year),
        amount: fee.paymentDetails[fee.paymentDetails.length - 1].amount,
        ...(fee.type === 'transportation' &&
          fee.transportationDetails?.distanceSlab && {
            transportationSlab: fee.transportationDetails.distanceSlab,
          }),
      })),
    });

    await payment.save();

    logger.info('Payment record saved', { paymentId: payment._id });

    // Send confirmation
    await sendPaymentConfirmation(student, payment, null);

    logger.info('Payment confirmation sent');

    res.json({
      payment,
      ...paymentResponse,
    });
  } catch (error) {
    logger.error(`Error initiating payment: ${error.message}`, { error: error.stack });
    res.status(error.status || 500).json({ error: error.message });
  }
},

  getFeeReceipts: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);
      const { getPublicFileUrl } = require("../config/s3Upload");

      // Ensure student is authorized
      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only view your own receipts",
        });
      }

      // Fetch completed payments
      const payments = await PaymentModel.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "student",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $lookup: {
            from: "fees",
            let: {
              feeIds: "$feesPaid.feeId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$feeIds"],
                  },
                },
              },
            ],
            as: "fees",
          },
        },
        { $sort: { paymentDate: -1 } },
      ]);

      // Debugging: Log the payments to inspect the fees array
      console.log("Payments with fees:", JSON.stringify(payments, null, 2));

      const receipts = await Promise.all(
        payments.map(async (payment) => {
          let receiptUrl = payment.receiptUrl;
          let receiptError = null;

          if (!receiptUrl) {
            let attempts = 3;
            while (attempts > 0) {
              try {
                const feeSlip = await generateFeeSlip(
                  payment.student,
                  payment,
                  payment.fees,
                  schoolId,
                  `${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`
                );

                // This will now be a permanent URL from our getPublicFileUrl function
                receiptUrl = feeSlip.pdfUrl;

                await PaymentModel.updateOne(
                  { _id: payment._id },
                  {
                    $set: {
                      receiptUrl,
                      [`receiptUrls.${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`]:
                        receiptUrl,
                    },
                  },
                  { session: null }
                );
                break;
              } catch (uploadError) {
                logger.warn(
                  `Failed to generate fee slip for payment ${
                    payment._id
                  }, attempt ${4 - attempts}: ${uploadError.message}`
                );
                attempts--;
                if (attempts === 0) {
                  receiptError = "Failed to generate receipt URL";
                  receiptUrl = null;
                }
              }
            }
          }

          return {
            paymentId: payment._id,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptUrl,
            receiptError,
            receiptUrls: payment.receiptUrls || {},
            student: {
              name: payment.student.name,
              grNumber: payment.student.studentDetails.grNumber,
            },
            fees: payment.fees.map((fee) => ({
              type: fee.type,
              amount: fee.amount,
              paidAmount: fee.paidAmount,
              remainingAmount: fee.remainingAmount,
              month: fee.month,
              year: fee.year,
              dueDate: fee.dueDate,
              status: fee.status,
              ...(fee.transportationDetails?.distanceSlab && {
                transportationSlab: fee.transportationDetails.distanceSlab,
              }),
            })),
          };
        })
      );

      logger.info(`Fee receipts fetched for student ${studentId}`);
      res.json(receipts);
    } catch (error) {
      logger.error(`Error fetching fee receipts: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getStudentFeeStatus: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const FeeModel = Fee(connection);
      const ClassModel = require("../models/Class")(connection);

      // Ensure student is authorized
      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only view your own fee status",
        });
      }

      // Validate student
      const student = await UserModel.findById(studentId)
        .select(
          "_id name studentDetails.isRTE studentDetails.transportDetails studentDetails.class studentDetails.grNumber"
        )
        .populate("studentDetails.class", "name division");
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (!student.studentDetails.class) {
        return res
          .status(400)
          .json({ message: "Student is not assigned to a class" });
      }

      if (await checkRTEExemption(student, connection)) {
        return res.json({
          studentId: student._id,
          grNumber: student.studentDetails.grNumber,
          studentName: student.name,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
          isRTE: true,
          fees: [],
          totalPending: 0,
        });
      }

      // Fetch fees with transportation slab matching
      const fees = await FeeModel.find({
        student: studentId,
        school: schoolId,
        status: { $in: ["pending", "partially_paid", "paid"] },
        $or: [
          { type: { $ne: "transportation" } },
          {
            type: "transportation",
            "transportationDetails.isApplicable": true,
            "transportationDetails.distanceSlab":
              student.studentDetails.transportDetails?.distanceSlab,
          },
        ],
      })
        .populate("classes", "name division")
        .sort({ year: 1, month: 1 });

      const feeSummary = fees.map((fee) => ({
        id: fee._id,
        type: fee.type,
        month: fee.month,
        year: fee.year,
        amount: fee.amount,
        paidAmount: fee.paidAmount,
        remainingAmount: fee.remainingAmount,
        dueDate: fee.dueDate,
        status: fee.status,
        description: fee.description,
        ...(fee.transportationDetails?.distanceSlab && {
          transportationSlab: fee.transportationDetails.distanceSlab,
        }),
      }));

      const totalPending = fees.reduce(
        (sum, fee) => sum + fee.remainingAmount,
        0
      );

      logger.info(`Fee status fetched for student ${studentId}`);
      res.json({
        studentId: student._id,
        grNumber: student.studentDetails.grNumber,
        studentName: student.name,
        class: student.studentDetails.class
          ? {
              _id: student.studentDetails.class._id,
              name: student.studentDetails.class.name,
              division: student.studentDetails.class.division,
            }
          : null,
        isRTE: false,
        fees: feeSummary,
        totalPending,
      });
    } catch (error) {
      logger.error(`Error fetching student fee status: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // Other existing functions (unchanged)
  getAttendance: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Attendance = require("../models/Attendance")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        user: studentId,
        school: schoolId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(
        (a) => a.status === "present"
      ).length;
      const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      logger.info(
        `Attendance fetched for student ${studentId} for ${month}/${year}`
      );
      res.json({
        attendance,
        statistics: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          percentage: percentage.toFixed(2),
        },
      });
    } catch (error) {
      logger.error(`Error fetching attendance: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  
  getStudyMaterials: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.dbConnection;
      const UserModel = User(connection);
      const StudyMaterial = require("../models/StudyMaterial")(connection);
      const ClassModel = require("../models/Class")(connection);
      const SubjectModel = require("../models/Subject")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: studentId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "You are not enrolled in this class",
        });
      }

      // Fetch study materials for the student's class
      const materials = await StudyMaterial.find({
        school: schoolId,
        class: student.studentDetails.class,
        isActive: true,
      })
        .populate("subject", "name")
        .populate("uploadedBy", "name")
        .lean()
        .sort({ createdAt: -1 });

      // Format response
      const formattedMaterials = materials.map((m) => ({
        id: m._id,
        title: m.title,
        description: m.description,
        subject: m.subject ? m.subject.name : "Unknown",
        type: m.type,
        attachments: m.attachments.map((att) => ({
          fileName: att.fileName,
          fileUrl: att.fileUrl, // Public URL from S3
          fileType: att.fileType,
        })),
        uploadedBy: m.uploadedBy ? m.uploadedBy.name : "Unknown",
        createdAt: m.createdAt,
      }));

      logger.info(`Study materials fetched for student ${studentId}`);
      res.json({
        message: "Study materials retrieved successfully",
        materials: formattedMaterials,
      });
    } catch (error) {
      logger.error(`Error fetching study materials: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  

  getAssignedHomework: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const Homework = require("../models/Homework")(connection);
      const ClassModel = Class(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: studentId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "You are not enrolled in this class",
        });
      }

      // Fetch homework for the student's class
      const homework = await Homework.find({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("subject", "name")
        .populate("assignedBy", "name")
        .lean()
        .sort({ dueDate: 1 });

      // Format response
      const formattedHomework = homework.map((hw) => {
        const studentSubmission = hw.submissions.find(
          (sub) => sub.student.toString() === studentId
        );
        return {
          id: hw._id,
          title: hw.title,
          description: hw.description,
          subject: hw.subject ? hw.subject.name : "Unknown",
          assignedBy: hw.assignedBy ? hw.assignedBy.name : "Unknown",
          assignedDate: hw.assignedDate,
          dueDate: hw.dueDate,
          attachments: hw.attachments,
          submission: studentSubmission
            ? {
                status: studentSubmission.status,
                submissionDate: studentSubmission.submissionDate,
                files: studentSubmission.files,
                grade: studentSubmission.grade,
                feedback: studentSubmission.feedback,
              }
            : null,
        };
      });

      logger.info(`Homework fetched for student ${studentId}`);
      res.json({
        message: "Homework retrieved successfully",
        homework: formattedHomework,
      });
    } catch (error) {
      logger.error(`Error fetching homework: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getSyllabus: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.dbConnection;
      const UserModel = User(connection);
      const Syllabus = require("../models/Syllabus")(connection);
      const ClassModel = Class(connection);
      const SubjectModel = require("../models/Subject")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: studentId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "You are not enrolled in this class",
        });
      }

      // Fetch syllabus for the student's class
      const syllabi = await Syllabus.find({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("subject", "name")
        .lean()
        .sort({ updatedAt: -1 });

      // Format response
      const formattedSyllabi = syllabi.map((s) => ({
        id: s._id,
        subject: s.subject ? s.subject.name : "Unknown",
        content: s.content,
        documents: s.documents.map((doc) => ({
          title: doc.title,
          url: doc.url, // Public URL from S3
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
        })),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      logger.info(`Syllabus fetched for student ${studentId}`);
      res.json({
        message: "Syllabus retrieved successfully",
        syllabi: formattedSyllabi,
      });
    } catch (error) {
      logger.error(`Error fetching syllabus: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  submitHomework: async (req, res) => {
    try {
      const { homeworkId } = req.params;
      const { files, comments } = req.body;
      const studentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Homework = require("../models/Homework")(connection);
      const User = require("../models/User")(connection);

      if (!mongoose.Types.ObjectId.isValid(homeworkId)) {
        return res.status(400).json({ message: "Invalid homework ID" });
      }

      const homework = await Homework.findOne({
        _id: homeworkId,
        school: schoolId,
      });
      if (!homework) {
        return res.status(404).json({ message: "Homework not found" });
      }

      const student = await User.findById(studentId);
      if (
        student.studentDetails.class.toString() !== homework.class.toString()
      ) {
        return res
          .status(403)
          .json({ message: "This homework is not assigned to your class" });
      }

      const existingSubmission = homework.submissions.find(
        (s) => s.student.toString() === studentId.toString()
      );

      if (existingSubmission) {
        existingSubmission.files = files || existingSubmission.files;
        existingSubmission.comments = comments || existingSubmission.comments;
        existingSubmission.submissionDate = new Date();
        existingSubmission.status =
          new Date() > homework.dueDate ? "late" : "submitted";
      } else {
        const submission = {
          student: studentId,
          submissionDate: new Date(),
          files: files || [],
          comments: comments || "",
          status: new Date() > homework.dueDate ? "late" : "submitted",
        };
        homework.submissions.push(submission);
      }

      await homework.save();

      const submission = homework.submissions.find(
        (s) => s.student.toString() === studentId.toString()
      );
      logger.info(`Homework ${homeworkId} submitted by student ${studentId}`);
      res.json(submission);
    } catch (error) {
      logger.error(`Error submitting homework: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getExamSchedule: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const exams = await Exam.find({
        school: schoolId,
        class: student.studentDetails.class,
        date: { $gte: new Date() },
      })
        .populate("subject", "name", Subject)
        .sort({ date: 1 });

      const examsWithSeating = exams.map((exam) => {
        let seatInfo = null;
        if (exam.seatingArrangement) {
          for (const room of exam.seatingArrangement) {
            for (const row of room.arrangement) {
              const studentSeat = row.students.find(
                (s) => s.student.toString() === studentId
              );
              if (studentSeat) {
                seatInfo = {
                  room: room.classroom,
                  row: row.row,
                  position: studentSeat.position,
                };
                break;
              }
            }
            if (seatInfo) break;
          }
        }
        return { ...exam.toObject(), seatingInfo: seatInfo };
      });

      logger.info(`Exam schedule fetched for student ${studentId}`);
      res.json(examsWithSeating);
    } catch (error) {
      logger.error(`Error fetching exam schedule: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getResults: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { examId } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);
      const Result = require("../models/Results")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      if (examId) {
        if (!mongoose.Types.ObjectId.isValid(examId)) {
          return res.status(400).json({ message: "Invalid exam ID" });
        }

        const result = await Result.findOne({
          student: studentId,
          exam: examId,
          school: schoolId,
          status: "published",
        })
          .populate("exam", "examType customExamType totalMarks")
          .populate("subject", "name");

        if (!result) {
          return res
            .status(404)
            .json({ message: "Result not found or not published" });
        }

        const percentage = (result.marksObtained / result.totalMarks) * 100;
        const grade = studentController.calculateGrade(percentage);

        logger.info(
          `Exam result fetched for student ${studentId}, exam ${examId}`
        );
        res.json({
          examId: result.exam._id,
          exam:
            result.exam.examType === "Other"
              ? result.exam.customExamType
              : result.exam.examType,
          subject: result.subject.name,
          marks: result.marksObtained,
          totalMarks: result.totalMarks,
          percentage: percentage.toFixed(2),
          grade,
          remarks: result.remarks,
          marksheet: result.marksheet
            ? {
                url: result.marksheet.url,
                key: result.marksheet.key,
              }
            : null,
        });
      } else {
        const student = await User.findOne({
          _id: studentId,
          school: schoolId,
        }).select("studentDetails.class");
        if (!student || !student.studentDetails.class) {
          return res.status(404).json({ message: "Student class not found" });
        }

        const results = await Result.find({
          student: studentId,
          school: schoolId,
          class: student.studentDetails.class,
          status: "published",
        })
          .populate("exam", "examType customExamType totalMarks date")
          .populate("subject", "name")
          .sort({ "exam.date": -1 });

        const formattedResults = results.map((result) => {
          const percentage = (result.marksObtained / result.totalMarks) * 100;
          const grade = studentController.calculateGrade(percentage);
          return {
            examId: result.exam._id,
            exam:
              result.exam.examType === "Other"
                ? result.exam.customExamType
                : result.exam.examType,
            subject: result.subject.name,
            date: result.exam.date,
            marks: result.marksObtained,
            totalMarks: result.totalMarks,
            percentage: percentage.toFixed(2),
            grade,
            remarks: result.remarks,
            marksheet: result.marksheet
              ? {
                  url: result.marksheet.url,
                  key: result.marksheet.key,
                }
              : null,
          };
        });

        logger.info(`All exam results fetched for student ${studentId}`);
        res.json(formattedResults);
      }
    } catch (error) {
      logger.error(`Error fetching results: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getMarksheets: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Result = require("../models/Results")(connection);
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only view your own marksheets",
        });
      }

      const results = await Result.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(studentId),
            school: new mongoose.Types.ObjectId(schoolId),
            status: "published",
            marksheet: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "exams",
            localField: "exam",
            foreignField: "_id",
            as: "examInfo",
          },
        },
        {
          $unwind: "$examInfo",
        },
        {
          $lookup: {
            from: "classes",
            localField: "class",
            foreignField: "_id",
            as: "classInfo",
          },
        },
        {
          $unwind: "$classInfo",
        },
        {
          $lookup: {
            from: "subjects",
            localField: "subject",
            foreignField: "_id",
            as: "subjectInfo",
          },
        },
        {
          $unwind: "$subjectInfo",
        },
        {
          $group: {
            _id: "$examEvent",
            exam: {
              $first: {
                id: "$examInfo._id",
                name: {
                  $cond: [
                    { $eq: ["$examInfo.examType", "Other"] },
                    "$examInfo.customExamType",
                    "$examInfo.examType",
                  ],
                },
                date: "$examInfo.date",
              },
            },
            class: {
              $first: {
                id: "$classInfo._id",
                name: "$classInfo.name",
                division: "$classInfo.division",
              },
            },
            marksheet: { $first: "$marksheet" },
            publishedAt: { $first: "$publishedAt" },
            subjects: {
              $addToSet: {
                resultId: "$_id",
                id: "$subjectInfo._id",
                name: "$subjectInfo.name",
                marksObtained: "$marksObtained",
                totalMarks: "$totalMarks",
                percentage: {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$marksObtained", "$totalMarks"] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
              },
            },
          },
        },
        {
          $sort: { "exam.date": -1 },
        },
        {
          $project: {
            _id: 0,
            exam: 1,
            class: 1,
            marksheet: 1,
            publishedAt: 1,
            subjects: 1,
          },
        },
      ]);

      logger.info(`Marksheets fetched for student ${studentId}`);
      res.json({
        status: "success",
        count: results.length,
        marksheets: results,
      });
    } catch (error) {
      logger.error(`Error fetching marksheets: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  downloadMarksheet: async (req, res) => {
    try {
      const { studentId, examEventId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Result = require("../models/Results")(connection);

      if (
        !mongoose.Types.ObjectId.isValid(studentId) ||
        !mongoose.Types.ObjectId.isValid(examEventId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid student or exam event ID" });
      }

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only download your own marksheets",
        });
      }

      const result = await Result.findOne({
        examEvent: new mongoose.Types.ObjectId(examEventId),
        school: new mongoose.Types.ObjectId(schoolId),
        student: new mongoose.Types.ObjectId(studentId),
        status: "published",
        marksheet: { $ne: null },
      });

      if (!result) {
        return res.status(404).json({
          message: "Marksheet not found or not published",
        });
      }

      if (
        !result.marksheet.key ||
        !result.marksheet.key.endsWith(documentKey)
      ) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=marksheet_${examEventId}.pdf`
      );

      await streamS3Object(result.marksheet.key, res);
      logger.info(
        `Marksheet for exam event ${examEventId} downloaded by student ${studentId}`
      );
    } catch (error) {
      logger.error(`Error downloading marksheet: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getReportCard: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { term, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      if (!term || !year) {
        return res.status(400).json({ message: "Term and year are required" });
      }

      const reportCard = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        term,
        academicYear: year,
      })
        .populate("subjects.teacher", "name", User)
        .populate("class", "name division", Class)
        .populate("generatedBy", "name", User);

      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      const overallPerformance = calculateOverallPerformance(
        reportCard.subjects
      );

      logger.info(
        `Report card fetched for student ${studentId}, term ${term}, year ${year}`
      );
      res.json({ ...reportCard.toObject(), overallPerformance });
    } catch (error) {
      logger.error(`Error fetching report card: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  requestCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { type, purpose, urgency } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const FeeModel = Fee(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      const validTypes = ["bonafide", "leaving", "transfer"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid certificate type" });
      }

      if (["leaving", "transfer"].includes(type)) {
        const hasPendingFees = await FeeModel.findOne({
          student: studentId,
          school: schoolId,
          status: { $in: ["pending", "partially_paid"] },
        });
        if (hasPendingFees) {
          return res
            .status(400)
            .json({ message: "Clear all pending fees first" });
        }
      }

      const certificate = new Certificate({
        school: schoolId,
        student: studentId,
        type,
        purpose,
        urgency: urgency || "normal",
        status: "pending",
        requestDate: new Date(),
      });

      await certificate.save();

      logger.info(`Certificate ${type} requested by student ${studentId}`);
      res.status(201).json({
        certificate,
        message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
      });
    } catch (error) {
      logger.error(`Error requesting certificate: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getStudentCertificates: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only view your own certificates",
        });
      }

      const certificates = await Certificate.find({
        school: schoolId,
        student: studentId,
        isSentToStudent: true,
      })
        .populate("generatedBy", "name email")
        .sort({ requestDate: -1 });

      const formattedCertificates = certificates.map((cert) => ({
        id: cert._id,
        type: cert.type,
        purpose: cert.purpose,
        urgency: cert.urgency,
        requestDate: cert.requestDate,
        status: cert.status,
        documentUrl: cert.documentUrl || null,
        signedDocumentUrl: cert.signedDocumentUrl || null,
        issuedDate: cert.issuedDate || null,
        generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
        comments: cert.comments || null,
      }));

      logger.info(`Certificates fetched for student ${studentId}`);
      res.json({
        status: "success",
        count: formattedCertificates.length,
        certificates: formattedCertificates,
      });
    } catch (error) {
      logger.error(`Error fetching certificates: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  downloadCertificate: async (req, res) => {
    try {
      const { studentId, certificateId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const { streamS3Object } = require("../config/s3Upload");

      if (
        !mongoose.Types.ObjectId.isValid(studentId) ||
        !mongoose.Types.ObjectId.isValid(certificateId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid student or certificate ID" });
      }

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only download your own certificates",
        });
      }

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
        student: studentId,
        isSentToStudent: true,
      });

      if (!certificate) {
        return res.status(404).json({
          message: "Certificate not found or not available for download",
        });
      }

      const key =
        certificate.signedDocumentKey &&
        certificate.signedDocumentKey.endsWith(documentKey)
          ? certificate.signedDocumentKey
          : certificate.documentKey &&
            certificate.documentKey.endsWith(documentKey)
          ? certificate.documentKey
          : null;

      if (!key) {
        return res.status(404).json({ message: "Document not found" });
      }

      await streamS3Object(key, res);
      logger.info(
        `Certificate ${certificateId} downloaded by student ${studentId}`
      );
    } catch (error) {
      logger.error(`Error downloading certificate: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // getLibraryServices: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Library = require("../models/Library")(connection).Library;
  //     const BookIssue = require("../models/Library")(connection).BookIssue;

  //     if (!mongoose.Types.ObjectId.isValid(studentId)) {
  //       return res.status(400).json({ message: "Invalid student ID" });
  //     }

  //     const issuedBooks = await BookIssue.find({
  //       user: studentId,
  //       school: schoolId,
  //       status: { $in: ["issued", "overdue"] },
  //     }).populate("book", "", Library);

  //     const availableBooks = await Library.find({
  //       school: schoolId,
  //       status: "available",
  //     }).select("bookTitle author category");

  //     const booksWithFine = issuedBooks.map((issue) => {
  //       const dueDate = new Date(issue.dueDate);
  //       const today = new Date();
  //       let fine = 0;
  //       let daysOverdue = 0;
  //       if (dueDate < today) {
  //         daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
  //         fine = daysOverdue * 5; // ₹5 per day
  //       }
  //       return { ...issue.toObject(), fine, daysOverdue };
  //     });

  //     logger.info(`Library services fetched for student ${studentId}`);
  //     res.json({
  //       issuedBooks: booksWithFine,
  //       availableBooks,
  //       totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
  //     });
  //   } catch (error) {
  //     logger.error(`Error fetching library services: ${error.message}`, {
  //       error,
  //     });
  //     res.status(500).json({ error: error.message });
  //   }
  // },



getLibraryServices : async (req, res) => {
  try {
    const { studentId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Library = require("../models/Library")(connection).Library;
    const BookIssue = require("../models/Library")(connection).BookIssue;
    const User = require("../models/User")(connection);

    // Validate student ID
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      logger.error(`Invalid student ID: ${studentId}`);
      return res.status(400).json({ message: `Invalid student ID: ${studentId}` });
    }

    // Ensure student is authorized
    if (studentId !== req.user._id.toString()) {
      logger.warn(`Unauthorized access attempt for student ${studentId} by user ${req.user._id}`);
      return res.status(403).json({
        message: "Unauthorized: You can only access your own library services",
      });
    }

    // Verify student exists
    const student = await User.findById(studentId).select('role school');
    if (!student || student.role !== 'student' || student.school.toString() !== schoolId) {
      logger.error(`Student not found or invalid: ${studentId}`);
      return res.status(404).json({ message: `Student with ID ${studentId} not found` });
    }

    // Fetch issued books for the student
    const issuedBooks = await BookIssue.find({
      user: studentId,
      school: schoolId,
      status: { $in: ["issued", "overdue"] },
    }).populate("book", "bookTitle author category isbn");

    // Fetch available books
    const availableBooks = await Library.find({
      school: schoolId,
      status: "available",
    }).select("bookTitle author category isbn");

    // Calculate fines for issued books
    const booksWithFine = issuedBooks.map((issue) => {
      const fine = issue.fine || calculateFine(issue.dueDate); // Use stored fine or calculate
      const daysOverdue = issue.dueDate < new Date()
        ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        ...issue.toObject(),
        fine,
        daysOverdue,
      };
    });

    // Calculate total fine
    const totalFine = booksWithFine.reduce((sum, book) => sum + book.fine, 0);

    logger.info(`Library services fetched successfully for student ${studentId}`, {
      issuedBooksCount: booksWithFine.length,
      availableBooksCount: availableBooks.length,
      totalFine,
    });

    res.json({
      issuedBooks: booksWithFine,
      availableBooks,
      totalFine,
    });
  } catch (error) {
    const errorStudentId = req.params.studentId || 'unknown'; // Fallback if studentId is undefined
    logger.error(`Error fetching library services for student ${errorStudentId}: ${error.message}`, {
      error: error.stack,
    });
    res.status(500).json({ error: `Failed to fetch library services: ${error.message}` });
  }
},



getBooksForStudent: async (req, res) => {
  try {
    const { query, category, classId, isGeneral } = req.query;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Class = require("../models/Class")(connection);
    const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
    
    const searchCriteria = { school: schoolId };
    if (query) {
      searchCriteria.$or = [
        { bookTitle: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } },
        { isbn: { $regex: query, $options: 'i' } },
      ];
    }
    if (category) {
      const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
      if (!categoryExists) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      searchCriteria.category = category;
    }
    if (classId) {
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }
      searchCriteria.class = classId;
    }
    if (isGeneral !== undefined) {
      searchCriteria.isGeneral = isGeneral === 'true';
    }

    const books = await LibraryModel.find(searchCriteria)
      .select('bookTitle author isbn category class isGeneral totalCopies availableCopies status coverImage publisher publicationYear language')
      .populate('class', 'name')
      .sort({ bookTitle: 1 });

    logger.info(`Books fetched for student: ${query || category || classId || isGeneral}`, { schoolId });
    res.json({ books });
  } catch (error) {
    logger.error(`Error fetching books for student: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

 requestBook : async (req, res) => {
  try {
    const { studentId, bookId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;

    const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
    const UserModel = User(connection);

    if (studentId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only request books for yourself' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book ID' });
    }

    const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.availableCopies === 0) {
      return res.status(400).json({ message: 'No copies available. You can reserve the book instead.' });
    }

    const existingRecord = await BookIssueModel.findOne({
      book: bookId,
      user: studentId,
      school: schoolId,
      status: { $in: ['requested', 'issued', 'overdue', 'reserved'] },
    });
    if (existingRecord) {
      return res.status(400).json({
        message: `Cannot request book: already ${existingRecord.status === 'requested' ? 'requested' : existingRecord.status === 'reserved' ? 'reserved' : 'issued or overdue'}`,
      });
    }

    const activeIssues = await BookIssueModel.countDocuments({
      user: studentId,
      school: schoolId,
      status: { $in: ['issued', 'overdue'] },
    });
    if (activeIssues >= 3) {
      return res.status(400).json({ message: 'You have reached the maximum borrowing limit (3 books)' });
    }

    const request = new BookIssueModel({
      school: schoolId,
      book: bookId,
      user: studentId,
      issueDate: new Date(),
      status: 'requested',
    });

    await request.save();
    const student = await UserModel.findById(studentId);
    // await sendEmail({
    //   to: student.email,
    //   subject: 'Book Request Submitted',
    //   text: `Dear ${student.name},\n\nYour request for the book "${book.bookTitle}" has been submitted. You will be notified once it is approved.\n\nRegards,\nLibrary Team`,
    // });

    logger.info(`Book requested: ${book.bookTitle} by student ${studentId}`, { schoolId });
    res.status(201).json({ message: 'Book request submitted successfully', request });
  } catch (error) {
    logger.error(`Error requesting book: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

payFine : async (req, res) => {
  try {
    const { studentId, issueId } = req.params;
    const { paymentMethod } = req.body;
    const schoolId = req.school._id.toString();
    const connection = req.connection;

    const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
    const PaymentModel = PaymentModel(connection);
    const UserModel = User(connection);
    const SchoolModel = SchoolModel(connection);

    if (studentId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only pay your own fines' });
    }

    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      return res.status(400).json({ message: 'Invalid issue ID' });
    }

    const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId, user: studentId });
    if (!issue) {
      return res.status(404).json({ message: 'Book issue record not found' });
    }

    const fine = issue.fine || Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5;
    if (fine <= 0) {
      return res.status(400).json({ message: 'No fine to pay' });
    }

    const school = await SchoolModel.findById(schoolId)
      .select('+paymentConfig.details.razorpayKeySecret +paymentConfig.details.paytmMerchantKey +paymentConfig.details.stripeSecretKey')
      .lean();
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const paymentConfig = school.paymentConfig.find(
      (config) => config.paymentType === paymentMethod && config.isActive
    );
    if (!paymentConfig) {
      return res.status(400).json({
        message: `Payment type ${paymentMethod} is not configured or active`,
      });
    }

    let paymentResponse;
    const receiptNumber = `FINE-${studentId}-${Date.now()}`;
    const totalAmountInPaise = fine * 100;

    if (paymentMethod === 'razorpay') {
      const keyId = decrypt(paymentConfig.details.razorpayKeyId);
      const keySecret = decrypt(paymentConfig.details.razorpayKeySecret);
      const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

      const order = await razorpay.orders.create({
        amount: totalAmountInPaise,
        currency: 'INR',
        receipt: `fine_${studentId.slice(-8)}_${Date.now()}`,
      });

      paymentResponse = {
        orderId: order.id,
        amountInPaise: totalAmountInPaise,
        amountInINR: fine,
        currency: 'INR',
        key: keyId,
        message: 'Payment initiated. Proceed with Razorpay checkout.',
      };
    } else if (paymentMethod === 'stripe') {
      const stripeSecretKey = decrypt(paymentConfig.details.stripeSecretKey);
      const stripePublishableKey = decrypt(paymentConfig.details.stripePublishableKey);
      const stripe = new Stripe(stripeSecretKey);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountInPaise,
        currency: 'inr',
        payment_method_types: ['card'],
        metadata: { studentId, issueId, receipt: receiptNumber },
      });

      paymentResponse = {
        clientSecret: paymentIntent.client_secret,
        amountInINR: fine,
        currency: 'INR',
        key: stripePublishableKey,
        message: 'Payment initiated. Proceed with Stripe checkout.',
      };
    } else if (paymentMethod === 'paytm') {
      const mid = decrypt(paymentConfig.details.paytmMid);
      const merchantKey = decrypt(paymentConfig.details.paytmMerchantKey);
      const timestamp = Date.now();
      const sanitizedOrderId = `FINE_${studentId.substring(0, 8)}_${timestamp}`;
      const txnId = `TXN_${timestamp}`;

      const requestParams = {
        MID: mid,
        ORDER_ID: sanitizedOrderId,
        CHANNEL_ID: 'WEB',
        INDUSTRY_TYPE_ID: 'Retail',
        WEBSITE: 'DEFAULT',
        TXN_AMOUNT: fine.toFixed(2),
        CUST_ID: studentId,
        CALLBACK_URL: `${process.env.SERVER_URL}/api/payment/paytm/callback`,
        EMAIL: (await UserModel.findById(studentId).select('email')).email || 'noemail@example.com',
        MOBILE_NO: (await UserModel.findById(studentId).select('studentDetails.parentDetails.mobile')).studentDetails?.parentDetails?.mobile || '0000000000',
      };

      const sortedKeys = Object.keys(requestParams).sort();
      const sortedParams = {};
      sortedKeys.forEach(key => sortedParams[key] = requestParams[key]);
      const paramString = Object.keys(sortedParams).map(key => `${key}=${sortedParams[key]}`).join('&');
      const checksum = crypto.createHmac('sha256', merchantKey).update(paramString).digest('hex');

      requestParams.CHECKSUMHASH = checksum;

      paymentResponse = {
        formData: requestParams,
        merchantId: mid,
        orderId: sanitizedOrderId,
        txnId: txnId,
        amountInINR: fine,
        receiptNumber: sanitizedOrderId,
        message: 'Paytm payment initiated. Form data prepared for redirect.',
        gatewayUrl: process.env.PAYTM_ENV === 'production'
          ? 'https://securegw.paytm.in/theia/processTransaction'
          : 'https://securegw-stage.paytm.in/theia/processTransaction',
        environment: process.env.PAYTM_ENV || 'staging',
      };
    } else if (paymentMethod === 'bank_account') {
      paymentResponse = {
        bankDetails: {
          bankName: paymentConfig.details.bankName,
          accountNumber: paymentConfig.details.accountNumber,
          ifscCode: paymentConfig.details.ifscCode,
          accountHolderName: paymentConfig.details.accountHolderName,
        },
        amountInINR: fine,
        receiptNumber,
        message: 'Please transfer the amount to the provided bank account and upload proof of payment.',
      };
    } else if (paymentMethod === 'upi') {
      paymentResponse = {
        upiId: paymentConfig.details.upiId,
        amountInINR: fine,
        receiptNumber,
        message: 'Please send the amount to the provided UPI ID and upload proof of payment.',
      };
    } else {
      return res.status(400).json({ message: `Unsupported payment type: ${paymentMethod}` });
    }

    const payment = new PaymentModel({
      school: schoolId,
      student: studentId,
      amount: fine,
      paymentMethod,
      status: 'pending',
      orderId: paymentResponse.orderId || paymentResponse.clientSecret || receiptNumber,
      receiptNumber,
      feesPaid: [{ type: 'library_fine', amount: fine, issueId }],
    });

    await payment.save();
    const student = await UserModel.findById(studentId);
    await sendEmail({
      to: student.email,
      subject: 'Library Fine Payment Initiated',
      text: `Dear ${student.name},\n\nYour payment of INR ${fine} for the library fine has been initiated. Please complete the payment using the provided details.\n\nRegards,\nLibrary Team`,
    });

    logger.info(`Library fine payment initiated for student ${studentId}`, { issueId, fine });
    res.json({ message: 'Fine payment initiated', payment, ...paymentResponse });
  } catch (error) {
    logger.error(`Error paying library fine: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

getMyPendingRequests: async (req, res) => {
  try {
    const studentId = req.user._id.toString();
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
    const UserModel = User(connection);

    const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const pendingRequests = await BookIssueModel.find({
      user: studentId,
      school: schoolId,
      status: { $in: ['requested', 'reserved'] },
    })
      .populate('book', 'bookTitle author isbn category coverImage')
      .sort({ issueDate: -1 });

    logger.info(`Fetched pending requests for student ${studentId}`, { schoolId });
    res.json({
      message: 'Pending requests retrieved successfully',
      requests: pendingRequests,
    });
  } catch (error) {
    logger.error(`Error fetching pending requests: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},


cancelBookRequest: async (req, res) => {
  try {
    const { requestId } = req.params;
    const studentId = req.user._id.toString();
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
    const UserModel = User(connection);

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const request = await BookIssueModel.findOne({
      _id: requestId,
      user: studentId,
      school: schoolId,
      status: { $in: ['requested', 'reserved'] },
    });
    if (!request) {
      return res.status(404).json({ message: 'Request not found or not cancellable' });
    }

    const book = await LibraryModel.findById(request.book);
    if (request.status === 'reserved') {
      book.reservedBy = book.reservedBy.filter(id => id.toString() !== studentId);
      await book.save();
    }

    await BookIssueModel.deleteOne({ _id: requestId });

    const auditLog = new AuditLogModel({
      school: schoolId,
      action: 'book_request_cancel',
      user: studentId,
      book: request.book,
      details: {
        bookTitle: book.bookTitle,
        studentName: (await UserModel.findById(studentId)).name,
        status: request.status,
      },
    });
    await auditLog.save();

    logger.info(`Book request cancelled: ${book.bookTitle} by student ${studentId}`, { schoolId, requestId });
    res.json({ message: 'Book request cancelled successfully' });
  } catch (error) {
    logger.error(`Error cancelling book request: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},
  
  getTransportationDetails: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Transportation = require("../models/Transportation")(connection);
      const User = require("../models/User")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      const transport = await Transportation.findOne({
        school: schoolId,
        students: studentId,
      }).populate("route driver vehicle");

      if (!transport) {
        return res
          .status(404)
          .json({ message: "Transportation details not found" });
      }

      const student = await User.findOne({ _id: studentId, school: schoolId });
      const routeStop = transport.route.stops.find(
        (stop) => stop.area === student.studentDetails.address?.area
      );

      logger.info(`Transportation details fetched for student ${studentId}`);
      res.json({
        ...transport.toObject(),
        studentPickup: routeStop ? routeStop.pickupTime : null,
        studentDrop: routeStop ? routeStop.dropTime : null,
      });
    } catch (error) {
      logger.error(`Error fetching transportation details: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  getMonthlyProgress: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const User = require("../models/User")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }

      const progress = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      })
        .populate("subjects.teacher", "name", User)
        .populate("generatedBy", "name", User);

      if (!progress) {
        return res.status(404).json({
          message: "Progress report not found for the specified month",
        });
      }

      logger.info(
        `Monthly progress fetched for student ${studentId} for ${month}/${year}`
      );
      res.json(progress);
    } catch (error) {
      logger.error(`Error fetching monthly progress: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  getEventNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Event = require("../models/Event")(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const events = await Event.find({
        school: schoolId,
        $or: [
          { targetClass: student.studentDetails.class },
          { targetType: "all" },
        ],
        date: { $gte: new Date() },
      }).sort({ date: 1 });

      logger.info(`Event notifications fetched for student ${studentId}`);
      res.json(events);
    } catch (error) {
      logger.error(`Error fetching event notifications: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  calculateGrade: (percentage) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C+";
    if (percentage >= 40) return "C";
    return "F";
  },

  calculateOverallPerformance: (subjects) => {
    return { average: 85, grade: "A" }; // Placeholder; implement actual logic
  },
};

module.exports = studentController;

// const mongoose = require('mongoose');

// const studentController = {
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(a => a.status === 'present').length;
//       const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

//       res.json({
//         attendance,
//         statistics: {
//           totalDays,
//           presentDays,
//           absentDays: totalDays - presentDays,
//           percentage,
//         },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       })
//         .populate('uploadedBy', 'name', User)
//         .sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files, comments } = req.body;
//       const studentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);
//       const User = require('../models/User')(connection);

//       const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       const student = await User.findById(studentId);
//       if (student.studentDetails.class.toString() !== homework.class.toString()) {
//         return res.status(403).json({ message: 'This homework is not assigned to your class' });
//       }

//       const existingSubmission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       if (existingSubmission) {
//         existingSubmission.files = files;
//         existingSubmission.comments = comments;
//         existingSubmission.submissionDate = new Date();
//         existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
//       } else {
//         const submission = {
//           student: studentId,
//           submissionDate: new Date(),
//           files,
//           comments,
//           status: new Date() > homework.dueDate ? 'late' : 'submitted',
//         };
//         homework.submissions.push(submission);
//       }

//       await homework.save();

//       const submission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       res.json(submission);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       })
//         .populate('subject', 'name', Subject)
//         .sort({ date: 1 });

//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 s => s.student.toString() === studentId
//               );
//               if (studentSeat) {
//                 seatInfo = {
//                   room: room.classroom,
//                   row: row.row,
//                   position: studentSeat.position,
//                 };
//                 break;
//               }
//             }
//             if (seatInfo) break;
//           }
//         }

//         return {
//           ...exam.toObject(),
//           seatingInfo: seatInfo,
//         };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name', Subject);

//         if (!exam) {
//           return res.status(404).json({ message: 'Exam not found' });
//         }

//         const studentResult = exam.results.find(
//           r => r.student.toString() === studentId
//         );

//         if (!studentResult) {
//           return res.status(404).json({ message: 'Results not found for this student' });
//         }

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

//         res.json({
//           exam: exam.name,
//           subject: exam.subject.name,
//           marks: studentResult.marks,
//           totalMarks: exam.totalMarks,
//           percentage: percentage.toFixed(2),
//           grade,
//           remarks: studentResult.remarks,
//         });
//       } else {
//         const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//         if (!student || !student.studentDetails.class) {
//           return res.status(404).json({ message: 'Student class not found' });
//         }

//         const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name', Subject)
//           .sort({ date: -1 });

//         const results = allExams.map(exam => {
//           const result = exam.results.find(r => r.student.toString() === studentId);
//           if (!result) return null;

//           const percentage = (result.marks / exam.totalMarks) * 100;
//           const grade = calculateGrade(percentage);

//           return {
//             examId: exam._id,
//             exam: exam.name,
//             subject: exam.subject.name,
//             date: exam.date,
//             marks: result.marks,
//             totalMarks: exam.totalMarks,
//             percentage: percentage.toFixed(2),
//             grade,
//             remarks: result.remarks,
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('class', 'name division', Class)
//         .populate('generatedBy', 'name', User);

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({
//         ...reportCard.toObject(),
//         overallPerformance,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { amount, feeType, paymentMethod, feeId } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Fee = require('../models/Fee')(connection);
//       const Payment = require('../models/Payment')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       if (student.studentDetails.isRTE) { // Adjusted to studentDetails.isRTE
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       if (feeId) {
//         const fee = await Fee.findOne({ _id: feeId, school: schoolId });
//         if (!fee) {
//           return res.status(404).json({ message: 'Fee record not found' });
//         }
//         if (fee.amount !== amount) {
//           return res.status(400).json({ message: 'Payment amount does not match fee amount' });
//         }
//       }

//       const payment = new Payment({
//         school: schoolId, // Add school field
//         student: studentId,
//         amount,
//         feeType,
//         paymentMethod,
//         feeId,
//         status: 'pending',
//         transactionDate: new Date(),
//       });

//       await payment.save();

//       // Simulate payment success (replace with actual gateway integration)
//       setTimeout(async () => {
//         payment.status = 'completed';
//         payment.transactionId = 'TXN' + Date.now();
//         await payment.save();

//         if (feeId) {
//           await Fee.findByIdAndUpdate(feeId, { status: 'paid' });
//         }
//       }, 3000);

//       res.json({
//         payment,
//         message: 'Payment initiated successfully. You will be redirected to payment gateway.',
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Payment = require('../models/Payment')(connection);
//       const Fee = require('../models/Fee')(connection);

//       const receipts = await Payment.find({
//         student: studentId,
//         school: schoolId,
//         status: 'completed',
//       })
//         .populate('feeId', 'type dueDate', Fee) // Adjusted field name from title to type
//         .sort({ transactionDate: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // requestCertificate: async (req, res) => {
//   //   try {
//   //     const { studentId } = req.params;
//   //     const { type, purpose, urgency } = req.body;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Certificate = require('../models/Certificate')(connection);

//   //     const certificate = new Certificate({
//   //       school: schoolId, // Add school field
//   //       student: studentId,
//   //       type,
//   //       purpose,
//   //       urgency: urgency || 'normal',
//   //       status: 'pending',
//   //       requestDate: new Date(),
//   //     });

//   //     await certificate.save();

//   //     // Notify admin (implement notifyCertificateRequest if needed)
//   //     // await notifyCertificateRequest(certificate);

//   //     res.status(201).json({
//   //       certificate,
//   //       message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//   //     });
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       // Validate certificate type
//       const validTypes = ['bonafide', 'leaving', 'transfer'];
//       if (!validTypes.includes(type)) {
//         return res.status(400).json({ message: 'Invalid certificate type' });
//       }

//       // Check if student has pending fees for leaving/transfer certificates
//       if (['leaving', 'transfer'].includes(type)) {
//         const Fee = require('../models/Fee')(connection);
//         const hasPendingFees = await Fee.findOne({
//           student: studentId,
//           status: 'pending',
//           school: schoolId
//         });
//         if (hasPendingFees) {
//           return res.status(400).json({ message: 'Clear all pending fees first' });
//         }
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;

//       // Debug logging
//       console.log('req.user:', req.user);
//       console.log('req.school:', req.school);

//       // Check if req.school is undefined
//       if (!req.school || !req.school._id) {
//         return res.status(500).json({ error: 'School context is missing. Please ensure the user is associated with a school.' });
//       }

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
//       }

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true, // Only show certificates that have been sent to the student
//       })
//         .populate('generatedBy', 'name email')
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
//           id: cert._id,
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl || null,
//           signedDocumentUrl: cert.signedDocumentUrl || null,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//         })),
//       });
//     } catch (error) {
//       console.error('Error in getStudentCertificates:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

// // getStudentCertificates: async (req, res) => {
// //   try {
// //     const { studentId } = req.params;

// //     console.log('req.user:', req.user);
// //     console.log('req.school:', req.school);

// //     if (!req.user || !req.user._id) {
// //       return res.status(401).json({ error: 'User not authenticated' });
// //     }

// //     // Fetch school based on user if not already set
// //     let schoolId;
// //     if (!req.school || !req.school._id) {
// //       const user = await User.findById(req.user._id);
// //       if (!user || !user.school) {
// //         return res.status(500).json({ error: 'User is not associated with a school' });
// //       }
// //       schoolId = user.school.toString();
// //     } else {
// //       schoolId = req.school._id.toString();
// //     }

// //     const connection = req.connection;
// //     const Certificate = require('../models/Certificate')(connection);

// //     if (!mongoose.Types.ObjectId.isValid(studentId)) {
// //       return res.status(400).json({ message: 'Invalid student ID' });
// //     }

// //     if (studentId !== req.user._id.toString()) {
// //       return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
// //     }

// //     const certificates = await Certificate.find({
// //       school: schoolId,
// //       student: studentId,
// //       isSentToStudent: true,
// //     })
// //       .populate('generatedBy', 'name email')
// //       .sort({ requestDate: -1 });

// //     res.json({
// //       status: 'success',
// //       count: certificates.length,
// //       certificates: certificates.map(cert => ({
// //         id: cert._id,
// //         type: cert.type,
// //         purpose: cert.purpose,
// //         urgency: cert.urgency,
// //         requestDate: cert.requestDate,
// //         status: cert.status,
// //         documentUrl: cert.documentUrl || null,
// //         signedDocumentUrl: cert.signedDocumentUrl || null,
// //         issuedDate: cert.issuedDate || null,
// //         generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
// //         comments: cert.comments || null,
// //       })),
// //     });
// //   } catch (error) {
// //     console.error('Error in getStudentCertificates:', error);
// //     res.status(500).json({ error: error.message });
// //   }
// // },

//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       }).populate('book', '', Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: 'available',
//       }).select('bookTitle author category');

//       const booksWithFine = issuedBooks.map(issue => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;

//         if (dueDate < today) {
//           const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 5; // ₹5 per day
//         }

//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? daysOverdue : 0,
//         };
//       });

//       res.json({
//         issuedBooks: booksWithFine,
//         availableBooks,
//         totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require('../models/Transportation')(connection);
//       const User = require('../models/User')(connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate('route driver vehicle'); // Adjust population fields as per schema

//       if (!transport) {
//         return res.status(404).json({ message: 'Transportation details not found' });
//       }

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(
//         stop => stop.area === student.studentDetails.address?.area // Adjust based on schema
//       );

//       res.json({
//         ...transport.toObject(),
//         studentPickup: routeStop ? routeStop.pickupTime : null,
//         studentDrop: routeStop ? routeStop.dropTime : null,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('generatedBy', 'name', User);

//       if (!progress) {
//         return res.status(404).json({ message: 'Progress report not found for the specified month' });
//       }

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Event = require('../models/Event')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const events = await Event.find({
//         school: schoolId,
//         $or: [
//           { targetClass: student.studentDetails.class },
//           { targetType: 'all' },
//         ],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// // Placeholder helper functions
// const calculateGrade = (percentage) => {
//   if (percentage >= 90) return 'A+';
//   if (percentage >= 80) return 'A';
//   if (percentage >= 70) return 'B+';
//   if (percentage >= 60) return 'B';
//   if (percentage >= 50) return 'C+';
//   if (percentage >= 40) return 'C';
//   return 'F';
// };

// const calculateOverallPerformance = (subjects) => {
//   // Placeholder; implement as needed
//   return { average: 85, grade: 'A' };
// };

// module.exports = studentController;

// const mongoose = require('mongoose');
// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');

// // Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const studentController = {
//   // Get attendance for a student
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(a => a.status === 'present').length;
//       const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

//       res.json({
//         attendance,
//         statistics: {
//           totalDays,
//           presentDays,
//           absentDays: totalDays - presentDays,
//           percentage,
//         },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get study materials for a student
//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       })
//         .populate('uploadedBy', 'name', User)
//         .sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Submit homework
//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files, comments } = req.body;
//       const studentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);
//       const User = require('../models/User')(connection);

//       const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       const student = await User.findById(studentId);
//       if (student.studentDetails.class.toString() !== homework.class.toString()) {
//         return res.status(403).json({ message: 'This homework is not assigned to your class' });
//       }

//       const existingSubmission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       if (existingSubmission) {
//         existingSubmission.files = files;
//         existingSubmission.comments = comments;
//         existingSubmission.submissionDate = new Date();
//         existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
//       } else {
//         const submission = {
//           student: studentId,
//           submissionDate: new Date(),
//           files,
//           comments,
//           status: new Date() > homework.dueDate ? 'late' : 'submitted',
//         };
//         homework.submissions.push(submission);
//       }

//       await homework.save();

//       const submission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       res.json(submission);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get exam schedule
//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       })
//         .populate('subject', 'name', Subject)
//         .sort({ date: 1 });

//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 s => s.student.toString() === studentId
//               );
//               if (studentSeat) {
//                 seatInfo = {
//                   room: room.classroom,
//                   row: row.row,
//                   position: studentSeat.position,
//                 };
//                 break;
//               }
//             }
//             if (seatInfo) break;
//           }
//         }

//         return {
//           ...exam.toObject(),
//           seatingInfo: seatInfo,
//         };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get results
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name', Subject);

//         if (!exam) {
//           return res.status(404).json({ message: 'Exam not found' });
//         }

//         const studentResult = exam.results.find(
//           r => r.student.toString() === studentId
//         );

//         if (!studentResult) {
//           return res.status(404).json({ message: 'Results not found for this student' });
//         }

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

//         res.json({
//           exam: exam.name,
//           subject: exam.subject.name,
//           marks: studentResult.marks,
//           totalMarks: exam.totalMarks,
//           percentage: percentage.toFixed(2),
//           grade,
//           remarks: studentResult.remarks,
//         });
//       } else {
//         const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//         if (!student || !student.studentDetails.class) {
//           return res.status(404).json({ message: 'Student class not found' });
//         }

//         const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name', Subject)
//           .sort({ date: -1 });

//         const results = allExams.map(exam => {
//           const result = exam.results.find(r => r.student.toString() === studentId);
//           if (!result) return null;

//           const percentage = (result.marks / exam.totalMarks) * 100;
//           const grade = calculateGrade(percentage);

//           return {
//             examId: exam._id,
//             exam: exam.name,
//             subject: exam.subject.name,
//             date: exam.date,
//             marks: result.marks,
//             totalMarks: exam.totalMarks,
//             percentage: percentage.toFixed(2),
//             grade,
//             remarks: result.remarks,
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get report card
//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('class', 'name division', Class)
//         .populate('generatedBy', 'name', User);

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({
//         ...reportCard.toObject(),
//         overallPerformance,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees (integrated with Razorpay for students)
//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { feeIds, paymentMethod } = req.body; // Expecting an array of fee IDs
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       // Validate student
//       const student = await UserModel.findById(studentId);
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       if (student.studentDetails.isRTE) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       // Fetch all fees
//       const fees = await FeeModel.find({
//         _id: { $in: feeIds },
//         school: schoolId,
//         student: studentId,
//       });

//       if (fees.length !== feeIds.length) {
//         return res.status(404).json({ message: 'One or more fee records not found' });
//       }

//       // Check if any fee is already paid
//       const alreadyPaid = fees.some(fee => fee.status === 'paid');
//       if (alreadyPaid) {
//         return res.status(400).json({ message: 'One or more fees are already paid' });
//       }

//       // Calculate total amount
//       const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);

//       // Create a payment record for the combined fees
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: studentId,
//         amount: totalAmount,
//         feeType: fees.map(fee => fee.type).join(', '), // e.g., "school, computer"
//         paymentMethod,
//         feeId: feeIds, // Store all fee IDs
//         status: 'pending',
//         paymentDate: new Date(),
//       });

//       // Handle payment based on method
//       if (paymentMethod === 'cash') {
//         // Cash payment should only be done by fee manager, not student
//         return res.status(403).json({ message: 'Students cannot pay via cash. Please use online payment or contact the fee manager.' });
//       } else {
//         // Online payment via Razorpay
//         const options = {
//           amount: totalAmount * 100, // Razorpay expects amount in paise
//           currency: 'INR',
//           receipt: `fee_${studentId}_${Date.now()}`,
//         };

//         const order = await razorpay.orders.create(options);

//         payment.orderId = order.id;
//         await payment.save();

//         res.json({
//           orderId: order.id,
//           amount: totalAmount * 100,
//           currency: 'INR',
//           key: process.env.RAZORPAY_KEY_ID,
//           payment,
//           message: 'Payment initiated. Proceed with Razorpay checkout.',
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Verify payment (for student panel)
//   verifyPayment: async (req, res) => {
//     try {
//       const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       const generatedSignature = crypto
//         .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//         .digest('hex');

//       if (generatedSignature !== razorpay_signature) {
//         return res.status(400).json({ message: 'Invalid payment signature' });
//       }

//       const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
//       if (!payment) {
//         return res.status(404).json({ message: 'Payment not found' });
//       }

//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       await payment.save();

//       // Update all associated fees
//       const fees = await FeeModel.find({ _id: { $in: payment.feeId } });
//       for (const fee of fees) {
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: razorpay_payment_id,
//           paymentDate: new Date(),
//           paymentMethod: payment.paymentMethod,
//           receiptNumber: `REC${Date.now()}`,
//         };
//         await fee.save();
//       }

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get fee receipts
//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       const receipts = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         status: 'completed',
//       })
//         .populate('feeId', 'type dueDate', FeeModel)
//         .sort({ paymentDate: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificate
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       // Validate certificate type
//       const validTypes = ['bonafide', 'leaving', 'transfer'];
//       if (!validTypes.includes(type)) {
//         return res.status(400).json({ message: 'Invalid certificate type' });
//       }

//       // Check if student has pending fees for leaving/transfer certificates
//       if (['leaving', 'transfer'].includes(type)) {
//         const FeeModel = Fee(connection);
//         const hasPendingFees = await FeeModel.findOne({
//           student: studentId,
//           status: 'pending',
//           school: schoolId
//         });
//         if (hasPendingFees) {
//           return res.status(400).json({ message: 'Clear all pending fees first' });
//         }
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student certificates
//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
//       }

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       })
//         .populate('generatedBy', 'name email')
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
//           id: cert._id,
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl || null,
//           signedDocumentUrl: cert.signedDocumentUrl || null,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get library services
//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       }).populate('book', '', Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: 'available',
//       }).select('bookTitle author category');

//       const booksWithFine = issuedBooks.map(issue => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;

//         if (dueDate < today) {
//           const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 5; // ₹5 per day
//         }

//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? daysOverdue : 0,
//         };
//       });

//       res.json({
//         issuedBooks: booksWithFine,
//         availableBooks,
//         totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get transportation details
//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require('../models/Transportation')(connection);
//       const User = require('../models/User')(connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate('route driver vehicle');

//       if (!transport) {
//         return res.status(404).json({ message: 'Transportation details not found' });
//       }

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(
//         stop => stop.area === student.studentDetails.address?.area
//       );

//       res.json({
//         ...transport.toObject(),
//         studentPickup: routeStop ? routeStop.pickupTime : null,
//         studentDrop: routeStop ? routeStop.dropTime : null,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get monthly progress
//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('generatedBy', 'name', User);

//       if (!progress) {
//         return res.status(404).json({ message: 'Progress report not found for the specified month' });
//       }

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get event notifications
//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Event = require('../models/Event')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const events = await Event.find({
//         school: schoolId,
//         $or: [
//           { targetClass: student.studentDetails.class },
//           { targetType: 'all' },
//         ],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Placeholder helper functions
//   calculateGrade: (percentage) => {
//     if (percentage >= 90) return 'A+';
//     if (percentage >= 80) return 'A';
//     if (percentage >= 70) return 'B+';
//     if (percentage >= 60) return 'B';
//     if (percentage >= 50) return 'C+';
//     if (percentage >= 40) return 'C';
//     return 'F';
//   },

//   calculateOverallPerformance: (subjects) => {
//     return { average: 85, grade: 'A' };
//   },
// };

// module.exports = studentController;

// const mongoose = require('mongoose');
// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');
// const generatedSignature = require('../utils/helpers')
// const {generateFeeSlip}= require('../utils/helpers')

// // Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const studentController = {
//   // Get attendance for a student
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(a => a.status === 'present').length;
//       const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

//       res.json({
//         attendance,
//         statistics: { totalDays, presentDays, absentDays: totalDays - presentDays, percentage },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get study materials for a student
//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.dbConnection;
//       const User = require('../models/User')(connection);
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       }).populate('uploadedBy', 'name', User).sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAssignedHomework: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Homework = require('../models/Homework')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const homework = await Homework.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//       })
//         .populate('assignedBy', 'name', User)
//         .sort({ dueDate: 1 });

//       const formattedHomework = homework.map(hw => {
//         const studentSubmission = hw.submissions.find(sub => sub.student.toString() === studentId);
//         return {
//           id: hw._id,
//           title: hw.title,
//           description: hw.description,
//           subject: hw.subject,
//           assignedBy: hw.assignedBy ? hw.assignedBy.name : 'Unknown',
//           assignedDate: hw.assignedDate,
//           dueDate: hw.dueDate,
//           attachments: hw.attachments,
//           submission: studentSubmission ? {
//             status: studentSubmission.status,
//             submissionDate: studentSubmission.submissionDate,
//             files: studentSubmission.files,
//             grade: studentSubmission.grade,
//             feedback: studentSubmission.feedback,
//           } : null,
//         };
//       });

//       res.json(formattedHomework);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Submit homework
//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files, comments } = req.body;
//       const studentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);
//       const User = require('../models/User')(connection);

//       const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
//       if (!homework) return res.status(404).json({ message: 'Homework not found' });

//       const student = await User.findById(studentId);
//       if (student.studentDetails.class.toString() !== homework.class.toString()) return res.status(403).json({ message: 'This homework is not assigned to your class' });

//       const existingSubmission = homework.submissions.find(s => s.student.toString() === studentId.toString());

//       if (existingSubmission) {
//         existingSubmission.files = files;
//         existingSubmission.comments = comments;
//         existingSubmission.submissionDate = new Date();
//         existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
//       } else {
//         const submission = { student: studentId, submissionDate: new Date(), files, comments, status: new Date() > homework.dueDate ? 'late' : 'submitted' };
//         homework.submissions.push(submission);
//       }

//       await homework.save();

//       const submission = homework.submissions.find(s => s.student.toString() === studentId.toString());
//       res.json(submission);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get exam schedule
//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       }).populate('subject', 'name', Subject).sort({ date: 1 });

//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(s => s.student.toString() === studentId);
//               if (studentSeat) {
//                 seatInfo = { room: room.classroom, row: row.row, position: studentSeat.position };
//                 break;
//               }
//             }
//             if (seatInfo) break;
//           }
//         }
//         return { ...exam.toObject(), seatingInfo: seatInfo };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get results
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name', Subject);

//         if (!exam) return res.status(404).json({ message: 'Exam not found' });

//         const studentResult = exam.results.find(r => r.student.toString() === studentId);
//         if (!studentResult) return res.status(404).json({ message: 'Results not found for this student' });

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

//         res.json({
//           exam: exam.name,
//           subject: exam.subject.name,
//           marks: studentResult.marks,
//           totalMarks: exam.totalMarks,
//           percentage: percentage.toFixed(2),
//           grade,
//           remarks: studentResult.remarks,
//         });
//       } else {
//         const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//         if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

//         const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name', Subject)
//           .sort({ date: -1 });

//         const results = allExams.map(exam => {
//           const result = exam.results.find(r => r.student.toString() === studentId);
//           if (!result) return null;
//           const percentage = (result.marks / exam.totalMarks) * 100;
//           const grade = calculateGrade(percentage);
//           return {
//             examId: exam._id,
//             exam: exam.name,
//             subject: exam.subject.name,
//             date: exam.date,
//             marks: result.marks,
//             totalMarks: exam.totalMarks,
//             percentage: percentage.toFixed(2),
//             grade,
//             remarks: result.remarks,
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get report card
//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('class', 'name division', Class)
//         .populate('generatedBy', 'name', User);

//       if (!reportCard) return res.status(404).json({ message: 'Report card not found' });

//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({ ...reportCard.toObject(), overallPerformance });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all fees for a student by selecting fee type (for student panel)
//   getStudentFeesByType: async (req, res) => {
//     try {
//       const { studentId, feeType } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       const fees = await FeeModel.find({
//         student: studentId,
//         school: schoolId,
//         type: feeType,
//       }).sort({ dueDate: 1 });

//       res.json(fees);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // getFeeTypes: async (req, res) => {
//   //   try {
//   //     const { studentId } = req.params;
//   //     const { month, year } = req.query;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const FeeModel = Fee(connection);
//   //     const UserModel = User(connection);
//   //     const PaymentModel = Payment(connection);

//   //     const student = await UserModel.findById(studentId);
//   //     if (!student) return res.status(404).json({ message: 'Student not found' });

//   //     if (student.studentDetails.isRTE)
//   //       return res.json({ message: 'RTE students are exempted from fees', isRTE: true, feeTypes: [] });

//   //     const feeDefinitions = await FeeModel.find({
//   //       school: schoolId,
//   //       month: parseInt(month),
//   //       year: parseInt(year)
//   //     });

//   //     const paidFees = await PaymentModel.find({
//   //       student: studentId,
//   //       school: schoolId,
//   //       'feesPaid.month': parseInt(month),
//   //       'feesPaid.year': parseInt(year),
//   //       status: 'completed'
//   //     });

//   //     const paidFeeTypes = new Set(paidFees.flatMap(p => p.feesPaid.map(f => f.type)));

//   //     const feeTypesWithStatus = feeDefinitions.map(fee => ({
//   //       type: fee.type,
//   //       label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + ' Fee',
//   //       amount: fee.amount,
//   //       description: fee.description,
//   //       isPaid: paidFeeTypes.has(fee.type),
//   //       paymentDetails: paidFees.find(p => p.feesPaid.some(f => f.type === fee.type))?.feesPaid.find(f => f.type === fee.type)?.paymentDetails || null
//   //     }));

//   //     res.json({
//   //       feeTypes: feeTypesWithStatus,
//   //       studentName: student.name,
//   //       grNumber: student.studentDetails.grNumber,
//   //       class: student.studentDetails.class,
//   //       month: parseInt(month),
//   //       year: parseInt(year)
//   //     });
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   getFeeTypes: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);
//       const PaymentModel = Payment(connection);

//       // Validate inputs
//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }
//       if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
//         return res.status(400).json({ message: 'Month and year must be valid numbers' });
//       }

//       // Validate student
//       const student = await UserModel.findById(studentId);
//       if (!student) return res.status(404).json({ message: 'Student not found' });

//       // Check if student is RTE
//       if (student.studentDetails.isRTE) {
//         return res.json({ message: 'RTE students are exempted from fees', isRTE: true, feeTypes: [] });
//       }

//       // Aggregate unique fee definitions (general, not student-specific)
//       const feeDefinitions = await FeeModel.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId), // Corrected ObjectId syntax
//             month: parseInt(month),
//             year: parseInt(year),
//             student: null, // Only general fee definitions
//           },
//         },
//         {
//           $group: {
//             _id: "$type",
//             type: { $first: "$type" },
//             amount: { $first: "$amount" },
//             description: { $first: "$description" },
//             dueDate: { $first: "$dueDate" },
//           },
//         },
//         { $sort: { type: 1 } },
//       ]);

//       // Get paid fees for the student
//       const paidFees = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         'feesPaid.month': parseInt(month),
//         'feesPaid.year': parseInt(year),
//         status: 'completed',
//       });

//       // Create a set of paid fee types
//       const paidFeeTypes = new Set(paidFees.flatMap(p => p.feesPaid.map(f => f.type)));

//       // Map fee types with payment status
//       const feeTypesWithStatus = feeDefinitions.map(fee => {
//         const isPaid = paidFeeTypes.has(fee.type);
//         const payment = paidFees.find(p => p.feesPaid.some(f => f.type === fee.type));
//         const paymentDetails = isPaid
//           ? payment?.feesPaid.find(f => f.type === fee.type)?.paymentDetails || null
//           : null;

//         return {
//           type: fee.type,
//           label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + ' Fee',
//           amount: fee.amount,
//           description: fee.description,
//           dueDate: fee.dueDate,
//           isPaid,
//           paymentDetails,
//         };
//       });

//       res.json({
//         feeTypes: feeTypesWithStatus,
//         studentName: student.name,
//         grNumber: student.studentDetails.grNumber,
//         class: student.studentDetails.class,
//         month: parseInt(month),
//         year: parseInt(year),
//       });
//     } catch (error) {
//       console.error('getFeeTypes Error:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // payFeesByType: async (req, res) => {
//   //   try {
//   //     const { studentId } = req.params;
//   //     const { feeTypes, month, year, paymentMethod } = req.body;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const FeeModel = Fee(connection);
//   //     const PaymentModel = Payment(connection);
//   //     const UserModel = User(connection);

//   //     const student = await UserModel.findById(studentId);
//   //     if (!student) return res.status(404).json({ message: 'Student not found' });

//   //     if (student.studentDetails.isRTE)
//   //       return res.status(400).json({ message: 'RTE students are exempted from fees' });

//   //     if (paymentMethod === 'cash')
//   //       return res.status(403).json({ message: 'Students cannot pay via cash. Contact the fee manager.' });

//   //     const feeDefinitions = await FeeModel.find({
//   //       school: schoolId,
//   //       month: parseInt(month),
//   //       year: parseInt(year),
//   //       type: { $in: feeTypes }
//   //     });

//   //     if (feeDefinitions.length !== feeTypes.length)
//   //       return res.status(404).json({ message: 'Some fee types not defined for this month' });

//   //     const existingPayments = await PaymentModel.find({
//   //       student: studentId,
//   //       school: schoolId,
//   //       'feesPaid.month': parseInt(month),
//   //       'feesPaid.year': parseInt(year),
//   //       'feesPaid.type': { $in: feeTypes },
//   //       status: 'completed'
//   //     });

//   //     const paidTypes = new Set(existingPayments.flatMap(p => p.feesPaid.map(f => f.type)));
//   //     const feesToPay = feeDefinitions.filter(fee => !paidTypes.has(fee.type));

//   //     if (feesToPay.length === 0)
//   //       return res.status(400).json({ message: 'All selected fees are already paid' });

//   //     const totalAmount = feesToPay.reduce((sum, fee) => sum + fee.amount, 0);
//   //     const options = { amount: totalAmount * 100, currency: 'INR', receipt: `fee_${studentId}_${month}_${year}` };
//   //     const order = await razorpay.orders.create(options);

//   //     const payment = new PaymentModel({
//   //       school: schoolId,
//   //       student: studentId,
//   //       grNumber: student.studentDetails.grNumber,
//   //       amount: totalAmount,
//   //       paymentMethod,
//   //       status: 'pending',
//   //       orderId: order.id,
//   //       feesPaid: feesToPay.map(fee => ({
//   //         feeId: fee._id,
//   //         type: fee.type,
//   //         month: parseInt(month),
//   //         year: parseInt(year),
//   //         amount: fee.amount
//   //       }))
//   //     });

//   //     await payment.save();

//   //     res.json({
//   //       orderId: order.id,
//   //       amount: totalAmount * 100,
//   //       currency: 'INR',
//   //       key: process.env.RAZORPAY_KEY_ID,
//   //       payment,
//   //       message: 'Payment initiated. Proceed with Razorpay checkout.'
//   //     });
//   //   } catch (error) {
//   //     console.error('Payment Error:', error); // Add logging for debugging
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   payFeesByType: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { feeTypes, month, year, paymentMethod } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       // Validate inputs
//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }
//       if (!Array.isArray(feeTypes) || feeTypes.length === 0) {
//         return res.status(400).json({ message: 'At least one fee type must be selected' });
//       }
//       if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
//         return res.status(400).json({ message: 'Month and year must be valid numbers' });
//       }
//       if (!paymentMethod) {
//         return res.status(400).json({ message: 'Payment method is required' });
//       }

//       // Validate student
//       const student = await UserModel.findById(studentId);
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       // Check if student is RTE
//       if (student.studentDetails.isRTE) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       // Validate payment method
//       if (paymentMethod === 'cash') {
//         return res.status(403).json({ message: 'Students cannot pay via cash. Contact the fee manager.' });
//       }

//       // Aggregate unique general fee definitions
//       const feeDefinitions = await FeeModel.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId),
//             month: parseInt(month),
//             year: parseInt(year),
//             student: null,
//             type: { $in: feeTypes },
//           },
//         },
//         {
//           $group: {
//             _id: '$type',
//             type: { $first: '$type' },
//             amount: { $first: '$amount' },
//             description: { $first: '$description' },
//             dueDate: { $first: '$dueDate' },
//           },
//         },
//       ]);

//       // Validate requested fee types
//       const requestedFeeTypes = new Set(feeTypes);
//       const availableFeeTypes = new Set(feeDefinitions.map(fee => fee.type));
//       const invalidFeeTypes = [...requestedFeeTypes].filter(type => !availableFeeTypes.has(type));
//       if (invalidFeeTypes.length > 0) {
//         return res.status(404).json({ message: `Invalid or undefined fee types: ${invalidFeeTypes.join(', ')}` });
//       }

//       // Check for existing payments
//       const existingPayments = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         'feesPaid.month': parseInt(month),
//         'feesPaid.year': parseInt(month),
//         'feesPaid.type': { $in: feeTypes },
//         status: 'completed',
//       });

//       const paidTypes = new Set(existingPayments.flatMap(p => p.feesPaid.map(f => f.type)));
//       const feesToPay = feeDefinitions.filter(fee => !paidTypes.has(fee.type));

//       if (feesToPay.length === 0) {
//         return res.status(400).json({ message: 'All selected fees are already paid' });
//       }

//       // Calculate total amount
//       const totalAmountInINR = feesToPay.reduce((sum, fee) => sum + fee.amount, 0);
//       const totalAmountInPaise = totalAmountInINR * 100; // Razorpay expects amount in paise
//       const options = {
//         amount: totalAmountInPaise,
//         currency: 'INR',
//         receipt: `fee_${studentId}_${month}_${year}`,
//       };
//       const order = await razorpay.orders.create(options);

//       // Create or update student-specific fee documents
//       const studentFees = await Promise.all(
//         feesToPay.map(async fee => {
//           let studentFee = await FeeModel.findOne({
//             school: new mongoose.Types.ObjectId(schoolId),
//             student: studentId,
//             type: fee.type,
//             month: parseInt(month),
//             year: parseInt(year),
//           });

//           if (!studentFee) {
//             studentFee = new FeeModel({
//               school: new mongoose.Types.ObjectId(schoolId),
//               student: studentId,
//               grNumber: student.studentDetails.grNumber,
//               type: fee.type,
//               amount: fee.amount,
//               dueDate: fee.dueDate,
//               month: parseInt(month),
//               year: parseInt(year),
//               description: fee.description,
//               status: 'pending',
//               isRTE: student.studentDetails.isRTE || false,
//             });
//             await studentFee.save();
//           }

//           return studentFee;
//         })
//       );

//       // Create payment record
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: studentId,
//         grNumber: student.studentDetails.grNumber,
//         amount: totalAmountInINR,
//         paymentMethod,
//         status: 'pending',
//         orderId: order.id,
//         feesPaid: studentFees.map(fee => ({
//           feeId: fee._id,
//           type: fee.type,
//           month: parseInt(month),
//           year: parseInt(year),
//           amount: fee.amount,
//         })),
//       });

//       await payment.save();

//       res.json({
//         orderId: order.id,
//         amountInPaise: totalAmountInPaise,
//         amountInINR: totalAmountInINR,
//         currency: 'INR',
//         key: process.env.RAZORPAY_KEY_ID,
//         payment,
//         message: 'Payment initiated. Proceed with Razorpay checkout.',
//       });
//     } catch (error) {
//       console.error('payFeesByType Error:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   verifyPayment: async (req, res) => {
//     try {
//       const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);

//       // Signature validation (uncommented for security)
//       // const generatedSignature = crypto
//       //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//       //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       //   .digest('hex');
//       // if (generatedSignature !== razorpay_signature)
//       //   return res.status(400).json({ message: 'Invalid payment signature' });

//       const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
//       if (!payment) return res.status(404).json({ message: 'Payment not found' });

//       const student = await UserModel.findById(payment.student);
//       if (!student) return res.status(404).json({ message: 'Student not found' });

//       // Update payment status
//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       payment.receiptNumber = `REC${Date.now()}`;
//       await payment.save();

//       // Update fee documents
//       for (const feePaid of payment.feesPaid) {
//         let fee = await FeeModel.findOne({
//           school: schoolId,
//           student: payment.student,
//           type: feePaid.type,
//           month: feePaid.month,
//           year: feePaid.year,
//         });

//         if (!fee) {
//           const feeDefinition = await FeeModel.findOne({
//             school: schoolId,
//             student: { $exists: false },
//             type: feePaid.type,
//             month: feePaid.month,
//             year: feePaid.year,
//           });

//           fee = new FeeModel({
//             school: schoolId,
//             student: payment.student,
//             grNumber: payment.grNumber,
//             type: feePaid.type,
//             amount: feePaid.amount,
//             dueDate: feeDefinition?.dueDate || new Date(feePaid.year, feePaid.month - 1, 28),
//             month: feePaid.month,
//             year: feePaid.year,
//             status: 'paid',
//             description: feeDefinition?.description || '',
//           });
//         } else {
//           fee.status = 'paid';
//         }

//         fee.paymentDetails = {
//           transactionId: razorpay_payment_id,
//           paymentDate: payment.paymentDate,
//           paymentMethod: payment.paymentMethod,
//           receiptNumber: payment.receiptNumber,
//         };
//         await fee.save();
//       }

//       // Generate fee slip
//       const feeSlip = generateFeeSlip(student, payment, payment.feesPaid, schoolId);
//       payment.receiptUrl = feeSlip.pdfUrl;
//       await payment.save();

//       res.json({
//         message: 'Payment verified successfully',
//         payment,
//         feeSlip, // Return the fee slip
//         receiptUrl: feeSlip.pdfUrl
//       });
//     } catch (error) {
//       console.error('Verification Error:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       const payments = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         status: 'completed',
//       }).sort({ paymentDate: -1 });

//       // const receipts = await Promise.all(payments.map(async payment => {
//       //   const fees = await FeeModel.find({ _id: { $in: payment.feeId || [] } });
//       //   return {
//       //     ...payment.toObject(),
//       //     fees: fees.map(fee => ({
//       //       type: fee.type,
//       //       amount: fee.amount,
//       //       month: fee.month,
//       //       year: fee.year,
//       //       dueDate: fee.dueDate
//       //     }))
//       //   };
//       // }));

//       const receipts = await Promise.all(payments.map(async payment => {
//         const fees = await FeeModel.find({
//           student: studentId,
//           school: schoolId,
//           month: { $in: payment.feesPaid.map(f => f.month) },
//           year: { $in: payment.feesPaid.map(f => f.year) },
//           type: { $in: payment.feesPaid.map(f => f.type) },
//         });
//         return {
//           paymentId: payment._id,
//           receiptNumber: payment.receiptNumber,
//           amount: payment.amount,
//           paymentDate: payment.paymentDate,
//           paymentMethod: payment.paymentMethod,
//           receiptUrl: payment.receiptUrl,
//           fees: fees.map(fee => ({
//             type: fee.type,
//             amount: fee.amount,
//             month: fee.month,
//             year: fee.year,
//             dueDate: fee.dueDate,
//           })),
//         };
//       }));

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificate
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       const validTypes = ['bonafide', 'leaving', 'transfer'];
//       if (!validTypes.includes(type)) return res.status(400).json({ message: 'Invalid certificate type' });

//       if (['leaving', 'transfer'].includes(type)) {
//         const FeeModel = Fee(connection);
//         const hasPendingFees = await FeeModel.findOne({ student: studentId, status: 'pending', school: schoolId });
//         if (hasPendingFees) return res.status(400).json({ message: 'Clear all pending fees first' });
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student certificates
//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

//       if (studentId !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       }).populate('generatedBy', 'name email').sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
//           id: cert._id,
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl || null,
//           signedDocumentUrl: cert.signedDocumentUrl || null,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   downloadCertificate: async (req, res) => {
//     try {
//       const { studentId, certificateId, documentKey } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const { streamS3Object } = require('../config/s3Upload');

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only download your own certificates' });
//       }

//       const certificate = await Certificate.findOne({
//         _id: certificateId,
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       });

//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate not found or not available for download' });
//       }

//       const key = certificate.signedDocumentKey && certificate.signedDocumentKey.endsWith(documentKey)
//         ? certificate.signedDocumentKey
//         : certificate.documentKey && certificate.documentKey.endsWith(documentKey)
//         ? certificate.documentKey
//         : null;

//       if (!key) {
//         return res.status(404).json({ message: 'Document not found' });
//       }

//       await streamS3Object(key, res);
//     } catch (error) {
//       console.error('Error streaming certificate:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get library services
//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       }).populate('book', '', Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: 'available',
//       }).select('bookTitle author category');

//       const booksWithFine = issuedBooks.map(issue => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;
//         if (dueDate < today) {
//           const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 5;
//         }
//         return { ...issue.toObject(), fine, daysOverdue: fine > 0 ? daysOverdue : 0 };
//       });

//       res.json({
//         issuedBooks: booksWithFine,
//         availableBooks,
//         totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get transportation details
//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require('../models/Transportation')(connection);
//       const User = require('../models/User')(connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate('route driver vehicle');

//       if (!transport) return res.status(404).json({ message: 'Transportation details not found' });

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(stop => stop.area === student.studentDetails.address?.area);

//       res.json({
//         ...transport.toObject(),
//         studentPickup: routeStop ? routeStop.pickupTime : null,
//         studentDrop: routeStop ? routeStop.dropTime : null,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get monthly progress
//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       }).populate('subjects.teacher', 'name', User).populate('generatedBy', 'name', User);

//       if (!progress) return res.status(404).json({ message: 'Progress report not found for the specified month' });

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get event notifications
//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Event = require('../models/Event')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

//       const events = await Event.find({
//         school: schoolId,
//         $or: [{ targetClass: student.studentDetails.class }, { targetType: 'all' }],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   calculateGrade: (percentage) => {
//     if (percentage >= 90) return 'A+';
//     if (percentage >= 80) return 'A';
//     if (percentage >= 70) return 'B+';
//     if (percentage >= 60) return 'B';
//     if (percentage >= 50) return 'C+';
//     if (percentage >= 40) return 'C';
//     return 'F';
//   },

//   calculateOverallPerformance: (subjects) => {
//     return { average: 85, grade: 'A' };
//   },
// };

// module.exports = studentController;
