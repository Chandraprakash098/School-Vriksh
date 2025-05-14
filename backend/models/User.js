// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema(
//   {
//     school: { type: mongoose.Schema.Types.ObjectId, ref: "School" }, // Stored in owner_db
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true },
//     role: {
//       type: String,
//       enum: [
//         "owner",
//         "admin",
//         "trusty",
//         "teacher",
//         "student",
//         "parent",
//         "clerk",
//         "librarian",
//         "inventory_manager",
//         "fee_manager",
//         "transport",
//       ],
//       required: true,
//     },
//     status: { type: String, enum: ["active", "inactive"], default: "active" },
//     profile: {
//       phone: String,
//       address: String,
//       photo: String,
//     },
//     permissions: {
//       canTakeAttendance: [
//         { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
//       ],
//       canEnterMarks: [
//         {
//           class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
//           subject: String,
//         },
//       ],
//       canPublishAnnouncements: { type: Boolean, default: false },
//       canManageInventory: { type: Boolean, default: false },
//       canManageFees: { type: Boolean, default: false },
//       canManageLibrary: { type: Boolean, default: false },
//     },
//     studentDetails: {
//       grNumber: { type: String, unique: true, sparse: true },
//       class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
//       admissionType: { type: String, enum: ["Regular", "RTE"] },
//       parentDetails: {
//         name: String,
//         email: String,
//         mobile: String,
//         occupation: String,
//       },
//       parent: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Reference to parent User
//       children: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
//       dob: Date,
//       gender: String,
//     },
//   },
//   { timestamps: true }
// );

// // Export a factory function instead of a static model
// module.exports = (connection) => connection.model("User", userSchema);



const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    school: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "owner",
        "admin",
        "trusty",
        "teacher",
        "student",
        "parent",
        "clerk",
        "librarian",
        "inventory_manager",
        "fee_manager",
        "transport",
      ],
      required: true,
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    profile: {
      phone: String,
      address: String,
      photo: String,
    },
    permissions: {
      canTakeAttendance: [
        { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
      ],
      canEnterMarks: [
        {
          class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
          subject: String,
        },
      ],
      canPublishAnnouncements: { type: Boolean, default: false },
      canManageInventory: { type: Boolean, default: false },
      canManageFees: { type: Boolean, default: false },
      canManageLibrary: { type: Boolean, default: false },
    },
    studentDetails: {
      grNumber: { type: String, unique: true, sparse: true },
      class: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
      admissionType: { type: String, enum: ["Regular", "RTE"], default: "Regular" },
      parentDetails: {
        name: String,
        email: String,
        mobile: String,
        occupation: String,
      },
      parent: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      children: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      dob: Date,
      gender: String,
      mobile: String,
      isRTE: { type: Boolean, default: false },
      transportDetails: {
        isApplicable: { type: Boolean, default: false },
        distance: { type: Number },
        distanceSlab: {
          type: String,
          enum: ["0-10km", "10-20km", "20-30km", "30+km", null],
          default: null,
        },
      },
    },
  },
  { timestamps: true }
);

// Indexes for performance
// userSchema.index({ "studentDetails.grNumber": 1 }, { sparse: true, unique: true });
// userSchema.index({ email: 1 }, { unique: true });
// userSchema.index({ school: 1, role: 1 });

module.exports = (connection) => connection.model("User", userSchema);
