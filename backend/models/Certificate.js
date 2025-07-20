const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["leaving", "bonafide", "transfer"],
      required: true,
    },
    purpose: { type: String, required: true },
    urgency: {
      type: String,
      enum: ["normal", "medium", "high"],
      default: "normal",
    },
    status: {
      type: String,
      enum: ["pending", "generated", "rejected"],
      default: "pending",
    },
    documentUrl: { type: String, required: false }, // Optional now
    documentKey: { type: String },
    signedDocumentUrl: { type: String, required: false }, // Optional now
    signedDocumentKey: { type: String },
    serialNumber: { type: String, required: false },
    isSentToStudent: { type: Boolean, default: false },
    requestDate: { type: Date, default: Date.now },
    issuedDate: { type: Date },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    comments: { type: String },
  },
  { timestamps: true }
);

module.exports = (connection) =>
  connection.model("Certificate", certificateSchema);
