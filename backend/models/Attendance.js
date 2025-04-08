const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  status: { type: String, enum: ['present', 'absent', 'late'], required: true },
  type: { type: String, enum: ['student', 'teacher', 'staff'], required: true },
  markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });


attendanceSchema.index({ school: 1, class: 1, user: 1, date: 1 }, { unique: true }); // Prevents duplicate attendance records
module.exports = (connection) => connection.model('Attendance', attendanceSchema);
