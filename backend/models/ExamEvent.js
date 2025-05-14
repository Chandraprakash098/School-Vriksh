const mongoose = require("mongoose");

const examEventSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    name: { type: String, required: true }, // e.g., "Midterm 2025"
    examType: {
      type: String,
      enum: ["Unit Test", "Midterm", "Final", "Practical", "Other"],
      required: true,
    },
    customExamType: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        required: true,
      },
    ],
    nonWorkingDays: [{ type: Date }], // Holidays or non-exam days
    status: {
      type: String,
      enum: ["draft", "scheduled", "in_progress", "completed", "published"],
      default: "draft",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    validate: {
      validator: function (v) {
        if (
          this.examType === "Other" &&
          (!this.customExamType || this.customExamType.trim() === "")
        ) {
          return false;
        }
        return true;
      },
      message: 'customExamType is required when examType is "Other"',
    },
  }
);

module.exports = (connection) => connection.model("ExamEvent", examEventSchema);