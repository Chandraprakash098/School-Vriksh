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



// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');

// // Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID, // Add your Razorpay Key ID in .env
//   key_secret: process.env.RAZORPAY_KEY_SECRET, // Add your Razorpay Key Secret in .env
// });

// const feesController = {
//   // Get all fees for a student (for student panel)
//   getStudentFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       const fees = await FeeModel.find({
//         student: studentId,
//         school: schoolId,
//       }).sort({ dueDate: 1 });

//       res.json(fees);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get fees by GR number (for fee manager panel)
//   getFeesByGRNumber: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);

//       const student = await UserModel.findOne({ grNumber, school: schoolId });
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const fees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//       }).sort({ dueDate: 1 });

//       res.json({
//         student: {
//           id: student._id,
//           name: student.name,
//           class: student.studentDetails.class,
//           grNumber: student.grNumber,
//         },
//         fees,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees (for both student and fee manager)
//   payFees: async (req, res) => {
//     try {
//       const { feeId, amount, paymentMethod } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       const fee = await FeeModel.findOne({ _id: feeId, school: schoolId });
//       if (!fee) {
//         return res.status(404).json({ message: 'Fee record not found' });
//       }

//       const student = await UserModel.findById(fee.student);
//       if (student.studentDetails.isRTE) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       if (fee.amount !== amount) {
//         return res.status(400).json({ message: 'Payment amount does not match fee amount' });
//       }

//       if (fee.status === 'paid') {
//         return res.status(400).json({ message: 'Fee is already paid' });
//       }

//       // Handle payment based on method
//       if (paymentMethod === 'cash') {
//         // Fee manager paying in cash
//         const payment = new PaymentModel({
//           school: schoolId,
//           student: fee.student,
//           amount,
//           feeType: fee.type,
//           paymentMethod: 'cash',
//           feeId,
//           status: 'completed',
//           transactionDate: new Date(),
//           receiptNumber: `REC${Date.now()}`,
//         });

//         await payment.save();

//         // Update fee status
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: payment.receiptNumber,
//           paymentDate: new Date(),
//           paymentMethod: 'cash',
//           receiptNumber: payment.receiptNumber,
//         };
//         await fee.save();

//         res.json({ message: 'Fee paid successfully via cash', payment });
//       } else {
//         // Online payment via Razorpay
//         const options = {
//           amount: amount * 100, // Razorpay expects amount in paise
//           currency: 'INR',
//           receipt: `fee_${feeId}`,
//         };

//         const order = await razorpay.orders.create(options);

//         const payment = new PaymentModel({
//           school: schoolId,
//           student: fee.student,
//           amount,
//           feeType: fee.type,
//           paymentMethod,
//           feeId,
//           status: 'pending',
//           transactionDate: new Date(),
//           orderId: order.id,
//         });

//         await payment.save();

//         res.json({
//           orderId: order.id,
//           amount: amount * 100,
//           currency: 'INR',
//           key: process.env.RAZORPAY_KEY_ID,
//           payment,
//           message: 'Payment initiated. Proceed with Razorpay checkout.',
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Verify Razorpay payment (webhook or callback)
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
//       if (!payment) {
//         return res.status(404).json({ message: 'Payment not found' });
//       }

//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       await payment.save();

//       const fee = await FeeModel.findById(payment.feeId);
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: razorpay_payment_id,
//         paymentDate: new Date(),
//         paymentMethod: payment.paymentMethod,
//         receiptNumber: `REC${Date.now()}`,
//       };
//       await fee.save();

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = feesController;


// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');

// // Initialize Razorpay
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const feesController = {
//   // Get all fees for a student (for student panel)
//   getStudentFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       const fees = await FeeModel.find({
//         student: studentId,
//         school: schoolId,
//       }).sort({ dueDate: 1 });

//       res.json(fees);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   getFeesByGRNumber: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       console.log('Fetching fees for GR number:', grNumber);
//       console.log('req.school:', req.school);
//       const schoolId = req.school ? req.school._id.toString() : null;
//       console.log('School ID:', schoolId);
//       if (!schoolId) {
//         return res.status(500).json({ message: 'School context not found' });
//       }

//       const connection = req.connection;
//       console.log('Connection name:', connection.name);
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);

