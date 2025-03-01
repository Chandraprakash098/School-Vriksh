const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  schedule: [{
    day: { 
      type: String, 
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
      required: true 
    },
    periods: [{
      subject: { type: String, required: true },
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
      roomNumber: String
    }]
  }],
  academicYear: { type: String, required: true }
}, { timestamps: true });

// module.exports = mongoose.model('Timetable', timetableSchema);
module.exports = (connection) => connection.model('Timetable', timetableSchema);