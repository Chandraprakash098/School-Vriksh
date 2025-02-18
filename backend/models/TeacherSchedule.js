const mongoose = require('mongoose');

const teacherScheduleSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  academicYear: { type: String, required: true },
  schedule: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      required: true
    },
    periods: [{
      class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      subject: String,
      startTime: String,
      endTime: String,
      roomNumber: String
    }]
  }],
  substitutions: [{
    date: Date,
    originalTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    subject: String,
    period: Number,
    reason: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('TeacherSchedule', teacherScheduleSchema);