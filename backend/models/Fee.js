const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { 
    type: String, 
    enum: ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'],
    required: true 
  },
  amount: { type: Number, required: true },
  dueDate: { type: Date, required: true },
  status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
  isRTE: { type: Boolean, default: false },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    paymentMethod: String,
    receiptNumber: String
  }
}, { timestamps: true });

// module.exports = mongoose.model('Fee', feeSchema);
module.exports = (connection) => connection.model('Fee', feeSchema);