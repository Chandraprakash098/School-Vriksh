// const mongoose = require('mongoose');

// const userSchema = new mongoose.Schema(
//   {
//     school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     role: {
//       type: String,
//       enum: [
//         'owner', 'admin', 'trusty', 'teacher', 'student', 'parent', 
//         'clerk', 'librarian', 'inventory_manager', 'fee_manager', 'transport'
//       ],
//       required: true
//     },
//     status: { type: String, enum: ['active', 'inactive'], default: 'active' },
//     profile: {
//       phone: String,
//       address: String,
//       photo: String
//     },
//     permissions: {
//       canTakeAttendance: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
//       canEnterMarks: [
//         {
//           class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
//           subject: String
//         }
//       ],
//       canPublishAnnouncements: { type: Boolean, default: false },
//       canManageInventory: { type: Boolean, default: false },
//       canManageFees: { type: Boolean, default: false },
//       canManageLibrary: { type: Boolean, default: false }
//     },
//     studentDetails: {
//       grNumber: { type: String, unique: true, sparse: true },
//       class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
//       admissionType: { type: String, enum: ['Regular', 'RTE'] },
//       parentDetails: {
//         name: String,
//         email: String,
//         mobile: String,
//         occupation: String
//       },
//       dob: Date,
//       gender: String
//     }
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model('User', userSchema);














const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School' }, // Stored in owner_db
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        'owner', 'admin', 'trusty', 'teacher', 'student', 'parent', 
        'clerk', 'librarian', 'inventory_manager', 'fee_manager', 'transport'
      ],
      required: true
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    profile: {
      phone: String,
      address: String,
      photo: String
    },
    permissions: {
      canTakeAttendance: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
      canEnterMarks: [
        {
          class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
          subject: String
        }
      ],
      canPublishAnnouncements: { type: Boolean, default: false },
      canManageInventory: { type: Boolean, default: false },
      canManageFees: { type: Boolean, default: false },
      canManageLibrary: { type: Boolean, default: false }
    },
    studentDetails: {
      grNumber: { type: String, unique: true, sparse: true },
      class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
      admissionType: { type: String, enum: ['Regular', 'RTE'] },
      parentDetails: {
        name: String,
        email: String,
        mobile: String,
        occupation: String
      },
      dob: Date,
      gender: String
    }
  },
  { timestamps: true }
);

// Export a factory function instead of a static model
module.exports = (connection) => connection.model('User', userSchema);