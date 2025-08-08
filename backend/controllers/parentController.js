// const mongoose = require("mongoose");
// const Razorpay = require("razorpay");
// const crypto = require("crypto");
// const Fee = require("../models/Fee");
// const User = require("../models/User");
// const Payment = require("../models/Payment");
// const { generateFeeSlip } = require("../utils/helpers");

// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// const parentController = {
//   async validateStudent(parentId, studentId, connection) {
//     const UserModel = User(connection);
//     const parent = await UserModel.findById(parentId).select(
//       "studentDetails.children"
//     );
//     if (!parent || !parent.studentDetails || !parent.studentDetails.children) {
//       throw new Error("No children associated with this parent");
//     }
//     if (
//       !parent.studentDetails.children.some(
//         (child) => child.toString() === studentId
//       )
//     ) {
//       throw new Error("This student is not associated with your account");
//     }
//     return true;
//   },

//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require("../models/Attendance")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(
//         (a) => a.status === "present"
//       ).length;
//       const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

//       res.json({
//         attendance,
//         statistics: {
//           totalDays,
//           presentDays,
//           absentDays: totalDays - presentDays,
//           percentage,
//         },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get study materials for a student's parent
//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.dbConnection;
//       const User = require("../models/User")(connection);
//       const StudyMaterial = require("../models/StudyMaterial")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await User.findOne({
//         _id: studentId,
//         school: schoolId,
//       }).select("studentDetails.class");
//       if (
//         !student ||
//         !student.studentDetails ||
//         !student.studentDetails.class
//       ) {
//         return res.status(404).json({ message: "Student class not found" });
//       }

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       })
//         .populate("uploadedBy", "name", User)
//         .sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAssignedHomework: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require("../models/User")(connection);
//       const Homework = require("../models/Homework")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await User.findOne({
//         _id: studentId,
//         school: schoolId,
//       }).select("studentDetails.class");
//       if (
//         !student ||
//         !student.studentDetails ||
//         !student.studentDetails.class
//       ) {
//         return res.status(404).json({ message: "Student class not found" });
//       }

//       const homework = await Homework.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//       })
//         .populate("assignedBy", "name", User)
//         .sort({ dueDate: 1 });

//       const formattedHomework = homework.map((hw) => {
//         const studentSubmission = hw.submissions.find(
//           (sub) => sub.student.toString() === studentId
//         );
//         return {
//           id: hw._id,
//           title: hw.title,
//           description: hw.description,
//           subject: hw.subject,
//           assignedBy: hw.assignedBy ? hw.assignedBy.name : "Unknown",
//           assignedDate: hw.assignedDate,
//           dueDate: hw.dueDate,
//           attachments: hw.attachments,
//           submission: studentSubmission
//             ? {
//                 status: studentSubmission.status,
//                 submissionDate: studentSubmission.submissionDate,
//                 files: studentSubmission.files,
//                 grade: studentSubmission.grade,
//                 feedback: studentSubmission.feedback,
//               }
//             : null,
//         };
//       });

//       res.json(formattedHomework);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Parents cannot submit homework, so this is omitted or can be added as a read-only view if needed

//   // Get exam schedule for a student's parent
//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require("../models/User")(connection);
//       const Exam = require("../models/Exam")(connection);
//       const Subject = require("../models/Subject")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await User.findOne({
//         _id: studentId,
//         school: schoolId,
//       }).select("studentDetails.class");
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: "Student class not found" });
//       }

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       })
//         .populate("subject", "name", Subject)
//         .sort({ date: 1 });

//       const examsWithSeating = exams.map((exam) => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 (s) => s.student.toString() === studentId
//               );
//               if (studentSeat) {
//                 seatInfo = {
//                   room: room.classroom,
//                   row: row.row,
//                   position: studentSeat.position,
//                 };
//                 break;
//               }
//             }
//             if (seatInfo) break;
//           }
//         }
//         return { ...exam.toObject(), seatingInfo: seatInfo };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get results for a student's parent
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require("../models/User")(connection);
//       const Exam = require("../models/Exam")(connection);
//       const Subject = require("../models/Subject")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select("name class subject totalMarks results")
//           .populate("subject", "name", Subject);

//         if (!exam) return res.status(404).json({ message: "Exam not found" });

//         const studentResult = exam.results.find(
//           (r) => r.student.toString() === studentId
//         );
//         if (!studentResult)
//           return res
//             .status(404)
//             .json({ message: "Results not found for this student" });

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = parentController.calculateGrade(percentage);

//         res.json({
//           exam: exam.name,
//           subject: exam.subject.name,
//           marks: studentResult.marks,
//           totalMarks: exam.totalMarks,
//           percentage: percentage.toFixed(2),
//           grade,
//           remarks: studentResult.remarks,
//         });
//       } else {
//         const student = await User.findOne({
//           _id: studentId,
//           school: schoolId,
//         }).select("studentDetails.class");
//         if (!student || !student.studentDetails.class) {
//           return res.status(404).json({ message: "Student class not found" });
//         }

//         const allExams = await Exam.find({
//           school: schoolId,
//           class: student.studentDetails.class,
//         })
//           .select("name subject totalMarks results date")
//           .populate("subject", "name", Subject)
//           .sort({ date: -1 });

//         const results = allExams
//           .map((exam) => {
//             const result = exam.results.find(
//               (r) => r.student.toString() === studentId
//             );
//             if (!result) return null;
//             const percentage = (result.marks / exam.totalMarks) * 100;
//             const grade = parentController.calculateGrade(percentage);
//             return {
//               examId: exam._id,
//               exam: exam.name,
//               subject: exam.subject.name,
//               date: exam.date,
//               marks: result.marks,
//               totalMarks: exam.totalMarks,
//               percentage: percentage.toFixed(2),
//               grade,
//               remarks: result.remarks,
//             };
//           })
//           .filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get report card for a student's parent
//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require("../models/ProgressReport")(connection);
//       const User = require("../models/User")(connection);
//       const Class = require("../models/Class")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate("subjects.teacher", "name", User)
//         .populate("class", "name division", Class)
//         .populate("generatedBy", "name", User);

//       if (!reportCard)
//         return res.status(404).json({ message: "Report card not found" });

//       const overallPerformance = parentController.calculateOverallPerformance(
//         reportCard.subjects
//       );

//       res.json({ ...reportCard.toObject(), overallPerformance });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all fees for a student by selecting fee type (for parent panel)
//   getStudentFeesByType: async (req, res) => {
//     try {
//       const { studentId, feeType } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const fees = await FeeModel.find({
//         student: studentId,
//         school: schoolId,
//         type: feeType,
//       }).sort({ dueDate: 1 });

//       res.json(fees);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeeTypes: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const UserModel = User(connection);
//       const PaymentModel = Payment(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await UserModel.findById(studentId);
//       if (!student)
//         return res.status(404).json({ message: "Student not found" });

//       if (student.studentDetails.isRTE) {
//         return res.json({
//           message: "RTE students are exempted from fees",
//           isRTE: true,
//           feeTypes: [],
//         });
//       }

//       const feeDefinitions = await FeeModel.find({
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       });

//       const paidFees = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         "feesPaid.month": parseInt(month),
//         "feesPaid.year": parseInt(year),
//         status: "completed",
//       });

//       const paidFeeTypes = new Set(
//         paidFees.flatMap((p) => p.feesPaid.map((f) => f.type))
//       );

//       const feeTypesWithStatus = feeDefinitions.map((fee) => ({
//         type: fee.type,
//         label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + " Fee",
//         amount: fee.amount,
//         description: fee.description,
//         isPaid: paidFeeTypes.has(fee.type),
//         paymentDetails:
//           paidFees
//             .find((p) => p.feesPaid.some((f) => f.type === fee.type))
//             ?.feesPaid.find((f) => f.type === fee.type)?.paymentDetails || null,
//       }));

//       res.json({
//         feeTypes: feeTypesWithStatus,
//         studentName: student.name,
//         grNumber: student.studentDetails.grNumber,
//         class: student.studentDetails.class,
//         month: parseInt(month),
//         year: parseInt(year),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   payFeesByType: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { feeTypes, month, year, paymentMethod } = req.body;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await UserModel.findById(studentId);
//       if (!student)
//         return res.status(404).json({ message: "Student not found" });

//       if (student.studentDetails.isRTE) {
//         return res
//           .status(400)
//           .json({ message: "RTE students are exempted from fees" });
//       }

//       if (paymentMethod === "cash") {
//         return res
//           .status(403)
//           .json({
//             message: "Parents cannot pay via cash. Contact the fee manager.",
//           });
//       }

//       const feeDefinitions = await FeeModel.find({
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//         type: { $in: feeTypes },
//       });

