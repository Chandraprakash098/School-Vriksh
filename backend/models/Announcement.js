// const mongoose = require('mongoose');

// const announcementSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   title: { type: String, required: true },
//   content: { type: String, required: true },
//   targetGroups: [{
//     type: String,
//     enum: ['teachers', 'students', 'parents', 'staff', 'trustees', 'all']
//   }],
//   priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
//   validFrom: { type: Date, required: true },
//   validUntil: { type: Date, required: true },
//   attachments: [{
//     fileName: String,
//     fileUrl: String,
//     fileType: String
//   }],
//   createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
// }, { timestamps: true });

// module.exports = mongoose.model('Announcement', announcementSchema);


const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({ 
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, 
  title: { type: String, required: true }, 
  content: { type: String, required: true }, 
  targetGroups: [{ 
    type: String, 
    enum: ['teachers', 'students', 'parents', 'staff', 'trustees', 'all'] 
  }], 
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }, 
  validFrom: { type: Date, required: true }, 
  validUntil: { type: Date, required: true }, 
  attachments: [{ 
    fileName: String, 
    fileUrl: String, 
    fileType: String,
    fileSize: Number,
    publicId: String // Added for Cloudinary management
  }], 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } 
}, { timestamps: true });

module.exports = mongoose.model('Announcement', announcementSchema);