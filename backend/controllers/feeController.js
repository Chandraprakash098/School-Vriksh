// const cloudinary = require("cloudinary").v2;
// const Razorpay = require("razorpay");
// const crypto = require("crypto");
// const axios = require("axios");
// const Fee = require("../models/Fee");
// const User = require("../models/User");
// const Payment = require("../models/Payment");
// const mongoose = require("mongoose");
// const { generateFeeSlip } = require("../utils/helpers");

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// const feesController = {
//   defineFeesForYear: async (req, res) => {
//     try {
//       const { year, feeTypes, overrideExisting = false } = req.body; // Added overrideExisting option
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

      
//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({
//           message: "Unauthorized: Only fee managers can define fees",
//         });
//       }

      
//       if (!year || !feeTypes || !Array.isArray(feeTypes)) {
//         return res.status(400).json({
//           message: "Year and feeTypes array are required",
//         });
//       }

//       if (!Number.isInteger(Number(year))) {
//         return res.status(400).json({
//           message: "Year must be a valid integer",
//         });
//       }

      
//       const validFeeTypes = [
//         "school",
//         "computer",
//         "transportation",
//         "examination",
//         "classroom",
//         "educational",
//       ];

      
//       const validationErrors = [];
//       feeTypes.forEach((feeType, index) => {
//         const { type, amount, description } = feeType;

//         if (!validFeeTypes.includes(type)) {
//           validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
//         }

//         if (
//           typeof amount !== "number" ||
//           amount <= 0 ||
//           !Number.isFinite(amount)
//         ) {
//           validationErrors.push(
//             `Invalid amount for ${type} at index ${index}: ${amount}`
//           );
//         }

//         if (description && typeof description !== "string") {
//           validationErrors.push(
//             `Description must be a string for ${type} at index ${index}`
//           );
//         }
//       });

//       if (validationErrors.length > 0) {
//         return res.status(400).json({
//           message: "Validation failed",
//           errors: validationErrors,
//         });
//       }

     
//       const existingFees = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//         year: parseInt(year),
//       });

//       if (existingFees.length > 0 && !overrideExisting) {
//         return res.status(409).json({
//           message: `Fees for ${year} are already defined. Use overrideExisting: true to update.`,
//         });
//       }

      
//       const feeDefinitions = [];
//       const operations = [];

//       for (let month = 1; month <= 12; month++) {
//         for (const feeType of feeTypes) {
//           const { type, amount, description } = feeType;
//           const dueDate = new Date(year, month - 1, 28);

//           const feeData = {
//             school: schoolId,
//             type,
//             amount,
//             dueDate,
//             month,
//             year: parseInt(year),
//             description: description || `${type} fee for ${month}/${year}`,
//             status: "pending",
//             updatedAt: new Date(),
//           };

//           const existingFee = existingFees.find(
//             (f) => f.type === type && f.month === month
//           );

//           if (existingFee && overrideExisting) {
//             // Update existing fee
//             operations.push({
//               updateOne: {
//                 filter: { _id: existingFee._id },
//                 update: { $set: feeData },
//               },
//             });
//           } else if (!existingFee) {
//             // Create new fee
//             feeDefinitions.push(new FeeModel(feeData));
//           }
//         }
//       }

      
//       let createdCount = 0;
//       let updatedCount = 0;

//       if (feeDefinitions.length > 0) {
//         const created = await FeeModel.insertMany(feeDefinitions);
//         createdCount = created.length;
//       }

//       if (operations.length > 0) {
//         const result = await FeeModel.bulkWrite(operations);
//         updatedCount = result.modifiedCount;
//       }

//       res.status(201).json({
//         message: `Fees for ${year} processed successfully`,
//         createdCount,
//         updatedCount,
//         totalProcessed: createdCount + updatedCount,
//       });
//     } catch (error) {
//       console.error("Error defining fees:", error);
//       res.status(500).json({
//         error: "Internal server error",
//         details: error.message,
//       });
//     }
//   },

//   getFeeDefinitionsByYear: async (req, res) => {
//     try {
//       const { year } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       if (!req.user.permissions.canManageFees) {
//         return res
//           .status(403)
//           .json({
//             message: "Unauthorized: Only fee managers can view fee definitions",
//           });
//       }

     
//       if (!Number.isInteger(Number(year))) {
//         return res
//           .status(400)
//           .json({ message: "Year must be a valid integer" });
//       }

      
//       const feeDefinitions = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false }, // General fee definitions
//         year: parseInt(year),
//       }).sort({ type: 1, month: 1 });

//       if (!feeDefinitions.length) {
//         return res
//           .status(404)
//           .json({ message: `No fee definitions found for ${year}` });
//       }

      
//       const feeSummary = {};
//       const monthlyVariations = {};

//       feeDefinitions.forEach((fee) => {
//         if (!feeSummary[fee.type]) {
//           feeSummary[fee.type] = {
//             amount: fee.amount,
//             description: fee.description,
//             isConsistent: true,
//             monthlyDetails: {},
//           };
//         }

       
//         feeSummary[fee.type].monthlyDetails[fee.month] = {
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description,
//           status: fee.status,
//           id: fee._id,
//         };

        
//         if (fee.amount !== feeSummary[fee.type].amount) {
//           feeSummary[fee.type].isConsistent = false;
//         }
//       });

      
//       const responseData = {
//         year: parseInt(year),
//         fees: {},
//       };

//       for (const [type, data] of Object.entries(feeSummary)) {
//         if (data.isConsistent) {
//           // If fees are consistent across all months, show only yearly data
//           responseData.fees[type] = {
//             annualAmount: data.amount * 12,
//             monthlyAmount: data.amount,
//             description: data.description,
//             status: Object.values(data.monthlyDetails).every(
//               (d) => d.status === "pending"
//             )
//               ? "pending"
//               : "mixed",
//           };
//         } else {
//           // If fees vary by month, show monthly breakdown
//           responseData.fees[type] = {
//             annualAmount: Object.values(data.monthlyDetails).reduce(
//               (sum, d) => sum + d.amount,
//               0
//             ),
//             monthlyBreakdown: data.monthlyDetails,
//           };
//         }
//       }

//       res.json(responseData);
//     } catch (error) {
//       console.error("Error fetching fee definitions:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   editFeesForYear: async (req, res) => {
//     try {
//       const { year, feeUpdates, applyToAllMonths = true } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       // Authorization check
//       if (!req.user.permissions.canManageFees) {
//         return res.status(403).json({
//           message: "Unauthorized: Only fee managers can edit fees",
//         });
//       }

//       // Input validation
//       if (!year || !feeUpdates || !Array.isArray(feeUpdates)) {
//         return res.status(400).json({
//           message: "Year and feeUpdates array are required",
//         });
//       }

//       if (!Number.isInteger(Number(year))) {
//         return res.status(400).json({
//           message: "Year must be a valid integer",
//         });
//       }

//       // Valid fee types
//       const validFeeTypes = [
//         "school",
//         "computer",
//         "transportation",
//         "examination",
//         "classroom",
//         "educational",
//       ];

//       // Validate feeUpdates
//       const validationErrors = [];
//       feeUpdates.forEach((update, index) => {
//         const { type, amount, description, months } = update;

//         if (!validFeeTypes.includes(type)) {
//           validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
//         }

//         if (
//           typeof amount !== "number" ||
//           amount <= 0 ||
//           !Number.isFinite(amount)
//         ) {
//           validationErrors.push(
//             `Invalid amount for ${type} at index ${index}: ${amount}`
//           );
//         }

//         if (description && typeof description !== "string") {
//           validationErrors.push(
//             `Description must be a string for ${type} at index ${index}`
//           );
//         }

//         if (
//           !applyToAllMonths &&
//           (!months ||
//             !Array.isArray(months) ||
//             months.some((m) => !Number.isInteger(m) || m < 1 || m > 12))
//         ) {
//           validationErrors.push(
//             `Invalid months array for ${type} at index ${index}`
//           );
//         }
//       });

//       if (validationErrors.length > 0) {
//         return res.status(400).json({
//           message: "Validation failed",
//           errors: validationErrors,
//         });
//       }

//       // Get existing fees for the year
//       const existingFees = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//         year: parseInt(year),
//       });

//       if (!existingFees.length) {
//         return res.status(404).json({
//           message: `No fee definitions found for ${year} to edit`,
//         });
//       }

//       // Prepare bulk operations
//       const operations = [];

//       for (const update of feeUpdates) {
//         const { type, amount, description, months } = update;
//         const targetMonths = applyToAllMonths
//           ? Array.from({ length: 12 }, (_, i) => i + 1)
//           : months;

//         for (const month of targetMonths) {
//           const existingFee = existingFees.find(
//             (f) => f.type === type && f.month === month
//           );

