
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const adminController = require('../controllers/adminController');
const { upload } = require('../config/cloudinary'); // Assuming you have this middleware

// User Management
router.post('/users', auth, roleCheck(['admin']), adminController.createUser);
router.get('/available-classes', auth, roleCheck(['admin']), adminController.getAvailableClasses);
router.post('/teachers', auth, roleCheck(['admin']), adminController.createTeacher);
router.put('/users/:userId/role', auth, roleCheck(['admin']), adminController.updateUserRole);
router.get('/users', auth, roleCheck(['admin']), adminController.getUsers);
router.get('/users/:userId', auth, roleCheck(['admin']), adminController.getUser);
router.get('/teachers', auth, roleCheck(['admin']), adminController.getTeachers);

// Class Management
router.post('/classes', auth, roleCheck(['admin']), adminController.createClass);
router.get('/classes', auth, roleCheck(['admin']), adminController.getClasses);

// Timetable Management
router.post('/classes/:classId/timetable', auth, roleCheck(['admin']), adminController.generateTimetable);

// Attendance Management
router.get('/attendance', auth, roleCheck(['admin']), adminController.getAttendanceReport);

// Exam Management
router.post('/exams', auth, roleCheck(['admin']), adminController.createExam);
router.post('/exams/:examId/seating', auth, roleCheck(['admin']), adminController.generateSeatingArrangement);


// Announcement Management
router.post('/announcements', auth, roleCheck(['admin']), adminController.createAnnouncement);

// Subject Management
router.post('/subjects', auth, roleCheck(['admin']), adminController.createSubject);
router.get('/classes/:classId/subjects', auth, roleCheck(['admin']), adminController.getSubjectsByClass);
router.post('/subjects/:subjectId/syllabus', auth, roleCheck(['admin', 'teacher']), upload.array('documents', 5), adminController.uploadSyllabus);
router.get('/subjects', auth, roleCheck(['admin']), adminController.getAllSubjects);
router.get('/subjects/:subjectId/syllabus', auth, roleCheck(['admin', 'teacher']), adminController.getSyllabus);

// Meeting Management
router.post('/meetings', auth, roleCheck(['admin', 'trustee']), adminController.scheduleMeeting);
router.post('/meetings/:meetingId/minutes', auth, roleCheck(['admin', 'trustee']), adminController.recordMeetingMinutes);

// Trustee Management
router.put('/trustees/:trusteeId', auth, roleCheck(['admin']), adminController.manageTrustee);


//test for exam manage

router.post(
  '/:schoolId/schedule',
  [auth, roleCheck(['admin']), ],
  adminController.createExamSchedule
);

router.post(
  '/results/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), ],
  adminController.enterResults
);

router.get(
  '/report-cards/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), ],
  adminController.generateReportCards
);

router.get(
  '/exams/:examId/review-results',
  [auth, roleCheck(['admin'])],
  adminController.reviewClassResults
);

router.post(
  '/exams/:examId/publish',
  [auth, roleCheck(['admin'])],
  adminController.publishResults
);
module.exports = router;