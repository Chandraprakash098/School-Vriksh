const express = require('express');
const router = express.Router();
// const clerkController = require('../controllers/clerkController');
const { clerkController} = require('../controllers/clerkController');
const {upload,announcementUpload, certificateUpload, uploadCertificateToCloudinary } = require('../config/cloudinary');
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

router.post(
    '/leave-requests',
    clerkController.requestLeave
  );
  
  router.get(
    '/leave-status',
    clerkController.getLeaveStatus
  );

  router.get('/certificates/pending', clerkController.getPendingCertificates);
  router.get('/certificates/history', clerkController.getCertificateHistory);

// Certificate routes
// router.post('/certificate/:studentId', clerkController.generateCertificate);
router.post('/certificates/:certificateId/generate', clerkController.generateCertificate);
// router.post('/certificates/:certificateId/upload-signed', upload.single('file'), clerkController.uploadSignedCertificate);
router.post('/certificates/:certificateId/upload-signed', certificateUpload.single('file'), clerkController.uploadSignedCertificate);
router.post('/certificates/:certificateId/send-to-student', clerkController.sendCertificateToStudent);


// RTE report routes
router.post('/rte-report/:schoolId', clerkController.generateRTEReport);

router.get('/application/:applicationId/documents', clerkController.viewApplicationDocuments);

router.post('/register-existing-student', clerkController.registerExistingStudent);
module.exports = router;