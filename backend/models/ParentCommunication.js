const mongoose = require('mongoose');

const parentCommunicationSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['behavior', 'academic', 'attendance', 'general'],
    required: true 
  },
  status: { 
    type: String, 
    enum: ['unread', 'read', 'responded'],
    default: 'unread' 
  },
  responses: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// module.exports = mongoose.model('ParentCommunication', parentCommunicationSchema);
module.exports = (connection) => connection.model('ParentCommunication', parentCommunicationSchema);