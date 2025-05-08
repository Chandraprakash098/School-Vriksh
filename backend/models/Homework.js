// const mongoose = require('mongoose');

// const homeworkSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   subject: String,
//   title: { type: String, required: true },
//   description: { type: String, required: true },
//   assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   assignedDate: { type: Date, default: Date.now },
//   dueDate: { type: Date, required: true },
//   attachments: [{
//     fileName: String,
//     fileUrl: String,
//     fileType: String
//   }],
//   submissions: [{
//     student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     submissionDate: Date,
//     files: [{
//       fileName: String,
//       fileUrl: String,
//       fileType: String
//     }],
//     status: { type: String, enum: ['submitted', 'late', 'not_submitted'] },
//     grade: String,
//     feedback: String
//   }]
// }, { timestamps: true });

// // module.exports = mongoose.model('Homework', homeworkSchema);
// module.exports = (connection) => connection.model('Homework', homeworkSchema);



const mongoose = require("mongoose");

const homeworkSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
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
      required: true, // Changed from String to ObjectId
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
      },
    ],
    submissions: [
      {
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        submissionDate: Date,
        files: [
          {
            fileName: String,
            fileUrl: String,
            fileType: String,
          },
        ],
        status: {
          type: String,
          enum: ["submitted", "late", "not_submitted"],
          default: "not_submitted",
        },
        grade: String,
        feedback: String,
      },
    ],
  },
  { timestamps: true }
);

homeworkSchema.index({ school: 1, class: 1, subject: 1 }); // Index for faster queries

module.exports = (connection) => connection.model("Homework", homeworkSchema);