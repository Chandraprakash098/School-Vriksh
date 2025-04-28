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


const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const studentController = require("../controllers/studentController");
const authMiddleware = require("../middleware/auth");
const logger = require("../utils/logger");
const { validate, studentFeeValidations } = require("../middleware/validate");
const { paymentRateLimiter } = require("../middleware/rateLimit");

// Middleware to prevent concurrent payment attempts
const preventConcurrentPayments = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const connection = req.connection;
    const PaymentModel = require("../models/Payment")(connection);

    const pendingPayment = await PaymentModel.findOne({
      student: studentId,
      school: req.school._id,
      status: "pending",
    });

    if (pendingPayment) {
      return res.status(409).json({
        message: "Another payment is currently being processed for this student",
      });
    }

    next();
  } catch (error) {
    logger.error(`Error checking concurrent payments: ${error.message}`, { error });
    res.status(500).json({ error: "Internal server error" });
  }
};

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

router.post(
  "/:studentId/pay-fees",
  authMiddleware,
  paymentRateLimiter,
  preventConcurrentPayments,
  validate(studentFeeValidations.payFeesByType),
  studentController.payFeesByType
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
  "/:studentId/library",
  authMiddleware,
  studentController.getLibraryServices
);

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