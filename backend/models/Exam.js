const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    examType: {
      type: String,
      enum: ["Unit Test", "Midterm", "Final", "Practical", "Other"],
      required: true,
    },
    customExamType: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    class: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    examDate: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, required: true },
    totalMarks: { type: Number, required: true }, // e.g., 100 for each subject
    seatingArrangement: [
      {
        classroom: String,
        capacity: Number,
        arrangement: [
          {
            row: Number,
            students: [
              {
                student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                position: Number,
              },
            ],
          },
        ],
      },
    ],
    results: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        marksObtained: Number,
        remarks: String,
      },
    ],
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "submittedToClassTeacher",
        "submittedToAdmin",
        "published",
      ],
      default: "draft",
    },
    marksEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    marksEnteredAt: Date,
    submittedToClassTeacherAt: Date,
    submittedToAdminAt: Date,
    publishedAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

module.exports = (connection) => connection.model("Exam", examSchema);
