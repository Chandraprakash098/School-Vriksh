


// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const { sendAdmissionNotification } = require('../utils/notifications');
// const PDFDocument = require('pdfkit');
// // const { uploadCertificateToCloudinary } = require('../config/cloudinary');
// const { upload, announcementUpload, certificateUpload, uploadCertificateToCloudinary } = require('../config/cloudinary');

// const multer = require('multer');

// // Configure multer for temporary file storage
// const storage = multer.memoryStorage(); // Store files in memory (we'll upload directly to Cloudinary)
// // const upload = multer({ storage: storage });

// const clerkController = {

 
    

//     getDashboard: async (req, res) => {
//       try {
//         const schoolId = req.school._id.toString();
//         const clerkId = req.user._id.toString(); // Ensure string type
//         const connection = req.connection;
        
//         const AdmissionApplication = require('../models/AdmissionApplication')(connection);
//         const Certificate = require('../models/Certificate')(connection);
//         const User = require('../models/User')(connection);
//         const Leave = require('../models/Leave')(connection);
    
//         // Current date (March 21, 2025 as per system date)
//         const today = new Date('2025-03-21');
//         const startOfDay = new Date(today.setHours(0, 0, 0, 0));
//         const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
//         // 1. Pending Verifications Count
//         const pendingVerifications = await AdmissionApplication.countDocuments({
//           school: schoolId,
//           $or: [
//             {
//               status: { $in: ['pending', 'document_verification'] },
//               'clerkVerification.status': 'pending',
//             },
//             {
//               status: 'approved',
//               'feesVerification.status': 'verified',
//               'clerkVerification.status': 'verified',
//             },
//           ],
//         });
    
//         // 2. Pending Certificates Count
//         const pendingCertificates = await Certificate.countDocuments({
//           school: schoolId,
//           status: 'pending',
//         });
    
//         // 3. Enrolled Students Today
//         const enrolledToday = await User.countDocuments({
//           school: schoolId,
//           role: 'student',
//           createdAt: { $gte: startOfDay, $lte: endOfDay },
//         });
    
//         // 4. Leave Status Summary - Enhanced with debugging
//         // First, let's verify if we have any leaves at all
//         const totalLeaves = await Leave.countDocuments({
//           school: schoolId,
//           user: clerkId
//         });
    
//         console.log(`Total leaves found for clerk ${clerkId} in school ${schoolId}: ${totalLeaves}`);
    
//         const leaveSummary = await Leave.aggregate([
//           { 
//             $match: { 
//               school: new mongoose.Types.ObjectId(schoolId), // Use 'new' keyword
//               user: new mongoose.Types.ObjectId(clerkId)
//             } 
//           },
//           {
//             $group: {
//               _id: '$status',
//               count: { $sum: 1 },
//             },
//           },
//           {
//             $project: {
//               status: '$_id',
//               count: 1,
//               _id: 0
//             }
//           }
//         ]);
    
//         console.log('Leave summary aggregation result:', leaveSummary);
    
//         // Initialize leave status object
//         const leaveStatus = {
//           pending: 0,
//           approved: 0,
//           rejected: 0,
//           total: 0
//         };
    
//         // Populate leave status counts
//         leaveSummary.forEach(item => {
//           if (item.status in leaveStatus) {
//             leaveStatus[item.status] = item.count;
//           }
//         });
    
//         // Calculate total leaves
//         leaveStatus.total = leaveStatus.pending + leaveStatus.approved + leaveStatus.rejected;
    
//         // 5. RTE Admissions Overview
//         const rteStudents = await User.countDocuments({
//           school: schoolId,
//           'studentDetails.isRTE': true,
//           'studentDetails.admissionDate': {
//             $gte: new Date('2025-01-01'),
//             $lte: new Date('2025-12-31'),
//           },
//         });
    
//         // 6. Total Number of Students
//         const totalStudents = await User.countDocuments({
//           school: schoolId,
//           role: 'student',
//         });
    
//         // Compile dashboard data
//         const dashboardData = {
//           status: 'success',
//           timestamp: new Date(),
//           pendingVerifications,
//           pendingCertificates,
//           enrolledToday,
//           totalStudents,
//           leaveStatus,
//           rteStudents,
//           debug: { totalLeaves } // Adding debug info
//         };
    
//         res.json(dashboardData);
//       } catch (error) {
//         console.error('Error in getDashboard:', error);
//         res.status(500).json({ error: error.message });
//       }
//     },

//   getPendingVerifications: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);

//       const applications = await AdmissionApplication.find({
//         school: schoolId,
//         $or: [
//           // Pending document verification by clerk
//           {
//             status: { $in: ['pending', 'document_verification'] },
//             'clerkVerification.status': 'pending',
//           },
//           // Approved by fees manager, awaiting clerk's final enrollment
//           {
//             status: 'approved',
//             'feesVerification.status': 'verified',
//             'clerkVerification.status': 'verified', // Ensure clerk has already verified documents
//           },
//         ],
//       }).sort({ createdAt: -1 });

//       res.json({
//         status: 'success',
//         count: applications.length,
//         applications: applications.map((app) => ({
//           id: app._id,
//           trackingId: app.trackingId,
//           studentDetails: {
//             name: app.studentDetails.name,
//             dob: app.studentDetails.dob,
//             gender: app.studentDetails.gender,
//             email: app.studentDetails.email,
//             mobile: app.studentDetails.mobile,
//             appliedClass: app.studentDetails.appliedClass,
//           },
//           parentDetails: {
//             name: app.parentDetails.name,
//             email: app.parentDetails.email,
//             mobile: app.parentDetails.mobile,
//             occupation: app.parentDetails.occupation,
//             address: {
//               street: app.parentDetails.address.street,
//               city: app.parentDetails.address.city,
//               state: app.parentDetails.address.state,
//               pincode: app.parentDetails.address.pincode,
//             },
//           },
//           admissionType: app.admissionType,
//           status: app.status,
//           submittedOn: app.createdAt,
//           documents: app.documents.map(doc => ({
//             type: doc.type,
//             documentUrl: doc.documentUrl,
//             public_id: doc.public_id,
//             verified: doc.verified,
//           })),
//           additionalResponses: app.additionalResponses ? Object.fromEntries(app.additionalResponses) : {},
//           clerkVerification: {
//             status: app.clerkVerification.status,
//             comments: app.clerkVerification.comments,
//           },
//           feesVerification: {
//             status: app.feesVerification.status,
//             receiptNumber: app.feesVerification.receiptNumber,
//             verifiedAt: app.feesVerification.verifiedAt,
//           }, // Include fees verification details
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ 
//         status: 'error',
//         error: error.message 
//       });
//     }
//   },

//   clerkVerification: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { status, comments } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);

//       const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       // Verify all required documents are present (implement validateDocuments if needed)
//       // const hasAllDocuments = application.documents.length > 0;
//       const hasAllDocuments = application.validateDocuments();
//       if (!hasAllDocuments) {
//         return res.status(400).json({ message: 'Missing required documents' });
//       }

//       application.clerkVerification = {
//         status,
//         verifiedBy: req.user._id,
//         verifiedAt: new Date(),
//         comments,
//       };

//       if (status === 'verified') {
//         // application.status = application.admissionType === 'RTE' ? 'approved' : 'fees_pending';
//         application.status = 'fees_pending';
//       } else {
//         application.status = 'rejected';
//       }

//       await application.save();

//       // res.json({
//       //   message: 'Verification completed',
//       //   nextStep: status === 'verified'
//       //     ? application.admissionType === 'RTE'
//       //       ? 'Admission approved'
//       //       : 'Visit fees department'
//       //     : 'Application rejected',
//       // });
//       res.json({
//         message: 'Verification completed',
//         nextStep: status === 'verified' ? 'Visit fees department for verification' : 'Application rejected',
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  

//   verifyDocuments: async (req, res) => {
//     try {
//       const { studentId } = req.params; // Changed from req.school to req.params
//       const { verifiedDocuments } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       // const Document = require('../models/Document')(connection); // Uncomment if Document model exists

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       // Placeholder: Assuming documents are part of studentDetails or a separate model
//       // Update document verification status (implement if Document model exists)
//       // await Document.updateMany({ student: studentId, _id: { $in: verifiedDocuments } }, { verified: true });

//       // Update student status
//       student.studentDetails.status = 'verified'; // Adjusted to studentDetails
//       await student.save();

//       res.json({ message: 'Documents verified successfully' });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  
//   viewApplicationDocuments: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);

//       // Validate applicationId
//       if (!mongoose.Types.ObjectId.isValid(applicationId)) {
//         return res.status(400).json({ message: 'Invalid application ID' });
//       }

//       const application = await AdmissionApplication.findOne({
//         _id: applicationId,
//         school: schoolId,
//       });

