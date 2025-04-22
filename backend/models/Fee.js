// const mongoose = require("mongoose");

// const feeSchema = new mongoose.Schema(
//   {
//     school: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "School",
//       required: true,
//     },
//     type: { type: String, required: true }, // e.g., "school", "transportation"
//     amount: { type: Number, required: true },
//     dueDate: { type: Date, required: true },
//     month: { type: Number, required: true },
//     year: { type: Number, required: true },
//     description: { type: String },
//     isRTE: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// module.exports = (connection) => connection.model("Fee", feeSchema);



const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Null for general fee definitions, set for student-specific fees
    },
    grNumber: { type: String }, // Set for student-specific fees
    type: { type: String, required: true }, // e.g., "school", "transportation"
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    description: { type: String },
    status: { type: String, default: "pending", enum: ["pending", "paid"] },
    paymentDetails: {
      transactionId: String,
      paymentDate: Date,
      paymentMethod: String,
      receiptNumber: String,
    },
    isRTE: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Add unique index for general fee definitions (no student)
feeSchema.index(
  { school: 1, type: 1, month: 1, year: 1, student: 1 },
  { unique: true, partialFilterExpression: { student: null } }
);

// Add unique index for student-specific fees
feeSchema.index(
  { school: 1, student: 1, type: 1, month: 1, year: 1 },
  { unique: true, partialFilterExpression: { student: { $ne: null } } }
);

module.exports = (connection) => connection.model("Fee", feeSchema);



// const mongoose = require("mongoose");

// const feeSchema = new mongoose.Schema(
//   {
//     school: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "School",
//       required: true,
//     },
//     student: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },
//     grNumber: { type: String },
//     type: { type: String, required: true },
//     amount: { type: Number, required: true },
//     dueDate: { type: Date, required: true },
//     month: { type: Number, required: true },
//     year: { type: Number, required: true },
//     description: { type: String },
//     status: { type: String, default: "pending", enum: ["pending", "paid", "waived"] }, // Added "waived" status
//     paymentDetails: {
//       transactionId: String,
//       paymentDate: Date,
//       paymentMethod: String,
//       receiptNumber: String,
//     },
//     isRTE: { type: Boolean, default: false },
//     discountApplied: {
//       discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
//       amount: { type: Number, default: 0 },
//       description: String,
//     },
//     lateFee: {
//       amount: { type: Number, default: 0 },
//       appliedDate: Date,
//     },
//     currency: { type: String, default: "INR" }, // Added for multi-currency support
//   },
//   { timestamps: true }
// );

// feeSchema.index(
//   { school: 1, type: 1, month: 1, year: 1, student: 1 },
//   { unique: true, partialFilterExpression: { student: null } }
// );

// feeSchema.index(
//   { school: 1, student: 1, type: 1, month: 1, year: 1 },
//   { unique: true, partialFilterExpression: { student: { $ne: null } } }
// );

// module.exports = (connection) => connection.model("Fee", feeSchema);

