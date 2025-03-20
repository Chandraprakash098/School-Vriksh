// const AdmissionForm = require('../models/AdmissionForm');
// const AdmissionApplication = require('../models/AdmissionApplication');



// const feesController = {
//     getPendingFees: async (req, res) => {
//       try {
//         const applications = await AdmissionApplication.find({
//           status: 'fees_pending',
//           admissionType: 'Regular',
//           paymentStatus: 'completed',
//           'feesVerification.status': 'pending'
//         }).sort({ createdAt: -1 });
        
//         res.json({
//           status: 'success',
//           applications: applications.map(app => ({
//             id: app._id,
//             trackingId: app.trackingId,
//             studentName: app.studentDetails.name,
//             paymentDetails: app.paymentDetails
//           }))
//         });
//       } catch (error) {
//         res.status(500).json({ error: error.message });
//       }
//     },
  
//     verifyFees: async (req, res) => {
//       try {
//         const { applicationId } = req.params;
//         const { status, receiptNumber } = req.body;
  
//         const application = await AdmissionApplication.findById(applicationId);
        
//         application.feesVerification = {
//           status,
//           verifiedBy: req.user._id,
//           verifiedAt: new Date(),
//           receiptNumber
//         };
  
//         application.status = status === 'verified' ? 'approved' : 'rejected';
//         await application.save();
  
//         res.json({
//           message: 'Fees verification completed',
//           nextStep: getNextStep(application)
//         });
//       } catch (error) {
//         res.status(500).json({ error: error.message });
//       }
//     }
//   };
  
//   // Helper Functions
//   function getNextStep(application) {
//     switch(application.status) {
//       case 'pending':
//         return application.admissionType === 'RTE' ? 
//           'Visit clerk for verification' : 
//           'Complete payment and visit clerk';
//       case 'document_verification':
//         return 'Awaiting document verification';
//       case 'fees_pending':
//         return 'Visit fees department';
//       case 'approved':
//         return 'Return to clerk for enrollment';
//       case 'enrolled':
//         return 'Admission completed';
//       case 'rejected':
//         return 'Application rejected';
//       default:
//         return 'Contact administration';
//     }
//   }
  
//   function getApplicationTimeline(application) {
//     return [
//       {
//         stage: 'Application Submitted',
//         date: application.createdAt,
//         completed: true
//       },
//       {
//         stage: 'Payment',
//         date: application.paymentDetails?.paidAt,
//         completed: application.paymentStatus === 'completed' || 
//                   application.admissionType === 'RTE'
//       },
//       {
//         stage: 'Document Verification',
//         date: application.clerkVerification?.verifiedAt,
//         completed: application.clerkVerification?.status === 'verified'
//       },
//       {
//         stage: 'Fees Verification',
//         date: application.feesVerification?.verifiedAt,
//         completed: application.feesVerification?.status === 'verified' || 
//                   application.admissionType === 'RTE'
//       },
//       {
//         stage: 'Enrollment',
//         date: application.status === 'enrolled' ? new Date() : null,
//         completed: application.status === 'enrolled'
//       }
//     ];
//   }
  
//   function generateAdmissionStats(applications) {
//     return {
//       totalApplications: applications.length,
//       byStatus: {
//         pending: applications.filter(app => app.status === 'pending').length,
//         verified: applications.filter(app => 
//           app.status === 'document_verification').length,
//         feesPending: applications.filter(app => 
//           app.status === 'fees_pending').length,
//         approved: applications.filter(app => app.status === 'approved').length,
//         enrolled: applications.filter(app => app.status === 'enrolled').length,
//         rejected: applications.filter(app => app.status === 'rejected').length
//       },
//       byAdmissionType: {
//         regular: applications.filter(app => 
//           app.admissionType === 'Regular').length,
//         rte: applications.filter(app => app.admissionType === 'RTE').length
//       }
//     };
//   }
  
//   module.exports = {
//     feesController
//   };











