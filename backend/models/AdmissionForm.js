
// const mongoose = require('mongoose');

// const formFieldSchema = new mongoose.Schema({
//   name: String,
//   label: String,
//   type: String,
//   required: Boolean,
//   options: [String]
// });

// const standardFormFields = [
//   {
//     name: 'studentName',
//     label: 'Student Full Name',
//     type: 'text',
//     required: true
//   },
//   {
//     name: 'dob',
//     label: 'Date of Birth',
//     type: 'date',
//     required: true
//   },
//   {
//     name: 'gender',
//     label: 'Gender',
//     type: 'select',
//     options: ['Male', 'Female', 'Other'],
//     required: true
//   },
//   {
//     name: 'email',
//     label: 'Email Address',
//     type: 'email',
//     required: true
//   },
//   {
//     name: 'mobile',
//     label: 'Mobile Number',
//     type: 'tel',
//     required: true
//   },
//   {
//     name: 'appliedClass',
//     label: 'Class Applying For',
//     type: 'select',
//     options: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
//     required: true
//   },
//   {
//     name: 'admissionType',
//     label: 'Admission Type',
//     type: 'select',
//     options: ['Regular', 'RTE'],
//     required: true
//   },
//   // Parent Information
//   {
//     name: 'parentName',
//     label: 'Parent/Guardian Name',
//     type: 'text',
//     required: true
//   },
//   {
//     name: 'parentMobile',
//     label: 'Parent Mobile Number',
//     type: 'tel',
//     required: true
//   },
//   {
//     name: 'parentEmail',
//     label: 'Parent Email',
//     type: 'email',
//     required: true
//   },
//   {
//     name: 'parentOccupation',
//     label: 'Parent Occupation',
//     type: 'text',
//     required: true
//   },
//   {
//     name: 'address',
//     label: 'Residential Address',
//     type: 'textarea',
//     required: true
//   }
// ];

// const regularAdmissionDocuments = [
//   {
//     name: 'studentPhoto',
//     label: 'Student Photograph',
//     type: 'file',
//     required: true
//   },
//   {
//     name: 'aadharCard',
//     label: 'Aadhar Card',
//     type: 'file',
//     required: true
//   },
//   {
//     name: 'birthCertificate',
//     label: 'Birth Certificate',
//     type: 'file',
//     required: true
//   },
//   {
//     name: 'schoolLeavingCertificate',
//     label: 'School Leaving Certificate (Required for class 2 and above)',
//     type: 'file',
//     required: false
//   }
// ];

// const rteDocuments = [
//   {
//     name: 'rteCertificate',
//     label: 'RTE Certificate',
//     type: 'file',
//     required: true
//   },
//   {
//     name: 'studentPhoto',
//     label: 'Student Photograph',
//     type: 'file',
//     required: true
//   },
//   {
//     name: 'aadharCard',
//     label: 'Aadhar Card',
//     type: 'file',
//     required: true
//   }
// ];

// const admissionFormSchema = new mongoose.Schema({
//   school: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'School',
//     required: true
//   },
//   title: String,
//   description: String,
//   standardFields: {
//     type: [formFieldSchema],
//     default: standardFormFields
//   },
//   regularDocuments: {
//     type: [formFieldSchema],
//     default: regularAdmissionDocuments
//   },
//   rteDocuments: {
//     type: [formFieldSchema],
//     default: rteDocuments
//   },
//   additionalFields: [formFieldSchema], // For any school-specific additional fields
//   isActive: {
//     type: Boolean,
//     default: true
//   },
//   formUrl: {
//     type: String,
//     unique: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// module.exports = mongoose.model('AdmissionForm', admissionFormSchema);



const mongoose = require('mongoose');

// Separate schema for form field validation rules
const formFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['text', 'email', 'tel', 'date', 'select', 'textarea', 'file', 'number']
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true
  }],
  validation: {
    min: Number,
    max: Number,
    pattern: String,
    maxSize: Number, // for file uploads (in bytes)
    allowedTypes: [String] // for file uploads (mime types)
  }
});

