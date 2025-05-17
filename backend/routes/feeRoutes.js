// const express = require("express");
// const router = express.Router();
// const feesController = require("../controllers/feeController");
// const authMiddleware = require("../middleware/auth");

// // Fee manager routes
// // router.get('/class/:className', authMiddleware, feesController.getFeesByClass);
// // router.get('/class/:classId', authMiddleware, feesController.getFeesByClass);
// router.get(
//   "/class/:classId/:month/:year",
//   authMiddleware,
//   feesController.getFeesByClassAndMonth
// );
// router.get(
//   "/student/:grNumber",
//   authMiddleware,
//   feesController.getStudentByGrNumber
// );
// router.post(
//   "/pay-for-student",
//   authMiddleware,
//   feesController.payFeesForStudent
// );

// // New route for fee history
// router.get(
//   "/history/:grNumber",
//   authMiddleware,
//   feesController.getStudentFeeHistory
// );

// router.post("/leave-requests", authMiddleware, feesController.requestLeave);
// router.get("/leave-status", authMiddleware, feesController.getLeaveStatus);
// // Razorpay payment verification (used by both student and fee manager)
// router.post("/verify-payment", authMiddleware, feesController.verifyPayment);
// router.post("/define-fees", authMiddleware, feesController.defineFeesForYear);
// router.get(
//   "/fee-definitions/:year",
//   authMiddleware,
//   feesController.getFeeDefinitionsByYear
// );
// router.put(
//   "/fee-definitions/:year",
//   authMiddleware,
//   feesController.editFeesForYear
// );

// router.get("/classes", authMiddleware, feesController.getAvailableClasses);
// router.get(
//   "/total-earnings",
//   authMiddleware,
//   feesController.getTotalEarningsByYear
// );
// router.get(
//   "/receipt/:paymentId/download",
//   authMiddleware,
//   feesController.downloadReceipt
// );

// // router.get('/school-details', authMiddleware, feesController.getSchoolDetails);




// // New Routes
// // router.post(
// //   "/apply-discount",
// //   authMiddleware,
// //   feesController.applyDiscount
// // );
// // router.post(
// //   "/bulk-assign-fees",
// //   authMiddleware,
// //   feesController.bulkAssignFees
// // );
// // router.get(
// //   "/fee-analytics/:year",
// //   authMiddleware,
// //   feesController.getFeeAnalytics
// // );
// // router.post(
// //   "/configure-late-fee",
// //   authMiddleware,
// //   feesController.configureLateFee
// // );
// // router.get(
// //   "/audit-logs",
// //   authMiddleware,
// //   feesController.getAuditLogs
// // );

// router.get("/school-details", authMiddleware, async (req, res) => {
//   try {
//     if (!req.school) {
//       return res.status(404).json({ message: "School not found" });
//     }

//     let logoUrl = null;
//     if (req.school.logoKey) {
//       const command = new GetObjectCommand({
//         Bucket: process.env.AWS_S3_BUCKET_NAME,
//         Key: req.school.logoKey,
//       });
//       logoUrl = await s3Client.getSignedUrlPromise("getObject", command.params); // Presigned URL
//       // Alternatively, if public access is enabled:
//       // logoUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${req.school.logoKey}`;
//     }

//     res.json({
//       name: req.school.name || "Unknown School",
//       address: req.school.address || "Unknown Address",
//       logoUrl: logoUrl || null, // Include logo URL or null if not set
//     });
//   } catch (error) {
//     console.error("Error fetching school details:", error);
//     res.status(500).json({ error: error.message });
//   }
// });
// module.exports = router;



const express = require("express");
const { body, query,param } = require("express-validator");
const router = express.Router();
const feesController = require("../controllers/feeController");
const authMiddleware = require("../middleware/auth");
const logger = require("../utils/logger");
const { validate, feeValidations, setSchoolContext } = require('../middleware/validate');
const { paymentRateLimiter } = require('../middleware/rateLimit');
const { paytmCallback } = require("../controllers/paytmCallback");
const { generateFeeSlip } = require("../utils/generateFeeSlip");

// Middleware to prevent concurrent payment attempts
const preventConcurrentPayments = async (req, res, next) => {
  try {
    const { grNumber } = req.body.grNumber ? req.body : req.params;
    const connection = req.connection;
    const PaymentModel = require("../models/Payment")(connection);

    const pendingPayment = await PaymentModel.findOne({
      grNumber,
      school: req.school._id,
      status: "pending",
    });

    if (pendingPayment) {
      return res.status(409).json({
        message: "Another payment is currently being processed for this student",
      });
    }

    next();
  } catch (error) {
    logger.error(`Error checking concurrent payments: ${error.message}`, { error });
    res.status(500).json({ error: "Internal server error" });
  }
};

// Fee manager routes


router.get(
  "/class/:classId/:month/:year",
  authMiddleware,
  validate(feeValidations.getFeesByClass),
  feesController.getFeesByClassAndMonth
);



router.get(
  "/student/:grNumber",
  authMiddleware,
  validate(feeValidations.getStudent),
  feesController.getStudentByGrNumber
);



router.post(
  "/pay-for-student",
  authMiddleware,
  paymentRateLimiter,
  preventConcurrentPayments,
  validate(feeValidations.payFees),
  feesController.payFeesForStudent
);