//           if (existingFee) {
//             operations.push({
//               updateOne: {
//                 filter: { _id: existingFee._id },
//                 update: {
//                   $set: {
//                     amount,
//                     description:
//                       description ||
//                       existingFee.description ||
//                       `${type} fee for ${month}/${year}`,
//                     dueDate: new Date(year, month - 1, 28),
//                     updatedAt: new Date(),
//                   },
//                 },
//               },
//             });
//           } else {
//             // If fee doesn't exist for this month, create it
//             operations.push({
//               insertOne: {
//                 document: {
//                   school: schoolId,
//                   type,
//                   amount,
//                   dueDate: new Date(year, month - 1, 28),
//                   month,
//                   year: parseInt(year),
//                   description:
//                     description || `${type} fee for ${month}/${year}`,
//                   status: "pending",
//                   createdAt: new Date(),
//                   updatedAt: new Date(),
//                 },
//               },
//             });
//           }
//         }
//       }

//       // Execute bulk operations
//       const result = await FeeModel.bulkWrite(operations);

//       res.status(200).json({
//         message: `Fees for ${year} updated successfully`,
//         updatedCount: result.modifiedCount,
//         createdCount: result.insertedCount,
//         totalAffected: result.modifiedCount + result.insertedCount,
//       });
//     } catch (error) {
//       console.error("Error editing fees:", error);
//       res.status(500).json({
//         error: "Internal server error",
//         details: error.message,
//       });
//     }
//   },

//   getAvailableClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require("../models/Class")(connection);
//       const User = require("../models/User")(connection);

//       const allClasses = await Class.find({ school: schoolId })
//         .select("name division academicYear capacity students classTeacher")
//         .populate("classTeacher", "name", User)
//         .sort({ name: 1, division: 1 });

//       res.json({
//         classes: allClasses.map((cls) => ({
//           _id: cls._id,
//           name: cls.name,
//           division: cls.division,
//           academicYear: cls.academicYear,
//           teacher: cls.classTeacher ? cls.classTeacher.name : null,
//           enrolledCount: cls.students ? cls.students.length : 0,
//           capacity: cls.capacity,
//           remainingCapacity:
//             cls.capacity - (cls.students ? cls.students.length : 0),
//         })),
//       });
//     } catch (error) {
//       console.error("Error in getAvailableClasses:", error);
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
//       const PaymentModel = Payment(connection);
//       const ClassModel = require("../models/Class")(connection); // Explicitly load Class model

//       if (!req.user.permissions.canManageFees) {
//         return res
//           .status(403)
//           .json({ message: "Unauthorized: Only fee managers can view fees" });
//       }

//       let objectIdClassId;
//       try {
//         objectIdClassId = new mongoose.Types.ObjectId(classId);
//       } catch (error) {
//         return res.status(400).json({ message: "Invalid class ID format" });
//       }

//       // Get all students in the class with populated class details
//       const students = await UserModel.find({
//         "studentDetails.class": objectIdClassId,
//         school: schoolId,
//       })
//         .select("_id name studentDetails.grNumber studentDetails.class")
//         .populate("studentDetails.class", "name division"); // Populate class with name and division

//       // Get unique fee definitions for the month/year
//       const feeDefinitionsRaw = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//         month: parseInt(month),
//         year: parseInt(year),
//       });

//       // Remove duplicates by fee type
//       const feeDefinitions = Array.from(
//         new Map(feeDefinitionsRaw.map((fee) => [fee.type, fee])).values()
//       );

//       // Get student-specific fee records
//       const studentFees = await FeeModel.find({
//         student: { $in: students.map((s) => s._id) },
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       });

//       // Get payment records
//       const paymentRecords = await PaymentModel.find({
//         student: { $in: students.map((s) => s._id) },
//         school: schoolId,
//         status: "completed",
//         "feesPaid.month": parseInt(month),
//         "feesPaid.year": parseInt(year),
//       });

//       // Create a map of paid fees
//       const paidFeesMap = new Map();
//       paymentRecords.forEach((payment) => {
//         payment.feesPaid.forEach((feePaid) => {
//           if (
//             feePaid.month === parseInt(month) &&
//             feePaid.year === parseInt(year)
//           ) {
//             const key = `${payment.student.toString()}_${feePaid.type}`;
//             paidFeesMap.set(key, {
//               status: "paid",
//               paymentDate: payment.paymentDate,
//             });
//           }
//         });
//       });

//       // Process student fee data
//       const feeData = students.map((student) => {
//         const studentSpecificFees = studentFees.filter(
//           (fee) =>
//             fee.student && fee.student.toString() === student._id.toString()
//         );

//         const feeSummary = {
//           studentId: student._id,
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class
//             ? {
//                 _id: student.studentDetails.class._id,
//                 name: student.studentDetails.class.name,
//                 division: student.studentDetails.class.division,
//               }
//             : null,
//           fees: {},
//           total: 0,
//           allPaid: true,
//         };

//         feeDefinitions.forEach((def) => {
//           const paidFee = studentSpecificFees.find((f) => f.type === def.type);
//           const paymentInfo = paidFeesMap.get(
//             `${student._id.toString()}_${def.type}`
//           );

//           const status = paidFee
//             ? paidFee.status
//             : paymentInfo
//             ? paymentInfo.status
//             : "pending";
//           const paidDate =
//             paidFee?.paymentDetails?.paymentDate ||
//             (paymentInfo ? paymentInfo.paymentDate : null);

//           feeSummary.fees[def.type] = {
//             amount: def.amount,
//             status,
//             paidDate,
//           };

//           feeSummary.total += def.amount;
//           if (status !== "paid") feeSummary.allPaid = false;
//         });

//         return feeSummary;
//       });

//       res.json(feeData);
//     } catch (error) {
//       console.error("Error in getFeesByClassAndMonth:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentByGrNumber: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const getModel = require("../models/index"); // Adjust path to your index.js

//       const UserModel = getModel("User", connection);
//       const FeeModel = getModel("Fee", connection);
//       const PaymentModel = getModel("Payment", connection);
//       const ClassModel = getModel("Class", connection); // Explicitly load Class model

//       if (!req.user.permissions.canManageFees) {
//         return res
//           .status(403)
//           .json({
//             message: "Unauthorized: Only fee managers can view student fees",
//           });
//       }

//       // Query with populated class details
//       const student = await UserModel.findOne({
//         "studentDetails.grNumber": grNumber,
//         school: schoolId,
//       })
//         .select("_id name studentDetails.grNumber studentDetails.class")
//         .populate("studentDetails.class", "name division");

//       if (!student)
//         return res.status(404).json({ message: "Student not found" });
//       if (student.studentDetails.isRTE)
//         return res
//           .status(400)
//           .json({ message: "RTE students are exempted from fees" });

//       // Rest of your existing logic...
//       const generalFees = await FeeModel.find({
//         school: schoolId,
//         student: { $exists: false },
//       }).sort({ year: 1, month: 1 });

//       const studentFees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//       }).sort({ year: 1, month: 1 });

//       const payments = await PaymentModel.find({
//         student: student._id,
//         school: schoolId,
//         status: "completed",
//       });

//       const paidFeesMap = new Map();
//       payments.forEach((payment) => {
//         payment.feesPaid.forEach((feePaid) => {
//           const key = `${feePaid.year}-${feePaid.month}-${feePaid.type}`;
//           paidFeesMap.set(key, {
//             status: "paid",
//             paymentDetails: {
//               transactionId: payment.transactionId || payment.receiptNumber,
//               paymentDate: payment.paymentDate,
//               paymentMethod: payment.paymentMethod,
//               receiptNumber: payment.receiptNumber,
//             },
//           });
//         });
//       });

//       const feeData = {};
//       generalFees.forEach((fee) => {
//         const key = `${fee.year}-${fee.month}`;
//         if (!feeData[key]) {
//           feeData[key] = { total: 0, fees: {} };
//         }
//         feeData[key].fees[fee.type] = {
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description,
//           status: "pending",
//         };
//         feeData[key].total += fee.amount;
//       });

//       studentFees.forEach((fee) => {
//         const key = `${fee.year}-${fee.month}`;
//         if (!feeData[key]) {
//           feeData[key] = { total: 0, fees: {} };
//         }
//         feeData[key].fees[fee.type] = {
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           description: fee.description,
//           status: fee.status,
//           ...(fee.paymentDetails && { paymentDetails: fee.paymentDetails }),
//         };
//         feeData[key].total = Object.values(feeData[key].fees).reduce(
//           (sum, f) => sum + f.amount,
//           0
//         );
//       });

//       Object.keys(feeData).forEach((key) => {
//         const [year, month] = key.split("-");
//         Object.keys(feeData[key].fees).forEach((type) => {
//           const paymentKey = `${year}-${month}-${type}`;
//           if (paidFeesMap.has(paymentKey)) {
//             const paidInfo = paidFeesMap.get(paymentKey);
//             feeData[key].fees[type].status = paidInfo.status;
//             feeData[key].fees[type].paymentDetails = paidInfo.paymentDetails;
//           }
//         });
//       });

