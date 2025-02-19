const User = require("../models/User");
const Fee = require("../models/Fee");
// const Document = require('../models/Document');
const mongoose = require("mongoose");
// const { generateGRNumber, validateRTEDocuments } = require('../utils/admissionHelpers');
// const { generateCertificate } = require('../utils/certificateGenerator');

const clerkController = {
  // Get pending verification applications for clerks
  getPendingVerifications: async (req, res) => {
    try {
      const applications = await AdmissionApplication.find({
        status: { $in: ["pending", "document_verification"] },
        "clerkVerification.status": "pending",
      }).sort({ createdAt: -1 });

      res.json({
        status: "success",
        count: applications.length,
        applications: applications.map((app) => ({
          id: app._id,
          trackingId: app.trackingId,
          studentName: app.studentDetails.name,
          admissionType: app.admissionType,
          appliedClass: app.studentDetails.appliedClass,
          status: app.status,
          submittedOn: app.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  clerkVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, comments } = req.body;

      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Verify all required documents are present and authentic
      const hasAllDocuments = application.validateDocuments();
      if (!hasAllDocuments) {
        return res.status(400).json({
          message: "Missing required documents",
        });
      }

      application.clerkVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        comments,
      };

      if (status === "verified") {
        application.status =
          application.admissionType === "RTE" ? "approved" : "fees_pending";
      } else {
        application.status = "rejected";
      }

      await application.save();

      res.json({
        message: "Verification completed",
        nextStep:
          status === "verified"
            ? application.admissionType === "RTE"
              ? "Admission approved"
              : "Visit fees department"
            : "Application rejected",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // Process new admission
  processAdmission: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const {
        studentDetails,
        isRTE,
        classId,
        documents,
        parentDetails,
        admissionType,
      } = req.body;

      // Start transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verify RTE documents if applicable
        if (isRTE) {
          const isEligible = await validateRTEDocuments(documents);
          if (!isEligible) {
            throw new Error("RTE eligibility criteria not met");
          }
        }

        // Generate unique GR number
        const grNumber = await generateGRNumber(schoolId);

        // Create parent account
        const parent = new User({
          school: schoolId,
          name: parentDetails.name,
          email: parentDetails.email,
          password: parentDetails.password, // Should be hashed
          role: "parent",
          profile: parentDetails.profile,
        });
        await parent.save({ session });

        // Create student account
        const student = new User({
          school: schoolId,
          name: studentDetails.name,
          email: studentDetails.email,
          password: studentDetails.password, // Should be hashed
          role: "student",
          grNumber,
          profile: {
            ...studentDetails.profile,
            isRTE,
            documents,
            parentId: parent._id,
            class: classId,
            admissionDate: new Date(),
            admissionType,
            status: "pending", // pending, verified, confirmed
          },
        });
        await student.save({ session });

        // Store documents
        const documentPromises = documents.map((doc) => {
          const document = new Document({
            school: schoolId,
            student: student._id,
            type: doc.type,
            url: doc.url,
            verified: false,
          });
          return document.save({ session });
        });
        await Promise.all(documentPromises);

        // If not RTE, create fee records
        if (!isRTE) {
          const feeTypes = ["admission", "tuition", "computer", "examination"];
          const feePromises = feeTypes.map((type) => {
            const fee = new Fee({
              school: schoolId,
              student: student._id,
              type,
              amount: getFeeAmount(type, classId), // Helper function
              dueDate: getFeeDueDate(type), // Helper function
              status: "pending",
              isRTE: false,
            });
            return fee.save({ session });
          });
          await Promise.all(feePromises);
        }

        await session.commitTransaction();
        res.status(201).json({
          message: "Admission processed successfully",
          student,
          parent,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Verify physical documents
  verifyDocuments: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { verifiedDocuments } = req.body;

      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Update document verification status
      await Document.updateMany(
        { student: studentId, _id: { $in: verifiedDocuments } },
        { verified: true }
      );

      // Update student status
      student.profile.status = "verified";
      await student.save();

      res.json({ message: "Documents verified successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

    getAvailableClasses: async (req, res) => {
    try {
      const { schoolId } = req.school;
      const { appliedClass } = req.query;
      
      const classes = await Class.find({
        school: schoolId,
        name: appliedClass,
        $expr: {
          $lt: [{ $size: "$students" }, "$capacity"] // Check if class has capacity
        }
      })
      .select('name division capacity students')
      .populate('classTeacher', 'name');
      
      res.json({
        status: 'success',
        classes: classes.map(cls => ({
          id: cls._id,
          name: cls.name,
          division: cls.division,
          availableSeats: cls.capacity - cls.students.length,
          totalSeats: cls.capacity,
          classTeacher: cls.classTeacher?.name
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  enrollStudent: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { classId, grNumber } = req.body;

      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      if (application.status !== "approved") {
        return res.status(400).json({
          message: "Only approved applications can be enrolled",
        });
      }

      // Validate if GR number is unique
      const existingGR = await User.findOne({
        "studentDetails.grNumber": grNumber,
      });
      if (existingGR) {
        return res.status(400).json({
          message: "GR number already exists",
        });
      }

      // Get selected class
      const selectedClass = await Class.findById(classId);
      if (!selectedClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Check class capacity
      if (selectedClass.students.length >= selectedClass.capacity) {
        return res.status(400).json({
          message: "Class is at full capacity",
        });
      }

      // Create student user account
      const student = new User({
        school: application.school,
        name: application.studentDetails.name,
        email: application.studentDetails.email,
        password: Math.random().toString(36).slice(-8), // Generate temporary password
        role: "student",
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

      // Update class with new student
      await Class.findByIdAndUpdate(classId, {
        $push: { students: student._id },
      });

      // Update application status
      application.status = "enrolled";
      application.grNumber = grNumber;
      application.assignedClass = classId;
      await application.save();

      res.json({
        message: "Student enrolled successfully",
        studentDetails: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber,
          class: {
            name: selectedClass.name,
            division: selectedClass.division,
          },
          temporaryPassword: student.password,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Confirm admission
  confirmAdmission: async (req, res) => {
    try {
      const { studentId } = req.school;
      const { classSection } = req.body;

      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Check if documents are verified
      const documents = await Document.find({ student: studentId });
      const allVerified = documents.every((doc) => doc.verified);
      if (!allVerified) {
        return res
          .status(400)
          .json({ message: "All documents must be verified first" });
      }

      // Check if fees are paid (for non-RTE)
      if (!student.profile.isRTE) {
        const pendingFees = await Fee.findOne({
          student: studentId,
          status: "pending",
        });
        if (pendingFees) {
          return res
            .status(400)
            .json({ message: "All fees must be paid first" });
        }
      }

      // Update student status and class section
      student.profile.status = "confirmed";
      student.profile.classSection = classSection;
      await student.save();

      // Send notification to parent
      // TODO: Implement notification service

      res.json({ message: "Admission confirmed successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Generate certificates
  generateCertificate: async (req, res) => {
    try {
      const { studentId } = req.school;
      const { certificateType } = req.body;

      const student = await User.findById(studentId)
        .populate("profile.class")
        .populate("profile.parentId")
        .lean();

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Validate certificate eligibility
      if (certificateType === "leaving" || certificateType === "transfer") {
        const hasPendingFees = await Fee.findOne({
          student: studentId,
          status: "pending",
        });
        if (hasPendingFees) {
          return res
            .status(400)
            .json({ message: "Clear all pending fees first" });
        }
      }

      // Generate certificate based on type
      const certificate = await generateCertificate(student, certificateType);

      // Store certificate record
      // TODO: Implement certificate storage

      res.json({ certificate });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Generate RTE compliance report
  generateRTEReport: async (req, res) => {
    try {
      const { schoolId } = req.school;
      const { startDate, endDate } = req.body;

      const rteStudents = await User.find({
        school: schoolId,
        "profile.isRTE": true,
        "profile.admissionDate": {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }).lean();

      const report = {
        totalRTEStudents: rteStudents.length,
        admissionsByClass: {},
        documentVerificationStatus: {
          verified: 0,
          pending: 0,
        },
      };

      // Generate detailed report statistics
      // TODO: Implement detailed reporting logic

      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = clerkController;
