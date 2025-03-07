

// const Timetable = require('../models/Timetable');
// const Homework = require('../models/Homework');
// const Attendance = require('../models/Attendance');
// const { Library, BookIssue } = require('../models/Library');
// const Exam = require('../models/Exam');
// const Payment = require('../models/Payment');
// const Certificate = require('../models/Certificate');
// const Transportation = require('../models/Transportation');
// const StudyMaterial = require('../models/StudyMaterial');
// const ProgressReport = require('../models/ProgressReport');
// const Event = require('../models/Event');
// const User = require('../models/User');
// const Fee = require('../models/Fee');

// const studentController = {
//   // View attendance records
//   getAttendance: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;

//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         user: studentId,
//         date: { $gte: startDate, $lte: endDate }
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
//           percentage
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Access study materials
//   getStudyMaterials: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const student = await User.findById(studentId).select('profile.class');
      
//       if (!student || !student.profile || !student.profile.class) {
//         return res.status(404).json({ message: "Student class not found" });
//       }

//       const materials = await StudyMaterial.find({
//         class: student.profile.class,
//         isActive: true
//       })
//       .populate('uploadedBy', 'name')
//       .sort({ createdAt: -1 });

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

//       const homework = await Homework.findById(homeworkId);
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       // Verify student is in the correct class
//       const student = await User.findById(studentId);
//       if (student.profile.class.toString() !== homework.class.toString()) {
//         return res.status(403).json({ message: 'This homework is not assigned to your class' });
//       }

//       // Check if already submitted
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
//           status: new Date() > homework.dueDate ? 'late' : 'submitted'
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

//   // View exam schedules
//   getExamSchedule: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const student = await User.findById(studentId).select('profile.class');

//       const exams = await Exam.find({
//         class: student.profile.class,
//         date: { $gte: new Date() }
//       })
//       .populate('subject', 'name')
//       .sort({ date: 1 });

//       // Add seating information if available
//       const examsWithSeating = exams.map(exam => {
//         let seatInfo = null;
//         if (exam.seatingArrangement) {
//           // Find student's seating
//           for (const room of exam.seatingArrangement) {
//             for (const row of room.arrangement) {
//               const studentSeat = row.students.find(
//                 s => s.student.toString() === studentId
//               );
//               if (studentSeat) {
//                 seatInfo = {
//                   room: room.classroom,
//                   row: row.row,
//                   position: studentSeat.position
//                 };
//                 break;
//               }
//             }
//             if (seatInfo) break;
//           }
//         }

//         return {
//           ...exam.toObject(),
//           seatingInfo: seatInfo
//         };
//       });

//       res.json(examsWithSeating);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Check results
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;

//       if (examId) {
//         // Specific exam results
//         const exam = await Exam.findById(examId)
//           .select('name class subject totalMarks results')
//           .populate('subject', 'name');

//         if (!exam) {
//           return res.status(404).json({ message: 'Exam not found' });
//         }

//         const studentResult = exam.results.find(
//           r => r.student.toString() === studentId
//         );

//         if (!studentResult) {
//           return res.status(404).json({ message: 'Results not found for this student' });
//         }

//         // Calculate grade
//         const percentage = (studentResult.marks / exam.totalMarks) * 100;
//         const grade = calculateGrade(percentage);

//         res.json({
//           exam: exam.name,
//           subject: exam.subject.name,
//           marks: studentResult.marks,
//           totalMarks: exam.totalMarks,
//           percentage: percentage.toFixed(2),
//           grade,
//           remarks: studentResult.remarks
//         });
//       } else {
//         // All exams for the student
//         const student = await User.findById(studentId).select('profile.class');
        
//         const allExams = await Exam.find({ class: student.profile.class })
//           .select('name subject totalMarks results date')
//           .populate('subject', 'name')
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
//             remarks: result.remarks
//           };
//         }).filter(Boolean);

//         res.json(results);
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Download report cards
//   getReportCard: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { term, year } = req.query;

//       const reportCard = await ProgressReport.findOne({
//         student: studentId,
//         term,
//         academicYear: year
//       })
//       .populate('subjects.teacher', 'name')
//       .populate('class', 'name division')
//       .populate('generatedBy', 'name');

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       // Calculate overall grade
//       const overallPerformance = calculateOverallPerformance(reportCard.subjects);

//       res.json({
//         ...reportCard.toObject(),
//         overallPerformance
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees online
//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { amount, feeType, paymentMethod, feeId } = req.body;

