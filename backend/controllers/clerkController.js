


const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { sendAdmissionNotification } = require('../utils/notifications');
const PDFDocument = require('pdfkit');
const { uploadCertificateToCloudinary } = require('../config/cloudinary');

const clerkController = {
  
  
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
      // const hasAllDocuments = application.documents.length > 0;
      const hasAllDocuments = application.validateDocuments();
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
        // application.status = application.admissionType === 'RTE' ? 'approved' : 'fees_pending';
        application.status = 'fees_pending';
      } else {
        application.status = 'rejected';
      }

      await application.save();

      // res.json({
      //   message: 'Verification completed',
      //   nextStep: status === 'verified'
      //     ? application.admissionType === 'RTE'
      //       ? 'Admission approved'
      //       : 'Visit fees department'
      //     : 'Application rejected',
      // });
      res.json({
        message: 'Verification completed',
        nextStep: status === 'verified' ? 'Visit fees department for verification' : 'Application rejected',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  

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

  
  viewApplicationDocuments: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      // Validate applicationId
      if (!mongoose.Types.ObjectId.isValid(applicationId)) {
        return res.status(400).json({ message: 'Invalid application ID' });
      }

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });

      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      // Check if the user has permission (clerk role is already enforced by middleware)
      if (req.user.role !== 'clerk') {
        return res.status(403).json({ message: 'Unauthorized access' });
      }

      // Prepare document data for response
      const documents = application.documents.map(doc => ({
        type: doc.type,
        documentUrl: doc.documentUrl, // URL to view the document
        public_id: doc.public_id,    // Cloudinary public ID
        verified: doc.verified,      // Verification status
        uploadedAt: application.createdAt, // Assuming uploaded at the time of application creation
      }));

      res.json({
        status: 'success',
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



  getAvailableClasses: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
  
      const allClasses = await Class.find({ school: schoolId })
        .select('name division academicYear capacity students classTeacher')
        .populate('classTeacher', 'name', User)
        .sort({ name: 1, division: 1 });
  
      res.json({
        classes: allClasses.map(cls => ({
          _id: cls._id,
          name: cls.name,
          division: cls.division,
          academicYear: cls.academicYear,
          teacher: cls.classTeacher ? cls.classTeacher.name : null,
          enrolledCount: cls.students ? cls.students.length : 0,
          capacity: cls.capacity,
          remainingCapacity: cls.capacity - (cls.students ? cls.students.length : 0),
        })),
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
      const School = require('../models/School')(require('../config/database').getOwnerConnection()); // Access School model from owner DB

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

      // Fetch school name from the School model
      const school = await School.findById(schoolId).select('name');
      if (!school) {
        return res.status(404).json({ message: 'School not found' });
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

      // Prepare class name (e.g., "5th A" using name and division)
      const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

      // Send notification with school name and class
      const notificationResult = await sendAdmissionNotification(
        student.email,
        application.studentDetails.mobile,
        student.name,
        password,
        school.name, // School name
        className    // Class name
      );

      if (!notificationResult.emailSent || !notificationResult.smsSent) {
        console.warn('Notification partially failed:', notificationResult.error);
        // Optionally rollback if notifications are critical (see previous example)
      }

      res.json({
        message: 'Student enrolled successfully',
        studentDetails: {
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber,
          class: { name: selectedClass.name, division: selectedClass.division },
        },
        notificationStatus: {
          emailSent: notificationResult.emailSent,
          smsSent: notificationResult.smsSent,
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

  requestLeave: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { reason, startDate, endDate, type } = req.body;
      const clerkId = req.user._id;
      const connection = req.connection;
      const Leave = require('../models/Leave')(connection);

      const leave = new Leave({
        school: schoolId,
        user: clerkId,
        reason,
        startDate,
        endDate,
        type,
        status: 'pending',
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
      const Leave = require('../models/Leave')(connection);

      const leaves = await Leave.find({ school: schoolId, user: clerkId })
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: 'success',
        count: leaves.length,
        leaves: leaves.map(leave => ({
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

  // getPendingCertificates: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require('../models/Certificate')(connection);
  //     const User = require('../models/User')(connection);

  //     const certificates = await Certificate.find({
  //       school: schoolId,
  //       status: 'pending',
  //     })
  //       .populate('student', 'name email studentDetails', User)
  //       .sort({ requestDate: -1 });

  //     res.json({
  //       status: 'success',
  //       count: certificates.length,
  //       certificates: certificates.map(cert => ({
  //         id: cert._id,
  //         studentName: cert.student.name,
  //         studentEmail: cert.student.email,
  //         type: cert.type,
  //         purpose: cert.purpose,
  //         urgency: cert.urgency,
  //         requestDate: cert.requestDate,
  //         status: cert.status,
  //       })),
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },




  // generateCertificate: async (req, res) => {
  //   try {
  //     const { certificateId } = req.params;
  //     const { status, comments } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require('../models/Certificate')(connection);
  //     const User = require('../models/User')(connection);
  //     const School = require('../models/School')(require('../config/database').getOwnerConnection());

  //     const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
  //     if (!certificate) {
  //       return res.status(404).json({ message: 'Certificate request not found' });
  //     }

  //     if (status === 'rejected') {
  //       certificate.status = 'rejected';
  //       certificate.comments = comments;
  //       await certificate.save();
  //       return res.json({ message: 'Certificate request rejected', certificate });
  //     }

  //     if (status !== 'generated') {
  //       return res.status(400).json({ message: 'Invalid status for generation' });
  //     }

  //     // Fetch student and school details
  //     const student = await User.findById(certificate.student).select('name email studentDetails');
  //     const school = await School.findById(schoolId).select('name address');

  //     if (!student || !school) {
  //       return res.status(404).json({ message: 'Student or school not found' });
  //     }

  //     // Generate certificate content based on type
  //     let certificateContent = '';
  //     const currentDate = new Date().toISOString().split('T')[0];
  //     const grNumber = student.studentDetails.grNumber || 'N/A';
  //     const className = student.studentDetails.class ? `${student.studentDetails.class.name}${student.studentDetails.class.division || ''}` : 'N/A';
  //     const parentName = student.studentDetails.parentDetails?.name || 'N/A';

  //     if (certificate.type === 'bonafide') {
  //       certificateContent = `
  //         Date: ${currentDate}
  //         BONAFIDE CERTIFICATE

  //         This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},
  //         bearing roll number ${grNumber} is a student of ${school.name} (year) 
  //         ${className} for the academic year ${new Date().getFullYear()}.
  //         He/She is reliable, sincere, hardworking and bears a good moral character.

  //         ${school.address}
  //         (Official Seal)
  //         ----------------
  //         Signature
  //         Registrar/Principal/Dean
  //       `;
  //     } else if (certificate.type === 'leaving') {
  //       certificateContent = `
  //         School Detail
  //         SCHOOL LEAVING CERTIFICATE
  //         Book No. _________  S No. _________  GR No. _________

  //         1. Name of Pupil: ${student.name}
  //         2. Father's/Guardian's/Mother's Name: ${parentName}
  //         3. Nationality: [Insert Nationality]
  //         4. Whether candidate belongs to Schedule Caste/Schedule Tribe: [N/A]
  //         5. Date of First admission in the School with class: [Insert Date] (${className})
  //         6. Date of Birth (in Christian Era) according to Admission Register: [Insert DOB]
  //         7. Class in which pupil last studied/figures): ${className}
  //         8. School/Board Annual examination last taken with result: [N/A]
  //         9. Whether failed, if so once/twice in the same class: [N/A]
  //         10. Subject studied: 1. ________ 2. ________ 3. ________
  //         11. Whether qualified for promotion to higher class if so, to which class: [N/A]
  //         12. Month up to which the Pupil has paid School dues: [N/A]
  //         13. Any fee concession available: If so, the nature of such concession: [N/A]
  //         14. Total No. of working days: [N/A]  15. Total Nos. of working days Present: [N/A]
  //         16. Whether NCC Cadet/Scout/details may be given): [N/A]
  //         17. Game played or extracurricular activities in which the Pupil usually took part (mention achievement level therein): [N/A]
  //         18. General Conduct: [Good]
  //         19. Date of application of Certificate: ${currentDate}
  //         20. Date of leaving the school: ${currentDate}
  //         21. Reason for leaving the school: ${certificate.purpose}
  //         22. Any other remarks: [N/A]

  //         Checked by
  //         ----------------
  //         Signature
  //         Class Teacher
  //         (State full name & Designation)
  //         ----------------
  //         Signature
  //         Principal
  //       `;
  //     } else if (certificate.type === 'transfer') {
  //       certificateContent = `
  //         Date: ${currentDate}
  //         TRANSFER CERTIFICATE

  //         This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},
  //         bearing roll number ${grNumber} was a student of ${school.name} in ${className} 
  //         from [Insert Admission Date] to ${currentDate}. He/She has completed the required 
  //         coursework and is eligible for transfer to another institution.

  //         ${school.address}
  //         (Official Seal)
  //         ----------------
  //         Signature
  //         Registrar/Principal/Dean
  //       `;
  //     }

  //     // Simulate certificate generation (replace with actual file upload to Cloudinary or similar)
  //     const documentUrl = `https://example.com/generated/${certificate._id}.pdf`; // Placeholder URL
  //     certificate.documentUrl = documentUrl;
  //     certificate.status = 'generated';
  //     certificate.issuedDate = new Date();
  //     certificate.generatedBy = req.user._id;
  //     certificate.comments = comments;
  //     await certificate.save();

  //     // Send notification to student (implement sendCertificateNotification)
  //     const notificationResult = await sendCertificateNotification(
  //       student.email,
  //       student.studentDetails.mobile,
  //       student.name,
  //       certificate.type,
  //       documentUrl
  //     );

  //     res.json({
  //       message: 'Certificate generated successfully',
  //       certificate,
  //       notificationStatus: {
  //         emailSent: notificationResult.emailSent,
  //         smsSent: notificationResult.smsSent,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  // getPendingCertificates: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require('../models/Certificate')(connection);
  //     const User = require('../models/User')(connection);

  //     const certificates = await Certificate.find({
  //       school: schoolId,
  //       status: 'pending',
  //     })
  //       .populate('student', 'name email studentDetails', User)
  //       .sort({ requestDate: -1 });

  //     res.json({
  //       status: 'success',
  //       count: certificates.length,
  //       certificates: certificates.map(cert => ({
  //         id: cert._id,
  //         studentName: cert.student.name,
  //         studentEmail: cert.student.email,
  //         type: cert.type,
  //         purpose: cert.purpose,
  //         urgency: cert.urgency,
  //         requestDate: cert.requestDate,
  //         status: cert.status,
  //       })),
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // generateCertificate: async (req, res) => {
  //   try {
  //     const { certificateId } = req.params;
  //     const { status, comments } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Certificate = require('../models/Certificate')(connection);
  //     const User = require('../models/User')(connection);
  //     const Class = require('../models/Class')(connection);
  //     const School = require('../models/School')(require('../config/database').getOwnerConnection());

  //     const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
  //     if (!certificate) {
  //       return res.status(404).json({ message: 'Certificate request not found' });
  //     }

  //     if (status === 'rejected') {
  //       certificate.status = 'rejected';
  //       certificate.comments = comments;
  //       await certificate.save();
  //       return res.json({ message: 'Certificate request rejected', certificate });
  //     }

  //     if (status !== 'generated') {
  //       return res.status(400).json({ message: 'Invalid status for generation' });
  //     }

  //     // Fetch student and school details
  //     const student = await User.findById(certificate.student)
  //       .populate('studentDetails.class', 'name division', Class)
  //       .select('name email studentDetails');
  //     const school = await School.findById(schoolId).select('name address');

  //     if (!student || !school) {
  //       return res.status(404).json({ message: 'Student or school not found' });
  //     }

  //     // Prepare data for the certificate
  //     const currentDate = new Date().toISOString().split('T')[0];
  //     const grNumber = student.studentDetails.grNumber || 'N/A';
  //     const className = student.studentDetails.class
  //       ? `${student.studentDetails.class.name}${student.studentDetails.class.division ? ' ' + student.studentDetails.class.division : ''}`
  //       : 'N/A';
  //     const parentName = student.studentDetails.parentDetails?.name || 'N/A';
  //     const admissionDate = student.studentDetails.admissionDate || 'N/A';
  //     const dob = student.studentDetails.dob || 'N/A';

  //     // Generate PDF using pdfkit
  //     const doc = new PDFDocument({ size: 'A4', margin: 50 });
  //     const buffers = [];
  //     doc.on('data', buffers.push.bind(buffers));
  //     doc.on('end', async () => {
  //       const pdfBuffer = Buffer.concat(buffers);

  //       // Upload the PDF to Cloudinary
  //       try {
  //         const cloudinaryResult = await uploadCertificateToCloudinary(pdfBuffer, certificate._id, certificate.type);
  //         const documentUrl = cloudinaryResult.secure_url;

  //         // Update certificate with the Cloudinary URL
  //         certificate.documentUrl = documentUrl;
  //         certificate.status = 'generated';
  //         certificate.issuedDate = new Date();
  //         certificate.generatedBy = req.user._id;
  //         certificate.comments = comments;
  //         await certificate.save();

  //         // Send notification to student
  //         const notificationResult = await sendCertificateNotification(
  //           student.email,
  //           student.studentDetails.mobile,
  //           student.name,
  //           certificate.type,
  //           documentUrl
  //         );

  //         res.json({
  //           message: 'Certificate generated successfully',
  //           certificate,
  //           notificationStatus: {
  //             emailSent: notificationResult.emailSent,
  //             smsSent: notificationResult.smsSent,
  //           },
  //         });
  //       } catch (uploadError) {
  //         res.status(500).json({ error: 'Failed to upload certificate to Cloudinary: ' + uploadError.message });
  //       }
  //     });

  //     // Add content to the PDF based on certificate type
  //     doc.font('Helvetica');

  //     if (certificate.type === 'bonafide') {
  //       // Bonafide Certificate Layout
  //       doc
  //         .fontSize(12)
  //         .text(`Date: ${currentDate}`, 50, 50, { align: 'left' })
  //         .moveDown()
  //         .fontSize(16)
  //         .font('Helvetica-Bold')
  //         .text('BONAFIDE CERTIFICATE', { align: 'center' })
  //         .moveDown(2);

  //       doc
  //         .fontSize(12)
  //         .font('Helvetica')
  //         .text(
  //           `This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},`,
  //           { align: 'justify' }
  //         )
  //         .text(
  //           `bearing roll number ${grNumber} is a student of ${school.name} (year)`,
  //           { align: 'justify' }
  //         )
  //         .text(
  //           `${className} for the academic year ${new Date().getFullYear()}.`,
  //           { align: 'justify' }
  //         )
  //         .moveDown()
  //         .text(
  //           `He/She is reliable, sincere, hardworking and bears a good moral character.`,
  //           { align: 'justify' }
  //         )
  //         .moveDown(2);

  //       doc
  //         .text(`${school.name}`, { align: 'left' })
  //         .text(`${school.address || 'N/A'}`, { align: 'left' })
  //         .text('(Official Seal)', { align: 'left' })
  //         .moveDown(2)
  //         .text('________________', { align: 'right' })
  //         .text('Signature', { align: 'right' })
  //         .text('Registrar/Principal/Dean', { align: 'right' });
  //     } else if (certificate.type === 'leaving') {
  //       // School Leaving Certificate Layout
  //       doc
  //         .fontSize(14)
  //         .font('Helvetica-Bold')
  //         .text('School Detail', { align: 'center' })
  //         .moveDown()
  //         .text('SCHOOL LEAVING CERTIFICATE', { align: 'center' })
  //         .moveDown()
  //         .fontSize(12)
  //         .font('Helvetica')
  //         .text(`Book No. _________  S No. _________  GR No. ${grNumber}`, { align: 'center' })
  //         .moveDown(2);

  //       const fields = [
  //         `1. Name of Pupil: ${student.name}`,
  //         `2. Father's/Guardian's/Mother's Name: ${parentName}`,
  //         `3. Nationality: [N/A]`,
  //         `4. Whether candidate belongs to Schedule Caste/Schedule Tribe: [N/A]`,
  //         `5. Date of First admission in the School with class: ${admissionDate} (${className})`,
  //         `6. Date of Birth (in Christian Era) according to Admission Register: ${dob}`,
  //         `7. Class in which pupil last studied/figures): ${className}`,
  //         `8. School/Board Annual examination last taken with result: [N/A]`,
  //         `9. Whether failed, if so once/twice in the same class: [N/A]`,
  //         `10. Subject studied: 1. ________ 2. ________ 3. ________`,
  //         `11. Whether qualified for promotion to higher class if so, to which class: [N/A]`,
  //         `12. Month up to which the Pupil has paid School dues: [N/A]`,
  //         `13. Any fee concession available: If so, the nature of such concession: [N/A]`,
  //         `14. Total No. of working days: [N/A]`,
  //         `15. Total Nos. of working days Present: [N/A]`,
  //         `16. Whether NCC Cadet/Scout/details may be given): [N/A]`,
  //         `17. Game played or extracurricular activities in which the Pupil usually took part (mention achievement level therein): [N/A]`,
  //         `18. General Conduct: [Good]`,
  //         `19. Date of application of Certificate: ${currentDate}`,
  //         `20. Date of leaving the school: ${currentDate}`,
  //         `21. Reason for leaving the school: ${certificate.purpose}`,
  //         `22. Any other remarks: [N/A]`,
  //       ];

  //       fields.forEach((field, index) => {
  //         doc.text(field, { align: 'left' }).moveDown(0.5);
  //       });

  //       doc
  //         .moveDown(2)
  //         .text('Checked by', { align: 'left' })
  //         .text('________________', { align: 'left' })
  //         .text('Signature', { align: 'left' })
  //         .text('Class Teacher', { align: 'left' })
  //         .text('(State full name & Designation)', { align: 'left' })
  //         .moveDown()
  //         .text('________________', { align: 'right' })
  //         .text('Signature', { align: 'right' })
  //         .text('Principal', { align: 'right' });
  //     } else if (certificate.type === 'transfer') {
  //       // Transfer Certificate Layout
  //       doc
  //         .fontSize(12)
  //         .text(`Date: ${currentDate}`, 50, 50, { align: 'left' })
  //         .moveDown()
  //         .fontSize(16)
  //         .font('Helvetica-Bold')
  //         .text('TRANSFER CERTIFICATE', { align: 'center' })
  //         .moveDown(2);

  //       doc
  //         .fontSize(12)
  //         .font('Helvetica')
  //         .text(
  //           `This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},`,
  //           { align: 'justify' }
  //         )
  //         .text(
  //           `bearing roll number ${grNumber} was a student of ${school.name} in ${className}`,
  //           { align: 'justify' }
  //         )
  //         .text(
  //           `from ${admissionDate} to ${currentDate}. He/She has completed the required`,
  //           { align: 'justify' }
  //         )
  //         .text(
  //           `coursework and is eligible for transfer to another institution.`,
  //           { align: 'justify' }
  //         )
  //         .moveDown(2);

  //       doc
  //         .text(`${school.name}`, { align: 'left' })
  //         .text(`${school.address || 'N/A'}`, { align: 'left' })
  //         .text('(Official Seal)', { align: 'left' })
  //         .moveDown(2)
  //         .text('________________', { align: 'right' })
  //         .text('Signature', { align: 'right' })
  //         .text('Registrar/Principal/Dean', { align: 'right' });
  //     }

  //     doc.end();
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  getPendingCertificates: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);

      const certificates = await Certificate.find({
        school: schoolId,
        status: 'pending',
      })
        .populate('student', 'name email studentDetails', User)
        .sort({ requestDate: -1 });

      res.json({
        status: 'success',
        count: certificates.length,
        certificates: certificates.map(cert => ({
          id: cert._id,
          studentName: cert.student.name,
          studentEmail: cert.student.email,
          type: cert.type,
          purpose: cert.purpose,
          urgency: cert.urgency,
          requestDate: cert.requestDate,
          status: cert.status,
        })),
      });
    } catch (error) {
      console.error('Error in getPendingCertificates:', error);
      res.status(500).json({ error: error.message });
    }
  },

  generateCertificate: async (req, res) => {
    try {
      const { certificateId } = req.params;
      const {
        status,
        comments,
        nationality, // For School Leaving Certificate
        belongsToScheduleCasteOrTribe, // For School Leaving Certificate
        subjectsStudied, // For School Leaving Certificate (array of subjects)
        qualifiedForPromotion, // For School Leaving Certificate (boolean)
        promotionClass, // For School Leaving Certificate (if qualifiedForPromotion is true)
        monthFeesPaid, // For School Leaving Certificate
        feeConcession, // For School Leaving Certificate
        totalWorkingDays, // For School Leaving Certificate
        totalDaysPresent, // For School Leaving Certificate
        nccOrScoutDetails, // For School Leaving Certificate
        extracurricularActivities, // For School Leaving Certificate
        generalConduct, // For School Leaving Certificate
        dateOfApplication, // For School Leaving Certificate
        dateOfLeaving, // For School Leaving Certificate
        reasonForLeaving, // For School Leaving Certificate
        remarks, // For School Leaving Certificate
      } = req.body;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);
      const School = require('../models/School')(require('../config/database').getOwnerConnection());

      // Validate certificateId
      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return res.status(400).json({ message: 'Invalid certificate ID' });
      }

      const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate request not found' });
      }

      if (status === 'rejected') {
        certificate.status = 'rejected';
        certificate.comments = comments;
        await certificate.save();
        return res.json({ message: 'Certificate request rejected', certificate });
      }

      if (status !== 'generated') {
        return res.status(400).json({ message: 'Invalid status for generation' });
      }

      // Fetch student and school details
      const student = await User.findById(certificate.student)
        .populate('studentDetails.class', 'name division', Class)
        .select('name email studentDetails');
      const school = await School.findById(schoolId).select('name address');

      if (!student || !school) {
        return res.status(404).json({ message: 'Student or school not found' });
      }

      // Prepare data for the certificate
      const currentDate = new Date().toISOString().split('T')[0];
      const grNumber = student.studentDetails.grNumber || 'N/A';
      const className = student.studentDetails.class
        ? `${student.studentDetails.class.name}${student.studentDetails.class.division ? ' ' + student.studentDetails.class.division : ''}`
        : 'N/A';
      const parentName = student.studentDetails.parentDetails?.name || 'N/A';
      const admissionDate = student.studentDetails.admissionDate || 'N/A';
      const dob = student.studentDetails.dob || 'N/A';

      // Generate PDF using pdfkit
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', async () => {
        const pdfBuffer = Buffer.concat(buffers);

        // Upload the PDF to Cloudinary
        try {
          const cloudinaryResult = await uploadCertificateToCloudinary(pdfBuffer, certificate._id, certificate.type);
          const documentUrl = cloudinaryResult.secure_url;

          // Update certificate with the Cloudinary URL
          certificate.documentUrl = documentUrl;
          certificate.status = 'generated';
          certificate.issuedDate = new Date();
          certificate.generatedBy = req.user._id;
          certificate.comments = comments;
          await certificate.save();

          // Send notification to student
          const notificationResult = await sendCertificateNotification(
            student.email,
            student.studentDetails.mobile,
            student.name,
            certificate.type,
            documentUrl
          );

          res.json({
            message: 'Certificate generated successfully',
            certificate,
            notificationStatus: {
              emailSent: notificationResult.emailSent,
              smsSent: notificationResult.smsSent,
            },
          });
        } catch (uploadError) {
          console.error('Error uploading to Cloudinary:', uploadError);
          res.status(500).json({ error: 'Failed to upload certificate to Cloudinary: ' + uploadError.message });
        }
      });

      // Add content to the PDF based on certificate type
      doc.font('Helvetica');

      if (certificate.type === 'bonafide') {
        // Bonafide Certificate Layout
        doc
          .fontSize(12)
          .text(`Date: ${currentDate}`, 50, 50, { align: 'left' })
          .moveDown()
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('BONAFIDE CERTIFICATE', { align: 'center' })
          .moveDown(2);

        doc
          .fontSize(12)
          .font('Helvetica')
          .text(
            `This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},`,
            { align: 'justify' }
          )
          .text(
            `bearing roll number ${grNumber} is a student of ${school.name} (year)`,
            { align: 'justify' }
          )
          .text(
            `${className} for the academic year ${new Date().getFullYear()}.`,
            { align: 'justify' }
          )
          .moveDown()
          .text(
            `He/She is reliable, sincere, hardworking and bears a good moral character.`,
            { align: 'justify' }
          )
          .moveDown(2);

        doc
          .text(`${school.name}`, { align: 'left' })
          .text(`${school.address || 'N/A'}`, { align: 'left' })
          .text('(Official Seal)', { align: 'left' })
          .moveDown(2)
          .text('________________', { align: 'right' })
          .text('Signature', { align: 'right' })
          .text('Registrar/Principal/Dean', { align: 'right' });
      } else if (certificate.type === 'leaving') {
        // School Leaving Certificate Layout
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('School Detail', { align: 'center' })
          .moveDown()
          .text('SCHOOL LEAVING CERTIFICATE', { align: 'center' })
          .moveDown()
          .fontSize(12)
          .font('Helvetica')
          .text(`Book No. _________  S No. _________  GR No. ${grNumber}`, { align: 'center' })
          .moveDown(2);

        const fields = [
          `1. Name of Pupil: ${student.name}`,
          `2. Father's/Guardian's/Mother's Name: ${parentName}`,
          `3. Nationality: ${nationality || '[N/A]'}`,
          `4. Whether candidate belongs to Schedule Caste/Schedule Tribe: ${belongsToScheduleCasteOrTribe || '[N/A]'}`,
          `5. Date of First admission in the School with class: ${admissionDate} (${className})`,
          `6. Date of Birth (in Christian Era) according to Admission Register: ${dob}`,
          `7. Class in which pupil last studied/figures): ${className}`,
          `8. School/Board Annual examination last taken with result: [N/A]`, // This could be added as a field if needed
          `9. Whether failed, if so once/twice in the same class: [N/A]`, // This could be added as a field if needed
          `10. Subject studied: ${subjectsStudied && subjectsStudied.length > 0 ? subjectsStudied.map((subject, index) => `${index + 1}. ${subject}`).join(' ') : '1. [N/A] 2. [N/A] 3. [N/A]'}`,
          `11. Whether qualified for promotion to higher class if so, to which class: ${qualifiedForPromotion ? `Yes, ${promotionClass || '[N/A]'}` : 'No'}`,
          `12. Month up to which the Pupil has paid School dues: ${monthFeesPaid || '[N/A]'}`,
          `13. Any fee concession available: If so, the nature of such concession: ${feeConcession || '[N/A]'}`,
          `14. Total No. of working days: ${totalWorkingDays || '[N/A]'}`,
          `15. Total Nos. of working days Present: ${totalDaysPresent || '[N/A]'}`,
          `16. Whether NCC Cadet/Scout/details may be given): ${nccOrScoutDetails || '[N/A]'}`,
          `17. Game played or extracurricular activities in which the Pupil usually took part (mention achievement level therein): ${extracurricularActivities || '[N/A]'}`,
          `18. General Conduct: ${generalConduct || 'Good'}`,
          `19. Date of application of Certificate: ${dateOfApplication || currentDate}`,
          `20. Date of leaving the school: ${dateOfLeaving || currentDate}`,
          `21. Reason for leaving the school: ${reasonForLeaving || certificate.purpose}`,
          `22. Any other remarks: ${remarks || '[N/A]'}`,
        ];

        fields.forEach((field, index) => {
          doc.text(field, { align: 'left' }).moveDown(0.5);
        });

        doc
          .moveDown(2)
          .text('Checked by', { align: 'left' })
          .text('________________', { align: 'left' })
          .text('Signature', { align: 'left' })
          .text('Class Teacher', { align: 'left' })
          .text('(State full name & Designation)', { align: 'left' })
          .moveDown()
          .text('________________', { align: 'right' })
          .text('Signature', { align: 'right' })
          .text('Principal', { align: 'right' });
      } else if (certificate.type === 'transfer') {
        // Transfer Certificate Layout
        doc
          .fontSize(12)
          .text(`Date: ${currentDate}`, 50, 50, { align: 'left' })
          .moveDown()
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('TRANSFER CERTIFICATE', { align: 'center' })
          .moveDown(2);

        doc
          .fontSize(12)
          .font('Helvetica')
          .text(
            `This is to certify that Mr./Ms. ${student.name}, S/O or D/O of Mr./Ms. ${parentName},`,
            { align: 'justify' }
          )
          .text(
            `bearing roll number ${grNumber} was a student of ${school.name} in ${className}`,
            { align: 'justify' }
          )
          .text(
            `from ${admissionDate} to ${dateOfLeaving || currentDate}. He/She has completed the required`,
            { align: 'justify' }
          )
          .text(
            `coursework and is eligible for transfer to another institution.`,
            { align: 'justify' }
          )
          .moveDown(2);

        doc
          .text(`${school.name}`, { align: 'left' })
          .text(`${school.address || 'N/A'}`, { align: 'left' })
          .text('(Official Seal)', { align: 'left' })
          .moveDown(2)
          .text('________________', { align: 'right' })
          .text('Signature', { align: 'right' })
          .text('Registrar/Principal/Dean', { align: 'right' });
      }

      doc.end();
    } catch (error) {
      console.error('Error in generateCertificate:', error);
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

const sendCertificateNotification = async (email, mobile, studentName, certificateType, documentUrl) => {
  // Implement email and SMS notification logic here
  return {
    emailSent: true,
    smsSent: true,
    error: null,
  };
};

// Placeholder helper functions (implement as needed)
const getFeeAmount = (type, classId) => 1000; // Placeholder
const getFeeDueDate = (type) => new Date(); // Placeholder

module.exports = clerkController;
