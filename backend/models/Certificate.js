const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    purpose: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
    issuedDate: Date,
    validUntil: Date
  }, { timestamps: true });

  module.exports = mongoose.model('Certificate', certificateSchema);