// Standard form fields with improved validation
const standardFormFields = [
  {
    name: 'studentName',
    label: 'Student Full Name',
    type: 'text',
    required: true,
    validation: {
      pattern: '^[a-zA-Z ]{2,50}$'
    }
  },
  {
    name: 'dob',
    label: 'Date of Birth',
    type: 'date',
    required: true,
    // validation: {
    //   max: new Date().toISOString() // Cannot be future date
    // }
    validation: {
      max: Date.now() // Use timestamp instead of ISO string
    }
  },
  {
    name: 'gender',
    label: 'Gender',
    type: 'select',
    options: ['Male', 'Female', 'Other'],
    required: true
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    required: true,
    validation: {
      pattern: '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$'
    }
  },
  {
    name: 'mobile',
    label: 'Mobile Number',
    type: 'tel',
    required: true,
    validation: {
      pattern: '^[0-9]{10}$'
    }
  },
  {
    name: 'appliedClass',
    label: 'Class Applying For',
    type: 'select',
    options: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th','11th','12th'],
    required: true
  },
  {
    name: 'admissionType',
    label: 'Admission Type',
    type: 'select',
    options: ['Regular', 'RTE'],
    required: true
  },
  {
    name: 'parentName',
    label: 'Parent/Guardian Name',
    type: 'text',
    required: true,
    validation: {
      pattern: '^[a-zA-Z ]{2,50}$'
    }
  },
  {
    name: 'parentMobile',
    label: 'Parent Mobile Number',
    type: 'tel',
    required: true,
    validation: {
      pattern: '^[0-9]{10}$'
    }
  },
  {
    name: 'parentEmail',
    label: 'Parent Email',
    type: 'email',
    required: true,
    validation: {
      pattern: '^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$'
    }
  },
  {
    name: 'parentOccupation',
    label: 'Parent Occupation',
    type: 'text',
    required: true
  },
  {
    name: 'address',
    label: 'Residential Address',
    type: 'textarea',
    required: true
  }
];

// Document requirements with file validation
const regularAdmissionDocuments = [
  {
    name: 'studentPhoto',
    label: 'Student Photograph',
    type: 'file',
    required: true,
    validation: {
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png']
    }
  },
  {
    name: 'aadharCard',
    label: 'Aadhar Card',
    type: 'file',
    required: true,
    validation: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  },
  {
    name: 'birthCertificate',
    label: 'Birth Certificate',
    type: 'file',
    required: true,
    validation: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  },
  {
    name: 'schoolLeavingCertificate',
    label: 'School Leaving Certificate (Required for class 2 and above)',
    type: 'file',
    required: false,
    validation: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  }
];

const rteDocuments = [
  {
    name: 'rteCertificate',
    label: 'RTE Certificate',
    type: 'file',
    required: true,
    validation: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  },
  {
    name: 'studentPhoto',
    label: 'Student Photograph',
    type: 'file',
    required: true,
    validation: {
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png']
    }
  },
  {
    name: 'aadharCard',
    label: 'Aadhar Card',
    type: 'file',
    required: true,
    validation: {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  }
];

const admissionFormSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  standardFields: {
    type: [formFieldSchema],
    default: standardFormFields,
    validate: {
      validator: function(fields) {
        // Ensure required fields are present
        const requiredFields = ['studentName', 'dob', 'gender', 'email', 'mobile', 'appliedClass', 'admissionType'];
        return requiredFields.every(field => 
          fields.some(f => f.name === field && f.required)
        );
      },
      message: 'Missing required standard fields'
    }
  },
  regularDocuments: {
    type: [formFieldSchema],
    default: regularAdmissionDocuments
  },
  rteDocuments: {
    type: [formFieldSchema],
    default: rteDocuments
  },
  additionalFields: [formFieldSchema],
  isActive: {
    type: Boolean,
    default: true
  },
  formUrl: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  submissionDeadline: {
    type: Date
  },
  academicYear: {
    type: String,
    required: true
  },
  maxApplications: {
    type: Number,
    min: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
admissionFormSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to check if form is accepting applications
admissionFormSchema.methods.isAcceptingApplications = function() {
  if (!this.isActive) return false;
  if (this.submissionDeadline && new Date() > this.submissionDeadline) return false;
  return true;
};

// Method to validate a field value based on its validation rules
admissionFormSchema.methods.validateField = function(fieldName, value) {
  const field = [...this.standardFields, ...this.additionalFields]
    .find(f => f.name === fieldName);
  
  if (!field) return { valid: false, error: 'Field not found' };

  if (field.required && !value) {
    return { valid: false, error: 'Field is required' };
  }

  if (field.validation) {
    if (field.validation.pattern && value) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        return { valid: false, error: 'Invalid format' };
      }
    }

    if (field.validation.min && value < field.validation.min) {
      return { valid: false, error: `Minimum value is ${field.validation.min}` };
    }

    if (field.validation.max && value > field.validation.max) {
      return { valid: false, error: `Maximum value is ${field.validation.max}` };
    }
  }

  return { valid: true };
};

module.exports = mongoose.model('AdmissionForm', admissionFormSchema);