const mongoose = require('mongoose');

const examScheduleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  examType: { type: String, required: true }, // e.g., "Midterm", "Final"
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  academicYear: { type: String, required: true },
  schedule: [{
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    venue: String,
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true }
  }],
  seatingArrangement: [{
    room: String,
    capacity: Number,
    invigilator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  }]
}, { timestamps: true });

module.exports = mongoose.model('ExamSchedule', examScheduleSchema);