//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       // Check if the user has permission (clerk role is already enforced by middleware)
//       if (req.user.role !== 'clerk') {
//         return res.status(403).json({ message: 'Unauthorized access' });
//       }

//       // Prepare document data for response
//       const documents = application.documents.map(doc => ({
//         type: doc.type,
//         documentUrl: doc.documentUrl, // URL to view the document
//         public_id: doc.public_id,    // Cloudinary public ID
//         verified: doc.verified,      // Verification status
//         uploadedAt: application.createdAt, // Assuming uploaded at the time of application creation
//       }));

//       res.json({
//         status: 'success',
//         applicationId: application._id,
//         trackingId: application.trackingId,
//         studentName: application.studentDetails.name,
//         admissionType: application.admissionType,
//         documentCount: documents.length,
//         documents,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   getAvailableClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);
  
//       const allClasses = await Class.find({ school: schoolId })
//         .select('name division academicYear capacity students classTeacher')
//         .populate('classTeacher', 'name', User)
//         .sort({ name: 1, division: 1 });
  
//       res.json({
//         classes: allClasses.map(cls => ({
//           _id: cls._id,
//           name: cls.name,
//           division: cls.division,
//           academicYear: cls.academicYear,
//           teacher: cls.classTeacher ? cls.classTeacher.name : null,
//           enrolledCount: cls.students ? cls.students.length : 0,
//           capacity: cls.capacity,
//           remainingCapacity: cls.capacity - (cls.students ? cls.students.length : 0),
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  



//   enrollStudent: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { classId, grNumber, password } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);
//       const School = require('../models/School')(require('../config/database').getOwnerConnection()); // Access School model from owner DB

//       if (!password) {
//         return res.status(400).json({ message: 'Password is required' });
//       }

//       const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (application.status !== 'approved') {
//         return res.status(400).json({ message: 'Only approved applications can be enrolled' });
//       }

//       const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (existingGR) {
//         return res.status(400).json({ message: 'GR number already exists' });
//       }

//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       if (selectedClass.students.length >= selectedClass.capacity) {
//         return res.status(400).json({ message: 'Class is at full capacity' });
//       }

//       // Fetch school name from the School model
//       const school = await School.findById(schoolId).select('name');
//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);

//       const student = new User({
//         school: schoolId,
//         name: application.studentDetails.name,
//         email: application.studentDetails.email,
//         password: hashedPassword,
//         role: 'student',
//         status: 'active',
//         studentDetails: {
//           grNumber,
//           class: classId,
//           admissionType: application.admissionType,
//           parentDetails: application.parentDetails,
//           dob: application.studentDetails.dob,
//           gender: application.studentDetails.gender,
//         },
//       });

//       await student.save();

//       await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

//       application.status = 'enrolled';
//       application.grNumber = grNumber;
//       application.assignedClass = classId;
//       await application.save();

//       // Prepare class name (e.g., "5th A" using name and division)
//       const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

//       // Send notification with school name and class
//       const notificationResult = await sendAdmissionNotification(
//         student.email,
//         application.studentDetails.mobile,
//         student.name,
//         password,
//         school.name, // School name
//         className    // Class name
//       );

//       if (!notificationResult.emailSent || !notificationResult.smsSent) {
//         console.warn('Notification partially failed:', notificationResult.error);
//         // Optionally rollback if notifications are critical (see previous example)
//       }

//       res.json({
//         message: 'Student enrolled successfully',
//         studentDetails: {
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber,
//           class: { name: selectedClass.name, division: selectedClass.division },
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       // Validate classId
//       if (!mongoose.Types.ObjectId.isValid(classId)) {
//         return res.status(400).json({ message: 'Invalid class ID' });
//       }

//       // Check if class exists
//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       // Fetch students enrolled in this class
//       const students = await User.find({
//         school: schoolId,
//         'studentDetails.class': classId,
//         role: 'student',
//       })
//         .select('name email studentDetails')
//         .lean();

