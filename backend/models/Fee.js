
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
//       default: null, // Null for general fee definitions
//     },
//     grNumber: { type: String }, // Set for student-specific fees
//     classes: [
//       {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "Class",
//         default: null, // Null for student-specific fees
//       },
//     ],
//     // type: { type: String, required: true }, // e.g., "school", "transportation"
//     type: {
//       type: String,
//       enum: ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational','library','sport'],
//       required: true,
//     },
//     amount: { type: Number, required: true }, // Total fee amount
//     paidAmount: { type: Number, default: 0 }, // Amount paid so far
//     remainingAmount: { type: Number }, // Remaining amount to be paid
//     dueDate: { type: Date, required: true },
//     month: { type: Number, required: true },
//     year: { type: Number, required: true },
//     description: { type: String },
//     status: {
//       type: String,
//       default: "pending",
//       enum: ["pending", "partially_paid", "paid"],
//     },
    
//     paymentDetails: [
//       {
//         transactionId: String,
//         paymentDate: Date,
//         paymentMethod: String,
//         receiptNumber: String,
//         amount: Number, // Amount paid in this transaction
//       },
//     ],
//     isRTE: { type: Boolean, default: false },
//     transportationDetails: {
//       isApplicable: { type: Boolean, default: null }, // Null for general fees
//       distance: { type: Number },
//       distanceSlab: { type: String, enum: ['0-10km', '10-20km', '20-30km', '30+km'] },
//     },
//   },
//   { timestamps: true }
// );

// // Unique index for general fee definitions
// feeSchema.index(
//   { school: 1, type: 1, month: 1, year: 1, classes: 1, student: 1 },
//   { unique: true, partialFilterExpression: { student: null } }
// );

// // Unique index for student-specific fees
// feeSchema.index(
//   { school: 1, student: 1, type: 1, month: 1, year: 1 },
//   { unique: true, partialFilterExpression: { student: { $ne: null } } }
// );

// // Pre-save hook to update remainingAmount
// feeSchema.pre("save", function (next) {
//   if (this.isModified("paidAmount") || this.isNew) {
//     this.remainingAmount = this.amount - this.paidAmount;
//     this.status =
//       this.paidAmount === 0
//         ? "pending"
//         : this.paidAmount >= this.amount
//         ? "paid"
//         : "partially_paid";
//   }
//   next();
// });

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
      default: null,
    },
    grNumber: { type: String },
    classes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Class",
        default: null,
      },
    ],
    type: {
      type: String,
      enum: ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational', 'library', 'sport'],
      required: true,
    },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number },
    dueDate: { type: Date, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    description: { type: String },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "partially_paid", "paid"],
    },
    paymentDetails: [
      {
        transactionId: String,
        paymentDate: Date,
        paymentMethod: String,
        receiptNumber: String,
        amount: Number,
      },
    ],
    isRTE: { type: Boolean, default: false },
    transportationDetails: {
      isApplicable: { type: Boolean, default: null },
      distance: { type: Number },
      distanceSlab: { type: String, enum: ['0-10km', '10-20km', '20-30km', '30+km'] },
    },
  },
  { timestamps: true }
);

feeSchema.pre("save", function (next) {
  if (this.isModified("paidAmount") || this.isNew) {
    this.remainingAmount = this.amount - this.paidAmount;
    this.status =
      this.paidAmount === 0
        ? "pending"
        : this.paidAmount >= this.amount
        ? "paid"
        : "partially_paid";
  }
  next();
});

module.exports = (connection) => {
  if (connection.models.Fee) {
    delete connection.models.Fee;
  }
  
  const FeeModel = connection.model("Fee", feeSchema);
  
  const recreateIndexes = async () => {
    try {
      const collection = FeeModel.collection;
      const indexInfo = await collection.indexes();
      
      for (const index of indexInfo) {
        if (index.name !== '_id_') {
          await collection.dropIndex(index.name);
        }
      }
      
      await FeeModel.createIndexes([
        {
          key: { 
            school: 1, 
            type: 1, 
            month: 1, 
            year: 1, 
            classes: 1, 
            student: 1,
            "transportationDetails.distanceSlab": 1
          },
          unique: true,
          name: 'idx_fee_unique'
        },
        {
          key: { school: 1, student: 1, month: 1, year: 1 },
          name: 'idx_fee_query'
        }
      ]);
      
      console.log('Fee indexes recreated successfully');
    } catch (error) {
      console.error('Error recreating indexes:', error);
    }
  };
  
  recreateIndexes();
  
  return FeeModel;
};