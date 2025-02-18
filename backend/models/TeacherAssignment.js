const mongoose = require('mongoose');

const teacherAssignmentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  subjects: [{
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subject: String
  }],
  assignmentType: {
    type: String,
    enum: ['classTeacher', 'subjectTeacher'],
    required: true
  },
  academicYear: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('TeacherAssign', teacherAssignmentSchema);