//       // Verify student is not RTE (Right to Education)
//       const student = await User.findById(studentId);
//       if (student.profile.isRteStudent) {
//         return res.status(400).json({ message: 'RTE students are exempted from fees' });
//       }

//       // Verify fee amount if feeId is provided
//       if (feeId) {
//         const fee = await Fee.findById(feeId);
//         if (!fee) {
//           return res.status(404).json({ message: 'Fee record not found' });
//         }
//         if (fee.amount !== amount) {
//           return res.status(400).json({ message: 'Payment amount does not match fee amount' });
//         }
//       }

//       const payment = new Payment({
//         student: studentId,
//         amount,
//         feeType,
//         paymentMethod,
//         feeId,
//         status: 'pending',
//         transactionDate: new Date()
//       });

//       await payment.save();

//       // Integrate with payment gateway here
//       // For demo, we'll simulate a successful payment
//       setTimeout(async () => {
//         payment.status = 'completed';
//         payment.transactionId = 'TXN' + Date.now();
//         await payment.save();

//         // If fee payment, update fee status
//         if (feeId) {
//           await Fee.findByIdAndUpdate(feeId, { status: 'paid' });
//         }
//       }, 3000);

//       res.json({
//         payment,
//         message: 'Payment initiated successfully. You will be redirected to payment gateway.'
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Download fee receipts
//   getFeeReceipts: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const receipts = await Payment.find({
//         student: studentId,
//         status: 'completed'
//       })
//       .populate('feeId', 'title dueDate')
//       .sort({ transactionDate: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificates
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose, urgency } = req.body;

//       const certificate = new Certificate({
//         student: studentId,
//         type, // 'bonafide', 'transfer', 'character', etc.
//         purpose,
//         urgency: urgency || 'normal',
//         status: 'pending',
//         requestDate: new Date()
//       });

//       await certificate.save();

//       // Notify admin about certificate request
//       await notifyCertificateRequest(certificate);

//       res.status(201).json({
//         certificate,
//         message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Access library services
//   getLibraryServices: async (req, res) => {
//     try {
//       const { studentId } = req.params;

//       const issuedBooks = await BookIssue.find({
//         user: studentId,
//         status: { $in: ['issued', 'overdue'] }
//       }).populate('book');

//       const availableBooks = await Library.find({
//         status: 'available'
//       }).select('bookTitle author category');

//       // Calculate fines for overdue books
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
//           daysOverdue: fine > 0 ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
//         };
//       });

//       res.json({
//         issuedBooks: booksWithFine,
//         availableBooks,
//         totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0)
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // View transportation details
//   getTransportationDetails: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const transport = await Transportation.findOne({
//         students: studentId
//       }).populate('route driver vehicle');

//       if (!transport) {
//         return res.status(404).json({ message: 'Transportation details not found' });
//       }

//       // Add student-specific pickup/drop times
//       const student = await User.findById(studentId);
//       const routeStop = transport.route.stops.find(
//         stop => stop.area === student.profile.address.area
//       );

//       res.json({
//         ...transport.toObject(),
//         studentPickup: routeStop ? routeStop.pickupTime : null,
//         studentDrop: routeStop ? routeStop.dropTime : null
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get monthly progress reports
//   getMonthlyProgress: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { month, year } = req.query;

//       const progress = await ProgressReport.findOne({
//         student: studentId,
//         month: parseInt(month),
//         year: parseInt(year)
//       })
//       .populate('subjects.teacher', 'name')
//       .populate('generatedBy', 'name');

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
//       const student = await User.findById(studentId).select('profile.class');

//       const events = await Event.find({
//         $or: [
//           { targetClass: student.profile.class },
//           { targetType: 'all' }
//         ],
//         date: { $gte: new Date() }
//       }).sort({ date: 1 });

//       res.json(events);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };

// module.exports = studentController;



const mongoose = require('mongoose');