//       if (feeDefinitions.length !== feeTypes.length) {
//         return res
//           .status(404)
//           .json({ message: "Some fee types not defined for this month" });
//       }

//       const existingPayments = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         "feesPaid.month": parseInt(month),
//         "feesPaid.year": parseInt(year),
//         "feesPaid.type": { $in: feeTypes },
//         status: "completed",
//       });

//       const paidTypes = new Set(
//         existingPayments.flatMap((p) => p.feesPaid.map((f) => f.type))
//       );
//       const feesToPay = feeDefinitions.filter(
//         (fee) => !paidTypes.has(fee.type)
//       );

//       if (feesToPay.length === 0) {
//         return res
//           .status(400)
//           .json({ message: "All selected fees are already paid" });
//       }

//       const totalAmount = feesToPay.reduce((sum, fee) => sum + fee.amount, 0);
//       const options = {
//         amount: totalAmount * 100,
//         currency: "INR",
//         receipt: `fee_${studentId}_${month}_${year}`,
//       };
//       const order = await razorpay.orders.create(options);

//       const payment = new PaymentModel({
//         school: schoolId,
//         student: studentId,
//         grNumber: student.studentDetails.grNumber,
//         amount: totalAmount,
//         paymentMethod,
//         status: "pending",
//         orderId: order.id,
//         feesPaid: feesToPay.map((fee) => ({
//           feeId: fee._id,
//           type: fee.type,
//           month: parseInt(month),
//           year: parseInt(year),
//           amount: fee.amount,
//         })),
//       });

//       await payment.save();

//       res.json({
//         orderId: order.id,
//         amount: totalAmount * 100,
//         currency: "INR",
//         key: process.env.RAZORPAY_KEY_ID,
//         payment,
//         message: "Payment initiated. Proceed with Razorpay checkout.",
//       });
//     } catch (error) {
//       console.error("Payment Error:", error);
//       res.status(500).json({ error: error.message });
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
//       if (generatedSignature !== razorpay_signature) {
//         return res.status(400).json({ message: "Invalid payment signature" });
//       }

//       const payment = await PaymentModel.findOne({
//         orderId: razorpay_order_id,
//       });
//       if (!payment)
//         return res.status(404).json({ message: "Payment not found" });

//       const student = await UserModel.findById(payment.student);
//       if (!student)
//         return res.status(404).json({ message: "Student not found" });

//       await parentController.validateStudent(
//         req.user._id,
//         payment.student,
//         connection
//       );

//       payment.status = "completed";
//       payment.transactionId = razorpay_payment_id;
//       payment.paymentDate = new Date();
//       payment.receiptNumber = `REC${Date.now()}`;
//       await payment.save();

//       for (const feePaid of payment.feesPaid) {
//         let fee = await FeeModel.findOne({
//           school: schoolId,
//           student: payment.student,
//           type: feePaid.type,
//           month: feePaid.month,
//           year: feePaid.year,
//         });

//         if (!fee) {
//           const feeDefinition = await FeeModel.findOne({
//             school: schoolId,
//             student: { $exists: false },
//             type: feePaid.type,
//             month: feePaid.month,
//             year: feePaid.year,
//           });

//           fee = new FeeModel({
//             school: schoolId,
//             student: payment.student,
//             grNumber: payment.grNumber,
//             type: feePaid.type,
//             amount: feePaid.amount,
//             dueDate:
//               feeDefinition?.dueDate ||
//               new Date(feePaid.year, feePaid.month - 1, 28),
//             month: feePaid.month,
//             year: feePaid.year,
//             status: "paid",
//             description: feeDefinition?.description || "",
//           });
//         } else {
//           fee.status = "paid";
//         }

//         fee.paymentDetails = {
//           transactionId: razorpay_payment_id,
//           paymentDate: payment.paymentDate,
//           paymentMethod: payment.paymentMethod,
//           receiptNumber: payment.receiptNumber,
//         };
//         await fee.save();
//       }

//       const feeSlip = generateFeeSlip(
//         student,
//         payment,
//         payment.feesPaid,
//         schoolId
//       );
//       payment.receiptUrl = feeSlip.pdfUrl;
//       await payment.save();

//       res.json({
//         message: "Payment verified successfully",
//         payment,
//         feeSlip,
//         receiptUrl: feeSlip.pdfUrl,
//       });
//     } catch (error) {
//       console.error("Verification Error:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const payments = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         status: "completed",
//       }).sort({ paymentDate: -1 });

//       const receipts = await Promise.all(
//         payments.map(async (payment) => {
//           const fees = await FeeModel.find({
//             student: studentId,
//             school: schoolId,
//             month: { $in: payment.feesPaid.map((f) => f.month) },
//             year: { $in: payment.feesPaid.map((f) => f.year) },
//             type: { $in: payment.feesPaid.map((f) => f.type) },
//           });
//           return {
//             paymentId: payment._id,
//             receiptNumber: payment.receiptNumber,
//             amount: payment.amount,
//             paymentDate: payment.paymentDate,
//             paymentMethod: payment.paymentMethod,
//             receiptUrl: payment.receiptUrl,
//             fees: fees.map((fee) => ({
//               type: fee.type,
//               amount: fee.amount,
//               month: fee.month,
//               year: fee.year,
//               dueDate: fee.dueDate,
//             })),
//           };
//         })
//       );

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificate (parents can request on behalf of their child)
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require("../models/Certificate")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const validTypes = ["bonafide", "leaving", "transfer"];
//       if (!validTypes.includes(type))
//         return res.status(400).json({ message: "Invalid certificate type" });

//       if (["leaving", "transfer"].includes(type)) {
//         const FeeModel = Fee(connection);
//         const hasPendingFees = await FeeModel.findOne({
//           student: studentId,
//           status: "pending",
//           school: schoolId,
//         });
//         if (hasPendingFees)
//           return res
//             .status(400)
//             .json({ message: "Clear all pending fees first" });
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || "normal",
//         status: "pending",
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request for your child has been submitted.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student certificates for a parent's child
//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require("../models/Certificate")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: "Invalid student ID" });
//       }

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       })
//         .populate("generatedBy", "name email")
//         .sort({ requestDate: -1 });

//       res.json({
//         status: "success",
//         count: certificates.length,
//         certificates: certificates.map((cert) => ({
//           id: cert._id,
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl || null,
//           signedDocumentUrl: cert.signedDocumentUrl || null,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   downloadCertificate: async (req, res) => {
//     try {
//       const { studentId, certificateId, documentKey } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require("../models/Certificate")(connection);
//       const { streamS3Object } = require("../config/s3Upload");

//       await parentController.validateStudent(parentId, studentId, connection);

//       const certificate = await Certificate.findOne({
//         _id: certificateId,
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       });

//       if (!certificate) {
//         return res
//           .status(404)
//           .json({
//             message: "Certificate not found or not available for download",
//           });
//       }

//       const key =
//         certificate.signedDocumentKey &&
//         certificate.signedDocumentKey.endsWith(documentKey)
//           ? certificate.signedDocumentKey
//           : certificate.documentKey &&
//             certificate.documentKey.endsWith(documentKey)
//           ? certificate.documentKey
//           : null;

//       if (!key) {
//         return res.status(404).json({ message: "Document not found" });
//       }

//       await streamS3Object(key, res);
//     } catch (error) {
//       console.error("Error streaming certificate:", error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get library services for a student's parent
//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require("../models/Library")(connection).Library;
//       const BookIssue = require("../models/Library")(connection).BookIssue;

//       await parentController.validateStudent(parentId, studentId, connection);

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ["issued", "overdue"] },
//       }).populate("book", "", Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: "available",
//       }).select("bookTitle author category");

//       const booksWithFine = issuedBooks.map((issue) => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;
//         if (dueDate < today) {
//           const daysOverdue = Math.ceil(
//             (today - dueDate) / (1000 * 60 * 60 * 24)
//           );
//           fine = daysOverdue * 5;
//         }
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? daysOverdue : 0,
//         };
//       });

//       res.json({
//         issuedBooks: booksWithFine,
//         availableBooks,
//         totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get transportation details for a student's parent
//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require("../models/Transportation")(connection);
//       const User = require("../models/User")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate("route driver vehicle");

