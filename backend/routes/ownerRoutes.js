const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


// Apply auth and owner role check middleware to all routes
router.use(auth, roleCheck(['owner']));

// School registration and management
router.post('/schools/register',upload.single('logo'), ownerController.registerSchool);

router.get('/schools', ownerController.getAllSchools);
router.get('/schools/:schoolId', ownerController.getSchoolData);
router.patch('/schools/:schoolId/subscription', ownerController.updateSubscription);
router.patch('/schools/:schoolId/admin', ownerController.updateAdminCredentials);
router.patch('/schools/:schoolId/payment-config', ownerController.updatePaymentConfig); // New route
router.get('/school-admins', roleCheck(['owner', 'admin']), ownerController.getSchoolAdmins);
// Consolidated reports
router.get('/reports/consolidated', ownerController.getConsolidatedReports);


module.exports = router;