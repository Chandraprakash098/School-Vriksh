const mongoose = require("mongoose");

const feeSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
    },
    type: { type: String, required: true }, // e.g., "school", "transportation"
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    description: { type: String },
    isRTE: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = (connection) => connection.model("Fee", feeSchema);
