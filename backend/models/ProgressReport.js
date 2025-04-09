const mongoose = require("mongoose");

const progressReportSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  grade: { type: String, required: true }, // e.g., A+, A, B, etc.
  feedback: { type: String, required: true },
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  }, // Subject teacher
  status: {
    type: String,
    enum: ["draft", "submittedToClassTeacher", "submittedToAdmin"],
    default: "draft",
  },
  submittedToClassTeacherAt: { type: Date },
  submittedToAdminAt: { type: Date },
  academicYear: { type: String, required: true }, // e.g., "2024-2025"
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = (connection) =>
  connection.model("ProgressReport", progressReportSchema);