//       res.json({
//         status: 'success',
//         class: {
//           name: selectedClass.name,
//           division: selectedClass.division,
//           academicYear: selectedClass.academicYear,
//           capacity: selectedClass.capacity,
//           enrolledCount: selectedClass.students.length,
//         },
//         count: students.length,
//         students: students.map(student => ({
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber: student.studentDetails.grNumber,
//           admissionType: student.studentDetails.admissionType,
//           dob: student.studentDetails.dob,
//           gender: student.studentDetails.gender,
//           parentDetails: student.studentDetails.parentDetails,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   requestLeave: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { reason, startDate, endDate, type } = req.body;
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leave = new Leave({
//         school: schoolId,
//         user: clerkId,
//         reason,
//         startDate,
//         endDate,
//         type,
//         status: 'pending',
//         appliedOn: new Date(),
//       });

//       await leave.save();
//       res.status(201).json(leave);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getLeaveStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leaves = await Leave.find({ school: schoolId, user: clerkId })
//         .sort({ appliedOn: -1 })
//         .lean();

//       res.json({
//         status: 'success',
//         count: leaves.length,
//         leaves: leaves.map(leave => ({
//           id: leave._id,
//           reason: leave.reason,
//           startDate: leave.startDate,
//           endDate: leave.endDate,
//           type: leave.type,
//           status: leave.status,
//           appliedOn: leave.appliedOn,
//           reviewedBy: leave.reviewedBy,
//           reviewedAt: leave.reviewedAt,
//           comments: leave.comments,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

 
//   getPendingCertificates: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const certificates = await Certificate.find({
//         school: schoolId,
//         status: 'pending',
//       })
//         .populate({
//           path: 'student',
//           select: 'name email studentDetails',
//           populate: {
//             path: 'studentDetails.class',
//             model: Class,
//             select: 'name division',
//           },
//         })
//         .populate('generatedBy', 'name email', User)
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
//           id: cert._id,
//           studentName: cert.student?.name || 'N/A',
//           studentEmail: cert.student?.email || 'N/A',
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
//           parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
//           admissionDate: cert.student?.studentDetails?.admissionDate
//             ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
//             : 'N/A',
//           dob: cert.student?.studentDetails?.dob
//             ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
//             : 'N/A',
//           className: cert.student?.studentDetails?.class
//             ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
//             : 'N/A',
//           schoolName: req.school?.name || 'N/A',
//           schoolAddress: req.school?.address || 'N/A',
//         })),
//       });
//     } catch (error) {
//       console.error('Error in getPendingCertificates:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getCertificateHistory: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const certificates = await Certificate.find({ school: schoolId })
//         .populate({
//           path: 'student',
//           select: 'name email studentDetails',
//           populate: {
//             path: 'studentDetails.class',
//             model: Class,
//             select: 'name division',
//           },
//         })
//         .populate('generatedBy', 'name email', User)
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map(cert => ({
//           id: cert._id,
//           studentName: cert.student?.name || 'N/A',
//           studentEmail: cert.student?.email || 'N/A',
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl || null,
//           signedDocumentUrl: cert.signedDocumentUrl || null,
//           isSentToStudent: cert.isSentToStudent,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//           grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
//           parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
//           admissionDate: cert.student?.studentDetails?.admissionDate
//             ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
//             : 'N/A',
//           dob: cert.student?.studentDetails?.dob
//             ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
//             : 'N/A',
//           className: cert.student?.studentDetails?.class
//             ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
//             : 'N/A',
//           schoolName: req.school?.name || 'N/A',
//           schoolAddress: req.school?.address || 'N/A',
//         })),
//       });
//     } catch (error) {
//       console.error('Error in getCertificateHistory:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   generateCertificate: async (req, res) => {
//     try {
//       const { certificateId } = req.params;
//       const { status, comments, pdfData, certificateType } = req.body;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);

//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }

//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate request not found' });
//       }

//       if (status === 'rejected') {
//         certificate.status = 'rejected';
//         certificate.comments = comments;
//         await certificate.save();
//         return res.json({ message: 'Certificate request rejected', certificate });
//       }

//       if (status !== 'generated') {
//         return res.status(400).json({ message: 'Invalid status for generation' });
//       }

//       if (!pdfData || !certificateType) {
//         return res.status(400).json({ message: 'PDF data and certificate type are required' });
//       }

//       // Convert base64 PDF data to buffer
//       const pdfBuffer = Buffer.from(pdfData, 'base64');

//       // Upload the PDF to Cloudinary
//       const cloudinaryResult = await uploadCertificateToCloudinary(pdfBuffer, certificate._id, certificateType);
//       const documentUrl = cloudinaryResult.secure_url;

//       // Update certificate with the Cloudinary URL
//       certificate.documentUrl = documentUrl;
//       certificate.status = 'generated';
//       certificate.issuedDate = new Date();
//       certificate.generatedBy = req.user._id;
//       certificate.comments = comments;
//       await certificate.save();

//       res.json({
//         message: 'Certificate generated successfully',
//         certificate,
//       });
//     } catch (error) {
//       console.error('Error in generateCertificate:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

  
 

//   uploadSignedCertificate: async (req, res) => {
//     try {
//       const { certificateId } = req.params;
//       const file = req.file;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);

//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }

//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate not found' });
//       }

//       if (certificate.status !== 'generated') {
//         return res.status(400).json({ message: 'Certificate must be generated before uploading a signed version' });
//       }

//       if (!file) {
//         return res.status(400).json({ message: 'PDF file is required' });
//       }

//       // Upload the signed PDF to Cloudinary
//       const cloudinaryResult = await uploadCertificateToCloudinary(file.buffer, `${certificate._id}_signed`, certificate.type);
//       const signedDocumentUrl = cloudinaryResult.secure_url;

//       // Update certificate with the signed document URL
//       certificate.signedDocumentUrl = signedDocumentUrl;

//       // Mark the certificate as sent to the student
//       certificate.isSentToStudent = true;
//       await certificate.save();

//       // Fetch student details for notification
//       const student = await User.findById(certificate.student).select('name email studentDetails');
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       // Send notification to student
//       const notificationResult = await sendCertificateNotification(
//         student.email,
//         student.studentDetails?.mobile,
//         student.name,
//         certificate.type,
//         certificate.signedDocumentUrl
//       );

//       res.json({
//         message: 'Signed certificate uploaded and sent to student successfully',
//         certificate,
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error in uploadSignedCertificate:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   sendCertificateToStudent: async (req, res) => {
//     try {
//       const { certificateId } = req.params;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);

//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }

//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate not found' });
//       }

//       if (!certificate.signedDocumentUrl) {
//         return res.status(400).json({ message: 'Signed certificate must be uploaded before sending to student' });
//       }

//       if (certificate.isSentToStudent) {
//         return res.status(400).json({ message: 'Certificate has already been sent to the student' });
//       }

//       // Mark the certificate as sent
//       certificate.isSentToStudent = true;
//       await certificate.save();

//       // Fetch student details for notification
//       const student = await User.findById(certificate.student).select('name email studentDetails');

//       // Send notification to student
//       const notificationResult = await sendCertificateNotification(
//         student.email,
//         student.studentDetails.mobile,
//         student.name,
//         certificate.type,
//         certificate.signedDocumentUrl
//       );

//       res.json({
//         message: 'Certificate sent to student successfully',
//         certificate,
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error in sendCertificateToStudent:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },
 

//   generateRTEReport: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { startDate, endDate } = req.body;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);

//       const rteStudents = await User.find({
//         school: schoolId,
//         'studentDetails.isRTE': true, // Adjusted to studentDetails
//         'studentDetails.admissionDate': {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate),
//         },
//       }).lean();

//       const report = {
//         totalRTEStudents: rteStudents.length,
//         admissionsByClass: {},
//         documentVerificationStatus: { verified: 0, pending: 0 },
//       };

//       // Placeholder: Implement detailed reporting logic
//       rteStudents.forEach(student => {
//         const classId = student.studentDetails.class.toString();
//         report.admissionsByClass[classId] = (report.admissionsByClass[classId] || 0) + 1;
//         report.documentVerificationStatus[student.studentDetails.status === 'verified' ? 'verified' : 'pending']++;
//       });

//       res.json({ report });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   registerExistingStudent: async (req, res) => {
//     try {
//       const {
//         name,
//         email,
//         dob,
//         gender,
//         mobile,
//         parentName,
//         parentEmail,
//         parentMobile,
//         parentOccupation,
//         address, // Expected as an object { street, city, state, pincode }
//         grNumber,
//         classId,
//         admissionType = 'Regular', // Default to Regular if not provided
//         password,
//       } = req.body;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
//       const School = require('../models/School')(require('../config/database').getOwnerConnection());

//       // Input validation
//       if (!name || !email || !dob || !gender || !mobile || !grNumber || !classId || !password) {
//         return res.status(400).json({ message: 'All required fields must be provided' });
//       }

//       // Validate email format
//       const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
//       if (!emailRegex.test(email)) {
//         return res.status(400).json({ message: 'Invalid email format' });
//       }

//       // Validate mobile number
//       const mobileRegex = /^[0-9]{10}$/;
//       if (!mobileRegex.test(mobile) || (parentMobile && !mobileRegex.test(parentMobile))) {
//         return res.status(400).json({ message: 'Mobile number must be 10 digits' });
//       }

//       // Check if GR number already exists
//       const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (existingGR) {
//         return res.status(400).json({ message: 'GR number already exists' });
//       }

//       // Check if email already exists
//       const existingEmail = await User.findOne({ email, school: schoolId });
//       if (existingEmail) {
//         return res.status(400).json({ message: 'Email already registered' });
//       }

//       // Validate class
//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       if (selectedClass.students.length >= selectedClass.capacity) {
//         return res.status(400).json({ message: 'Class is at full capacity' });
//       }

//       // Fetch school name
//       const school = await School.findById(schoolId).select('name');
//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       // Hash password
//       const hashedPassword = await bcrypt.hash(password, 10);

//       // Create new student
//       const student = new User({
//         school: schoolId,
//         name,
//         email,
//         password: hashedPassword,
//         role: 'student',
//         status: 'active',
//         studentDetails: {
//           grNumber,
//           class: classId,
//           admissionType,
//           parentDetails: {
//             name: parentName,
//             email: parentEmail,
//             mobile: parentMobile,
//             occupation: parentOccupation,
//             address: address || {}, // Default to empty object if not provided
//           },
//           dob: new Date(dob),
//           gender,
//         },
//       });

//       // Save student to database
//       await student.save();

//       // Update class with student ID
//       await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

//       // Prepare class name
//       const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

//       // Send notification
//       const notificationResult = await sendAdmissionNotification(
//         student.email,
//         mobile,
//         student.name,
//         password,
//         school.name,
//         className,
//         grNumber
//       );

//       if (!notificationResult.emailSent || !notificationResult.smsSent) {
//         console.warn('Notification partially failed:', notificationResult.error);
//       }

//       res.status(201).json({
//         message: 'Existing student registered successfully',
//         studentDetails: {
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber,
//           class: { name: selectedClass.name, division: selectedClass.division },
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error registering existing student:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// const sendCertificateNotification = async (email, mobile, studentName, certificateType, documentUrl) => {
//   // Implement email and SMS notification logic here
//   return {
//     emailSent: true,
//     smsSent: true,
//     error: null,
//   };
// };

// // Placeholder helper functions (implement as needed)
// const getFeeAmount = (type, classId) => 1000; // Placeholder
// const getFeeDueDate = (type) => new Date(); // Placeholder

// module.exports = {clerkController,upload,};



//AWS First change

// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const { sendAdmissionNotification } = require('../utils/notifications');
// const PDFDocument = require('pdfkit');
// const { uploadToS3, deleteFromS3, getPresignedUrl } = require('../config/s3Upload'); // Import S3 utilities
// const multer = require('multer');

// // Configure multer for temporary file storage
// const storage = multer.memoryStorage();
// const upload = multer({ storage: storage });

// const clerkController = {
//   getDashboard: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const clerkId = req.user._id.toString();
//       const connection = req.connection;

//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
//       const Leave = require('../models/Leave')(connection);

//       const today = new Date('2025-03-21');
//       const startOfDay = new Date(today.setHours(0, 0, 0, 0));
//       const endOfDay = new Date(today.setHours(23, 59, 59, 999));

//       const pendingVerifications = await AdmissionApplication.countDocuments({
//         school: schoolId,
//         $or: [
//           {
//             status: { $in: ['pending', 'document_verification'] },
//             'clerkVerification.status': 'pending',
//           },
//           {
//             status: 'approved',
//             'feesVerification.status': 'verified',
//             'clerkVerification.status': 'verified',
//           },
//         ],
//       });

//       const pendingCertificates = await Certificate.countDocuments({
//         school: schoolId,
//         status: 'pending',
//       });

//       const enrolledToday = await User.countDocuments({
//         school: schoolId,
//         role: 'student',
//         createdAt: { $gte: startOfDay, $lte: endOfDay },
//       });

//       const totalLeaves = await Leave.countDocuments({
//         school: schoolId,
//         user: clerkId,
//       });

//       const leaveSummary = await Leave.aggregate([
//         {
//           $match: {
//             school: new mongoose.Types.ObjectId(schoolId),
//             user: new mongoose.Types.ObjectId(clerkId),
//           },
//         },
//         {
//           $group: {
//             _id: '$status',
//             count: { $sum: 1 },
//           },
//         },
//         {
//           $project: {
//             status: '$_id',
//             count: 1,
//             _id: 0,
//           },
//         },
//       ]);

//       const leaveStatus = {
//         pending: 0,
//         approved: 0,
//         rejected: 0,
//         total: 0,
//       };

//       leaveSummary.forEach((item) => {
//         if (item.status in leaveStatus) {
//           leaveStatus[item.status] = item.count;
//         }
//       });
//       leaveStatus.total = leaveStatus.pending + leaveStatus.approved + leaveStatus.rejected;

//       const rteStudents = await User.countDocuments({
//         school: schoolId,
//         'studentDetails.isRTE': true,
//         'studentDetails.admissionDate': {
//           $gte: new Date('2025-01-01'),
//           $lte: new Date('2025-12-31'),
//         },
//       });

//       const totalStudents = await User.countDocuments({
//         school: schoolId,
//         role: 'student',
//       });

//       const dashboardData = {
//         status: 'success',
//         timestamp: new Date(),
//         pendingVerifications,
//         pendingCertificates,
//         enrolledToday,
//         totalStudents,
//         leaveStatus,
//         rteStudents,
//         debug: { totalLeaves },
//       };

//       res.json(dashboardData);
//     } catch (error) {
//       console.error('Error in getDashboard:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

  

//   getPendingVerifications: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);
  
//       const applications = await AdmissionApplication.find({
//         school: schoolId,
//         $or: [
//           {
//             status: { $in: ['pending', 'document_verification'] },
//             'clerkVerification.status': 'pending',
//           },
//           {
//             status: 'approved',
//             'feesVerification.status': 'verified',
//             'clerkVerification.status': 'verified',
//           },
//         ],
//       }).sort({ createdAt: -1 });
  
//       const applicationsWithPresignedUrls = await Promise.all(
//         applications.map(async (app) => {
//           const documentsWithPresignedUrls = await Promise.all(
//             app.documents.map(async (doc) => ({
//               type: doc.type,
//               documentUrl: doc.documentUrl,
//               key: doc.key,
//               presignedUrl: doc.key ? await getPresignedUrl(doc.key) : null, // Fallback to null if key is missing
//               verified: doc.verified,
//             }))
//           );
//           return {
//             id: app._id,
//             trackingId: app.trackingId,
//             studentDetails: {
//               name: app.studentDetails.name,
//               dob: app.studentDetails.dob,
//               gender: app.studentDetails.gender,
//               email: app.studentDetails.email,
//               mobile: app.studentDetails.mobile,
//               appliedClass: app.studentDetails.appliedClass,
//             },
//             parentDetails: {
//               name: app.parentDetails.name,
//               email: app.parentDetails.email,
//               mobile: app.parentDetails.mobile,
//               occupation: app.parentDetails.occupation,
//               address: {
//                 street: app.parentDetails.address.street,
//                 city: app.parentDetails.address.city,
//                 state: app.parentDetails.address.state,
//                 pincode: app.parentDetails.address.pincode,
//               },
//             },
//             admissionType: app.admissionType,
//             status: app.status,
//             submittedOn: app.createdAt,
//             documents: documentsWithPresignedUrls,
//             additionalResponses: app.additionalResponses ? Object.fromEntries(app.additionalResponses) : {},
//             clerkVerification: {
//               status: app.clerkVerification.status,
//               comments: app.clerkVerification.comments,
//             },
//             feesVerification: {
//               status: app.feesVerification.status,
//               receiptNumber: app.feesVerification.receiptNumber,
//               verifiedAt: app.feesVerification.verifiedAt,
//             },
//           };
//         })
//       );
  
//       res.json({
//         status: 'success',
//         count: applications.length,
//         applications: applicationsWithPresignedUrls,
//       });
//     } catch (error) {
//       console.error('Error in getPendingVerifications:', error);
//       res.status(500).json({
//         status: 'error',
//         error: error.message,
//       });
//     }
//   },

//   clerkVerification: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { status, comments } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);

//       const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       const hasAllDocuments = application.validateDocuments();
//       if (!hasAllDocuments) {
//         return res.status(400).json({ message: 'Missing required documents' });
//       }

//       application.clerkVerification = {
//         status,
//         verifiedBy: req.user._id,
//         verifiedAt: new Date(),
//         comments,
//       };

//       if (status === 'verified') {
//         application.status = 'fees_pending';
//       } else {
//         application.status = 'rejected';
//       }

//       await application.save();

//       res.json({
//         message: 'Verification completed',
//         nextStep: status === 'verified' ? 'Visit fees department for verification' : 'Application rejected',
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   verifyDocuments: async (req, res) => {
//     try {
//       const { studentId } = req.params;
//       const { verifiedDocuments } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);

//       const student = await User.findOne({ _id: studentId, school: schoolId });
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       student.studentDetails.status = 'verified';
//       await student.save();

//       res.json({ message: 'Documents verified successfully' });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   viewApplicationDocuments: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);

//       if (!mongoose.Types.ObjectId.isValid(applicationId)) {
//         return res.status(400).json({ message: 'Invalid application ID' });
//       }

//       const application = await AdmissionApplication.findOne({
//         _id: applicationId,
//         school: schoolId,
//       });

//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (req.user.role !== 'clerk') {
//         return res.status(403).json({ message: 'Unauthorized access' });
//       }

//       const documents = await Promise.all(
//         application.documents.map(async (doc) => ({
//           type: doc.type,
//           documentUrl: doc.documentUrl,
//           key: doc.key,
//           presignedUrl: await getPresignedUrl(doc.key),
//           verified: doc.verified,
//           uploadedAt: application.createdAt,
//         }))
//       );

//       res.json({
//         status: 'success',
//         applicationId: application._id,
//         trackingId: application.trackingId,
//         studentName: application.studentDetails.name,
//         admissionType: application.admissionType,
//         documentCount: documents.length,
//         documents,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAvailableClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       const allClasses = await Class.find({ school: schoolId })
//         .select('name division academicYear capacity students classTeacher')
//         .populate('classTeacher', 'name', User)
//         .sort({ name: 1, division: 1 });

//       res.json({
//         classes: allClasses.map((cls) => ({
//           _id: cls._id,
//           name: cls.name,
//           division: cls.division,
//           academicYear: cls.academicYear,
//           teacher: cls.classTeacher ? cls.classTeacher.name : null,
//           enrolledCount: cls.students ? cls.students.length : 0,
//           capacity: cls.capacity,
//           remainingCapacity: cls.capacity - (cls.students ? cls.students.length : 0),
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   enrollStudent: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { classId, grNumber, password } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const AdmissionApplication = require('../models/AdmissionApplication')(connection);
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);
//       const School = require('../models/School')(require('../config/database').getOwnerConnection());

//       if (!password) {
//         return res.status(400).json({ message: 'Password is required' });
//       }

//       const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (application.status !== 'approved') {
//         return res.status(400).json({ message: 'Only approved applications can be enrolled' });
//       }

//       const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (existingGR) {
//         return res.status(400).json({ message: 'GR number already exists' });
//       }

//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       if (selectedClass.students.length >= selectedClass.capacity) {
//         return res.status(400).json({ message: 'Class is at full capacity' });
//       }

//       const school = await School.findById(schoolId).select('name');
//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);

//       const student = new User({
//         school: schoolId,
//         name: application.studentDetails.name,
//         email: application.studentDetails.email,
//         password: hashedPassword,
//         role: 'student',
//         status: 'active',
//         studentDetails: {
//           grNumber,
//           class: classId,
//           admissionType: application.admissionType,
//           parentDetails: application.parentDetails,
//           dob: application.studentDetails.dob,
//           gender: application.studentDetails.gender,
//         },
//       });

//       await student.save();

//       await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

//       application.status = 'enrolled';
//       application.grNumber = grNumber;
//       application.assignedClass = classId;
//       await application.save();

//       const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

//       const notificationResult = await sendAdmissionNotification(
//         student.email,
//         application.studentDetails.mobile,
//         student.name,
//         password,
//         school.name,
//         className
//       );

//       if (!notificationResult.emailSent || !notificationResult.smsSent) {
//         console.warn('Notification partially failed:', notificationResult.error);
//       }

//       res.json({
//         message: 'Student enrolled successfully',
//         studentDetails: {
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber,
//           class: { name: selectedClass.name, division: selectedClass.division },
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       if (!mongoose.Types.ObjectId.isValid(classId)) {
//         return res.status(400).json({ message: 'Invalid class ID' });
//       }

//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       const students = await User.find({
//         school: schoolId,
//         'studentDetails.class': classId,
//         role: 'student',
//       })
//         .select('name email studentDetails')
//         .lean();

//       res.json({
//         status: 'success',
//         class: {
//           name: selectedClass.name,
//           division: selectedClass.division,
//           academicYear: selectedClass.academicYear,
//           capacity: selectedClass.capacity,
//           enrolledCount: selectedClass.students.length,
//         },
//         count: students.length,
//         students: students.map((student) => ({
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber: student.studentDetails.grNumber,
//           admissionType: student.studentDetails.admissionType,
//           dob: student.studentDetails.dob,
//           gender: student.studentDetails.gender,
//           parentDetails: student.studentDetails.parentDetails,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   requestLeave: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { reason, startDate, endDate, type } = req.body;
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leave = new Leave({
//         school: schoolId,
//         user: clerkId,
//         reason,
//         startDate,
//         endDate,
//         type,
//         status: 'pending',
//         appliedOn: new Date(),
//       });

//       await leave.save();
//       res.status(201).json(leave);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getLeaveStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const clerkId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leaves = await Leave.find({ school: schoolId, user: clerkId })
//         .sort({ appliedOn: -1 })
//         .lean();

//       res.json({
//         status: 'success',
//         count: leaves.length,
//         leaves: leaves.map((leave) => ({
//           id: leave._id,
//           reason: leave.reason,
//           startDate: leave.startDate,
//           endDate: leave.endDate,
//           type: leave.type,
//           status: leave.status,
//           appliedOn: leave.appliedOn,
//           reviewedBy: leave.reviewedBy,
//           reviewedAt: leave.reviewedAt,
//           comments: leave.comments,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getPendingCertificates: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const certificates = await Certificate.find({
//         school: schoolId,
//         status: 'pending',
//       })
//         .populate({
//           path: 'student',
//           select: 'name email studentDetails',
//           populate: {
//             path: 'studentDetails.class',
//             model: Class,
//             select: 'name division',
//           },
//         })
//         .populate('generatedBy', 'name email', User)
//         .sort({ requestDate: -1 });

//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificates.map((cert) => ({
//           id: cert._id,
//           studentName: cert.student?.name || 'N/A',
//           studentEmail: cert.student?.email || 'N/A',
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
//           parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
//           admissionDate: cert.student?.studentDetails?.admissionDate
//             ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
//             : 'N/A',
//           dob: cert.student?.studentDetails?.dob
//             ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
//             : 'N/A',
//           className: cert.student?.studentDetails?.class
//             ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
//             : 'N/A',
//           schoolName: req.school?.name || 'N/A',
//           schoolAddress: req.school?.address || 'N/A',
//         })),
//       });
//     } catch (error) {
//       console.error('Error in getPendingCertificates:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // getCertificateHistory: async (req, res) => {
//   //   try {
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Certificate = require('../models/Certificate')(connection);
//   //     const User = require('../models/User')(connection);
//   //     const Class = require('../models/Class')(connection);

//   //     const certificates = await Certificate.find({ school: schoolId })
//   //       .populate({
//   //         path: 'student',
//   //         select: 'name email studentDetails',
//   //         populate: {
//   //           path: 'studentDetails.class',
//   //           model: Class,
//   //           select: 'name division',
//   //         },
//   //       })
//   //       .populate('generatedBy', 'name email', User)
//   //       .sort({ requestDate: -1 });

//   //     const certificatesWithPresignedUrls = await Promise.all(
//   //       certificates.map(async (cert) => ({
//   //         id: cert._id,
//   //         studentName: cert.student?.name || 'N/A',
//   //         studentEmail: cert.student?.email || 'N/A',
//   //         type: cert.type,
//   //         purpose: cert.purpose,
//   //         urgency: cert.urgency,
//   //         requestDate: cert.requestDate,
//   //         status: cert.status,
//   //         documentUrl: cert.documentUrl,
//   //         signedDocumentUrl: cert.signedDocumentUrl,
//   //         documentPresignedUrl: cert.documentUrl ? await getPresignedUrl(cert.documentKey) : null,
//   //         signedDocumentPresignedUrl: cert.signedDocumentUrl ? await getPresignedUrl(cert.signedDocumentKey) : null,
//   //         isSentToStudent: cert.isSentToStudent,
//   //         issuedDate: cert.issuedDate || null,
//   //         generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//   //         comments: cert.comments || null,
//   //         grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
//   //         parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
//   //         admissionDate: cert.student?.studentDetails?.admissionDate
//   //           ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
//   //           : 'N/A',
//   //         dob: cert.student?.studentDetails?.dob
//   //           ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
//   //           : 'N/A',
//   //         className: cert.student?.studentDetails?.class
//   //           ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
//   //           : 'N/A',
//   //         schoolName: req.school?.name || 'N/A',
//   //         schoolAddress: req.school?.address || 'N/A',
//   //       }))
//   //     );

//   //     res.json({
//   //       status: 'success',
//   //       count: certificates.length,
//   //       certificates: certificatesWithPresignedUrls,
//   //     });
//   //   } catch (error) {
//   //     console.error('Error in getCertificateHistory:', error);
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   getCertificateHistory: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
  
//       const certificates = await Certificate.find({ school: schoolId })
//         .populate({
//           path: 'student',
//           select: 'name email studentDetails',
//           populate: {
//             path: 'studentDetails.class',
//             model: Class,
//             select: 'name division',
//           },
//         })
//         .populate('generatedBy', 'name email', User)
//         .sort({ requestDate: -1 });
  
//       const certificatesWithPresignedUrls = await Promise.all(
//         certificates.map(async (cert) => ({
//           id: cert._id,
//           studentName: cert.student?.name || 'N/A',
//           studentEmail: cert.student?.email || 'N/A',
//           type: cert.type,
//           purpose: cert.purpose,
//           urgency: cert.urgency,
//           requestDate: cert.requestDate,
//           status: cert.status,
//           documentUrl: cert.documentUrl,
//           signedDocumentUrl: cert.signedDocumentUrl,
//           documentPresignedUrl: cert.documentKey ? await getPresignedUrl(cert.documentKey) : null, // Check documentKey
//           signedDocumentPresignedUrl: cert.signedDocumentKey ? await getPresignedUrl(cert.signedDocumentKey) : null, // Check signedDocumentKey
//           isSentToStudent: cert.isSentToStudent,
//           issuedDate: cert.issuedDate || null,
//           generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
//           comments: cert.comments || null,
//           grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
//           parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
//           admissionDate: cert.student?.studentDetails?.admissionDate
//             ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
//             : 'N/A',
//           dob: cert.student?.studentDetails?.dob
//             ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
//             : 'N/A',
//           className: cert.student?.studentDetails?.class
//             ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
//             : 'N/A',
//           schoolName: req.school?.name || 'N/A',
//           schoolAddress: req.school?.address || 'N/A',
//         }))
//       );
  
//       res.json({
//         status: 'success',
//         count: certificates.length,
//         certificates: certificatesWithPresignedUrls,
//       });
//     } catch (error) {
//       console.error('Error in getCertificateHistory:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // generateCertificate: async (req, res) => {
//   //   try {
//   //     const { certificateId } = req.params;
//   //     const { status, comments, pdfData, certificateType } = req.body;

//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Certificate = require('../models/Certificate')(connection);
//   //     const User = require('../models/User')(connection);

//   //     if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//   //       return res.status(400).json({ message: 'Invalid certificate ID' });
//   //     }

//   //     const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//   //     if (!certificate) {
//   //       return res.status(404).json({ message: 'Certificate request not found' });
//   //     }

//   //     if (status === 'rejected') {
//   //       certificate.status = 'rejected';
//   //       certificate.comments = comments;
//   //       await certificate.save();
//   //       return res.json({ message: 'Certificate request rejected', certificate });
//   //     }

//   //     if (status !== 'generated') {
//   //       return res.status(400).json({ message: 'Invalid status for generation' });
//   //     }

//   //     if (!pdfData || !certificateType) {
//   //       return res.status(400).json({ message: 'PDF data and certificate type are required' });
//   //     }

//   //     const pdfBuffer = Buffer.from(pdfData, 'base64');
//   //     const certificateKey = `certificates/${schoolId}/${certificateId}/${certificateType}.pdf`;
//   //     const uploadResult = await uploadToS3(pdfBuffer, certificateKey);
//   //     const documentUrl = uploadResult.Location;
//   //     const presignedUrl = await getPresignedUrl(certificateKey);

//   //     certificate.documentUrl = documentUrl;
//   //     certificate.documentKey = certificateKey; // Store the S3 key
//   //     certificate.status = 'generated';
//   //     certificate.issuedDate = new Date();
//   //     certificate.generatedBy = req.user._id;
//   //     certificate.comments = comments;
//   //     await certificate.save();

//   //     res.json({
//   //       message: 'Certificate generated successfully',
//   //       certificate: {
//   //         ...certificate.toObject(),
//   //         documentPresignedUrl: presignedUrl,
//   //       },
//   //     });
//   //   } catch (error) {
//   //     console.error('Error in generateCertificate:', error);
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   generateCertificate: async (req, res) => {
//     try {
//       const { certificateId } = req.params;
//       const { status, comments, pdfData, certificateType } = req.body;
  
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
  
//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }
  
//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate request not found' });
//       }
  
//       if (status === 'rejected') {
//         certificate.status = 'rejected';
//         certificate.comments = comments;
//         await certificate.save();
//         return res.json({ message: 'Certificate request rejected', certificate });
//       }
  
//       if (status !== 'generated') {
//         return res.status(400).json({ message: 'Invalid status for generation' });
//       }
  
//       if (!pdfData || !certificateType) {
//         return res.status(400).json({ message: 'PDF data and certificate type are required' });
//       }
  
//       let pdfBuffer;
//       try {
//         pdfBuffer = Buffer.from(pdfData, 'base64');
//       } catch (error) {
//         return res.status(400).json({ message: 'Invalid base64 PDF data', error: error.message });
//       }
  
//       const certificateKey = `certificates/${schoolId}/${certificateId}/${certificateType}.pdf`;
//       let uploadResult;
//       try {
//         uploadResult = await uploadToS3(pdfBuffer, certificateKey);
//       } catch (error) {
//         return res.status(500).json({ message: 'Failed to upload to S3', error: error.message });
//       }
  
//       const documentUrl = uploadResult.Location;
//       let presignedUrl;
//       try {
//         presignedUrl = await getPresignedUrl(certificateKey);
//       } catch (error) {
//         return res.status(500).json({ message: 'Failed to generate pre-signed URL', error: error.message });
//       }
  
//       certificate.documentUrl = documentUrl;
//       certificate.documentKey = certificateKey;
//       certificate.status = 'generated';
//       certificate.issuedDate = new Date();
//       certificate.generatedBy = req.user._id;
//       certificate.comments = comments;
  
//       try {
//         await certificate.save();
//       } catch (error) {
//         await deleteFromS3(certificateKey); // Cleanup on save failure
//         return res.status(500).json({ message: 'Failed to save certificate', error: error.message });
//       }
  
//       res.json({
//         message: 'Certificate generated successfully',
//         certificate: {
//           ...certificate.toObject(),
//           documentPresignedUrl: presignedUrl,
//         },
//       });
//     } catch (error) {
//       console.error('Error in generateCertificate:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // uploadSignedCertificate: async (req, res) => {
//   //   try {
//   //     const { certificateId } = req.params;
//   //     const file = req.file;

//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Certificate = require('../models/Certificate')(connection);
//   //     const User = require('../models/User')(connection);

//   //     if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//   //       return res.status(400).json({ message: 'Invalid certificate ID' });
//   //     }

//   //     const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//   //     if (!certificate) {
//   //       return res.status(404).json({ message: 'Certificate not found' });
//   //     }

//   //     if (certificate.status !== 'generated') {
//   //       return res.status(400).json({ message: 'Certificate must be generated before uploading a signed version' });
//   //     }

//   //     if (!file) {
//   //       return res.status(400).json({ message: 'PDF file is required' });
//   //     }

//   //     const signedCertificateKey = `certificates/${schoolId}/${certificateId}/${certificate.type}_signed.pdf`;
//   //     const uploadResult = await uploadToS3(file.buffer, signedCertificateKey);
//   //     const signedDocumentUrl = uploadResult.Location;
//   //     const signedPresignedUrl = await getPresignedUrl(signedCertificateKey);

//   //     certificate.signedDocumentUrl = signedDocumentUrl;
//   //     certificate.signedDocumentKey = signedCertificateKey; // Store the S3 key
//   //     certificate.isSentToStudent = true;
//   //     await certificate.save();

//   //     const student = await User.findById(certificate.student).select('name email studentDetails');
//   //     if (!student) {
//   //       return res.status(404).json({ message: 'Student not found' });
//   //     }

//   //     const notificationResult = await sendCertificateNotification(
//   //       student.email,
//   //       student.studentDetails?.mobile,
//   //       student.name,
//   //       certificate.type,
//   //       signedPresignedUrl // Use pre-signed URL in notification
//   //     );

//   //     res.json({
//   //       message: 'Signed certificate uploaded and sent to student successfully',
//   //       certificate: {
//   //         ...certificate.toObject(),
//   //         signedDocumentPresignedUrl: signedPresignedUrl,
//   //       },
//   //       notificationStatus: {
//   //         emailSent: notificationResult.emailSent,
//   //         smsSent: notificationResult.smsSent,
//   //       },
//   //     });
//   //   } catch (error) {
//   //     console.error('Error in uploadSignedCertificate:', error);
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   uploadSignedCertificate: async (req, res) => {
//     try {
//       const { certificateId } = req.params;
//       const file = req.file;
  
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);
  
//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }
  
//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate not found' });
//       }
  
//       if (certificate.status !== 'generated') {
//         return res.status(400).json({ message: 'Certificate must be generated before uploading a signed version' });
//       }
  
//       if (!file) {
//         return res.status(400).json({ message: 'PDF file is required' });
//       }
  
//       // File is already uploaded to S3 by multer-s3, use req.file.key
//       const signedCertificateKey = file.key;
//       const signedDocumentUrl = file.location; // S3 URL
//       const signedPresignedUrl = await getPresignedUrl(signedCertificateKey);
  
//       certificate.signedDocumentUrl = signedDocumentUrl;
//       certificate.signedDocumentKey = signedCertificateKey;
//       certificate.isSentToStudent = true;
//       await certificate.save();
  
//       const student = await User.findById(certificate.student).select('name email studentDetails');
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }
  
//       const notificationResult = await sendCertificateNotification(
//         student.email,
//         student.studentDetails?.mobile,
//         student.name,
//         certificate.type,
//         signedPresignedUrl
//       );
  
//       res.json({
//         message: 'Signed certificate uploaded and sent to student successfully',
//         certificate: {
//           ...certificate.toObject(),
//           signedDocumentPresignedUrl: signedPresignedUrl,
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error in uploadSignedCertificate:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   sendCertificateToStudent: async (req, res) => {
//     try {
//       const { certificateId } = req.params;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Certificate = require('../models/Certificate')(connection);
//       const User = require('../models/User')(connection);

//       if (!mongoose.Types.ObjectId.isValid(certificateId)) {
//         return res.status(400).json({ message: 'Invalid certificate ID' });
//       }

//       const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
//       if (!certificate) {
//         return res.status(404).json({ message: 'Certificate not found' });
//       }

//       if (!certificate.signedDocumentUrl) {
//         return res.status(400).json({ message: 'Signed certificate must be uploaded before sending to student' });
//       }

//       if (certificate.isSentToStudent) {
//         return res.status(400).json({ message: 'Certificate has already been sent to the student' });
//       }

//       certificate.isSentToStudent = true;
//       await certificate.save();

//       const student = await User.findById(certificate.student).select('name email studentDetails');
//       const signedPresignedUrl = await getPresignedUrl(certificate.signedDocumentKey);

//       const notificationResult = await sendCertificateNotification(
//         student.email,
//         student.studentDetails.mobile,
//         student.name,
//         certificate.type,
//         signedPresignedUrl
//       );

//       res.json({
//         message: 'Certificate sent to student successfully',
//         certificate: {
//           ...certificate.toObject(),
//           signedDocumentPresignedUrl: signedPresignedUrl,
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error in sendCertificateToStudent:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   generateRTEReport: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { startDate, endDate } = req.body;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);

//       const rteStudents = await User.find({
//         school: schoolId,
//         'studentDetails.isRTE': true,
//         'studentDetails.admissionDate': {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate),
//         },
//       }).lean();

//       const report = {
//         totalRTEStudents: rteStudents.length,
//         admissionsByClass: {},
//         documentVerificationStatus: { verified: 0, pending: 0 },
//       };

//       rteStudents.forEach((student) => {
//         const classId = student.studentDetails.class.toString();
//         report.admissionsByClass[classId] = (report.admissionsByClass[classId] || 0) + 1;
//         report.documentVerificationStatus[student.studentDetails.status === 'verified' ? 'verified' : 'pending']++;
//       });

//       res.json({ report });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   registerExistingStudent: async (req, res) => {
//     try {
//       const {
//         name,
//         email,
//         dob,
//         gender,
//         mobile,
//         parentName,
//         parentEmail,
//         parentMobile,
//         parentOccupation,
//         address,
//         grNumber,
//         classId,
//         admissionType = 'Regular',
//         password,
//       } = req.body;

//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
//       const School = require('../models/School')(require('../config/database').getOwnerConnection());

//       if (!name || !email || !dob || !gender || !mobile || !grNumber || !classId || !password) {
//         return res.status(400).json({ message: 'All required fields must be provided' });
//       }

//       const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
//       if (!emailRegex.test(email)) {
//         return res.status(400).json({ message: 'Invalid email format' });
//       }

//       const mobileRegex = /^[0-9]{10}$/;
//       if (!mobileRegex.test(mobile) || (parentMobile && !mobileRegex.test(parentMobile))) {
//         return res.status(400).json({ message: 'Mobile number must be 10 digits' });
//       }

//       const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
//       if (existingGR) {
//         return res.status(400).json({ message: 'GR number already exists' });
//       }

//       const existingEmail = await User.findOne({ email, school: schoolId });
//       if (existingEmail) {
//         return res.status(400).json({ message: 'Email already registered' });
//       }

//       const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
//       if (!selectedClass) {
//         return res.status(404).json({ message: 'Class not found' });
//       }

//       if (selectedClass.students.length >= selectedClass.capacity) {
//         return res.status(400).json({ message: 'Class is at full capacity' });
//       }

//       const school = await School.findById(schoolId).select('name');
//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       const hashedPassword = await bcrypt.hash(password, 10);

//       const student = new User({
//         school: schoolId,
//         name,
//         email,
//         password: hashedPassword,
//         role: 'student',
//         status: 'active',
//         studentDetails: {
//           grNumber,
//           class: classId,
//           admissionType,
//           parentDetails: {
//             name: parentName,
//             email: parentEmail,
//             mobile: parentMobile,
//             occupation: parentOccupation,
//             address: address || {},
//           },
//           dob: new Date(dob),
//           gender,
//         },
//       });

//       await student.save();

//       await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

//       const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

//       const notificationResult = await sendAdmissionNotification(
//         student.email,
//         mobile,
//         student.name,
//         password,
//         school.name,
//         className,
//         grNumber
//       );

//       if (!notificationResult.emailSent || !notificationResult.smsSent) {
//         console.warn('Notification partially failed:', notificationResult.error);
//       }

//       res.status(201).json({
//         message: 'Existing student registered successfully',
//         studentDetails: {
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber,
//           class: { name: selectedClass.name, division: selectedClass.division },
//         },
//         notificationStatus: {
//           emailSent: notificationResult.emailSent,
//           smsSent: notificationResult.smsSent,
//         },
//       });
//     } catch (error) {
//       console.error('Error registering existing student:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// const sendCertificateNotification = async (email, mobile, studentName, certificateType, documentUrl) => {
//   // Implement email and SMS notification logic here
//   return {
//     emailSent: true,
//     smsSent: true,
//     error: null,
//   };
// };

// module.exports = { clerkController, upload };





//AWS Second chnage

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { sendAdmissionNotification } = require('../utils/notifications');
const { uploadToS3, deleteFromS3, streamS3Object } = require('../config/s3Upload');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const clerkController = {
  getDashboard: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const clerkId = req.user._id.toString();
      const connection = req.connection;

      const AdmissionApplication = require('../models/AdmissionApplication')(connection);
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);
      const Leave = require('../models/Leave')(connection);

      const today = new Date('2025-03-21');
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      const pendingVerifications = await AdmissionApplication.countDocuments({
        school: schoolId,
        $or: [
          {
            status: { $in: ['pending', 'document_verification'] },
            'clerkVerification.status': 'pending',
          },
          {
            status: 'approved',
            'feesVerification.status': 'verified',
            'clerkVerification.status': 'verified',
          },
        ],
      });

      const pendingCertificates = await Certificate.countDocuments({
        school: schoolId,
        status: 'pending',
      });

      const enrolledToday = await User.countDocuments({
        school: schoolId,
        role: 'student',
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
            _id: '$status',
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            status: '$_id',
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
      leaveStatus.total = leaveStatus.pending + leaveStatus.approved + leaveStatus.rejected;

      const rteStudents = await User.countDocuments({
        school: schoolId,
        'studentDetails.isRTE': true,
        'studentDetails.admissionDate': {
          $gte: new Date('2025-01-01'),
          $lte: new Date('2025-12-31'),
        },
      });

      const totalStudents = await User.countDocuments({
        school: schoolId,
        role: 'student',
      });

      const dashboardData = {
        status: 'success',
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
      console.error('Error in getDashboard:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getPendingVerifications: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      const applications = await AdmissionApplication.find({
        school: schoolId,
        $or: [
          {
            status: { $in: ['pending', 'document_verification'] },
            'clerkVerification.status': 'pending',
          },
          {
            status: 'approved',
            'feesVerification.status': 'verified',
            'clerkVerification.status': 'verified',
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
        documents: app.documents.map((doc) => ({
          type: doc.type,
          documentUrl: doc.documentUrl,
          key: doc.key,
          accessUrl: `/documents/${app._id}/${doc.key.split('/').pop()}`, // Permanent URL
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
        },
      }));

      res.json({
        status: 'success',
        count: applications.length,
        applications: applicationsWithUrls,
      });
    } catch (error) {
      console.error('Error in getPendingVerifications:', error);
      res.status(500).json({
        status: 'error',
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
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      const application = await AdmissionApplication.findOne({ _id: applicationId, school: schoolId });
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

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
        application.status = 'fees_pending';
      } else {
        application.status = 'rejected';
      }

      await application.save();

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
      const { studentId } = req.params;
      const { verifiedDocuments } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);

      const student = await User.findOne({ _id: studentId, school: schoolId });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      student.studentDetails.status = 'verified';
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

      if (req.user.role !== 'clerk') {
        return res.status(403).json({ message: 'Unauthorized access' });
      }

      const documents = application.documents.map((doc) => ({
        type: doc.type,
        documentUrl: doc.documentUrl,
        key: doc.key,
        accessUrl: `/documents/${applicationId}/${doc.key.split('/').pop()}`, // Permanent URL
        verified: doc.verified,
        uploadedAt: application.createdAt,
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

  streamDocument: async (req, res) => {
    try {
      const { applicationId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require('../models/AdmissionApplication')(connection);

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      });

      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      const document = application.documents.find((doc) => doc.key.endsWith(documentKey));
      if (!document) {
        return res.status(404).json({ message: 'Document not found' });
      }

      await streamS3Object(document.key, res);
    } catch (error) {
      console.error('Error streaming document:', error);
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
        classes: allClasses.map((cls) => ({
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
      const School = require('../models/School')(require('../config/database').getOwnerConnection());

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

      const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

      const notificationResult = await sendAdmissionNotification(
        student.email,
        application.studentDetails.mobile,
        student.name,
        password,
        school.name,
        className
      );

      if (!notificationResult.emailSent || !notificationResult.smsSent) {
        console.warn('Notification partially failed:', notificationResult.error);
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

      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: 'Invalid class ID' });
      }

      const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
      if (!selectedClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

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
        students: students.map((student) => ({
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
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const certificates = await Certificate.find({
        school: schoolId,
        status: 'pending',
      })
        .populate({
          path: 'student',
          select: 'name email studentDetails',
          populate: {
            path: 'studentDetails.class',
            model: Class,
            select: 'name division',
          },
        })
        .populate('generatedBy', 'name email', User)
        .sort({ requestDate: -1 });

      res.json({
        status: 'success',
        count: certificates.length,
        certificates: certificates.map((cert) => ({
          id: cert._id,
          studentName: cert.student?.name || 'N/A',
          studentEmail: cert.student?.email || 'N/A',
          type: cert.type,
          purpose: cert.purpose,
          urgency: cert.urgency,
          requestDate: cert.requestDate,
          status: cert.status,
          grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
          parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
          admissionDate: cert.student?.studentDetails?.admissionDate
            ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
            : 'N/A',
          dob: cert.student?.studentDetails?.dob
            ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
            : 'N/A',
          className: cert.student?.studentDetails?.class
            ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
            : 'N/A',
          schoolName: req.school?.name || 'N/A',
          schoolAddress: req.school?.address || 'N/A',
        })),
      });
    } catch (error) {
      console.error('Error in getPendingCertificates:', error);
      res.status(500).json({ error: error.message });
    }
  },

  getCertificateHistory: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const certificates = await Certificate.find({ school: schoolId })
        .populate({
          path: 'student',
          select: 'name email studentDetails',
          populate: {
            path: 'studentDetails.class',
            model: Class,
            select: 'name division',
          },
        })
        .populate('generatedBy', 'name email', User)
        .sort({ requestDate: -1 });

      const certificatesWithUrls = certificates.map((cert) => ({
        id: cert._id,
        studentName: cert.student?.name || 'N/A',
        studentEmail: cert.student?.email || 'N/A',
        type: cert.type,
        purpose: cert.purpose,
        urgency: cert.urgency,
        requestDate: cert.requestDate,
        status: cert.status,
        documentUrl: cert.documentUrl,
        signedDocumentUrl: cert.signedDocumentUrl,
        documentAccessUrl: cert.documentKey ? `/certificates/${cert._id}/${cert.documentKey.split('/').pop()}` : null,
        signedDocumentAccessUrl: cert.signedDocumentKey ? `/certificates/${cert._id}/${cert.signedDocumentKey.split('/').pop()}` : null,
        isSentToStudent: cert.isSentToStudent,
        issuedDate: cert.issuedDate || null,
        generatedBy: cert.generatedBy ? cert.generatedBy.name : null,
        comments: cert.comments || null,
        grNumber: cert.student?.studentDetails?.grNumber || 'N/A',
        parentName: cert.student?.studentDetails?.parentDetails?.name || 'N/A',
        admissionDate: cert.student?.studentDetails?.admissionDate
          ? new Date(cert.student.studentDetails.admissionDate).toISOString().split('T')[0]
          : 'N/A',
        dob: cert.student?.studentDetails?.dob
          ? new Date(cert.student.studentDetails.dob).toISOString().split('T')[0]
          : 'N/A',
        className: cert.student?.studentDetails?.class
          ? `${cert.student.studentDetails.class.name}${cert.student.studentDetails.class.division ? ' ' + cert.student.studentDetails.class.division : ''}`
          : 'N/A',
        schoolName: req.school?.name || 'N/A',
        schoolAddress: req.school?.address || 'N/A',
      }));

      res.json({
        status: 'success',
        count: certificates.length,
        certificates: certificatesWithUrls,
      });
    } catch (error) {
      console.error('Error in getCertificateHistory:', error);
      res.status(500).json({ error: error.message });
    }
  },

  generateCertificate: async (req, res) => {
    try {
      const { certificateId } = req.params;
      const { status, comments, pdfData, certificateType } = req.body;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);

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

      if (!pdfData || !certificateType) {
        return res.status(400).json({ message: 'PDF data and certificate type are required' });
      }

      let pdfBuffer;
      try {
        pdfBuffer = Buffer.from(pdfData, 'base64');
      } catch (error) {
        return res.status(400).json({ message: 'Invalid base64 PDF data', error: error.message });
      }

      const certificateKey = `certificates/${schoolId}/${certificateId}/${certificateType}.pdf`;
      let uploadResult;
      try {
        uploadResult = await uploadToS3(pdfBuffer, certificateKey);
      } catch (error) {
        return res.status(500).json({ message: 'Failed to upload to S3', error: error.message });
      }

      certificate.documentUrl = uploadResult.Location;
      certificate.documentKey = certificateKey;
      certificate.status = 'generated';
      certificate.issuedDate = new Date();
      certificate.generatedBy = req.user._id;
      certificate.comments = comments;

      await certificate.save();

      res.json({
        message: 'Certificate generated successfully',
        certificate: {
          ...certificate.toObject(),
          documentAccessUrl: `/certificates/${certificateId}/${certificateKey.split('/').pop()}`,
        },
      });
    } catch (error) {
      console.error('Error in generateCertificate:', error);
      res.status(500).json({ error: error.message });
    }
  },

  streamCertificate: async (req, res) => {
    try {
      const { certificateId, documentKey } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);

      const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      const key = certificate.documentKey.endsWith(documentKey) ? certificate.documentKey : certificate.signedDocumentKey;
      if (!key || !key.endsWith(documentKey)) {
        return res.status(404).json({ message: 'Document not found' });
      }

      await streamS3Object(key, res);
    } catch (error) {
      console.error('Error streaming certificate:', error);
      res.status(500).json({ error: error.message });
    }
  },

  uploadSignedCertificate: async (req, res) => {
    try {
      const { certificateId } = req.params;
      const file = req.file;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);

      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return res.status(400).json({ message: 'Invalid certificate ID' });
      }

      const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      if (certificate.status !== 'generated') {
        return res.status(400).json({ message: 'Certificate must be generated before uploading a signed version' });
      }

      if (!file) {
        return res.status(400).json({ message: 'PDF file is required' });
      }

      certificate.signedDocumentUrl = file.location;
      certificate.signedDocumentKey = file.key;
      certificate.isSentToStudent = true;
      await certificate.save();

      const student = await User.findById(certificate.student).select('name email studentDetails');
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const signedDocumentAccessUrl = `/certificates/${certificateId}/${file.key.split('/').pop()}`;
      const notificationResult = await sendCertificateNotification(
        student.email,
        student.studentDetails?.mobile,
        student.name,
        certificate.type,
        signedDocumentAccessUrl
      );

      res.json({
        message: 'Signed certificate uploaded and sent to student successfully',
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
      console.error('Error in uploadSignedCertificate:', error);
      res.status(500).json({ error: error.message });
    }
  },

  sendCertificateToStudent: async (req, res) => {
    try {
      const { certificateId } = req.params;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Certificate = require('../models/Certificate')(connection);
      const User = require('../models/User')(connection);

      if (!mongoose.Types.ObjectId.isValid(certificateId)) {
        return res.status(400).json({ message: 'Invalid certificate ID' });
      }

      const certificate = await Certificate.findOne({ _id: certificateId, school: schoolId });
      if (!certificate) {
        return res.status(404).json({ message: 'Certificate not found' });
      }

      if (!certificate.signedDocumentUrl) {
        return res.status(400).json({ message: 'Signed certificate must be uploaded before sending to student' });
      }

      if (certificate.isSentToStudent) {
        return res.status(400).json({ message: 'Certificate has already been sent to the student' });
      }

      certificate.isSentToStudent = true;
      await certificate.save();

      const student = await User.findById(certificate.student).select('name email studentDetails');
      const signedDocumentAccessUrl = `/certificates/${certificateId}/${certificate.signedDocumentKey.split('/').pop()}`;

      const notificationResult = await sendCertificateNotification(
        student.email,
        student.studentDetails.mobile,
        student.name,
        certificate.type,
        signedDocumentAccessUrl
      );

      res.json({
        message: 'Certificate sent to student successfully',
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
      console.error('Error in sendCertificateToStudent:', error);
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
        'studentDetails.isRTE': true,
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

      rteStudents.forEach((student) => {
        const classId = student.studentDetails.class.toString();
        report.admissionsByClass[classId] = (report.admissionsByClass[classId] || 0) + 1;
        report.documentVerificationStatus[student.studentDetails.status === 'verified' ? 'verified' : 'pending']++;
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
        admissionType = 'Regular',
        password,
      } = req.body;

      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);
      const School = require('../models/School')(require('../config/database').getOwnerConnection());

      if (!name || !email || !dob || !gender || !mobile || !grNumber || !classId || !password) {
        return res.status(400).json({ message: 'All required fields must be provided' });
      }

      const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }

      const mobileRegex = /^[0-9]{10}$/;
      if (!mobileRegex.test(mobile) || (parentMobile && !mobileRegex.test(parentMobile))) {
        return res.status(400).json({ message: 'Mobile number must be 10 digits' });
      }

      const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId });
      if (existingGR) {
        return res.status(400).json({ message: 'GR number already exists' });
      }

      const existingEmail = await User.findOne({ email, school: schoolId });
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
      if (!selectedClass) {
        return res.status(404).json({ message: 'Class not found' });
      }

      if (selectedClass.students.length >= selectedClass.capacity) {
        return res.status(400).json({ message: 'Class is at full capacity' });
      }

      const school = await School.findById(schoolId).select('name');
      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const student = new User({
        school: schoolId,
        name,
        email,
        password: hashedPassword,
        role: 'student',
        status: 'active',
        studentDetails: {
          grNumber,
          class: classId,
          admissionType,
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

      await Class.findByIdAndUpdate(classId, { $push: { students: student._id } });

      const className = `${selectedClass.name}${selectedClass.division ? ' ' + selectedClass.division : ''}`;

      const notificationResult = await sendAdmissionNotification(
        student.email,
        mobile,
        student.name,
        password,
        school.name,
        className,
        grNumber
      );

      if (!notificationResult.emailSent || !notificationResult.smsSent) {
        console.warn('Notification partially failed:', notificationResult.error);
      }

      res.status(201).json({
        message: 'Existing student registered successfully',
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
      console.error('Error registering existing student:', error);
      res.status(500).json({ error: error.message });
    }
  },
};

const sendCertificateNotification = async (email, mobile, studentName, certificateType, documentUrl) => {
  return {
    emailSent: true,
    smsSent: true,
    error: null,
  };
};

module.exports = { clerkController, upload };