//       res.json({
//         student: {
//           _id: student._id,
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class
//             ? {
//                 _id: student.studentDetails.class._id,
//                 name: student.studentDetails.class.name,
//                 division: student.studentDetails.class.division,
//               }
//             : null,
//         },
//         feeData,
//       });
//     } catch (error) {
//       console.error("Error in getStudentByGrNumber:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   payFeesForStudent: async (req, res) => {
//     try {
//       const { grNumber, selectedFees, totalAmount } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       if (!grNumber)
//         return res.status(400).json({ message: "GR Number is required" });
//       if (
//         !selectedFees ||
//         !Array.isArray(selectedFees) ||
//         selectedFees.length === 0
//       )
//         return res
//           .status(400)
//           .json({ message: "Selected fees are required and must be an array" });
//       if (typeof totalAmount !== "number" || totalAmount <= 0)
//         return res
//           .status(400)
//           .json({ message: "Valid total amount is required" });

//       if (!req.user.permissions.canManageFees)
//         return res
//           .status(403)
//           .json({
//             message: "Unauthorized: Only fee managers can process payments",
//           });

//       const student = await UserModel.findOne({
//         "studentDetails.grNumber": grNumber,
//         school: schoolId,
//       });
//       if (!student)
//         return res.status(404).json({ message: "Student not found" });
//       if (student.studentDetails.isRTE)
//         return res
//           .status(400)
//           .json({ message: "RTE students are exempted from fees" });

//       const feesToPay = [];
//       let calculatedTotal = 0;
//       const uniqueFeeKeys = new Set();

//       for (const fee of selectedFees) {
//         const { year, month, types } = fee;
//         if (!year || !month || !types || !Array.isArray(types))
//           return res
//             .status(400)
//             .json({
//               message:
//                 "Invalid fee format: year, month, and types are required",
//             });

//         const existingFees = await FeeModel.find({
//           student: student._id,
//           school: schoolId,
//           year: parseInt(year),
//           month: parseInt(month),
//           type: { $in: types },
//         });

//         const feeDefinitions = await FeeModel.find({
//           school: schoolId,
//           student: { $exists: false },
//           year: parseInt(year),
//           month: parseInt(month),
//           type: { $in: types },
//         });

//         for (const def of feeDefinitions) {
//           const key = `${def.type}-${month}-${year}`;
//           if (uniqueFeeKeys.has(key)) continue;
//           uniqueFeeKeys.add(key);

//           const existing = existingFees.find((f) => f.type === def.type);
//           if (existing && existing.status === "paid") {
//             return res
//               .status(400)
//               .json({
//                 message: `Fee type '${def.type}' for ${month}/${year} is already paid`,
//               });
//           } else if (!existing) {
//             const newFee = new FeeModel({
//               school: schoolId,
//               student: student._id,
//               grNumber: student.studentDetails.grNumber,
//               type: def.type,
//               amount: def.amount,
//               dueDate: def.dueDate,
//               month: parseInt(month),
//               year: parseInt(year),
//               status: "pending",
//               description: def.description,
//             });
//             feesToPay.push(newFee);
//             calculatedTotal += def.amount;
//           } else if (existing.status === "pending") {
//             feesToPay.push(existing);
//             calculatedTotal += existing.amount;
//           }
//         }
//       }

//       if (feesToPay.length === 0)
//         return res
//           .status(400)
//           .json({ message: "No pending fees to pay for the selected types" });

//       if (calculatedTotal !== totalAmount)
//         return res.status(400).json({
//           message: "Payment amount mismatch",
//           calculatedAmount: calculatedTotal,
//           providedAmount: totalAmount,
//         });

//       const receiptNumber = `REC-CASH-${Date.now()}`;
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: student._id,
//         grNumber,
//         amount: totalAmount,
//         paymentMethod: "cash",
//         status: "completed",
//         paymentDate: new Date(),
//         receiptNumber,
//         feesPaid: feesToPay.map((fee) => ({
//           feeId: fee._id || null,
//           type: fee.type,
//           month: fee.month,
//           year: fee.year,
//           amount: fee.amount,
//         })),
//       });

//       await payment.save();

//       const updatePromises = feesToPay.map((fee) => {
//         fee.status = "paid";
//         fee.paymentDetails = {
//           transactionId: receiptNumber,
//           paymentDate: new Date(),
//           paymentMethod: "cash",
//           receiptNumber,
//         };
//         return fee.save();
//       });

//       await Promise.all(updatePromises);

//       // Group fees by month-year for receipt generation
//       const feesByMonthYear = feesToPay.reduce((acc, fee) => {
//         const key = `${fee.month}-${fee.year}`;
//         if (!acc[key]) acc[key] = [];
//         acc[key].push(fee);
//         return acc;
//       }, {});

//       const receiptUrls = {};
//       for (const [key, fees] of Object.entries(feesByMonthYear)) {
//         const [month, year] = key.split("-");
//         const feeSlip = await generateFeeSlip(
//           student,
//           payment,
//           fees,
//           schoolId,
//           `${month}-${year}`
//         );
//         receiptUrls[key] = feeSlip.pdfUrl;
//       }

//       payment.receiptUrl =
//         receiptUrls[`${feesToPay[0].month}-${feesToPay[0].year}`]; // Default to first month-year
//       payment.receiptUrls = receiptUrls; // Store all receipt URLs by month-year
//       await payment.save();

//       res.json({
//         message: "Cash payment processed successfully",
//         payment,
//         paidFees: feesToPay.map((fee) => ({
//           type: fee.type,
//           amount: fee.amount,
//           month: fee.month,
//           year: fee.year,
//         })),
//         receiptUrls,
//       });
//     } catch (error) {
//       console.error("Payment processing error:", error);
//       res.status(500).json({ error: error.message || "Internal server error" });
//     }
//   },

//   verifyPayment: async (req, res) => {
//     try {
//       const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
//         req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);

//       const generatedSignature = crypto
//         .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//         .digest("hex");

//       if (generatedSignature !== razorpay_signature)
//         return res.status(400).json({ message: "Invalid payment signature" });

//       const payment = await PaymentModel.findOne({
//         orderId: razorpay_order_id,
//       });
//       if (!payment)
//         return res.status(404).json({ message: "Payment not found" });

//       payment.status = "completed";
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       payment.receiptNumber = `REC${Date.now()}`;
//       await payment.save();

//       const uniqueFeeKeys = new Set();
//       const feesPaid = payment.feesPaid.filter((feePaid) => {
//         const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
//         if (uniqueFeeKeys.has(key)) return false;
//         uniqueFeeKeys.add(key);
//         return true;
//       });

//       const feeUpdates = feesPaid.map(async (feePaid) => {
//         const fee = await FeeModel.findOne({
//           student: payment.student,
//           school: schoolId,
//           type: feePaid.type,
//           month: feePaid.month,
//           year: feePaid.year,
//         });
//         if (fee) {
//           fee.status = "paid";
//           fee.paymentDetails = {
//             transactionId: razorpay_payment_id,
//             paymentDate: payment.paymentDate,
//             paymentMethod: payment.paymentMethod,
//             receiptNumber: payment.receiptNumber,
//           };
//           await fee.save();
//         }
//       });

//       await Promise.all(feeUpdates);

//       const student = await UserModel.findById(payment.student);
//       const feesByMonthYear = feesPaid.reduce((acc, fee) => {
//         const key = `${fee.month}-${fee.year}`;
//         if (!acc[key]) acc[key] = [];
//         acc[key].push(fee);
//         return acc;
//       }, {});

//       const receiptUrls = {};
//       for (const [key, fees] of Object.entries(feesByMonthYear)) {
//         const [month, year] = key.split("-");
//         const feeSlip = await generateFeeSlip(
//           student,
//           payment,
//           fees,
//           schoolId,
//           `${month}-${year}`
//         );
//         receiptUrls[key] = feeSlip.pdfUrl;
//       }

//       payment.receiptUrl =
//         receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
//       payment.receiptUrls = receiptUrls;
//       await payment.save();

//       res.json({
//         message: "Payment verified successfully",
//         payment,
//         receiptUrls,
//       });
//     } catch (error) {
//       console.error("Error in verifyPayment:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   downloadReceipt: async (req, res) => {
//     try {
//       const { paymentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);

//       const payment = await PaymentModel.findOne({
//         _id: paymentId,
//         school: schoolId,
//         status: "completed",
//       }).populate(
//         "student",
//         "name studentDetails.grNumber studentDetails.class"
//       );

//       if (!payment) {
//         return res
//           .status(404)
//           .json({ message: "Payment not found or not completed" });
//       }

//       let receiptUrl = payment.receiptUrl;

//       if (!receiptUrl) {
//         // Regenerate receipt if URL is missing
//         const feeSlip = await generateFeeSlip(
//           payment.student,
//           payment,
//           payment.feesPaid,
//           schoolId
//         );
//         payment.receiptUrl = feeSlip.pdfUrl;
//         receiptUrl = feeSlip.pdfUrl;
//         await payment.save();
//       }

