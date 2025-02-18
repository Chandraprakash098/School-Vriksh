// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { upload } = require('../config/cloudinary');



// User Management
router.post(
  '/:schoolId/users',
  auth,
  roleCheck(['admin']),
  adminController.createUser
);

router.post(
  '/:schoolId/teachers',
  auth,
  roleCheck(['admin']),
  adminController.createTeacher
);

router.put(
  '/:schoolId/users/:userId/role',
  auth,
  roleCheck(['admin']),
  adminController.updateUserRole
);

// Class Management
router.post(
  '/:schoolId/classes',
  auth,
  roleCheck(['admin']),
  adminController.createClass
);

// Timetable Management
router.post(
  '/:schoolId/classes/:classId/timetable',
  auth,
  roleCheck(['admin']),
  adminController.generateTimetable
);

// Attendance Management
router.get(
  '/:schoolId/attendance',
  auth,
  roleCheck(['admin']),
  adminController.getAttendanceReport
);

// Exam Management
router.post(
  '/:schoolId/exams',
  auth,
  roleCheck(['admin']),
  adminController.createExam
);

// router.put(
//   '/:schoolId/exams/:examId/results',
//   auth,
//   roleCheck(['admin', 'teacher']),
//   adminController.updateExamResults
// );

// Announcement Management
router.post(
  '/:schoolId/announcements',
  auth,
  roleCheck(['admin']),
  adminController.createAnnouncement
);

// Trustee Management
router.post(
  '/:schoolId/meetings',
  auth,
  roleCheck(['admin', 'trusty']),
  adminController.scheduleMeeting
);


router.post(
  '/:schoolId/teacher-assignments',
  [auth, roleCheck(['admin'])],
  adminController.assignTeacherRole
);

router.post(
  '/:schoolId/exams/:examId/seating',
  [auth, roleCheck(['admin'])],
  adminController.generateSeatingArrangement
);

// router.get(
//   '/:schoolId/attendance/report',
//   [auth, roleCheck(['admin'])],
//   adminController.generateAttendanceReport
// );


router.post(
  '/:schoolId/subjects',
  [auth, roleCheck(['admin'])],
  adminController.createSubject
);

// router.post(
//   '/:schoolId/subjects/:subjectId/syllabus',
//   [auth, roleCheck(['admin', 'teacher'])],
//   adminController.uploadSyllabus
// );

router.post(
  '/:schoolId/subjects/:subjectId/syllabus',
  [auth, roleCheck(['admin', 'teacher'])],
  upload.array('documents', 5), // 'documents' is the field name, 5 is the maximum number of files
  adminController.uploadSyllabus
);


router.post(
  '/:schoolId/meetings',
  [auth, roleCheck(['admin', 'trustee'])],
  adminController.scheduleMeeting
);

router.post(
  '/:schoolId/meetings/:meetingId/minutes',
  [auth, roleCheck(['admin', 'trustee'])],
  adminController.recordMeetingMinutes
);

router.put(
  '/:schoolId/trustees/:trusteeId',
  [auth, roleCheck(['admin'])],
  adminController.manageTrustee
);

module.exports = router;