const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { sendAdmissionNotification } = require("../utils/notifications");
const {
  uploadToS3,
  deleteFromS3,
  streamS3Object,
} = require("../config/s3Upload");
const multer = require("multer");
const QRCode = require("qrcode"); 
const jwt = require("jsonwebtoken"); 

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const clerkController = {
  getDashboard: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const clerkId = req.user._id.toString();
      const connection = req.connection;

      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );
      const Certificate = require("../models/Certificate")(connection);
      const User = require("../models/User")(connection);
      const Leave = require("../models/Leave")(connection);

      const today = new Date("2025-03-21");
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const pendingVerifications = await AdmissionApplication.countDocuments({
        school: schoolId,
        $or: [
          {
            status: { $in: ["pending", "document_verification"] },
            "clerkVerification.status": "pending",
          },
          {
            status: "approved",
            "feesVerification.status": "verified",
            "clerkVerification.status": "verified",
          },
        ],
      });

      const pendingCertificates = await Certificate.countDocuments({
        school: schoolId,
        status: "pending",
      });

      const enrolledToday = await User.countDocuments({
        school: schoolId,
        role: "student",
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

      const totalLeaves = await Leave.countDocuments({
        school: schoolId,
        user: clerkId,
      });

      const leaveSummary = await Leave.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            user: new mongoose.Types.ObjectId(clerkId),
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            status: "$_id",
            count: 1,
            _id: 0,
          },
        },
      ]);

      const leaveStatus = {
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };

      leaveSummary.forEach((item) => {
        if (item.status in leaveStatus) {
          leaveStatus[item.status] = item.count;
        }
      });
      leaveStatus.total =
        leaveStatus.pending + leaveStatus.approved + leaveStatus.rejected;

      const rteStudents = await User.countDocuments({
        school: schoolId,
        "studentDetails.isRTE": true,
        "studentDetails.admissionDate": {
          $gte: new Date("2025-01-01"),
          $lte: new Date("2025-12-31"),
        },
      });

      const totalStudents = await User.countDocuments({
        school: schoolId,
        role: "student",
      });

      const dashboardData = {
        status: "success",
        timestamp: new Date(),
        pendingVerifications,
        pendingCertificates,
        enrolledToday,
        totalStudents,
        leaveStatus,
        rteStudents,
        debug: { totalLeaves },
      };

      res.json(dashboardData);
    } catch (error) {
      console.error("Error in getDashboard:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getPendingVerifications: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const applications = await AdmissionApplication.find({
        school: schoolId,
        $or: [
          {
            status: { $in: ["pending", "document_verification"] },
            "clerkVerification.status": "pending",
          },
          {
            status: "approved",
            "feesVerification.status": "verified",
            "clerkVerification.status": "verified",
          },
        ],
      }).sort({ createdAt: -1 });

      const applicationsWithUrls = applications.map((app) => ({
        id: app._id,
        trackingId: app.trackingId,
        studentDetails: {
          name: app.studentDetails.name,
          dob: app.studentDetails.dob,
          gender: app.studentDetails.gender,
          email: app.studentDetails.email,
          mobile: app.studentDetails.mobile,
          appliedClass: app.studentDetails.appliedClass,
        },
        parentDetails: {
          name: app.parentDetails.name,
          email: app.parentDetails.email,
          mobile: app.parentDetails.mobile,
          occupation: app.parentDetails.occupation,
          address: {
            street: app.parentDetails.address.street,
            city: app.parentDetails.address.city,
            state: app.parentDetails.address.state,
            pincode: app.parentDetails.address.pincode,
          },
        },
        admissionType: app.admissionType,
        status: app.status,
        submittedOn: app.createdAt,
        documents: app.documents.map((doc) => {
          if (!doc.key) {
            console.error(
              `Missing key in application ${app._id}, document:`,
              doc
            );
          }
          return {
            type: doc.type,
            documentUrl: doc.documentUrl,
            key: doc.key,
            accessUrl: doc.key
              ? `/documents/${app._id}/${doc.key.split("/").pop()}`
              : null,
            verified: doc.verified,
          };
        }),
        additionalResponses: app.additionalResponses
          ? Object.fromEntries(app.additionalResponses)
          : {},
        clerkVerification: {
          status: app.clerkVerification.status,
          comments: app.clerkVerification.comments,
        },
        feesVerification: {
          status: app.feesVerification.status,
          receiptNumber: app.feesVerification.receiptNumber,
          verifiedAt: app.feesVerification.verifiedAt,
        },
      }));

      res.json({
        status: "success",
        count: applications.length,
        applications: applicationsWithUrls,
      });
    } catch (error) {
      console.error("Error in getPendingVerifications:", error);
      res.status(500).json({
        status: "error",
        error: error.message,
      });
    }
  },

  clerkVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, comments } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const hasAllDocuments = application.validateDocuments();
      if (!hasAllDocuments) {
        return res.status(400).json({ message: "Missing required documents" });
      }

      application.clerkVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        comments,
      };

      if (status === "verified") {
        application.status = "fees_pending";
      } else {
        application.status = "rejected";
      }

      await application.save();

      res.json({
        message: "Verification completed",
        nextStep:
          status === "verified"
            ? "Visit fees department for verification"
            : "Application rejected",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyDocuments: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { verifiedDocuments } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId });
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      student.studentDetails.status = "verified";
      await student.save();

      res.json({ message: "Documents verified successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  viewApplicationDocuments: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (req.user.role !== "clerk") {
        return res.status(403).json({ message: "Unauthorized access" });
      }

      const documents = application.documents.map((doc) => ({
        type: doc.type,
        documentUrl: doc.documentUrl,
        key: doc.key,
        accessUrl: `/documents/${applicationId}/${doc.key.split("/").pop()}`, // Permanent URL
        verified: doc.verified,
        uploadedAt: application.createdAt,
      }));

      res.json({
        status: "success",
        applicationId: application._id,
        trackingId: application.trackingId,
        studentName: application.studentDetails.name,
        admissionType: application.admissionType,
        documentCount: documents.length,
        documents,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  streamDocument: async (req, res) => {
    try {
      const { applicationId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      const document = application.documents.find((doc) =>
        doc.key.endsWith(documentKey)
      );
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      await streamS3Object(document.key, res);
    } catch (error) {
      console.error("Error streaming document:", error);
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
      res.status(500).json({ error: error.message });
    }
  },

  enrollStudent: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { classId, grNumber, password, parentPassword } = req.body; // Add parentPassword
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);
      const School = require("../models/School")(
        require("../config/database").getOwnerConnection()
      );

      if (!password || !parentPassword) {
        return res
          .status(400)
          .json({ message: "Student and parent passwords are required" });
      }

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.status !== "approved") {
        return res
          .status(400)
          .json({ message: "Only approved applications can be enrolled" });
      }

      const existingGR = await User.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      });
      if (existingGR) {
        return res.status(400).json({ message: "GR number already exists" });
      }

      const selectedClass = await Class.findOne({
        _id: classId,
        school: schoolId,
      });
      if (!selectedClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (selectedClass.students.length >= selectedClass.capacity) {
        return res.status(400).json({ message: "Class is at full capacity" });
      }

      const school = await School.findById(schoolId).select("name");
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const hashedStudentPassword = await bcrypt.hash(password, 10);
      const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

      // Create Student User
      const student = new User({
        school: schoolId,
        name: application.studentDetails.name,
        email: application.studentDetails.email,
        password: hashedStudentPassword,
        role: "student",
        status: "active",
        studentDetails: {
          grNumber,
          class: classId,
          admissionType: application.admissionType,
          parentDetails: application.parentDetails,
          dob: application.studentDetails.dob,
          gender: application.studentDetails.gender,
        },
      });

      await student.save();

      // Create Parent User
      const parent = new User({
        school: schoolId,
        name: application.parentDetails.name,
        email: application.parentDetails.email,
        password: hashedParentPassword,
        role: "parent",
        status: "active",
        profile: {
          phone: application.parentDetails.mobile,
          address: application.parentDetails.address.street, // Adjust based on your address structure
        },
        studentDetails: {
          // Optionally link parent to student(s)
          children: [student._id],
        },
      });

      await parent.save();

      // Update student with parent reference (optional)
      student.studentDetails.parent = parent._id;
      await student.save();

      await Class.findByIdAndUpdate(classId, {
        $push: { students: student._id },
      });

      application.status = "enrolled";
      application.grNumber = grNumber;
      application.assignedClass = classId;
      await application.save();

      const className = `${selectedClass.name}${
        selectedClass.division ? " " + selectedClass.division : ""
      }`;

      // Notify Student
      const studentNotification = await sendAdmissionNotification(
        student.email,
        application.studentDetails.mobile,
        student.name,
        password,
        school.name,
        className
      );

      // Notify Parent
      const parentNotification = await sendAdmissionNotification(
        parent.email,
        application.parentDetails.mobile,
        parent.name,
        parentPassword,
        school.name,
        className,
        null,
        "Parent Account Creation"
      );

      res.json({
        message: "Student and parent enrolled successfully",
        studentDetails: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber,
          class: { name: selectedClass.name, division: selectedClass.division },
        },
        parentDetails: {
          id: parent._id,
          name: parent.name,
          email: parent.email,
        },
        notificationStatus: {
          student: {
            emailSent: studentNotification.emailSent,
            smsSent: studentNotification.smsSent,
          },
          parent: {
            emailSent: parentNotification.emailSent,
            smsSent: parentNotification.smsSent,
          },
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAdmissionHistoryByGRNumber: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      const student = await User.findOne({
        school: schoolId,
        "studentDetails.grNumber": grNumber,
        role: "student",
      }).select("name email studentDetails");

      if (!student) {
        return res
          .status(404)
          .json({ message: "Student not found with the given GR number" });
      }

      const application = await AdmissionApplication.findOne({
        school: schoolId,
        grNumber,
      })
        .populate("assignedClass", "name division", Class)
        .populate("clerkVerification.verifiedBy", "name", User)
        .populate("feesVerification.verifiedBy", "name", User);

      if (!application) {
        return res
          .status(404)
          .json({
            message: "Admission application not found for this GR number",
          });
      }

      const documentsWithUrls = application.documents.map((doc) => ({
        type: doc.type,
        documentUrl: doc.documentUrl,
        key: doc.key,
        accessUrl: `/documents/${application._id}/${doc.key.split("/").pop()}`,
        verified: doc.verified,
      }));

      const admissionHistory = {
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber: student.studentDetails.grNumber,
          class: application.assignedClass
            ? `${application.assignedClass.name}${
                application.assignedClass.division
                  ? " " + application.assignedClass.division
                  : ""
              }`
            : "Not assigned",
          admissionType: student.studentDetails.admissionType,
          dob: student.studentDetails.dob,
          gender: student.studentDetails.gender,
          parentDetails: student.studentDetails.parentDetails,
        },
        application: {
          id: application._id,
          trackingId: application.trackingId,
          admissionType: application.admissionType,
          status: application.status,
          submittedOn: application.createdAt,
          documents: documentsWithUrls,
          clerkVerification: {
            status: application.clerkVerification.status,
            verifiedBy: application.clerkVerification.verifiedBy?.name || "N/A",
            verifiedAt: application.clerkVerification.verifiedAt,
            comments: application.clerkVerification.comments,
          },
          feesVerification: {
            status: application.feesVerification.status,
            verifiedBy: application.feesVerification.verifiedBy?.name || "N/A",
            verifiedAt: application.feesVerification.verifiedAt,
            receiptNumber: application.feesVerification.receiptNumber,
            comments: application.feesVerification.comments,
          },
          paymentDetails: application.paymentDetails || {
            note: "RTE - No payment required",
          },
          additionalResponses: application.additionalResponses
            ? Object.fromEntries(application.additionalResponses)
            : {},
        },
      };

      res.json({
        status: "success",
        admissionHistory,
      });
    } catch (error) {
      console.error("Error in getAdmissionHistoryByGRNumber:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // getStudentsByClass: async (req, res) => {
  //   try {
  //     const { classId } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Class = require("../models/Class")(connection);
  //     const User = require("../models/User")(connection);

  //     if (!mongoose.Types.ObjectId.isValid(classId)) {
  //       return res.status(400).json({ message: "Invalid class ID" });
  //     }

  //     const selectedClass = await Class.findOne({
  //       _id: classId,
  //       school: schoolId,
  //     });
  //     if (!selectedClass) {
  //       return res.status(404).json({ message: "Class not found" });
  //     }

  //     const students = await User.find({
  //       school: schoolId,
  //       "studentDetails.class": classId,
  //       role: "student",
  //     })
  //       .select("name email studentDetails")
  //       .lean();

  //     res.json({
  //       status: "success",
  //       class: {
  //         name: selectedClass.name,
  //         division: selectedClass.division,
  //         academicYear: selectedClass.academicYear,
  //         capacity: selectedClass.capacity,
  //         enrolledCount: selectedClass.students.length,
  //       },
  //       count: students.length,
  //       students: students.map((student) => ({
  //         id: student._id,
  //         name: student.name,
  //         email: student.email,
  //         grNumber: student.studentDetails.grNumber,
  //         admissionType: student.studentDetails.admissionType,
  //         dob: student.studentDetails.dob,
  //         gender: student.studentDetails.gender,
  //         parentDetails: student.studentDetails.parentDetails,
  //       })),
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  getStudentsByClass: async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Class = require("../models/Class")(connection);
    const User = require("../models/User")(connection);

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: "Invalid class ID" });
    }

    const selectedClass = await Class.findOne({
      _id: classId,
      school: schoolId,
    });
    
    if (!selectedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    const students = await User.find({
      school: schoolId,
      "studentDetails.class": classId,
      role: "student",
    })
      .select("name email studentDetails status createdAt updatedAt")
      .lean();

    res.json({
      status: "success",
      class: {
        name: selectedClass.name,
        division: selectedClass.division,
        academicYear: selectedClass.academicYear,
        capacity: selectedClass.capacity,
        enrolledCount: selectedClass.students.length,
      },
      count: students.length,
      students: students.map((student) => ({
        id: student._id,
        name: student.name,
        email: student.email,
        grNumber: student.studentDetails?.grNumber,
        admissionType: student.studentDetails?.admissionType,
        dob: student.studentDetails?.dob,
        gender: student.studentDetails?.gender,
        mobile: student.studentDetails?.mobile,
        isRTE: student.studentDetails?.isRTE || false,
        parentDetails: student.studentDetails?.parentDetails || null,
        transportDetails: student.studentDetails?.transportDetails || null,
        status: student.status,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt
      })),
    });
  } catch (error) {
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

  getPendingCertificates: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      const certificates = await Certificate.find({
        school: schoolId,
        status: "pending",
      })
        .populate({
          path: "student",
          select: "name email studentDetails",
          populate: {
            path: "studentDetails.class",
            model: Class,
            select: "name division",
          },
        })
        .populate("generatedBy", "name email", User)
        .sort({ requestDate: -1 });

      res.json({
        status: "success",
        count: certificates.length,
        certificates: certificates.map((cert) => ({
          id: cert._id,
          studentName: cert.student?.name || "N/A",
          studentEmail: cert.student?.email || "N/A",
          type: cert.type,
          purpose: cert.purpose,
          urgency: cert.urgency,
          requestDate: cert.requestDate,
          status: cert.status,
          grNumber: cert.student?.studentDetails?.grNumber || "N/A",
          parentName:
            cert.student?.studentDetails?.parentDetails?.name || "N/A",
          admissionDate: cert.student?.studentDetails?.admissionDate
            ? new Date(cert.student.studentDetails.admissionDate)
                .toISOString()
                .split("T")[0]
            : "N/A",
          dob: cert.student?.studentDetails?.dob
            ? new Date(cert.student.studentDetails.dob)
                .toISOString()
                .split("T")[0]
            : "N/A",
          className: cert.student?.studentDetails?.class
            ? `${cert.student.studentDetails.class.name}${
                cert.student.studentDetails.class.division
                  ? " " + cert.student.studentDetails.class.division
                  : ""
              }`
            : "N/A",
          schoolName: req.school?.name || "N/A",
          schoolAddress: req.school?.address || "N/A",
        })),
      });
    } catch (error) {
      console.error("Error in getPendingCertificates:", error);
      res.status(500).json({ error: error.message });
    }
  },

  getCertificateHistory: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      const certificates = await Certificate.find({ school: schoolId })
        .populate({
          path: "student",
          select: "name email studentDetails",
          populate: {
            path: "studentDetails.class",
            model: Class,
            select: "name division",
          },
        })
        .populate("generatedBy", "name email", User)
        .sort({ requestDate: -1 });

      const certificatesWithUrls = certificates.map((cert) => ({
        id: cert._id,
        studentName: cert.student?.name || "N/A",
        studentEmail: cert.student?.email || "N/A",
        type: cert.type,
        purpose: cert.purpose,
        urgency: cert.urgency,
        requestDate: cert.requestDate,
        status: cert.status,
        documentUrl: cert.documentUrl,
        signedDocumentUrl: cert.signedDocumentUrl,
        documentAccessUrl: cert.documentKey
          ? `/certificates/${cert._id}/${cert.documentKey.split("/").pop()}`
          : null,
        signedDocumentAccessUrl: cert.signedDocumentKey
          ? `/certificates/${cert._id}/${cert.signedDocumentKey
              .split("/")
              .pop()}`
          : null,
        isSentToStudent: cert.isSentToStudent,
        issuedDate: cert.issuedDate || null,
        generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
        comments: cert.comments || null,
        grNumber: cert.student?.studentDetails?.grNumber || "N/A",
        parentName: cert.student?.studentDetails?.parentDetails?.name || "N/A",
        admissionDate: cert.student?.studentDetails?.admissionDate
          ? new Date(cert.student.studentDetails.admissionDate)
              .toISOString()
              .split("T")[0]
          : "N/A",
        dob: cert.student?.studentDetails?.dob
          ? new Date(cert.student.studentDetails.dob)
              .toISOString()
              .split("T")[0]
          : "N/A",
        className: cert.student?.studentDetails?.class
          ? `${cert.student.studentDetails.class.name}${
              cert.student.studentDetails.class.division
                ? " " + cert.student.studentDetails.class.division
                : ""
            }`
          : "N/A",
        schoolName: req.school?.name || "N/A",
        schoolAddress: req.school?.address || "N/A",
      }));

      res.json({
        status: "success",
        count: certificates.length,
        certificates: certificatesWithUrls,
      });
    } catch (error) {
      console.error("Error in getCertificateHistory:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // generateCertificate: async (req, res) => {
  //   try {
  //     const { certificateId } = req.params;
  //     const { status, comments, pdfData, certificateType } = req.body;

  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require("../models/Certificate")(connection);
  //     const User = require("../models/User")(connection);

  //     if (!mongoose.Types.ObjectId.isValid(certificateId)) {
  //       return res.status(400).json({ message: "Invalid certificate ID" });
  //     }

  //     const certificate = await Certificate.findOne({
  //       _id: certificateId,
  //       school: schoolId,
  //     });
  //     if (!certificate) {
  //       return res
  //         .status(404)
  //         .json({ message: "Certificate request not found" });
  //     }

  //     if (status === "rejected") {
  //       certificate.status = "rejected";
  //       certificate.comments = comments;
  //       await certificate.save();
  //       return res.json({
  //         message: "Certificate request rejected",
  //         certificate,
  //       });
  //     }

  //     if (status !== "generated") {
  //       return res
  //         .status(400)
  //         .json({ message: "Invalid status for generation" });
  //     }

  //     if (!pdfData || !certificateType) {
  //       return res
  //         .status(400)
  //         .json({ message: "PDF data and certificate type are required" });
  //     }

  //     let pdfBuffer;
  //     try {
  //       pdfBuffer = Buffer.from(pdfData, "base64");
  //     } catch (error) {
  //       return res
  //         .status(400)
  //         .json({ message: "Invalid base64 PDF data", error: error.message });
  //     }

  //     const certificateKey = `certificates/${schoolId}/${certificateId}/${certificateType}.pdf`;
  //     let uploadResult;
  //     try {
  //       uploadResult = await uploadToS3(pdfBuffer, certificateKey);
  //     } catch (error) {
  //       return res
  //         .status(500)
  //         .json({ message: "Failed to upload to S3", error: error.message });
  //     }

  //     certificate.documentUrl = uploadResult.Location;
  //     certificate.documentKey = certificateKey;
  //     certificate.status = "generated";
  //     certificate.issuedDate = new Date();
  //     certificate.generatedBy = req.user._id;
  //     certificate.comments = comments;

  //     await certificate.save();

  //     res.json({
  //       message: "Certificate generated successfully",
  //       certificate: {
  //         ...certificate.toObject(),
  //         documentAccessUrl: `/certificates/${certificateId}/${certificateKey
  //           .split("/")
  //           .pop()}`,
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Error in generateCertificate:", error);
  //     res.status(500).json({ error: error.message });
  //   }
  // },


// Modified generateCertificate controller
generateCertificate: async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { 
      status, 
      comments, 
      certificateType, 
      serialNumber, 
      issuedDate,
      studentDetails // Added this to store all student data
    } = req.body;

    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Certificate = require("../models/Certificate")(connection);

    if (!mongoose.Types.ObjectId.isValid(certificateId)) {
      return res.status(400).json({ message: "Invalid certificate ID" });
    }

    const certificate = await Certificate.findOne({
      _id: certificateId,
      school: schoolId,
    });
    
    if (!certificate) {
      return res.status(404).json({ message: "Certificate request not found" });
    }

    if (status === "rejected") {
      certificate.status = "rejected";
      certificate.comments = comments;
      await certificate.save();
      return res.json({ message: "Certificate request rejected", certificate });
    }

    // Store all metadata instead of PDF
    certificate.status = "generated";
    certificate.issuedDate = new Date(issuedDate);
    certificate.generatedBy = req.user._id;
    certificate.comments = comments;
    certificate.serialNumber = serialNumber;
    certificate.studentDetails = studentDetails; // Store all student data
    certificate.certificateType = certificateType;

    await certificate.save();

    res.json({
      message: "Certificate generated successfully",
      certificate
    });
  } catch (error) {
    console.error("Error in generateCertificate:", error);
    res.status(500).json({ error: error.message });
  }
},



