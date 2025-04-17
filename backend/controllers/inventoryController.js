const Inventory = require('../models/Inventory');

const inventoryController = {
  // Create a new procurement/restocking order
  createOrder: async (req, res) => {
    try {
      const { orderId, itemName, quantityOrdered, vendor, status, expectedDelivery } = req.body;
      const newOrder = new Inventory({
        type: 'procurement',
        orderId,
        itemName,
        quantityOrdered,
        vendor,
        status,
        expectedDelivery,
      });
      const savedOrder = await newOrder.save();
      res.status(201).json(savedOrder);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all procurement/restocking orders
  getOrders: async (req, res) => {
    try {
      const orders = await Inventory.find({ type: 'procurement' });
      res.status(200).json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update order status (e.g., Mark as Received, Cancel Order, Request Urgent Delivery)
  updateOrder: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const updatedOrder = await Inventory.findOneAndUpdate(
        { orderId, type: 'procurement' },
        { status },
        { new: true }
      );
      if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
      res.status(200).json(updatedOrder);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Add a new library book
  addLibraryItem: async (req, res) => {
    try {
      const { title, author, isbn, purchaseDate, qty, amount } = req.body;
      const newItem = new Inventory({
        type: 'library',
        title,
        author,
        isbn,
        purchaseDate,
        qty,
        amount,
      });
      const savedItem = await newItem.save();
      res.status(201).json(savedItem);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all library items
  getLibraryItems: async (req, res) => {
    try {
      const items = await Inventory.find({ type: 'library' });
      res.status(200).json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Add a new asset
  addAsset: async (req, res) => {
    try {
      const { assetName, category, serialNo, condition, assignedTo, location, status } = req.body;
      const newAsset = new Inventory({
        type: 'asset',
        assetName,
        category,
        serialNo,
        condition,
        assignedTo,
        location,
        status,
      });
      const savedAsset = await newAsset.save();
      res.status(201).json(savedAsset);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all assets
  getAssets: async (req, res) => {
    try {
      const assets = await Inventory.find({ type: 'asset' });
      res.status(200).json(assets);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Add stock
  addStock: async (req, res) => {
    try {
      const { itemName, quantityAvailable, supplierName, purchaseDate, expiryDate } = req.body;
      const newStock = new Inventory({
        type: 'stock',
        itemName,
        quantityAvailable,
        supplierName,
        purchaseDate,
        expiryDate,
        minimumStockLevel: 10, // Default value, can be adjusted
      });
      const savedStock = await newStock.save();
      res.status(201).json(savedStock);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Get all stock items
  getStock: async (req, res) => {
    try {
      const stock = await Inventory.find({ type: 'stock' });
      res.status(200).json(stock);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update stock quantity
  updateStock: async (req, res) => {
    try {
      const { itemName } = req.params;
      const { quantityAvailable } = req.body;
      const updatedStock = await Inventory.findOneAndUpdate(
        { itemName, type: 'stock' },
        { quantityAvailable },
        { new: true }
      );
      if (!updatedStock) return res.status(404).json({ error: 'Stock item not found' });
      res.status(200).json(updatedStock);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },
};

module.exports = inventoryController;