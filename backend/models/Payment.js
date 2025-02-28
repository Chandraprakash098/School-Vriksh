const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  feeType: { type: String, required: true },
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  transactionId: String,
  paymentDate: { type: Date, default: Date.now }
}, { timestamps: true });

// module.exports = mongoose.model('Payment', paymentSchema);
module.exports = (connection) => connection.model('Payment',paymentSchema);