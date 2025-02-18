const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    content: String,
    documents: [{
      title: String,
      url: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
  }, { timestamps: true });

module.exports = mongoose.model('Syllabus', syllabusSchema);