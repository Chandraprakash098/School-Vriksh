
// const express = require('express');
// const router = express.Router();
// const teacherController = require('../controllers/teacherController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const validateAttendancePermission = require('../middleware/validateAttendancePermission');

// // Schedule
// router.get('/schedule/:teacherId', [auth, roleCheck(['teacher'])], teacherController.getSchedule);

// // Homework
// router.post('/:classId/homework', [auth, roleCheck(['teacher'])], teacherController.assignHomework);

// // Attendance Management
// router.post('/:classId/attendance', [auth, roleCheck(['teacher']), validateAttendancePermission], teacherController.markAttendance);
// router.post('/my-attendance', [auth, roleCheck(['teacher'])], teacherController.markOwnAttendance);

// // Study Materials
// router.post('/:classId/study-materials', [auth, roleCheck(['teacher'])], teacherController.uploadStudyMaterial);

// // Progress Reports
// router.post('/:classId/progress-reports', [auth, roleCheck(['teacher'])], teacherController.generateProgressReport);

// // Announcements
// router.post('/announcements', [auth, roleCheck(['teacher'])], teacherController.createAnnouncement);

// // Leave Request
// router.post('/leave-requests', [auth, roleCheck(['teacher'])], teacherController.requestLeave);
// router.get('/leave-status', [auth, roleCheck(['teacher'])], teacherController.getLeaveStatus);

// // Parent Communication
// router.post('/communicate/:studentId', [auth, roleCheck(['teacher'])], teacherController.communicateWithParent);

// // Exam Marks Workflow
// router.post('/exams/:examId/marks', [auth, roleCheck(['teacher'])], teacherController.enterSubjectMarks);
// router.post('/exams/:examId/submit-to-class-teacher', [auth, roleCheck(['teacher'])], teacherController.submitMarksToClassTeacher);
// router.get('/classes/:classId/exams/:examId/review', [auth, roleCheck(['teacher'])], teacherController.reviewSubjectMarks);
// router.post('/classes/:classId/exams/:examId/submit-to-admin', [auth, roleCheck(['teacher'])], teacherController.submitResultsToAdmin);

// module.exports = router;


const express = require('express');
const router = express.Router();
const teacherController = require('../controllers/teacherController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validateAttendancePermission = require('../middleware/validateAttendancePermission');
const multer = require('multer');
// const {uploadStudyMaterial} = require('../config/s3Upload')
const { uploadStudyMaterial: uploadStudyMaterialMiddleware } = require('../config/s3Upload'); // Rename to avoid conflict


const setMongoConnection = (req, res, next) => {
  console.log('Setting mongoConnection from req.connection');
  req.mongoConnection = req.connection; // Copy the Mongoose connection
  console.log('req.connection:', req.connection.name);
  console.log('req.mongoConnection:', req.mongoConnection.name);
  next();
};




const upload = multer({
    storage: multer.memoryStorage(), // Store file in memory as a buffer
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
          ),
          false
        );
      }
    },
  });


  const handleMulterUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      console.log('Multer completed, req.file:', req.file);
      next();
    });
  };

 

// Assigned Classes
router.get('/assigned-classes', [auth, roleCheck(['teacher'])], teacherController.getAssignedClasses);

// Class Students (for class teachers to mark atendace)
router.get('/classes/:classId/students', [auth, roleCheck(['teacher'])], teacherController.getClassStudents);

router.get('/classes/:classId/subjects', [auth, roleCheck(['teacher'])], teacherController.getSubjectsForClass);
// Class Students (for entering marks or viewing as subject teacher)
router.get('/classes/:classId/sub', [auth, roleCheck(['teacher'])], teacherController.getClassStudentsForSubject);

// Schedule
router.get('/schedule/:teacherId', [auth, roleCheck(['teacher'])], teacherController.getSchedule);

// Homework
router.post(
  '/:classId/homework',
  [auth, roleCheck(['teacher']), upload.array('attachments', 5)],
  teacherController.assignHomework
);

// Attendance Management
router.post(
  '/:classId/attendance',
  [auth, roleCheck(['teacher']), validateAttendancePermission],
  teacherController.markAttendance
);
router.post('/my-attendance', [auth, roleCheck(['teacher'])], teacherController.markOwnAttendance);


router.get(
    '/classes/:classId/attendance-history',
    [auth, roleCheck(['teacher'])],
    teacherController.getAttendanceHistory
  );


//study-material

router.post(
  '/:classId/study-materials',
  [auth, roleCheck(['teacher']), upload.single('file')],
  teacherController.uploadStudyMaterial
);

//leave-request
router.post('/leave-requests', [auth, roleCheck(['teacher'])], teacherController.requestLeave);
router.get('/leave-status', [auth, roleCheck(['teacher'])], teacherController.getLeaveStatus);


// Exam Marks Workflow
router.post('/exams/:examId/marks', [auth, roleCheck(['teacher'])], teacherController.enterSubjectMarks);
router.post(
  '/exams/:examId/submit-to-class-teacher',
  [auth, roleCheck(['teacher'])],
  teacherController.submitMarksToClassTeacher
);
router.get(
  '/classes/:classId/exams/:examId/review',
  [auth, roleCheck(['teacher'])],
  teacherController.reviewSubjectMarks
);
// router.post(
//   '/classes/:classId/exams/:examId/submit-to-admin',
//   [auth, roleCheck(['teacher'])],
//   teacherController.submitResultsToAdmin
// );

// Compile marks and submit to admin (new endpoint)
router.post(
  '/classes/:classId/exams/:examType/compile-and-submit',
  [auth, roleCheck(['teacher'])],
  teacherController.compileAndSubmitResults
);


// New Progress Workflow Routes
router.post(
  '/classes/:classId/subjects/:subjectId/progress',
  [auth, roleCheck(['teacher'])],
  teacherController.enterSubjectProgress
);
router.post(
  '/classes/:classId/subjects/:subjectId/submit-progress-to-class-teacher',
  [auth, roleCheck(['teacher'])],
  teacherController.submitProgressToClassTeacher
);
router.get(
  '/classes/:classId/subjects/:subjectId/review-progress',
  [auth, roleCheck(['teacher'])],
  teacherController.reviewStudentProgress
);
router.post(
  '/classes/:classId/compile-and-submit-progress',
  [auth, roleCheck(['teacher'])],
  teacherController.compileAndSubmitProgressReports
);

module.exports = router;