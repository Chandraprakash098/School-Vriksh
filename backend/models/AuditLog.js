const mongoose = require("mongoose");

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
        required: true,
      },
      action: { type: String, required: true }, // e.g., "fee_defined", "payment_processed"
      entity: { type: String, required: true }, // e.g., "Fee", "Payment", "Discount"
      entityId: { type: mongoose.Schema.Types.ObjectId },
      details: { type: mongoose.Schema.Types.Mixed },
    },
    { timestamps: true }
  );
  
//   module.exports.AuditLog = (connection) => connection.model("AuditLog", auditLogSchema);

module.exports = (connection) => connection.model("AuditLog", auditLogSchema);