//       // Extract the public ID from the receiptUrl
//       const publicId = receiptUrl
//         .match(/fee_receipts\/receipt_FS-[^\/]+\.pdf/)[0]
//         .replace(".pdf", "");

//       // Generate a signed URL with an expiration time (e.g., 1 hour = 3600 seconds)
//       const expires = Math.floor(Date.now() / 1000) + 3600; // Current time + 1 hour
//       const signedUrl = cloudinary.utils.private_download_url(publicId, "pdf", {
//         resource_type: "raw",
//         expires_at: expires,
//       });

//       res.json({
//         message: "Receipt ready for download",
//         receiptUrl: signedUrl,
//       });
//     } catch (error) {
//       console.error("Error generating signed URL for receipt:", error);
//       res
//         .status(500)
//         .json({ error: error.message || "Failed to generate signed URL" });
//     }
//   },

//   getStudentFeeHistory: async (req, res) => {
//     try {
//       const { grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const getModel = require("../models/index"); // Adjust path to your index.js

//       // Load models using getModel
//       const UserModel = getModel("User", connection);
//       const FeeModel = getModel("Fee", connection);
//       const PaymentModel = getModel("Payment", connection);
//       const ClassModel = getModel("Class", connection); // Explicitly load Class model

//       if (!req.user.permissions.canManageFees) {
//         return res
//           .status(403)
//           .json({
//             message: "Unauthorized: Only fee managers can view fee history",
//           });
//       }

//       // Query student with populated class details
//       const student = await UserModel.findOne({
//         "studentDetails.grNumber": grNumber,
//         school: schoolId,
//       })
//         .select("_id name studentDetails.grNumber studentDetails.class")
//         .populate("studentDetails.class", "name division"); // Populate class with name and division

//       if (!student) {
//         return res.status(404).json({ message: "Student not found" });
//       }

//       if (student.studentDetails.isRTE) {
//         return res.status(200).json({
//           message: "RTE students are exempted from fees",
//           student: {
//             _id: student._id,
//             name: student.name,
//             grNumber: student.studentDetails.grNumber,
//             class: student.studentDetails.class
//               ? {
//                   _id: student.studentDetails.class._id,
//                   name: student.studentDetails.class.name,
//                   division: student.studentDetails.class.division,
//                 }
//               : null,
//           },
//           feeHistory: [],
//         });
//       }

//       const payments = await PaymentModel.find({
//         student: student._id,
//         school: schoolId,
//         status: "completed",
//       }).sort({ paymentDate: -1 });

//       const fees = await FeeModel.find({
//         student: student._id,
//         school: schoolId,
//       }).sort({ year: -1, month: -1 });

//       // Group fees by month-year across all payments
//       const feesByMonthYear = {};
//       const receiptUrlsByMonthYear = {};
//       const paymentIdsByMonthYear = {};

//       await Promise.all(
//         payments.map(async (payment) => {
//           const uniqueFeeKeys = new Set();
//           const feesPaidDetails = payment.feesPaid
//             .filter((feePaid) => {
//               const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
//               if (uniqueFeeKeys.has(key)) return false;
//               uniqueFeeKeys.add(key);
//               return true;
//             })
//             .map((feePaid) => ({
//               type: feePaid.type,
//               month: feePaid.month,
//               year: feePaid.year,
//               amount: feePaid.amount,
//               status: "paid",
//               paymentDetails: {
//                 transactionId: payment.transactionId || "N/A",
//                 paymentDate: payment.paymentDate,
//                 paymentMethod: payment.paymentMethod,
//                 receiptNumber: payment.receiptNumber,
//                 paymentId: payment._id.toString(),
//               },
//             }));

//           feesPaidDetails.forEach((fee) => {
//             const key = `${fee.month}-${fee.year}`;
//             if (!feesByMonthYear[key]) feesByMonthYear[key] = [];
//             feesByMonthYear[key].push(fee);

//             if (payment.receiptUrls && payment.receiptUrls[key]) {
//               receiptUrlsByMonthYear[key] = payment.receiptUrls[key];
//             } else if (!receiptUrlsByMonthYear[key]) {
//               receiptUrlsByMonthYear[key] = payment.receiptUrl;
//             }

//             if (
//               !paymentIdsByMonthYear[key] ||
//               new Date(payment.paymentDate) >
//                 new Date(feesByMonthYear[key][0].paymentDetails.paymentDate)
//             ) {
//               paymentIdsByMonthYear[key] = payment._id.toString();
//             }
//           });

//           for (const [key, fees] of Object.entries(feesByMonthYear)) {
//             if (!receiptUrlsByMonthYear[key]) {
//               const [month, year] = key.split("-");
//               const feeSlip = await generateFeeSlip(
//                 student,
//                 payment,
//                 fees,
//                 schoolId,
//                 `${month}-${year}`
//               );
//               receiptUrlsByMonthYear[key] = feeSlip.pdfUrl;

//               if (!payment.receiptUrls) payment.receiptUrls = {};
//               payment.receiptUrls[key] = feeSlip.pdfUrl;
//               await payment.save();
//             }
//           }
//         })
//       );

//       // Convert grouped fees into feeHistory format
//       const feeHistory = Object.entries(feesByMonthYear).map(([key, fees]) => {
//         const [month, year] = key.split("-");
//         const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
//         const latestPayment = fees.reduce((latest, fee) =>
//           new Date(fee.paymentDetails.paymentDate) >
//           new Date(latest.paymentDetails.paymentDate)
//             ? fee
//             : latest
//         );

//         return {
//           paymentId: paymentIdsByMonthYear[key],
//           month: parseInt(month),
//           year: parseInt(year),
//           totalAmount,
//           paymentDate: latestPayment.paymentDetails.paymentDate,
//           paymentMethod: latestPayment.paymentDetails.paymentMethod,
//           receiptNumber: latestPayment.paymentDetails.receiptNumber,
//           receiptUrl: receiptUrlsByMonthYear[key],
//           fees,
//         };
//       });

//       const paidFeeKeys = new Set(
//         payments.flatMap((p) =>
//           p.feesPaid.map((f) => `${f.year}-${f.month}-${f.type}`)
//         )
//       );
//       const pendingFees = fees
//         .filter(
//           (fee) =>
//             !paidFeeKeys.has(`${fee.year}-${fee.month}-${fee.type}`) &&
//             fee.status === "pending"
//         )
//         .map((fee) => ({
//           type: fee.type,
//           month: fee.month,
//           year: fee.year,
//           amount: fee.amount,
//           dueDate: fee.dueDate,
//           status: "pending",
//           paymentDetails: null,
//         }));

//       res.status(200).json({
//         student: {
//           _id: student._id,
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class
//             ? {
//                 _id: student.studentDetails.class._id,
//                 name: student.studentDetails.class.name,
//                 division: student.studentDetails.class.division,
//               }
//             : null,
//         },
//         feeHistory: [
//           ...feeHistory.sort(
//             (a, b) =>
//               new Date(b.year, b.month - 1) - new Date(a.year, a.month - 1)
//           ),
//           ...pendingFees.sort(
//             (a, b) =>
//               new Date(b.year, b.month - 1) - new Date(a.year, a.month - 1)
//           ),
//         ],
//       });
//     } catch (error) {
//       console.error("Error fetching fee history:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getTotalEarningsByYear: async (req, res) => {
//     try {
//       const { year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       if (!year) return res.status(400).json({ message: "Year is required" });

//       const totalEarnings = await PaymentModel.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId),
//             status: "completed",
//             $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year)] },
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalAmount: { $sum: "$amount" },
//           },
//         },
//       ]);

//       const totalReceived =
//         totalEarnings.length > 0 ? totalEarnings[0].totalAmount : 0;

//       const totalFees = await FeeModel.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId),
//             student: { $exists: false }, // General fee definitions
//             year: parseInt(year),
//           },
//         },
//         {
//           $group: {
//             _id: "$type",
//             totalAmount: { $sum: "$amount" },
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalAmount: { $sum: "$totalAmount" },
//           },
//         },
//       ]);

//       const totalDefined = totalFees.length > 0 ? totalFees[0].totalAmount : 0;
//       const totalPending = totalDefined - totalReceived;

//       const prevYearEarnings = await PaymentModel.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId),
//             status: "completed",
//             $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year) - 1] },
//           },
//         },
//         {
//           $group: {
//             _id: null,
//             totalAmount: { $sum: "$amount" },
//           },
//         },
//       ]);

//       const prevTotal =
//         prevYearEarnings.length > 0 ? prevYearEarnings[0].totalAmount : 0;
//       const growth = totalReceived - prevTotal;

//       res.json({
//         totalEarning: totalReceived,
//         totalReceived,
//         totalPending: totalPending >= 0 ? totalPending : 0,
//         growth: growth >= 0 ? growth : 0,
//       });
//     } catch (error) {
//       console.error("Error calculating total earnings:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getSchoolDetails: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const SchoolModel = require("../models/School")(connection);

