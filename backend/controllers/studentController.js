
// const mongoose = require('mongoose');

// const studentController = {
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(a => a.status === 'present').length;
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

//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       })
//         .populate('uploadedBy', 'name', User)
//         .sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files, comments } = req.body;
//       const studentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);
//       const User = require('../models/User')(connection);

//       const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       const student = await User.findById(studentId);
//       if (student.studentDetails.class.toString() !== homework.class.toString()) {
//         return res.status(403).json({ message: 'This homework is not assigned to your class' });
//       }

//       const existingSubmission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       if (existingSubmission) {
//         existingSubmission.files = files;
//         existingSubmission.comments = comments;
//         existingSubmission.submissionDate = new Date();
//         existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
//       } else {
//         const submission = {
//           student: studentId,
//           submissionDate: new Date(),
//           files,
//           comments,
//           status: new Date() > homework.dueDate ? 'late' : 'submitted',
//         };
//         homework.submissions.push(submission);
//       }

//       await homework.save();

//       const submission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       res.json(submission);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       })
//         .populate('subject', 'name', Subject)
//         .sort({ date: 1 });

//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 s => s.student.toString() === studentId
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

//         return {
//           ...exam.toObject(),
//           seatingInfo: seatInfo,
//         };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name', Subject);

//         if (!exam) {
//           return res.status(404).json({ message: 'Exam not found' });
//         }

//         const studentResult = exam.results.find(
//           r => r.student.toString() === studentId
//         );

//         if (!studentResult) {
//           return res.status(404).json({ message: 'Results not found for this student' });
//         }

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

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
//         const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//         if (!student || !student.studentDetails.class) {
//           return res.status(404).json({ message: 'Student class not found' });
//         }

//         const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name', Subject)
//           .sort({ date: -1 });

//         const results = allExams.map(exam => {
//           const result = exam.results.find(r => r.student.toString() === studentId);
//           if (!result) return null;

//           const percentage = (result.marks / exam.totalMarks) * 100;
//           const grade = calculateGrade(percentage);

