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
//       const percentage = (presentDays / totalDays) * 100;

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
      
//       const materials = await StudyMaterial.find({
//         class: student.profile.class,
//         isActive: true
//       }).sort({ createdAt: -1 });

//       res.json(materials);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Submit homework
//   submitHomework: async (req, res) => {
//     try {
//       const { homeworkId } = req.params;
//       const { files } = req.body;

//       const homework = await Homework.findById(homeworkId);
//       if (!homework) {
//         return res.status(404).json({ message: 'Homework not found' });
//       }

//       const submission = {
//         student: req.user._id,
//         submissionDate: new Date(),
//         files,
//         status: new Date() > homework.dueDate ? 'late' : 'submitted'
//       };

//       homework.submissions.push(submission);
//       await homework.save();

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
//       }).sort({ date: 1 });

//       res.json(exams);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Check results
//   getResults: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { examId } = req.query;

//       const results = await Exam.findById(examId)
//         .select('results')
//         .populate('results.student', 'name');

//       const studentResult = results.results.find(
//         r => r.student._id.toString() === studentId
//       );

//       res.json(studentResult);
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
//       }).populate('subjects.teacher', 'name');

//       if (!reportCard) {
//         return res.status(404).json({ message: 'Report card not found' });
//       }

//       res.json(reportCard);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Pay fees online
//   payFees: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { amount, feeType, paymentMethod } = req.body;

//       const payment = new Payment({
//         student: studentId,
//         amount,
//         feeType,
//         paymentMethod,
//         status: 'pending'
//       });

//       await payment.save();

//       // Integrate with payment gateway here
//       // Update payment status based on gateway response

//       res.json(payment);
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
//       }).sort({ createdAt: -1 });

//       res.json(receipts);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request certificates
//   requestCertificate: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { type, purpose } = req.body;

//       const certificate = new Certificate({
//         student: studentId,
//         type,
//         purpose,
//         status: 'pending'
//       });

//       await certificate.save();
//       res.json(certificate);
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

//       res.json({
//         issuedBooks,
//         availableBooks
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

//       res.json(transport);
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
//         month,
//         year
//       }).populate('subjects.teacher', 'name');

//       res.json(progress);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },


const Timetable = require('../models/Timetable');
const Homework = require('../models/Homework');
const Attendance = require('../models/Attendance');
const { Library, BookIssue } = require('../models/Library');
const Exam = require('../models/Exam');
const Payment = require('../models/Payment');
const Certificate = require('../models/Certificate');
const Transportation = require('../models/Transportation');
const StudyMaterial = require('../models/StudyMaterial');
const ProgressReport = require('../models/ProgressReport');
const Event = require('../models/Event');
const User = require('../models/User');
const Fee = require('../models/Fee');

