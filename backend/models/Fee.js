// const mongoose = require('mongoose');

// const feeSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   grNumber: { type: String, required: true },
//   type: { 
//     type: String, 
//     enum: ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'],
//     required: true 
//   },
//   amount: { type: Number, required: true },
//   dueDate: { type: Date, required: true },
//   status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
//   isRTE: { type: Boolean, default: false },
//   paymentDetails: {
//     transactionId: String,
//     paymentDate: Date,
//     paymentMethod: String,
//     receiptNumber: String
//   }
// }, { timestamps: true });

// // module.exports = mongoose.model('Fee', feeSchema);
// module.exports = (connection) => connection.model('Fee', feeSchema);





// const mongoose = require('mongoose');

// const feeSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for fee definitions
//   grNumber: { type: String },
//   type: { 
//     type: String, 
//     enum: ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'],
//     required: true 
//   },
//   amount: { type: Number, required: true },
//   dueDate: { type: Date, required: true },
//   month: { type: Number, required: true }, // 1-12
//   year: { type: Number, required: true },
//   status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
//   isRTE: { type: Boolean, default: false },
//   description: { type: String }, // New field for fee description
//   paymentDetails: {
//     transactionId: String,
//     paymentDate: Date,
//     paymentMethod: String,
//     receiptNumber: String
//   }
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Fee', feeSchema);


const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  type: { type: String, required: true }, // e.g., "school", "transportation"
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  month: { type: Number, required: true },
  year: { type: Number, required: true },
  description: { type: String },
  isRTE: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = (connection) => connection.model('Fee', feeSchema);