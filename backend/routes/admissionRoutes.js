// const express = require('express');
// const router = express.Router();
// const admissionController = require('../controllers/admissionController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');

// // School admin routes
// router.post(
//   '/forms/:schoolId',
//   auth,
//   roleCheck(['admin']),
//   admissionController.createAdmissionForm
// );

// router.get(
//     '/form/:schoolId/:timestamp',
//     admissionController.getAdmissionForm
//   );
  
//   router.get(
//     '/validate-form/:formUrl',
//     admissionController.validateFormUrl
//   );

// // Public routes
// router.post(
//   '/apply/:schoolId',
//   admissionController.submitApplication
// );

// router.post(
//   '/payment/:applicationId',
//   admissionController.processPayment
// );

// // Clerk routes
// router.put(
//   '/verify/:applicationId',
//   auth,
//   roleCheck(['clerk']),
//   admissionController.clerkVerification
// );

// // Fees department routes
// router.put(
//   '/fees-verify/:applicationId',
//   auth,
//   roleCheck(['fee_manager']),
//   admissionController.feesVerification
// );

// router.put(
//   '/confirm/:applicationId',
//   auth,
//   roleCheck(['clerk']),
//   admissionController.confirmAdmission
// );

// module.exports = router;
const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/admissionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// School admin routes
router.post(
  '/forms/:schoolId',
  auth,
  roleCheck(['admin']),
  admissionController.createAdmissionForm
);

router.get(
  '/forms/:schoolId',
  auth,
  roleCheck(['admin']),
  admissionController.getAllFormsBySchool
);

router.put(
  '/forms/:formId/status',
  auth,
  roleCheck(['admin']),
  admissionController.toggleFormStatus
);

// Public routes for form access and submission
router.get(
  '/form/:schoolId/:timestamp',
  admissionController.getAdmissionForm
);

router.get(
  '/validate-form/:formUrl',
  admissionController.validateFormUrl
);

// Application submission route
router.post(
  '/apply/:schoolId',
  admissionController.submitApplication
);

// Application status check
router.get(
  '/status/:trackingId',
  admissionController.checkApplicationStatus
);

// Payment processing
router.post(
  '/payment/:applicationId',
  admissionController.processPayment
);

// Clerk routes
router.get(
  '/applications/pending-verification',
  auth,
  roleCheck(['clerk']),
  admissionController.getPendingVerifications
);

// Added: Clerk can get a specific application
router.get(
  '/application/:applicationId',
  auth,
  roleCheck(['clerk', 'fee_manager']),
  admissionController.getApplicationById
);

router.put(
  '/verify/:applicationId',
  auth,
  roleCheck(['clerk']),
  admissionController.clerkVerification
);

// Fees department routes
router.get(
  '/applications/pending-fees',
  auth,
  roleCheck(['fee_manager']),
  admissionController.getPendingFeesApplications
);

router.put(
  '/fees-verify/:applicationId',
  auth,
  roleCheck(['fee_manager']),
  admissionController.feesVerification
);

// Final admission confirmation
router.put(
  '/confirm/:applicationId',
  auth,
  roleCheck(['clerk']),
  admissionController.confirmAdmission
);

// Application search and filters for staff
router.get(
  '/applications/search',
  auth,
  roleCheck(['admin', 'clerk', 'fee_manager']),
  admissionController.searchApplications
);

// Reports and analytics for admin
router.get(
  '/reports/admissions/:schoolId',
  auth,
  roleCheck(['admin']),
  admissionController.getAdmissionReports
);

router.get(
  '/reports/rte-stats/:schoolId',
  auth,
  roleCheck(['admin']),
  admissionController.getRTEStats
);

module.exports = router;