const studentController = {
  // View attendance records
  getAttendance: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        user: studentId,
        date: { $gte: startDate, $lte: endDate }
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
          percentage
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Access study materials
  getStudyMaterials: async (req, res) => {
    try {
      const { studentId } = req.params;
      const student = await User.findById(studentId).select('profile.class');
      
      if (!student || !student.profile || !student.profile.class) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const materials = await StudyMaterial.find({
        class: student.profile.class,
        isActive: true
      })
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });

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

      const homework = await Homework.findById(homeworkId);
      if (!homework) {
        return res.status(404).json({ message: 'Homework not found' });
      }

      // Verify student is in the correct class
      const student = await User.findById(studentId);
      if (student.profile.class.toString() !== homework.class.toString()) {
        return res.status(403).json({ message: 'This homework is not assigned to your class' });
      }

      // Check if already submitted
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
          status: new Date() > homework.dueDate ? 'late' : 'submitted'
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

  // View exam schedules
  getExamSchedule: async (req, res) => {
    try {
      const { studentId } = req.params;
      const student = await User.findById(studentId).select('profile.class');

      const exams = await Exam.find({
        class: student.profile.class,
        date: { $gte: new Date() }
      })
      .populate('subject', 'name')
      .sort({ date: 1 });

      // Add seating information if available
      const examsWithSeating = exams.map(exam => {
        let seatInfo = null;
        if (exam.seatingArrangement) {
          // Find student's seating
          for (const room of exam.seatingArrangement) {
            for (const row of room.arrangement) {
              const studentSeat = row.students.find(
                s => s.student.toString() === studentId
              );
              if (studentSeat) {
                seatInfo = {
                  room: room.classroom,
                  row: row.row,
                  position: studentSeat.position
                };
                break;
              }
            }
            if (seatInfo) break;
          }
        }

        return {
          ...exam.toObject(),
          seatingInfo: seatInfo
        };
      });

      res.json(examsWithSeating);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Check results
  getResults: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { examId } = req.query;

      if (examId) {
        // Specific exam results
        const exam = await Exam.findById(examId)
          .select('name class subject totalMarks results')
          .populate('subject', 'name');

        if (!exam) {
          return res.status(404).json({ message: 'Exam not found' });
        }

        const studentResult = exam.results.find(
          r => r.student.toString() === studentId
        );

        if (!studentResult) {
          return res.status(404).json({ message: 'Results not found for this student' });
        }

        // Calculate grade
        const percentage = (studentResult.marks / exam.totalMarks) * 100;
        const grade = calculateGrade(percentage);

        res.json({
          exam: exam.name,
          subject: exam.subject.name,
          marks: studentResult.marks,
          totalMarks: exam.totalMarks,
          percentage: percentage.toFixed(2),
          grade,
          remarks: studentResult.remarks
        });
      } else {
        // All exams for the student
        const student = await User.findById(studentId).select('profile.class');
        
        const allExams = await Exam.find({ class: student.profile.class })
          .select('name subject totalMarks results date')
          .populate('subject', 'name')
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
            remarks: result.remarks
          };
        }).filter(Boolean);

        res.json(results);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Download report cards
  getReportCard: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { term, year } = req.query;

      const reportCard = await ProgressReport.findOne({
        student: studentId,
        term,
        academicYear: year
      })
      .populate('subjects.teacher', 'name')
      .populate('class', 'name division')
      .populate('generatedBy', 'name');

      if (!reportCard) {
        return res.status(404).json({ message: 'Report card not found' });
      }

      // Calculate overall grade
      const overallPerformance = calculateOverallPerformance(reportCard.subjects);

      res.json({
        ...reportCard.toObject(),
        overallPerformance
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Pay fees online
  payFees: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { amount, feeType, paymentMethod, feeId } = req.body;

      // Verify student is not RTE (Right to Education)
      const student = await User.findById(studentId);
      if (student.profile.isRteStudent) {
        return res.status(400).json({ message: 'RTE students are exempted from fees' });
      }

      // Verify fee amount if feeId is provided
      if (feeId) {
        const fee = await Fee.findById(feeId);
        if (!fee) {
          return res.status(404).json({ message: 'Fee record not found' });
        }
        if (fee.amount !== amount) {
          return res.status(400).json({ message: 'Payment amount does not match fee amount' });
        }
      }

      const payment = new Payment({
        student: studentId,
        amount,
        feeType,
        paymentMethod,
        feeId,
        status: 'pending',
        transactionDate: new Date()
      });

      await payment.save();

      // Integrate with payment gateway here
      // For demo, we'll simulate a successful payment
      setTimeout(async () => {
        payment.status = 'completed';
        payment.transactionId = 'TXN' + Date.now();
        await payment.save();

        // If fee payment, update fee status
        if (feeId) {
          await Fee.findByIdAndUpdate(feeId, { status: 'paid' });
        }
      }, 3000);

      res.json({
        payment,
        message: 'Payment initiated successfully. You will be redirected to payment gateway.'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Download fee receipts
  getFeeReceipts: async (req, res) => {
    try {
      const { studentId } = req.params;
      const receipts = await Payment.find({
        student: studentId,
        status: 'completed'
      })
      .populate('feeId', 'title dueDate')
      .sort({ transactionDate: -1 });

      res.json(receipts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Request certificates
  requestCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { type, purpose, urgency } = req.body;

      const certificate = new Certificate({
        student: studentId,
        type, // 'bonafide', 'transfer', 'character', etc.
        purpose,
        urgency: urgency || 'normal',
        status: 'pending',
        requestDate: new Date()
      });

      await certificate.save();

      // Notify admin about certificate request
      await notifyCertificateRequest(certificate);

      res.status(201).json({
        certificate,
        message: `Your ${type} certificate request has been submitted. You will be notified when it's ready.`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Access library services
  getLibraryServices: async (req, res) => {
    try {
      const { studentId } = req.params;

      const issuedBooks = await BookIssue.find({
        user: studentId,
        status: { $in: ['issued', 'overdue'] }
      }).populate('book');

      const availableBooks = await Library.find({
        status: 'available'
      }).select('bookTitle author category');

      // Calculate fines for overdue books
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
          daysOverdue: fine > 0 ? Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)) : 0
        };
      });

      res.json({
        issuedBooks: booksWithFine,
        availableBooks,
        totalFine: booksWithFine.reduce((sum, book) => sum + book.fine, 0)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // View transportation details
  getTransportationDetails: async (req, res) => {
    try {
      const { studentId } = req.params;
      const transport = await Transportation.findOne({
        students: studentId
      }).populate('route driver vehicle');

      if (!transport) {
        return res.status(404).json({ message: 'Transportation details not found' });
      }

      // Add student-specific pickup/drop times
      const student = await User.findById(studentId);
      const routeStop = transport.route.stops.find(
        stop => stop.area === student.profile.address.area
      );

      res.json({
        ...transport.toObject(),
        studentPickup: routeStop ? routeStop.pickupTime : null,
        studentDrop: routeStop ? routeStop.dropTime : null
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get monthly progress reports
  getMonthlyProgress: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;

      const progress = await ProgressReport.findOne({
        student: studentId,
        month: parseInt(month),
        year: parseInt(year)
      })
      .populate('subjects.teacher', 'name')
      .populate('generatedBy', 'name');

      if (!progress) {
        return res.status(404).json({ message: 'Progress report not found for the specified month' });
      }

      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get event notifications
  getEventNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;
      const student = await User.findById(studentId).select('profile.class');

      const events = await Event.find({
        $or: [
          { targetClass: student.profile.class },
          { targetType: 'all' }
        ],
        date: { $gte: new Date() }
      }).sort({ date: 1 });

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = studentController;