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
const {generateFeeSlip}= require('../utils/helpers')

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const feesController = {
  // Define fees for a year by month (Fee Manager only)
  defineFeesForYear: async (req, res) => {
    try {
      const { year, feeTypes } = req.body; // feeTypes: [{type, amount, description}]
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can define fees' });
      }

      // Validate fee types
      for (const feeType of feeTypes) {
        const { type } = feeType;
        if (!['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'].includes(type)) {
          return res.status(400).json({ message: `Invalid fee type: ${type}` });
        }
      }

      const feeDefinitions = [];
      // Create fee definitions for all 12 months
      for (let month = 1; month <= 12; month++) {
        for (const feeType of feeTypes) {
          const { type, amount, description } = feeType;
          const dueDate = new Date(year, month - 1, 28); // Last day of each month
          const fee = new FeeModel({
            school: schoolId,
            type,
            amount,
            dueDate,
            month,
            year,
            description,
            status: 'pending'
          });
          feeDefinitions.push(fee);
        }
      }

      await FeeModel.insertMany(feeDefinitions);
      res.status(201).json({ message: `Fees defined uniformly for all months of ${year} successfully`, feeDefinitions });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      const mongoose = require('mongoose');
  
      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fees' });
      }
  
      // Convert classId to ObjectId - this is the key fix
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
  
      // Get fee definitions
      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        month: parseInt(month),
        year: parseInt(year),
      });
  
      // Get student-specific fee records
      const studentFees = await FeeModel.find({
        student: { $in: students.map(s => s._id) },
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      });
  
      // Also get payment records as a fallback
      const paymentRecords = await PaymentModel.find({
        student: { $in: students.map(s => s._id) },
        school: schoolId,
        status: 'completed',
        'feesPaid.month': parseInt(month),
        'feesPaid.year': parseInt(year)
      });
  
      // Create a map of paid fees from payment records
      const paidFeesMap = new Map();
      paymentRecords.forEach(payment => {
        payment.feesPaid.forEach(feePaid => {
          if (feePaid.month === parseInt(month) && feePaid.year === parseInt(year)) {
            const key = `${payment.student.toString()}_${feePaid.type}`;
            paidFeesMap.set(key, {
              status: 'paid',
              paymentDate: payment.paymentDate
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
          allPaid: true
        };
  
        feeDefinitions.forEach(def => {
          // Check if there's a specific fee record for this student/fee type
          const paidFee = studentSpecificFees.find(f => f.type === def.type);
          
          // Also check if there's a payment record for this fee (fallback)
          const paymentInfo = paidFeesMap.get(`${student._id.toString()}_${def.type}`);
          
          // Determine fee status - use fee record if exists, otherwise check payment map
          const status = paidFee ? paidFee.status : (paymentInfo ? paymentInfo.status : 'pending');
          const paidDate = paidFee?.paymentDetails?.paymentDate || (paymentInfo ? paymentInfo.paymentDate : null);
          
          feeSummary.fees[def.type] = {
            amount: def.amount,
            status: status,
            paidDate: paidDate
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

  // Get student fee details by GR number (Fee Manager)
  getStudentByGrNumber: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const FeeModel = Fee(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can view student fees' });
      }

      const student = await UserModel.findOne({ 
        'studentDetails.grNumber': grNumber, 
        school: schoolId 
      }).select('_id name studentDetails.grNumber studentDetails.class');
      
      if (!student) return res.status(404).json({ message: 'Student not found' });
      
      if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

      const fees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
      }).sort({ year: 1, month: 1 });

      const studentPaidFees = await FeeModel.find({
        student: student._id,
        school: schoolId,
      });

      const feeData = {};
      fees.forEach(fee => {
        const key = `${fee.year}-${fee.month}`;
        if (!feeData[key]) feeData[key] = { total: 0, fees: {} };
        feeData[key].fees[fee.type] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: 'pending'
        };
        feeData[key].total += fee.amount;
      });

      studentPaidFees.forEach(fee => {
        const key = `${fee.year}-${fee.month}`;
        if (feeData[key] && feeData[key].fees[fee.type]) {
          feeData[key].fees[fee.type].status = fee.status;
          feeData[key].fees[fee.type].paymentDetails = fee.paymentDetails;
        }
      });

      res.json({
        student: {
          _id: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class
        },
        feeData
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Process cash payment for student (Fee Manager)
//  payFeesForStudent: async (req, res) => {
//   try {
//     const { grNumber, selectedFees, totalAmount } = req.body;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const FeeModel = Fee(connection);
//     const PaymentModel = Payment(connection);
//     const UserModel = User(connection);

//     // Validate required fields
//     if (!grNumber) {
//       return res.status(400).json({ message: 'GR Number is required' });
//     }
//     if (!selectedFees || !Array.isArray(selectedFees) || selectedFees.length === 0) {
//       return res.status(400).json({ message: 'Selected fees are required and must be an array' });
//     }
//     if (typeof totalAmount !== 'number' || totalAmount <= 0) {
//       return res.status(400).json({ message: 'Valid total amount is required' });
//     }

//     // Check permissions
//     if (!req.user.permissions.canManageFees) {
//       return res.status(403).json({ message: 'Unauthorized: Only fee managers can process payments' });
//     }

//     // Find the student
//     const student = await UserModel.findOne({
//       'studentDetails.grNumber': grNumber,
//       school: schoolId,
//     });
//     if (!student) return res.status(404).json({ message: 'Student not found' });

//     if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//     const feesToPay = [];
//     let calculatedTotal = 0;

//     // Process selected fees
//     for (const fee of selectedFees) {
//       const { year, month, types } = fee;

//       if (!year || !month || !types || !Array.isArray(types)) {
//         return res.status(400).json({ message: 'Invalid fee format: year, month, and types are required' });
//       }

//       const existingFees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//         year: parseInt(year),
//         month: parseInt(month),
//         type: { $in: types },
//       });

//       const feeDefinitions = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//         year: parseInt(year),
//         month: parseInt(month),
//         type: { $in: types },
//       });

//       for (const def of feeDefinitions) {
//         const existing = existingFees.find((f) => f.type === def.type);
//         if (!existing) {
//           const newFee = new FeeModel({
//             school: schoolId,
//             student: student._id,
//             grNumber: student.studentDetails.grNumber, // Ensure grNumber is set here too
//             type: def.type,
//             amount: def.amount,
//             dueDate: def.dueDate,
//             month: parseInt(month),
//             year: parseInt(year),
//             status: 'pending',
//             description: def.description,
//           });
//           feesToPay.push(newFee);
//           calculatedTotal += def.amount;
//         } else if (existing.status === 'pending') {
//           feesToPay.push(existing);
//           calculatedTotal += existing.amount;
//         }
//       }
//     }

//     if (calculatedTotal !== totalAmount) {
//       return res.status(400).json({
//         message: 'Payment amount mismatch',
//         calculatedAmount: calculatedTotal,
//         providedAmount: totalAmount,
//       });
//     }

//     const receiptNumber = `REC-CASH-${Date.now()}`;
//     const payment = new PaymentModel({
//       school: schoolId,
//       student: student._id,
//       grNumber: grNumber, // Add grNumber here from req.body
//       amount: totalAmount,
//       feeType: feesToPay.map((f) => f.type).join(','), // Changed to feeType as per your previous logic
//       paymentMethod: 'cash',
//       status: 'completed',
//       paymentDate: new Date(),
//       receiptNumber,
//       // Optionally include feesPaid array if you want to track individual fees in Payment
//       feesPaid: feesToPay.map((fee) => ({
//         feeId: fee._id || null, // Use null if fee is new and doesn't have an _id yet
//         type: fee.type,
//         month: fee.month,
//         year: fee.year,
//         amount: fee.amount,
//       })),
//     });

//     await payment.save();

//     const updatePromises = feesToPay.map((fee) => {
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: receiptNumber,
//         paymentDate: new Date(),
//         paymentMethod: 'cash',
//         receiptNumber,
//       };
//       return fee.save();
//     });

//     await Promise.all(updatePromises);

//     res.json({
//       message: 'Cash payment processed successfully',
//       payment,
//       paidFees: feesToPay.map((fee) => ({
//         type: fee.type,
//         amount: fee.amount,
//         month: fee.month,
//         year: fee.year,
//       })),
//     });
//   } catch (error) {
//     console.error('Payment processing error:', error);
//     res.status(500).json({ error: error.message || 'Internal server error' });
//   }
// },

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

      // Fetch fee definitions for the school (not student-specific yet)
      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
        month: parseInt(month),
        type: { $in: types },
      });

      if (feeDefinitions.length !== types.length) 
        return res.status(404).json({ message: 'Some fee types not defined for this month/year' });

      // Check existing student-specific fees
      const existingFees = await FeeModel.find({
        student: student._id,
        school: schoolId,
        year: parseInt(year),
        month: parseInt(month),
        type: { $in: types },
      });

      for (const def of feeDefinitions) {
        const existing = existingFees.find((f) => f.type === def.type);
        if (!existing) {
          const newFee = new FeeModel({
            school: schoolId,
            student: student._id,
            grNumber: student.studentDetails.grNumber,
            type: def.type,
            amount: def.amount, // Use the defined amount (e.g., 6000 for "school")
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
        // If existing.status is 'paid', it’s skipped (no action needed)
      }
    }

    console.log('Fees to Pay:', feesToPay.map(f => ({ type: f.type, amount: f.amount })));
    console.log('Calculated Total:', calculatedTotal);
    console.log('Provided Total:', totalAmount);

    if (calculatedTotal !== totalAmount) 
      return res.status(400).json({
        message: 'Payment amount mismatch',
        calculatedAmount: calculatedTotal,
        providedAmount: totalAmount,
      });

    if (feesToPay.length === 0) 
      return res.status(400).json({ message: 'No pending fees to pay for the selected types' });

    const receiptNumber = `REC-CASH-${Date.now()}`;
    const payment = new PaymentModel({
      school: schoolId,
      student: student._id,
      grNumber: grNumber,
      amount: totalAmount,
      paymentMethod: 'cash',
      status: 'completed',
      paymentDate: new Date(),
      receiptNumber,
      feesPaid: feesToPay.map((fee) => ({
        feeId: fee._id || null,
        type: fee.type,
        month: fee.month,
        year: fee.year,
        amount: fee.amount,
      })),
    });

    await payment.save();

    const updatePromises = feesToPay.map((fee) => {
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

    const feeSlip = generateFeeSlip(student, payment, feesToPay, schoolId);

    res.json({
      message: 'Cash payment processed successfully',
      payment,
      paidFees: feesToPay.map((fee) => ({
        type: fee.type,
        amount: fee.amount,
        month: fee.month,
        year: fee.year,
      })),
      feeSlip,
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
},

// payFeesForStudent: async (req, res) => {
//   try {
//     const { grNumber, selectedFees, totalAmount } = req.body;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const FeeModel = Fee(connection);
//     const PaymentModel = Payment(connection);
//     const UserModel = User(connection);

//     if (!grNumber) return res.status(400).json({ message: 'GR Number is required' });
//     if (!selectedFees || !Array.isArray(selectedFees) || selectedFees.length === 0) 
//       return res.status(400).json({ message: 'Selected fees are required and must be an array' });
//     if (typeof totalAmount !== 'number' || totalAmount <= 0) 
//       return res.status(400).json({ message: 'Valid total amount is required' });

//     if (!req.user.permissions.canManageFees) 
//       return res.status(403).json({ message: 'Unauthorized: Only fee managers can process payments' });

//     const student = await UserModel.findOne({
//       'studentDetails.grNumber': grNumber,
//       school: schoolId,
//     });
//     if (!student) return res.status(404).json({ message: 'Student not found' });
//     if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//     const feesToPay = [];
//     let calculatedTotal = 0;

//     for (const fee of selectedFees) {
//       const { year, month, types } = fee;
//       if (!year || !month || !types || !Array.isArray(types)) 
//         return res.status(400).json({ message: 'Invalid fee format: year, month, and types are required' });

//       const existingFees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//         year: parseInt(year),
//         month: parseInt(month),
//         type: { $in: types },
//       });

//       const feeDefinitions = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//         year: parseInt(year),
//         month: parseInt(month),
//         type: { $in: types },
//       });

//       for (const def of feeDefinitions) {
//         const existing = existingFees.find((f) => f.type === def.type);
//         if (!existing) {
//           const newFee = new FeeModel({
//             school: schoolId,
//             student: student._id,
//             grNumber: student.studentDetails.grNumber,
//             type: def.type,
//             amount: def.amount,
//             dueDate: def.dueDate,
//             month: parseInt(month),
//             year: parseInt(year),
//             status: 'pending',
//             description: def.description,
//           });
//           feesToPay.push(newFee);
//           calculatedTotal += def.amount;
//         } else if (existing.status === 'pending') {
//           feesToPay.push(existing);
//           calculatedTotal += existing.amount;
//         }
//       }
//     }

//     if (calculatedTotal !== totalAmount) 
//       return res.status(400).json({
//         message: 'Payment amount mismatch',
//         calculatedAmount: calculatedTotal,
//         providedAmount: totalAmount,
//       });

//     const receiptNumber = `REC-CASH-${Date.now()}`;
//     const payment = new PaymentModel({
//       school: schoolId,
//       student: student._id,
//       grNumber: grNumber,
//       amount: totalAmount,
//       paymentMethod: 'cash',
//       status: 'completed',
//       paymentDate: new Date(),
//       receiptNumber,
//       feesPaid: feesToPay.map((fee) => ({
//         feeId: fee._id || null,
//         type: fee.type,
//         month: fee.month,
//         year: fee.year,
//         amount: fee.amount,
//       })),
//     });

//     await payment.save();

//     const updatePromises = feesToPay.map((fee) => {
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: receiptNumber,
//         paymentDate: new Date(),
//         paymentMethod: 'cash',
//         receiptNumber,
//       };
//       return fee.save();
//     });

//     await Promise.all(updatePromises);

//     // Generate fee slip
//     const feeSlip = generateFeeSlip(student, payment, feesToPay, schoolId);

//     res.json({
//       message: 'Cash payment processed successfully',
//       payment,
//       paidFees: feesToPay.map((fee) => ({
//         type: fee.type,
//         amount: fee.amount,
//         month: fee.month,
//         year: fee.year,
//       })),
//       feeSlip, // Return the fee slip
//     });
//   } catch (error) {
//     console.error('Payment processing error:', error);
//     res.status(500).json({ error: error.message || 'Internal server error' });
//   }
// },

  verifyPayment: async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

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

      const fee = await FeeModel.findById(payment.feeId);
      fee.status = 'paid';
      fee.paymentDetails = {
        transactionId: razorpay_payment_id,
        paymentDate: new Date(),
        paymentMethod: payment.paymentMethod,
        receiptNumber: `REC${Date.now()}`,
      };
      await fee.save();

      res.json({ message: 'Payment verified successfully', payment });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTotalEarningsByYear: async (req, res) => {
    try {
      const { year } = req.query; // Expect year as a query parameter (e.g., ?year=2025)
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);

      if (!year) {
        return res.status(400).json({ message: 'Year is required' });
      }

      // Aggregate total earnings from completed payments for the given year
      const totalEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: 'completed',
            $expr: {
              $eq: [{ $year: '$paymentDate' }, parseInt(year)]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalReceived = totalEarnings.length > 0 ? totalEarnings[0].totalAmount : 0;

      // Calculate total pending (optional, for completeness)
      const totalFees = await Fee(connection).aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            $expr: {
              $eq: [{ $year: '$dueDate' }, parseInt(year)]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);

      const totalPending = totalFees.length > 0 ? totalFees[0].totalAmount - totalReceived : 0;

      res.json({
        totalEarning: totalReceived || 0, // ₹20,000 as per your image
        totalReceived: totalReceived || 0, // ₹10,000
        totalPending: totalPending >= 0 ? totalPending : 0, // ₹10,000
        growth: 15220, // ₹15,220 (you can calculate this based on previous year data if needed)
      });
    } catch (error) {
      console.error('Error calculating total earnings:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = feesController;