const Razorpay = require('razorpay');
const crypto = require('crypto');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');
const { generateFeeSlip } = require('../utils/helpers');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const feesController = {
  defineFeesForYear: async (req, res) => {
    try {
      const { year, feeTypes, overrideExisting = false } = req.body; // Added overrideExisting option
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
  
      // Authorization check
      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ 
          message: 'Unauthorized: Only fee managers can define fees' 
        });
      }
  
      // Input validation
      if (!year || !feeTypes || !Array.isArray(feeTypes)) {
        return res.status(400).json({ 
          message: 'Year and feeTypes array are required' 
        });
      }
  
      if (!Number.isInteger(Number(year))) {
        return res.status(400).json({ 
          message: 'Year must be a valid integer' 
        });
      }
  
      // Valid fee types
      const validFeeTypes = [
        'school', 
        'computer', 
        'transportation', 
        'examination', 
        'classroom', 
        'educational'
      ];
  
      // Validate feeTypes array
      const validationErrors = [];
      feeTypes.forEach((feeType, index) => {
        const { type, amount, description } = feeType;
        
        if (!validFeeTypes.includes(type)) {
          validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
        }
        
        if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
          validationErrors.push(`Invalid amount for ${type} at index ${index}: ${amount}`);
        }
        
        if (description && typeof description !== 'string') {
          validationErrors.push(`Description must be a string for ${type} at index ${index}`);
        }
      });
  
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validationErrors 
        });
      }
  
      // Check existing fees
      const existingFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
      });
  
      if (existingFees.length > 0 && !overrideExisting) {
        return res.status(409).json({ 
          message: `Fees for ${year} are already defined. Use overrideExisting: true to update.` 
        });
      }
  
      // Prepare fee definitions
      const feeDefinitions = [];
      const operations = [];
  
      for (let month = 1; month <= 12; month++) {
        for (const feeType of feeTypes) {
          const { type, amount, description } = feeType;
          const dueDate = new Date(year, month - 1, 28);
          
          const feeData = {
            school: schoolId,
            type,
            amount,
            dueDate,
            month,
            year: parseInt(year),
            description: description || `${type} fee for ${month}/${year}`,
            status: 'pending',
            updatedAt: new Date(),
          };
  
          const existingFee = existingFees.find(f => 
            f.type === type && f.month === month
          );
  
          if (existingFee && overrideExisting) {
            // Update existing fee
            operations.push({
              updateOne: {
                filter: { _id: existingFee._id },
                update: { $set: feeData }
              }
            });
          } else if (!existingFee) {
            // Create new fee
            feeDefinitions.push(new FeeModel(feeData));
          }
        }
      }
  
      // Execute operations
      let createdCount = 0;
      let updatedCount = 0;
  
      if (feeDefinitions.length > 0) {
        const created = await FeeModel.insertMany(feeDefinitions);
        createdCount = created.length;
      }
  
      if (operations.length > 0) {
        const result = await FeeModel.bulkWrite(operations);
        updatedCount = result.modifiedCount;
      }
  
      res.status(201).json({ 
        message: `Fees for ${year} processed successfully`,
        createdCount,
        updatedCount,
        totalProcessed: createdCount + updatedCount
      });
  
    } catch (error) {
      console.error('Error defining fees:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  },

  // getFeeDefinitionsByYear: async (req, res) => {
  //   try {
  //     const { year } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  
  //     if (!req.user.permissions.canManageFees) {
  //       return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fee definitions' });
  //     }
  
  //     const feeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false }, // General fee definitions
  //       year: parseInt(year),
  //     }).sort({ month: 1, type: 1 });
  
  //     if (!feeDefinitions.length) {
  //       return res.status(404).json({ message: `No fee definitions found for ${year}` });
  //     }
  
  //     res.json({
  //       year,
  //       feeDefinitions: feeDefinitions.map(fee => ({
  //         id: fee._id,
  //         type: fee.type,
  //         amount: fee.amount,
  //         month: fee.month,
  //         dueDate: fee.dueDate,
  //         description: fee.description,
  //         status: fee.status,
  //       })),
  //     });
  //   } catch (error) {
  //     console.error('Error fetching fee definitions:', error);
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  getFeeDefinitionsByYear: async (req, res) => {
    try {
      const { year } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
  
      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fee definitions' });
      }
  
      // Validate year
      if (!Number.isInteger(Number(year))) {
        return res.status(400).json({ message: 'Year must be a valid integer' });
      }
  
      // Get all fee definitions for the year
      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        student: { $exists: false }, // General fee definitions
        year: parseInt(year),
      }).sort({ type: 1, month: 1 });
  
      if (!feeDefinitions.length) {
        return res.status(404).json({ message: `No fee definitions found for ${year}` });
      }
  
      // Group fees by type and check if they're consistent across months
      const feeSummary = {};
      const monthlyVariations = {};
  
      feeDefinitions.forEach(fee => {
        if (!feeSummary[fee.type]) {
          feeSummary[fee.type] = {
            amount: fee.amount,
            description: fee.description,
            isConsistent: true,
            monthlyDetails: {}
          };
        }
  
        // Store monthly details
        feeSummary[fee.type].monthlyDetails[fee.month] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: fee.status,
          id: fee._id
        };
  
        // Check if amount varies across months
        if (fee.amount !== feeSummary[fee.type].amount) {
          feeSummary[fee.type].isConsistent = false;
        }
      });
  
      // Format response
      const responseData = {
        year: parseInt(year),
        fees: {}
      };
  
      for (const [type, data] of Object.entries(feeSummary)) {
        if (data.isConsistent) {
          // If fees are consistent across all months, show only yearly data
          responseData.fees[type] = {
            annualAmount: data.amount * 12,
            monthlyAmount: data.amount,
            description: data.description,
            status: Object.values(data.monthlyDetails).every(d => d.status === 'pending') ? 'pending' : 'mixed'
          };
        } else {
          // If fees vary by month, show monthly breakdown
          responseData.fees[type] = {
            annualAmount: Object.values(data.monthlyDetails).reduce((sum, d) => sum + d.amount, 0),
            monthlyBreakdown: data.monthlyDetails
          };
        }
      }
  
      res.json(responseData);
    } catch (error) {
      console.error('Error fetching fee definitions:', error);
      res.status(500).json({ error: error.message });
    }
  },

  editFeesForYear: async (req, res) => {
    try {
      const { year, feeUpdates, applyToAllMonths = true } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
  
      // Authorization check
      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ 
          message: 'Unauthorized: Only fee managers can edit fees' 
        });
      }
  
      // Input validation
      if (!year || !feeUpdates || !Array.isArray(feeUpdates)) {
        return res.status(400).json({ 
          message: 'Year and feeUpdates array are required' 
        });
      }
  
      if (!Number.isInteger(Number(year))) {
        return res.status(400).json({ 
          message: 'Year must be a valid integer' 
        });
      }
  
      // Valid fee types
      const validFeeTypes = [
        'school', 
        'computer', 
        'transportation', 
        'examination', 
        'classroom', 
        'educational'
      ];
  
      // Validate feeUpdates
      const validationErrors = [];
      feeUpdates.forEach((update, index) => {
        const { type, amount, description, months } = update;
  
        if (!validFeeTypes.includes(type)) {
          validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
        }
  
        if (typeof amount !== 'number' || amount <= 0 || !Number.isFinite(amount)) {
          validationErrors.push(`Invalid amount for ${type} at index ${index}: ${amount}`);
        }
  
        if (description && typeof description !== 'string') {
          validationErrors.push(`Description must be a string for ${type} at index ${index}`);
        }
  
        if (!applyToAllMonths && (!months || !Array.isArray(months) || months.some(m => !Number.isInteger(m) || m < 1 || m > 12))) {
          validationErrors.push(`Invalid months array for ${type} at index ${index}`);
        }
      });
  
      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: validationErrors 
        });
      }
  
      // Get existing fees for the year
      const existingFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
      });
  
      if (!existingFees.length) {
        return res.status(404).json({ 
          message: `No fee definitions found for ${year} to edit` 
        });
      }
  
      // Prepare bulk operations
      const operations = [];
  
      for (const update of feeUpdates) {
        const { type, amount, description, months } = update;
        const targetMonths = applyToAllMonths ? Array.from({ length: 12 }, (_, i) => i + 1) : months;
  
        for (const month of targetMonths) {
          const existingFee = existingFees.find(f => f.type === type && f.month === month);
          
          if (existingFee) {
            operations.push({
              updateOne: {
                filter: { _id: existingFee._id },
                update: {
                  $set: {
                    amount,
                    description: description || existingFee.description || `${type} fee for ${month}/${year}`,
                    dueDate: new Date(year, month - 1, 28),
                    updatedAt: new Date()
                  }
                }
              }
            });
          } else {
            // If fee doesn't exist for this month, create it
            operations.push({
              insertOne: {
                document: {
                  school: schoolId,
                  type,
                  amount,
                  dueDate: new Date(year, month - 1, 28),
                  month,
                  year: parseInt(year),
                  description: description || `${type} fee for ${month}/${year}`,
                  status: 'pending',
                  createdAt: new Date(),
                  updatedAt: new Date()
                }
              }
            });
          }
        }
      }
  
      // Execute bulk operations
      const result = await FeeModel.bulkWrite(operations);
  
      res.status(200).json({
        message: `Fees for ${year} updated successfully`,
        updatedCount: result.modifiedCount,
        createdCount: result.insertedCount,
        totalAffected: result.modifiedCount + result.insertedCount
      });
  
    } catch (error) {
      console.error('Error editing fees:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error.message 
      });
    }
  },

  getAvailableClasses: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      const allClasses = await Class.find({ school: schoolId })
        .select('name division academicYear capacity students classTeacher')
        .populate('classTeacher', 'name', User)
        .sort({ name: 1, division: 1 });

      res.json({
        classes: allClasses.map(cls => ({
          _id: cls._id,
          name: cls.name,
          division: cls.division,
          academicYear: cls.academicYear,
          teacher: cls.classTeacher ? cls.classTeacher.name : null,
          enrolledCount: cls.students ? cls.students.length : 0,
          capacity: cls.capacity,
          remainingCapacity: cls.capacity - (cls.students ? cls.students.length : 0),
        })),
      });
    } catch (error) {
      console.error('Error in getAvailableClasses:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getFeesByClassAndMonth: async (req, res) => {
    try {
      const { classId, month, year } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const PaymentModel = Payment(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fees' });
      }

      let objectIdClassId;
      try {
        objectIdClassId = new mongoose.Types.ObjectId(classId);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid class ID format' });
      }

      // Get all students in the class
      const students = await UserModel.find({
        'studentDetails.class': objectIdClassId,
        school: schoolId,
      }).select('_id name studentDetails.grNumber studentDetails.class');

      // Get unique fee definitions for the month/year
      const feeDefinitionsRaw = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        month: parseInt(month),
        year: parseInt(year),
      });

      // Remove duplicates by fee type
      const feeDefinitions = Array.from(
        new Map(feeDefinitionsRaw.map(fee => [fee.type, fee])).values()
      );

      // Get student-specific fee records
      const studentFees = await FeeModel.find({
        student: { $in: students.map(s => s._id) },
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      });

      // Get payment records
      const paymentRecords = await PaymentModel.find({
        student: { $in: students.map(s => s._id) },
        school: schoolId,
        status: 'completed',
        'feesPaid.month': parseInt(month),
        'feesPaid.year': parseInt(year),
      });

      // Create a map of paid fees
      const paidFeesMap = new Map();
      paymentRecords.forEach(payment => {
        payment.feesPaid.forEach(feePaid => {
          if (feePaid.month === parseInt(month) && feePaid.year === parseInt(year)) {
            const key = `${payment.student.toString()}_${feePaid.type}`;
            paidFeesMap.set(key, {
              status: 'paid',
              paymentDate: payment.paymentDate,
            });
          }
        });
      });

      // Process student fee data
      const feeData = students.map(student => {
        const studentSpecificFees = studentFees.filter(fee =>
          fee.student && fee.student.toString() === student._id.toString()
        );

        const feeSummary = {
          studentId: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class,
          fees: {},
          total: 0,
          allPaid: true,
        };

        feeDefinitions.forEach(def => {
          const paidFee = studentSpecificFees.find(f => f.type === def.type);
          const paymentInfo = paidFeesMap.get(`${student._id.toString()}_${def.type}`);

          const status = paidFee ? paidFee.status : (paymentInfo ? paymentInfo.status : 'pending');
          const paidDate = paidFee?.paymentDetails?.paymentDate || (paymentInfo ? paymentInfo.paymentDate : null);

          feeSummary.fees[def.type] = {
            amount: def.amount,
            status,
            paidDate,
          };

          feeSummary.total += def.amount;
          if (status !== 'paid') feeSummary.allPaid = false;
        });

        return feeSummary;
      });

      res.json(feeData);
    } catch (error) {
      console.error('Error in getFeesByClassAndMonth:', error);
      res.status(500).json({ error: error.message });
    }
  },


  getStudentByGrNumber: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection); // Add Payment model to check completed payments
  
      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can view student fees' });
      }
  
      const student = await UserModel.findOne({
        'studentDetails.grNumber': grNumber,
        school: schoolId,
      }).select('_id name studentDetails.grNumber studentDetails.class');
  
      if (!student) return res.status(404).json({ message: 'Student not found' });
      if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });
  
      // Get general fee definitions (school-wide, not student-specific)
      const generalFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
      }).sort({ year: 1, month: 1 });
  
      // Get student-specific fee records (including paid ones)
      const studentFees = await FeeModel.find({
        student: student._id,
        school: schoolId,
      }).sort({ year: 1, month: 1 });
  
      // Get payment records for the student
      const payments = await PaymentModel.find({
        student: student._id,
        school: schoolId,
        status: 'completed',
      });
  
      // Create a map of paid fees from payment records
      const paidFeesMap = new Map();
      payments.forEach(payment => {
        payment.feesPaid.forEach(feePaid => {
          const key = `${feePaid.year}-${feePaid.month}-${feePaid.type}`;
          paidFeesMap.set(key, {
            status: 'paid',
            paymentDetails: {
              transactionId: payment.transactionId || payment.receiptNumber,
              paymentDate: payment.paymentDate,
              paymentMethod: payment.paymentMethod,
              receiptNumber: payment.receiptNumber,
            },
          });
        });
      });
  
      const feeData = {};
  
      // Step 1: Populate feeData with general fee definitions as a baseline
      generalFees.forEach(fee => {
        const key = `${fee.year}-${fee.month}`;
        if (!feeData[key]) {
          feeData[key] = { total: 0, fees: {} };
        }
        feeData[key].fees[fee.type] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: 'pending', // Default status
        };
        feeData[key].total += fee.amount;
      });
  
      // Step 2: Override with student-specific fee records
      studentFees.forEach(fee => {
        const key = `${fee.year}-${fee.month}`;
        if (!feeData[key]) {
          feeData[key] = { total: 0, fees: {} };
        }
        feeData[key].fees[fee.type] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: fee.status,
          ...(fee.paymentDetails && { paymentDetails: fee.paymentDetails }),
        };
        feeData[key].total = Object.values(feeData[key].fees).reduce((sum, f) => sum + f.amount, 0);
      });
  
      // Step 3: Update status based on payment records
      Object.keys(feeData).forEach(key => {
        const [year, month] = key.split('-');
        Object.keys(feeData[key].fees).forEach(type => {
          const paymentKey = `${year}-${month}-${type}`;
          if (paidFeesMap.has(paymentKey)) {
            const paidInfo = paidFeesMap.get(paymentKey);
            feeData[key].fees[type].status = paidInfo.status;
            feeData[key].fees[type].paymentDetails = paidInfo.paymentDetails;
          }
        });
      });
  
      res.json({
        student: {
          _id: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class,
        },
        feeData,
      });
    } catch (error) {
      console.error('Error in getStudentByGrNumber:', error);
      res.status(500).json({ error: error.message });
    }
  },

  payFeesForStudent: async (req, res) => {
    try {
      const { grNumber, selectedFees, totalAmount } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection);
      const UserModel = User(connection);

      if (!grNumber) return res.status(400).json({ message: 'GR Number is required' });
      if (!selectedFees || !Array.isArray(selectedFees) || selectedFees.length === 0)
        return res.status(400).json({ message: 'Selected fees are required and must be an array' });
      if (typeof totalAmount !== 'number' || totalAmount <= 0)
        return res.status(400).json({ message: 'Valid total amount is required' });

      if (!req.user.permissions.canManageFees)
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can process payments' });

      const student = await UserModel.findOne({
        'studentDetails.grNumber': grNumber,
        school: schoolId,
      });
      if (!student) return res.status(404).json({ message: 'Student not found' });
      if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

      const feesToPay = [];
      let calculatedTotal = 0;

      for (const fee of selectedFees) {
        const { year, month, types } = fee;
        if (!year || !month || !types || !Array.isArray(types))
          return res.status(400).json({ message: 'Invalid fee format: year, month, and types are required' });

        const existingFees = await FeeModel.find({
          student: student._id,
          school: schoolId,
          year: parseInt(year),
          month: parseInt(month),
          type: { $in: types },
        });

        const feeDefinitions = await FeeModel.find({
          school: schoolId,
          student: { $exists: false },
          year: parseInt(year),
          month: parseInt(month),
          type: { $in: types },
        });

        // if (feeDefinitions.length !== types.length)
        //   return res.status(404).json({ message: 'Some fee types not defined for this month/year' });

        for (const def of feeDefinitions) {
          const existing = existingFees.find(f => f.type === def.type);
          if (existing && existing.status === 'paid') {
            return res.status(400).json({ message: `Fee type '${def.type}' for ${month}/${year} is already paid` });
          } else if (!existing) {
            const newFee = new FeeModel({
              school: schoolId,
              student: student._id,
              grNumber: student.studentDetails.grNumber,
              type: def.type,
              amount: def.amount,
              dueDate: def.dueDate,
              month: parseInt(month),
              year: parseInt(year),
              status: 'pending',
              description: def.description,
            });
            feesToPay.push(newFee);
            calculatedTotal += def.amount;
          } else if (existing.status === 'pending') {
            feesToPay.push(existing);
            calculatedTotal += existing.amount;
          }
        }
      }

      // if (calculatedTotal !== totalAmount)
      //   return res.status(400).json({
      //     message: 'Payment amount mismatch',
      //     calculatedAmount: calculatedTotal,
      //     providedAmount: totalAmount,
      //   });

      if (feesToPay.length === 0)
        return res.status(400).json({ message: 'No pending fees to pay for the selected types' });

      const receiptNumber = `REC-CASH-${Date.now()}`;
      const payment = new PaymentModel({
        school: schoolId,
        student: student._id,
        grNumber,
        amount: totalAmount,
        paymentMethod: 'cash',
        status: 'completed',
        paymentDate: new Date(),
        receiptNumber,
        feesPaid: feesToPay.map(fee => ({
          feeId: fee._id || null,
          type: fee.type,
          month: fee.month,
          year: fee.year,
          amount: fee.amount,
        })),
      });

      await payment.save();

      const updatePromises = feesToPay.map(fee => {
        fee.status = 'paid';
        fee.paymentDetails = {
          transactionId: receiptNumber,
          paymentDate: new Date(),
          paymentMethod: 'cash',
          receiptNumber,
        };
        return fee.save();
      });

      await Promise.all(updatePromises);

      const feeSlip = await generateFeeSlip(student, payment, feesToPay, schoolId,connection);
      payment.receiptUrl = feeSlip.pdfUrl;//new
      await payment.save();//new one for test


      res.json({
        message: 'Cash payment processed successfully',
        payment,
        paidFees: feesToPay.map(fee => ({
          type: fee.type,
          amount: fee.amount,
          month: fee.month,
          year: fee.year,
        })),
        feeSlip,
        receiptUrl: feeSlip.pdfUrl, // Return the URL for immediate download
      });
    } catch (error) {
      console.error('Payment processing error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  },

 

  verifyPayment: async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid payment signature' });

      const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
      if (!payment) return res.status(404).json({ message: 'Payment not found' });

      payment.status = 'completed';
      payment.transactionId = razorpay_payment_id;
      payment.paymentDate = new Date();
      await payment.save();

      const feeUpdates = payment.feesPaid.map(async feePaid => {
        const fee = await FeeModel.findOne({
          student: payment.student,
          school: schoolId,
          type: feePaid.type,
          month: feePaid.month,
          year: feePaid.year,
        });
        if (fee) {
          fee.status = 'paid';
          fee.paymentDetails = {
            transactionId: razorpay_payment_id,
            paymentDate: new Date(),
            paymentMethod: payment.paymentMethod,
            receiptNumber: `REC${Date.now()}`,
          };
          await fee.save();
        }
      });

      await Promise.all(feeUpdates);

      const student = await UserModel.findById(payment.student);
      const feeSlip = await generateFeeSlip(student, payment, payment.feesPaid, schoolId);
      payment.receiptUrl = feeSlip.pdfUrl;
      await payment.save();

      res.json({ message: 'Payment verified successfully', payment,receiptUrl: feeSlip.pdfUrl, });
    } catch (error) {
      console.error('Error in verifyPayment:', error);
      res.status(500).json({ error: error.message });
    }
  },

  downloadReceipt: async (req, res) => {
    try {
      const { paymentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);

      const payment = await PaymentModel.findOne({ 
        _id: paymentId, 
        school: schoolId,
        status: 'completed'
      }).populate('student', 'name studentDetails.grNumber studentDetails.class');

      if (!payment) {
        return res.status(404).json({ message: 'Payment not found or not completed' });
      }

      if (!payment.receiptUrl) {
        // Regenerate receipt if URL is missing
        const feeSlip = await generateFeeSlip(
          payment.student,
          payment,
          payment.feesPaid,
          schoolId,
          connection
        );
        payment.receiptUrl = feeSlip.pdfUrl;
        await payment.save();
      }

      res.json({
        message: 'Receipt ready for download',
        receiptUrl: payment.receiptUrl,
      });
    } catch (error) {
      console.error('Error downloading receipt:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getTotalEarningsByYear: async (req, res) => {
    try {
      const { year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

      if (!year) return res.status(400).json({ message: 'Year is required' });

      const totalEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: 'completed',
            $expr: { $eq: [{ $year: '$paymentDate' }, parseInt(year)] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      const totalReceived = totalEarnings.length > 0 ? totalEarnings[0].totalAmount : 0;

      const totalFees = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            student: { $exists: false }, // General fee definitions
            year: parseInt(year),
          },
        },
        {
          $group: {
            _id: '$type',
            totalAmount: { $sum: '$amount' },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]);

      const totalDefined = totalFees.length > 0 ? totalFees[0].totalAmount : 0;
      const totalPending = totalDefined - totalReceived;

      const prevYearEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: 'completed',
            $expr: { $eq: [{ $year: '$paymentDate' }, parseInt(year) - 1] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
          },
        },
      ]);

      const prevTotal = prevYearEarnings.length > 0 ? prevYearEarnings[0].totalAmount : 0;
      const growth = totalReceived - prevTotal;

      res.json({
        totalEarning: totalReceived,
        totalReceived,
        totalPending: totalPending >= 0 ? totalPending : 0,
        growth: growth >= 0 ? growth : 0,
      });
    } catch (error) {
      console.error('Error calculating total earnings:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = feesController;








// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');
// const mongoose = require('mongoose');
// const {generateFeeSlip}= require('../utils/helpers')

// // Initialize Razorpay instance
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// // Helper function to validate fee types
// const validFeeTypes = ['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'];
// const validateFeeType = (type) => validFeeTypes.includes(type);

// // Optimized Fees Controller
// const feesController = {
//   // Define fees for a year by month (Fee Manager only)
//   defineFeesForYear: async (req, res) => {
//     try {
//       const { year, feeTypes } = req.body; // feeTypes: [{type, amount, description}]
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       // Authorization check
//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({ message: 'Unauthorized: Only fee managers can define fees' });
//       }

//       // Input validation
//       if (!year || !feeTypes || !Array.isArray(feeTypes) || feeTypes.length === 0) {
//         return res.status(400).json({ message: 'Year and feeTypes array are required' });
//       }

//       for (const { type, amount } of feeTypes) {
//         if (!validateFeeType(type)) {
//           return res.status(400).json({ message: `Invalid fee type: ${type}` });
//         }
//         if (!Number.isInteger(amount) || amount <= 0) {
//           return res.status(400).json({ message: `Invalid amount for ${type}: ${amount}` });
//         }
//       }

//       // Check for existing fees (optimized query)
//       const existingFees = await FeeModel.countDocuments({
//         school: schoolId,
//         student: { $exists: false },
//         year: parseInt(year),
//       });

//       if (existingFees > 0) {
//         return res.status(409).json({ message: `Fees for ${year} are already defined` });
//       }

//       // Batch fee definitions for all months
//       const feeDefinitions = [];
//       for (let month = 1; month <= 12; month++) {
//         feeTypes.forEach(({ type, amount, description }) => {
//           feeDefinitions.push({
//             school: schoolId,
//             type,
//             amount,
//             dueDate: new Date(year, month - 1, 28),
//             month,
//             year: parseInt(year),
//             description: description || `${type} fee for ${month}/${year}`,
//             status: 'pending',
//           });
//         });
//       }

//       await FeeModel.insertMany(feeDefinitions, { ordered: false }); // Faster bulk insert
//       res.status(201).json({ message: `Fees defined for ${year} successfully`, count: feeDefinitions.length });
//     } catch (error) {
//       console.error('Error defining fees:', error);
//       res.status(500).json({ error: 'Failed to define fees', details: error.message });
//     }
//   },

//   // Fetch available classes
//   getAvailableClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       const allClasses = await Class.find({ school: schoolId })
//         .select('name division academicYear capacity students classTeacher')
//         .populate('classTeacher', 'name', User)
//         .lean() // Faster response with plain JS objects
//         .sort({ name: 1, division: 1 });

//       const response = allClasses.map(cls => ({
//         _id: cls._id,
//         name: cls.name,
//         division: cls.division,
//         academicYear: cls.academicYear,
//         teacher: cls.classTeacher?.name || null,
//         enrolledCount: cls.students?.length || 0,
//         capacity: cls.capacity,
//         remainingCapacity: cls.capacity - (cls.students?.length || 0),
//       }));

//       res.json({ classes: response });
//     } catch (error) {
//       console.error('Error in getAvailableClasses:', error);
//       res.status(500).json({ error: 'Failed to fetch classes', details: error.message });
//     }
//   },

//   // Get fees by class and month
//   getFeesByClassAndMonth: async (req, res) => {
//     try {
//       const { classId, month, year } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);
//       const PaymentModel = Payment(connection);

//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fees' });
//       }

//       const objectIdClassId = new mongoose.Types.ObjectId(classId);

//       // Fetch students and fee definitions in parallel
//       const [students, feeDefinitionsRaw] = await Promise.all([
//         UserModel.find({ 'studentDetails.class': objectIdClassId, school: schoolId })
//           .select('_id name studentDetails.grNumber')
//           .lean(),
//         FeeModel.find({
//           school: schoolId,
//           student: { $exists: false },
//           month: parseInt(month),
//           year: parseInt(year),
//         }).lean(),
//       ]);

//       if (!students.length) {
//         return res.status(404).json({ message: 'No students found in this class' });
//       }

//       const feeDefinitions = Array.from(
//         new Map(feeDefinitionsRaw.map(fee => [fee.type, fee])).values()
//       );

//       // Fetch student-specific fees and payments
//       const [studentFees, paymentRecords] = await Promise.all([
//         FeeModel.find({
//           student: { $in: students.map(s => s._id) },
//           school: schoolId,
//           month: parseInt(month),
//           year: parseInt(year),
//         }).lean(),
//         PaymentModel.find({
//           student: { $in: students.map(s => s._id) },
//           school: schoolId,
//           status: 'completed',
//           'feesPaid.month': parseInt(month),
//           'feesPaid.year': parseInt(year),
//         }).lean(),
//       ]);

//       // Build paid fees map
//       const paidFeesMap = new Map();
//       paymentRecords.forEach(payment => {
//         payment.feesPaid.forEach(feePaid => {
//           if (feePaid.month === parseInt(month) && feePaid.year === parseInt(year)) {
//             paidFeesMap.set(`${payment.student.toString()}_${feePaid.type}`, {
//               status: 'paid',
//               paymentDate: payment.paymentDate,
//             });
//           }
//         });
//       });

//       // Process fee data efficiently
//       const feeData = students.map(student => {
//         const studentSpecificFees = studentFees.filter(fee =>
//           fee.student.toString() === student._id.toString()
//         );
//         const feeSummary = {
//           studentId: student._id,
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           fees: {},
//           total: 0,
//           allPaid: true,
//         };

//         feeDefinitions.forEach(def => {
//           const studentFee = studentSpecificFees.find(f => f.type === def.type);
//           const paymentInfo = paidFeesMap.get(`${student._id.toString()}_${def.type}`);
//           const status = studentFee?.status || paymentInfo?.status || 'pending';
//           const paidDate = studentFee?.paymentDetails?.paymentDate || paymentInfo?.paymentDate || null;

//           feeSummary.fees[def.type] = { amount: def.amount, status, paidDate };
//           feeSummary.total += def.amount;
//           if (status !== 'paid') feeSummary.allPaid = false;
//         });

//         return feeSummary;
//       });

//       res.json(feeData);
//     } catch (error) {
//       console.error('Error in getFeesByClassAndMonth:', error);
//       res.status(500).json({ error: 'Failed to fetch fees', details: error.message });
//     }
//   },

//   // Get student fees by GR number
//   getStudentByGrNumber: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const UserModel = User(connection);
//       const FeeModel = Fee(connection);

//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({ message: 'Unauthorized: Only fee managers can view student fees' });
//       }

//       const student = await UserModel.findOne({
//         'studentDetails.grNumber': grNumber,
//         school: schoolId,
//       }).select('_id name studentDetails.grNumber studentDetails.class').lean();

//       if (!student) return res.status(404).json({ message: 'Student not found' });
//       if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//       const [generalFees, studentFees] = await Promise.all([
//         FeeModel.find({ school: schoolId, student: { $exists: false } })
//           .sort({ year: 1, month: 1 })
//           .lean(),
//         FeeModel.find({ student: student._id, school: schoolId })
//           .sort({ year: 1, month: 1 })
//           .lean(),
//       ]);

//       const feeData = {};
//       generalFees.forEach(fee => {
//         const key = `${fee.year}-${fee.month}`;
//         feeData[key] = feeData[key] || { total: 0, fees: {} };
//         feeData[key].fees[fee.type] = {
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description,
//           status: 'pending',
//         };
//         feeData[key].total += fee.amount;
//       });

//       studentFees.forEach(fee => {
//         const key = `${fee.year}-${fee.month}`;
//         feeData[key] = feeData[key] || { total: 0, fees: {} };
//         feeData[key].fees[fee.type] = {
//           ...feeData[key].fees[fee.type],
//           status: fee.status,
//           paymentDetails: fee.paymentDetails || undefined,
//         };
//         feeData[key].total = Object.values(feeData[key].fees).reduce((sum, f) => sum + f.amount, 0);
//       });

//       res.json({
//         student: { _id: student._id, name: student.name, grNumber, class: student.studentDetails.class },
//         feeData,
//       });
//     } catch (error) {
//       console.error('Error in getStudentByGrNumber:', error);
//       res.status(500).json({ error: 'Failed to fetch student fees', details: error.message });
//     }
//   },

//   // Pay fees for a student
//   payFeesForStudent: async (req, res) => {
//     try {
//       const { grNumber, selectedFees, totalAmount } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       if (!grNumber || !selectedFees || !Array.isArray(selectedFees) || selectedFees.length === 0 || !totalAmount) {
//         return res.status(400).json({ message: 'GR Number, selected fees, and total amount are required' });
//       }

//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({ message: 'Unauthorized: Only fee managers can process payments' });
//       }

//       const student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId }).lean();
//       if (!student) return res.status(404).json({ message: 'Student not found' });
//       if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//       const feesToPay = [];
//       let calculatedTotal = 0;

//       for (const fee of selectedFees) {
//         const { year, month, types } = fee;
//         if (!year || !month || !types || !Array.isArray(types)) {
//           return res.status(400).json({ message: 'Invalid fee format: year, month, and types are required' });
//         }

//         const [existingFees, feeDefinitions] = await Promise.all([
//           FeeModel.find({ student: student._id, school: schoolId, year: parseInt(year), month: parseInt(month), type: { $in: types } }).lean(),
//           FeeModel.find({ school: schoolId, student: { $exists: false }, year: parseInt(year), month: parseInt(month), type: { $in: types } }).lean(),
//         ]);

//         if (feeDefinitions.length !== types.length) {
//           return res.status(404).json({ message: `Some fee types not defined for ${month}/${year}` });
//         }

//         for (const def of feeDefinitions) {
//           const existing = existingFees.find(f => f.type === def.type);
//           if (existing?.status === 'paid') {
//             return res.status(400).json({ message: `Fee type '${def.type}' for ${month}/${year} is already paid` });
//           } else if (!existing) {
//             feesToPay.push({
//               school: schoolId,
//               student: student._id,
//               grNumber,
//               type: def.type,
//               amount: def.amount,
//               dueDate: def.dueDate,
//               month: parseInt(month),
//               year: parseInt(year),
//               status: 'pending',
//               description: def.description,
//             });
//             calculatedTotal += def.amount;
//           } else {
//             feesToPay.push(existing);
//             calculatedTotal += existing.amount;
//           }
//         }
//       }

//       if (calculatedTotal !== totalAmount) {
//         return res.status(400).json({
//           message: 'Payment amount mismatch',
//           calculatedAmount: calculatedTotal,
//           providedAmount: totalAmount,
//         });
//       }

//       const receiptNumber = `REC-CASH-${Date.now()}`;
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: student._id,
//         grNumber,
//         amount: totalAmount,
//         paymentMethod: 'cash',
//         status: 'completed',
//         paymentDate: new Date(),
//         receiptNumber,
//         feesPaid: feesToPay.map(fee => ({
//           feeId: fee._id || null,
//           type: fee.type,
//           month: fee.month,
//           year: fee.year,
//           amount: fee.amount,
//         })),
//       });

//       // Save payment and update fees in a transaction
//       await mongoose.connection.transaction(async (session) => {
//         await payment.save({ session });
//         const feeDocs = feesToPay.map(fee => {
//           fee.status = 'paid';
//           fee.paymentDetails = {
//             transactionId: receiptNumber,
//             paymentDate: new Date(),
//             paymentMethod: 'cash',
//             receiptNumber,
//           };
//           return fee._id ? FeeModel.findByIdAndUpdate(fee._id, fee, { session }) : new FeeModel(fee).save({ session });
//         });
//         await Promise.all(feeDocs);
//       });

//       const feeSlip = generateFeeSlip(student, payment, feesToPay, schoolId);
//       res.json({
//         message: 'Cash payment processed successfully',
//         payment,
//         paidFees: feesToPay.map(fee => ({ type: fee.type, amount: fee.amount, month: fee.month, year: fee.year })),
//         feeSlip,
//       });
//     } catch (error) {
//       console.error('Payment processing error:', error);
//       res.status(500).json({ error: 'Failed to process payment', details: error.message });
//     }
//   },

//   // Verify Razorpay payment
//   verifyPayment: async (req, res) => {
//     try {
//       const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       const generatedSignature = crypto
//         .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//         .digest('hex');

//       if (generatedSignature !== razorpay_signature) {
//         return res.status(400).json({ message: 'Invalid payment signature' });
//       }

//       const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
//       if (!payment) return res.status(404).json({ message: 'Payment not found' });

//       await mongoose.connection.transaction(async (session) => {
//         payment.status = 'completed';
//         payment.transactionId = razorpay_payment_id;
//         payment.paymentDate = new Date();
//         await payment.save({ session });

//         const feeUpdates = payment.feesPaid.map(feePaid =>
//           FeeModel.findOneAndUpdate(
//             { student: payment.student, school: schoolId, type: feePaid.type, month: feePaid.month, year: feePaid.year },
//             {
//               status: 'paid',
//               paymentDetails: {
//                 transactionId: razorpay_payment_id,
//                 paymentDate: new Date(),
//                 paymentMethod: payment.paymentMethod,
//                 receiptNumber: `REC-${Date.now()}`,
//               },
//             },
//             { session }
//           )
//         );
//         await Promise.all(feeUpdates);
//       });

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       console.error('Error in verifyPayment:', error);
//       res.status(500).json({ error: 'Failed to verify payment', details: error.message });
//     }
//   },

//   // Get total earnings by year
//   getTotalEarningsByYear: async (req, res) => {
//     try {
//       const { year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       if (!year) return res.status(400).json({ message: 'Year is required' });

//       const [totalEarnings, totalFees, prevYearEarnings] = await Promise.all([
//         PaymentModel.aggregate([
//           { $match: { school: new mongoose.Types.ObjectId(schoolId), status: 'completed', $expr: { $eq: [{ $year: '$paymentDate' }, parseInt(year)] } } },
//           { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
//         ]),
//         FeeModel.aggregate([
//           { $match: { school: new mongoose.Types.ObjectId(schoolId), student: { $exists: false }, year: parseInt(year) } },
//           { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
//         ]),
//         PaymentModel.aggregate([
//           { $match: { school: new mongoose.Types.ObjectId(schoolId), status: 'completed', $expr: { $eq: [{ $year: '$paymentDate' }, parseInt(year) - 1] } } },
//           { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
//         ]),
//       ]);

//       const totalReceived = totalEarnings[0]?.totalAmount || 0;
//       const totalDefined = totalFees[0]?.totalAmount || 0;
//       const totalPending = totalDefined - totalReceived;
//       const prevTotal = prevYearEarnings[0]?.totalAmount || 0;
//       const growth = totalReceived - prevTotal;

//       res.json({
//         totalEarning: totalReceived,
//         totalReceived,
//         totalPending: totalPending >= 0 ? totalPending : 0,
//         growth: growth >= 0 ? growth : 0,
//       });
//     } catch (error) {
//       console.error('Error calculating total earnings:', error);
//       res.status(500).json({ error: 'Failed to calculate earnings', details: error.message });
//     }
//   },
// };

// module.exports = feesController;