//       const school = await SchoolModel.findById(schoolId).select(
//         "name address"
//       );
//       if (!school) {
//         return res.status(404).json({ message: "School not found" });
//       }

//       res.json({
//         name: school.name,
//         address: school.address,
//       });
//     } catch (error) {
//       console.error("Error fetching school details:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   requestLeave: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { reason, startDate, endDate, type } = req.body;
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require("../models/Leave")(connection);

//       const leave = new Leave({
//         school: schoolId,
//         user: clerkId,
//         reason,
//         startDate,
//         endDate,
//         type,
//         status: "pending",
//         appliedOn: new Date(),
//       });

//       await leave.save();
//       res.status(201).json(leave);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getLeaveStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require("../models/Leave")(connection);

//       const leaves = await Leave.find({ school: schoolId, user: clerkId })
//         .sort({ appliedOn: -1 })
//         .lean();

//       res.json({
//         status: "success",
//         count: leaves.length,
//         leaves: leaves.map((leave) => ({
//           id: leave._id,
//           reason: leave.reason,
//           startDate: leave.startDate,
//           endDate: leave.endDate,
//           type: leave.type,
//           status: leave.status,
//           appliedOn: leave.appliedOn,
//           reviewedBy: leave.reviewedBy,
//           reviewedAt: leave.reviewedAt,
//           comments: leave.comments,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = feesController;



