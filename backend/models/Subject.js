// const mongoose = require('mongoose');

// const subjectSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   syllabus: {
//     document: String,
//     uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     uploadedAt: Date
//   },
//   teachers: [{
//     teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     assignedAt: Date
//   }]
// }, { timestamps: true });

// module.exports = mongoose.model('Subject', subjectSchema);


const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  syllabus: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus' }, // Changed to reference Syllabus model
  teachers: [{
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Optional: track creator as per SRS 3.2.2
}, { timestamps: true });

// Export as a factory function
module.exports = (connection) => connection.model('Subject', subjectSchema);