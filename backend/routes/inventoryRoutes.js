const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require("../middleware/auth");

// Middleware to ensure only authorized roles can access inventory routes
// router.use(authenticateToken);
// router.use(authorizeRoles(['admin', 'inventory_manager', 'clerk']));

// Asset Management
router.post('/assets', authMiddleware, inventoryController.createAsset);
router.get('/assets',authMiddleware, inventoryController.getAssets);
router.get('/assets/:id', authMiddleware,inventoryController.getAssetById);
router.put('/assets/:id', authMiddleware, inventoryController.updateAsset);
router.delete('/assets/:id', authMiddleware, inventoryController.deleteAsset);
router.post('/assets/:id/check-in-out', authMiddleware, inventoryController.checkInOutAsset);

// Stock Management
router.post('/stocks', authMiddleware, inventoryController.createStock);
router.get('/stocks', authMiddleware, inventoryController.getStocks);
router.get('/stocks/:id',authMiddleware, inventoryController.getStockById);
router.put('/stocks/:id', authMiddleware, inventoryController.updateStock);
router.delete('/stocks/:id', authMiddleware, inventoryController.deleteStock);
router.post('/stocks/:id/use', authMiddleware, inventoryController.useStock);

// Procurement
router.post('/procurements', authMiddleware, inventoryController.createProcurement);
router.get('/procurements', authMiddleware, inventoryController.getProcurements);
router.get('/procurements/:id', authMiddleware, inventoryController.getProcurementById);
router.put('/procurements/:id/approve', authMiddleware, inventoryController.approveProcurement);
router.put('/procurements/:id/update-status', authMiddleware, inventoryController.updateProcurementStatus);

// Maintenance
router.post('/maintenances', authMiddleware, inventoryController.createMaintenance);
router.get('/maintenances', authMiddleware, inventoryController.getMaintenances);
router.get('/maintenances/:id', authMiddleware, inventoryController.getMaintenanceById);
router.put('/maintenances/:id', authMiddleware, inventoryController.updateMaintenance);

// Vendor
router.post('/vendors', authMiddleware, inventoryController.createVendor);
router.get('/vendors', authMiddleware, inventoryController.getVendors);
router.get('/vendors/:id', authMiddleware, inventoryController.getVendorById);
router.put('/vendors/:id', authMiddleware, inventoryController.updateVendor);
router.delete('/vendors/:id', authMiddleware, inventoryController.deleteVendor);

// Post Tracking
router.post('/posts', authMiddleware, inventoryController.createPost);
router.get('/posts', authMiddleware, inventoryController.getPosts);
router.get('/posts/:id', authMiddleware, inventoryController.getPostById);

// Budget
router.post('/budgets', authMiddleware, inventoryController.createBudget);
router.get('/budgets', authMiddleware, inventoryController.getBudgets);
router.get('/budgets/:id', authMiddleware,  inventoryController.getBudgetById);
router.put('/budgets/:id', authMiddleware, inventoryController.updateBudget);

// Issues
router.post('/issues', authMiddleware, inventoryController.createIssue);
router.get('/issues', authMiddleware,  inventoryController.getIssues);
router.get('/issues/:id', authMiddleware, inventoryController.getIssueById);
router.put('/issues/:id/resolve', authMiddleware, inventoryController.resolveIssue);

// Reports
router.get('/reports/asset-register', authMiddleware, inventoryController.generateAssetRegisterReport);
router.get('/reports/stock-usage',authMiddleware, inventoryController.generateStockUsageReport);
router.get('/reports/low-stock', authMiddleware, inventoryController.generateLowStockReport);
router.get('/reports/maintenance-due', authMiddleware, inventoryController.generateMaintenanceDueReport);
router.get('/reports/budget', authMiddleware, inventoryController.generateBudgetReport);

// Analytics
router.get('/analytics/dashboard', authMiddleware, inventoryController.getDashboardAnalytics);

// Barcode/QR Scanning
router.post('/scan', authMiddleware, inventoryController.scanItem);

module.exports = router;