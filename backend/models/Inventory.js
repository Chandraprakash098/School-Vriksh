const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  itemName: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['furniture', 'electronics', 'stationery', 'sports', 'lab', 'other'],
    required: true 
  },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  minThreshold: { type: Number, required: true },
  location: { type: String },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  lastPurchaseDate: Date,
  lastPurchasePrice: Number,
  status: { 
    type: String, 
    enum: ['sufficient', 'low', 'critical', 'excess'],
    required: true 
  }
}, { timestamps: true });

// module.exports = mongoose.model('Inventory', inventorySchema);
module.exports = (connection) => connection.model('Inventory',inventorySchema);