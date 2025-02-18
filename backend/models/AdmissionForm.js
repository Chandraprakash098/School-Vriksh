// const mongoose = require('mongoose');

// const formFieldSchema = new mongoose.Schema({
//   name: String,
//   type: String, // text, number, date, file, etc.
//   required: Boolean,
//   options: [String] // For dropdown/radio fields
// });

// const admissionFormSchema = new mongoose.Schema({
//   school: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'School',
//     required: true
//   },
//   title: String,
//   description: String,
//   formFields: [formFieldSchema],
//   rteFields: [formFieldSchema], // Additional fields for RTE applications
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




const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
  name: String,
  label: String,
  type: String,
  required: Boolean,
  options: [String]
});

const standardFormFields = [
  {
    name: 'studentName',
    label: 'Student Full Name',
    type: 'text',
    required: true
  },
  {
    name: 'dob',
    label: 'Date of Birth',
    type: 'date',
    required: true
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
    required: true
  },
  {
    name: 'mobile',
    label: 'Mobile Number',
    type: 'tel',
    required: true
  },
  {
    name: 'appliedClass',
    label: 'Class Applying For',
    type: 'select',
    options: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'],
    required: true
  },
  {
    name: 'admissionType',
    label: 'Admission Type',
    type: 'select',
    options: ['Regular', 'RTE'],
    required: true
  },
  // Parent Information
  {
    name: 'parentName',
    label: 'Parent/Guardian Name',
    type: 'text',
    required: true
  },
  {
    name: 'parentMobile',
    label: 'Parent Mobile Number',
    type: 'tel',
    required: true
  },
  {
    name: 'parentEmail',
    label: 'Parent Email',
    type: 'email',
    required: true
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

const regularAdmissionDocuments = [
  {
    name: 'studentPhoto',
    label: 'Student Photograph',
    type: 'file',
    required: true
  },
  {
    name: 'aadharCard',
    label: 'Aadhar Card',
    type: 'file',
    required: true
  },
  {
    name: 'birthCertificate',
    label: 'Birth Certificate',
    type: 'file',
    required: true
  },
  {
    name: 'schoolLeavingCertificate',
    label: 'School Leaving Certificate (Required for class 2 and above)',
    type: 'file',
    required: false
  }
];

const rteDocuments = [
  {
    name: 'rteCertificate',
    label: 'RTE Certificate',
    type: 'file',
    required: true
  },
  {
    name: 'studentPhoto',
    label: 'Student Photograph',
    type: 'file',
    required: true
  },
  {
    name: 'aadharCard',
    label: 'Aadhar Card',
    type: 'file',
    required: true
  }
];

const admissionFormSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  title: String,
  description: String,
  standardFields: {
    type: [formFieldSchema],
    default: standardFormFields
  },
  regularDocuments: {
    type: [formFieldSchema],
    default: regularAdmissionDocuments
  },
  rteDocuments: {
    type: [formFieldSchema],
    default: rteDocuments
  },
  additionalFields: [formFieldSchema], // For any school-specific additional fields
  isActive: {
    type: Boolean,
    default: true
  },
  formUrl: {
    type: String,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AdmissionForm', admissionFormSchema);