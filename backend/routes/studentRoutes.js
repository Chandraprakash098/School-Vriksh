// const express = require('express');
// const router = express.Router();
// const studentController = require('../controllers/studentController');
// const feeController = require('../controllers/feeController');
// const auth = require('../middleware/auth');

// // Attendance routes
// router.get('/attendance/:studentId', auth, studentController.getAttendance);

// // Study materials routes
// router.get('/materials/:studentId', auth, studentController.getStudyMaterials);

// // Homework routes
// router.post('/homework/:homeworkId/submit', auth, studentController.submitHomework);

// // Exam routes
// router.get('/exams/:studentId', auth, studentController.getExamSchedule);
// router.get('/results/:studentId', auth, studentController.getResults);

// // Report cards
// router.get('/report-card/:studentId', auth, studentController.getReportCard);

// // Fee management
// router.post('/fees/:studentId/pay', auth, studentController.payFees);
// router.get('/fees/:studentId/receipts', auth, studentController.getFeeReceipts);

// // Certificate requests
// // router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
// router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
// router.get('/certificates/:studentId',auth, studentController.getStudentCertificates);
// // Library services
// router.get('/library/:studentId', auth, studentController.getLibraryServices);

// // Transportation
// router.get('/transport/:studentId', auth, studentController.getTransportationDetails);

// // Progress reports
// router.get('/progress/:studentId', auth, studentController.getMonthlyProgress);

// // Events
// router.get('/events/:studentId', auth, studentController.getEventNotifications);

// // Add the new route for getting student fees
// router.get('/:studentId/fees', auth, feeController.getStudentFees); // Map to feesController

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const studentController = require('../controllers/studentController');
// const feeController = require('../controllers/feeController');
// const auth = require('../middleware/auth');

// // Attendance routes
// router.get('/attendance/:studentId', auth, studentController.getAttendance);

// // Study materials routes
// router.get('/materials/:studentId', auth, studentController.getStudyMaterials);

// // Homework routes
// router.post('/homework/:homeworkId/submit', auth, studentController.submitHomework);

// // Exam routes
// router.get('/exams/:studentId', auth, studentController.getExamSchedule);
// router.get('/results/:studentId', auth, studentController.getResults);

// // Report cards
// router.get('/report-card/:studentId', auth, studentController.getReportCard);

// // Fee management
// router.post('/fees/:studentId/pay', auth, studentController.payFees);
// router.post('/fees/verify-payment', auth, studentController.verifyPayment); // Added for student payment verification
// router.get('/fees/:studentId/receipts', auth, studentController.getFeeReceipts);

// // Certificate requests
// router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
// router.get('/certificates/:studentId', auth, studentController.getStudentCertificates);

// // Library services
// router.get('/library/:studentId', auth, studentController.getLibraryServices);

// // Transportation
// router.get('/transport/:studentId', auth, studentController.getTransportationDetails);

// // Progress reports
// router.get('/progress/:studentId', auth, studentController.getMonthlyProgress);

// // Events
// router.get('/events/:studentId', auth, studentController.getEventNotifications);

// // Get student fees
// router.get('/:studentId/fees', auth, feeController.getStudentFees);

// module.exports = router;



// const express = require('express');
// const router = express.Router();
// const studentController = require('../controllers/studentController');
// const auth = require('../middleware/auth');

// // Fee management (Student Panel)
// router.get('/fees/:studentId/:feeType', auth, studentController.getStudentFeesByType);

// router.get('/fee-types/:studentId', auth, studentController.getFeeTypes);
// router.post('/fees/:studentId/pay-by-type', auth, studentController.payFeesByType);
// // router.post('/fees/:studentId/pay', auth, studentController.payFees);
// router.post('/fees/verify-payment', auth, studentController.verifyPayment);
// router.get('/fees/:studentId/receipts', auth, studentController.getFeeReceipts);

// // Certificate requests
// router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
// router.get('/certificates/:studentId', auth, studentController.getStudentCertificates);

// // Library services
// router.get('/library/:studentId', auth, studentController.getLibraryServices);

// // Attendance
// router.get('/attendance/:studentId', auth, studentController.getAttendance);

// // Study materials
// router.get('/study-materials/:studentId', auth, studentController.getStudyMaterials);

