


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clerkController = {
  
  // getPendingVerifications: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const AdmissionApplication = require('../models/AdmissionApplication')(connection);

  //     const applications = await AdmissionApplication.find({
  //       school: schoolId,
  //       status: { $in: ['pending', 'document_verification'] },
  //       'clerkVerification.status': 'pending',
  //     })
  //      // Optional: if you need school details
  //     .sort({ createdAt: -1 });

  //     res.json({
  //       status: 'success',
  //       count: applications.length,
  //       applications: applications.map((app) => ({
  //         id: app._id,
  //         trackingId: app.trackingId,
          
  //         // Student Details
  //         studentDetails: {
  //           name: app.studentDetails.name,
  //           dob: app.studentDetails.dob,
  //           gender: app.studentDetails.gender,
  //           email: app.studentDetails.email,
  //           mobile: app.studentDetails.mobile,
  //           appliedClass: app.studentDetails.appliedClass
  //         },
          
  //         // Parent Details
  //         parentDetails: {
  //           name: app.parentDetails.name,
  //           email: app.parentDetails.email,
  //           mobile: app.parentDetails.mobile,
  //           occupation: app.parentDetails.occupation,
  //           address: {
  //             street: app.parentDetails.address.street,
  //             city: app.parentDetails.address.city,
  //             state: app.parentDetails.address.state,
  //             pincode: app.parentDetails.address.pincode
  //           }
  //         },
          
  //         // Admission Details
  //         admissionType: app.admissionType,
  //         status: app.status,
  //         submittedOn: app.createdAt,
          
  //         // Documents
  //         documents: app.documents.map(doc => ({
  //           type: doc.type,
  //           documentUrl: doc.documentUrl,
  //           public_id: doc.public_id,
  //           verified: doc.verified
  //         })),
          
  //         // Additional Responses (if any)
  //         additionalResponses: app.additionalResponses ? Object.fromEntries(app.additionalResponses) : {},
          
  //         // Verification Status
  //         clerkVerification: {
  //           status: app.clerkVerification.status,
  //           comments: app.clerkVerification.comments
  //         }
  //       })),
  //     });
  //   } catch (error) {
  //     res.status(500).json({ 
  //       status: 'error',
  //       error: error.message 
  //     });
  //   }
  // },

  getPendingVerifications: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      const applications = await AdmissionApplication.find({
        school: schoolId,
        $or: [
          // Pending document verification by clerk
          {
            status: { $in: ['pending', 'document_verification'] },
            'clerkVerification.status': 'pending',
          },
          // Approved by fees manager, awaiting clerk's final enrollment
          {
            status: 'approved',
            'feesVerification.status': 'verified',
            'clerkVerification.status': 'verified', // Ensure clerk has already verified documents
          },
        ],
      }).sort({ createdAt: -1 });

      res.json({
        status: 'success',
        count: applications.length,
        applications: applications.map((app) => ({
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
          documents: app.documents.map(doc => ({
            type: doc.type,
            documentUrl: doc.documentUrl,
            public_id: doc.public_id,
            verified: doc.verified,
          })),
          additionalResponses: app.additionalResponses ? Object.fromEntries(app.additionalResponses) : {},
          clerkVerification: {
            status: app.clerkVerification.status,
            comments: app.clerkVerification.comments,
          },
          feesVerification: {
            status: app.feesVerification.status,
            receiptNumber: app.feesVerification.receiptNumber,
            verifiedAt: app.feesVerification.verifiedAt,
          }, // Include fees verification details
        })),
      });
    } catch (error) {
      res.status(500).json({ 
        status: 'error',
        error: error.message 
      });
    }
  },

  clerkVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, comments } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Verify all required documents are present (implement validateDocuments if needed)
      const hasAllDocuments = application.documents.length > 0; // Placeholder; replace with actual logic
      if (!hasAllDocuments) {
        return res.status(400).json({ message: 'Missing required documents' });
      }

      application.clerkVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        comments,
      };

      if (status === 'verified') {
        application.status = application.admissionType === 'RTE' ? 'approved' : 'fees_pending';
      } else {
        application.status = 'rejected';
      }

      await application.save();

      res.json({
        message: 'Verification completed',
        nextStep: status === 'verified'
          ? application.admissionType === 'RTE'
            ? 'Admission approved'
            : 'Visit fees department'
          : 'Application rejected',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // processAdmission: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString(); // Use req.school instead of req.params
  //     const { studentDetails, isRTE, classId, documents, parentDetails, admissionType } = req.body;
  //     const connection = req.connection;
  //     const User = require('../models/User')(connection);
  //     const Class = require('../models/Class')(connection);
  //     const Fee = require('../models/Fee')(connection);

  //     const session = await mongoose.startSession();
  //     session.startTransaction();

  //     try {
  //       // Verify RTE documents if applicable (implement validateRTEDocuments if needed)
  //       if (isRTE) {
  //         const isEligible = true; // Placeholder; replace with actual logic
  //         if (!isEligible) {
  //           throw new Error('RTE eligibility criteria not met');
  //         }
  //       }

  //       // Generate unique GR number (implement generateGRNumber if needed)
  //       const grNumber = `GR${Date.now()}`; // Placeholder

  //       // Hash passwords
  //       const parentPassword = await bcrypt.hash(parentDetails.password || 'default123', 10);
  //       const studentPassword = await bcrypt.hash(studentDetails.password || 'default123', 10);

  //       // Create parent account
  //       const parent = new User({
  //         school: schoolId,
  //         name: parentDetails.name,
  //         email: parentDetails.email,
  //         password: parentPassword,
  //         role: 'parent',
  //         profile: parentDetails.profile,
  //       });
  //       await parent.save({ session });

  //       // Create student account
  //       const student = new User({
  //         school: schoolId,
  //         name: studentDetails.name,
  //         email: studentDetails.email,
  //         password: studentPassword,
  //         role: 'student',
  //         studentDetails: {
  //           grNumber,
  //           class: classId,
  //           admissionType,
  //           parentDetails: { parentId: parent._id }, // Adjust to store parent ID if separate User
  //           dob: studentDetails.dob,
  //           gender: studentDetails.gender,
  //         },
  //       });
  //       await student.save({ session });

  //       // If not RTE, create fee records
  //       if (!isRTE) {
  //         const feeTypes = ['admission', 'tuition', 'computer', 'examination'];
  //         const feePromises = feeTypes.map((type) => {
  //           const fee = new Fee({
  //             school: schoolId,
  //             student: student._id,
  //             type,
  //             amount: getFeeAmount(type, classId), // Placeholder; implement as needed
  //             dueDate: getFeeDueDate(type), // Placeholder; implement as needed
  //             status: 'pending',
  //             isRTE: false,
  //           });
  //           return fee.save({ session });
  //         });
  //         await Promise.all(feePromises);
  //       }

  //       await session.commitTransaction();
  //       res.status(201).json({
  //         message: 'Admission processed successfully',
  //         student,
  //         parent,
  //       });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  verifyDocuments: async (req, res) => {
    try {
      const { studentId } = req.params; // Changed from req.school to req.params
      const { verifiedDocuments } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      // const Document = require('../models/Document')(connection); // Uncomment if Document model exists

      const student = await User.findOne({ _id: studentId, school: schoolId });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      // Placeholder: Assuming documents are part of studentDetails or a separate model
      // Update document verification status (implement if Document model exists)
      // await Document.updateMany({ student: studentId, _id: { $in: verifiedDocuments } }, { verified: true });

      // Update student status
      student.studentDetails.status = 'verified'; // Adjusted to studentDetails
      await student.save();

      res.json({ message: 'Documents verified successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // getAvailableClasses: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Class = require('../models/Class')(connection);
  //     const User = require('../models/User')(connection);

  //     const availableClasses = await Class.find({
  //       school: schoolId,
  //       $or: [
  //         { classTeacher: null },
  //         { classTeacher: { $exists: false } },
  //       ],
  //     })
  //       .select('name division academicYear')
  //       .sort({ name: 1, division: 1 });

  //     const assignedClasses = await Class.find({
  //       school: schoolId,
  //       classTeacher: { $exists: true, $ne: null },
  //     })
  //       .select('name division academicYear classTeacher')
  //       .populate('classTeacher', 'name', User)
  //       .sort({ name: 1, division: 1 });

  //     res.json({
  //       available: availableClasses,
  //       assigned: assignedClasses,
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  getAvailableClasses: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
  
      // Classes with available capacity (students < capacity)
      const availableClasses = await Class.find({
        school: schoolId,
        $expr: { $lt: [{ $size: "$students" }, "$capacity"] }, // Compare students array size to capacity
      })
        .select('name division academicYear capacity')
        .sort({ name: 1, division: 1 });
  
      // Classes with teachers assigned (regardless of capacity)
      const assignedClasses = await Class.find({
        school: schoolId,
        classTeacher: { $exists: true, $ne: null },
      })
        .select('name division academicYear classTeacher')
        .populate('classTeacher', 'name', User)
        .sort({ name: 1, division: 1 });
  
      res.json({
        available: availableClasses.map(cls => ({
          _id: cls._id,
          name: cls.name,
          division: cls.division,
          academicYear: cls.academicYear,
          remainingCapacity: cls.capacity - (cls.students ? cls.students.length : 0),
        })),
        assigned: assignedClasses,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  enrollStudent: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { classId, grNumber, password } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      if (application.status !== 'approved') {
        return res.status(400).json({ message: 'Only approved applications can be enrolled' });
      }

      const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
      if (existingGR) {
        return res.status(400).json({ message: 'GR number already exists' });
      }

      const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
      if (!selectedClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

      if (selectedClass.students.length >= selectedClass.capacity) {
        return res.status(400).json({ message: 'Class is at full capacity' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const student = new User({
        school: schoolId,
        name: application.studentDetails.name,
        email: application.studentDetails.email,
        password: hashedPassword,
        role: 'student',
        status: 'active',
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

      await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

      application.status = 'enrolled';
      application.grNumber = grNumber;
      application.assignedClass = classId;
      await application.save();

      res.json({
        message: 'Student enrolled successfully',
        studentDetails: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber,
          class: { name: selectedClass.name, division: selectedClass.division },
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getStudentsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      // Validate classId
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      // Check if class exists
      const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
      if (!selectedClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

      // Fetch students enrolled in this class
      const students = await User.find({
        school: schoolId,
        'studentDetails.class': classId,
        role: 'student',
      })
        .select('name email studentDetails')
        .lean();

      res.json({
        status: 'success',
        class: {
          name: selectedClass.name,
          division: selectedClass.division,
          academicYear: selectedClass.academicYear,
          capacity: selectedClass.capacity,
          enrolledCount: selectedClass.students.length,
        },
        count: students.length,
        students: students.map(student => ({
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber: student.studentDetails.grNumber,
          admissionType: student.studentDetails.admissionType,
          dob: student.studentDetails.dob,
          gender: student.studentDetails.gender,
          parentDetails: student.studentDetails.parentDetails,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // confirmAdmission: async (req, res) => {
  //   try {
  //     const { studentId } = req.params; // Changed from req.school to req.params
  //     const { classSection } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const User = require('../models/User')(connection);
  //     const Fee = require('../models/Fee')(connection);

  //     const student = await User.findOne({ _id: studentId, school: schoolId });
  //     if (!student) {
  //       return res.status(404).json({ message: 'Student not found' });
  //     }

  //     // Placeholder: Check document verification (implement if Document model exists)
  //     const allVerified = true; // Adjust with actual logic
  //     if (!allVerified) {
  //       return res.status(400).json({ message: 'All documents must be verified first' });
  //     }

  //     if (!student.studentDetails.isRTE) { // Adjusted to studentDetails.isRTE
  //       const pendingFees = await Fee.findOne({ student: studentId, status: 'pending', school: schoolId });
  //       if (pendingFees) {
  //         return res.status(400).json({ message: 'All fees must be paid first' });
  //       }
  //     }

  //     student.studentDetails.status = 'confirmed';
  //     student.studentDetails.classSection = classSection;
  //     await student.save();

  //     // Notify parent (implement if needed)
  //     // await notifyParent(student);

  //     res.json({ message: 'Admission confirmed successfully' });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  generateCertificate: async (req, res) => {
    try {
      const { studentId } = req.params; // Changed from req.school to req.params
      const { certificateType } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Fee = require('../models/Fee')(connection);
      const Class = require('../models/Class')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId })
        .populate('studentDetails.class', '', Class)
        .lean();

      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      if (certificateType === 'leaving' || certificateType === 'transfer') {
        const hasPendingFees = await Fee.findOne({ student: studentId, status: 'pending', school: schoolId });
        if (hasPendingFees) {
          return res.status(400).json({ message: 'Clear all pending fees first' });
        }
      }

      // Generate certificate (implement generateCertificate if needed)
      const certificate = { type: certificateType, student }; // Placeholder

      res.json({ certificate });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  generateRTEReport: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { startDate, endDate } = req.body;
      const connection = req.connection;
      const User = require('../models/User')(connection);

      const rteStudents = await User.find({
        school: schoolId,
        'studentDetails.isRTE': true, // Adjusted to studentDetails
        'studentDetails.admissionDate': {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      }).lean();

      const report = {
        totalRTEStudents: rteStudents.length,
        admissionsByClass: {},
        documentVerificationStatus: { verified: 0, pending: 0 },
      };

      // Placeholder: Implement detailed reporting logic
      rteStudents.forEach(student => {
        const classId = student.studentDetails.class.toString();
        report.admissionsByClass[classId] = (report.admissionsByClass[classId] || 0) + 1;
        report.documentVerificationStatus[student.studentDetails.status === 'verified' ? 'verified' : 'pending']++;
      });

      res.json({ report });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

// Placeholder helper functions (implement as needed)
const getFeeAmount = (type, classId) => 1000; // Placeholder
const getFeeDueDate = (type) => new Date(); // Placeholder

module.exports = clerkController;
