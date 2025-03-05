const express = require('express');
const router = express.Router();
const clerkController = require('../controllers/clerkController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Apply clerk authentication middleware to all routes
router.use(auth, roleCheck(['clerk']));


router.get('/applications/pending-verification',clerkController.getPendingVerifications);

// Admission routes
// router.post('/admission/:schoolId', clerkController.processAdmission);
router.put('/verify/:applicationId',clerkController.clerkVerification);
router.get('/classes/available',clerkController.getAvailableClasses);
router.post('/enroll/:applicationId', clerkController.enrollStudent);
// router.post('/enroll', clerkController.enrollStudent);
router.put('/verify-documents/:studentId', clerkController.verifyDocuments);
// router.put('/confirm-admission/:studentId', clerkController.confirmAdmission);

router.get('/students/class/:classId', clerkController.getStudentsByClass);

// Certificate routes
router.post('/certificate/:studentId', clerkController.generateCertificate);

// RTE report routes
router.post('/rte-report/:schoolId', clerkController.generateRTEReport);

router.get('/application/:applicationId/documents', clerkController.viewApplicationDocuments);

module.exports = router;