const mongoose = require("mongoose");


const discountSchema = new mongoose.Schema(
    {
      school: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "School",
        required: true,
      },
      student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null, // Null for general discounts
      },
      type: { type: String, required: true }, // e.g., "merit", "sibling", "financial_aid"
      amount: { type: Number }, // Fixed amount discount
      percentage: { type: Number }, // Percentage-based discount
      description: { type: String },
      applicableFeeTypes: [{ type: String }], // e.g., ["school", "transportation"]
      validFrom: { type: Date, required: true },
      validUntil: { type: Date, required: true },
      status: { type: String, default: "active", enum: ["active", "expired", "inactive"] },
    },
    { timestamps: true }
  );
  
//   module.exports.Discount = (connection) => connection.model("Discount", discountSchema);

module.exports = (connection) => connection.model("Discount", discountSchema);