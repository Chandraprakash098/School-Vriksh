// const mongoose = require('mongoose');

// const classSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true }, // e.g., "8th Grade"
//   division: { type: String, required: true }, // e.g., "A"
//   capacity: { type: Number, required: true },
//   classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   subjects: [{
//     name: String,
//     teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     syllabus: String
//   }],
//   rteSeats: {
//     total: Number,
//     occupied: Number
//   },
//   academicYear: { type: String, required: true },
//   students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
//   schedule: {
//     startTime: String,
//     endTime: String,
//     periodsPerDay: Number,
//     periodDuration: Number
//   }
// }, { timestamps: true });

// module.exports = mongoose.model('Class', classSchema);


const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true }, // e.g., "8th Grade"
  division: { type: String, required: true }, // e.g., "A"
  capacity: { type: Number, required: true },
  classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subjects: [{
    name: { type: String, required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    syllabus: { type: String }
  }],
  rteSeats: {
    total: { type: Number, default: 0 },
    occupied: { type: Number, default: 0 }
  },
  academicYear: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  schedule: {
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    periodsPerDay: { type: Number, required: true },
    periodDuration: { type: Number, required: true }
  }
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
