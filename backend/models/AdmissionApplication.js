const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
});

const studentDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true, enum: ["Male", "Female", "Other"] },
  email: { type: String, required: true, trim: true, lowercase: true },
  mobile: { type: String, required: true, trim: true },
  appliedClass: {
    type: String,
    required: true,
    enum: [
      "1st",
      "2nd",
      "3rd",
      "4th",
      "5th",
      "6th",
      "7th",
      "8th",
      "9th",
      "10th",
      "11th",
      "12th",
    ],
  },
});

const parentDetailsSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  mobile: { type: String, required: true, trim: true },
  occupation: String,
  address: addressSchema,
});

const documentSchema = new mongoose.Schema({
  type: { type: String, required: true },
  documentUrl: { type: String, required: false }, // Optional now
  key: { type: String, required: true },
  verified: { type: Boolean, default: false },
});

const admissionApplicationSchema = new mongoose.Schema({
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "School",
    required: true,
  },
  studentDetails: studentDetailsSchema,
  parentDetails: parentDetailsSchema,
  admissionType: { type: String, enum: ["Regular", "RTE"], required: true },
  documents: [documentSchema],
  additionalResponses: { type: Map, of: mongoose.Schema.Types.Mixed },
  grNumber: { type: String, unique: true, sparse: true },
  assignedClass: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
  status: {
    type: String,
    enum: [
      "pending",
      "document_verification",
      "fees_pending",
      "approved",
      "rejected",
      "confirmed",
      "enrolled",
    ],
    default: "pending",
  },
  paymentStatus: {
    type: String,
    enum: ["not_applicable", "pending", "completed"],
    default: "pending",
  },
  paymentDetails: {
    transactionId: String,
    amount: Number,
    paidAt: Date,
  },
  trackingId: { type: String, required: true, unique: true },
  clerkVerification: {
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    comments: String,
  },
  feesVerification: {
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    receiptNumber: String,
    comments: String,
  },
  createdAt: { type: Date, default: Date.now },
});

admissionApplicationSchema.methods.validateDocuments = function () {
  if (this.admissionType === "RTE") {
    return (
      this.documents.some((doc) => doc.type === "rteCertificate") &&
      this.documents.some((doc) => doc.type === "studentPhoto") &&
      this.documents.some((doc) => doc.type === "aadharCard")
    );
  } else {
    const requiredDocs = ["studentPhoto", "aadharCard", "birthCertificate"];
    if (this.studentDetails.appliedClass !== "1st") {
      requiredDocs.push("schoolLeavingCertificate");
    }
    return requiredDocs.every((docType) =>
      this.documents.some((doc) => doc.type === docType)
    );
  }
};

admissionApplicationSchema.pre("save", function (next) {
  if (this.admissionType === "RTE" && this.paymentStatus === "not_applicable") {
    this.paymentStatus = "not_applicable";
  }
  next();
});

module.exports = (connection) =>
  connection.model("AdmissionApplication", admissionApplicationSchema);
