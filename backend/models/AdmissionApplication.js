const mongoose = require('mongoose');

// const admissionApplicationSchema = new mongoose.Schema({
//     school: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'School',
//       required: true
//     },
//     student: {
//       name: String,
//       email: String,
//       phone: String,
//       address: Object
//     },
//     class: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Class',
//     //   required: true
//     },
//     formResponses: Object, // Dynamic form responses
//     isRTE: {
//       type: Boolean,
//       required: true
//     },
//     rteDocuments: [{
//     //   type: String,
//     type: { type: String },
//       documentUrl: String,
//       verified: {
//         type: Boolean,
//         default: false
//       }
//     }],
//     status: {
//       type: String,
//       enum: ['pending', 'fees_pending', 'document_verification', 'approved', 'rejected'],
//       default: 'pending'
//     },
//     paymentStatus: {
//       type: String,
//       enum: ['not_applicable', 'pending', 'completed'],
//       default: 'pending'
//     },
//     paymentDetails: {
//       transactionId: String,
//       amount: Number,
//       paidAt: Date
//     },
//     trackingId: {
//       type: String,
//       unique: true
//     },
//     clerkVerification: {
//       status: {
//         type: String,
//         enum: ['pending', 'verified', 'rejected'],
//         default: 'pending'
//       },
//       verifiedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       verifiedAt: Date,
//       comments: String
//     },
//     feesVerification: {
//       status: {
//         type: String,
//         enum: ['pending', 'verified', 'rejected'],
//         default: 'pending'
//       },
//       verifiedBy: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: 'User'
//       },
//       verifiedAt: Date,
//       receiptNumber: String
//     },
//     createdAt: {
//       type: Date,
//       default: Date.now
//     }
//   });


const admissionApplicationSchema = new mongoose.Schema({
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true
    },
    studentDetails: {
      name: {
        type: String,
        required: true
      },
      dob: {
        type: Date,
        required: true
      },
      gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female', 'Other']
      },
      email: {
        type: String,
        required: true
      },
      mobile: {
        type: String,
        required: true
      },
      appliedClass: {
        type: String,
        required: true
      }
    },
    parentDetails: {
      name: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      mobile: {
        type: String,
        required: true
      },
      occupation: String,
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String
      }
    },
    admissionType: {
      type: String,
      enum: ['Regular', 'RTE'],
      required: true
    },
    documents: [{
      type: {
        type: String,
        required: true
      },
      documentUrl: String,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    status: {
      type: String,
      enum: ['pending', 'document_verification', 'fees_pending', 'approved', 'rejected'],
      default: 'pending'
    },
    paymentStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'completed'],
      default: 'pending'
    },
    paymentDetails: {
      transactionId: String,
      amount: Number,
      paidAt: Date
    },
    trackingId: {
      type: String,
      unique: true
    },
    clerkVerification: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verifiedAt: Date,
      comments: String
    },
    feesVerification: {
      status: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      verifiedAt: Date,
      receiptNumber: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  // Helper function to validate documents based on admission type and class
  admissionApplicationSchema.methods.validateDocuments = function() {
    if (this.admissionType === 'RTE') {
      return this.documents.some(doc => doc.type === 'rteCertificate');
    } else {
      const requiredDocs = ['studentPhoto', 'aadharCard', 'birthCertificate'];
      if (this.studentDetails.appliedClass !== '1st') {
        requiredDocs.push('schoolLeavingCertificate');
      }
      return requiredDocs.every(docType => 
        this.documents.some(doc => doc.type === docType)
      );
    }
  };
  
  // Middleware to set payment status based on admission type
  admissionApplicationSchema.pre('save', function(next) {
    if (this.admissionType === 'RTE') {
      this.paymentStatus = 'not_applicable';
    }
    next();
  });

  module.exports = mongoose.model('AdmissionApplication', admissionApplicationSchema);