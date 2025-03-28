// const mongoose = require('mongoose');

// const studyMaterialSchema = new mongoose.Schema({
//     title: { type: String, required: true },
//     description: String,
//     class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//     subject: String,
//     type: { type: String, enum: ['notes', 'presentation', 'video', 'document'] },
//     fileUrl: String,
//     uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     isActive: { type: Boolean, default: true }
//   }, { timestamps: true });

//   // module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);
//   module.exports = (connection) => connection.model('StudyMaterial', studyMaterialSchema);


const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title: { type: String, required: true },
  description: String,
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: String,
  type: String,
  fileUrl: String, // Legacy field for backward compatibility
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
  }],
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = (connection) => connection.model('StudyMaterial', studyMaterialSchema);