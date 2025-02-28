const mongoose = require('mongoose');

const subjectMarksSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  students: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    marks: { type: Number, required: true },
    remarks: String
  }],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'approved', 'rejected'],
    default: 'draft'
  },
  submittedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewComments: String
});

// module.exports= mongoose.model('SubjectMarks', subjectMarksSchema);
module.exports = (connection) => connection.model('SubjectMarks', subjectMarksSchema);
 