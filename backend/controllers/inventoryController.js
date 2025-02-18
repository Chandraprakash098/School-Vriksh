const Inventory = require('../models/Inventory');

const inventoryController = {
  // Add new item
  addItem: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const itemData = req.body;

      const item = new Inventory({
        school: schoolId,
        ...itemData,
        status: determineStatus(itemData.quantity, itemData.minThreshold)
      });

      await item.save();
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update stock
  updateStock: async (req, res) => {
    try {
      const { itemId } = req.params;
      const { quantity, lastPurchasePrice, lastPurchaseDate } = req.body;

      const item = await Inventory.findById(itemId);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }

      item.quantity = quantity;
      item.lastPurchasePrice = lastPurchasePrice || item.lastPurchasePrice;
      item.lastPurchaseDate = lastPurchaseDate || new Date();
      item.status = determineStatus(quantity, item.minThreshold);

      await item.save();
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get low stock items
  getLowStockItems: async (req, res) => {
    try {
      const { schoolId } = req.params;

      const items = await Inventory.find({
        school: schoolId,
        status: { $in: ['low', 'critical'] }
      }).sort({ quantity: 1 });

      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

// Helper function to determine inventory status
function determineStatus(quantity, minThreshold) {
  if (quantity === 0) return 'critical';
  if (quantity < minThreshold) return 'low';
  if (quantity > minThreshold * 2) return 'excess';
  return 'sufficient';
}

module.exports = inventoryController;
