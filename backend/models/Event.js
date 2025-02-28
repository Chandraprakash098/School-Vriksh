const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    date: { type: Date, required: true },
    venue: String,
    targetType: { type: String, enum: ['all', 'class', 'grade'], required: true },
    targetClass: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    attachments: [{
      fileName: String,
      fileUrl: String
    }]
  }, { timestamps: true });

  // module.exports =mongoose.model('Event', eventSchema)
  module.exports = (connection) => connection.model('Event', eventSchema);