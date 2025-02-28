
// const mongoose = require('mongoose');

// const classSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true }, // e.g., "8th Grade"
//   division: { type: String, required: true }, // e.g., "A"
//   capacity: { type: Number, required: true },
//   classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   // subjects: [{
//   //   name: { type: String, required: true },
//   //   teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   //   syllabus: { type: String }
//   // }],
//   subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
//   rteSeats: {
//     total: { type: Number, default: 0 },
//     occupied: { type: Number, default: 0 }
//   },
//   academicYear: { type: String, required: true },
//   students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
//   // schedule: {
//   //   startTime: { type: String, required: true },
//   //   endTime: { type: String, required: true },
//   //   periodsPerDay: { type: Number, required: true },
//   //   periodDuration: { type: Number, required: true }
//   // }
//   schedule: {
//     startTime: { type: String, default: "09:00" }, // Set defaults
//     endTime: { type: String, default: "15:00" },
//     periodsPerDay: { type: Number, default: 8 },
//     periodDuration: { type: Number, default: 45 } // in minutes
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
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
  rteSeats: {
    total: { type: Number, default: 0 },
    occupied: { type: Number, default: 0 }
  },
  academicYear: { type: String, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  schedule: {
    startTime: { type: String, default: '09:00' }, // Set defaults
    endTime: { type: String, default: '15:00' },
    periodsPerDay: { type: Number, default: 8 },
    periodDuration: { type: Number, default: 45 } // in minutes
  }
}, { timestamps: true });

// Export as a factory function
module.exports = (connection) => connection.model('Class', classSchema);
