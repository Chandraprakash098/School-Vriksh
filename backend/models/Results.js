// const mongoose = require("mongoose");

// const resultSchema = new mongoose.Schema(
//   {
//     school: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "School",
//       required: true,
//     },
//     student: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
//     class: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Class",
//       required: true,
//     },
//     subject: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Subject",
//       required: true,
//     },
//     marksObtained: { type: Number, required: true },
//     totalMarks: { type: Number, required: true },
//     remarks: String,
//     status: {
//       type: String,
//       enum: [
//         "pending",
//         "submittedToClassTeacher",
//         "submittedToAdmin",
//         "published",
//       ],
//       default: "pending",
//     },
//     excelFile: {
//       key: String,
//       url: String,
//       originalName: String,
//     },
//     marksheet: {
//       key: String,
//       url: String,
//     },
//     marksEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     marksEnteredAt: Date,
//     submittedToClassTeacherAt: Date,
//     submittedToAdminAt: Date,
//     publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     publishedAt: Date,
//   },
//   { timestamps: true }
// );

// module.exports = (connection) => connection.model("Result", resultSchema);


const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examEvent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExamEvent",
      required: true,
    },
    exam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
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
    marksObtained: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    remarks: String,
    status: {
      type: String,
      enum: [
        "pending",
        "submittedToClassTeacher",
        "submittedToAdmin",
        "published",
      ],
      default: "pending",
    },
    excelFile: {
      key: String,
      url: String,
      originalName: String,
    },
    marksheet: {
      key: String,
      url: String,
    },
    marksEnteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    marksEnteredAt: Date,
    submittedToClassTeacherAt: Date,
    submittedToAdminAt: Date,
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: Date,
  },
  { timestamps: true }
);

module.exports = (connection) => connection.model("Result", resultSchema);