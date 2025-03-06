
// const express = require('express');
// const router = express.Router();
// const teacherController = require('../controllers/teacherController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const schoolCheck = require('../middleware/schoolCheck');
// const validateAttendancePermission = require('../middleware/validateAttendancePermission');

// // Schedule
// router.get(
//   '/schedule/:teacherId',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.getSchedule
// );

// // Homework
// router.post(
//   '/:schoolId/:classId/homework',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.assignHomework
// );

// // Attendance management
// router.post(
//   '/:schoolId/:classId/attendance',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.markAttendance
// );

// router.post(
//   '/:schoolId/my-attendance',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.markOwnAttendance
// );

// // Study materials
// router.post(
//   '/:schoolId/:classId/study-materials',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.uploadStudyMaterial
// );


// // Progress reports
// router.post(
//   '/:classId/progress-reports',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.generateProgressReport
// );

// // Announcements
// router.post(
//   '/:schoolId/announcements',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.createAnnouncement
// );

// // Leave request
// router.post(
//   '/:schoolId/leave-requests',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.requestLeave
// );

// router.get(
//   '/leave-status',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.getLeaveStatus
// );

// // Parent communication
// router.post(
//   '/:schoolId/communicate/:studentId',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.communicateWithParent
// );

// router.post(
//   '/:schoolId/:classId/attendance',
//   [auth, roleCheck(['teacher']), schoolCheck, validateAttendancePermission],
//   teacherController.markAttendance
// );


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


// teacherRoutes.js
const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck'); // Assuming this exists, remove if unnecessary
const validateAttendancePermission = require('../middleware/validateAttendancePermission'); // Assuming this exists

// Schedule
router.get(
  '/schedule/:teacherId',
  [auth, roleCheck(['teacher'])],
  teacherController.getSchedule
);

// Homework
router.post(
  '/:classId/homework',
  [auth, roleCheck(['teacher'])],
  teacherController.assignHomework
);

// Attendance management
router.post(
  '/:classId/attendance',
  [auth, roleCheck(['teacher']), validateAttendancePermission],
  teacherController.markAttendance
);

router.post(
  '/my-attendance',
  [auth, roleCheck(['teacher'])],
  teacherController.markOwnAttendance
);

// Study materials
router.post(
  '/:classId/study-materials',
  [auth, roleCheck(['teacher'])],
  teacherController.uploadStudyMaterial
);

// Progress reports
router.post(
  '/:classId/progress-reports',
  [auth, roleCheck(['teacher'])],
  teacherController.generateProgressReport
);

// Announcements
router.post(
  '/announcements',
  [auth, roleCheck(['teacher'])],
  teacherController.createAnnouncement
);

// Leave request
router.post(
  '/leave-requests',
  [auth, roleCheck(['teacher'])],
  teacherController.requestLeave
);

router.get(
  '/leave-status',
  [auth, roleCheck(['teacher'])],
  teacherController.getLeaveStatus
);

// Parent communication
router.post(
  '/communicate/:studentId',
  [auth, roleCheck(['teacher'])],
  teacherController.communicateWithParent
);

// Exam marks
router.post(
  '/exams/:examId/marks',
  [auth, roleCheck(['teacher'])],
  teacherController.enterSubjectMarks
);

router.post(
  '/exams/:examId/submit-marks',
  [auth, roleCheck(['teacher'])],
  teacherController.submitMarksToClassTeacher
);

router.get(
  '/exams/:examId/review-marks',
  [auth, roleCheck(['teacher'])],
  teacherController.reviewSubjectMarks
);

router.post(
  '/exams/:examId/submit-results',
  [auth, roleCheck(['teacher'])],
  teacherController.submitResultsToAdmin
);

module.exports = router;