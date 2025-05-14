const mongoose = require("mongoose");

const marksSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    examEvent: { type: mongoose.Schema.Types.ObjectId, ref: "ExamEvent", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    marksObtained: { type: Number, required: true, min: 0 },
    totalMarks: { type: Number, required: true },
    remarks: { type: String },
    marksEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    marksEnteredAt: { type: Date },
    status: {
      type: String,
      enum: ["draft", "submittedToClassTeacher", "compiled", "published"],
      default: "draft",
    },
    submittedToClassTeacherAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for performance
marksSchema.index({ school: 1, exam: 1, student: 1, subject: 1 }, { unique: true });

module.exports = (connection) => connection.model("Marks", marksSchema);