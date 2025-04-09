const mongoose = require("mongoose");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Fee = require("../models/Fee");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { generateFeeSlip } = require("../utils/helpers");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const parentController = {
  async validateStudent(parentId, studentId, connection) {
    const UserModel = User(connection);
    const parent = await UserModel.findById(parentId).select(
      "studentDetails.children"
    );
    if (!parent || !parent.studentDetails || !parent.studentDetails.children) {
      throw new Error("No children associated with this parent");
    }
    if (
      !parent.studentDetails.children.some(
        (child) => child.toString() === studentId
      )
    ) {
      throw new Error("This student is not associated with your account");
    }
    return true;
  },

  getAttendance: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Attendance = require("../models/Attendance")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        user: studentId,
        school: schoolId,
        date: { $gte: startDate, $lte: endDate },
      }).sort({ date: 1 });

      const totalDays = attendance.length;
      const presentDays = attendance.filter(
        (a) => a.status === "present"
      ).length;
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

  // Get study materials for a student's parent
  getStudyMaterials: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const StudyMaterial = require("../models/StudyMaterial")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const materials = await StudyMaterial.find({
        school: schoolId,
        class: student.studentDetails.class,
        isActive: true,
      })
        .populate("uploadedBy", "name", User)
        .sort({ createdAt: -1 });

      res.json(materials);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAssignedHomework: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Homework = require("../models/Homework")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (
        !student ||
        !student.studentDetails ||
        !student.studentDetails.class
      ) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const homework = await Homework.find({
        school: schoolId,
        class: student.studentDetails.class,
      })
        .populate("assignedBy", "name", User)
        .sort({ dueDate: 1 });

      const formattedHomework = homework.map((hw) => {
        const studentSubmission = hw.submissions.find(
          (sub) => sub.student.toString() === studentId
        );
        return {
          id: hw._id,
          title: hw.title,
          description: hw.description,
          subject: hw.subject,
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

      res.json(formattedHomework);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Parents cannot submit homework, so this is omitted or can be added as a read-only view if needed

  // Get exam schedule for a student's parent
  getExamSchedule: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await User.findOne({
        _id: studentId,
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
                (s) => s.student.toString() === studentId
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

      res.json(examsWithSeating);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get results for a student's parent
  getResults: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { examId } = req.query;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      if (examId) {
        const exam = await Exam.findOne({ _id: examId, school: schoolId })
          .select("name class subject totalMarks results")
          .populate("subject", "name", Subject);

        if (!exam) return res.status(404).json({ message: "Exam not found" });

        const studentResult = exam.results.find(
          (r) => r.student.toString() === studentId
        );
        if (!studentResult)
          return res
            .status(404)
            .json({ message: "Results not found for this student" });

        const percentage = (studentResult.marks / exam.totalMarks) * 100;
        const grade = parentController.calculateGrade(percentage);

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
        const student = await User.findOne({
          _id: studentId,
          school: schoolId,
        }).select("studentDetails.class");
        if (!student || !student.studentDetails.class) {
          return res.status(404).json({ message: "Student class not found" });
        }

        const allExams = await Exam.find({
          school: schoolId,
          class: student.studentDetails.class,
        })
          .select("name subject totalMarks results date")
          .populate("subject", "name", Subject)
          .sort({ date: -1 });

        const results = allExams
          .map((exam) => {
            const result = exam.results.find(
              (r) => r.student.toString() === studentId
            );
            if (!result) return null;
            const percentage = (result.marks / exam.totalMarks) * 100;
            const grade = parentController.calculateGrade(percentage);
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
          })
          .filter(Boolean);

        res.json(results);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get report card for a student's parent
  getReportCard: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { term, year } = req.query;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const reportCard = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        term,
        academicYear: year,
      })
        .populate("subjects.teacher", "name", User)
        .populate("class", "name division", Class)
        .populate("generatedBy", "name", User);

      if (!reportCard)
        return res.status(404).json({ message: "Report card not found" });

      const overallPerformance = parentController.calculateOverallPerformance(
        reportCard.subjects
      );

      res.json({ ...reportCard.toObject(), overallPerformance });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all fees for a student by selecting fee type (for parent panel)
  getStudentFeesByType: async (req, res) => {
    try {
      const { studentId, feeType } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);

      await parentController.validateStudent(parentId, studentId, connection);

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

  getFeeTypes: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const UserModel = User(connection);
      const PaymentModel = Payment(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await UserModel.findById(studentId);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      if (student.studentDetails.isRTE) {
        return res.json({
          message: "RTE students are exempted from fees",
          isRTE: true,
          feeTypes: [],
        });
      }

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      });

      const paidFees = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
        status: "completed",
      });

      const paidFeeTypes = new Set(
        paidFees.flatMap((p) => p.feesPaid.map((f) => f.type))
      );

      const feeTypesWithStatus = feeDefinitions.map((fee) => ({
        type: fee.type,
        label: fee.type.charAt(0).toUpperCase() + fee.type.slice(1) + " Fee",
        amount: fee.amount,
        description: fee.description,
        isPaid: paidFeeTypes.has(fee.type),
        paymentDetails:
          paidFees
            .find((p) => p.feesPaid.some((f) => f.type === fee.type))
            ?.feesPaid.find((f) => f.type === fee.type)?.paymentDetails || null,
      }));

      res.json({
        feeTypes: feeTypesWithStatus,
        studentName: student.name,
        grNumber: student.studentDetails.grNumber,
        class: student.studentDetails.class,
        month: parseInt(month),
        year: parseInt(year),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  payFeesByType: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { feeTypes, month, year, paymentMethod } = req.body;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = Fee(connection);
      const PaymentModel = Payment(connection);
      const UserModel = User(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await UserModel.findById(studentId);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      if (student.studentDetails.isRTE) {
        return res
          .status(400)
          .json({ message: "RTE students are exempted from fees" });
      }

      if (paymentMethod === "cash") {
        return res
          .status(403)
          .json({
            message: "Parents cannot pay via cash. Contact the fee manager.",
          });
      }

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
        type: { $in: feeTypes },
      });

      if (feeDefinitions.length !== feeTypes.length) {
        return res
          .status(404)
          .json({ message: "Some fee types not defined for this month" });
      }

      const existingPayments = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        "feesPaid.month": parseInt(month),
        "feesPaid.year": parseInt(year),
        "feesPaid.type": { $in: feeTypes },
        status: "completed",
      });

      const paidTypes = new Set(
        existingPayments.flatMap((p) => p.feesPaid.map((f) => f.type))
      );
      const feesToPay = feeDefinitions.filter(
        (fee) => !paidTypes.has(fee.type)
      );

      if (feesToPay.length === 0) {
        return res
          .status(400)
          .json({ message: "All selected fees are already paid" });
      }

      const totalAmount = feesToPay.reduce((sum, fee) => sum + fee.amount, 0);
      const options = {
        amount: totalAmount * 100,
        currency: "INR",
        receipt: `fee_${studentId}_${month}_${year}`,
      };
      const order = await razorpay.orders.create(options);

      const payment = new PaymentModel({
        school: schoolId,
        student: studentId,
        grNumber: student.studentDetails.grNumber,
        amount: totalAmount,
        paymentMethod,
        status: "pending",
        orderId: order.id,
        feesPaid: feesToPay.map((fee) => ({
          feeId: fee._id,
          type: fee.type,
          month: parseInt(month),
          year: parseInt(year),
          amount: fee.amount,
        })),
      });

      await payment.save();

      res.json({
        orderId: order.id,
        amount: totalAmount * 100,
        currency: "INR",
        key: process.env.RAZORPAY_KEY_ID,
        payment,
        message: "Payment initiated. Proceed with Razorpay checkout.",
      });
    } catch (error) {
      console.error("Payment Error:", error);
      res.status(500).json({ error: error.message });
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

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const payment = await PaymentModel.findOne({
        orderId: razorpay_order_id,
      });
      if (!payment)
        return res.status(404).json({ message: "Payment not found" });

      const student = await UserModel.findById(payment.student);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      await parentController.validateStudent(
        req.user._id,
        payment.student,
        connection
      );

      payment.status = "completed";
      payment.transactionId = razorpay_payment_id;
      payment.paymentDate = new Date();
      payment.receiptNumber = `REC${Date.now()}`;
      await payment.save();

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
            dueDate:
              feeDefinition?.dueDate ||
              new Date(feePaid.year, feePaid.month - 1, 28),
            month: feePaid.month,
            year: feePaid.year,
            status: "paid",
            description: feeDefinition?.description || "",
          });
        } else {
          fee.status = "paid";
        }

        fee.paymentDetails = {
          transactionId: razorpay_payment_id,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          receiptNumber: payment.receiptNumber,
        };
        await fee.save();
      }

      const feeSlip = generateFeeSlip(
        student,
        payment,
        payment.feesPaid,
        schoolId
      );
      payment.receiptUrl = feeSlip.pdfUrl;
      await payment.save();

      res.json({
        message: "Payment verified successfully",
        payment,
        feeSlip,
        receiptUrl: feeSlip.pdfUrl,
      });
    } catch (error) {
      console.error("Verification Error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getFeeReceipts: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const payments = await PaymentModel.find({
        student: studentId,
        school: schoolId,
        status: "completed",
      }).sort({ paymentDate: -1 });

      const receipts = await Promise.all(
        payments.map(async (payment) => {
          const fees = await FeeModel.find({
            student: studentId,
            school: schoolId,
            month: { $in: payment.feesPaid.map((f) => f.month) },
            year: { $in: payment.feesPaid.map((f) => f.year) },
            type: { $in: payment.feesPaid.map((f) => f.type) },
          });
          return {
            paymentId: payment._id,
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptUrl: payment.receiptUrl,
            fees: fees.map((fee) => ({
              type: fee.type,
              amount: fee.amount,
              month: fee.month,
              year: fee.year,
              dueDate: fee.dueDate,
            })),
          };
        })
      );

      res.json(receipts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Request certificate (parents can request on behalf of their child)
  requestCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { type, purpose, urgency } = req.body;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const validTypes = ["bonafide", "leaving", "transfer"];
      if (!validTypes.includes(type))
        return res.status(400).json({ message: "Invalid certificate type" });

      if (["leaving", "transfer"].includes(type)) {
        const FeeModel = Fee(connection);
        const hasPendingFees = await FeeModel.findOne({
          student: studentId,
          status: "pending",
          school: schoolId,
        });
        if (hasPendingFees)
          return res
            .status(400)
            .json({ message: "Clear all pending fees first" });
      }

      const certificate = new Certificate({
        school: schoolId,
        student: studentId,
        type,
        purpose,
        urgency: urgency || "normal",
        status: "pending",
        requestDate: new Date(),
      });

      await certificate.save();

      res.status(201).json({
        certificate,
        message: `Your ${type} certificate request for your child has been submitted.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get student certificates for a parent's child
  getStudentCertificates: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      const certificates = await Certificate.find({
        school: schoolId,
        student: studentId,
        isSentToStudent: true,
      })
        .populate("generatedBy", "name email")
        .sort({ requestDate: -1 });

      res.json({
        status: "success",
        count: certificates.length,
        certificates: certificates.map((cert) => ({
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

  downloadCertificate: async (req, res) => {
    try {
      const { studentId, certificateId, documentKey } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const { streamS3Object } = require("../config/s3Upload");

      await parentController.validateStudent(parentId, studentId, connection);

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
        student: studentId,
        isSentToStudent: true,
      });

      if (!certificate) {
        return res
          .status(404)
          .json({
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
    } catch (error) {
      console.error("Error streaming certificate:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Get library services for a student's parent
  getLibraryServices: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Library = require("../models/Library")(connection).Library;
      const BookIssue = require("../models/Library")(connection).BookIssue;

      await parentController.validateStudent(parentId, studentId, connection);

      const issuedBooks = await BookIssue.find({
        user: studentId,
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
        if (dueDate < today) {
          const daysOverdue = Math.ceil(
            (today - dueDate) / (1000 * 60 * 60 * 24)
          );
          fine = daysOverdue * 5;
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

  // Get transportation details for a student's parent
  getTransportationDetails: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Transportation = require("../models/Transportation")(connection);
      const User = require("../models/User")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const transport = await Transportation.findOne({
        school: schoolId,
        students: studentId,
      }).populate("route driver vehicle");

      if (!transport)
        return res
          .status(404)
          .json({ message: "Transportation details not found" });

      const student = await User.findOne({ _id: studentId, school: schoolId });
      const routeStop = transport.route.stops.find(
        (stop) => stop.area === student.studentDetails.address?.area
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

  // Get monthly progress for a student's parent
  getMonthlyProgress: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { month, year } = req.query;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const User = require("../models/User")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const progress = await ProgressReport.findOne({
        student: studentId,
        school: schoolId,
        month: parseInt(month),
        year: parseInt(year),
      })
        .populate("subjects.teacher", "name", User)
        .populate("generatedBy", "name", User);

      if (!progress)
        return res
          .status(404)
          .json({
            message: "Progress report not found for the specified month",
          });

      res.json(progress);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get event notifications for a student's parent
  getEventNotifications: async (req, res) => {
    try {
      const { studentId } = req.params;
      const parentId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Event = require("../models/Event")(connection);

      await parentController.validateStudent(parentId, studentId, connection);

      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.class");
      if (!student || !student.studentDetails.class) {
        return res.status(404).json({ message: "Student class not found" });
      }

      const events = await Event.find({
        school: schoolId,
        $or: [
          { targetClass: student.studentDetails.class },
          { targetType: "all" },
        ],
        date: { $gte: new Date() },
      }).sort({ date: 1 });

      res.json(events);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Utility functions
  calculateGrade: (percentage) => {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C+";
    if (percentage >= 40) return "C";
    return "F";
  },

  calculateOverallPerformance: (subjects) => {
    return { average: 85, grade: "A" }; // Placeholder logic
  },
};

module.exports = parentController;
