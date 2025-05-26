const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const adminController = require("../controllers/adminController");
const { upload } = require("../config/cloudinary");
const { announcementUpload } = require("../config/cloudinary");
const cloudinary = require("../config/cloudinary").cloudinary;
const path = require("path");
// const { uploadExcelResults } = require("../config/s3Upload");
const multer= require('multer');



const storage = multer.memoryStorage();
const uploadExcelResults = (req, res, next) => {
  const upload = multer({
    storage: multer.memoryStorage(), // Keep using memory storage to maintain buffer access
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (allowedTypes.includes(file.mimetype)) {
        console.log(`File type accepted: ${file.mimetype}`);
        cb(null, true);
      } else {
        console.error(`Invalid file type: ${file.mimetype}`);
        cb(
          new Error(
            `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
          ),
          false
        );
      }
    },
  }).single("file");

  console.log("Applying uploadExcelResults middleware");
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`Multer error: ${err.message}`);
      return res.status(400).json({ success: false, error: `Multer error: ${err.message}` });
    } else if (err) {
      console.error(`File upload error: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    console.log(`req.file after upload:`, req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: !!req.file.buffer
    } : null);
    next();
  });
};



// User Management
router.post("/users", auth, roleCheck(["admin"]), adminController.createUser);
router.get(
  "/available-classes",
  auth,
  roleCheck(["admin"]),
  adminController.getAvailableClasses
);
router.post(
  "/teachers",
  auth,
  roleCheck(["admin"]),
  adminController.createTeacher
);
router.put(
  "/users/:userId/role",
  auth,
  roleCheck(["admin"]),
  adminController.updateUserRole
);
router.get("/users", auth, roleCheck(["admin"]), adminController.getUsers);
router.get(
  "/users/:userId",
  auth,
  roleCheck(["admin"]),
  adminController.getUser
);
router.get(
  "/teachers",
  auth,
  roleCheck(["admin"]),
  adminController.getTeachers
);
router.get(
  "/students/class/:classId",
  auth,
  adminController.getStudentsByClass
);
router.put(
  "/teachers/:teacherId/assignments",
  auth,
  roleCheck(["admin"]),
  adminController.updateTeacherAssignments
);
router.get(
  "/classes/:classId/assignable-subjects",
  auth,
  roleCheck(["admin"]),
  adminController.getAssignableSubjectsByClass
);
router.get(
  "/teacher-assignments",
  auth,
  roleCheck(["admin"]),
  adminController.getAllTeacherAssignments
);

// Class Management
router.post(
  "/classes",
  auth,
  roleCheck(["admin"]),
  adminController.createClass
);
router.get("/classes", auth, roleCheck(["admin"]), adminController.getClasses);

// Timetable Management
router.post(
  "/classes/:classId/timetable",
  auth,
  roleCheck(["admin"]),
  adminController.generateTimetable
);

// Attendance Management
router.get(
  "/attendance",
  auth,
  roleCheck(["admin"]),
  adminController.getAttendanceReport
);

// Exam Management
router.post("/exams", auth, roleCheck(["admin"]), adminController.createExam);
// router.post(
//   "/exams/:examId/seating",
//   auth,
//   roleCheck(["admin"]),
//   adminController.generateSeatingArrangement
// );

// Announcement Management
router.post(
  "/announcements",
  auth,
  roleCheck(["admin"]),
  announcementUpload.array("files"),
  adminController.createAnnouncement
);
router.get(
  "/announcements",
  auth,
  roleCheck(["admin"]),
  adminController.getAnnouncements
);
router.get(
  "/announcements/:id",
  auth,
  roleCheck(["admin"]),
  adminController.getAnnouncementById
);
router.put(
  "/announcements/:id",
  auth,
  roleCheck(["admin"]),
  announcementUpload.array("files", 5),
  adminController.updateAnnouncement
);
router.delete(
  "/announcements/:id",
  auth,
  roleCheck(["admin"]),
  adminController.deleteAnnouncement
);

// Subject Management
router.post(
  "/subjects",
  auth,
  roleCheck(["admin"]),
  adminController.createSubject
);
router.get(
  "/classes/:classId/subjects",
  auth,
  roleCheck(["admin"]),
  adminController.getSubjectsByClass
);
router.post(
  "/subjects/:subjectId/syllabus",
  auth,
  roleCheck(["admin", "teacher"]),
  upload.array("documents", 5),
  adminController.uploadSyllabus
);
router.get(
  "/subjects",
  auth,
  roleCheck(["admin"]),
  adminController.getAllSubjects
);
router.get(
  "/subjects/:subjectId/syllabus",
  auth,
  roleCheck(["admin", "teacher"]),
  adminController.getSyllabus
);

// Meeting Management
router.post(
  "/meetings",
  auth,
  roleCheck(["admin", "trustee"]),
  adminController.scheduleMeeting
);
router.post(
  "/meetings/:meetingId/minutes",
  auth,
  roleCheck(["admin", "trustee"]),
  adminController.recordMeetingMinutes
);

// Leave Management
router.get(
  "/leave-requests/pending",
  [auth, roleCheck(["admin"])],
  adminController.getPendingLeaveRequests
);
router.put(
  "/leave-requests/:leaveId/review",
  [auth, roleCheck(["admin"])],
  adminController.reviewLeaveRequest
);
router.get(
  "/leave-requests/history",
  [auth, roleCheck(["admin"])],
  adminController.getLeaveRequestHistory
);
router.delete(
  "/leave-requests/:leaveId",
  [auth, roleCheck(["admin"])],
  adminController.deleteLeaveRequest
);

// Trustee Management
router.put(
  "/trustees/:trusteeId",
  auth,
  roleCheck(["admin"]),
  adminController.manageTrustee
);

// Exam Schedule and Results Management
router.post(
  "/schedule",
  [auth, roleCheck(["admin"])],
  adminController.createExamSchedule
);
router.get(
  "/schedules",
  auth,
  roleCheck(["admin"]),
  adminController.getExamSchedules
);

// Updated Exam Results Workflow
router.get(
  "/exams/:examId/classes/:classId/review",
  [auth, roleCheck(["admin"])],
  adminController.reviewClassResults
);
// router.post(
//   "/exams/:examId/classes/:classId/publish",
//   [auth, roleCheck(["admin"])],
//   adminController.publishResults
// );


// New routes for Excel results and marksheets
router.get(
  // "/exams/:examId/classes/:classId/excel-results",
  "/exam-events/:examEventId/classes/:classId/results",
  [auth, roleCheck(["admin"])],
  adminController.getSubmittedExcelResults
);

router.post(
  // "/exams/:examId/classes/:classId/upload-excel",
  "/exam-events/:examEventId/classes/:classId/results",
  [auth, roleCheck(["admin"]), uploadExcelResults],
  adminController.uploadExcelResultsOfStudent
);

router.get(
  // "/exams/:examId/classes/:classId/marksheets",
  "/exam-events/:examEventId/classes/:classId/marksheets",
  [auth, roleCheck(["admin"])],
  adminController.getAllMarksheets
);
router.post(
  // "/exams/:examId/classes/:classId/students/:studentId/publish",
  "/exam-events/:examEventId/classes/:classId/students/:studentId/publish",
  [auth, roleCheck(["admin"])],
  adminController.publishIndividualMarksheet
);

router.get(
  "/exam-events/:examEventId/classes/:classId/unpublished-marksheets",
  [auth, roleCheck(["admin"])],
  adminController.getUnpublishedMarksheets
);

router.get(
  "/exams/:examId/classes/:classId/report-cards",
  [auth, roleCheck(["admin"])],
  adminController.generateReportCards
);
router.get(
  "/exams/:examId/classes/:classId/performance-metrics",
  [auth, roleCheck(["admin"])],
  adminController.trackPerformanceMetrics
);

router.get(
  "/daily-work",
  [auth, roleCheck(["admin"])],
  adminController.getDailyWorkForAdmin
);



// Test Upload Route (for debugging)
router.post("/test-upload", async (req, res) => {
  try {
    const filePath = path.join("C:", "Users", "asus", "Downloads", "sem6.pdf");
    console.log("Attempting to upload file from:", filePath);
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "announcements",
      resource_type: "auto",
      timeout: 60000,
    });
    res.json({ success: true, result });
  } catch (error) {
    console.error("Direct Cloudinary upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
