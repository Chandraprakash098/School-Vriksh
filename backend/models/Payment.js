// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   amount: { type: Number, required: true },
//   feeType: { type: String, required: true },
//   paymentMethod: { type: String, required: true },
//   status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
//   transactionId: String,
//   paymentDate: { type: Date, default: Date.now }
// }, { timestamps: true });

// // module.exports = mongoose.model('Payment', paymentSchema);
// module.exports = (connection) => connection.model('Payment',paymentSchema);


// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true }, // Link to school
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Link to student
//   amount: { type: Number, required: true }, // Payment amount
//   feeType: { type: String, required: true }, // Type of fee (e.g., school, computer)
//   paymentMethod: { type: String, required: true }, // Method (e.g., cash, UPI, Debit Card)
//   status: { type: String, enum: ['pending', 'completed', 'failed'], required: true }, // Payment status
//   transactionId: String, // For online payments (e.g., Razorpay transaction ID)
//   orderId: String, // Razorpay order ID for online payments
//   receiptNumber: String, // Unique receipt number for cash payments
//   paymentDate: { type: Date, default: Date.now }, // Date of payment
//   feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee' }, // Link to the specific fee being paid
// }, { timestamps: true }); // Adds createdAt and updatedAt fields

// module.exports = (connection) => connection.model('Payment', paymentSchema);


// const mongoose = require('mongoose');

// const paymentSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   amount: { type: Number, required: true },
//   feeType: { type: String, required: true },
//   paymentMethod: { type: String, required: true },
//   status: { type: String, enum: ['pending', 'completed', 'failed'], required: true },
//   transactionId: String,
//   orderId: String,
//   receiptNumber: String,
//   paymentDate: { type: Date, default: Date.now },
//   feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee' },
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Payment', paymentSchema);


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