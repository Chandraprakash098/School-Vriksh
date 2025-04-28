
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
  receiptUrl: String,
  feesPaid: [{
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee', required: true },
    type: { type: String, required: true }, // e.g., "school"
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true },
    transportationSlab: { type: String, enum: ['0-10km', '10-20km', '20-30km', '30+km'] },
  }],
}, { timestamps: true });

module.exports = (connection) => connection.model('Payment', paymentSchema);



// const mongoose = require("mongoose");

// const paymentSchema = new mongoose.Schema(
//   {
//     school: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "School",
//       required: true,
//     },
//     student: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     grNumber: { type: String, required: true },
//     amount: { type: Number, required: true }, // Total amount paid in this transaction
//     paymentMethod: {
//       type: String,
//       enum: ["cash", "online", "cheque", "bank_transfer"],
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["pending", "completed", "failed"],
//       default: "pending",
//     },
//     paymentDate: { type: Date },
//     transactionId: { type: String }, // For online payments (e.g., Razorpay)
//     orderId: { type: String }, // For Razorpay order ID
//     receiptNumber: { type: String }, // Unique receipt number
//     receiptUrl: { type: String }, // Primary receipt URL
//     receiptUrls: { type: Map, of: String }, // Map of month-year to receipt URLs
//     feesPaid: [
//       {
//         feeId: { type: mongoose.Schema.Types.ObjectId, ref: "Fee" },
//         type: { type: String, required: true },
//         month: { type: Number, required: true },
//         year: { type: Number, required: true },
//         amount: { type: Number, required: true }, // Amount paid for this fee
//       },
//     ],
//   },
//   { timestamps: true }
// );

// // Ensure unique receipt numbers
// paymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });

// // Pre-save hook to validate feesPaid amounts
// paymentSchema.pre("save", function (next) {
//   if (this.isModified("feesPaid")) {
//     const totalFeesPaid = this.feesPaid.reduce(
//       (sum, fee) => sum + fee.amount,
//       0
//     );
//     if (totalFeesPaid !== this.amount) {
//       return next(
//         new Error("Sum of feesPaid amounts does not match payment amount")
//       );
//     }
//   }
//   next();
// });

// module.exports = (connection) => connection.model("Payment", paymentSchema);