const cloudinary = require("cloudinary").v2;
const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const Fee = require("../models/Fee");
const User = require("../models/User");
const Payment = require("../models/Payment");
const mongoose = require("mongoose");
const { generateFeeSlip } = require("../utils/helpers");
const { AuditLog } = require("../models/AuditLog");
const Discount = require("../models/Discount");
const Class = require("../models/Class");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const feesController = {
  defineFeesForYear: async (req, res) => {
    try {
      const { year, feeTypes, overrideExisting = false, currency = "INR" } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const AuditLogModel = AuditLog(connection)

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can define fees",
        });
      }

      if (!year || !feeTypes || !Array.isArray(feeTypes)) {
        return res.status(400).json({
          message: "Year and feeTypes array are required",
        });
      }

      if (!Number.isInteger(Number(year))) {
        return res.status(400).json({
          message: "Year must be a valid integer",
        });
      }

      const existingFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
      });

      if (existingFees.length > 0 && !overrideExisting) {
        return res.status(409).json({
          message: `Fees for ${year} are already defined. Use overrideExisting: true to update.`,
        });
      }

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
            status: "pending",
            updatedAt: new Date(),
            currency,
          };

          const existingFee = existingFees.find(
            (f) => f.type === type && f.month === month
          );

          if (existingFee && overrideExisting) {
            operations.push({
              updateOne: {
                filter: { _id: existingFee._id },
                update: { $set: feeData },
              },
            });
          } else if (!existingFee) {
            feeDefinitions.push(new FeeModel(feeData));
          }
        }
      }

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

      // Log fee definition action
      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: overrideExisting ? "fee_updated" : "fee_defined",
        entity: "Fee",
        details: { year, feeTypes, createdCount, updatedCount },
      });

      res.status(201).json({
        message: `Fees for ${year} processed successfully`,
        createdCount,
        updatedCount,
        totalProcessed: createdCount + updatedCount,
      });
    } catch (error) {
      console.error("Error defining fees:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  },

  getFeeDefinitionsByYear: async (req, res) => {
    try {
      const { year } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view fee definitions",
        });
      }

      if (!Number.isInteger(Number(year))) {
        return res.status(400).json({ message: "Year must be a valid integer" });
      }

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
      }).sort({ type: 1, month: 1 });

      if (!feeDefinitions.length) {
        return res.status(404).json({ message: `No fee definitions found for ${year}` });
      }

      const feeSummary = {};
      feeDefinitions.forEach((fee) => {
        if (!feeSummary[fee.type]) {
          feeSummary[fee.type] = {
            amount: fee.amount,
            description: fee.description,
            currency: fee.currency,
            isConsistent: true,
            monthlyDetails: {},
          };
        }

        feeSummary[fee.type].monthlyDetails[fee.month] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: fee.status,
          id: fee._id,
        };

        if (fee.amount !== feeSummary[fee.type].amount) {
          feeSummary[fee.type].isConsistent = false;
        }
      });

      const responseData = {
        year: parseInt(year),
        fees: {},
      };

      for (const [type, data] of Object.entries(feeSummary)) {
        if (data.isConsistent) {
          responseData.fees[type] = {
            annualAmount: data.amount * 12,
            monthlyAmount: data.amount,
            description: data.description,
            currency: data.currency,
            status: Object.values(data.monthlyDetails).every((d) => d.status === "pending")
              ? "pending"
              : "mixed",
          };
        } else {
          responseData.fees[type] = {
            annualAmount: Object.values(data.monthlyDetails).reduce(
              (sum, d) => sum + d.amount,
              0
            ),
            monthlyBreakdown: data.monthlyDetails,
            currency: data.currency,
          };
        }
      }

      res.json(responseData);
    } catch (error) {
      console.error("Error fetching fee definitions:", error);
      res.status(500).json({ error: error.message });
    }
  },

  editFeesForYear: async (req, res) => {
    try {
      const { year, feeUpdates, applyToAllMonths = true } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const AuditLogModel =AuditLog(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can edit fees",
        });
      }

      if (!year || !feeUpdates || !Array.isArray(feeUpdates)) {
        return res.status(400).json({
          message: "Year and feeUpdates array are required",
        });
      }

      if (!Number.isInteger(Number(year))) {
 tesp.status(400).json({
          message: "Year must be a valid integer",
        });
      }

      const existingFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
      });

      if (!existingFees.length) {
        return res.status(404).json({
          message: `No fee definitions found for ${year} to edit`,
        });
      }

      const operations = [];

      for (const update of feeUpdates) {
        const { type, amount, description, months, currency } = update;
        const targetMonths = applyToAllMonths
          ? Array.from({ length: 12 }, (_, i) => i + 1)
          : months;

        for (const month of targetMonths) {
          const existingFee = existingFees.find(
            (f) => f.type === type && f.month === month
          );

          if (existingFee) {
            operations.push({
              updateOne: {
                filter: { _id: existingFee._id },
                update: {
                  $set: {
                    amount,
                    description:
                      description ||
                      existingFee.description ||
                      `${type} fee for ${month}/${year}`,
                    dueDate: new Date(year, month - 1, 28),
                    updatedAt: new Date(),
                    currency: currency || existingFee.currency,
                  },
                },
              },
            });
          } else {
            operations.push({
              insertOne: {
                document: {
                  school: schoolId,
                  type,
                  amount,
                  dueDate: new Date(year, month - 1, 28),
                  month,
                  year: parseInt(year),
                  description:
                    description || `${type} fee for ${month}/${year}`,
                  status: "pending",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  currency: currency || "INR",
                },
              },
            });
          }
        }
      }

      const result = await FeeModel.bulkWrite(operations);

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "fee_edited",
        entity: "Fee",
        details: { year, feeUpdates, modifiedCount: result.modifiedCount, insertedCount: result.insertedCount },
      });

      res.status(200).json({
        message: `Fees for ${year} updated successfully`,
        updatedCount: result.modifiedCount,
        createdCount: result.insertedCount,
        totalAffected: result.modifiedCount + result.insertedCount,
      });
    } catch (error) {
      console.error("Error editing fees:", error);
      res.status(500).json({
        error: "Internal server error",
        details: error.message,
      });
    }
  },

  applyDiscount: async (req, res) => {
    try {
      const { studentId, type, amount, percentage, description, applicableFeeTypes, validFrom, validUntil } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const DiscountModel = Discount(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const AuditLogModel = AuditLog(connection)

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can apply discounts",
        });
      }

      if (!type || (!amount && !percentage) || !validFrom || !validUntil) {
        return res.status(400).json({
          message: "Type, amount or percentage, validFrom, and validUntil are required",
        });
      }

      if (studentId) {
        const student = await UserModel.findById(studentId);
        if (!student || student.school.toString() !== schoolId) {
          return res.status(404).json({ message: "Student not found" });
        }
      }

      const discount = new DiscountModel({
        school: schoolId,
        student: studentId || null,
        type,
        amount: amount || 0,
        percentage: percentage || 0,
        description,
        applicableFeeTypes: applicableFeeTypes || [],
        validFrom: new Date(validFrom),
        validUntil: new Date(validUntil),
        status: "active",
      });

      await discount.save();

      // Apply discount to pending fees
      if (studentId && applicableFeeTypes.length > 0) {
        const fees = await FeeModel.find({
          school: schoolId,
          student: studentId,
          type: { $in: applicableFeeTypes },
          status: "pending",
          dueDate: { $gte: new Date(validFrom), $lte: new Date(validUntil) },
        });

        const updatePromises = fees.map(async (fee) => {
          const discountAmount = percentage
            ? (fee.amount * percentage) / 100
            : amount;
          fee.discountApplied = {
            discountId: discount._id,
            amount: discountAmount,
            description: description || `Discount for ${type}`,
          };
          fee.amount -= discountAmount;
          await fee.save();
        });

        await Promise.all(updatePromises);
      }

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "discount_applied",
        entity: "Discount",
        entityId: discount._id,
        details: { type, studentId, amount, percentage, applicableFeeTypes },
      });

      res.status(201).json({
        message: "Discount applied successfully",
        discount,
      });
    } catch (error) {
      console.error("Error applying discount:", error);
      res.status(500).json({ error: error.message });
    }
  },

  bulkAssignFees: async (req, res) => {
    try {
      const { classIds, year, feeTypes } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const ClassModel = Class(connection)
      const AuditLogModel = AuditLog(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can assign fees",
        });
      }

      if (!classIds || !Array.isArray(classIds) || !year || !feeTypes || !Array.isArray(feeTypes)) {
        return res.status(400).json({
          message: "classIds, year, and feeTypes are required",
        });
      }

      const students = await UserModel.find({
        "studentDetails.class": { $in: classIds.map(id => new mongoose.Types.ObjectId(id)) },
        school: schoolId,
      });

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        year: parseInt(year),
        type: { $in: feeTypes.map(f => f.type) },
      });

      const operations = [];
      for (const student of students) {
        for (const feeDef of feeDefinitions) {
          const existingFee = await FeeModel.findOne({
            school: schoolId,
            student: student._id,
            type: feeDef.type,
            month: feeDef.month,
            year: feeDef.year,
          });

          if (!existingFee) {
            operations.push({
              insertOne: {
                document: {
                  school: schoolId,
                  student: student._id,
                  grNumber: student.studentDetails.grNumber,
                  type: feeDef.type,
                  amount: feeDef.amount,
                  dueDate: feeDef.dueDate,
                  month: feeDef.month,
                  year: feeDef.year,
                  description: feeDef.description,
                  status: "pending",
                  currency: feeDef.currency,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              },
            });
          }
        }
      }

      let createdCount = 0;
      if (operations.length > 0) {
        const result = await FeeModel.bulkWrite(operations);
        createdCount = result.insertedCount;
      }

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "bulk_fee_assigned",
        entity: "Fee",
        details: { classIds, year, feeTypes, createdCount },
      });

      res.status(201).json({
        message: "Fees assigned successfully",
        createdCount,
      });
    } catch (error) {
      console.error("Error in bulk fee assignment:", error);
      res.status(500).json({ error: error.message });
    }
  },

  configureLateFee: async (req, res) => {
    try {
      const { year, lateFeeRules } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const AuditLogModel = AuditLog(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can configure late fees",
        });
      }

      if (!year || !lateFeeRules || !Array.isArray(lateFeeRules)) {
        return res.status(400).json({
          message: "Year and lateFeeRules array are required",
        });
      }

      const operations = [];
      for (const rule of lateFeeRules) {
        const { type, amount, daysAfterDue } = rule;
        const fees = await FeeModel.find({
          school: schoolId,
          type,
          year: parseInt(year),
          status: "pending",
          dueDate: { $lt: new Date() },
        });

        for (const fee of fees) {
          const dueDate = new Date(fee.dueDate);
          const daysOverdue = Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24));
          if (daysOverdue >= daysAfterDue && !fee.lateFee.amount) {
            operations.push({
              updateOne: {
                filter: { _id: fee._id },
                update: {
                  $set: {
                    lateFee: {
                      amount,
                      appliedDate: new Date(),
                    },
                    amount: fee.amount + amount,
                    updatedAt: new Date(),
                  },
                },
              },
            });
          }
        }
      }

      let updatedCount = 0;
      if (operations.length > 0) {
        const result = await FeeModel.bulkWrite(operations);
        updatedCount = result.modifiedCount;
      }

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "late_fee_configured",
        entity: "Fee",
        details: { year, lateFeeRules, updatedCount },
      });

      res.status(200).json({
        message: "Late fees configured successfully",
        updatedCount,
      });
    } catch (error) {
      console.error("Error configuring late fees:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getFeeAnalytics: async (req, res) => {
    try {
      const { year } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view analytics",
        });
      }

      const totalEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
            $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year)] },
          },
        },
        {
          $group: {
            _id: { month: { $month: "$paymentDate" } },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.month": 1 } },
      ]);

      const pendingFees = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "pending",
            year: parseInt(year),
          },
        },
        {
          $group: {
            _id: { month: "$month" },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.month": 1 } },
      ]);

      const feeTypeBreakdown = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            year: parseInt(year),
          },
        },
        {
          $group: {
            _id: { type: "$type", status: "$status" },
            total: { $sum: "$amount" },
          },
        },
      ]);

      res.json({
        monthlyEarnings: totalEarnings.map((e) => ({
          month: e._id.month,
          total: e.total,
          paymentCount: e.count,
        })),
        pendingFees: pendingFees.map((p) => ({
          month: p._id.month,
          total: p.total,
          pendingCount: p.count,
        })),
        feeTypeBreakdown: feeTypeBreakdown.reduce((acc, item) => {
          if (!acc[item._id.type]) acc[item._id.type] = {};
          acc[item._id.type][item._id.status] = item.total;
          return acc;
        }, {}),
      });
    } catch (error) {
      console.error("Error fetching fee analytics:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getAuditLogs: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AuditLogModel = AuditLog(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view audit logs",
        });
      }

      const logs = await AuditLogModel.find({ school: schoolId })
        .populate("user", "name")
        .sort({ createdAt: -1 })
        .limit(100);

      res.json({
        logs: logs.map((log) => ({
          id: log._id,
          action: log.action,
          entity: log.entity,
          entityId: log.entityId,
          user: log.user ? log.user.name : "Unknown",
          details: log.details,
          timestamp: log.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getAvailableClasses: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      const allClasses = await Class.find({ school: schoolId })
        .select("name division academicYear capacity students classTeacher")
        .populate("classTeacher", "name", User)
        .sort({ name: 1, division: 1 });

      res.json({
        classes: allClasses.map((cls) => ({
          _id: cls._id,
          name: cls.name,
          division: cls.division,
          academicYear: cls.academicYear,
          teacher: cls.classTeacher ? cls.classTeacher.name : null,
          enrolledCount: cls.students ? cls.students.length : 0,
          capacity: cls.capacity,
          remainingCapacity:
            cls.capacity - (cls.students ? cls.students.length : 0),
        })),
      });
    } catch (error) {
      console.error("Error in getAvailableClasses:", error);
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
      const ClassModel = require("../models/Class")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({ message: "Unauthorized: Only fee managers can view fees" });
      }

      let objectIdClassId;
      try {
        objectIdClassId = new mongoose.Types.ObjectId(classId);
      } catch (error) {
        return res.status(400).json({ message: "Invalid class ID format" });
      }

      const students = await UserModel.find({
        "studentDetails.class": objectIdClassId,
        school: schoolId,
      })
        .select("_id name studentDetails.grNumber studentDetails.class")
        .populate("studentDetails.class", "name division");

      const feeDefinitionsRaw = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
        month: parseInt(month),
        year: parseInt(year),
      });

      const feeDefinitions = Array.from(
        new Map(feeDefinitionsRaw.map((fee) => [fee.type, fee])).values()
      );

      const studentFees = await FeeModel.find({
        student: { $in: students.map((s) => s._id) },
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      });

      const paymentRecords = await PaymentModel.find({
        student: { $in: students.map((s) => s._id) },
        school: schoolId,
        status: "completed",
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
      });

      const paidFeesMap = new Map();
      paymentRecords.forEach((payment) => {
        payment.feesPaid.forEach((feePaid) => {
          if (
            feePaid.month === parseInt(month) &&
            feePaid.year === parseInt(year)
          ) {
            const key = `${payment.student.toString()}_${feePaid.type}`;
            paidFeesMap.set(key, {
              status: "paid",
              paymentDate: payment.paymentDate,
            });
          }
        });
      });

      const feeData = students.map((student) => {
        const studentSpecificFees = studentFees.filter(
          (fee) =>
            fee.student && fee.student.toString() === student._id.toString()
        );

        const feeSummary = {
          studentId: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
          fees: {},
          total: 0,
          allPaid: true,
        };

        feeDefinitions.forEach((def) => {
          const paidFee = studentSpecificFees.find((f) => f.type === def.type);
          const paymentInfo = paidFeesMap.get(
            `${student._id.toString()}_${def.type}`
          );

          const status = paidFee
            ? paidFee.status
            : paymentInfo
            ? paymentInfo.status
            : "pending";
          const paidDate =
            paidFee?.paymentDetails?.paymentDate ||
            (paymentInfo ? paymentInfo.paymentDate : null);

          const amount = paidFee ? paidFee.amount : def.amount;
          const discount = paidFee ? paidFee.discountApplied : null;
          const lateFee = paidFee ? paidFee.lateFee : null;

          feeSummary.fees[def.type] = {
            amount,
            status,
            paidDate,
            discount,
            lateFee,
            currency: def.currency,
          };

          feeSummary.total += amount;
          if (status !== "paid") feeSummary.allPaid = false;
        });

        return feeSummary;
      });

      res.json(feeData);
    } catch (error) {
      console.error("Error in getFeesByClassAndMonth:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getStudentByGrNumber: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const getModel = require("../models/index");
      const UserModel = getModel("User", connection);
      const FeeModel = getModel("Fee", connection);
      const PaymentModel = getModel("Payment", connection);
      const ClassModel = getModel("Class", connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view student fees",
        });
      }

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      })
        .select("_id name studentDetails.grNumber studentDetails.class")
        .populate("studentDetails.class", "name division");

      if (!student)
        return res.status(404).json({ message: "Student not found" });
      if (student.studentDetails.isRTE)
        return res.status(400).json({ message: "RTE students are exempted from fees" });

      const generalFees = await FeeModel.find({
        school: schoolId,
        student: { $exists: false },
      }).sort({ year: 1, month: 1 });

      const studentFees = await FeeModel.find({
        student: student._id,
        school: schoolId,
      }).sort({ year: 1, month: 1 });

      const payments = await PaymentModel.find({
        student: student._id,
        school: schoolId,
        status: "completed",
      });

      const paidFeesMap = new Map();
      payments.forEach((payment) => {
        payment.feesPaid.forEach((feePaid) => {
          const key = `${feePaid.year}-${feePaid.month}-${feePaid.type}`;
          paidFeesMap.set(key, {
            status: "paid",
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
      generalFees.forEach((fee) => {
        const key = `${fee.year}-${fee.month}`;
        if (!feeData[key]) {
          feeData[key] = { total: 0, fees: {} };
        }
        feeData[key].fees[fee.type] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: "pending",
          currency: fee.currency,
        };
        feeData[key].total += fee.amount;
      });

      studentFees.forEach((fee) => {
        const key = `${fee.year}-${fee.month}`;
        if (!feeData[key]) {
          feeData[key] = { total: 0, fees: {} };
        }
        feeData[key].fees[fee.type] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: fee.status,
          currency: fee.currency,
          ...(fee.paymentDetails && { paymentDetails: fee.paymentDetails }),
          discount: fee.discountApplied,
          lateFee: fee.lateFee,
        };
        feeData[key].total = Object.values(feeData[key].fees).reduce(
          (sum, f) => sum + f.amount,
          0
        );
      });

      Object.keys(feeData).forEach((key) => {
        const [year, month] = key.split("-");
        Object.keys(feeData[key].fees).forEach((type) => {
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
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
        },
        feeData,
      });
    } catch (error) {
      console.error("Error in getStudentByGrNumber:", error);
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
      const AuditLogModel = require("../models/Fee").AuditLog(connection);

      if (!grNumber)
        return res.status(400).json({ message: "GR Number is required" });
      if (
        !selectedFees ||
        !Array.isArray(selectedFees) ||
        selectedFees.length === 0
      )
        return res
          .status(400)
          .json({ message: "Selected fees are required and must be an array" });
      if (typeof totalAmount !== "number" || totalAmount <= 0)
        return res
          .status(400)
          .json({ message: "Valid total amount is required" });

      if (!req.user.permissions.canManageFees)
        return res
          .status(403)
          .json({
            message: "Unauthorized: Only fee managers can process payments",
          });

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      });
      if (!student)
        return res.status(404).json({ message: "Student not found" });
      if (student.studentDetails.isRTE)
        return res
          .status(400)
          .json({ message: "RTE students are exempted from fees" });

      const feesToPay = [];
      let calculatedTotal = 0;
      const uniqueFeeKeys = new Set();

      for (const fee of selectedFees) {
        const { year, month, types } = fee;
        if (!year || !month || !types || !Array.isArray(types))
          return res
            .status(400)
            .json({
              message:
                "Invalid fee format: year, month, and types are required",
            });

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

        for (const def of feeDefinitions) {
          const key = `${def.type}-${month}-${year}`;
          if (uniqueFeeKeys.has(key)) continue;
          uniqueFeeKeys.add(key);

          const existing = existingFees.find((f) => f.type === def.type);
          if (existing && existing.status === "paid") {
            return res
              .status(400)
              .json({
                message: `Fee type '${def.type}' for ${month}/${year} is already paid`,
              });
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
              status: "pending",
              description: def.description,
              currency: def.currency,
            });
            feesToPay.push(newFee);
            calculatedTotal += def.amount;
          } else if (existing.status === "pending") {
            feesToPay.push(existing);
            calculatedTotal += existing.amount;
          }
        }
      }

      if (feesToPay.length === 0)
        return res
          .status(400)
          .json({ message: "No pending fees to pay for the selected types" });

      if (calculatedTotal !== totalAmount)
        return res.status(400).json({
          message: "Payment amount mismatch",
          calculatedAmount: calculatedTotal,
          providedAmount: totalAmount,
        });

      const receiptNumber = `REC-CASH-${Date.now()}`;
      const payment = new PaymentModel({
        school: schoolId,
        student: student._id,
        grNumber,
        amount: totalAmount,
        paymentMethod: "cash",
        status: "completed",
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
        fee.status = "paid";
        fee.paymentDetails = {
          transactionId: receiptNumber,
          paymentDate: new Date(),
          paymentMethod: "cash",
          receiptNumber,
        };
        return fee.save();
      });

      await Promise.all(updatePromises);

      const feesByMonthYear = feesToPay.reduce((acc, fee) => {
        const key = `${fee.month}-${fee.year}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(fee);
        return acc;
      }, {});

      const receiptUrls = {};
      for (const [key, fees] of Object.entries(feesByMonthYear)) {
        const [month, year] = key.split("-");
        const feeSlip = await generateFeeSlip(
          student,
          payment,
          fees,
          schoolId,
          `${month}-${year}`
        );
        receiptUrls[key] = feeSlip.pdfUrl;
      }

      payment.receiptUrl =
        receiptUrls[`${feesToPay[0].month}-${feesToPay[0].year}`];
      payment.receiptUrls = receiptUrls;
      await payment.save();

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "payment_processed",
        entity: "Payment",
        entityId: payment._id,
        details: { grNumber, totalAmount, feesPaid: feesToPay.length },
      });

      res.json({
        message: "Cash payment processed successfully",
        payment,
        paidFees: feesToPay.map((fee) => ({
          type: fee.type,
          amount: fee.amount,
          month: fee.month,
          year: fee.year,
          currency: fee.currency,
        })),
        receiptUrls,
      });
    } catch (error) {
      console.error("Payment processing error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
        req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const AuditLogModel = require("../models/Fee").AuditLog(connection);

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature)
        return res.status(400).json({ message: "Invalid payment signature" });

      const payment = await PaymentModel.findOne({
        orderId: razorpay_order_id,
      });
      if (!payment)
        return res.status(404).json({ message: "Payment not found" });

      payment.status = "completed";
      payment.transactionId = razorpay_payment_id;
      payment.paymentDate = new Date();
      payment.receiptNumber = `REC${Date.now()}`;
      await payment.save();

      const uniqueFeeKeys = new Set();
      const feesPaid = payment.feesPaid.filter((feePaid) => {
        const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
        if (uniqueFeeKeys.has(key)) return false;
        uniqueFeeKeys.add(key);
        return true;
      });

      const feeUpdates = feesPaid.map(async (feePaid) => {
        const fee = await FeeModel.findOne({
          student: payment.student,
          school: schoolId,
          type: feePaid.type,
          month: feePaid.month,
          year: feePaid.year,
        });
        if (fee) {
          fee.status = "paid";
          fee.paymentDetails = {
            transactionId: razorpay_payment_id,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptNumber: payment.receiptNumber,
          };
          await fee.save();
        }
      });

      await Promise.all(feeUpdates);

      const student = await UserModel.findById(payment.student);
      const feesByMonthYear = feesPaid.reduce((acc, fee) => {
        const key = `${fee.month}-${fee.year}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(fee);
        return acc;
      }, {});

      const receiptUrls = {};
      for (const [key, fees] of Object.entries(feesByMonthYear)) {
        const [month, year] = key.split("-");
        const feeSlip = await generateFeeSlip(
          student,
          payment,
          fees,
          schoolId,
          `${month}-${year}`
        );
        receiptUrls[key] = feeSlip.pdfUrl;
      }

      payment.receiptUrl =
        receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
      payment.receiptUrls = receiptUrls;
      await payment.save();

      await AuditLogModel.create({
        school: schoolId,
        user: req.user._id,
        action: "payment_verified",
        entity: "Payment",
        entityId: payment._id,
        details: { razorpay_payment_id, feesPaid: feesPaid.length },
      });

      res.json({
        message: "Payment verified successfully",
        payment,
        receiptUrls,
      });
    } catch (error) {
      console.error("Error in verifyPayment:", error);
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
        status: "completed",
      }).populate(
        "student",
        "name studentDetails.grNumber studentDetails.class"
      );

      if (!payment) {
        return res
          .status(404)
          .json({ message: "Payment not found or not completed" });
      }

      let receiptUrl = payment.receiptUrl;

      if (!receiptUrl) {
        const feeSlip = await generateFeeSlip(
          payment.student,
          payment,
          payment.feesPaid,
          schoolId
        );
        payment.receiptUrl = feeSlip.pdfUrl;
        receiptUrl = feeSlip.pdfUrl;
        await payment.save();
      }

      const publicId = receiptUrl
        .match(/fee_receipts\/receipt_FS-[^\/]+\.pdf/)[0]
        .replace(".pdf", "");

      const expires = Math.floor(Date.now() / 1000) + 3600;
      const signedUrl = cloudinary.utils.private_download_url(publicId, "pdf", {
        resource_type: "raw",
        expires_at: expires,
      });

      res.json({
        message: "Receipt ready for download",
        receiptUrl: signedUrl,
      });
    } catch (error) {
      console.error("Error generating signed URL for receipt:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to generate signed URL" });
    }
  },

  getStudentFeeHistory: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const getModel = require("../models/index");
      const UserModel = getModel("User", connection);
      const FeeModel = getModel("Fee", connection);
      const PaymentModel = getModel("Payment", connection);
      const ClassModel = getModel("Class", connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view fee history",
        });
      }

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      })
        .select("_id name studentDetails.grNumber studentDetails.class")
        .populate("studentDetails.class", "name division");

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (student.studentDetails.isRTE) {
        return res.status(200).json({
          message: "RTE students are exempted from fees",
          student: {
            _id: student._id,
            name: student.name,
            grNumber: student.studentDetails.grNumber,
            class: student.studentDetails.class
              ? {
                  _id: student.studentDetails.class._id,
                  name: student.studentDetails.class.name,
                  division: student.studentDetails.class.division,
                }
              : null,
          },
          feeHistory: [],
        });
      }

      const payments = await PaymentModel.find({
        student: student._id,
        school: schoolId,
        status: "completed",
      }).sort({ paymentDate: -1 });

      const fees = await FeeModel.find({
        student: student._id,
        school: schoolId,
      }).sort({ year: -1, month: -1 });

      const feesByMonthYear = {};
      const receiptUrlsByMonthYear = {};
      const paymentIdsByMonthYear = {};

      await Promise.all(
        payments.map(async (payment) => {
          const uniqueFeeKeys = new Set();
          const feesPaidDetails = payment.feesPaid
            .filter((feePaid) => {
              const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
              if (uniqueFeeKeys.has(key)) return false;
              uniqueFeeKeys.add(key);
              return true;
            })
            .map((feePaid) => ({
              type: feePaid.type,
              month: feePaid.month,
              year: feePaid.year,
              amount: feePaid.amount,
              status: "paid",
              currency: feePaid.currency || "INR",
              paymentDetails: {
                transactionId: payment.transactionId || "N/A",
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                receiptNumber: payment.receiptNumber,
                paymentId: payment._id.toString(),
              },
            }));

          feesPaidDetails.forEach((fee) => {
            const key = `${fee.month}-${fee.year}`;
            if (!feesByMonthYear[key]) feesByMonthYear[key] = [];
            feesByMonthYear[key].push(fee);

            if (payment.receiptUrls && payment.receiptUrls[key]) {
              receiptUrlsByMonthYear[key] = payment.receptUrls[key];
            } else if (!receiptUrlsByMonthYear[key]) {
              receiptUrlsByMonthYear[key] = payment.receiptUrl;
            }

            if (
              !paymentIdsByMonthYear[key] ||
              new Date(payment.paymentDate) >
                new Date(feesByMonthYear[key][0].paymentDetails.paymentDate)
            ) {
              paymentIdsByMonthYear[key] = payment._id.toString();
            }
          });

          for (const [key, fees] of Object.entries(feesByMonthYear)) {
            if (!receiptUrlsByMonthYear[key]) {
              const [month, year] = key.split("-");
              const feeSlip = await generateFeeSlip(
                student,
                payment,
                fees,
                schoolId,
                `${month}-${year}`
              );
              receiptUrlsByMonthYear[key] = feeSlip.pdfUrl;

              if (!payment.receiptUrls) payment.receiptUrls = {};
              payment.receiptUrls[key] = feeSlip.pdfUrl;
              await payment.save();
            }
          }
        })
      );

      const feeHistory = Object.entries(feesByMonthYear).map(([key, fees]) => {
        const [month, year] = key.split("-");
        const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);
        const latestPayment = fees.reduce((latest, fee) =>
          new Date(fee.paymentDetails.paymentDate) >
          new Date(latest.paymentDetails.paymentDate)
            ? fee
            : latest
        );

        return {
          paymentId: paymentIdsByMonthYear[key],
          month: parseInt(month),
          year: parseInt(year),
          totalAmount,
          paymentDate: latestPayment.paymentDetails.paymentDate,
          paymentMethod: latestPayment.paymentDetails.paymentMethod,
          receiptNumber: latestPayment.paymentDetails.receiptNumber,
          receiptUrl: receiptUrlsByMonthYear[key],
          fees,
        };
      });

      const paidFeeKeys = new Set(
        payments.flatMap((p) =>
          p.feesPaid.map((f) => `${f.year}-${f.month}-${f.type}`)
        )
      );
      const pendingFees = fees
        .filter(
          (fee) =>
            !paidFeeKeys.has(`${fee.year}-${fee.month}-${fee.type}`) &&
            fee.status === "pending"
        )
        .map((fee) => ({
          type: fee.type,
          month: fee.month,
          year: fee.year,
          amount: fee.amount,
          dueDate: fee.dueDate,
          status: "pending",
          currency: fee.currency,
          paymentDetails: null,
          discount: fee.discountApplied,
          lateFee: fee.lateFee,
        }));

      res.status(200).json({
        student: {
          _id: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
        },
        feeHistory: [
          ...feeHistory.sort(
            (a, b) =>
              new Date(b.year, b.month - 1) - new Date(a.year, a.month - 1)
          ),
          ...pendingFees.sort(
            (a, b) =>
              new Date(b.year, b.month - 1) - new Date(a.year, a.month - 1)
          ),
        ],
      });
    } catch (error) {
      console.error("Error fetching fee history:", error);
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

      if (!year) return res.status(400).json({ message: "Year is required" });

      const totalEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
            $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year)] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const totalReceived =
        totalEarnings.length > 0 ? totalEarnings[0].totalAmount : 0;

      const totalFees = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            student: { $exists: false },
            year: parseInt(year),
          },
        },
        {
          $group: {
            _id: "$type",
            totalAmount: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]);

      const totalDefined = totalFees.length > 0 ? totalFees[0].totalAmount : 0;
      const totalPending = totalDefined - totalReceived;

      const prevYearEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
            $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year) - 1] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const prevTotal =
        prevYearEarnings.length > 0 ? prevYearEarnings[0].totalAmount : 0;
      const growth = totalReceived - prevTotal;

      res.json({
        totalEarning: totalReceived,
        totalReceived,
        totalPending: totalPending >= 0 ? totalPending : 0,
        growth: growth >= 0 ? growth : 0,
      });
    } catch (error) {
      console.error("Error calculating total earnings:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getSchoolDetails: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const SchoolModel = require("../models/School")(connection);

      const school = await SchoolModel.findById(schoolId).select(
        "name address"
      );
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      res.json({
        name: school.name,
        address: school.address,
      });
    } catch (error) {
      console.error("Error fetching school details:", error);
      res.status(500).json({ error: error.message });
    }
  },

  requestLeave: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { reason, startDate, endDate, type } = req.body;
      const clerkId = req.user._id;
      const connection = req.connection;
      const Leave = require("../models/Leave")(connection);

      const leave = new Leave({
        school: schoolId,
        user: clerkId,
        reason,
        startDate,
        endDate,
        type,
        status: "pending",
        appliedOn: new Date(),
      });

      await leave.save();
      res.status(201).json(leave);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getLeaveStatus: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const clerkId = req.user._id;
      const connection = req.connection;
      const Leave = require("../models/Leave")(connection);

      const leaves = await Leave.find({ school: schoolId, user: clerkId })
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: "success",
        count: leaves.length,
        leaves: leaves.map((leave) => ({
          id: leave._id,
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          status: leave.status,
          appliedOn: leave.appliedOn,
          reviewedBy: leave.reviewedBy,
          reviewedAt: leave.reviewedAt,
          comments: leave.comments,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = feesController;

