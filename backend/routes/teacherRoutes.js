// const express = require('express');
// const router = express.Router();
// const teacherController = require('../controllers/teacherController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const schoolCheck = require('../middleware/schoolCheck');

// router.get(
//   '/schedule/:teacherId',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.getSchedule
// );

// router.post(
//   '/:schoolId/:classId/homework',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.assignHomework
// );

// router.post(
//   '/:schoolId/:classId/attendance',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.markAttendance
// );

// router.post(
//   '/:schoolId/communicate/:studentId',
//   [auth, roleCheck(['teacher']), schoolCheck],
//   teacherController.communicateWithParent
// );

// // router.post(
// //   '/:schoolId/:classId/attendance',
// //   [auth, roleCheck(['teacher']), checkTeacherPermissions],
// //   teacherController.markAttendance
// // );

// module.exports = router;


const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck');
const validateAttendancePermission = require('../middleware/validateAttendancePermission');

// Schedule
router.get(
  '/schedule/:teacherId',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.getSchedule
);

// Homework
router.post(
  '/:schoolId/:classId/homework',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.assignHomework
);

// Attendance management
router.post(
  '/:schoolId/:classId/attendance',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.markAttendance
);

router.post(
  '/:schoolId/my-attendance',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.markOwnAttendance
);

// Study materials
router.post(
  '/:schoolId/:classId/study-materials',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.uploadStudyMaterial
);

// Exam marks
router.post(
  '/exams/:examId/marks',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.enterStudentMarks
);

// Progress reports
router.post(
  '/:classId/progress-reports',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.generateProgressReport
);

// Announcements
router.post(
  '/:schoolId/announcements',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.createAnnouncement
);

// Leave request
router.post(
  '/:schoolId/leave-requests',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.requestLeave
);

// Parent communication
router.post(
  '/:schoolId/communicate/:studentId',
  [auth, roleCheck(['teacher']), schoolCheck],
  teacherController.communicateWithParent
);

router.post(
  '/:schoolId/:classId/attendance',
  [auth, roleCheck(['teacher']), schoolCheck, validateAttendancePermission],
  teacherController.markAttendance
);

module.exports = router;