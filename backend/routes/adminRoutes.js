const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const adminController = require("../controllers/adminController");
const { upload } = require("../config/cloudinary");
const { announcementUpload } = require("../config/cloudinary");
const cloudinary = require("../config/cloudinary").cloudinary;
const path = require("path");

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
router.post(
  "/exams/:examId/seating",
  auth,
  roleCheck(["admin"]),
  adminController.generateSeatingArrangement
);

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
router.post(
  "/exams/:examId/classes/:classId/publish",
  [auth, roleCheck(["admin"])],
  adminController.publishResults
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