// // Submit homework
// router.post('/homework/:homeworkId/submit', auth, studentController.submitHomework);

// // Exam schedule
// router.get('/exam-schedule/:studentId', auth, studentController.getExamSchedule);

// // Results
// router.get('/results/:studentId', auth, studentController.getResults);

// // Report card
// router.get('/report-card/:studentId', auth, studentController.getReportCard);

// // Transportation details
// router.get('/transportation/:studentId', auth, studentController.getTransportationDetails);

// // Monthly progress
// router.get('/progress/:studentId', auth, studentController.getMonthlyProgress);

// // Event notifications
// router.get('/events/:studentId', auth, studentController.getEventNotifications);

// // Add this route
// router.get('/homework/:studentId', auth, studentController.getAssignedHomework);
// // Add this route
// router.get('/certificates/:studentId/:certificateId/:documentKey', auth, studentController.downloadCertificate);

// module.exports = router;

const mongoose = require('mongoose');
const express = require("express");
const { body,param } = require("express-validator");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middleware/auth");
const logger = require("../utils/logger");
const { validate, studentFeeValidations } = require("../middleware/validate");
const { paymentRateLimiter } = require("../middleware/rateLimit");
const multer = require("multer");
const { uploadToS3 } = require("../config/s3Upload");
const { calculateFine } = require('../utils/fineCalculator');
const Razorpay = require('razorpay');
const Stripe = require('stripe');
const { decrypt } = require('../utils/encryption');
const libraryModelFactory = require('../models/Library');
const User= require('../models/User')
const { sendEmail } = require('../utils/notifications');

// const { uploadPaymentProof } = require("../config/s3Upload");

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
    }
  },
});

// Middleware to prevent concurrent payment attempts
// const preventConcurrentPayments = async (req, res, next) => {
//   try {
//     const { studentId } = req.params;
//     const connection = req.connection;
//     const PaymentModel = require("../models/Payment")(connection);

//     const pendingPayment = await PaymentModel.findOne({
//       student: studentId,
//       school: req.school._id,
//       status: "pending",
//     });

//     if (pendingPayment) {
//       return res.status(409).json({
//         message: "Another payment is currently being processed for this student",
//       });
//     }

//     next();
//   } catch (error) {
//     logger.error(`Error checking concurrent payments: ${error.message}`, { error });
//     res.status(500).json({ error: "Internal server error" });
//   }
// };

// Student routes
router.get(
  "/:studentId/attendance",
  authMiddleware,
  studentController.getAttendance
);

router.get(
  "/:studentId/study-materials",
  authMiddleware,
  studentController.getStudyMaterials
);

router.get(
  "/:studentId/homework",
  authMiddleware,
  studentController.getAssignedHomework
);

router.post(
  "/:homeworkId/submit-homework",
  authMiddleware,
  studentController.submitHomework
);

router.get(
  "/:studentId/syllabus",
  authMiddleware,
  studentController.getSyllabus
);

router.get(
  "/:studentId/exam-schedule",
  authMiddleware,
  studentController.getExamSchedule
);

router.get(
  "/:studentId/results",
  authMiddleware,
  studentController.getResults
);

router.get(
  "/:studentId/report-card",
  authMiddleware,
  studentController.getReportCard
);

router.get(
  "/:studentId/fee-types",
  authMiddleware,
  validate(studentFeeValidations.getFeeTypes),
  studentController.getFeeTypes
);

// New route to fetch available payment methods
router.get(
  "/:studentId/payment-methods",
  authMiddleware,
  studentController.getPaymentMethods
);



router.post(
  "/:studentId/pay-fees",
  authMiddleware,
  paymentRateLimiter,
  // preventConcurrentPayments,
  validate([
    ...studentFeeValidations.payFeesByType,
    body("selectedPaymentType")
      .isIn(["bank_account", "razorpay", "upi", "stripe", "paytm"])
      .withMessage("Invalid payment type"),
  ]),
  studentController.payFeesByType
);




