const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parentController');
const auth = require('../middleware/auth');

// Fee management (Parent Panel)
router.get('/fees/:studentId/:feeType', auth, parentController.getStudentFeesByType);
router.get('/fee-types/:studentId', auth, parentController.getFeeTypes);
router.post('/fees/:studentId/pay-by-type', auth, parentController.payFeesByType);
router.post('/fees/verify-payment', auth, parentController.verifyPayment);
router.get('/fees/:studentId/receipts', auth, parentController.getFeeReceipts);

// Certificate requests
router.post('/certificates/:studentId/request', auth, parentController.requestCertificate);
router.get('/certificates/:studentId', auth, parentController.getStudentCertificates);
router.get('/certificates/:studentId/:certificateId/:documentKey', auth, parentController.downloadCertificate);

// Library services
router.get('/library/:studentId', auth, parentController.getLibraryServices);

// Attendance
router.get('/attendance/:studentId', auth, parentController.getAttendance);

// Study materials
router.get('/study-materials/:studentId', auth, parentController.getStudyMaterials);

// Homework
router.get('/homework/:studentId', auth, parentController.getAssignedHomework);

// Exam schedule
router.get('/exam-schedule/:studentId', auth, parentController.getExamSchedule);

// Results
router.get('/results/:studentId', auth, parentController.getResults);

// Report card
router.get('/report-card/:studentId', auth, parentController.getReportCard);

// Transportation details
router.get('/transportation/:studentId', auth, parentController.getTransportationDetails);

// Monthly progress
router.get('/progress/:studentId', auth, parentController.getMonthlyProgress);

// Event notifications
router.get('/events/:studentId', auth, parentController.getEventNotifications);

module.exports = router;