//           return {
//             examId: exam._id,
//             exam: exam.name,
//             subject: exam.subject.name,
//             date: exam.date,
//             marks: result.marks,
//             totalMarks: exam.totalMarks,
//             percentage: percentage.toFixed(2),
//             grade,
//             remarks: result.remarks,
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('class', 'name division', Class)
//         .populate('generatedBy', 'name', User);

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({
//         ...reportCard.toObject(),
//         overallPerformance,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { amount, feeType, paymentMethod, feeId } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Fee = require('../models/Fee')(connection);
//       const Payment = require('../models/Payment')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       if (student.studentDetails.isRTE) { // Adjusted to studentDetails.isRTE
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       if (feeId) {
//         const fee = await Fee.findOne({ _id: feeId, school: schoolId });
//         if (!fee) {
//           return res.status(404).json({ message: 'Fee record not found' });
//         }
//         if (fee.amount !== amount) {
//           return res.status(400).json({ message: 'Payment amount does not match fee amount' });
//         }
//       }

//       const payment = new Payment({
//         school: schoolId, // Add school field
//         student: studentId,
//         amount,
//         feeType,
//         paymentMethod,
//         feeId,
//         status: 'pending',
//         transactionDate: new Date(),
//       });

//       await payment.save();

//       // Simulate payment success (replace with actual gateway integration)
//       setTimeout(async () => {
//         payment.status = 'completed';
//         payment.transactionId = 'TXN' + Date.now();
//         await payment.save();

//         if (feeId) {
//           await Fee.findByIdAndUpdate(feeId, { status: 'paid' });
//         }
//       }, 3000);

//       res.json({
//         payment,
//         message: 'Payment initiated successfully. You will be redirected to payment gateway.',
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Payment = require('../models/Payment')(connection);
//       const Fee = require('../models/Fee')(connection);

//       const receipts = await Payment.find({
//         student: studentId,
//         school: schoolId,
//         status: 'completed',
//       })
//         .populate('feeId', 'type dueDate', Fee) // Adjusted field name from title to type
//         .sort({ transactionDate: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // requestCertificate: async (req, res) => {
//   //   try {
//   //     const { studentId } = req.params;
//   //     const { type, purpose, urgency } = req.body;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Certificate = require('../models/Certificate')(connection);

//   //     const certificate = new Certificate({
//   //       school: schoolId, // Add school field
//   //       student: studentId,
//   //       type,
//   //       purpose,
//   //       urgency: urgency || 'normal',
//   //       status: 'pending',
//   //       requestDate: new Date(),
//   //     });

//   //     await certificate.save();

//   //     // Notify admin (implement notifyCertificateRequest if needed)
//   //     // await notifyCertificateRequest(certificate);

//   //     res.status(201).json({
//   //       certificate,
//   //       message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//   //     });
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       // Validate certificate type
//       const validTypes = ['bonafide', 'leaving', 'transfer'];
//       if (!validTypes.includes(type)) {
//         return res.status(400).json({ message: 'Invalid certificate type' });
//       }

//       // Check if student has pending fees for leaving/transfer certificates
//       if (['leaving', 'transfer'].includes(type)) {
//         const Fee = require('../models/Fee')(connection);
//         const hasPendingFees = await Fee.findOne({ 
//           student: studentId, 
//           status: 'pending', 
//           school: schoolId 
//         });
//         if (hasPendingFees) {
//           return res.status(400).json({ message: 'Clear all pending fees first' });
//         }
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;

//       // Debug logging
//       console.log('req.user:', req.user);
//       console.log('req.school:', req.school);

//       // Check if req.school is undefined
//       if (!req.school || !req.school._id) {
//         return res.status(500).json({ error: 'School context is missing. Please ensure the user is associated with a school.' });
//       }

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
//       }

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true, // Only show certificates that have been sent to the student
//       })
//         .populate('generatedBy', 'name email')
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
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
//       console.error('Error in getStudentCertificates:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },



// // getStudentCertificates: async (req, res) => {
// //   try {
// //     const { studentId } = req.params;

// //     console.log('req.user:', req.user);
// //     console.log('req.school:', req.school);

// //     if (!req.user || !req.user._id) {
// //       return res.status(401).json({ error: 'User not authenticated' });
// //     }

// //     // Fetch school based on user if not already set
// //     let schoolId;
// //     if (!req.school || !req.school._id) {
// //       const user = await User.findById(req.user._id);
// //       if (!user || !user.school) {
// //         return res.status(500).json({ error: 'User is not associated with a school' });
// //       }
// //       schoolId = user.school.toString();
// //     } else {
// //       schoolId = req.school._id.toString();
// //     }

// //     const connection = req.connection;
// //     const Certificate = require('../models/Certificate')(connection);

// //     if (!mongoose.Types.ObjectId.isValid(studentId)) {
// //       return res.status(400).json({ message: 'Invalid student ID' });
// //     }

// //     if (studentId !== req.user._id.toString()) {
// //       return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
// //     }

// //     const certificates = await Certificate.find({
// //       school: schoolId,
// //       student: studentId,
// //       isSentToStudent: true,
// //     })
// //       .populate('generatedBy', 'name email')
// //       .sort({ requestDate: -1 });

// //     res.json({
// //       status: 'success',
// //       count: certificates.length,
// //       certificates: certificates.map(cert => ({
// //         id: cert._id,
// //         type: cert.type,
// //         purpose: cert.purpose,
// //         urgency: cert.urgency,
// //         requestDate: cert.requestDate,
// //         status: cert.status,
// //         documentUrl: cert.documentUrl || null,
// //         signedDocumentUrl: cert.signedDocumentUrl || null,
// //         issuedDate: cert.issuedDate || null,
// //         generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
// //         comments: cert.comments || null,
// //       })),
// //     });
// //   } catch (error) {
// //     console.error('Error in getStudentCertificates:', error);
// //     res.status(500).json({ error: error.message });
// //   }
// // },

//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       }).populate('book', '', Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: 'available',
//       }).select('bookTitle author category');

//       const booksWithFine = issuedBooks.map(issue => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;

//         if (dueDate < today) {
//           const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 5; // ₹5 per day
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

//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require('../models/Transportation')(connection);
//       const User = require('../models/User')(connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate('route driver vehicle'); // Adjust population fields as per schema

//       if (!transport) {
//         return res.status(404).json({ message: 'Transportation details not found' });
//       }

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(
//         stop => stop.area === student.studentDetails.address?.area // Adjust based on schema
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

//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('generatedBy', 'name', User);

//       if (!progress) {
//         return res.status(404).json({ message: 'Progress report not found for the specified month' });
//       }

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Event = require('../models/Event')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const events = await Event.find({
//         school: schoolId,
//         $or: [
//           { targetClass: student.studentDetails.class },
//           { targetType: 'all' },
//         ],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// // Placeholder helper functions
// const calculateGrade = (percentage) => {
//   if (percentage >= 90) return 'A+';
//   if (percentage >= 80) return 'A';
//   if (percentage >= 70) return 'B+';
//   if (percentage >= 60) return 'B';
//   if (percentage >= 50) return 'C+';
//   if (percentage >= 40) return 'C';
//   return 'F';
// };

// const calculateOverallPerformance = (subjects) => {
//   // Placeholder; implement as needed
//   return { average: 85, grade: 'A' };
// };

// module.exports = studentController;





// const mongoose = require('mongoose');
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

// const studentController = {
//   // Get attendance for a student
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         school: schoolId,
//         date: { $gte: startDate, $lte: endDate },
//       }).sort({ date: 1 });

//       const totalDays = attendance.length;
//       const presentDays = attendance.filter(a => a.status === 'present').length;
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

//   // Get study materials for a student
//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const materials = await StudyMaterial.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         isActive: true,
//       })
//         .populate('uploadedBy', 'name', User)
//         .sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Submit homework
//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files, comments } = req.body;
//       const studentId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);
//       const User = require('../models/User')(connection);

//       const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       const student = await User.findById(studentId);
//       if (student.studentDetails.class.toString() !== homework.class.toString()) {
//         return res.status(403).json({ message: 'This homework is not assigned to your class' });
//       }

//       const existingSubmission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       if (existingSubmission) {
//         existingSubmission.files = files;
//         existingSubmission.comments = comments;
//         existingSubmission.submissionDate = new Date();
//         existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
//       } else {
//         const submission = {
//           student: studentId,
//           submissionDate: new Date(),
//           files,
//           comments,
//           status: new Date() > homework.dueDate ? 'late' : 'submitted',
//         };
//         homework.submissions.push(submission);
//       }

//       await homework.save();

//       const submission = homework.submissions.find(
//         s => s.student.toString() === studentId.toString()
//       );

//       res.json(submission);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get exam schedule
//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const exams = await Exam.find({
//         school: schoolId,
//         class: student.studentDetails.class,
//         date: { $gte: new Date() },
//       })
//         .populate('subject', 'name', Subject)
//         .sort({ date: 1 });

//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 s => s.student.toString() === studentId
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

//         return {
//           ...exam.toObject(),
//           seatingInfo: seatInfo,
//         };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get results
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       if (examId) {
//         const exam = await Exam.findOne({ _id: examId, school: schoolId })
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name', Subject);

//         if (!exam) {
//           return res.status(404).json({ message: 'Exam not found' });
//         }

//         const studentResult = exam.results.find(
//           r => r.student.toString() === studentId
//         );

//         if (!studentResult) {
//           return res.status(404).json({ message: 'Results not found for this student' });
//         }

//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

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
//         const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//         if (!student || !student.studentDetails.class) {
//           return res.status(404).json({ message: 'Student class not found' });
//         }

//         const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name', Subject)
//           .sort({ date: -1 });

//         const results = allExams.map(exam => {
//           const result = exam.results.find(r => r.student.toString() === studentId);
//           if (!result) return null;

//           const percentage = (result.marks / exam.totalMarks) * 100;
//           const grade = calculateGrade(percentage);

//           return {
//             examId: exam._id,
//             exam: exam.name,
//             subject: exam.subject.name,
//             date: exam.date,
//             marks: result.marks,
//             totalMarks: exam.totalMarks,
//             percentage: percentage.toFixed(2),
//             grade,
//             remarks: result.remarks,
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get report card
//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         term,
//         academicYear: year,
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('class', 'name division', Class)
//         .populate('generatedBy', 'name', User);

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({
//         ...reportCard.toObject(),
//         overallPerformance,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees (integrated with Razorpay for students)
//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { feeIds, paymentMethod } = req.body; // Expecting an array of fee IDs
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const FeeModel = Fee(connection);
//       const PaymentModel = Payment(connection);
//       const UserModel = User(connection);

//       // Validate student
//       const student = await UserModel.findById(studentId);
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       if (student.studentDetails.isRTE) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       // Fetch all fees
//       const fees = await FeeModel.find({
//         _id: { $in: feeIds },
//         school: schoolId,
//         student: studentId,
//       });

//       if (fees.length !== feeIds.length) {
//         return res.status(404).json({ message: 'One or more fee records not found' });
//       }

//       // Check if any fee is already paid
//       const alreadyPaid = fees.some(fee => fee.status === 'paid');
//       if (alreadyPaid) {
//         return res.status(400).json({ message: 'One or more fees are already paid' });
//       }

//       // Calculate total amount
//       const totalAmount = fees.reduce((sum, fee) => sum + fee.amount, 0);

//       // Create a payment record for the combined fees
//       const payment = new PaymentModel({
//         school: schoolId,
//         student: studentId,
//         amount: totalAmount,
//         feeType: fees.map(fee => fee.type).join(', '), // e.g., "school, computer"
//         paymentMethod,
//         feeId: feeIds, // Store all fee IDs
//         status: 'pending',
//         paymentDate: new Date(),
//       });

//       // Handle payment based on method
//       if (paymentMethod === 'cash') {
//         // Cash payment should only be done by fee manager, not student
//         return res.status(403).json({ message: 'Students cannot pay via cash. Please use online payment or contact the fee manager.' });
//       } else {
//         // Online payment via Razorpay
//         const options = {
//           amount: totalAmount * 100, // Razorpay expects amount in paise
//           currency: 'INR',
//           receipt: `fee_${studentId}_${Date.now()}`,
//         };

//         const order = await razorpay.orders.create(options);

//         payment.orderId = order.id;
//         await payment.save();

//         res.json({
//           orderId: order.id,
//           amount: totalAmount * 100,
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

//   // Verify payment (for student panel)
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

//       // Update all associated fees
//       const fees = await FeeModel.find({ _id: { $in: payment.feeId } });
//       for (const fee of fees) {
//         fee.status = 'paid';
//         fee.paymentDetails = {
//           transactionId: razorpay_payment_id,
//           paymentDate: new Date(),
//           paymentMethod: payment.paymentMethod,
//           receiptNumber: `REC${Date.now()}`,
//         };
//         await fee.save();
//       }

//       res.json({ message: 'Payment verified successfully', payment });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get fee receipts
//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const PaymentModel = Payment(connection);
//       const FeeModel = Fee(connection);

//       const receipts = await PaymentModel.find({
//         student: studentId,
//         school: schoolId,
//         status: 'completed',
//       })
//         .populate('feeId', 'type dueDate', FeeModel)
//         .sort({ paymentDate: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificate
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       // Validate certificate type
//       const validTypes = ['bonafide', 'leaving', 'transfer'];
//       if (!validTypes.includes(type)) {
//         return res.status(400).json({ message: 'Invalid certificate type' });
//       }

//       // Check if student has pending fees for leaving/transfer certificates
//       if (['leaving', 'transfer'].includes(type)) {
//         const FeeModel = Fee(connection);
//         const hasPendingFees = await FeeModel.findOne({ 
//           student: studentId, 
//           status: 'pending', 
//           school: schoolId 
//         });
//         if (hasPendingFees) {
//           return res.status(400).json({ message: 'Clear all pending fees first' });
//         }
//       }

//       const certificate = new Certificate({
//         school: schoolId,
//         student: studentId,
//         type,
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date(),
//       });

//       await certificate.save();

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student certificates
//   getStudentCertificates: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);

//       if (!mongoose.Types.ObjectId.isValid(studentId)) {
//         return res.status(400).json({ message: 'Invalid student ID' });
//       }

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
//       }

//       const certificates = await Certificate.find({
//         school: schoolId,
//         student: studentId,
//         isSentToStudent: true,
//       })
//         .populate('generatedBy', 'name email')
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
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

//   // Get library services
//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       }).populate('book', '', Library);

//       const availableBooks = await Library.find({
//         school: schoolId,
//         status: 'available',
//       }).select('bookTitle author category');

//       const booksWithFine = issuedBooks.map(issue => {
//         const dueDate = new Date(issue.dueDate);
//         const today = new Date();
//         let fine = 0;

//         if (dueDate < today) {
//           const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 5; // ₹5 per day
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

//   // Get transportation details
//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Transportation = require('../models/Transportation')(connection);
//       const User = require('../models/User')(connection);

//       const transport = await Transportation.findOne({
//         school: schoolId,
//         students: studentId,
//       }).populate('route driver vehicle');

//       if (!transport) {
//         return res.status(404).json({ message: 'Transportation details not found' });
//       }

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       const routeStop = transport.route.stops.find(
//         stop => stop.area === student.studentDetails.address?.area
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

//   // Get monthly progress
//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const ProgressReport = require('../models/ProgressReport')(connection);
//       const User = require('../models/User')(connection);

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         school: schoolId,
//         month: parseInt(month),
//         year: parseInt(year),
//       })
//         .populate('subjects.teacher', 'name', User)
//         .populate('generatedBy', 'name', User);

//       if (!progress) {
//         return res.status(404).json({ message: 'Progress report not found for the specified month' });
//       }

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get event notifications
//   getEventNotifications: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Event = require('../models/Event')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
//       if (!student || !student.studentDetails.class) {
//         return res.status(404).json({ message: 'Student class not found' });
//       }

//       const events = await Event.find({
//         school: schoolId,
//         $or: [
//           { targetClass: student.studentDetails.class },
//           { targetType: 'all' },
//         ],
//         date: { $gte: new Date() },
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Placeholder helper functions
//   calculateGrade: (percentage) => {
//     if (percentage >= 90) return 'A+';
//     if (percentage >= 80) return 'A';
//     if (percentage >= 70) return 'B+';
//     if (percentage >= 60) return 'B';
//     if (percentage >= 50) return 'C+';
//     if (percentage >= 40) return 'C';
//     return 'F';
//   },

//   calculateOverallPerformance: (subjects) => {
//     return { average: 85, grade: 'A' };
//   },
// };

// module.exports = studentController;


const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Fee = require('../models/Fee');
const User = require('../models/User');
const Payment = require('../models/Payment');
const generatedSignature = require('../utils/helpers')
const {generateFeeSlip}= require('../utils/helpers')

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const studentController = {
  // Get attendance for a student
  getAttendance: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Attendance = require('../models/Attendance')(connection);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        user: studentId,
        school: schoolId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(a => a.status === 'present').length;
      const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

      res.json({
        attendance,
        statistics: { totalDays, presentDays, absentDays: totalDays - presentDays, percentage },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get study materials for a student
  getStudyMaterials: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const StudyMaterial = require('../models/StudyMaterial')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

      const materials = await StudyMaterial.find({
        school: schoolId,
        class: student.studentDetails.class,
        isActive: true,
      }).populate('uploadedBy', 'name', User).sort({ createdAt: -1 });

      res.json(materials);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Submit homework
  submitHomework: async (req, res) => {
    try {
      const { homeworkId } = req.params;
      const { files, comments } = req.body;
      const studentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Homework = require('../models/Homework')(connection);
      const User = require('../models/User')(connection);

      const homework = await Homework.findOne({ _id: homeworkId, school: schoolId });
      if (!homework) return res.status(404).json({ message: 'Homework not found' });

      const student = await User.findById(studentId);
      if (student.studentDetails.class.toString() !== homework.class.toString()) return res.status(403).json({ message: 'This homework is not assigned to your class' });

      const existingSubmission = homework.submissions.find(s => s.student.toString() === studentId.toString());

      if (existingSubmission) {
        existingSubmission.files = files;
        existingSubmission.comments = comments;
        existingSubmission.submissionDate = new Date();
        existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
      } else {
        const submission = { student: studentId, submissionDate: new Date(), files, comments, status: new Date() > homework.dueDate ? 'late' : 'submitted' };
        homework.submissions.push(submission);
      }

      await homework.save();

      const submission = homework.submissions.find(s => s.student.toString() === studentId.toString());
      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get exam schedule
  getExamSchedule: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

      const exams = await Exam.find({
        school: schoolId,
        class: student.studentDetails.class,
        date: { $gte: new Date() },
      }).populate('subject', 'name', Subject).sort({ date: 1 });

      const examsWithSeating = exams.map(exam => {
        let seatInfo = null;
        if (exam.seatingArrangement) {
          for (const room of exam.seatingArrangement) {
            for (const row of room.arrangement) {
              const studentSeat = row.students.find(s => s.student.toString() === studentId);
              if (studentSeat) {
                seatInfo = { room: room.classroom, row: row.row, position: studentSeat.position };
                break;
              }
            }
            if (seatInfo) break;
          }
        }
        return { ...exam.toObject(), seatingInfo: seatInfo };
      });

      res.json(examsWithSeating);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get results
  getResults: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { examId } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);

      if (examId) {
        const exam = await Exam.findOne({ _id: examId, school: schoolId })
          .select('name class subject totalMarks results')
          .populate('subject', 'name', Subject);

        if (!exam) return res.status(404).json({ message: 'Exam not found' });

        const studentResult = exam.results.find(r => r.student.toString() === studentId);
        if (!studentResult) return res.status(404).json({ message: 'Results not found for this student' });

        const percentage = (studentResult.marks / exam.totalMarks) * 100;
        const grade = calculateGrade(percentage);

        res.json({
          exam: exam.name,
          subject: exam.subject.name,
          marks: studentResult.marks,
          totalMarks: exam.totalMarks,
          percentage: percentage.toFixed(2),
          grade,
          remarks: studentResult.remarks,
        });
      } else {
        const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
        if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

        const allExams = await Exam.find({ school: schoolId, class: student.studentDetails.class })
          .select('name subject totalMarks results date')
          .populate('subject', 'name', Subject)
          .sort({ date: -1 });

        const results = allExams.map(exam => {
          const result = exam.results.find(r => r.student.toString() === studentId);
          if (!result) return null;
          const percentage = (result.marks / exam.totalMarks) * 100;
          const grade = calculateGrade(percentage);
          return {
            examId: exam._id,
            exam: exam.name,
            subject: exam.subject.name,
            date: exam.date,
            marks: result.marks,
            totalMarks: exam.totalMarks,
            percentage: percentage.toFixed(2),
            grade,
            remarks: result.remarks,
          };
        }).filter(Boolean);

        res.json(results);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get report card
  getReportCard: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { term, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const reportCard = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        term,
        academicYear: year,
      })
        .populate('subjects.teacher', 'name', User)
        .populate('class', 'name division', Class)
        .populate('generatedBy', 'name', User);

      if (!reportCard) return res.status(404).json({ message: 'Report card not found' });

      const overallPerformance = calculateOverallPerformance(reportCard.subjects);

      res.json({ ...reportCard.toObject(), overallPerformance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all fees for a student by selecting fee type (for student panel)
  getStudentFeesByType: async (req, res) => {
    try {
      const { studentId, feeType } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);

      const fees = await FeeModel.find({
        student: studentId,
        school: schoolId,
        type: feeType,
      }).sort({ dueDate: 1 });

      res.json(fees);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

 


  // getFeeTypes: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { month, year } = req.query;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const UserModel = User(connection);

  //     const student = await UserModel.findById(studentId);
  //     if (!student) return res.status(404).json({ message: 'Student not found' });

  //     if (student.studentDetails.isRTE) 
  //       return res.json({ message: 'RTE students are exempted from fees', isRTE: true, feeTypes: [] });

  //     const feeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false }, // Fee definitions don't have a student assigned yet
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });

  //     const paidFees = await FeeModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       status: 'paid',
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     }).select('type');

  //     const paidFeeTypes = paidFees.map(fee => fee.type);

  //     const feeTypesWithStatus = feeDefinitions.map(fee => ({
  //       type: fee.type,
  //       label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + ' Fee',
  //       amount: fee.amount,
  //       description: fee.description,
  //       isPaid: paidFeeTypes.includes(fee.type)
  //     }));

  //     res.json({
  //       feeTypes: feeTypesWithStatus,
  //       studentName: student.name,
  //       grNumber: student.studentDetails.grNumber,
  //       class: student.studentDetails.class,
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // payFeesByType: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { feeType, month, year, paymentMethod } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const PaymentModel = Payment(connection);
  //     const UserModel = User(connection);

  //     const student = await UserModel.findById(studentId);
  //     if (!student) return res.status(404).json({ message: 'Student not found' });

  //     if (student.studentDetails.isRTE) 
  //       return res.status(400).json({ message: 'RTE students are exempted from fees' });

  //     const feeDefinition = await FeeModel.findOne({
  //       school: schoolId,
  //       type: feeType,
  //       month: parseInt(month),
  //       year: parseInt(year),
  //       student: { $exists: false } // Fetch the fee definition
  //     });

  //     if (!feeDefinition) return res.status(404).json({ message: 'Fee type not defined for this month' });

  //     const existingFee = await FeeModel.findOne({
  //       student: studentId,
  //       school: schoolId,
  //       type: feeType,
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });

  //     if (existingFee && existingFee.status === 'paid') 
  //       return res.status(400).json({ message: 'This fee is already paid for the selected month' });

  //     let fee = existingFee;
  //     if (!fee) {
  //       fee = new FeeModel({
  //         school: schoolId,
  //         student: studentId,
  //         grNumber: student.studentDetails.grNumber,
  //         type: feeType,
  //         amount: feeDefinition.amount,
  //         dueDate: feeDefinition.dueDate,
  //         month: parseInt(month),
  //         year: parseInt(year),
  //         status: 'pending',
  //         description: feeDefinition.description
  //       });
  //       await fee.save();
  //     }

  //     if (paymentMethod === 'cash') 
  //       return res.status(403).json({ message: 'Students cannot pay via cash. Contact the fee manager.' });

  //     const options = { amount: fee.amount * 100, currency: 'INR', receipt: `fee_${fee._id}` };
  //     const order = await razorpay.orders.create(options);

  //     const payment = new PaymentModel({
  //       school: schoolId,
  //       student: studentId,
  //       amount: fee.amount,
  //       feeType,
  //       paymentMethod,
  //       feeId: fee._id,
  //       status: 'pending',
  //       orderId: order.id,
  //     });

  //     await payment.save();

  //     res.json({
  //       orderId: order.id,
  //       amount: fee.amount * 100,
  //       currency: 'INR',
  //       key: process.env.RAZORPAY_KEY_ID,
  //       payment,
  //       message: 'Payment initiated. Proceed with Razorpay checkout.',
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // // Verify payment (for student panel)
  // verifyPayment: async (req, res) => {
  //   try {
  //     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = Payment(connection);
  //     const FeeModel = Fee(connection);

  //     // const generatedSignature = crypto
  //     //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  //     //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  //     //   .digest('hex');

  //     // if (generatedSignature !== razorpay_signature) return res.status(400).json({ message: 'Invalid payment signature' });

  //     const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
  //     if (!payment) return res.status(404).json({ message: 'Payment not found' });

  //     payment.status = 'completed';
  //     payment.transactionId = razorpay_payment_id;
  //     payment.paymentDate = new Date();
  //     await payment.save();

  //     const fee = await FeeModel.findById(payment.feeId);
  //     fee.status = 'paid';
  //     fee.paymentDetails = {
  //       transactionId: razorpay_payment_id,
  //       paymentDate: new Date(),
  //       paymentMethod: payment.paymentMethod,
  //       receiptNumber: `REC${Date.now()}`,
  //     };
  //     await fee.save();

  //     res.json({ message: 'Payment verified successfully', payment });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // // Get fee receipts
  // getFeeReceipts: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = Payment(connection);
  //     const FeeModel = Fee(connection);

  //     const receipts = await PaymentModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       status: 'completed',
  //     }).populate('feeId', 'type dueDate', FeeModel).sort({ paymentDate: -1 });

  //     res.json(receipts);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // getFeeTypes: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { month, year } = req.query;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const UserModel = User(connection);

  //     const student = await UserModel.findById(studentId);
  //     if (!student) return res.status(404).json({ message: 'Student not found' });

  //     if (student.studentDetails.isRTE) 
  //       return res.json({ message: 'RTE students are exempted from fees', isRTE: true, feeTypes: [] });

  //     const feeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false },
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });

  //     const paidFees = await FeeModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });

  //     const feeTypesWithStatus = feeDefinitions.map(fee => {
  //       const paidFee = paidFees.find(f => f.type === fee.type);
  //       return {
  //         type: fee.type,
  //         label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + ' Fee',
  //         amount: fee.amount,
  //         description: fee.description,
  //         isPaid: !!paidFee && paidFee.status === 'paid',
  //         paymentDetails: paidFee?.paymentDetails || null
  //       };
  //     });

  //     res.json({
  //       feeTypes: feeTypesWithStatus,
  //       studentName: student.name,
  //       grNumber: student.studentDetails.grNumber,
  //       class: student.studentDetails.class,
  //       month: parseInt(month),
  //       year: parseInt(year)
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // payFeesByType: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { feeTypes, month, year, paymentMethod } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = Fee(connection);
  //     const PaymentModel = Payment(connection);
  //     const UserModel = User(connection);

  //     const student = await UserModel.findById(studentId);
  //     if (!student) return res.status(404).json({ message: 'Student not found' });

  //     if (student.studentDetails.isRTE) 
  //       return res.status(400).json({ message: 'RTE students are exempted from fees' });

  //     if (paymentMethod === 'cash') 
  //       return res.status(403).json({ message: 'Students cannot pay via cash. Contact the fee manager.' });

  //     const feeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false },
  //       month: parseInt(month),
  //       year: parseInt(year),
  //       type: { $in: feeTypes }
  //     });

  //     if (feeDefinitions.length !== feeTypes.length) 
  //       return res.status(404).json({ message: 'Some fee types not defined for this month' });

  //     const existingFees = await FeeModel.find({
  //       student: studentId,
  //       school: schoolId,
  //       month: parseInt(month),
  //       year: parseInt(year),
  //       type: { $in: feeTypes }
  //     });

  //     const feesToPay = [];
  //     let totalAmount = 0;

  //     for (const def of feeDefinitions) {
  //       const existing = existingFees.find(f => f.type === def.type);
  //       if (existing && existing.status === 'paid') {
  //         return res.status(400).json({ message: `Fee type ${def.type} is already paid` });
  //       }
  //       if (!existing) {
  //         const fee = new FeeModel({
  //           school: schoolId,
  //           student: studentId,
  //           grNumber: student.studentDetails.grNumber,
  //           type: def.type,
  //           amount: def.amount,
  //           dueDate: def.dueDate,
  //           month: parseInt(month),
  //           year: parseInt(year),
  //           status: 'pending',
  //           description: def.description
  //         });
  //         feesToPay.push(fee);
  //       } else {
  //         feesToPay.push(existing);
  //       }
  //       totalAmount += def.amount;
  //     }

  //     const options = { amount: totalAmount * 100, currency: 'INR', receipt: `fee_${studentId}_${month}_${year}` };
  //     const order = await razorpay.orders.create(options);

  //     const payment = new PaymentModel({
  //       school: schoolId,
  //       student: studentId,
  //       amount: totalAmount,
  //       feeType: feeTypes.join(','),
  //       paymentMethod,
  //       status: 'pending',
  //       orderId: order.id,
  //     });

  //     await Promise.all(feesToPay.map(fee => !fee._id && fee.save()));
  //     payment.feeId = feesToPay.map(f => f._id);
  //     await payment.save();

  //     res.json({
  //       orderId: order.id,
  //       amount: totalAmount * 100,
  //       currency: 'INR',
  //       key: process.env.RAZORPAY_KEY_ID,
  //       payment,
  //       message: 'Payment initiated. Proceed with Razorpay checkout.',
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // verifyPayment: async (req, res) => {
  //   try {
  //     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = Payment(connection);
  //     const FeeModel = Fee(connection);

  //     // const generatedSignature = crypto
  //     //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  //     //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  //     //   .digest('hex');

  //     // if (generatedSignature !== razorpay_signature) 
  //     //   return res.status(400).json({ message: 'Invalid payment signature' });

  //     const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
  //     if (!payment) return res.status(404).json({ message: 'Payment not found' });

  //     payment.status = 'completed';
  //     payment.transactionId = razorpay_payment_id;
  //     payment.paymentDate = new Date();
  //     await payment.save();

  //     const fees = await FeeModel.find({ _id: { $in: payment.feeId } });
  //     const receiptNumber = `REC${Date.now()}`;

  //     const updatePromises = fees.map(fee => {
  //       fee.status = 'paid';
  //       fee.paymentDetails = {
  //         transactionId: razorpay_payment_id,
  //         paymentDate: new Date(),
  //         paymentMethod: payment.paymentMethod,
  //         receiptNumber,
  //       };
  //       return fee.save();
  //     });

  //     await Promise.all(updatePromises);

  //     res.json({ message: 'Payment verified successfully', payment });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  getFeeTypes: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const PaymentModel = Payment(connection);

      const student = await UserModel.findById(studentId);
      if (!student) return res.status(404).json({ message: 'Student not found' });

      if (student.studentDetails.isRTE) 
        return res.json({ message: 'RTE students are exempted from fees', isRTE: true, feeTypes: [] });

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year)
      });

      const paidFees = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        'feesPaid.month': parseInt(month),
        'feesPaid.year': parseInt(year),
        status: 'completed'
      });

      const paidFeeTypes = new Set(paidFees.flatMap(p => p.feesPaid.map(f => f.type)));

      const feeTypesWithStatus = feeDefinitions.map(fee => ({
        type: fee.type,
        label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + ' Fee',
        amount: fee.amount,
        description: fee.description,
        isPaid: paidFeeTypes.has(fee.type),
        paymentDetails: paidFees.find(p => p.feesPaid.some(f => f.type === fee.type))?.feesPaid.find(f => f.type === fee.type)?.paymentDetails || null
      }));

      res.json({
        feeTypes: feeTypesWithStatus,
        studentName: student.name,
        grNumber: student.studentDetails.grNumber,
        class: student.studentDetails.class,
        month: parseInt(month),
        year: parseInt(year)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  payFeesByType: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { feeTypes, month, year, paymentMethod } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection);
      const UserModel = User(connection);

      const student = await UserModel.findById(studentId);
      if (!student) return res.status(404).json({ message: 'Student not found' });

      if (student.studentDetails.isRTE) 
        return res.status(400).json({ message: 'RTE students are exempted from fees' });

      if (paymentMethod === 'cash') 
        return res.status(403).json({ message: 'Students cannot pay via cash. Contact the fee manager.' });

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
        type: { $in: feeTypes }
      });

      if (feeDefinitions.length !== feeTypes.length) 
        return res.status(404).json({ message: 'Some fee types not defined for this month' });

      const existingPayments = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        'feesPaid.month': parseInt(month),
        'feesPaid.year': parseInt(year),
        'feesPaid.type': { $in: feeTypes },
        status: 'completed'
      });

      const paidTypes = new Set(existingPayments.flatMap(p => p.feesPaid.map(f => f.type)));
      const feesToPay = feeDefinitions.filter(fee => !paidTypes.has(fee.type));

      if (feesToPay.length === 0) 
        return res.status(400).json({ message: 'All selected fees are already paid' });

      const totalAmount = feesToPay.reduce((sum, fee) => sum + fee.amount, 0);
      const options = { amount: totalAmount * 100, currency: 'INR', receipt: `fee_${studentId}_${month}_${year}` };
      const order = await razorpay.orders.create(options);

      const payment = new PaymentModel({
        school: schoolId,
        student: studentId,
        grNumber: student.studentDetails.grNumber,
        amount: totalAmount,
        paymentMethod,
        status: 'pending',
        orderId: order.id,
        feesPaid: feesToPay.map(fee => ({
          feeId: fee._id,
          type: fee.type,
          month: parseInt(month),
          year: parseInt(year),
          amount: fee.amount
        }))
      });

      await payment.save();

      res.json({
        orderId: order.id,
        amount: totalAmount * 100,
        currency: 'INR',
        key: process.env.RAZORPAY_KEY_ID,
        payment,
        message: 'Payment initiated. Proceed with Razorpay checkout.'
      });
    } catch (error) {
      console.error('Payment Error:', error); // Add logging for debugging
      res.status(500).json({ error: error.message });
    }
  },



  // verifyPayment: async (req, res) => {
  //   try {
  //     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = Payment(connection);
  //     const FeeModel = Fee(connection);
  
  //     // Uncomment this section if you want to validate the signature
  //     // const generatedSignature = crypto
  //     //   .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  //     //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  //     //   .digest('hex');
  //     // if (generatedSignature !== razorpay_signature) 
  //     //   return res.status(400).json({ message: 'Invalid payment signature' });
  
  //     const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
  //     if (!payment) return res.status(404).json({ message: 'Payment not found' });
  
  //     // Update payment status
  //     payment.status = 'completed';
  //     payment.transactionId = razorpay_payment_id;
  //     payment.paymentDate = new Date();
  //     payment.receiptNumber = `REC${Date.now()}`;
  //     await payment.save();
  
  //     // Create or update Fee documents for each fee paid
  //     // This is the key addition that was missing
  //     for (const feePaid of payment.feesPaid) {
  //       // Check if a fee document already exists for this student/type/month/year
  //       let fee = await FeeModel.findOne({
  //         school: schoolId,
  //         student: payment.student,
  //         type: feePaid.type,
  //         month: feePaid.month,
  //         year: feePaid.year
  //       });
  
  //       if (!fee) {
  //         // Create a new fee document if one doesn't exist
  //         const feeDefinition = await FeeModel.findOne({
  //           school: schoolId,
  //           student: { $exists: false },
  //           type: feePaid.type,
  //           month: feePaid.month,
  //           year: feePaid.year
  //         });
  
  //         if (feeDefinition) {
  //           fee = new FeeModel({
  //             school: schoolId,
  //             student: payment.student,
  //             grNumber: payment.grNumber,
  //             type: feePaid.type,
  //             amount: feePaid.amount,
  //             dueDate: feeDefinition.dueDate,
  //             month: feePaid.month,
  //             year: feePaid.year,
  //             description: feeDefinition.description,
  //             status: 'paid'
  //           });
  //         } else {
  //           // Create a new fee document even without a definition
  //           fee = new FeeModel({
  //             school: schoolId,
  //             student: payment.student,
  //             grNumber: payment.grNumber,
  //             type: feePaid.type,
  //             amount: feePaid.amount,
  //             dueDate: new Date(feePaid.year, feePaid.month - 1, 28), // Last day of the month as fallback
  //             month: feePaid.month,
  //             year: feePaid.year,
  //             status: 'paid'
  //           });
  //         }
  //       } else {
  //         // Update existing fee document
  //         fee.status = 'paid';
  //       }
  
  //       // Add payment details to the fee document
  //       fee.paymentDetails = {
  //         transactionId: razorpay_payment_id,
  //         paymentDate: payment.paymentDate,
  //         paymentMethod: payment.paymentMethod,
  //         receiptNumber: payment.receiptNumber
  //       };
  
  //       await fee.save();
  //     }
  
  //     res.json({ message: 'Payment verified successfully', payment });
  //   } catch (error) {
  //     console.error('Verification Error:', error); // Add logging for debugging
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  verifyPayment: async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
  
      // Signature validation (uncommented for security)
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (generatedSignature !== razorpay_signature) 
        return res.status(400).json({ message: 'Invalid payment signature' });
  
      const payment = await PaymentModel.findOne({ orderId: razorpay_order_id });
      if (!payment) return res.status(404).json({ message: 'Payment not found' });
  
      const student = await UserModel.findById(payment.student);
      if (!student) return res.status(404).json({ message: 'Student not found' });
  
      // Update payment status
      payment.status = 'completed';
      payment.transactionId = razorpay_payment_id;
      payment.paymentDate = new Date();
      payment.receiptNumber = `REC${Date.now()}`;
      await payment.save();
  
      // Update fee documents
      for (const feePaid of payment.feesPaid) {
        let fee = await FeeModel.findOne({
          school: schoolId,
          student: payment.student,
          type: feePaid.type,
          month: feePaid.month,
          year: feePaid.year,
        });
  
        if (!fee) {
          const feeDefinition = await FeeModel.findOne({
            school: schoolId,
            student: { $exists: false },
            type: feePaid.type,
            month: feePaid.month,
            year: feePaid.year,
          });
  
          fee = new FeeModel({
            school: schoolId,
            student: payment.student,
            grNumber: payment.grNumber,
            type: feePaid.type,
            amount: feePaid.amount,
            dueDate: feeDefinition?.dueDate || new Date(feePaid.year, feePaid.month - 1, 28),
            month: feePaid.month,
            year: feePaid.year,
            status: 'paid',
            description: feeDefinition?.description || '',
          });
        } else {
          fee.status = 'paid';
        }
  
        fee.paymentDetails = {
          transactionId: razorpay_payment_id,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          receiptNumber: payment.receiptNumber,
        };
        await fee.save();
      }
  
      // Generate fee slip
      const feeSlip = generateFeeSlip(student, payment, payment.feesPaid, schoolId);
  
      res.json({ 
        message: 'Payment verified successfully', 
        payment,
        feeSlip, // Return the fee slip
      });
    } catch (error) {
      console.error('Verification Error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getFeeReceipts: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

      const payments = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        status: 'completed',
      }).sort({ paymentDate: -1 });

      const receipts = await Promise.all(payments.map(async payment => {
        const fees = await FeeModel.find({ _id: { $in: payment.feeId || [] } });
        return {
          ...payment.toObject(),
          fees: fees.map(fee => ({
            type: fee.type,
            amount: fee.amount,
            month: fee.month,
            year: fee.year,
            dueDate: fee.dueDate
          }))
        };
      }));

      res.json(receipts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Request certificate
  requestCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { type, purpose, urgency } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);

      const validTypes = ['bonafide', 'leaving', 'transfer'];
      if (!validTypes.includes(type)) return res.status(400).json({ message: 'Invalid certificate type' });

      if (['leaving', 'transfer'].includes(type)) {
        const FeeModel = Fee(connection);
        const hasPendingFees = await FeeModel.findOne({ student: studentId, status: 'pending', school: schoolId });
        if (hasPendingFees) return res.status(400).json({ message: 'Clear all pending fees first' });
      }

      const certificate = new Certificate({
        school: schoolId,
        student: studentId,
        type,
        purpose,
        urgency: urgency || 'normal',
        status: 'pending',
        requestDate: new Date(),
      });

      await certificate.save();

      res.status(201).json({
        certificate,
        message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get student certificates
  getStudentCertificates: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) return res.status(400).json({ message: 'Invalid student ID' });

      if (studentId !== req.user._id.toString()) return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });

      const certificates = await Certificate.find({
        school: schoolId,
        student: studentId,
        isSentToStudent: true,
      }).populate('generatedBy', 'name email').sort({ requestDate: -1 });

      res.json({
        status: 'success',
        count: certificates.length,
        certificates: certificates.map(cert => ({
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
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get library services
  getLibraryServices: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Library = require('../models/Library')(connection).Library;
      const BookIssue = require('../models/Library')(connection).BookIssue;

      const issuedBooks = await BookIssue.find({
        user: studentId,
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
      }).populate('book', '', Library);

      const availableBooks = await Library.find({
        school: schoolId,
        status: 'available',
      }).select('bookTitle author category');

      const booksWithFine = issuedBooks.map(issue => {
        const dueDate = new Date(issue.dueDate);
        const today = new Date();
        let fine = 0;
        if (dueDate < today) {
          const daysOverdue = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));
          fine = daysOverdue * 5;
        }
        return { ...issue.toObject(), fine, daysOverdue: fine > 0 ? daysOverdue : 0 };
      });

      res.json({
        issuedBooks: booksWithFine,
        availableBooks,
        totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get transportation details
  getTransportationDetails: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Transportation = require('../models/Transportation')(connection);
      const User = require('../models/User')(connection);

      const transport = await Transportation.findOne({
        school: schoolId,
        students: studentId,
      }).populate('route driver vehicle');

      if (!transport) return res.status(404).json({ message: 'Transportation details not found' });

      const student = await User.findOne({ _id: studentId, school: schoolId });
      const routeStop = transport.route.stops.find(stop => stop.area === student.studentDetails.address?.area);

      res.json({
        ...transport.toObject(),
        studentPickup: routeStop ? routeStop.pickupTime : null,
        studentDrop: routeStop ? routeStop.dropTime : null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get monthly progress
  getMonthlyProgress: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const User = require('../models/User')(connection);

      const progress = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      }).populate('subjects.teacher', 'name', User).populate('generatedBy', 'name', User);

      if (!progress) return res.status(404).json({ message: 'Progress report not found for the specified month' });

      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get event notifications
  getEventNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Event = require('../models/Event')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails.class) return res.status(404).json({ message: 'Student class not found' });

      const events = await Event.find({
        school: schoolId,
        $or: [{ targetClass: student.studentDetails.class }, { targetType: 'all' }],
        date: { $gte: new Date() },
      }).sort({ date: 1 });

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  calculateGrade: (percentage) => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C+';
    if (percentage >= 40) return 'C';
    return 'F';
  },

  calculateOverallPerformance: (subjects) => {
    return { average: 85, grade: 'A' };
  },
};

module.exports = studentController;