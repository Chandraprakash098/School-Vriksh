const User = require('../models/User');
const Fee = require('../models/Fee');
// const Document = require('../models/Document');
const mongoose = require('mongoose');
// const { generateGRNumber, validateRTEDocuments } = require('../utils/admissionHelpers');
// const { generateCertificate } = require('../utils/certificateGenerator');

const clerkController = {
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
        admissionType
      } = req.body;

      // Start transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Verify RTE documents if applicable
        if (isRTE) {
          const isEligible = await validateRTEDocuments(documents);
          if (!isEligible) {
            throw new Error('RTE eligibility criteria not met');
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
          role: 'parent',
          profile: parentDetails.profile
        });
        await parent.save({ session });

        // Create student account
        const student = new User({
          school: schoolId,
          name: studentDetails.name,
          email: studentDetails.email,
          password: studentDetails.password, // Should be hashed
          role: 'student',
          grNumber,
          profile: {
            ...studentDetails.profile,
            isRTE,
            documents,
            parentId: parent._id,
            class: classId,
            admissionDate: new Date(),
            admissionType,
            status: 'pending' // pending, verified, confirmed
          }
        });
        await student.save({ session });

        // Store documents
        const documentPromises = documents.map(doc => {
          const document = new Document({
            school: schoolId,
            student: student._id,
            type: doc.type,
            url: doc.url,
            verified: false
          });
          return document.save({ session });
        });
        await Promise.all(documentPromises);

        // If not RTE, create fee records
        if (!isRTE) {
          const feeTypes = ['admission', 'tuition', 'computer', 'examination'];
          const feePromises = feeTypes.map(type => {
            const fee = new Fee({
              school: schoolId,
              student: student._id,
              type,
              amount: getFeeAmount(type, classId), // Helper function
              dueDate: getFeeDueDate(type), // Helper function
              status: 'pending',
              isRTE: false
            });
            return fee.save({ session });
          });
          await Promise.all(feePromises);
        }

        await session.commitTransaction();
        res.status(201).json({
          message: 'Admission processed successfully',
          student,
          parent
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
        return res.status(404).json({ message: 'Student not found' });
      }

      // Update document verification status
      await Document.updateMany(
        { student: studentId, _id: { $in: verifiedDocuments } },
        { verified: true }
      );

      // Update student status
      student.profile.status = 'verified';
      await student.save();

      res.json({ message: 'Documents verified successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Confirm admission
  confirmAdmission: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { classSection } = req.body;

      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Check if documents are verified
      const documents = await Document.find({ student: studentId });
      const allVerified = documents.every(doc => doc.verified);
      if (!allVerified) {
        return res.status(400).json({ message: 'All documents must be verified first' });
      }

      // Check if fees are paid (for non-RTE)
      if (!student.profile.isRTE) {
        const pendingFees = await Fee.findOne({
          student: studentId,
          status: 'pending'
        });
        if (pendingFees) {
          return res.status(400).json({ message: 'All fees must be paid first' });
        }
      }

      // Update student status and class section
      student.profile.status = 'confirmed';
      student.profile.classSection = classSection;
      await student.save();

      // Send notification to parent
      // TODO: Implement notification service

      res.json({ message: 'Admission confirmed successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Generate certificates
  generateCertificate: async (req, res) => {
    try {
      const { studentId } = req.params;
      const { certificateType } = req.body;

      const student = await User.findById(studentId)
        .populate('profile.class')
        .populate('profile.parentId')
        .lean();

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Validate certificate eligibility
      if (certificateType === 'leaving' || certificateType === 'transfer') {
        const hasPendingFees = await Fee.findOne({
          student: studentId,
          status: 'pending'
        });
        if (hasPendingFees) {
          return res.status(400).json({ message: 'Clear all pending fees first' });
        }
      }

      // Generate certificate based on type
      const certificate = await generateCertificate(
        student,
        certificateType
      );

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
      const { schoolId } = req.params;
      const { startDate, endDate } = req.body;

      const rteStudents = await User.find({
        school: schoolId,
        'profile.isRTE': true,
        'profile.admissionDate': {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }).lean();

      const report = {
        totalRTEStudents: rteStudents.length,
        admissionsByClass: {},
        documentVerificationStatus: {
          verified: 0,
          pending: 0
        }
      };

      // Generate detailed report statistics
      // TODO: Implement detailed reporting logic

      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = clerkController;