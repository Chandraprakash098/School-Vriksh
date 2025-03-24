// const express = require('express');
// const router = express.Router();
// const { admissionController, uploadDocuments } = require('../controllers/admissionController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const { connectToDatabase, getOwnerConnection } = require('../config/database');


// const setDatabaseConnection = async (req, res, next) => {
//   try {
//     let formUrl;
//     // Check if formUrl is in req.params (GET routes) or req.body (POST routes)
//     if (req.params.formUrl) {
//       formUrl = req.params.formUrl;
//     } else if (req.body.formUrl) {
//       formUrl = req.body.formUrl;
//     } else {
//       return res.status(400).json({ error: 'Form URL is required' });
//     }

//     const [_, schoolId] = formUrl.split('/'); // Extract schoolId from formUrl

//     if (!schoolId || !/^[0-9a-fA-F]{24}$/.test(schoolId)) {
//       return res.status(400).json({ error: 'Invalid school ID in form URL' });
//     }

//     const ownerConnection = await getOwnerConnection();
//     const School = ownerConnection.model('School', require('../models/School').schema);
//     const school = await School.findById(schoolId);

//     if (!school || !school.dbName) {
//       return res.status(404).json({ error: 'School not found or database not configured' });
//     }

//     req.connection = await connectToDatabase(school.dbName);
//     next();
//   } catch (error) {
//     console.error('Error setting database connection:', error);
//     res.status(500).json({ error: 'Failed to establish database connection: ' + error.message });
//   }
// };

// // School admin routes
// router.post(
//   '/forms',
//   auth,
//   roleCheck(['admin']),
//   admissionController.createAdmissionForm
// );
// router.get(
//   '/all/forms',
//   auth,
//   roleCheck(['admin']),
//   admissionController.getAllForms
// );
// router.get(
//   '/form/:timestamp',
//   auth,
//   admissionController.getAdmissionForm
// );




// router.get('/payment-details/:formUrl', setDatabaseConnection, admissionController.getPaymentDetails);


// router.post(
//   '/verify-payment',
//   admissionController.verifyPayment
// );

// router.post("/apply", uploadDocuments,setDatabaseConnection, admissionController.submitApplication);




// // Application status check
// router.get(
//   '/status/:trackingId',
//   admissionController.checkApplicationStatus
// );


// router.get(
//   '/forms',
//   auth,
//   roleCheck(['admin']),
//   admissionController.getAllFormsBySchool
// );

// router.put(
//   '/forms/:formId/status',
//   auth,
//   roleCheck(['admin']),
//   admissionController.toggleFormStatus
// );

// // Public routes for form access and submission



// router.get('/validate-form/:formUrl', setDatabaseConnection, admissionController.validateFormUrl);





// // Clerk routes


// // Added: Clerk can get a specific application
// router.get(
//   '/application/:applicationId',
//   auth,
//   roleCheck(['clerk', 'fee_manager']),
//   admissionController.getApplicationById
// );



// // Fees department routes
// router.get(
//   '/applications/pending-fees',
//   auth,
//   roleCheck(['fee_manager']),
//   admissionController.getPendingFeesApplications
// );

// router.put(
//   '/fees-verify/:applicationId',
//   auth,
//   roleCheck(['fee_manager']),
//   admissionController.feesVerification
// );

// // Final admission confirmation


// // Application search and filters for staff
// router.get(
//   '/applications/search',
//   auth,
//   roleCheck(['admin', 'clerk', 'fee_manager']),
//   admissionController.searchApplications
// );



// router.get(
//   '/reports/rte-stats',
//   auth,
//   roleCheck(['admin']),
//   admissionController.getRTEStats
// );


// router.get(
//   '/students/class/:classId',
//   auth,
//   roleCheck(['clerk', 'admin']),
//   admissionController.getStudentsByClass
// );

// module.exports = router;




// const express = require('express');
// const router = express.Router();
// const { admissionController, uploadDocuments } = require('../controllers/admissionController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const { connectToDatabase, getOwnerConnection } = require('../config/database');

// const setDatabaseConnection = async (req, res, next) => {
//   try {
//     let formUrl;
//     if (req.params.formUrl) {
//       formUrl = req.params.formUrl;
//     } else if (req.body.formUrl) {
//       formUrl = req.body.formUrl;
//     } else {
//       return res.status(400).json({ error: 'Form URL is required' });
//     }

//     const [_, schoolId] = formUrl.split('/');
//     if (!schoolId || !/^[0-9a-fA-F]{24}$/.test(schoolId)) {
//       return res.status(400).json({ error: 'Invalid school ID in form URL' });
//     }

//     const ownerConnection = await getOwnerConnection();
//     const School = ownerConnection.model('School', require('../models/School').schema);
//     const school = await School.findById(schoolId);

//     if (!school || !school.dbName) {
//       return res.status(404).json({ error: 'School not found or database not configured' });
//     }

