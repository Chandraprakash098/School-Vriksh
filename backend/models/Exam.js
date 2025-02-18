const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: String, required: true },
  date: { type: Date, required: true },
  duration: { type: Number, required: true }, // in minutes
  totalMarks: { type: Number, required: true },
  seatingArrangement: [{
    classroom: String,
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }],
  results: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marksObtained: Number,
    remarks: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);