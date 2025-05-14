
// const mongoose = require('mongoose');

// const schoolSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   address: { type: String, required: true },
//   contact: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   dbName: { type: String, unique: true }, // Unique database name for the school
//   registrationDate: { type: Date, default: Date.now },
//   subscriptionStatus: { 
//     type: String, 
//     enum: ['active', 'inactive', 'pending'], 
//     default: 'active' 
//   },
//   subscriptionDetails: {
//     plan: String,
//     startDate: Date,
//     endDate: Date,
//     paymentStatus: String,
//     amount: Number
//   },
//   customFormFields: [{ 
//     fieldName: String, 
//     fieldType: String, 
//     required: Boolean 
//   }],
//   rteQuota: {
//     totalSeats: { type: Number, default: 0 },
//     occupied: { type: Number, default: 0 }
//   },
//   // New payment configuration fields
//   paymentConfig: {
//     razorpayKeyId: {
//       type: String,
//       required: false,
//       trim: true
//     },
//     razorpayKeySecret: {
//       type: String,
//       required: false,
//       trim: true,
//       select: false // Prevent accidental exposure in queries
//     },
//     isPaymentConfigured: {
//       type: Boolean,
//       default: false
//     },
//   }
// }, { timestamps: true });

// // Export both the model factory and schema
// module.exports = (connection) => connection.model('School', schoolSchema);
// module.exports.schema = schoolSchema;


const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  dbName: { type: String, unique: true },
  registrationDate: { type: Date, default: Date.now },
  subscriptionStatus: { 
    type: String, 
    enum: ['active', 'inactive', 'pending'], 
    default: 'active' 
  },
  subscriptionDetails: {
    plan: String,
    startDate: Date,
    endDate: Date,
    paymentStatus: String,
    amount: Number
  },
  customFormFields: [{ 
    fieldName: String, 
    fieldType: String, 
    required: Boolean 
  }],
  rteQuota: {
    totalSeats: { type: Number, default: 0 },
    occupied: { type: Number, default: 0 }
  },
  paymentConfig: [{
    paymentType: {
      type: String,
      enum: ['bank_account', 'razorpay', 'upi', 'stripe', 'paytm'],
      required: true
    },
    isActive: { type: Boolean, default: true },
    details: {
      bankName: { type: String, required: function() { return this.paymentType === 'bank_account'; } },
      accountNumber: { type: String, required: function() { return this.paymentType === 'bank_account'; } },
      ifscCode: { type: String, required: function() { return this.paymentType === 'bank_account'; } },
      accountHolderName: { type: String, required: function() { return this.paymentType === 'bank_account'; } },
      
      razorpayKeyId: { type: String, required: function() { return this.paymentType === 'razorpay'; } },
      razorpayKeySecret: { type: String, required: function() { return this.paymentType === 'razorpay'; }, select: false },
      
      upiId: { type: String, required: function() { return this.paymentType === 'upi'; } },
      
      stripePublishableKey: { type: String, required: function() { return this.paymentType === 'stripe'; } },
      stripeSecretKey: { type: String, required: function() { return this.paymentType === 'stripe'; }, select: false },
      
      paytmMid: { type: String, required: function() { return this.paymentType === 'paytm'; } },
      paytmMerchantKey: { type: String, required: function() { return this.paymentType === 'paytm'; }, select: false }
    }
  }],
  logo: {
    key: { type: String }, // S3 key for the logo
    url: { type: String }  // Public URL for the logo
  }
}, { timestamps: true });

module.exports = (connection) => connection.model('School', schoolSchema);
module.exports.schema = schoolSchema;