//     req.connection = await connectToDatabase(school.dbName);
//     next();
//   } catch (error) {
//     console.error('Error setting database connection:', error);
//     res.status(500).json({ error: 'Failed to establish database connection: ' + error.message });
//   }
// };

// // School admin routes
// router.post('/forms', auth, roleCheck(['admin']), admissionController.createAdmissionForm);
// router.get('/all/forms', auth, roleCheck(['admin']), admissionController.getAllForms);
// router.get('/form/:timestamp', auth, admissionController.getAdmissionForm);

// router.get('/payment-details/:formUrl', setDatabaseConnection, admissionController.getPaymentDetails);
// router.post('/verify-payment', admissionController.verifyPayment);
// router.post('/apply', uploadDocuments, setDatabaseConnection, admissionController.submitApplication);

// router.get('/status/:trackingId', admissionController.checkApplicationStatus);
// router.get('/forms', auth, roleCheck(['admin']), admissionController.getAllFormsBySchool);
// router.put('/forms/:formId/status', auth, roleCheck(['admin']), admissionController.toggleFormStatus);

// router.get('/validate-form/:formUrl', setDatabaseConnection, admissionController.validateFormUrl);

// router.get('/application/:applicationId', auth, roleCheck(['clerk', 'fee_manager']), admissionController.getApplicationById);

// router.get('/applications/pending-fees', auth, roleCheck(['fee_manager']), admissionController.getPendingFeesApplications);
// router.put('/fees-verify/:applicationId', auth, roleCheck(['fee_manager']), admissionController.feesVerification);

// router.get('/applications/search', auth, roleCheck(['admin', 'clerk', 'fee_manager']), admissionController.searchApplications);
// router.get('/reports/rte-stats', auth, roleCheck(['admin']), admissionController.getRTEStats);
// router.get('/students/class/:classId', auth, roleCheck(['clerk', 'admin']), admissionController.getStudentsByClass);

// module.exports = router;



const express = require('express');
const router = express.Router();
const { admissionController, uploadDocuments } = require('../controllers/admissionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { connectToDatabase, getOwnerConnection } = require('../config/database');

const setDatabaseConnection = async (req, res, next) => {
  try {
    let formUrl;
    if (req.params.formUrl) {
      formUrl = req.params.formUrl;
    } else if (req.body.formUrl) {
      formUrl = req.body.formUrl;
    } else {
      return res.status(400).json({ error: 'Form URL is required' });
    }

    const [_, schoolId] = formUrl.split('/');
    if (!schoolId || !/^[0-9a-fA-F]{24}$/.test(schoolId)) {
      return res.status(400).json({ error: 'Invalid school ID in form URL' });
    }

    const ownerConnection = await getOwnerConnection();
    const School = ownerConnection.model('School', require('../models/School').schema);
    const school = await School.findById(schoolId);

    if (!school || !school.dbName) {
      return res.status(404).json({ error: 'School not found or database not configured' });
    }

    req.connection = await connectToDatabase(school.dbName);
    next();
  } catch (error) {
    console.error('Error setting database connection:', error);
    res.status(500).json({ error: 'Failed to establish database connection: ' + error.message });
  }
};

router.post('/forms', auth, roleCheck(['admin']), admissionController.createAdmissionForm);
router.get('/all/forms', auth, roleCheck(['admin']), admissionController.getAllForms);
router.get('/form/:timestamp', auth, admissionController.getAdmissionForm);

router.get('/payment-details/:formUrl', setDatabaseConnection, admissionController.getPaymentDetails);
router.post('/verify-payment', admissionController.verifyPayment);
router.post('/apply', uploadDocuments, setDatabaseConnection, admissionController.submitApplication);

router.get('/status/:trackingId', admissionController.checkApplicationStatus);
router.get('/forms', auth, roleCheck(['admin']), admissionController.getAllFormsBySchool);
router.put('/forms/:formId/status', auth, roleCheck(['admin']), admissionController.toggleFormStatus);

router.get('/validate-form/:formUrl', setDatabaseConnection, admissionController.validateFormUrl);

router.get('/application/:applicationId', auth, roleCheck(['clerk', 'fee_manager']), admissionController.getApplicationById);

router.get('/applications/pending-fees', auth, roleCheck(['fee_manager']), admissionController.getPendingFeesApplications);
router.put('/fees-verify/:applicationId', auth, roleCheck(['fee_manager']), admissionController.feesVerification);

router.get('/applications/search', auth, roleCheck(['admin', 'clerk', 'fee_manager']), admissionController.searchApplications);
router.get('/reports/rte-stats', auth, roleCheck(['admin']), admissionController.getRTEStats);
router.get('/students/class/:classId', auth, roleCheck(['clerk', 'admin']), admissionController.getStudentsByClass);

module.exports = router;