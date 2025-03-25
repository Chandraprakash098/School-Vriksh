const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
// const { 
//     uploadSchoolLogo, 
//     preserveBodyWithLogo, 
//     handleMulterErrors 
//   } = require('../config/s3Upload');

// Apply auth and owner role check middleware to all routes
router.use(auth, roleCheck(['owner']));

// School registration and management
router.post('/schools/register', ownerController.registerSchool);
// router.post('/schools/register',
//     (req, res, next) => {
//         console.log('Request headers:', req.headers);
//         console.log('Request body (pre-multer):', req.body);
//         next();
//     },
//     uploadSchoolLogo, // Process file upload first
//     (req, res, next) => {
//         console.log('After upload - File:', req.file);
//         console.log('After upload - Body:', req.body);
//         next();
//     },
//     preserveBodyWithLogo, // Process body after file upload
//     handleMulterErrors, // Handle any Multer errors
//     ownerController.registerSchool
// );
router.get('/schools', ownerController.getAllSchools);
router.get('/schools/:schoolId', ownerController.getSchoolData);
router.patch('/schools/:schoolId/subscription', ownerController.updateSubscription);
router.patch('/schools/:schoolId/admin', ownerController.updateAdminCredentials);
router.patch('/schools/:schoolId/payment-config', ownerController.updatePaymentConfig); // New route
router.get('/school-admins', roleCheck(['owner', 'admin']), ownerController.getSchoolAdmins);
// Consolidated reports
router.get('/reports/consolidated', ownerController.getConsolidatedReports);


module.exports = router;