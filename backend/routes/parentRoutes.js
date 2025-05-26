// const express = require('express');
// const router = express.Router();
// const parentController = require('../controllers/parentController');
// const auth = require('../middleware/auth');

// // Fee management (Parent Panel)
// router.get('/fees/:studentId/:feeType', auth, parentController.getStudentFeesByType);
// router.get('/fee-types/:studentId', auth, parentController.getFeeTypes);
// router.post('/fees/:studentId/pay-by-type', auth, parentController.payFeesByType);
// router.post('/fees/verify-payment', auth, parentController.verifyPayment);
// router.get('/fees/:studentId/receipts', auth, parentController.getFeeReceipts);

// // Certificate requests
// router.post('/certificates/:studentId/request', auth, parentController.requestCertificate);
// router.get('/certificates/:studentId', auth, parentController.getStudentCertificates);
// router.get('/certificates/:studentId/:certificateId/:documentKey', auth, parentController.downloadCertificate);

// // Library services
// router.get('/library/:studentId', auth, parentController.getLibraryServices);

// // Attendance
// router.get('/attendance/:studentId', auth, parentController.getAttendance);

// // Study materials
// router.get('/study-materials/:studentId', auth, parentController.getStudyMaterials);

// // Homework
// router.get('/homework/:studentId', auth, parentController.getAssignedHomework);

// // Exam schedule
// router.get('/exam-schedule/:studentId', auth, parentController.getExamSchedule);

// // Results
// router.get('/results/:studentId', auth, parentController.getResults);

// // Report card
// router.get('/report-card/:studentId', auth, parentController.getReportCard);

// // Transportation details
// router.get('/transportation/:studentId', auth, parentController.getTransportationDetails);

// // Monthly progress
// router.get('/progress/:studentId', auth, parentController.getMonthlyProgress);

// // Event notifications
// router.get('/events/:studentId', auth, parentController.getEventNotifications);

// module.exports = router;



const express = require("express");
const router = express.Router();
const parentController = require("../controllers/parentController");
const auth = require('../middleware/auth');

// Parent-specific routes for accessing child-related data
router.get(
  "/children/:childId/fees",
  auth,
  parentController.getFeeTypes
);

router.get(
  "/children/:childId/payment-methods",
   auth,
  parentController.getPaymentMethods
);

router.post(
  "/children/:childId/fees/pay",
  auth,
  parentController.payFeesByType
);

router.get(
  "/children/:childId/fee-receipts",
  auth,
  parentController.getFeeReceipts
);

router.get(
  "/children/:childId/fee-status",
  auth,
  parentController.getChildFeeStatus
);

router.get(
  "/children/:childId/attendance",
  auth,
  parentController.getAttendance
);

// router.get(
//   "/children/:childId/study-materials",
//   auth,
//   parentController.getStudyMaterials
// );

router.get(
  "/children/:childId/homework",
  auth,
  parentController.getAssignedHomework
);

// router.get(
//   "/children/:childId/syllabus",
//   auth,
//   parentController.getSyllabus
// );

router.get(
  "/children/:childId/exam-schedule",
  auth,
  parentController.getExamSchedule
);

router.get(
  "/children/:childId/results",
  auth,
  parentController.getResults
);

router.get(
  "/children/:childId/marksheets",
  auth,
  parentController.getMarksheets
);

router.get(
  "/children/:childId/marksheet/:examEventId/:documentKey",
  auth,
  parentController.downloadMarksheet
);

router.get(
  "/children/:childId/report-card",
  auth,
  parentController.getReportCard
);

router.post(
  "/children/:childId/certificates/request",
  auth,
  parentController.requestCertificate
);

router.get(
  "/children/:childId/certificates",
  auth,
  parentController.getChildCertificates
);

router.get(
  "/children/:childId/certificates/:certificateId/:documentKey",
  auth,
  parentController.downloadCertificate
);

router.get(
  "/children/:childId/library",
  auth,
  parentController.getLibraryServices
);

router.get(
  "/children/:childId/transportation",
  auth,
  parentController.getTransportationDetails
);

router.get(
  "/children/:childId/timetable",
  auth,
  parentController.getTimeTable
);

module.exports = router;