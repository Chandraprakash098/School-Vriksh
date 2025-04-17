const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck');

// router.post(
//   '/:schoolId/items',
//   [auth, roleCheck(['inventory_manager', 'admin']), schoolCheck],
//   inventoryController.addItem
// );

// router.put(
//   '/items/:itemId',
//   [auth, roleCheck(['inventory_manager']), schoolCheck],
//   inventoryController.updateStock
// );

// router.get(
//   '/:schoolId/low-stock',
//   [auth, roleCheck(['inventory_manager', 'admin']), schoolCheck],
//   inventoryController.getLowStockItems
// );

module.exports = router;