//       if (!transport)
//         return res
//           .status(404)
//           .json({ message: "Transportation details not found" });

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(
//         (stop) => stop.area === student.studentDetails.address?.area
//       );

//       res.json({
//         ...transport.toObject(),
//         studentPickup: routeStop ? routeStop.pickupTime : null,
//         studentDrop: routeStop ? routeStop.dropTime : null,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get monthly progress for a student's parent
//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require("../models/ProgressReport")(connection);
//       const User = require("../models/User")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       })
//         .populate("subjects.teacher", "name", User)
//         .populate("generatedBy", "name", User);

//       if (!progress)
//         return res
//           .status(404)
//           .json({
//             message: "Progress report not found for the specified month",
//           });

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get event notifications for a student's parent
//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const parentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require("../models/User")(connection);
//       const Event = require("../models/Event")(connection);

//       await parentController.validateStudent(parentId, studentId, connection);

//       const student = await User.findOne({
//         _id: studentId,
//         school: schoolId,
//       }).select("studentDetails.class");
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: "Student class not found" });
//       }

//       const events = await Event.find({
//         school: schoolId,
//         $or: [
//           { targetClass: student.studentDetails.class },
//           { targetType: "all" },
//         ],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Utility functions
//   calculateGrade: (percentage) => {
//     if (percentage >= 90) return "A+";
//     if (percentage >= 80) return "A";
//     if (percentage >= 70) return "B+";
//     if (percentage >= 60) return "B";
//     if (percentage >= 50) return "C+";
//     if (percentage >= 40) return "C";
//     return "F";
//   },

//   calculateOverallPerformance: (subjects) => {
//     return { average: 85, grade: "A" }; // Placeholder logic
//   },
// };

// module.exports = parentController;



