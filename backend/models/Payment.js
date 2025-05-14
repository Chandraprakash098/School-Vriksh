
// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   grNumber: { type: String, required: true },
//   amount: { type: Number, required: true },
//   paymentMethod: { type: String, required: true },
//   status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
//   transactionId: String,
//   orderId: String,
//   receiptNumber: String,
//   paymentDate: { type: Date },
//   receiptUrl: String,
//   feesPaid: [{
//     feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
//     type: { type: String, required: true }, // e.g., "school"
//     month: { type: Number, required: true },
//     year: { type: Number, required: true },
//     amount: { type: Number, required: true },
//     transportationSlab: { type: String, enum: ['0-10km', '10-20km', '20-30km', '30+km'] },
//   }],
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Payment', paymentSchema);


const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  grNumber: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['bank_account', 'razorpay', 'upi', 'stripe', 'paytm','cash'], required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'awaiting_verification'], required: true },
  transactionId: String,
  orderId: String,
  receiptNumber: String,
  paymentDate: { type: Date },
  receiptUrl: String,
  proofOfPayment: { // New field for manual payment methods
    url: String,
    uploadedAt: Date,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date
  },
  feesPaid: [{
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    type: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true },
    transportationSlab: { type: String, enum: ['0-10km', '10-20km', '20-30km', '30+km'] },
  }],
}, { timestamps: true });

module.exports = (connection) => connection.model('Payment', paymentSchema);