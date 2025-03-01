const mongoose = require('mongoose');

const transportationSchema = new mongoose.Schema({
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    pickupTime: String,
    dropTime: String
  }, { timestamps: true });

  // module.exports =mongoose.model('Transportation', transportationSchema);

  module.exports = (connection) => connection.model('Transportation', transportationSchema);