const studentController = {
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
        statistics: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          percentage,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getStudyMaterials: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const StudyMaterial = require('../models/StudyMaterial')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails || !student.studentDetails.class) {
        return res.status(404).json({ message: 'Student class not found' });
      }

      const materials = await StudyMaterial.find({
        school: schoolId,
        class: student.studentDetails.class,
        isActive: true,
      })
        .populate('uploadedBy', 'name', User)
        .sort({ createdAt: -1 });

      res.json(materials);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

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
      if (!homework) {
        return res.status(404).json({ message: 'Homework not found' });
      }

      const student = await User.findById(studentId);
      if (student.studentDetails.class.toString() !== homework.class.toString()) {
        return res.status(403).json({ message: 'This homework is not assigned to your class' });
      }

      const existingSubmission = homework.submissions.find(
        s => s.student.toString() === studentId.toString()
      );

      if (existingSubmission) {
        existingSubmission.files = files;
        existingSubmission.comments = comments;
        existingSubmission.submissionDate = new Date();
        existingSubmission.status = new Date() > homework.dueDate ? 'late' : 'submitted';
      } else {
        const submission = {
          student: studentId,
          submissionDate: new Date(),
          files,
          comments,
          status: new Date() > homework.dueDate ? 'late' : 'submitted',
        };
        homework.submissions.push(submission);
      }

      await homework.save();

      const submission = homework.submissions.find(
        s => s.student.toString() === studentId.toString()
      );

      res.json(submission);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getExamSchedule: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: 'Student class not found' });
      }

      const exams = await Exam.find({
        school: schoolId,
        class: student.studentDetails.class,
        date: { $gte: new Date() },
      })
        .populate('subject', 'name', Subject)
        .sort({ date: 1 });

      const examsWithSeating = exams.map(exam => {
        let seatInfo = null;
        if (exam.seatingArrangement) {
          for (const room of exam.seatingArrangement) {
            for (const row of room.arrangement) {
              const studentSeat = row.students.find(
                s => s.student.toString() === studentId
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

        return {
          ...exam.toObject(),
          seatingInfo: seatInfo,
        };
      });

      res.json(examsWithSeating);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

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

        if (!exam) {
          return res.status(404).json({ message: 'Exam not found' });
        }

        const studentResult = exam.results.find(
          r => r.student.toString() === studentId
        );

        if (!studentResult) {
          return res.status(404).json({ message: 'Results not found for this student' });
        }

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
        if (!student || !student.studentDetails.class) {
          return res.status(404).json({ message: 'Student class not found' });
        }

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

      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      const overallPerformance = calculateOverallPerformance(reportCard.subjects);

      res.json({
        ...reportCard.toObject(),
        overallPerformance,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  payFees: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { amount, feeType, paymentMethod, feeId } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Fee = require('../models/Fee')(connection);
      const Payment = require('../models/Payment')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId });
      if (student.studentDetails.isRTE) { // Adjusted to studentDetails.isRTE
        return res.status(400).json({ message: 'RTE students are exempted from fees' });
      }

      if (feeId) {
        const fee = await Fee.findOne({ _id: feeId, school: schoolId });
        if (!fee) {
          return res.status(404).json({ message: 'Fee record not found' });
        }
        if (fee.amount !== amount) {
          return res.status(400).json({ message: 'Payment amount does not match fee amount' });
        }
      }

      const payment = new Payment({
        school: schoolId, // Add school field
        student: studentId,
        amount,
        feeType,
        paymentMethod,
        feeId,
        status: 'pending',
        transactionDate: new Date(),
      });

      await payment.save();

      // Simulate payment success (replace with actual gateway integration)
      setTimeout(async () => {
        payment.status = 'completed';
        payment.transactionId = 'TXN' + Date.now();
        await payment.save();

        if (feeId) {
          await Fee.findByIdAndUpdate(feeId, { status: 'paid' });
        }
      }, 3000);

      res.json({
        payment,
        message: 'Payment initiated successfully. You will be redirected to payment gateway.',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getFeeReceipts: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Payment = require('../models/Payment')(connection);
      const Fee = require('../models/Fee')(connection);

      const receipts = await Payment.find({
        student: studentId,
        school: schoolId,
        status: 'completed',
      })
        .populate('feeId', 'type dueDate', Fee) // Adjusted field name from title to type
        .sort({ transactionDate: -1 });

      res.json(receipts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // requestCertificate: async (req, res) => {
  //   try {
  //     const { studentId } = req.params;
  //     const { type, purpose, urgency } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require('../models/Certificate')(connection);

  //     const certificate = new Certificate({
  //       school: schoolId, // Add school field
  //       student: studentId,
  //       type,
  //       purpose,
  //       urgency: urgency || 'normal',
  //       status: 'pending',
  //       requestDate: new Date(),
  //     });

  //     await certificate.save();

  //     // Notify admin (implement notifyCertificateRequest if needed)
  //     // await notifyCertificateRequest(certificate);

  //     res.status(201).json({
  //       certificate,
  //       message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`,
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  requestCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { type, purpose, urgency } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);

      // Validate certificate type
      const validTypes = ['bonafide', 'leaving', 'transfer'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: 'Invalid certificate type' });
      }

      // Check if student has pending fees for leaving/transfer certificates
      if (['leaving', 'transfer'].includes(type)) {
        const Fee = require('../models/Fee')(connection);
        const hasPendingFees = await Fee.findOne({ 
          student: studentId, 
          status: 'pending', 
          school: schoolId 
        });
        if (hasPendingFees) {
          return res.status(400).json({ message: 'Clear all pending fees first' });
        }
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

  getStudentCertificates: async (req, res) => {
    try {
      const { studentId } = req.params;

      // Debug logging
      console.log('req.user:', req.user);
      console.log('req.school:', req.school);

      // Check if req.school is undefined
      if (!req.school || !req.school._id) {
        return res.status(500).json({ error: 'School context is missing. Please ensure the user is associated with a school.' });
      }

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: 'Invalid student ID' });
      }

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
      }

      const certificates = await Certificate.find({
        school: schoolId,
        student: studentId,
        isSentToStudent: true, // Only show certificates that have been sent to the student
      })
        .populate('generatedBy', 'name email')
        .sort({ requestDate: -1 });

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
      console.error('Error in getStudentCertificates:', error);
      res.status(500).json({ error: error.message });
    }
  },



// getStudentCertificates: async (req, res) => {
//   try {
//     const { studentId } = req.params;

//     console.log('req.user:', req.user);
//     console.log('req.school:', req.school);

//     if (!req.user || !req.user._id) {
//       return res.status(401).json({ error: 'User not authenticated' });
//     }

//     // Fetch school based on user if not already set
//     let schoolId;
//     if (!req.school || !req.school._id) {
//       const user = await User.findById(req.user._id);
//       if (!user || !user.school) {
//         return res.status(500).json({ error: 'User is not associated with a school' });
//       }
//       schoolId = user.school.toString();
//     } else {
//       schoolId = req.school._id.toString();
//     }

//     const connection = req.connection;
//     const Certificate = require('../models/Certificate')(connection);

//     if (!mongoose.Types.ObjectId.isValid(studentId)) {
//       return res.status(400).json({ message: 'Invalid student ID' });
//     }

//     if (studentId !== req.user._id.toString()) {
//       return res.status(403).json({ message: 'Unauthorized: You can only view your own certificates' });
//     }

//     const certificates = await Certificate.find({
//       school: schoolId,
//       student: studentId,
//       isSentToStudent: true,
//     })
//       .populate('generatedBy', 'name email')
//       .sort({ requestDate: -1 });

//     res.json({
//       status: 'success',
//       count: certificates.length,
//       certificates: certificates.map(cert => ({
//         id: cert._id,
//         type: cert.type,
//         purpose: cert.purpose,
//         urgency: cert.urgency,
//         requestDate: cert.requestDate,
//         status: cert.status,
//         documentUrl: cert.documentUrl || null,
//         signedDocumentUrl: cert.signedDocumentUrl || null,
//         issuedDate: cert.issuedDate || null,
//         generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//         comments: cert.comments || null,
//       })),
//     });
//   } catch (error) {
//     console.error('Error in getStudentCertificates:', error);
//     res.status(500).json({ error: error.message });
//   }
// },

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
          fine = daysOverdue * 5; // ₹5 per day
        }

        return {
          ...issue.toObject(),
          fine,
          daysOverdue: fine > 0 ? daysOverdue : 0,
        };
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
      }).populate('route driver vehicle'); // Adjust population fields as per schema

      if (!transport) {
        return res.status(404).json({ message: 'Transportation details not found' });
      }

      const student = await User.findOne({ _id: studentId, school: schoolId });
      const routeStop = transport.route.stops.find(
        stop => stop.area === student.studentDetails.address?.area // Adjust based on schema
      );

      res.json({
        ...transport.toObject(),
        studentPickup: routeStop ? routeStop.pickupTime : null,
        studentDrop: routeStop ? routeStop.dropTime : null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

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
      })
        .populate('subjects.teacher', 'name', User)
        .populate('generatedBy', 'name', User);

      if (!progress) {
        return res.status(404).json({ message: 'Progress report not found for the specified month' });
      }

      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getEventNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Event = require('../models/Event')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId }).select('studentDetails.class');
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: 'Student class not found' });
      }

      const events = await Event.find({
        school: schoolId,
        $or: [
          { targetClass: student.studentDetails.class },
          { targetType: 'all' },
        ],
        date: { $gte: new Date() },
      }).sort({ date: 1 });

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

// Placeholder helper functions
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  return 'F';
};

const calculateOverallPerformance = (subjects) => {
  // Placeholder; implement as needed
  return { average: 85, grade: 'A' };
};

module.exports = studentController;