//       console.log('Querying student with grNumber:', grNumber, 'and schoolId:', schoolId);
//       // const student = await UserModel.findOne({ grNumber: grNumber, school: schoolId });
//       const student = await UserModel.findOne({ 
//         'studentDetails.grNumber': grNumber, 
//         school: schoolId 
//       });
//       console.log('Found student:', student);

//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const fees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//       }).sort({ dueDate: 1 });

//       res.json({
//         student: {
//           id: student._id,
//           name: student.name,
//           class: student.studentDetails.class,
//           // grNumber: student.grNumber,
//           grNumber: student.studentDetails.grNumber, 
//         },
//         fees,
//       });
//     } catch (error) {
//       console.error('Error in getFeesByGRNumber:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees (for both student and fee manager)
//   payFees: async (req, res) => {
//     try {
//       const { feeId, amount, paymentMethod, studentId } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       const fee = await FeeModel.findOne({ _id: feeId, school: schoolId });
//       if (!fee) {
//         return res.status(404).json({ message: 'Fee record not found' });
//       }

//       const student = await UserModel.findById(studentId || fee.student);
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       if (student.studentDetails.isRTE) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       if (fee.amount !== amount) {
//         return res.status(400).json({ message: 'Payment amount does not match fee amount' });
//       }

//       if (fee.status === 'paid') {
//         return res.status(400).json({ message: 'Fee is already paid' });
//       }

//       // Handle payment based on method
//       if (paymentMethod === 'cash') {
//         // Fee manager paying in cash
//         const payment = new PaymentModel({
//           school: schoolId,
//           student: fee.student,
//           amount,
//           feeType: fee.type,
//           paymentMethod: 'cash',
//           feeId,
//           status: 'completed',
//           paymentDate: new Date(),
//           receiptNumber: `REC${Date.now()}`,
//         });

//         await payment.save();

//         // Update fee status
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: payment.receiptNumber,
//           paymentDate: new Date(),
//           paymentMethod: 'cash',
//           receiptNumber: payment.receiptNumber,
//         };
//         await fee.save();

//         res.json({ message: 'Fee paid successfully via cash', payment });
//       } else {
//         // Online payment via Razorpay
//         const options = {
//           amount: amount * 100, // Razorpay expects amount in paise
//           currency: 'INR',
//           receipt: `fee_${feeId}`,
//         };

//         const order = await razorpay.orders.create(options);

//         const payment = new PaymentModel({
//           school: schoolId,
//           student: fee.student,
//           amount,
//           feeType: fee.type,
//           paymentMethod,
//           feeId,
//           status: 'pending',
//           paymentDate: new Date(),
//           orderId: order.id,
//         });

//         await payment.save();

//         res.json({
//           orderId: order.id,
//           amount: amount * 100,
//           currency: 'INR',
//           key: process.env.RAZORPAY_KEY_ID,
//           payment,
//           message: 'Payment initiated. Proceed with Razorpay checkout.',
//         });
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Verify Razorpay payment (webhook or callback)
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
//       if (!payment) {
//         return res.status(404).json({ message: 'Payment not found' });
//       }

//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       await payment.save();

//       const fee = await FeeModel.findById(payment.feeId);
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: razorpay_payment_id,
//         paymentDate: new Date(),
//         paymentMethod: payment.paymentMethod,
//         receiptNumber: `REC${Date.now()}`,
//       };
//       await fee.save();

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = feesController;



// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');

// // Initialize Razorpay (used for verification)
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const feesController = {
//   // Get all fees for a class (for fee manager panel)



// getFeesByClassAndMonth: async (req, res) => {
//   try {
//     const { classId, month, year } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const FeeModel = Fee(connection);
//     const UserModel = User(connection);

//     const students = await UserModel.find({
//       'studentDetails.class': classId,
//       school: schoolId,
//     }).select('_id name studentDetails.grNumber studentDetails.class');

//     const studentIds = students.map(student => student._id);
//     const fees = await FeeModel.find({
//       student: { $in: studentIds },
//       school: schoolId,
//       month: parseInt(month),
//       year: parseInt(year),
//     }).populate('student', 'name studentDetails.grNumber studentDetails.class');

//     const feeData = students.map(student => {
//       const studentFees = fees.filter(fee => fee.student._id.toString() === student._id.toString());
//       const feeSummary = {
//         name: student.name,
//         class: student.studentDetails.class,
//         grNumber: student.studentDetails.grNumber,
//         schoolFees: 0,
//         computerFees: 0,
//         transportFees: 0,
//         examFees: 0,
//         classroomFees: 0,
//         materialFees: 0,
//         totalFees: 0,
//         status: 'Unpaid',
//       };

//       studentFees.forEach(fee => {
//         switch (fee.type) {
//           case 'school': feeSummary.schoolFees = fee.amount; break;
//           case 'computer': feeSummary.computerFees = fee.amount; break;
//           case 'transportation': feeSummary.transportFees = fee.amount; break;
//           case 'examination': feeSummary.examFees = fee.amount; break;
//           case 'classroom': feeSummary.classroomFees = fee.amount; break;
//           case 'educational': feeSummary.materialFees = fee.amount; break;
//         }
//         feeSummary.totalFees += fee.amount;
//         if (fee.status === 'paid') feeSummary.status = 'Paid';
//       });

//       return feeSummary;
//     });

//     res.json(feeData);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// },

// // Get student details by grNumber (for fee manager)
// getStudentByGrNumber: async (req, res) => {
//   try {
//     const { grNumber } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const UserModel = User(connection);
//     const FeeModel = Fee(connection);

//     const student = await UserModel.findOne({ 
//       'studentDetails.grNumber': grNumber, 
//       school: schoolId 
//     }).select('_id name studentDetails.grNumber studentDetails.class');
    
//     if (!student) return res.status(404).json({ message: 'Student not found' });
    
//     if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//     // Get all pending fees for this student
//     const pendingFees = await FeeModel.find({
//       student: student._id,
//       school: schoolId,
//       status: 'pending'
//     }).sort({ type: 1, dueDate: 1 });;
    
//     // // Group fees by type
//     // const feesByType = {
//     //   school: [],
//     //   computer: [],
//     //   transportation: [],
//     //   examination: [],
//     //   classroom: [],
//     //   educational: []
//     // };
    
//     // pendingFees.forEach(fee => {
//     //   feesByType[fee.type].push({
//     //     _id: fee._id,
//     //     amount: fee.amount,
//     //     dueDate: fee.dueDate
//     //   });
//     // });

//     const feesByType = {};
//     pendingFees.forEach(fee => {
//       if (!feesByType[fee.type]) {
//         feesByType[fee.type] = [];
//       }
//       feesByType[fee.type].push({
//         id: fee._id,
//         amount: fee.amount,
//         dueDate: fee.dueDate
//       });
//     });

//     res.json({
//       student: {
//         _id: student._id,
//         name: student.name,
//         grNumber: student.studentDetails.grNumber,
//         class: student.studentDetails.class
//       },
//       pendingFees: feesByType,
//       // hasPendingFees: pendingFees.length > 0
//       totalAmount: pendingFees.reduce((sum, fee) => sum + fee.amount, 0)
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// },

 

//   payFeesForStudent: async (req, res) => {
//     try {
//       const { grNumber, feeTypes, month, year, totalAmount, paymentMethod } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       const student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (!student) return res.status(404).json({ message: 'Student not found' });

//       if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//       if (paymentMethod !== 'cash') {
//         return res.status(403).json({ message: 'Fee manager can only process cash payments.' });
//       }

//       const fees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//         type: { $in: feeTypes },
//         month: parseInt(month),
//         year: parseInt(year),
//         status: 'pending'
//       });

//       if (fees.length === 0) return res.status(404).json({ message: 'No pending fees found for the selected types and month' });

//       const calculatedTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);
//       if (calculatedTotal !== totalAmount) {
//         return res.status(400).json({ 
//           message: 'Payment amount does not match total fee amount',
//           calculatedAmount: calculatedTotal,
//           providedAmount: totalAmount
//         });
//       }

//       const receiptNumber = `REC${Date.now()}`;
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: student._id,
//         amount: totalAmount,
//         feeType: feeTypes.join(','),
//         paymentMethod: 'cash',
//         status: 'completed',
//         paymentDate: new Date(),
//         receiptNumber,
//       });

//       await payment.save();

//       const updatePromises = fees.map(fee => {
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: payment.receiptNumber,
//           paymentDate: new Date(),
//           paymentMethod: 'cash',
//           receiptNumber,
//         };
//         return fee.save();
//       });

//       await Promise.all(updatePromises);

//       res.json({ 
//         message: 'Fees paid successfully via cash', 
//         payment,
//         paidFees: fees.map(fee => ({
//           type: fee.type,
//           amount: fee.amount,
//           dueDate: fee.dueDate
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   // Verify Razorpay payment (used by both student and fee manager)
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

//       if (generatedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid payment signature' });

//       const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
//       if (!payment) return res.status(404).json({ message: 'Payment not found' });

//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       await payment.save();

//       const fee = await FeeModel.findById(payment.feeId);
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: razorpay_payment_id,
//         paymentDate: new Date(),
//         paymentMethod: payment.paymentMethod,
//         receiptNumber: `REC${Date.now()}`,
//       };
//       await fee.save();

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = feesController;



// const Razorpay = require('razorpay');
// const crypto = require('crypto');
// const Fee = require('../models/Fee');
// const User = require('../models/User');
// const Payment = require('../models/Payment');

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const feesController = {
//   // Define fees for a year by month (Fee Manager only)
//   defineFeesForYear: async (req, res) => {
//     try {
//       const { year, feeTypes } = req.body; // feeTypes: { type, amount, description }[]
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({ message: 'Unauthorized: Only fee managers can define fees' });
//       }

//       const feeDefinitions = [];
//       for (const feeType of feeTypes) {
//         const { type, amount, description } = feeType;
//         if (!['school', 'computer', 'transportation', 'examination', 'classroom', 'educational'].includes(type)) {
//           return res.status(400).json({ message: `Invalid fee type: ${type}` });
//         }

//         for (let month = 1; month <= 12; month++) {
//           const dueDate = new Date(year, month, 0); // Last day of the month
//           const fee = new FeeModel({
//             school: schoolId,
//             type,
//             amount,
//             dueDate,
//             month,
//             year,
//             description,
//             status: 'pending'
//           });
//           feeDefinitions.push(fee);
//         }
//       }

//       await FeeModel.insertMany(feeDefinitions);
//       res.status(201).json({ message: `Fees defined for ${year} successfully`, feeDefinitions });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeesByClassAndMonth: async (req, res) => {
//     try {
//       const { classId, month, year } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);

//       const students = await UserModel.find({
//         'studentDetails.class': classId,
//         school: schoolId,
//       }).select('_id name studentDetails.grNumber studentDetails.class');

//       const studentIds = students.map(student => student._id);
//       const fees = await FeeModel.find({
//         student: { $in: studentIds },
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       }).populate('student', 'name studentDetails.grNumber studentDetails.class');

//       const feeData = students.map(student => {
//         const studentFees = fees.filter(fee => fee.student && fee.student._id.toString() === student._id.toString());
//         const feeSummary = {
//           name: student.name,
//           class: student.studentDetails.class,
//           grNumber: student.studentDetails.grNumber,
//           schoolFees: 0,
//           computerFees: 0,
//           transportFees: 0,
//           examFees: 0,
//           classroomFees: 0,
//           materialFees: 0,
//           totalFees: 0,
//           status: 'Unpaid',
//         };

//         studentFees.forEach(fee => {
//           switch (fee.type) {
//             case 'school': feeSummary.schoolFees = fee.amount; break;
//             case 'computer': feeSummary.computerFees = fee.amount; break;
//             case 'transportation': feeSummary.transportFees = fee.amount; break;
//             case 'examination': feeSummary.examFees = fee.amount; break;
//             case 'classroom': feeSummary.classroomFees = fee.amount; break;
//             case 'educational': feeSummary.materialFees = fee.amount; break;
//           }
//           feeSummary.totalFees += fee.amount;
//           if (fee.status === 'paid') feeSummary.status = 'Paid';
//         });

//         return feeSummary;
//       });

//       res.json(feeData);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentByGrNumber: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const UserModel = User(connection);
//       const FeeModel = Fee(connection);

//       const student = await UserModel.findOne({ 
//         'studentDetails.grNumber': grNumber, 
//         school: schoolId 
//       }).select('_id name studentDetails.grNumber studentDetails.class');
      
//       if (!student) return res.status(404).json({ message: 'Student not found' });
      
//       if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//       const pendingFees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//         status: 'pending'
//       }).sort({ type: 1, dueDate: 1 });

//       const feesByType = {};
//       pendingFees.forEach(fee => {
//         if (!feesByType[fee.type]) {
//           feesByType[fee.type] = [];
//         }
//         feesByType[fee.type].push({
//           id: fee._id,
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description
//         });
//       });

//       res.json({
//         student: {
//           _id: student._id,
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class
//         },
//         pendingFees: feesByType,
//         totalAmount: pendingFees.reduce((sum, fee) => sum + fee.amount, 0)
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   payFeesForStudent: async (req, res) => {
//     try {
//       const { grNumber, feeTypes, month, year, totalAmount, paymentMethod } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       const student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (!student) return res.status(404).json({ message: 'Student not found' });

//       if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

//       if (paymentMethod !== 'cash') {
//         return res.status(403).json({ message: 'Fee manager can only process cash payments.' });
//       }

//       const fees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//         type: { $in: feeTypes },
//         month: parseInt(month),
//         year: parseInt(year),
//         status: 'pending'
//       });

//       if (fees.length === 0) return res.status(404).json({ message: 'No pending fees found for the selected types and month' });

//       const calculatedTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);
//       if (calculatedTotal !== totalAmount) {
//         return res.status(400).json({ 
//           message: 'Payment amount does not match total fee amount',
//           calculatedAmount: calculatedTotal,
//           providedAmount: totalAmount
//         });
//       }

//       const receiptNumber = `REC${Date.now()}`;
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: student._id,
//         amount: totalAmount,
//         feeType: feeTypes.join(','),
//         paymentMethod: 'cash',
//         status: 'completed',
//         paymentDate: new Date(),
//         receiptNumber,
//       });

//       await payment.save();

//       const updatePromises = fees.map(fee => {
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: payment.receiptNumber,
//           paymentDate: new Date(),
//           paymentMethod: 'cash',
//           receiptNumber,
//         };
//         return fee.save();
//       });

//       await Promise.all(updatePromises);

//       res.json({ 
//         message: 'Fees paid successfully via cash', 
//         payment,
//         paidFees: fees.map(fee => ({
//           type: fee.type,
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

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

//       if (generatedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid payment signature' });

//       const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
//       if (!payment) return res.status(404).json({ message: 'Payment not found' });

//       payment.status = 'completed';
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       await payment.save();

//       const fee = await FeeModel.findById(payment.feeId);
//       fee.status = 'paid';
//       fee.paymentDetails = {
//         transactionId: razorpay_payment_id,
//         paymentDate: new Date(),
//         paymentMethod: payment.paymentMethod,
//         receiptNumber: `REC${Date.now()}`,
//       };
//       await fee.save();

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = feesController;


const Razorpay = require('razorpay');
const crypto = require('crypto');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Payment = require('../models/Payment');

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
  // View fees by class and month (Fee Manager)
  // getFeesByClassAndMonth: async (req, res) => {
  //   try {
  //     const { classId, month, year } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const UserModel = User(connection);

  //     if (!req.user.permissions.canManageFees) {
  //       return res.status(403).json({ message: 'Unauthorized: Only fee managers can view fees' });
  //     }

  //     const students = await UserModel.find({
  //       'studentDetails.class': classId,
  //       school: schoolId,
  //     }).select('_id name studentDetails.grNumber studentDetails.class');

  //     const feeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false },
  //       month: parseInt(month),
  //       year: parseInt(year),
  //     });

  //     const studentFees = await FeeModel.find({
  //       student: { $in: students.map(s => s._id) },
  //       school: schoolId,
  //       month: parseInt(month),
  //       year: parseInt(year),
  //     });

  //     const feeData = students.map(student => {
  //       const studentSpecificFees = studentFees.filter(fee => 
  //         fee.student && fee.student.toString() === student._id.toString()
  //       );
        
  //       const feeSummary = {
  //         studentId: student._id,
  //         name: student.name,
  //         grNumber: student.studentDetails.grNumber,
  //         class: student.studentDetails.class,
  //         fees: {},
  //         total: 0,
  //         allPaid: true
  //       };

  //       feeDefinitions.forEach(def => {
  //         const paidFee = studentSpecificFees.find(f => f.type === def.type);
  //         feeSummary.fees[def.type] = {
  //           amount: def.amount,
  //           status: paidFee ? paidFee.status : 'pending',
  //           paidDate: paidFee?.paymentDetails?.paymentDate || null
  //         };
  //         feeSummary.total += def.amount;
  //         if (!paidFee || paidFee.status !== 'paid') feeSummary.allPaid = false;
  //       });

  //       return feeSummary;
  //     });

  //     res.json(feeData);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

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
  
      // Get all students in the class
      const students = await UserModel.find({
        'studentDetails.class': classId,
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
  payFeesForStudent: async (req, res) => {
    try {
      const { grNumber, selectedFees, totalAmount } = req.body; // selectedFees: { year, month, types[] }
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection);
      const UserModel = User(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: 'Unauthorized: Only fee managers can process payments' });
      }

      const student = await UserModel.findOne({ 
        'studentDetails.grNumber': grNumber, 
        school: schoolId 
      });
      if (!student) return res.status(404).json({ message: 'Student not found' });

      if (student.studentDetails.isRTE) return res.status(400).json({ message: 'RTE students are exempted from fees' });

      const feesToPay = [];
      let calculatedTotal = 0;

      for (const fee of selectedFees) {
        const { year, month, types } = fee;
        
        const existingFees = await FeeModel.find({
          student: student._id,
          school: schoolId,
          year: parseInt(year),
          month: parseInt(month),
          type: { $in: types }
        });

        const feeDefinitions = await FeeModel.find({
          school: schoolId,
          student: { $exists: false },
          year: parseInt(year),
          month: parseInt(month),
          type: { $in: types }
        });

        for (const def of feeDefinitions) {
          const existing = existingFees.find(f => f.type === def.type);
          if (!existing) {
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
              description: def.description
            });
            feesToPay.push(newFee);
            calculatedTotal += def.amount;
          } else if (existing.status === 'pending') {
            feesToPay.push(existing);
            calculatedTotal += existing.amount;
          }
        }
      }

      if (calculatedTotal !== totalAmount) {
        return res.status(400).json({ 
          message: 'Payment amount mismatch',
          calculatedAmount: calculatedTotal,
          providedAmount: totalAmount
        });
      }

      const receiptNumber = `REC-CASH-${Date.now()}`;
      const payment = new PaymentModel({
        school: schoolId,
        student: student._id,
        amount: totalAmount,
        feeType: feesToPay.map(f => f.type).join(','),
        paymentMethod: 'cash',
        status: 'completed',
        paymentDate: new Date(),
        receiptNumber,
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

      res.json({ 
        message: 'Cash payment processed successfully', 
        payment,
        paidFees: feesToPay.map(fee => ({
          type: fee.type,
          amount: fee.amount,
          month: fee.month,
          year: fee.year
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

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
};

module.exports = feesController;