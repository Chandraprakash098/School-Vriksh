// const mongoose = require('mongoose');

// const resultSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   examSchedule: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamSchedule', required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   subjects: [{
//     name: String,
//     marksObtained: Number,
//     totalMarks: Number,
//     grade: String,
//     remarks: String
//   }],
//   totalMarks: Number,
//   percentage: Number,
//   grade: String,
//   rank: Number,
//   status: { type: String, enum: ['pass', 'fail', 'pending'], required: true },
//   publishedDate: Date,
//   publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { timestamps: true });

// // module.exports = mongoose.model('Result', resultSchema);
// module.exports = (connection) => connection.model('Result', resultSchema);


const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  marksObtained: { type: Number, required: true },
  totalMarks: { type: Number, required: true },
  remarks: String,
  status: { type: String, enum: ['pending', 'published'], default: 'published' },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date
}, { timestamps: true });

module.exports = (connection) => connection.model('Result', resultSchema);