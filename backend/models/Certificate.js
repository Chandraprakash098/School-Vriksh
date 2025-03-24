// const mongoose = require('mongoose');

// const certificateSchema = new mongoose.Schema({
//     student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     type: { type: String, required: true },
//     purpose: { type: String, required: true },
//     status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
//     issuedDate: Date,
//     validUntil: Date
//   }, { timestamps: true });

//   // module.exports = mongoose.model('Certificate', certificateSchema);
//   module.exports = (connection) => connection.model('Certificate', certificateSchema);


// const mongoose = require('mongoose');

// const certificateSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { 
//     type: String, 
//     required: true, 
//     enum: ['bonafide', 'leaving', 'transfer'] 
//   },
//   purpose: { type: String, required: true },
//   urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' },
//   status: { 
//     type: String, 
//     enum: ['pending', 'approved', 'rejected', 'generated'], 
//     required: true, 
//     default: 'pending' 
//   },
//   issuedDate: Date,
//   validUntil: Date,
//   documentUrl: String, // Store the generated certificate URL (e.g., Cloudinary URL)
//   generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Clerk who generated it
//   comments: String, // Clerk's comments
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Certificate', certificateSchema);

// const mongoose = require('mongoose');

// const certificateSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { type: String, enum: ['leaving', 'bonafide', 'transfer'], required: true },
//   purpose: { type: String, required: true },
//   urgency: { type: String, enum: ['normal', 'medium', 'high'], default: 'normal' },
//   status: { type: String, enum: ['pending', 'generated', 'rejected'], default: 'pending' },
//   documentUrl: { type: String }, // URL of the initially generated certificate
//   signedDocumentUrl: { type: String }, // URL of the signed certificate
//   isSentToStudent: { type: Boolean, default: false }, // Whether the certificate has been sent to the student
//   requestDate: { type: Date, default: Date.now },
//   issuedDate: { type: Date },
//   generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   comments: { type: String },
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Certificate', certificateSchema);





// const mongoose = require('mongoose');

// const certificateSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   type: { type: String, enum: ['leaving', 'bonafide', 'transfer'], required: true },
//   purpose: { type: String, required: true },
//   urgency: { type: String, enum: ['normal', 'medium', 'high'], default: 'normal' },
//   status: { type: String, enum: ['pending', 'generated', 'rejected'], default: 'pending' },
//   documentUrl: { type: String }, // URL of the initially generated certificate
//   documentKey: { type: String }, // S3 key for the generated certificate
//   signedDocumentUrl: { type: String }, // URL of the signed certificate
//   signedDocumentKey: { type: String }, // S3 key for the signed certificate
//   isSentToStudent: { type: Boolean, default: false }, // Whether the certificate has been sent to the student
//   requestDate: { type: Date, default: Date.now },
//   issuedDate: { type: Date },
//   generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//   comments: { type: String },
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Certificate', certificateSchema);


const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['leaving', 'bonafide', 'transfer'], required: true },
  purpose: { type: String, required: true },
  urgency: { type: String, enum: ['normal', 'medium', 'high'], default: 'normal' },
  status: { type: String, enum: ['pending', 'generated', 'rejected'], default: 'pending' },
  documentUrl: { type: String, required: false }, // Optional now
  documentKey: { type: String },
  signedDocumentUrl: { type: String, required: false }, // Optional now
  signedDocumentKey: { type: String },
  isSentToStudent: { type: Boolean, default: false },
  requestDate: { type: Date, default: Date.now },
  issuedDate: { type: Date },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  comments: { type: String },
}, { timestamps: true });

module.exports = (connection) => connection.model('Certificate', certificateSchema);