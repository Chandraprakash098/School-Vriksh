const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Validation errors', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    next();
  };
};

const VALID_TRANSPORTATION_SLABS = ['0-10km', '10-20km', '20-30km', '30+km'];

const feeValidations = {
  defineFees: [
    body('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
    body('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('classIds').isArray({ min: 1 }).withMessage('classIds must be a non-empty array'),
    body('classIds.*').isMongoId().withMessage('Each classId must be a valid MongoDB ObjectId'),
    body('feeTypes').isArray({ min: 1 }).withMessage('feeTypes must be a non-empty array'),
    body('feeTypes.*.type')
      .isIn(['school', 'computer', 'transportation', 'examination', 'classroom', 'educational', 'library','sport'])
      .withMessage('Invalid fee type'),
    body('feeTypes.*.amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('feeTypes.*.description').optional().isString().trim().withMessage('Description must be a string'),
    body('feeTypes.*.dueDate').optional().isISO8601().toDate().withMessage('dueDate must be a valid ISO 8601 date'),
    body('feeTypes.*.transportationDetails')
      .if(body('feeTypes.*.type').equals('transportation'))
      .isObject()
      .withMessage('transportationDetails must be an object for transportation fees'),
    body('feeTypes.*.transportationDetails.distanceSlab')
      .if(body('feeTypes.*.type').equals('transportation'))
      .isIn(VALID_TRANSPORTATION_SLABS)
      .withMessage('Invalid transportation slab'),
    body('feeTypes.*.transportationDetails.isApplicable')
      .if(body('feeTypes.*.type').equals('transportation'))
      .isBoolean()
      .withMessage('isApplicable must be a boolean'),

      body('feeTypes')
      .custom((feeTypes) => {
        const transportationFees = feeTypes.filter(fee => fee.type === 'transportation');
        const slabs = transportationFees.map(fee => fee.transportationDetails?.distanceSlab);
        const uniqueSlabs = new Set(slabs);
        if (slabs.length !== uniqueSlabs.size) {
          throw new Error('Duplicate transportation distance slabs are not allowed');
        }
        return true;
      }),
  ],
  editFees: [
    body('year').isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
    body('applyToAllMonths').optional().isBoolean().withMessage('applyToAllMonths must be a boolean'),
    body('classIds').isArray({ min: 1 }).withMessage('classIds must be a non-empty array'),
    body('classIds.*').isMongoId().withMessage('Each classId must be a valid MongoDB ObjectId'),
    body('feeUpdates').isArray({ min: 1 }).withMessage('feeUpdates must be a non-empty array'),
    body('feeUpdates.*.type')
      .isIn(['school', 'computer', 'transportation', 'examination', 'classroom', 'educational', 'library'])
      .withMessage('Invalid fee type'),
    body('feeUpdates.*.amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('feeUpdates.*.description').optional().isString().trim().withMessage('Description must be a string'),
    body('feeUpdates.*.months')
      .custom((value, { req }) => {
        if (!req.body.applyToAllMonths) {
          if (!Array.isArray(value)) {
            throw new Error('Months must be an array');
          }
          for (let month of value) {
            if (typeof month !== 'number' || month < 1 || month > 12) {
              throw new Error('Each month must be between 1 and 12');
            }
          }
        }
        return true;
      }),
    body('feeUpdates.*.transportationSlab')
      .if(body('feeUpdates.*.type').equals('transportation'))
      .isIn(VALID_TRANSPORTATION_SLABS)
      .withMessage('Invalid transportation slab'),
  ],
  payFees: [
    body('grNumber').trim().notEmpty().withMessage('GR Number is required'),
    body('totalAmount').isFloat({ min: 0 }).withMessage('Total amount must be a positive number'),
    body('paymentMethod').isIn(['cash', 'online', 'card', 'upi']).withMessage('Invalid payment method'),
    body('selectedFees').isArray().withMessage('Selected fees must be an array'),
    body('selectedFees.*.year').isInt().toInt().withMessage('Year must be an integer'),
    body('selectedFees.*.month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('selectedFees.*.types').isArray().withMessage('Types must be an array'),
    body('selectedFees.*.types.*')
      .isIn(['school', 'computer', 'transportation', 'examination', 'classroom', 'educational', 'library'])
      .withMessage('Invalid fee type'),
    body('selectedFees.*.amounts').optional().isArray().withMessage('Amounts must be an array'),
    body('selectedFees.*.amounts.*').optional().isFloat({ min: 0 }).withMessage('Each amount must be a positive number'),
  ],
  getFeesByClass: [
    param('classId').isMongoId().withMessage('Invalid class ID'),
    param('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    param('year').isInt().toInt().withMessage('Year must be an integer'),
  ],
  getStudent: [
    param('grNumber').trim().notEmpty().withMessage('GR Number is required'),
  ],
  getFeeDefinitions: [
    param('year').isInt().toInt().withMessage('Year must be an integer'),
    query('classId').optional().isMongoId().withMessage('Invalid class ID'),
  ],
  getAvailableClasses: [
    query('academicYear')
      .optional()
      .matches(/^\d{4}-\d{4}$/)
      .withMessage('academicYear must be in the format YYYY-YYYY (e.g., 2024-2025)'),
    query('name')
      .optional()
      .isString()
      .trim()
      .matches(/^\d+$/)
      .withMessage('name must be a string of digits (e.g., 1, 10)'),
    query('division')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1 })
      .matches(/[A-Z]/)
      .withMessage('division must be a single uppercase letter (e.g., A, B)'),
  ],

  verifyPayment: [
    body('razorpay_payment_id').trim().notEmpty().withMessage('Razorpay payment ID is required'),
    body('razorpay_order_id').trim().notEmpty().withMessage('Razorpay order ID is required'),
    body('razorpay_signature').optional().trim().notEmpty().withMessage('Razorpay signature cannot be empty if provided'),
  ],
};

const studentFeeValidations = {
  getFeeTypes: [
    param('studentId').isMongoId().withMessage('Invalid student ID'),
    query('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    query('year').isInt().toInt().withMessage('Year must be an integer'),
  ],
  payFeesByType: [
    param('studentId').isMongoId().withMessage('Invalid student ID'),
    body('feeTypes').isArray().withMessage('feeTypes must be an array'),
    body('feeTypes.*')
      .isIn(['school', 'computer', 'transportation', 'examination', 'classroom', 'educational', 'library'])
      .withMessage('Invalid fee type'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt().toInt().withMessage('Year must be an integer'),
    body('paymentMethod').isIn(['online', 'card', 'upi']).withMessage('Invalid payment method'),
    body('amounts').optional().isArray().withMessage('Amounts must be an array'),
    body('amounts.*').optional().isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  ],
  getFeeReceipts: [
    param('studentId').isMongoId().withMessage('Invalid student ID'),
  ],
  getStudentFeeStatus: [
    param('studentId').isMongoId().withMessage('Invalid student ID'),
  ],
};

module.exports = { validate, feeValidations, studentFeeValidations };
