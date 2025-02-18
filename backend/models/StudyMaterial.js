const mongoose = require('mongoose');

const studyMaterialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subject: String,
    type: { type: String, enum: ['notes', 'presentation', 'video', 'document'] },
    fileUrl: String,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true }
  }, { timestamps: true });

  module.exports = mongoose.model('StudyMaterial', studyMaterialSchema);