router.post(
  "/:studentId/upload-payment-proof/:paymentId",
  authMiddleware,
  upload.single("proof"),
  validate([
    param("paymentId").isMongoId().withMessage("Invalid payment ID"),
    param("studentId").isMongoId().withMessage("Invalid student ID"),
  ]),
  async (req, res) => {
    try {
      const { studentId, paymentId } = req.params;
      const connection = req.connection;
      const PaymentModel = require("../models/Payment")(connection);

      // Verify student authorization
      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({
          message: "Unauthorized: You can only upload proof for your own payments",
        });
      }

      const payment = await PaymentModel.findById(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (!["bank_account", "upi"].includes(payment.paymentMethod)) {
        return res.status(400).json({
          message: "Proof upload is only applicable for bank account or UPI payments",
        });
      }

      if (payment.status !== "pending") {
        return res.status(400).json({
          message: "Proof can only be uploaded for pending payments",
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Proof file is required" });
      }

      // Upload proof to S3
      const fileKey = `payment-proofs/${req.school._id}/${studentId}/${paymentId}-${Date.now()}.${req.file.mimetype.split("/")[1]}`;
      const proofUrl = await uploadToS3(
        req.file.buffer,
        fileKey,
        req.file.mimetype
      );

      // Update payment with proof
      payment.proofOfPayment = {
        url: proofUrl,
        uploadedAt: new Date(),
        verified: false,
      };
      payment.status = "awaiting_verification";
      await payment.save();

      logger.info(`Proof of payment uploaded for payment ${paymentId} by student ${studentId}`);
      res.json({ message: "Proof of payment uploaded successfully", payment });
    } catch (error) {
      logger.error(`Error uploading payment proof: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/:studentId/fee-receipts",
  authMiddleware,
  validate(studentFeeValidations.getFeeReceipts),
  studentController.getFeeReceipts
);

router.get(
  "/:studentId/fee-status",
  authMiddleware,
  validate(studentFeeValidations.getStudentFeeStatus),
  studentController.getStudentFeeStatus
);

router.post(
  "/:studentId/request-certificate",
  authMiddleware,
  studentController.requestCertificate
);

router.get(
  "/:studentId/certificates",
  authMiddleware,
  studentController.getStudentCertificates
);

router.get(
  "/:studentId/certificates/:certificateId/:documentKey",
  authMiddleware,
  studentController.downloadCertificate
);

router.get(
  "/:studentId/marksheets",
  authMiddleware,
  studentController.getMarksheets
);

router.get(
  // "/:studentId/marksheets/:resultId/:documentKey",
  "/:studentId/marksheets/exam-event/:examEventId/:documentKey",
  authMiddleware,
  studentController.downloadMarksheet
);


router.get(
  "/:studentId/library",
  authMiddleware,
  studentController.getLibraryServices
);




// router.post('/:studentId/library/request-book/:bookId', authMiddleware, async (req, res) => {
//   try {
//     const { studentId, bookId } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;

//     const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//     const UserModel = User(connection);

//     if (studentId !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Unauthorized: You can only request books for yourself' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(bookId)) {
//       return res.status(400).json({ message: 'Invalid book ID' });
//     }

//     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//     if (!book) {
//       return res.status(404).json({ message: 'Book not found' });
//     }
//     if (book.availableCopies === 0) {
//       return res.status(400).json({ message: 'No copies available. You can reserve the book instead.' });
//     }

//     const existingRecord = await BookIssueModel.findOne({
//       book: bookId,
//       user: studentId,
//       school: schoolId,
//       status: { $in: ['requested', 'issued', 'overdue', 'reserved'] },
//     });
//     if (existingRecord) {
//       return res.status(400).json({
//         message: `Cannot request book: already ${existingRecord.status === 'requested' ? 'requested' : existingRecord.status === 'reserved' ? 'reserved' : 'issued or overdue'}`,
//       });
//     }

//     const activeIssues = await BookIssueModel.countDocuments({
//       user: studentId,
//       school: schoolId,
//       status: { $in: ['issued', 'overdue'] },
//     });
//     if (activeIssues >= 3) {
//       return res.status(400).json({ message: 'You have reached the maximum borrowing limit (3 books)' });
//     }

//     const request = new BookIssueModel({
//       school: schoolId,
//       book: bookId,
//       user: studentId,
//       issueDate: new Date(),
//       status: 'requested',
//     });

//     await request.save();
//     const student = await UserModel.findById(studentId);
//     // await sendEmail({
//     //   to: student.email,
//     //   subject: 'Book Request Submitted',
//     //   text: `Dear ${student.name},\n\nYour request for the book "${book.bookTitle}" has been submitted. You will be notified once it is approved.\n\nRegards,\nLibrary Team`,
//     // });

//     logger.info(`Book requested: ${book.bookTitle} by student ${studentId}`, { schoolId });
//     res.status(201).json({ message: 'Book request submitted successfully', request });
//   } catch (error) {
//     logger.error(`Error requesting book: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// });



// router.post('/:studentId/library/pay-fine/:issueId', authMiddleware, paymentRateLimiter, async (req, res) => {
//   try {
//     const { studentId, issueId } = req.params;
//     const { paymentMethod } = req.body;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;

//     const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//     const PaymentModel = require('../models/Payment')(connection);
//     const UserModel = User(connection);
//     const SchoolModel = require('../models/School')(connection);

//     if (studentId !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Unauthorized: You can only pay your own fines' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(issueId)) {
//       return res.status(400).json({ message: 'Invalid issue ID' });
//     }

//     const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId, user: studentId });
//     if (!issue) {
//       return res.status(404).json({ message: 'Book issue record not found' });
//     }

//     const fine = issue.fine || Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5;
//     if (fine <= 0) {
//       return res.status(400).json({ message: 'No fine to pay' });
//     }

//     const school = await SchoolModel.findById(schoolId)
//       .select('+paymentConfig.details.razorpayKeySecret +paymentConfig.details.paytmMerchantKey +paymentConfig.details.stripeSecretKey')
//       .lean();
//     if (!school) {
//       return res.status(404).json({ message: 'School not found' });
//     }

//     const paymentConfig = school.paymentConfig.find(
//       (config) => config.paymentType === paymentMethod && config.isActive
//     );
//     if (!paymentConfig) {
//       return res.status(400).json({
//         message: `Payment type ${paymentMethod} is not configured or active`,
//       });
//     }

//     let paymentResponse;
//     const receiptNumber = `FINE-${studentId}-${Date.now()}`;
//     const totalAmountInPaise = fine * 100;

//     if (paymentMethod === 'razorpay') {
//       const keyId = decrypt(paymentConfig.details.razorpayKeyId);
//       const keySecret = decrypt(paymentConfig.details.razorpayKeySecret);
//       const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

//       const order = await razorpay.orders.create({
//         amount: totalAmountInPaise,
//         currency: 'INR',
//         receipt: `fine_${studentId.slice(-8)}_${Date.now()}`,
//       });

//       paymentResponse = {
//         orderId: order.id,
//         amountInPaise: totalAmountInPaise,
//         amountInINR: fine,
//         currency: 'INR',
//         key: keyId,
//         message: 'Payment initiated. Proceed with Razorpay checkout.',
//       };
//     } else if (paymentMethod === 'stripe') {
//       const stripeSecretKey = decrypt(paymentConfig.details.stripeSecretKey);
//       const stripePublishableKey = decrypt(paymentConfig.details.stripePublishableKey);
//       const stripe = new Stripe(stripeSecretKey);

//       const paymentIntent = await stripe.paymentIntents.create({
//         amount: totalAmountInPaise,
//         currency: 'inr',
//         payment_method_types: ['card'],
//         metadata: { studentId, issueId, receipt: receiptNumber },
//       });

//       paymentResponse = {
//         clientSecret: paymentIntent.client_secret,
//         amountInINR: fine,
//         currency: 'INR',
//         key: stripePublishableKey,
//         message: 'Payment initiated. Proceed with Stripe checkout.',
//       };
//     } else if (paymentMethod === 'paytm') {
//       const mid = decrypt(paymentConfig.details.paytmMid);
//       const merchantKey = decrypt(paymentConfig.details.paytmMerchantKey);
//       const timestamp = Date.now();
//       const sanitizedOrderId = `FINE_${studentId.substring(0, 8)}_${timestamp}`;
//       const txnId = `TXN_${timestamp}`;

//       const requestParams = {
//         MID: mid,
//         ORDER_ID: sanitizedOrderId,
//         CHANNEL_ID: 'WEB',
//         INDUSTRY_TYPE_ID: 'Retail',
//         WEBSITE: 'DEFAULT',
//         TXN_AMOUNT: fine.toFixed(2),
//         CUST_ID: studentId,
//         CALLBACK_URL: `${process.env.SERVER_URL}/api/payment/paytm/callback`,
//         EMAIL: (await UserModel.findById(studentId).select('email')).email || 'noemail@example.com',
//         MOBILE_NO: (await UserModel.findById(studentId).select('studentDetails.parentDetails.mobile')).studentDetails?.parentDetails?.mobile || '0000000000',
//       };

//       const crypto = require('crypto');
//       const sortedKeys = Object.keys(requestParams).sort();
//       const sortedParams = {};
//       sortedKeys.forEach(key => sortedParams[key] = requestParams[key]);
//       const paramString = Object.keys(sortedParams).map(key => `${key}=${sortedParams[key]}`).join('&');
//       const checksum = crypto.createHmac('sha256', merchantKey).update(paramString).digest('hex');

//       requestParams.CHECKSUMHASH = checksum;

//       paymentResponse = {
//         formData: requestParams,
//         merchantId: mid,
//         orderId: sanitizedOrderId,
//         txnId: txnId,
//         amountInINR: fine,
//         receiptNumber: sanitizedOrderId,
//         message: 'Paytm payment initiated. Form data prepared for redirect.',
//         gatewayUrl: process.env.PAYTM_ENV === 'production'
//           ? 'https://securegw.paytm.in/theia/processTransaction'
//           : 'https://securegw-stage.paytm.in/theia/processTransaction',
//         environment: process.env.PAYTM_ENV || 'staging',
//       };
//     } else if (paymentMethod === 'bank_account') {
//       paymentResponse = {
//         bankDetails: {
//           bankName: paymentConfig.details.bankName,
//           accountNumber: paymentConfig.details.accountNumber,
//           ifscCode: paymentConfig.details.ifscCode,
//           accountHolderName: paymentConfig.details.accountHolderName,
//         },
//         amountInINR: fine,
//         receiptNumber,
//         message: 'Please transfer the amount to the provided bank account and upload proof of payment.',
//       };
//     } else if (paymentMethod === 'upi') {
//       paymentResponse = {
//         upiId: paymentConfig.details.upiId,
//         amountInINR: fine,
//         receiptNumber,
//         message: 'Please send the amount to the provided UPI ID and upload proof of payment.',
//       };
//     } else {
//       return res.status(400).json({ message: `Unsupported payment type: ${paymentMethod}` });
//     }

//     const payment = new PaymentModel({
//       school: schoolId,
//       student: studentId,
//       amount: fine,
//       paymentMethod,
//       status: 'pending',
//       orderId: paymentResponse.orderId || paymentResponse.clientSecret || receiptNumber,
//       receiptNumber,
//       feesPaid: [{ type: 'library_fine', amount: fine, issueId }],
//     });

//     await payment.save();
//     const student = await UserModel.findById(studentId);
//     await sendEmail({
//       to: student.email,
//       subject: 'Library Fine Payment Initiated',
//       text: `Dear ${student.name},\n\nYour payment of INR ${fine} for the library fine has been initiated. Please complete the payment using the provided details.\n\nRegards,\nLibrary Team`,
//     });

//     logger.info(`Library fine payment initiated for student ${studentId}`, { issueId, fine });
//     res.json({ message: 'Fine payment initiated', payment, ...paymentResponse });
//   } catch (error) {
//     logger.error(`Error paying library fine: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// });


router.post('/:studentId/library/request-book/:bookId', authMiddleware, studentController.requestBook);
router.post('/:studentId/library/pay-fine/:issueId', authMiddleware, paymentRateLimiter,studentController.payFine);

router.get('/books', authMiddleware, studentController.getBooksForStudent);

router.get('/my-requests', authMiddleware, studentController.getMyPendingRequests);


router.delete('/requests/:requestId', authMiddleware, studentController.cancelBookRequest);

router.get(
  "/:studentId/transportation",
  authMiddleware,
  studentController.getTransportationDetails
);

router.get(
  "/:studentId/monthly-progress",
  authMiddleware,
  studentController.getMonthlyProgress
);

router.get(
  "/:studentId/events",
  authMiddleware,
  studentController.getEventNotifications
);

module.exports = router;