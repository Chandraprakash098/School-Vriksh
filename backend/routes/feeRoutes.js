// const express = require('express');
// const router = express.Router();
// const feesController = require('../controllers/feeController');
// const authMiddleware = require('../middleware/auth');

// // Student routes
// router.get('/student/:studentId', authMiddleware, feesController.getStudentFees);

// // Fee manager routes
// router.get('/gr/:grNumber', authMiddleware, feesController.getFeesByGRNumber);
// router.post('/pay', authMiddleware, feesController.payFees);

// // Razorpay payment verification (used by both student and fee manager)
// router.post('/verify-payment', authMiddleware, feesController.verifyPayment);

// module.exports = router;


const express = require('express');
const router = express.Router();
const feesController = require('../controllers/feeController');
const authMiddleware = require('../middleware/auth');

// Fee manager routes
// router.get('/class/:className', authMiddleware, feesController.getFeesByClass);
// router.get('/class/:classId', authMiddleware, feesController.getFeesByClass);
router.get('/class/:classId/:month/:year', authMiddleware, feesController.getFeesByClassAndMonth);
router.get('/student/:grNumber', authMiddleware, feesController.getStudentByGrNumber);
router.post('/pay-for-student', authMiddleware, feesController.payFeesForStudent);

// New route for fee history
router.get('/history/:grNumber', authMiddleware, feesController.getStudentFeeHistory);

// Razorpay payment verification (used by both student and fee manager)
router.post('/verify-payment', authMiddleware, feesController.verifyPayment);
router.post('/define-fees', authMiddleware, feesController.defineFeesForYear);
router.get('/fee-definitions/:year', authMiddleware, feesController.getFeeDefinitionsByYear);
router.put('/fee-definitions/:year', authMiddleware, feesController.editFeesForYear);

router.get('/classes', authMiddleware, feesController.getAvailableClasses);
router.get('/total-earnings', authMiddleware, feesController.getTotalEarningsByYear);
router.get('/receipt/:paymentId/download', authMiddleware, feesController.downloadReceipt);

// router.get('/school-details', authMiddleware, feesController.getSchoolDetails);

router.get('/school-details', authMiddleware, async (req, res) => {
    try {
      if (!req.school) {
        return res.status(404).json({ message: 'School not found' });
      }
  
      res.json({
        name: req.school.name || 'Unknown School',
        address: req.school.address || 'Unknown Address'
      });
    } catch (error) {
      console.error('Error fetching school details:', error);
      res.status(500).json({ error: error.message });
    }
  });
module.exports = router;