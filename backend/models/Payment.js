
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  grNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
  transactionId: String,
  orderId: String,
  receiptNumber: String,
  paymentDate: { type: Date },
  feesPaid: [{
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    type: { type: String, required: true }, // e.g., "school"
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true }
  }],
}, { timestamps: true });

module.exports = (connection) => connection.model('Payment', paymentSchema);