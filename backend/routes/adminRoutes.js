// // routes/adminRoutes.js
// const express = require('express');
// const router = express.Router();
// const adminController = require('../controllers/adminController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const { upload } = require('../config/cloudinary');





// router.post(
//   '/users',
//   auth,
//   roleCheck(['admin']),
//   adminController.createUser
// );

// router.get(
//   '/available-classes',
//   auth,
//   roleCheck(['admin']),
//   adminController.getAvailableClasses
// );

// router.post(
//   '/teachers',
//   auth,
//   roleCheck(['admin']),
//   adminController.createTeacher
// );

// router.put(
//   '/:schoolId/users/:userId/role',
//   auth,
//   roleCheck(['admin']),
//   adminController.updateUserRole
// );

// // Class Management
// router.post(
//   '/:schoolId/classes',
//   auth,
//   roleCheck(['admin']),
//   adminController.createClass
// );

// // Timetable Management
// router.post(
//   '/:schoolId/classes/:classId/timetable',
//   auth,
//   roleCheck(['admin']),
//   adminController.generateTimetable
// );

// // Attendance Management
// router.get(
//   '/:schoolId/attendance',
//   auth,
//   roleCheck(['admin']),
//   adminController.getAttendanceReport
// );

// // Exam Management
// router.post(
//   '/:schoolId/exams',
//   auth,
//   roleCheck(['admin']),
//   adminController.createExam
// );



// // Announcement Management
// router.post(
//   '/:schoolId/announcements',
//   auth,
//   roleCheck(['admin']),
//   adminController.createAnnouncement
// );

// // Trustee Management
// router.post(
//   '/:schoolId/meetings',
//   auth,
//   roleCheck(['admin', 'trusty']),
//   adminController.scheduleMeeting
// );


// router.post(
//   '/:schoolId/teacher-assignments',
//   [auth, roleCheck(['admin'])],
//   adminController.assignTeacherRole
// );

// router.post(
//   '/:schoolId/exams/:examId/seating',
//   [auth, roleCheck(['admin'])],
//   adminController.generateSeatingArrangement
// );


// router.post( 
//   '/subjects', 
//   [auth, roleCheck(['admin'])], 
//   adminController.createSubject 
// );


// router.get(
//   '/classes/:classId/subjects',
//   auth,
//   roleCheck(['admin']),
//   adminController.getSubjectsByClass
// );



// router.post(
//   '/:schoolId/subjects/:subjectId/syllabus',
//   [auth, roleCheck(['admin', 'teacher'])],
//   upload.array('documents', 5), // 'documents' is the field name, 5 is the maximum number of files
//   adminController.uploadSyllabus
// );


// router.post(
//   '/:schoolId/meetings',
//   [auth, roleCheck(['admin', 'trustee'])],
//   adminController.scheduleMeeting
// );

// router.post(
//   '/:schoolId/meetings/:meetingId/minutes',
//   [auth, roleCheck(['admin', 'trustee'])],
//   adminController.recordMeetingMinutes
// );

// router.put(
//   '/:schoolId/trustees/:trusteeId',
//   [auth, roleCheck(['admin'])],
//   adminController.manageTrustee
// );

// module.exports = router;

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

// Class Management
router.post('/classes', auth, roleCheck(['admin']), adminController.createClass);

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

// Meeting Management
router.post('/meetings', auth, roleCheck(['admin', 'trustee']), adminController.scheduleMeeting);
router.post('/meetings/:meetingId/minutes', auth, roleCheck(['admin', 'trustee']), adminController.recordMeetingMinutes);

// Trustee Management
router.put('/trustees/:trusteeId', auth, roleCheck(['admin']), adminController.manageTrustee);


//test for exam manage

router.post(
  '/:schoolId/schedule',
  [auth, roleCheck(['admin']), schoolCheck],
  adminController.createExamSchedule
);

router.post(
  '/results/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), schoolCheck],
  adminController.enterResults
);

router.get(
  '/report-cards/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), schoolCheck],
  adminController.generateReportCards
);
module.exports = router;