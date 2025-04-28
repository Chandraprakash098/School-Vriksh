const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Audit Log Schema
const auditLogSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "DEFINE_FEES",
        "EDIT_FEES",
        "PAY_FEES",
        "VERIFY_PAYMENT",
        "REFUND_PAYMENT",
        "DOWNLOAD_RECEIPT",
      ],
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ school: 1, user: 1, timestamp: -1 });

// module.exports = (connection) => connection.model('Attendance', attendanceSchema);
module.exports = (connection) => connection.model("AuditLog", auditLogSchema);