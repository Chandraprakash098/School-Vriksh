const mongoose = require('mongoose');

const classResultSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectMarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SubjectMarks' }],
  status: {
    type: String,
    enum: ['pending', 'submitted', 'published'],
    default: 'pending'
  },
  submittedAt: Date,
  publishedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports= mongoose.model('ClassResult', classResultSchema);
