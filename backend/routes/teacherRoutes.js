
// // teacherRoutes.js
// const express = require('express');
// const router = express.Router();
// const teacherController = require('../controllers/teacherController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const schoolCheck = require('../middleware/schoolCheck'); // Assuming this exists, remove if unnecessary
// const validateAttendancePermission = require('../middleware/validateAttendancePermission'); // Assuming this exists

// // Schedule
// router.get(
//   '/schedule/:teacherId',
//   [auth, roleCheck(['teacher'])],
//   teacherController.getSchedule
// );

// // Homework
// router.post(
//   '/:classId/homework',
//   [auth, roleCheck(['teacher'])],
//   teacherController.assignHomework
// );

// // Attendance management
// router.post(
//   '/:classId/attendance',
//   [auth, roleCheck(['teacher']), validateAttendancePermission],
//   teacherController.markAttendance
// );

// router.post(
//   '/my-attendance',
//   [auth, roleCheck(['teacher'])],
//   teacherController.markOwnAttendance
// );

// // Study materials
// router.post(
//   '/:classId/study-materials',
//   [auth, roleCheck(['teacher'])],
//   teacherController.uploadStudyMaterial
// );

// // Progress reports
// router.post(
//   '/:classId/progress-reports',
//   [auth, roleCheck(['teacher'])],
//   teacherController.generateProgressReport
// );

// // Announcements
// router.post(
//   '/announcements',
//   [auth, roleCheck(['teacher'])],
//   teacherController.createAnnouncement
// );

// // Leave request
// router.post(
//   '/leave-requests',
//   [auth, roleCheck(['teacher'])],
//   teacherController.requestLeave
// );

// router.get(
//   '/leave-status',
//   [auth, roleCheck(['teacher'])],
//   teacherController.getLeaveStatus
// );

// // Parent communication
// router.post(
//   '/communicate/:studentId',
//   [auth, roleCheck(['teacher'])],
//   teacherController.communicateWithParent
// );

// // Exam marks
// router.post(
//   '/exams/:examId/marks',
//   [auth, roleCheck(['teacher'])],
//   teacherController.enterSubjectMarks
// );

// router.post(
//   '/exams/:examId/submit-marks',
//   [auth, roleCheck(['teacher'])],
//   teacherController.submitMarksToClassTeacher
// );

// router.get(
//   '/exams/:examId/review-marks',
//   [auth, roleCheck(['teacher'])],
//   teacherController.reviewSubjectMarks
// );

// router.post(
//   '/exams/:examId/submit-results',
//   [auth, roleCheck(['teacher'])],
//   teacherController.submitResultsToAdmin
// );

// module.exports = router;



const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validateAttendancePermission = require('../middleware/validateAttendancePermission');

// Schedule
router.get('/schedule/:teacherId', [auth, roleCheck(['teacher'])], teacherController.getSchedule);

// Homework
router.post('/:classId/homework', [auth, roleCheck(['teacher'])], teacherController.assignHomework);

// Attendance Management
router.post('/:classId/attendance', [auth, roleCheck(['teacher']), validateAttendancePermission], teacherController.markAttendance);
router.post('/my-attendance', [auth, roleCheck(['teacher'])], teacherController.markOwnAttendance);

// Study Materials
router.post('/:classId/study-materials', [auth, roleCheck(['teacher'])], teacherController.uploadStudyMaterial);

// Progress Reports
router.post('/:classId/progress-reports', [auth, roleCheck(['teacher'])], teacherController.generateProgressReport);

// Announcements
router.post('/announcements', [auth, roleCheck(['teacher'])], teacherController.createAnnouncement);

// Leave Request
router.post('/leave-requests', [auth, roleCheck(['teacher'])], teacherController.requestLeave);
router.get('/leave-status', [auth, roleCheck(['teacher'])], teacherController.getLeaveStatus);

// Parent Communication
router.post('/communicate/:studentId', [auth, roleCheck(['teacher'])], teacherController.communicateWithParent);

// Exam Marks Workflow
router.post('/exams/:examId/marks', [auth, roleCheck(['teacher'])], teacherController.enterSubjectMarks);
router.post('/exams/:examId/submit-to-class-teacher', [auth, roleCheck(['teacher'])], teacherController.submitMarksToClassTeacher);
router.get('/classes/:classId/exams/:examId/review', [auth, roleCheck(['teacher'])], teacherController.reviewSubjectMarks);
router.post('/classes/:classId/exams/:examId/submit-to-admin', [auth, roleCheck(['teacher'])], teacherController.submitResultsToAdmin);

module.exports = router;