router.put(
  "/student/:grNumber/transport",
  authMiddleware,
  validate([
    param('grNumber').trim().notEmpty().withMessage('GR Number is required'),
    body('isApplicable').isBoolean().withMessage('isApplicable must be a boolean'),
    body('distance')
      .if(body('isApplicable').equals(true))
      .isFloat({ min: 0 }).withMessage('Distance must be a positive number'),
    body('distanceSlab')
      .if(body('isApplicable').equals(true))
      .isIn(['0-10km', '10-20km', '20-30km', '30+km'])
      .withMessage('Invalid distance slab'),
  ]),
  async (req, res) => {
    try {
      const { grNumber } = req.params;
      const { isApplicable, distance, distanceSlab } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = require("../models/User")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can update transport details",
        });
      }

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      });

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      student.studentDetails.transportDetails = {
        isApplicable,
        distance: isApplicable ? distance : null,
        distanceSlab: isApplicable ? distanceSlab : null,
      };

      await student.save();
      logger.info(`Transport details updated for student ${grNumber}`);

      res.json({
        message: "Transport details updated successfully",
        transportDetails: student.studentDetails.transportDetails,
      });
    } catch (error) {
      logger.error(`Error updating transport details: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  }
);

router.get(
  "/history/:grNumber",
  authMiddleware,
  feesController.getStudentFeeHistory
);

router.post("/leave-requests", authMiddleware, feesController.requestLeave);

router.get("/leave-status", authMiddleware, feesController.getLeaveStatus);

// router.post(
//   "/webhooks/razorpay",
//   feesController.webhookHandler
// );

// router.get(
//   '/awaiting-verification-payments',
//   authMiddleware,
//   feesController.getAwaitingVerificationPayments
// );

router.post(
  "/verify-payment",
  authMiddleware,
  paymentRateLimiter,
  preventConcurrentPayments,
  feesController.verifyPayment
);
router.get('/pending/verification', authMiddleware,feesController.getPendingPaymentsFor);
router.post('/paytm/callback',setSchoolContext, paytmCallback);

router.get(
  "/audit-logs",
  authMiddleware,
  validate([
    query('startDate').optional().isISO8601().toDate().withMessage('startDate must be a valid ISO 8601 date'),
    query('endDate').optional().isISO8601().toDate().withMessage('endDate must be a valid ISO 8601 date'),
    query('action').optional().isIn([
      "DEFINE_FEES",
      "EDIT_FEES",
      "PAY_FEES",
      "VERIFY_PAYMENT",
      "REFUND_PAYMENT",
      "DOWNLOAD_RECEIPT",
    ]).withMessage('Invalid action type'),
  ]),
  feesController.getAuditLogs
);


router.post(
  "/define-fees",
  authMiddleware,
  validate(feeValidations.defineFees),
  feesController.defineFeesForYear
);

router.post(
  "/refund-payment",
  authMiddleware,
  validate([
    body('paymentId').isMongoId().withMessage('Invalid payment ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
  ]),
  feesController.refundPayment
);

router.get(
  "/fee-definitions/:year",
  authMiddleware,
  feesController.getFeeDefinitionsByYear
);

router.put(
  "/fee-definitions/:year",
  authMiddleware,
  feesController.editFeesForYear
);

// router.get("/classes", authMiddleware, feesController.getAvailableClasses);

router.get(
  "/classes",
  authMiddleware,
  validate(feeValidations.getAvailableClasses),
  feesController.getAvailableClasses
);

router.get(
  "/total-earnings",
  authMiddleware,
  feesController.getTotalEarningsByYear
);

router.get(
  "/receipt/:paymentId/download",
  authMiddleware,
  feesController.downloadReceipt
);




router.get(
  '/fee-slip/:paymentId',
  authMiddleware,
  validate([
    param('paymentId').isMongoId().withMessage('Invalid payment ID'),
  ]),
  async (req, res) => {
    try {
      const { paymentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = require('../models/Payment')(connection);
      const ClassModel= require('../models/Class')(connection)

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: 'Unauthorized: Only fee managers can view fee slips',
        });
      }

      // Populate student and nested class field
      const payment = await PaymentModel.findOne({
        _id: paymentId,
        school: schoolId,
        status: 'completed',
      }).populate({
        path: 'student',
        select: 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails email',
        populate: {
          path: 'studentDetails.class',
          select: 'name division',
        },
      });

      if (!payment) {
        return res.status(404).json({
          message: 'Payment not found or not completed',
        });
      }

      const feeSlipData = await generateFeeSlip(
        payment.student,
        payment,
        payment.feesPaid,
        schoolId,
        `${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`
      );

      res.json({
        message: 'Fee slip data retrieved successfully',
        data: feeSlipData,
      });
    } catch (error) {
      logger.error(`Error fetching fee slip data: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/pending-payments", authMiddleware, feesController.getPendingPayments);



router.get("/school-details", authMiddleware, async (req, res) => {
  try {
    if (!req.school) {
      return res.status(404).json({ message: "School not found" });
    }

    let logoUrl = null;
    if (req.school.logoKey) {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: req.school.logoKey,
      });
      logoUrl = await s3Client.getSignedUrlPromise("getObject", command);
    }

    res.json({
      name: req.school.name || "Unknown School",
      address: req.school.address || "Unknown Address",
      logoUrl: logoUrl || null,
    });
  } catch (error) {
    logger.error(`Error fetching school details: ${error.message}`, { error });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

module.exports = router;