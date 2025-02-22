const express = require('express');
const router = express.Router();
const { admissionController, uploadDocuments } = require('../controllers/admissionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// School admin routes
router.post(
  '/forms',
  auth,
  roleCheck(['admin']),
  admissionController.createAdmissionForm
);
router.get(
  '/all/forms',
  auth,
  roleCheck(['admin']),
  admissionController.getAllForms
);
router.get(
  '/form/:timestamp',
  auth,
  admissionController.getAdmissionForm
);

router.post("/apply", uploadDocuments, admissionController.submitApplication);

// Payment processing
router.post(
  '/payment/:applicationId',
  admissionController.processPayment
);


// Application status check
router.get(
  '/status/:trackingId',
  admissionController.checkApplicationStatus
);


router.get(
  '/forms',
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
  '/validate-form/:formUrl',
  admissionController.validateFormUrl
);





// Clerk routes


// Added: Clerk can get a specific application
router.get(
  '/application/:applicationId',
  auth,
  roleCheck(['clerk', 'fee_manager']),
  admissionController.getApplicationById
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


// Application search and filters for staff
router.get(
  '/applications/search',
  auth,
  roleCheck(['admin', 'clerk', 'fee_manager']),
  admissionController.searchApplications
);



router.get(
  '/reports/rte-stats',
  auth,
  roleCheck(['admin']),
  admissionController.getRTEStats
);


router.get(
  '/students/class/:classId',
  auth,
  roleCheck(['clerk', 'admin']),
  admissionController.getStudentsByClass
);

module.exports = router;