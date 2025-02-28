const express = require('express');
const router = express.Router();
const { admissionController, uploadDocuments } = require('../controllers/admissionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { connectToDatabase, getOwnerConnection } = require('../config/database');


// Middleware to set database connection for public routes
const setDatabaseConnection = async (req, res, next) => {
  try {
    const { formUrl } = req.params;
    const [_, schoolId] = formUrl.split('/'); // Extract schoolId from formUrl (e.g., "admission/67c1526fc056c832dbc5263e/1740730641073")

    if (!schoolId || !/^[0-9a-fA-F]{24}$/.test(schoolId)) {
      return res.status(400).json({ error: 'Invalid school ID in form URL' });
    }

    // Get the school from the owner database
    const ownerConnection = await getOwnerConnection();
    const School = ownerConnection.model('School', require('../models/School').schema);
    const school = await School.findById(schoolId);

    if (!school || !school.dbName) {
      return res.status(404).json({ error: 'School not found or database not configured' });
    }

    // Set the Mongoose connection for the school's database
    req.connection = await connectToDatabase(school.dbName);
    next();
  } catch (error) {
    console.error('Error setting database connection:', error);
    res.status(500).json({ error: 'Failed to establish database connection: ' + error.message });
  }
};

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


// router.get(
//   '/payment-details/:formUrl',
//   admissionController.getPaymentDetails
// );

router.get('/payment-details/:formUrl', setDatabaseConnection, admissionController.getPaymentDetails);

// router.get(
//   '/payment-qr/:applicationId',
//   admissionController.generatePaymentQR
// );

router.post(
  '/verify-payment',
  admissionController.verifyPayment
);

router.post("/apply", uploadDocuments, admissionController.submitApplication);

// Payment processing
// router.post(
//   '/payment/:applicationId',
//   admissionController.processPayment
// );


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


// router.get(
//   '/validate-form/:formUrl',
//   admissionController.validateFormUrl
// );

router.get('/validate-form/:formUrl', setDatabaseConnection, admissionController.validateFormUrl);





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