verifyCertificateBySerial : async (req, res) => {
  try {
    const { serialNumber } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Certificate = require("../models/Certificate")(connection);
    const User = require("../models/User")(connection);
    const Class = require("../models/Class")(connection);

    const certificate = await Certificate.findOne({
      serialNumber,
      school: schoolId,
    })
      .populate({
        path: "student",
        select: "name email studentDetails",
        populate: {
          path: "studentDetails.class",
          model: Class,
          select: "name division",
        },
      })
      .populate("generatedBy", "name email", User);

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    res.json({
      status: "success",
      certificate: {
        id: certificate._id,
        studentName: certificate.student?.name || "N/A",
        studentEmail: certificate.student?.email || "N/A",
        type: certificate.type,
        purpose: certificate.purpose,
        urgency: certificate.urgency,
        requestDate: certificate.requestDate,
        status: certificate.status,
        documentUrl: certificate.documentUrl,
        signedDocumentUrl: certificate.signedDocumentUrl,
        documentAccessUrl: certificate.documentKey
          ? `/certificates/${certificate._id}/${certificate.documentKey.split("/").pop()}`
          : null,
        signedDocumentAccessUrl: certificate.signedDocumentKey
          ? `/certificates/${certificate._id}/${certificate.signedDocumentKey.split("/").pop()}`
          : null,
        isSentToStudent: certificate.isSentToStudent,
        issuedDate: certificate.issuedDate || null,
        generatedBy: certificate.generatedBy ? certificate.generatedBy.name : null,
        comments: certificate.comments || null,
        serialNumber: certificate.serialNumber,
        grNumber: certificate.student?.studentDetails?.grNumber || "N/A",
        parentName: certificate.student?.studentDetails?.parentDetails?.name || "N/A",
        admissionDate: certificate.student?.studentDetails?.admissionDate
          ? new Date(certificate.student.studentDetails.admissionDate).toISOString().split("T")[0]
          : "N/A",
        dob: certificate.student?.studentDetails?.dob
          ? new Date(certificate.student.studentDetails.dob).toISOString().split("T")[0]
          : "N/A",
        className: certificate.student?.studentDetails?.class
          ? `${certificate.student.studentDetails.class.name}${
              certificate.student.studentDetails.class.division
                ? " " + certificate.student.studentDetails.class.division
                : ""
            }`
          : "N/A",
        schoolName: req.school?.name || "N/A",
        schoolAddress: req.school?.address || "N/A",
      },
    });
  } catch (error) {
    console.error("Error in verifyCertificateBySerial:", error);
    res.status(500).json({ error: error.message });
  }
},

  streamCertificate: async (req, res) => {
    try {
      const { certificateId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
      });
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      const key = certificate.documentKey.endsWith(documentKey)
        ? certificate.documentKey
        : certificate.signedDocumentKey;
      if (!key || !key.endsWith(documentKey)) {
        return res.status(404).json({ message: "Document not found" });
      }

      await streamS3Object(key, res);
    } catch (error) {
      console.error("Error streaming certificate:", error);
      res.status(500).json({ error: error.message });
    }
  },

  uploadSignedCertificate: async (req, res) => {
    try {
      const { certificateId } = req.params;
      const file = req.file;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const User = require("../models/User")(connection);

      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return res.status(400).json({ message: "Invalid certificate ID" });
      }

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
      });
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      if (certificate.status !== "generated") {
        return res
          .status(400)
          .json({
            message:
              "Certificate must be generated before uploading a signed version",
          });
      }

      if (!file) {
        return res.status(400).json({ message: "PDF file is required" });
      }

      certificate.signedDocumentUrl = file.location;
      certificate.signedDocumentKey = file.key;
      certificate.isSentToStudent = true;
      await certificate.save();

      const student = await User.findById(certificate.student).select(
        "name email studentDetails"
      );
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const signedDocumentAccessUrl = `/certificates/${certificateId}/${file.key
        .split("/")
        .pop()}`;
      const notificationResult = await sendCertificateNotification(
        student.email,
        student.studentDetails?.mobile,
        student.name,
        certificate.type,
        signedDocumentAccessUrl
      );

      res.json({
        message: "Signed certificate uploaded and sent to student successfully",
        certificate: {
          ...certificate.toObject(),
          signedDocumentAccessUrl,
        },
        notificationStatus: {
          emailSent: notificationResult.emailSent,
          smsSent: notificationResult.smsSent,
        },
      });
    } catch (error) {
      console.error("Error in uploadSignedCertificate:", error);
      res.status(500).json({ error: error.message });
    }
  },

  sendCertificateToStudent: async (req, res) => {
    try {
      const { certificateId } = req.params;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require("../models/Certificate")(connection);
      const User = require("../models/User")(connection);

      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return res.status(400).json({ message: "Invalid certificate ID" });
      }

      const certificate = await Certificate.findOne({
        _id: certificateId,
        school: schoolId,
      });
      if (!certificate) {
        return res.status(404).json({ message: "Certificate not found" });
      }

      if (!certificate.signedDocumentUrl) {
        return res
          .status(400)
          .json({
            message:
              "Signed certificate must be uploaded before sending to student",
          });
      }

      if (certificate.isSentToStudent) {
        return res
          .status(400)
          .json({
            message: "Certificate has already been sent to the student",
          });
      }

      certificate.isSentToStudent = true;
      await certificate.save();

      const student = await User.findById(certificate.student).select(
        "name email studentDetails"
      );
      const signedDocumentAccessUrl = `/certificates/${certificateId}/${certificate.signedDocumentKey
        .split("/")
        .pop()}`;

      const notificationResult = await sendCertificateNotification(
        student.email,
        student.studentDetails.mobile,
        student.name,
        certificate.type,
        signedDocumentAccessUrl
      );

      res.json({
        message: "Certificate sent to student successfully",
        certificate: {
          ...certificate.toObject(),
          signedDocumentAccessUrl,
        },
        notificationStatus: {
          emailSent: notificationResult.emailSent,
          smsSent: notificationResult.smsSent,
        },
      });
    } catch (error) {
      console.error("Error in sendCertificateToStudent:", error);
      res.status(500).json({ error: error.message });
    }
  },

  generateRTEReport: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { startDate, endDate } = req.body;
      const connection = req.connection;
      const User = require("../models/User")(connection);

      const rteStudents = await User.find({
        school: schoolId,
        "studentDetails.isRTE": true,
        "studentDetails.admissionDate": {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }).lean();

      const report = {
        totalRTEStudents: rteStudents.length,
        admissionsByClass: {},
        documentVerificationStatus: { verified: 0, pending: 0 },
      };

      rteStudents.forEach((student) => {
        const classId = student.studentDetails.class.toString();
        report.admissionsByClass[classId] =
          (report.admissionsByClass[classId] || 0) + 1;
        report.documentVerificationStatus[
          student.studentDetails.status === "verified" ? "verified" : "pending"
        ]++;
      });

      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  registerExistingStudent: async (req, res) => {
    try {
      const {
        name,
        email,
        dob,
        gender,
        mobile,
        parentName,
        parentEmail,
        parentMobile,
        parentOccupation,
        address,
        grNumber,
        classId,
        admissionType = "Regular",
        password,
        parentPassword, // New field for parent password
      } = req.body;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);
      const School = require("../models/School")(
        require("../config/database").getOwnerConnection()
      );

      // Validation for required fields
      if (
        !name ||
        !email ||
        !dob ||
        !gender ||
        !mobile ||
        !grNumber ||
        !classId ||
        !password ||
        !parentPassword
      ) {
        return res
          .status(400)
          .json({
            message:
              "All required fields, including student and parent passwords, must be provided",
          });
      }

      // Email validation
      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
      if (!emailRegex.test(email)) {
        return res
          .status(400)
          .json({ message: "Invalid student email format" });
      }
      if (parentEmail && !emailRegex.test(parentEmail)) {
        return res.status(400).json({ message: "Invalid parent email format" });
      }

      // Mobile validation
      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(mobile)) {
        return res
          .status(400)
          .json({ message: "Student mobile number must be 10 digits" });
      }
      if (parentMobile && !mobileRegex.test(parentMobile)) {
        return res
          .status(400)
          .json({ message: "Parent mobile number must be 10 digits" });
      }

      // Check for existing GR number
      const existingGR = await User.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      });
      if (existingGR) {
        return res.status(400).json({ message: "GR number already exists" });
      }

      // Check for existing student email
      const existingStudentEmail = await User.findOne({
        email,
        school: schoolId,
      });
      if (existingStudentEmail) {
        return res
          .status(400)
          .json({ message: "Student email already registered" });
      }

      // Check for existing parent email (optional, depending on your policy)
      if (parentEmail) {
        const existingParentEmail = await User.findOne({
          email: parentEmail,
          school: schoolId,
          role: "parent",
        });
        if (
          existingParentEmail &&
          !existingParentEmail.studentDetails.children.length
        ) {
          return res
            .status(400)
            .json({
              message:
                "Parent email already registered with no linked students",
            });
        }
      }

      // Validate class
      const selectedClass = await Class.findOne({
        _id: classId,
        school: schoolId,
      });
      if (!selectedClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      if (selectedClass.students.length >= selectedClass.capacity) {
        return res.status(400).json({ message: "Class is at full capacity" });
      }

      // Validate school
      const school = await School.findById(schoolId).select("name");
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      // Hash passwords
      const hashedStudentPassword = await bcrypt.hash(password, 10);
      const hashedParentPassword = await bcrypt.hash(parentPassword, 10);

      // Create Student User
      const student = new User({
        school: schoolId,
        name,
        email,
        password: hashedStudentPassword,
        role: "student",
        status: "active",
        studentDetails: {
          grNumber,
          class: classId,
          admissionType,
          mobile,
          parentDetails: {
            name: parentName,
            email: parentEmail,
            mobile: parentMobile,
            occupation: parentOccupation,
            address: address || {},
          },
          dob: new Date(dob),
          gender,
        },
      });

      await student.save();

      // Check if parent already exists by email, otherwise create new parent
      let parent = parentEmail
        ? await User.findOne({
            email: parentEmail,
            role: "parent",
            school: schoolId,
          })
        : null;
      if (parent) {
        // If parent exists, link the new student
        if (!parent.studentDetails) parent.studentDetails = {};
        if (!parent.studentDetails.children)
          parent.studentDetails.children = [];
        parent.studentDetails.children.push(student._id);
        await parent.save();
      } else {
        // Create new Parent User
        parent = new User({
          school: schoolId,
          name: parentName,
          email:
            parentEmail ||
            `${grNumber}_parent@${school.name
              .toLowerCase()
              .replace(/\s+/g, "")}.com`, // Fallback email if not provided
          password: hashedParentPassword,
          role: "parent",
          status: "active",
          profile: {
            phone: parentMobile,
            address: address?.street || "", // Adjust based on your address structure
          },
          studentDetails: {
            children: [student._id],
          },
        });
        await parent.save();
      }

      // Link student to parent
      student.studentDetails.parent = parent._id;
      await student.save();

      // Update class with student
      await Class.findByIdAndUpdate(classId, {
        $push: { students: student._id },
      });

      const className = `${selectedClass.name}${
        selectedClass.division ? " " + selectedClass.division : ""
      }`;

      // Send notification to student
      const studentNotification = await sendAdmissionNotification(
        student.email,
        mobile,
        student.name,
        password,
        school.name,
        className,
        grNumber
      );

      // Send notification to parent
      const parentNotification = await sendAdmissionNotification(
        parent.email,
        parentMobile,
        parent.name,
        parentPassword,
        school.name,
        className,
        grNumber,
        "Parent Account Creation"
      );

      // Response
      res.status(201).json({
        message: "Existing student and parent registered successfully",
        studentDetails: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber,
          class: { name: selectedClass.name, division: selectedClass.division },
        },
        parentDetails: {
          id: parent._id,
          name: parent.name,
          email: parent.email,
        },
        notificationStatus: {
          student: {
            emailSent: studentNotification.emailSent,
            smsSent: studentNotification.smsSent,
          },
          parent: {
            emailSent: parentNotification.emailSent,
            smsSent: parentNotification.smsSent,
          },
        },
      });
    } catch (error) {
      console.error("Error registering existing student:", error);
      res.status(500).json({ error: error.message });
    }
  },

  // Add this to clerkController object
  upgradeStudentClass: async (req, res) => {
    try {
      const { studentId, newClassId } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require("../models/User")(connection);
      const Class = require("../models/Class")(connection);

      // Validate input
      if (
        !mongoose.Types.ObjectId.isValid(studentId) ||
        !mongoose.Types.ObjectId.isValid(newClassId)
      ) {
        return res.status(400).json({ message: "Invalid student or class ID" });
      }

      // Find the student
      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
        role: "student",
      });

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Find current class and new class
      const currentClass = await Class.findOne({
        _id: student.studentDetails.class,
        school: schoolId,
      });

      const newClass = await Class.findOne({
        _id: newClassId,
        school: schoolId,
      });

      if (!newClass) {
        return res.status(404).json({ message: "New class not found" });
      }

      // Check class capacity
      if (newClass.students.length >= newClass.capacity) {
        return res
          .status(400)
          .json({ message: "New class is at full capacity" });
      }

      // Extract class numbers from names (e.g., "Class 1" -> 1, "Class 2" -> 2)
      const getClassNumber = (className) => {
        if (!className) return 0;
        const match = className.match(/\d+/); // Extract first number from string
        return match ? parseInt(match[0]) : 0;
      };

      const currentClassNum = getClassNumber(currentClass?.name);
      const newClassNum = getClassNumber(newClass.name);

      // Check if it's a logical upgrade
      if (newClassNum <= currentClassNum) {
        return res.status(400).json({
          message: "New class must be higher than current class",
        });
      }

      // Update student class
      student.studentDetails.class = newClassId;
      student.studentDetails.admissionDate = new Date(); // Update admission date to new class
      await student.save();

      // Update class records
      if (currentClass) {
        await Class.findByIdAndUpdate(currentClass._id, {
          $pull: { students: student._id },
        });
      }

      await Class.findByIdAndUpdate(newClassId, {
        $push: { students: student._id },
      });

      // Send notification
      const notificationResult = await sendAdmissionNotification(
        student.email,
        student.studentDetails?.mobile || "",
        student.name,
        null, // No password change
        req.school.name,
        `${newClass.name}${newClass.division ? " " + newClass.division : ""}`,
        student.studentDetails.grNumber,
        "Class Upgrade Notification"
      );

      res.json({
        message: "Student class upgraded successfully",
        student: {
          id: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          previousClass: currentClass
            ? `${currentClass.name}${
                currentClass.division ? " " + currentClass.division : ""
              }`
            : "N/A",
          newClass: `${newClass.name}${
            newClass.division ? " " + newClass.division : ""
          }`,
        },
        notificationStatus: {
          emailSent: notificationResult.emailSent,
          smsSent: notificationResult.smsSent,
        },
      });
    } catch (error) {
      console.error("Error in upgradeStudentClass:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

const sendCertificateNotification = async (
  email,
  mobile,
  studentName,
  certificateType,
  documentUrl
) => {
  return {
    emailSent: true,
    smsSent: true,
    error: null,
  };
};

const sendAdmissionNotification1 = async (
  email,
  mobile,
  studentName,
  password,
  schoolName,
  className,
  grNumber = null,
  notificationType = "Admission"
) => {
  let message = "";
  if (notificationType === "Class Upgrade Notification") {
    message = `Dear ${studentName}, your class has been upgraded to ${className} at ${schoolName}. Your GR Number remains ${grNumber}.`;
  } else {
    message = `Dear ${studentName}, your admission to ${schoolName} in class ${className} is confirmed. Your credentials - Email: ${email}, Password: ${password}${
      grNumber ? ", GR Number: " + grNumber : ""
    }`;
  }

  return {
    emailSent: true,
    smsSent: true,
    error: null,
    message, // Optional: for debugging
  };
};

module.exports = { clerkController, upload, sendAdmissionNotification };
