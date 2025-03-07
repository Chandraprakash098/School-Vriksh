const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const auth = require('../middleware/auth');

// Attendance routes
router.get('/attendance/:studentId', auth, studentController.getAttendance);

// Study materials routes
router.get('/materials/:studentId', auth, studentController.getStudyMaterials);

// Homework routes
router.post('/homework/:homeworkId/submit', auth, studentController.submitHomework);

// Exam routes
router.get('/exams/:studentId', auth, studentController.getExamSchedule);
router.get('/results/:studentId', auth, studentController.getResults);

// Report cards
router.get('/report-card/:studentId', auth, studentController.getReportCard);

// Fee management
router.post('/fees/:studentId/pay', auth, studentController.payFees);
router.get('/fees/:studentId/receipts', auth, studentController.getFeeReceipts);

// Certificate requests
// router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
router.post('/certificates/:studentId/request', auth, studentController.requestCertificate);
router.get('/certificates/:studentId', studentController.getStudentCertificates);
// Library services
router.get('/library/:studentId', auth, studentController.getLibraryServices);

// Transportation
router.get('/transport/:studentId', auth, studentController.getTransportationDetails);

// Progress reports
router.get('/progress/:studentId', auth, studentController.getMonthlyProgress);

// Events
router.get('/events/:studentId', auth, studentController.getEventNotifications);

module.exports = router;