const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  agenda: [String],
  attendees: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  }],
  minutes: {
    content: String,
    attachments: [{
      fileName: String,
      fileUrl: String
    }]
  },
  scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);