const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const Stripe = require("stripe");
const Crypto = require("crypto");
const axios = require("axios");
const Fee = require("../models/Fee");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { generateFeeSlip } = require("../utils/generateFeeSlip");
const { checkRTEExemption } = require("../utils/rteUtils");
const logger = require("../utils/logger");
const { sendPaymentConfirmation } = require("../utils/notifications");
const { getOwnerConnection } = require("../config/database");
const { decrypt } = require("../utils/encryption");
const Class = require("../models/Class");
const {
  uploadToS3,
  getPublicFileUrl,
  streamS3Object,
} = require("../config/s3Upload");


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const parentController = {
  // Get fee types for a specific child
  getFeeTypes: async (req, res) => {
    try {
      const { childId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const PaymentModel = Payment(connection);

      logger.info(
        `getFeeTypes called for parent ${parentId}, childId: ${childId}, month: ${month}, year: ${year}`
      );

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      // Validate student
      const student = await UserModel.findById(childId).select(
        "name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
      );
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (!student.studentDetails.class) {
        return res
          .status(400)
          .json({ message: "Student is not assigned to a class" });
      }

      // Check if student is RTE
      if (student.studentDetails.isRTE) {
        return res.json({
          message: "RTE students are exempted from fees",
          isRTE: true,
          feeTypes: [],
        });
      }

      // Aggregate unique fee definitions for the student's class
      const feeDefinitions = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            month: parseInt(month),
            year: parseInt(year),
            student: null,
            classes: {
              $elemMatch: {
                $eq: new mongoose.Types.ObjectId(student.studentDetails.class),
              },
            },
          },
        },
        {
          $group: {
            _id: {
              type: "$type",
              distanceSlab: "$transportationDetails.distanceSlab",
            },
            type: { $first: "$type" },
            amount: { $first: "$amount" },
            description: { $first: "$description" },
            dueDate: { $first: "$dueDate" },
            transportationDetails: { $first: "$transportationDetails" },
          },
        },
        {
          $project: {
            _id: 0,
            type: 1,
            amount: 1,
            description: 1,
            dueDate: 1,
            transportationDetails: 1,
          },
        },
        { $sort: { type: 1 } },
      ]);

      // Get paid fees for the student
      const paidFees = await PaymentModel.find({
        student: childId,
        school: schoolId,
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
        status: "completed",
      });

      // Create a set of paid fee types with their distance slabs for transportation
      const paidFeeTypes = new Set();
      paidFees.forEach((payment) => {
        payment.feesPaid.forEach((fee) => {
          const key =
            fee.type === "transportation" && fee.transportationSlab
              ? `${fee.type}_${fee.transportationSlab}`
              : fee.type;
          paidFeeTypes.add(key);
        });
      });

      const feeTypesWithStatus = feeDefinitions
        .filter(
          (fee) =>
            fee.type !== "transportation" ||
            (student.studentDetails.transportDetails?.isApplicable &&
              fee.transportationDetails?.distanceSlab ===
                student.studentDetails.transportDetails.distanceSlab)
        )
        .map((fee) => {
          const feeKey =
            fee.type === "transportation" &&
            fee.transportationDetails?.distanceSlab
              ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
              : fee.type;
          const isPaid = paidFeeTypes.has(feeKey);
          const payment = paidFees.find((p) =>
            p.feesPaid.some(
              (f) =>
                f.type === fee.type &&
                (f.type !== "transportation" ||
                  f.transportationSlab ===
                    fee.transportationDetails?.distanceSlab)
            )
          );
          const paymentDetails = isPaid
            ? payment?.feesPaid.find(
                (f) =>
                  f.type === fee.type &&
                  (f.type !== "transportation" ||
                    f.transportationSlab ===
                      fee.transportationDetails?.distanceSlab)
              )?.paymentDetails || null
            : null;

          return {
            type: fee.type,
            label:
              fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + " Fee",
            amount: fee.amount,
            description: fee.description,
            dueDate: fee.dueDate,
            isPaid,
            paymentDetails,
            ...(fee.transportationDetails?.distanceSlab && {
              transportationSlab: fee.transportationDetails.distanceSlab,
            }),
          };
        });

      res.json({
        feeTypes: feeTypesWithStatus,
        name: student.name,
        grNumber: student.studentDetails.grNumber,
        class: student.studentDetails.class,
        month: parseInt(month),
        year: parseInt(year),
      });
    } catch (error) {
      logger.error("getFeeTypes Error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get payment methods for the school
  getPaymentMethods: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);

      const school = await School.findById(schoolId).lean();
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const paymentMethods = school.paymentConfig
        .filter((config) => config.isActive)
        .map((config) => ({
          paymentType: config.paymentType,
          isActive: config.isActive,
          details: {
            bankName: config.details?.bankName,
            accountNumber: config.details?.accountNumber,
            ifscCode: config.details?.ifscCode,
            accountHolderName: config.details?.accountHolderName,
            upiId: config.details?.upiId,
            razorpayKeyId:
              config.paymentType === "razorpay"
                ? decrypt(config.details?.razorpayKeyId)
                : undefined,
            stripePublishableKey:
              config.paymentType === "stripe"
                ? decrypt(config.details?.stripePublishableKey)
                : undefined,
            paytmMid:
              config.paymentType === "paytm"
                ? decrypt(config.details?.paytmMid)
                : undefined,
          },
        }));

      res.json({ paymentMethods });
    } catch (error) {
      logger.error(`Error fetching payment methods: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Pay fees for a specific child
  payFeesByType: async (req, res) => {
    try {
      const { childId } = req.params;
      const { feeTypes, month, year, amounts, selectedPaymentType } = req.body;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection);
      const UserModel = User(connection);
      const ClassModel = require("../models/Class")(connection);

      logger.info("Starting payFeesByType", {
        parentId,
        childId,
        selectedPaymentType,
        feeTypes,
      });

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }
      if (!feeTypes || !Array.isArray(feeTypes) || feeTypes.length === 0) {
        return res.status(400).json({ message: "Fee types are required" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }
      if (parseInt(month) < 1 || parseInt(month) > 12) {
        return res.status(400).json({ message: "Month must be between 1 and 12" });
      }
      if (!selectedPaymentType) {
        return res.status(400).json({ message: "Selected payment type is required" });
      }

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      // Validate student
      const student = await UserModel.findById(childId)
        .select(
          "name email studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails"
        )
        .populate("studentDetails.class", "name division");
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (!student.studentDetails.class) {
        return res
          .status(400)
          .json({ message: "Student is not assigned to a class" });
      }
      if (await checkRTEExemption(student, connection)) {
        return res
          .status(400)
          .json({ message: "RTE students are exempted from fees" });
      }

      // Fetch school payment configuration
      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);
      const school = await School.findById(schoolId)
        .select(
          "+paymentConfig.details.razorpayKeySecret +paymentConfig.details.paytmMerchantKey +paymentConfig.details.stripeSecretKey"
        )
        .lean();
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      logger.info("School payment config", {
        paymentConfig: school.paymentConfig.map((pc) => ({
          paymentType: pc.paymentType,
          isActive: pc.isActive,
          hasDetails: pc.details ? true : false,
          detailsKeys: pc.details ? Object.keys(pc.details) : [],
        })),
      });

      const paymentConfig = school.paymentConfig.find(
        (config) => config.paymentType === selectedPaymentType && config.isActive
      );

      if (!paymentConfig) {
        return res.status(400).json({
          message: `Payment type ${selectedPaymentType} is not configured or active`,
        });
      }

      logger.info("Selected payment config", {
        paymentType: paymentConfig.paymentType,
        isActive: paymentConfig.isActive,
        hasDetails: paymentConfig.details ? true : false,
        detailsKeys: paymentConfig.details ? Object.keys(paymentConfig.details) : [],
      });

      // Aggregate fee definitions
      const feeDefinitions = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            month: parseInt(month),
            year: parseInt(year),
            student: null,
            type: { $in: feeTypes },
            classes: {
              $elemMatch: {
                $eq: new mongoose.Types.ObjectId(student.studentDetails.class._id),
              },
            },
          },
        },
        {
          $group: {
            _id: {
              type: "$type",
              distanceSlab: "$transportationDetails.distanceSlab",
            },
            type: { $first: "$type" },
            amount: { $first: "$amount" },
            description: { $first: "$description" },
            dueDate: { $first: "$dueDate" },
            transportationDetails: { $first: "$transportationDetails" },
          },
        },
        {
          $project: {
            _id: 0,
            type: 1,
            amount: 1,
            description: 1,
            dueDate: 1,
            transportationDetails: 1,
          },
        },
      ]);

      // Validate requested fee types
      const requestedFeeTypes = new Set(feeTypes);
      const availableFeeTypes = new Set(feeDefinitions.map((fee) => fee.type));
      const invalidFeeTypes = [...requestedFeeTypes].filter(
        (type) => !availableFeeTypes.has(type)
      );
      if (invalidFeeTypes.length > 0) {
        return res.status(404).json({
          message: `Invalid or undefined fee types: ${invalidFeeTypes.join(", ")}`,
        });
      }

      // Filter valid fee definitions
      const validFeeDefinitions = feeDefinitions.filter(
        (fee) =>
          fee.type !== "transportation" ||
          (student.studentDetails.transportDetails?.isApplicable &&
            fee.transportationDetails?.distanceSlab ===
              student.studentDetails.transportDetails.distanceSlab)
      );
      if (validFeeDefinitions.length === 0) {
        return res
          .status(400)
          .json({ message: "No valid fee types found for payment" });
      }

      // Fetch existing student fees
      const studentFees = await FeeModel.find({
        student: childId,
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
        type: { $in: feeTypes },
      });

      // Check existing payments
      const existingPayments = await PaymentModel.find({
        student: childId,
        school: schoolId,
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
        "feesPaid.type": { $in: feeTypes },
        status: "completed",
      });

      const paidTypes = new Set(
        existingPayments.flatMap((p) =>
          p.feesPaid.map((f) =>
            f.type === "transportation" && f.transportationSlab
              ? `${f.type}_${f.transportationSlab}`
              : f.type
          )
        )
      );

      // Filter fees to pay
      const feesToPay = validFeeDefinitions.filter((fee) => {
        const feeKey =
          fee.type === "transportation" && fee.transportationDetails?.distanceSlab
            ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
            : fee.type;
        return !paidTypes.has(feeKey);
      });
      if (feesToPay.length === 0) {
        return res
          .status(400)
          .json({ message: "All selected fees are already paid" });
      }

      // Map amounts by type
      const amountMap = amounts
        ? feeTypes.reduce((map, type, index) => {
            map[type] = amounts[index];
            return map;
          }, {})
        : {};

      // Validate payment amounts
      const paymentDetails = feesToPay.map((fee) => {
        const studentFee = studentFees.find((f) => f.type === fee.type);
        const amountToPay = amountMap[fee.type] || fee.amount;
        if (
          amountToPay <= 0 ||
          amountToPay > (studentFee?.remainingAmount || fee.amount)
        ) {
          throw new Error(`Invalid payment amount for ${fee.type}: ${amountToPay}`);
        }
        return {
          fee,
          studentFee,
          amountToPay,
        };
      });

      // Calculate total amount
      const totalAmountInINR = paymentDetails.reduce(
        (sum, { amountToPay }) => sum + amountToPay,
        0
      );
      const totalAmountInPaise = totalAmountInINR * 100;

      // Initialize payment based on selected payment type
      let order, paymentResponse;
      const receiptNumber = `FS-${childId}-${Date.now()}`;

      logger.info("Initializing payment", {
        selectedPaymentType,
        totalAmountInINR,
      });

      // Safely attempt to decrypt credentials
      const safeDecrypt = (encryptedText) => {
        try {
          if (!encryptedText || typeof encryptedText !== "string") {
            logger.error("Invalid encrypted text", {
              encryptedText: typeof encryptedText,
            });
            throw new Error("Invalid encrypted credentials");
          }
          return decrypt(encryptedText);
        } catch (error) {
          logger.error("Decryption error", { error: error.message });
          throw new Error("Failed to decrypt payment credentials");
        }
      };

      if (selectedPaymentType === "razorpay") {
        try {
          logger.info("Razorpay config details check", {
            hasDetails: paymentConfig.details ? true : false,
            hasKeyId: paymentConfig.details?.razorpayKeyId ? true : false,
            hasKeySecret: paymentConfig.details?.razorpayKeySecret ? true : false,
            keyIdType: typeof paymentConfig.details?.razorpayKeyId,
            keySecretType: typeof paymentConfig.details?.razorpayKeySecret,
          });

          if (
            !paymentConfig.details ||
            !paymentConfig.details.razorpayKeyId ||
            !paymentConfig.details.razorpayKeySecret
          ) {
            throw new Error("Razorpay credentials are missing");
          }

          const keyId = safeDecrypt(paymentConfig.details.razorpayKeyId);
          const keySecret = safeDecrypt(paymentConfig.details.razorpayKeySecret);

          logger.info("Razorpay credentials decrypted successfully");

          const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret,
          });

          const options = {
            amount: totalAmountInPaise,
            currency: "INR",
            receipt: `fee_${childId.slice(-8)}_${month}${year}_${Date.now().toString().slice(-10)}`,
          };

          logger.info("Attempting to create Razorpay order", {
            options: { ...options, amount: options.amount },
          });

          order = await razorpay.orders.create(options);

          logger.info("Razorpay order created successfully", {
            orderId: order.id,
          });

          paymentResponse = {
            orderId: order.id,
            amountInPaise: totalAmountInPaise,
            amountInINR: totalAmountInINR,
            currency: "INR",
            key: keyId,
            message: "Payment initiated. Proceed with Razorpay checkout.",
          };
        } catch (error) {
          logger.error("Razorpay initialization error", {
            error: error.message,
            stack: error.stack,
          });
          return res.status(500).json({
            error: "Failed to initialize Razorpay payment",
            details: error.message,
          });
        }
      } else if (selectedPaymentType === "stripe") {
        try {
          logger.info("Stripe config details check", {
            hasDetails: paymentConfig.details ? true : false,
            hasSecretKey: paymentConfig.details?.stripeSecretKey ? true : false,
            hasPublishableKey: paymentConfig.details?.stripePublishableKey
              ? true
              : false,
            secretKeyType: typeof paymentConfig.details?.stripeSecretKey,
            publishableKeyType: typeof paymentConfig.details?.stripePublishableKey,
          });

          if (
            !paymentConfig.details ||
            !paymentConfig.details.stripeSecretKey ||
            !paymentConfig.details.stripePublishableKey
          ) {
            throw new Error("Stripe credentials are missing");
          }

          const stripeSecretKey = safeDecrypt(
            paymentConfig.details.stripeSecretKey
          );
          const stripePublishableKey = safeDecrypt(
            paymentConfig.details.stripePublishableKey
          );

          logger.info("Stripe credentials decrypted successfully");

          const stripe = new Stripe(stripeSecretKey);
          const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmountInPaise,
            currency: "inr",
            payment_method_types: ["card"],
            metadata: {
              childId,
              month,
              year,
              receipt: receiptNumber,
            },
          });
          paymentResponse = {
            clientSecret: paymentIntent.client_secret,
            amountInINR: totalAmountInINR,
            currency: "INR",
            key: stripePublishableKey,
            message: "Payment initiated. Proceed with Stripe checkout.",
          };
        } catch (error) {
          logger.error("Stripe initialization error", {
            error: error.message,
            stack: error.stack,
          });
          return res.status(500).json({
            error: "Failed to initialize Stripe payment",
            details: error.message,
          });
        }
      } else if (selectedPaymentType === "bank_account") {
        paymentResponse = {
          bankDetails: {
            bankName: paymentConfig.details.bankName,
            accountNumber: paymentConfig.details.accountNumber,
            ifscCode: paymentConfig.details.ifscCode,
            accountHolderName: paymentConfig.details.accountHolderName,
          },
          amountInINR: totalAmountInINR,
          receiptNumber,
          message:
            "Please transfer the amount to the provided bank account and upload proof of payment.",
        };
      } else if (selectedPaymentType === "upi") {
        paymentResponse = {
          upiId: paymentConfig.details.upiId,
          amountInINR: totalAmountInINR,
          receiptNumber,
          message:
            "Please send the amount to the provided UPI ID and upload proof of payment.",
        };
      } else if (selectedPaymentType === "paytm") {
        try {
          logger.info("Paytm config details check", {
            hasDetails: paymentConfig.details ? true : false,
            hasMid: paymentConfig.details?.paytmMid ? true : false,
            hasMerchantKey: paymentConfig.details?.paytmMerchantKey ? true : false,
          });

          if (
            !paymentConfig.details ||
            !paymentConfig.details.paytmMid ||
            !paymentConfig.details.paytmMerchantKey
          ) {
            throw new Error("Paytm MID or Merchant Key is missing in payment configuration");
          }

          const mid = safeDecrypt(paymentConfig.details.paytmMid);
          const merchantKey = safeDecrypt(paymentConfig.details.paytmMerchantKey);

          logger.info("Paytm credentials decrypted successfully");

          const timestamp = Date.now();
          const sanitizedOrderId = `ORDER_${childId.substring(0, 8)}_${timestamp}`;
          const txnId = `TXN_${timestamp}`;

          const requestParams = {
            MID: mid,
            ORDER_ID: sanitizedOrderId,
            CHANNEL_ID: "WEB",
            INDUSTRY_TYPE_ID: "Retail",
            WEBSITE: "DEFAULT",
            TXN_AMOUNT: totalAmountInINR.toFixed(2),
            CUST_ID: childId,
            CALLBACK_URL: `${process.env.SERVER_URL}/api/payment/paytm/callback`,
            EMAIL: student.email || "noemail@example.com",
            MOBILE_NO:
              student.studentDetails?.parentDetails?.phoneNumber || "0000000000",
          };

          logger.info("Paytm request params prepared", {
            orderId: requestParams.ORDER_ID,
            amount: requestParams.TXN_AMOUNT,
            hasEmail: !!requestParams.EMAIL,
            hasMobile: !!requestParams.MOBILE_NO,
          });

          const sortedKeys = Object.keys(requestParams).sort();
          const sortedParams = {};
          sortedKeys.forEach((key) => {
            sortedParams[key] = requestParams[key];
          });

          const paramString = Object.keys(sortedParams)
            .map((key) => `${key}=${sortedParams[key]}`)
            .join("&");

          logger.info("Generated param string for signature", {
            paramStringLength: paramString.length,
          });

          const checksum = Crypto.createHmac("sha256", merchantKey)
            .update(paramString)
            .digest("hex");

          logger.info("Generated checksum", {
            checksumLength: checksum.length,
          });

          requestParams.CHECKSUMHASH = checksum;

          const newFee = await FeeModel.findOneAndUpdate(
            {
              school: schoolId,
              student: childId,
              month: parseInt(month),
              year: parseInt(year),
              type: feeTypes[0],
            },
            {
              $push: {
                paymentDetails: {
                  transactionId: txnId,
                  paymentDate: new Date(),
                  paymentMethod: "paytm",
                  receiptNumber: sanitizedOrderId,
                  amount: totalAmountInINR,
                  status: "pending",
                },
              },
            },
            { new: true }
          );

          logger.info("Fee record updated with pending Paytm transaction", {
            feeId: newFee?._id || "Not found",
            transactionId: txnId,
          });

          paymentResponse = {
            formData: requestParams,
            merchantId: mid,
            orderId: sanitizedOrderId,
            txnId: txnId,
            amountInINR: totalAmountInINR,
            receiptNumber: sanitizedOrderId,
            message: "Paytm payment initiated. Form data prepared for redirect.",
            gatewayUrl:
              process.env.PAYTM_ENV === "production"
                ? "https://securegw.paytm.in/theia/processTransaction"
                : "https://securegw-stage.paytm.in/theia/processTransaction",
            environment: process.env.PAYTM_ENV || "staging",
          };

          logger.info("Paytm payment response prepared successfully");
        } catch (error) {
          logger.error("Paytm API error", {
            error: error.message,
            stack: error.stack,
          });
          return res.status(500).json({
            error: "Failed to initialize Paytm payment",
            details: error.message,
          });
        }
      } else {
        return res
          .status(400)
          .json({ message: `Unsupported payment type: ${selectedPaymentType}` });
      }

      logger.info("Payment response prepared", {
        paymentMethod: selectedPaymentType,
        hasResponse: paymentResponse ? true : false,
        responseKeys: paymentResponse ? Object.keys(paymentResponse) : [],
      });

      // Update or create fee documents
      const updatedFees = await Promise.all(
        paymentDetails.map(async ({ fee, studentFee, amountToPay }) => {
          const paymentDetail = {
            transactionId:
              selectedPaymentType === "razorpay"
                ? `PENDING-${order?.id}`
                : `PENDING-${receiptNumber}`,
            paymentDate: new Date(),
            paymentMethod: selectedPaymentType,
            receiptNumber,
            amount: amountToPay,
          };
          if (fee.type === "transportation" && fee.transportationDetails?.distanceSlab) {
            paymentDetail.transportationSlab = fee.transportationDetails.distanceSlab;
          }

          if (!studentFee) {
            const newFee = new FeeModel({
              school: schoolId,
              student: childId,
              grNumber: student.studentDetails.grNumber,
              classes: [student.studentDetails.class._id],
              type: fee.type,
              amount: fee.amount,
              paidAmount: 0,
              remainingAmount: fee.amount,
              dueDate: fee.dueDate,
              month: parseInt(month),
              year: parseInt(year),
              description: fee.description,
              status: "pending",
              isRTE: student.studentDetails.isRTE || false,
              transportationDetails: fee.transportationDetails || null,
              paymentDetails: [paymentDetail],
            });
            await newFee.save();
            return newFee;
          } else {
            studentFee.paymentDetails.push(paymentDetail);
            await studentFee.save();
            return studentFee;
          }
        })
      );

      // Create payment record
      const payment = new PaymentModel({
        school: schoolId,
        student: childId,
        grNumber: student.studentDetails.grNumber,
        amount: totalAmountInINR,
        paymentMethod: selectedPaymentType,
        status: "pending",
        orderId: order?.id || paymentResponse.clientSecret || receiptNumber,
        receiptNumber,
        feesPaid: updatedFees.map((fee) => ({
          feeId: fee._id,
          type: fee.type,
          month: parseInt(month),
          year: parseInt(year),
          amount: fee.paymentDetails[fee.paymentDetails.length - 1].amount,
          ...(fee.type === "transportation" &&
            fee.transportationDetails?.distanceSlab && {
              transportationSlab: fee.transportationDetails.distanceSlab,
            }),
        })),
      });

      await payment.save();

      logger.info("Payment record saved", { paymentId: payment._id });

      // Send confirmation
      await sendPaymentConfirmation(student, payment, null);

      logger.info("Payment confirmation sent");

      res.json({
        payment,
        ...paymentResponse,
      });
    } catch (error) {
      logger.error(`Error initiating payment: ${error.message}`, {
        error: error.stack,
      });
      res.status(error.status || 500).json({ error: error.message });
    }
  },

  // Get fee receipts for a specific child
  getFeeReceipts: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      // Fetch completed payments
      const payments = await PaymentModel.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(childId),
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "student",
            foreignField: "_id",
            as: "student",
          },
        },
        { $unwind: "$student" },
        {
          $lookup: {
            from: "fees",
            let: {
              feeIds: "$feesPaid.feeId",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$_id", "$$feeIds"],
                  },
                },
              },
            ],
            as: "fees",
          },
        },
        { $sort: { paymentDate: -1 } },
      ]);

      const receipts = await Promise.all(
        payments.map(async (payment) => {
          let receiptUrl = payment.receiptUrl;
          let receiptError = null;

          if (!receiptUrl) {
            let attempts = 3;
            while (attempts > 0) {
              try {
                const feeSlip = await generateFeeSlip(
                  payment.student,
                  payment,
                  payment.fees,
                  schoolId,
                  `${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`
                );

                receiptUrl = feeSlip.pdfUrl;

                await PaymentModel.updateOne(
                  { _id: payment._id },
                  {
                    $set: {
                      receiptUrl,
                      [`receiptUrls.${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`]:
                        receiptUrl,
                    },
                  },
                  { session: null }
                );
                break;
              } catch (uploadError) {
                logger.warn(
                  `Failed to generate fee slip for payment ${
                    payment._id
                  }, attempt ${4 - attempts}: ${uploadError.message}`
                );
                attempts--;
                if (attempts === 0) {
                  receiptError = "Failed to generate receipt URL";
                  receiptUrl = null;
                }
              }
            }
          }

          return {
            paymentId: payment._id,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptUrl,
            receiptError,
            receiptUrls: payment.receiptUrls || {},
            student: {
              name: payment.student.name,
              grNumber: payment.student.studentDetails.grNumber,
            },
            fees: payment.fees.map((fee) => ({
              type: fee.type,
              amount: fee.amount,
              paidAmount: fee.paidAmount,
              remainingAmount: fee.remainingAmount,
              month: fee.month,
              year: fee.year,
              dueDate: fee.dueDate,
              status: fee.status,
              ...(fee.transportationDetails?.distanceSlab && {
                transportationSlab: fee.transportationDetails.distanceSlab,
              }),
            })),
          };
        })
      );

      logger.info(`Fee receipts fetched for child ${childId}`);
      res.json(receipts);
    } catch (error) {
      logger.error(`Error fetching fee receipts: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get fee status for a specific child
  getChildFeeStatus: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const FeeModel = Fee(connection);
      const ClassModel = require("../models/Class")(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      // Validate student
      const student = await UserModel.findById(childId)
        .select(
          "_id name studentDetails.isRTE studentDetails.transportDetails studentDetails.class studentDetails.grNumber"
        )
        .populate("studentDetails.class", "name division");
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (!student.studentDetails.class) {
        return res
          .status(400)
          .json({ message: "Student is not assigned to a class" });
      }

      if (await checkRTEExemption(student, connection)) {
        return res.json({
          studentId: student._id,
          grNumber: student.studentDetails.grNumber,
          studentName: student.name,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
          isRTE: true,
          fees: [],
          totalPending: 0,
        });
      }

      // Fetch fees with transportation slab matching
      const fees = await FeeModel.find({
        student: childId,
        school: schoolId,
        status: { $in: ["pending", "partially_paid", "paid"] },
        $or: [
          { type: { $ne: "transportation" } },
          {
            type: "transportation",
            "transportationDetails.isApplicable": true,
            "transportationDetails.distanceSlab":
              student.studentDetails.transportDetails?.distanceSlab,
          },
        ],
      })
        .populate("classes", "name division")
        .sort({ year: 1, month: 1 });

      const feeSummary = fees.map((fee) => ({
        id: fee._id,
        type: fee.type,
        month: fee.month,
        year: fee.year,
        amount: fee.amount,
        paidAmount: fee.paidAmount,
        remainingAmount: fee.remainingAmount,
        dueDate: fee.dueDate,
        status: fee.status,
        description: fee.description,
        ...(fee.transportationDetails?.distanceSlab && {
          transportationSlab: fee.transportationDetails.distanceSlab,
        }),
      }));

      const totalPending = fees.reduce(
        (sum, fee) => sum + fee.remainingAmount,
        0
      );

      logger.info(`Fee status fetched for child ${childId}`);
      res.json({
        studentId: student._id,
        grNumber: student.studentDetails.grNumber,
        studentName: student.name,
        class: student.studentDetails.class
          ? {
              _id: student.studentDetails.class._id,
              name: student.studentDetails.class.name,
              division: student.studentDetails.class.division,
            }
          : null,
        isRTE: false,
        fees: feeSummary,
        totalPending,
      });
    } catch (error) {
      logger.error(`Error fetching child fee status: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // Get attendance for a specific child
  getAttendance: async (req, res) => {
    try {
      const { childId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Attendance = require("../models/Attendance")(connection);
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }
      if (!month || !year || isNaN(parseInt(month)) || isNaN(parseInt(year))) {
        return res
          .status(400)
          .json({ message: "Month and year must be valid numbers" });
      }

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        user: childId,
        school: schoolId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(
        (a) => a.status === "present"
      ).length;
      const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      logger.info(
        `Attendance fetched for child ${childId} for ${month}/${year}`
      );
      res.json({
        attendance,
        statistics: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          percentage: percentage.toFixed(2),
        },
      });
    } catch (error) {
      logger.error(`Error fetching attendance: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

 
  

  // Get assigned homework for a specific child
  getAssignedHomework: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.dbConnection;

      

      const UserModel = User(connection);
      const Homework = require("../models/Homework")(connection);
      const ClassModel = Class(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: childId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: childId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "Child is not enrolled in this class",
        });
      }

      // Fetch homework for the student's class
      const homework = await Homework.find({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("subject", "name")
        .populate("assignedBy", "name")
        .lean()
        .sort({ dueDate: 1 });

      // Format response
      const formattedHomework = homework.map((hw) => {
        const studentSubmission = hw.submissions.find(
          (sub) => sub.student.toString() === childId
        );
        return {
          id: hw._id,
          title: hw.title,
          description: hw.description,
          subject: hw.subject ? hw.subject.name : "Unknown",
          assignedBy: hw.assignedBy ? hw.assignedBy.name : "Unknown",
          assignedDate: hw.assignedDate,
          dueDate: hw.dueDate,
          attachments: hw.attachments,
          submission: studentSubmission
            ? {
                status: studentSubmission.status,
                submissionDate: studentSubmission.submissionDate,
                files: studentSubmission.files,
                grade: studentSubmission.grade,
                feedback: studentSubmission.feedback,
              }
            : null,
        };
      });

      logger.info(`Homework fetched for child ${childId}`);
      res.json({
        message: "Homework retrieved successfully",
        homework: formattedHomework,
      });
    } catch (error) {
      logger.error(`Error fetching homework: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get syllabus for a specific child
  getSyllabus: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      const Syllabus = require("../models/Syllabus")(connection);
      const ClassModel = Class(connection);
      const SubjectModel = require("../models/Subject")(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: childId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: childId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "Child is not enrolled in this class",
        });
      }

      // Fetch syllabus for the student's class
      const syllabi = await Syllabus.find({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("subject", "name")
        .lean()
        .sort({ updatedAt: -1 });

      // Format response
      const formattedSyllabi = syllabi.map((s) => ({
        id: s._id,
        subject: s.subject ? s.subject.name : "Unknown",
        content: s.content,
        documents: s.documents.map((doc) => ({
          title: doc.title,
          url: doc.url,
          uploadedBy: doc.uploadedBy,
          uploadedAt: doc.uploadedAt,
        })),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

      logger.info(`Syllabus fetched for child ${childId}`);
      res.json({
        message: "Syllabus retrieved successfully",
        syllabi: formattedSyllabi,
      });
    } catch (error) {
      logger.error(`Error fetching syllabus: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get exam schedule for a specific child
  getExamSchedule: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);

      // Verify parent-child relationship
      const parent = await User.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const student = await User.findOne({
        _id: childId,
        school: schoolId,
      }).select("studentDetails.class");
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const exams = await Exam.find({
        school: schoolId,
        class: student.studentDetails.class,
        date: { $gte: new Date() },
      })
        .populate("subject", "name", Subject)
        .sort({ date: 1 });

      const examsWithSeating = exams.map((exam) => {
        let seatInfo = null;
        if (exam.seatingArrangement) {
          for (const room of exam.seatingArrangement) {
            for (const row of room.arrangement) {
              const studentSeat = row.students.find(
                (s) => s.student.toString() === childId
              );
              if (studentSeat) {
                seatInfo = {
                  room: room.classroom,
                  row: row.row,
                  position: studentSeat.position,
                };
                break;
              }
            }
            if (seatInfo) break;
          }
        }
        return { ...exam.toObject(), seatingInfo: seatInfo };
      });

      logger.info(`Exam schedule fetched for child ${childId}`);
      res.json(examsWithSeating);
    } catch (error) {
      logger.error(`Error fetching exam schedule: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get results for a specific child
  getResults: async (req, res) => {
    try {
      const { childId } = req.params;
      const { examId } = req.query;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);
      const Result = require("../models/Results")(connection);

      // Verify parent-child relationship
      const parent = await User.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      if (examId) {
        if (!mongoose.Types.ObjectId.isValid(examId)) {
          return res.status(400).json({ message: "Invalid exam ID" });
        }

        const result = await Result.findOne({
          student: childId,
          exam: examId,
          school: schoolId,
          status: "published",
        })
          .populate("exam", "examType customExamType totalMarks")
          .populate("subject", "name");

        if (!result) {
          return res
            .status(404)
            .json({ message: "Result not found or not published" });
        }

        const percentage = (result.marksObtained / result.totalMarks) * 100;
        const grade = parentController.calculateGrade(percentage);

        logger.info(
          `Exam result fetched for child ${childId}, exam ${examId}`
        );
        res.json({
          examId: result.exam._id,
          exam:
            result.exam.examType === "Other"
              ? result.exam.customExamType
              : result.exam.examType,
          subject: result.subject.name,
          marks: result.marksObtained,
          totalMarks: result.totalMarks,
          percentage: percentage.toFixed(2),
          grade,
          remarks: result.remarks,
          marksheet: result.marksheet
            ? {
                url: result.marksheet.url,
                key: result.marksheet.key,
              }
            : null,
        });
      } else {
        const student = await User.findOne({
          _id: childId,
          school: schoolId,
        }).select("studentDetails.class");
        if (!student || !student.studentDetails.class) {
          return res.status(404).json({ message: "Student class not found" });
        }

        const results = await Result.find({
          student: childId,
          school: schoolId,
          class: student.studentDetails.class,
          status: "published",
        })
          .populate("exam", "examType customExamType totalMarks date")
          .populate("subject", "name")
          .sort({ "exam.date": -1 });

        const formattedResults = results.map((result) => {
          const percentage = (result.marksObtained / result.totalMarks) * 100;
          const grade = parentController.calculateGrade(percentage);
          return {
            examId: result.exam._id,
            exam:
              result.exam.examType === "Other"
                ? result.exam.customExamType
                : result.exam.examType,
            subject: result.subject.name,
            date: result.exam.date,
            marks: result.marksObtained,
            totalMarks: result.totalMarks,
            percentage: percentage.toFixed(2),
            grade,
            remarks: result.remarks,
            marksheet: result.marksheet
              ? {
                  url: result.marksheet.url,
                  key: result.marksheet.key,
                }
              : null,
          };
        });

        logger.info(`All exam results fetched for child ${childId}`);
        res.json(formattedResults);
      }
    } catch (error) {
      logger.error(`Error fetching results: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get marksheets for a specific child
  getMarksheets: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Result = require("../models/Results")(connection);
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);
      const User = require("../models/User")(connection);

      // Verify parent-child relationship
      const parent = await User.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const results = await Result.aggregate([
        {
          $match: {
            student: new mongoose.Types.ObjectId(childId),
            school: new mongoose.Types.ObjectId(schoolId),
            status: "published",
            marksheet: { $ne: null },
          },
        },
        {
          $lookup: {
            from: "exams",
            localField: "exam",
            foreignField: "_id",
            as: "examInfo",
          },
        },
        {
          $unwind: "$examInfo",
        },
        {
          $lookup: {
            from: "classes",
            localField: "class",
            foreignField: "_id",
            as: "classInfo",
          },
        },
        {
          $unwind: "$classInfo",
        },
        {
          $lookup: {
            from: "subjects",
            localField: "subject",
            foreignField: "_id",
            as: "subjectInfo",
          },
        },
        {
          $unwind: "$subjectInfo",
        },
        {
          $group: {
            _id: "$examEvent",
            exam: {
              $first: {
                id: "$examInfo._id",
                name: {
                  $cond: [
                    { $eq: ["$examInfo.examType", "Other"] },
                    "$examInfo.customExamType",
                    "$examInfo.examType",
                  ],
                },
                date: "$examInfo.date",
              },
            },
            class: {
              $first: {
                id: "$classInfo._id",
                name: "$classInfo.name",
                division: "$classInfo.division",
              },
            },
            marksheet: { $first: "$marksheet" },
            publishedAt: { $first: "$publishedAt" },
            subjects: {
              $addToSet: {
                resultId: "$_id",
                id: "$subjectInfo._id",
                name: "$subjectInfo.name",
                marksObtained: "$marksObtained",
                totalMarks: "$totalMarks",
                percentage: {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$marksObtained", "$totalMarks"] },
                        100,
                      ],
                    },
                    2,
                  ],
                },
              },
            },
          },
        },
        {
          $sort: { "exam.date": -1 },
        },
        {
          $project: {
            _id: 0,
            exam: 1,
            class: 1,
            marksheet: 1,
            publishedAt: 1,
            subjects: 1,
          },
        },
      ]);

      logger.info(`Marksheets fetched for child ${childId}`);
      res.json({
        status: "success",
        count: results.length,
        marksheets: results,
      });
    } catch (error) {
      logger.error(`Error fetching marksheets: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Download marksheet for a specific child
  // downloadMarksheet: async (req, res) => {
  //   try {
  //     const { childId, examEventId, documentKey } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const parentId = req.user._id.toString();
  //     const connection = req.connection;
  //     const Result = require("../models/Results")(connection);
  //     const User= require("../models/User")(connection);

  //     // Verify parent-child relationship
  //     const parent = await User.findById(parentId).select(
  //       "studentDetails.children"
  //     );
  //     if (
  //       !parent ||
  //       !parent.studentDetails.children.some((id) => id.toString() === childId)
  //     ) {
  //       return res
  //         .status(403)
  //         .json({ message: "Unauthorized: Child not linked to this parent" });
  //     }

  //     if (
  //       !mongoose.Types.ObjectId.isValid(childId) ||
  //       !mongoose.Types.ObjectId.isValid(examEventId)
  //     ) {
  //       return res
  //         .status(400)
  //         .json({ message: "Invalid child or exam event ID" });
  //     }

  //     const result = await Result.findOne({
  //       examEvent: new mongoose.Types.ObjectId(examEventId),
  //       school: new mongoose.Types.ObjectId(schoolId),
  //       student: new mongoose.Types.ObjectId(childId),
  //       status: "published",
  //       marksheet: { $ne: null },
  //     });

  //     if (!result) {
  //       return res.status(404).json({
  //         message: "Marksheet not found or not published",
  //       });
  //     }

  //     if (
  //       !result.marksheet.key ||
  //       !result.marksheet.key.endsWith(documentKey)
  //     ) {
  //       return res.status(404).json({ message: "Document not found" });
  //     }

  //     res.setHeader("Content-Type", "application/pdf");
  //     res.setHeader(
  //       "Content-Disposition",
  //       `attachment; filename=marksheet_${examEventId}.pdf`
  //     );

  //     await streamS3Object(result.marksheet.key, res);
  //     logger.info(
  //       `Marksheet for exam event ${examEventId} downloaded for child ${childId}`
  //     );
  //   } catch (error) {
  //     logger.error(`Error downloading marksheet: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  downloadMarksheet: async (req, res) => {
    try {
        const { childId, examEventId, documentKey } = req.params;
        const schoolId = req.school._id.toString();
        const parentId = req.user._id.toString();
        const connection = req.connection;
        const Result = require("../models/Results")(connection);
        const User = require("../models/User")(connection);

        // Verify parent-child relationship
        const parent = await User.findById(parentId).select("studentDetails.children");
        if (
            !parent ||
            !parent.studentDetails.children.some((id) => id.toString() === childId)
        ) {
            return res.status(403).json({ message: "Unauthorized: Child not linked to this parent" });
        }

        if (
            !mongoose.Types.ObjectId.isValid(childId) ||
            !mongoose.Types.ObjectId.isValid(examEventId)
        ) {
            return res.status(400).json({ message: "Invalid child or exam event ID" });
        }

        const result = await Result.findOne({
            examEvent: new mongoose.Types.ObjectId(examEventId),
            school: new mongoose.Types.ObjectId(schoolId),
            student: new mongoose.Types.ObjectId(childId),
            status: "published",
            marksheet: { $ne: null },
        });

        if (!result) {
            logger.error(`Marksheet not found for examEvent: ${examEventId}, child: ${childId}, school: ${schoolId}`);
            return res.status(404).json({ message: "Marksheet not found or not published" });
        }

        console.log("Result:", JSON.stringify(result, null, 2)); // Debug log
        const expectedDocumentKey = result.marksheet.key.split("/").pop(); // Extract filename
        if (!result.marksheet.key || expectedDocumentKey !== documentKey) {
            logger.error(`Document key mismatch. Expected: ${expectedDocumentKey}, Got: ${documentKey}`);
            return res.status(404).json({ message: "Document not found" });
        }

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=marksheet_${examEventId}.pdf`
        );

        await streamS3Object(result.marksheet.key, res);
        logger.info(`Marksheet for exam event ${examEventId} downloaded for child ${childId}`);
    } catch (error) {
        logger.error(`Error downloading marksheet: ${error.message}`, { error });
        res.status(500).json({ error: error.message });
    }
},

  // Get report card for a specific child
  getReportCard: async (req, res) => {
    try {
      const { childId } = req.params;
      const { term, year } = req.query;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      // Verify parent-child relationship
      const parent = await User.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }
      if (!term || !year) {
        return res.status(400).json({ message: "Term and year are required" });
      }

      const reportCard = await ProgressReport.findOne({
        student: childId,
        school: schoolId,
        term,
        academicYear: year,
      })
        .populate("subjects.teacher", "name", User)
        .populate("class", "name division", Class)
        .populate("generatedBy", "name", User);

      if (!reportCard) {
        return res.status(404).json({ message: "Report card not found" });
      }

      const overallPerformance = parentController.calculateOverallPerformance(
        reportCard.subjects
      );

      logger.info(
        `Report card fetched for child ${childId}, term ${term}, year ${year}`
      );
      res.json({ ...reportCard.toObject(), overallPerformance });
    } catch (error) {
      logger.error(`Error fetching report card: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Request certificate for a specific child
  requestCertificate: async (req, res) => {
    try {
      const { childId } = req.params;
      const { type, purpose, urgency } = req.body;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const validTypes = ["bonafide", "leaving", "transfer"];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid certificate type" });
      }

      if (["leaving", "transfer"].includes(type)) {
        const hasPendingFees = await FeeModel.findOne({
          student: childId,
          school: schoolId,
          status: { $in: ["pending", "partially_paid"] },
        });
        if (hasPendingFees) {
          return res
            .status(400)
            .json({ message: "Clear all pending fees first" });
        }
      }

      const certificate = new Certificate({
        school: schoolId,
        student: childId,
        type,
        purpose,
        urgency: urgency || "normal",
        status: "pending",
        requestDate: new Date(),
      });

      await certificate.save();

      logger.info(`Certificate ${type} requested for child ${childId}`);
      res.status(201).json({
        certificate,
        message: `Your ${type} certificate request for your child has been submitted. You will be notified when it's ready.`,
      });
    } catch (error) {
      logger.error(`Error requesting certificate: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get certificates for a specific child
  getChildCertificates: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const certificates = await Certificate.find({
        school: schoolId,
        student: childId,
        isSentToStudent: true,
      })
        .populate("generatedBy", "name email")
        .sort({ requestDate: -1 });

      const formattedCertificates = certificates.map((cert) => ({
        id: cert._id,
        type: cert.type,
        purpose: cert.purpose,
        urgency: cert.urgency,
        requestDate: cert.requestDate,
        status: cert.status,
        documentUrl: cert.documentUrl || null,
        signedDocumentUrl: cert.signedDocumentUrl || null,
        issuedDate: cert.issuedDate || null,
        generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
        comments: cert.comments || null,
      }));

      logger.info(`Certificates fetched for child ${childId}`);
      res.json({
        status: "success",
        count: formattedCertificates.length,
        certificates: formattedCertificates,
      });
    } catch (error) {
      logger.error(`Error fetching certificates: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Download certificate for a specific child
  downloadCertificate: async (req, res) => {
    try {
      const { childId, certificateId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (
        !mongoose.Types.ObjectId.isValid(childId) ||
        !mongoose.Types.ObjectId.isValid(certificateId)
      ) {
        return res
          .status(400)
          .json({ message: "Invalid child or certificate ID" });
      }

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
        student: childId,
        isSentToStudent: true,
      });

      if (!certificate) {
        return res.status(404).json({
          message: "Certificate not found or not available for download",
        });
      }

      const key =
        certificate.signedDocumentKey &&
        certificate.signedDocumentKey.endsWith(documentKey)
          ? certificate.signedDocumentKey
          : certificate.documentKey &&
            certificate.documentKey.endsWith(documentKey)
          ? certificate.documentKey
          : null;

      if (!key) {
        return res.status(404).json({ message: "Document not found" });
      }

      await streamS3Object(key, res);
      logger.info(
        `Certificate ${certificateId} downloaded for child ${childId}`
      );
    } catch (error) {
      logger.error(`Error downloading certificate: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // Get library services for a specific child
  getLibraryServices: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Library = require("../models/Library")(connection).Library;
      const BookIssue = require("../models/Library")(connection).BookIssue;
      const UserModel = User(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const issuedBooks = await BookIssue.find({
        user: childId,
        school: schoolId,
        status: { $in: ["issued", "overdue"] },
      }).populate("book", "", Library);

      const availableBooks = await Library.find({
        school: schoolId,
        status: "available",
      }).select("bookTitle author category");

      const booksWithFine = issuedBooks.map((issue) => {
        const dueDate = new Date(issue.dueDate);
        const today = new Date();
        let fine = 0;
        let daysOverdue = 0;
        if (dueDate < today) {
          daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
          fine = daysOverdue * 5; // ₹5 per day
        }
        return { ...issue.toObject(), fine, daysOverdue };
      });

      logger.info(`Library services fetched for child ${childId}`);
      res.json({
        issuedBooks: booksWithFine,
        availableBooks,
        totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
      });
    } catch (error) {
      logger.error(`Error fetching library services: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // Get transportation details for a specific child
  getTransportationDetails: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const Transportation = require("../models/Transportation")(connection);
      const User = require("../models/User")(connection);

      // Verify parent-child relationship
      const parent = await User.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      const transport = await Transportation.findOne({
        school: schoolId,
        students: childId,
      }).populate("route driver vehicle");

      if (!transport) {
        return res
          .status(404)
          .json({ message: "Transportation details not found" });
      }

      const student = await User.findOne({ _id: childId, school: schoolId });
      const routeStop = transport.route.stops.find(
        (stop) => stop.area === student.studentDetails.address?.area
      );

      logger.info(`Transportation details fetched for child ${childId}`);
            res.json({
        route: {
          name: transport.route.name,
          stops: routeStop
            ? {
                area: routeStop.area,
                landmark: routeStop.landmark,
                pincode: routeStop.pincode,
                pickupTime: routeStop.pickupTime,
                dropTime: routeStop.dropTime,
              }
            : null,
        },
        driver: {
          name: transport.driver.name,
          contact: transport.driver.contact,
        },
        vehicle: {
          number: transport.vehicle.vehicleNumber,
          type: transport.vehicle.vehicleType,
          capacity: transport.vehicle.capacity,
        },
        distanceSlab: student.studentDetails.transportDetails?.distanceSlab,
        isApplicable:
          student.studentDetails.transportDetails?.isApplicable || false,
      });
    } catch (error) {
      logger.error(`Error fetching transportation details: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // Get timetable for a specific child
  getTimeTable: async (req, res) => {
    try {
      const { childId } = req.params;
      const schoolId = req.school._id.toString();
      const parentId = req.user._id.toString();
      const connection = req.connection;
      const UserModel = User(connection);
      // const TimeTable = require("../models/TimeTable")(connection);
      const Subject = require("../models/Subject")(connection);
      const ClassModel = require("../models/Class")(connection);

      // Verify parent-child relationship
      const parent = await UserModel.findById(parentId).select(
        "studentDetails.children"
      );
      if (
        !parent ||
        !parent.studentDetails.children.some((id) => id.toString() === childId)
      ) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Child not linked to this parent" });
      }

      if (!mongoose.Types.ObjectId.isValid(childId)) {
        return res.status(400).json({ message: "Invalid child ID" });
      }

      // Fetch student and verify class assignment
      const student = await UserModel.findOne({
        _id: childId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      // Verify student is enrolled in the class
      const classInfo = await ClassModel.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
        students: childId,
      });
      if (!classInfo) {
        return res.status(403).json({
          message: "Child is not enrolled in this class",
        });
      }

      // Fetch timetable for the student's class
      const timetable = await TimeTable.findOne({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("subjects", "name")
        .populate("periods.subject", "name");

      if (!timetable) {
        return res
          .status(404)
          .json({ message: "Timetable not found for this class" });
      }

      // Format response
      const formattedTimetable = {
        class: {
          id: classInfo._id,
          name: classInfo.name,
          division: classInfo.division,
        },
        days: timetable.days.map((day) => ({
          day: day.day,
          periods: day.periods.map((period) => ({
            startTime: period.startTime,
            endTime: period.endTime,
            subject: period.subject ? period.subject.name : "Free",
            teacher: period.teacher || "N/A",
          })),
        })),
      };

      logger.info(`Timetable fetched for child ${childId}`);
      res.json({
        message: "Timetable retrieved successfully",
        timetable: formattedTimetable,
      });
    } catch (error) {
      logger.error(`Error fetching timetable: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Helper function to calculate grade
  calculateGrade: (percentage) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    if (percentage >= 40) return "D";
    return "F";
  },

  // Helper function to calculate overall performance
  calculateOverallPerformance: (subjects) => {
    const totalMarks = subjects.reduce(
      (sum, s) => sum + (s.totalMarks || 0),
      0
    );
    const marksObtained = subjects.reduce(
      (sum, s) => sum + (s.marksObtained || 0),
      0
    );
    const percentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
    return {
      totalMarks,
      marksObtained,
      percentage: percentage.toFixed(2),
      grade: parentController.calculateGrade(percentage),
    };
  },
};

module.exports = parentController;