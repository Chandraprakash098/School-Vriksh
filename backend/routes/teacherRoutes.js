const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const validateAttendancePermission = require("../middleware/validateAttendancePermission");
const multer = require("multer");
const restoreConnection = require('../middleware/restoreConnection');

const { uploadStudyMaterial, uploadSyllabus,getPublicFileUrl } = require('../config/s3Upload');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// const setMongoConnection = (req, res, next) => {
//   console.log("Setting mongoConnection from req.connection");
//   req.mongoConnection = req.connection; // Copy the Mongoose connection
//   console.log("req.connection:", req.connection.name);
//   console.log("req.mongoConnection:", req.mongoConnection.name);
//   next();
// };

const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory as a buffer
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(
            ", "
          )}`
        ),
        false
      );
    }
  },
});

const handleMulterUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({ error: err.message });
    }
    console.log("Multer completed, req.file:", req.file);
    next();
  });
};

// Error handling middleware for Multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.error('Multer error', { error: err.message, code: err.code });
    return res.status(400).json({ error: `Multer error: ${err.message}` });
  }
  if (err) {
    logger.error('File upload error', { error: err.message });
    return res.status(400).json({ error: err.message });
  }
  next();
};

// Validation middleware for study material
const studyMaterialValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('type')
    .isIn(['notes', 'assignment', 'questionPaper', 'other'])
    .withMessage('Invalid material type'),
];

// Validation middleware for syllabus
const syllabusValidation = [
  body('content').notEmpty().withMessage('Syllabus content is required'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors', { errors: errors.array() });
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const logRequest = (req, res, next) => {
  logger.info('Request details', {
    path: req.path,
    hasConnection: !!req.connection,
    connectionType: req.connection ? req.connection.constructor.name : null,
    hasDbConnection: !!req.dbConnection,
    dbConnectionName: req.dbConnection?.name,
  });
  next();
};

// Assigned Classes
router.get(
  "/assigned-classes",
  [auth, roleCheck(["teacher"])],
  teacherController.getAssignedClasses
);

// Class Students (for class teachers to mark atendace)
router.get(
  "/classes/:classId/students",
  [auth, roleCheck(["teacher"])],
  teacherController.getClassStudents
);

router.get(
  "/classes/:classId/subjects",
  [auth, roleCheck(["teacher"])],
  teacherController.getSubjectsForClass
);
// Class Students (for entering marks or viewing as subject teacher)
router.get(
  "/classes/:classId/sub",
  [auth, roleCheck(["teacher"])],
  teacherController.getClassStudentsForSubject
);

// Schedule
router.get(
  "/schedule/:teacherId",
  [auth, roleCheck(["teacher"])],
  teacherController.getSchedule
);

// Homework
router.post(
  "/:classId/homework",
  [auth, roleCheck(["teacher"]), upload.array("attachments", 5)],
  teacherController.assignHomework
);

// Attendance Management
router.post(
  "/:classId/attendance",
  [auth, roleCheck(["teacher"]), validateAttendancePermission],
  teacherController.markAttendance
);
// router.post('/my-attendance', [auth, roleCheck(['teacher'])], teacherController.markOwnAttendance);
router.post(
  "/my-attendance",
  [auth, roleCheck(["teacher"])],
  teacherController.markOwnAttendance
);

router.get(
  "/classes/:classId/attendance-history",
  [auth, roleCheck(["teacher"])],
  teacherController.getAttendanceHistory
);

//study-material

// router.post(
//   "/:classId/study-materials",
//   [auth, roleCheck(["teacher"]), upload.single("file")],
//   teacherController.uploadStudyMaterial
// );

router.post(  
  '/:classId/:subjectId/study-material',
  [
    auth,
    logRequest,
    roleCheck(['teacher']),
    uploadStudyMaterial,
    handleMulterError,
    studyMaterialValidation,
    handleValidationErrors,
  ],
  teacherController.uploadStudyMaterial
);



// Syllabus
// router.post(
//   "/:classId/syllabus",
//   [auth, roleCheck(["teacher"]), upload.array("documents", 5)],
//   teacherController.uploadSyllabus
// );

router.post(
  '/:classId/:subjectId/syllabus',
  [
    auth,
    logRequest,
    roleCheck(['teacher']),
    handleMulterError,
    uploadSyllabus,
    syllabusValidation,
  ],
  teacherController.uploadSyllabus
);

//leave-request
router.post(
  "/leave-requests",
  [auth, roleCheck(["teacher"])],
  teacherController.requestLeave
);
router.get(
  "/leave-status",
  [auth, roleCheck(["teacher"])],
  teacherController.getLeaveStatus
);

router.get(
  "/exams",
  [auth, roleCheck(["teacher"])],
  teacherController.getExamsForTeacher
);

// Exam Marks Workflow
router.post(
  "/exams/:examId/marks",
  [auth, roleCheck(["teacher"])],
  teacherController.enterSubjectMarks
);
router.post(
  "/exams/:examId/submit-to-class-teacher",
  [auth, roleCheck(["teacher"])],
  teacherController.submitMarksToClassTeacher
);
router.get(
  "/classes/:classId/exams/:examId/review",
  [auth, roleCheck(["teacher"])],
  teacherController.reviewSubjectMarks
);


// Compile marks and submit to admin (new endpoint)
router.post(
  "/classes/:classId/exams/:examType/compile-and-submit",
  [auth, roleCheck(["teacher"])],
  teacherController.compileAndSubmitResults
);

// New Progress Workflow Routes
router.post(
  "/classes/:classId/subjects/:subjectId/progress",
  [auth, roleCheck(["teacher"])],
  teacherController.enterSubjectProgress
);
router.post(
  "/classes/:classId/subjects/:subjectId/submit-progress-to-class-teacher",
  [auth, roleCheck(["teacher"])],
  teacherController.submitProgressToClassTeacher
);
router.get(
  "/classes/:classId/subjects/:subjectId/review-progress",
  [auth, roleCheck(["teacher"])],
  teacherController.reviewStudentProgress
);
router.post(
  "/classes/:classId/compile-and-submit-progress",
  [auth, roleCheck(["teacher"])],
  teacherController.compileAndSubmitProgressReports
);

router.post(
  "/daily-work",
  [auth, roleCheck(["teacher"])],
  teacherController.submitDailyWork
);



module.exports = router;
