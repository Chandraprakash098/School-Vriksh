const express = require('express');
const router = express.Router();
const clerkController = require('../controllers/clerkController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Apply clerk authentication middleware to all routes
router.use(auth, roleCheck(['clerk']));

// Admission routes
router.post('/admission/:schoolId', clerkController.processAdmission);
router.put('/verify-documents/:studentId', clerkController.verifyDocuments);
router.put('/confirm-admission/:studentId', clerkController.confirmAdmission);

// Certificate routes
router.post('/certificate/:studentId', clerkController.generateCertificate);

// RTE report routes
router.post('/rte-report/:schoolId', clerkController.generateRTEReport);

module.exports = router;