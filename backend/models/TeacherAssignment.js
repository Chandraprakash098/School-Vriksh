const mongoose = require("mongoose");

const teacherAssignmentSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    classTeacherAssignment: {
      class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
      assignedAt: { type: Date, default: Date.now },
    },
    subjectAssignments: [
      {
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
        assignedAt: { type: Date, default: Date.now },
      },
    ],
    academicYear: { type: String, required: true },
  },
  { timestamps: true }
);

// module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
module.exports = (connection) =>
  connection.model("TeacherAssignment", teacherAssignmentSchema);
