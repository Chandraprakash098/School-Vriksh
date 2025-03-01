// const mongoose = require('mongoose');

// const schoolSchema = new mongoose.Schema({
//   name: { type: String, required: true },
//   address: { type: String, required: true },
//   contact: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
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
//     paymentStatus: String
//   },
//   customFormFields: [{ 
//     fieldName: String, 
//     fieldType: String, 
//     required: Boolean 
//   }],
//   rteQuota: {
//     totalSeats: { type: Number, default: 0 },
//     occupied: { type: Number, default: 0 }
//   }
// }, { timestamps: true });

// module.exports = mongoose.model('School', schoolSchema);







const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  dbName: { type: String, unique: true }, // Unique database name for the school
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
  }
}, { timestamps: true });

// Export as a factory function
// module.exports = (connection) => connection.model('School', schoolSchema);
// module.exports = {
//   model: (connection) => connection.model('School', schoolSchema),
//   schema: schoolSchema
// };

// module.exports = (connection) => connection.model('School', schoolSchema);
module.exports = {
  schema: schoolSchema,
  model: (connection) => connection.model('School', schoolSchema),
};