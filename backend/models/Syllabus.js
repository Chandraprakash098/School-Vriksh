

// const mongoose = require('mongoose');

// const syllabusSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   content: String,
//   documents: [{
//     title: String,
//     url: String,
//     public_id: String, // Add this field to store Cloudinary public_id
//     uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
//   }]
// }, { timestamps: true });

// module.exports = mongoose.model('Syllabus', syllabusSchema);

const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  content: String,
  documents: [{
    title: String,
    url: String,
    public_id: String, // Already included for Cloudinary
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
}, { timestamps: true });

// Export as a factory function
module.exports = (connection) => connection.model('Syllabus', syllabusSchema);