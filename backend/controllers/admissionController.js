
// const AdmissionForm = require('../models/AdmissionForm');
// const AdmissionApplication = require('../models/AdmissionApplication');
// const { generateTrackingId } = require('../utils/helpers');

// const admissionController = {
//   // Create custom admission form for school
//   createAdmissionForm: async (req, res) => {
//     try {
//       const { schoolId } = req.school;
//       const {
//         title,
//         description,
//         additionalFields = [] // Optional school-specific fields
//       } = req.body;

//       const formUrl = `admission/${schoolId}/${Date.now()}`;

//       // Create new admission form with standard fields
//       const admissionForm = new AdmissionForm({
//         school: schoolId,
//         title,
//         description,
//         additionalFields,
//         formUrl
//       });

//       await admissionForm.save();
//       res.status(201).json(admissionForm);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAdmissionForm: async (req, res) => {
//     try {
//       const { schoolId, timestamp } = req.school;
//       const formUrl = `admission/${schoolId}/${timestamp}`;

//       const admissionForm = await AdmissionForm.findOne({ 
//         formUrl,
//         isActive: true,
//         school: schoolId
//       });

//       if (!admissionForm) {
//         return res.status(404).json({ 
//           message: 'Admission form not found or no longer active'
//         });
//       }

//       res.json({
//         status: 'success',
//         form: {
//           title: admissionForm.title,
//           description: admissionForm.description,
//           standardFields: admissionForm.standardFields,
//           regularDocuments: admissionForm.regularDocuments,
//           rteDocuments: admissionForm.rteDocuments,
//           additionalFields: admissionForm.additionalFields,
//           schoolId: admissionForm.school,
//           formUrl: admissionForm.formUrl
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   submitApplication: async (req, res) => {
//     try {
//       const schoolId  = req.school;
//       const {
//         studentDetails,
//         parentDetails,
//         admissionType,
//         documents,
//         additionalResponses = {}
//       } = req.body;

//       // Validate required fields
//       if (!studentDetails || !parentDetails || !admissionType) {
//         return res.status(400).json({
//           message: 'Missing required fields'
//         });
//       }

//       // Create application instance
//       const trackingId = generateTrackingId(schoolId);
      
//       const application = new AdmissionApplication({
//         school: schoolId,
//         studentDetails,
//         parentDetails,
//         admissionType,
//         documents: documents.map(doc => ({
//           type: doc.type,
//           documentUrl: doc.url
//         })),
//         trackingId,
//         paymentStatus: admissionType === 'RTE' ? 'not_applicable' : 'pending'
//       });

//       // Validate documents based on admission type and class
//       if (!application.validateDocuments()) {
//         return res.status(400).json({
//           message: 'Missing required documents',
//           required: admissionType === 'RTE' ? 
//             ['rteCertificate', 'studentPhoto', 'aadharCard'] :
//             studentDetails.appliedClass === '1st' ?
//               ['studentPhoto', 'aadharCard', 'birthCertificate'] :
//               ['studentPhoto', 'aadharCard', 'birthCertificate', 'schoolLeavingCertificate']
//         });
//       }

//       await application.save();

//       res.status(201).json({
//         message: 'Application submitted successfully',
//         trackingId,
//         nextSteps: admissionType === 'RTE' ? 
//           'Visit clerk with original documents for verification' : 
//           'Complete payment and visit clerk with original documents'
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   processPayment: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { paymentDetails } = req.body;

//       const application = await AdmissionApplication.findById(applicationId);
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (application.admissionType === 'RTE') {
//         return res.status(400).json({ 
//           message: 'Payment not required for RTE applications' 
//         });
//       }

//       application.paymentStatus = 'completed';
//       application.paymentDetails = {
//         ...paymentDetails,
//         paidAt: new Date()
//       };
//       application.status = 'document_verification';

//       await application.save();

//       res.json({
//         message: 'Payment processed successfully',
//         nextStep: 'Visit clerk with original documents for verification'
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // New method for clerk and fee manager to get specific application by ID
//   getApplicationById: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const application = await AdmissionApplication.findById(applicationId);
      
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }
      
//       res.json({
//         status: 'success',
//         application
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  

//   // Get pending fees applications for fees department
//   getPendingFeesApplications: async (req, res) => {
//     try {
//       const applications = await AdmissionApplication.find({
//         status: 'fees_pending',
//         admissionType: 'Regular',
//         paymentStatus: 'completed',
//         'feesVerification.status': 'pending'
//       }).sort({ createdAt: -1 });
      
//       res.json({
//         status: 'success',
//         count: applications.length,
//         applications: applications.map(app => ({
//           id: app._id,
//           trackingId: app.trackingId,
//           studentName: app.studentDetails.name,
//           appliedClass: app.studentDetails.appliedClass,
//           paymentDetails: app.paymentDetails,
//           submittedOn: app.createdAt
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   clerkVerification: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { status, comments } = req.body;

//       const application = await AdmissionApplication.findById(applicationId);
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       // Verify all required documents are present and authentic
//       const hasAllDocuments = application.validateDocuments();
//       if (!hasAllDocuments) {
//         return res.status(400).json({ 
//           message: 'Missing required documents' 
//         });
//       }

//       application.clerkVerification = {
//         status,
//         verifiedBy: req.user._id,
//         verifiedAt: new Date(),
//         comments
//       };

//       if (status === 'verified') {
//         application.status = application.admissionType === 'RTE' ? 
//           'approved' : 
//           'fees_pending';
//       } else {
//         application.status = 'rejected';
//       }

//       await application.save();

//       res.json({
//         message: 'Verification completed',
//         nextStep: status === 'verified' ? 
//           (application.admissionType === 'RTE' ? 
//             'Admission approved' : 
//             'Visit fees department') : 
//           'Application rejected'
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get pending verification applications for clerks
//   getPendingVerifications: async (req, res) => {
//     try {
//       const applications = await AdmissionApplication.find({
//         status: { $in: ['pending', 'document_verification'] },
//         'clerkVerification.status': 'pending'
//       }).sort({ createdAt: -1 });
      
//       res.json({
//         status: 'success',
//         count: applications.length,
//         applications: applications.map(app => ({
//           id: app._id,
//           trackingId: app.trackingId,
//           studentName: app.studentDetails.name,
//           admissionType: app.admissionType,
//           appliedClass: app.studentDetails.appliedClass,
//           status: app.status,
//           submittedOn: app.createdAt
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   feesVerification: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { status, receiptNumber } = req.body;

//       const application = await AdmissionApplication.findById(applicationId);
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (application.admissionType === 'RTE') {
//         return res.status(400).json({ 
//           message: 'Fees verification not required for RTE applications' 
//         });
//       }

//       application.feesVerification = {
//         status,
//         verifiedBy: req.user._id,
//         verifiedAt: new Date(),
//         receiptNumber
//       };

//       if (status === 'verified') {
//         application.status = 'approved';
//       } else {
//         application.status = 'rejected';
//       }

//       await application.save();

//       res.json({
//         message: 'Fees verification completed',
//         nextStep: status === 'verified' ? 
//           'Return to clerk for final admission' : 
//           'Application rejected'
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   enrollStudent: async (req, res) => {
//       try {
//         const { applicationId } = req.params;
//         const { classId, grNumber } = req.body;
  
//         const application = await AdmissionApplication.findById(applicationId);
//         if (!application) {
//           return res.status(404).json({ message: 'Application not found' });
//         }
  
//         if (application.status !== 'approved') {
//           return res.status(400).json({ 
//             message: 'Only approved applications can be enrolled' 
//           });
//         }
  
//         // Validate if GR number is unique
//         const existingGR = await User.findOne({ 'studentDetails.grNumber': grNumber });
//         if (existingGR) {
//           return res.status(400).json({ 
//             message: 'GR number already exists' 
//           });
//         }
  
//         // Get selected class
//         const selectedClass = await Class.findById(classId);
//         if (!selectedClass) {
//           return res.status(404).json({ message: 'Class not found' });
//         }
  
//         // Check class capacity
//         if (selectedClass.students.length >= selectedClass.capacity) {
//           return res.status(400).json({ 
//             message: 'Class is at full capacity' 
//           });
//         }
  
//         // Create student user account
//         const student = new User({
//           school: application.school,
//           name: application.studentDetails.name,
//           email: application.studentDetails.email,
//           password: Math.random().toString(36).slice(-8), // Generate temporary password
//           role: 'student',
//           studentDetails: {
//             grNumber,
//             class: classId,
//             admissionType: application.admissionType,
//             parentDetails: application.parentDetails,
//             dob: application.studentDetails.dob,
//             gender: application.studentDetails.gender
//           }
//         });
  
//         await student.save();
  
//         // Update class with new student
//         await Class.findByIdAndUpdate(classId, {
//           $push: { students: student._id }
//         });
  
//         // Update application status
//         application.status = 'enrolled';
//         application.grNumber = grNumber;
//         application.assignedClass = classId;
//         await application.save();
  
//         res.json({
//           message: 'Student enrolled successfully',
//           studentDetails: {
//             id: student._id,
//             name: student.name,
//             email: student.email,
//             grNumber,
//             class: {
//               name: selectedClass.name,
//               division: selectedClass.division
//             },
//             temporaryPassword: student.password
//           }
//         });
//       } catch (error) {
//         res.status(500).json({ error: error.message });
//       }
//     },

//   confirmAdmission: async (req, res) => {
//     try {
//       const { applicationId } = req.params;
//       const { classSection, studentEmail, temporaryPassword } = req.body;

//       const application = await AdmissionApplication.findById(applicationId);
//       if (!application) {
//         return res.status(404).json({ message: 'Application not found' });
//       }

//       if (application.status !== 'approved') {
//         return res.status(400).json({ 
//           message: 'Application not approved for admission' 
//         });
//       }

//       // Additional checks for document verification
//       const documentsVerified = application.documents.every(doc => doc.verified);
//       if (!documentsVerified) {
//         return res.status(400).json({ 
//           message: 'All documents must be verified first' 
//         });
//       }

//       // Check fees status for non-RTE applications
//       if (application.admissionType !== 'RTE' && 
//           application.paymentStatus !== 'completed') {
//         return res.status(400).json({ 
//           message: 'All fees must be paid first' 
//         });
//       }

//       // Update application status
//       application.status = 'confirmed';
//       await application.save();

//       res.json({
//         message: 'Admission confirmed successfully',
//         studentDetails: {
//           name: application.studentDetails.name,
//           email: studentEmail,
//           class: application.studentDetails.appliedClass,
//           section: classSection,
//           admissionType: application.admissionType
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Implementation of search applications for staff
//   searchApplications: async (req, res) => {
//     try {
//       const { 
//         searchTerm, 
//         status, 
//         admissionType,
//         fromDate,
//         toDate,
//         schoolId
//       } = req.query;
      
//       // Build query based on filters
//       const query = {
//         school: schoolId
//       };
      
//       if (searchTerm) {
//         query.$or = [
//           { 'studentDetails.name': { $regex: searchTerm, $options: 'i' } },
//           { trackingId: { $regex: searchTerm, $options: 'i' } },
//           { 'parentDetails.name': { $regex: searchTerm, $options: 'i' } }
//         ];
//       }
      
//       if (status) {
//         query.status = status;
//       }
      
//       if (admissionType) {
//         query.admissionType = admissionType;
//       }
      
//       if (fromDate && toDate) {
//         query.createdAt = {
//           $gte: new Date(fromDate),
//           $lte: new Date(toDate)
//         };
//       }
      
//       const applications = await AdmissionApplication.find(query)
//         .sort({ createdAt: -1 })
//         .limit(100);
      
//       res.json({
//         status: 'success',
//         count: applications.length,
//         applications: applications.map(app => ({
//           id: app._id,
//           trackingId: app.trackingId,
//           studentName: app.studentDetails.name,
//           admissionType: app.admissionType,
//           appliedClass: app.studentDetails.appliedClass,
//           status: app.status,
//           submittedOn: app.createdAt
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },


//   getAllFormsBySchool: async (req, res) => {
//     try {
//       const schoolId  = req.school;
      
//       const forms = await AdmissionForm.find({ 
//         school: schoolId 
//       }).sort({ createdAt: -1 });
      
//       res.json({
//         status: 'success',
//         count: forms.length,
//         forms: forms.map(form => ({
//           id: form._id,
//           title: form.title,
//           status: form.isActive ? 'Active' : 'Inactive',
//           formUrl: form.formUrl,
//           createdAt: form.createdAt
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
  
//   // Toggle form active status (activate/deactivate)
//   toggleFormStatus: async (req, res) => {
//     try {
//       const { formId } = req.params;
//       const { isActive } = req.body;
      
//       const form = await AdmissionForm.findById(formId);
//       if (!form) {
//         return res.status(404).json({ message: 'Form not found' });
//       }
      
//       form.isActive = isActive;
//       await form.save();
      
//       res.json({
//         status: 'success',
//         message: `Form ${isActive ? 'activated' : 'deactivated'} successfully`,
//         form: {
//           id: form._id,
//           title: form.title,
//           status: form.isActive ? 'Active' : 'Inactive'
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
  
//   // Validate if a form URL is active and valid
//   validateFormUrl: async (req, res) => {
//     try {
//       const { formUrl } = req.params;
      
//       const form = await AdmissionForm.findOne({ 
//         formUrl,
//         isActive: true
//       });
      
//       if (!form) {
//         return res.status(404).json({ 
//           valid: false,
//           message: 'Form not found or no longer active'
//         });
//       }
      
//       res.json({
//         valid: true,
//         formId: form._id,
//         schoolId: form.school
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
  
//   // Get admission reports and analytics for admin
//   getAdmissionReports: async (req, res) => {
//     try {
//       const schoolId  = req.school;
//       const { year } = req.query;
      
//       // Default to current year if not specified
//       const selectedYear = year || new Date().getFullYear();
      
//       // Define start and end date for the selected year
//       const startDate = new Date(selectedYear, 0, 1); // January 1st
//       const endDate = new Date(selectedYear, 11, 31); // December 31st
      
//       // Query applications within the date range
//       const applications = await AdmissionApplication.find({
//         school: schoolId,
//         createdAt: {
//           $gte: startDate,
//           $lte: endDate
//         }
//       });
      
//       // Generate statistics
//       const stats = {
//         totalApplications: applications.length,
//         byStatus: {
//           pending: applications.filter(app => app.status === 'pending').length,
//           verified: applications.filter(app => app.status === 'document_verification').length,
//           feesPending: applications.filter(app => app.status === 'fees_pending').length,
//           approved: applications.filter(app => app.status === 'approved').length,
//           confirmed: applications.filter(app => app.status === 'confirmed').length,
//           rejected: applications.filter(app => app.status === 'rejected').length
//         },
//         byAdmissionType: {
//           regular: applications.filter(app => app.admissionType === 'Regular').length,
//           rte: applications.filter(app => app.admissionType === 'RTE').length
//         },
//         byClass: {}
//       };
      
//       // Calculate applications by class
//       applications.forEach(app => {
//         const classLevel = app.studentDetails.appliedClass;
//         stats.byClass[classLevel] = (stats.byClass[classLevel] || 0) + 1;
//       });
      
//       // Calculate monthly trends
//       const monthlyTrends = Array(12).fill(0);
//       applications.forEach(app => {
//         const month = app.createdAt.getMonth();
//         monthlyTrends[month]++;
//       });
      
//       res.json({
//         status: 'success',
//         year: selectedYear,
//         stats,
//         monthlyTrends
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
  
//   // Get RTE (Right to Education) specific statistics
//   getRTEStats: async (req, res) => {
//     try {
//       const  schoolId  = req.school;
//       const { year } = req.query;
      
//       // Default to current year if not specified
//       const selectedYear = year || new Date().getFullYear();
      
//       // Define start and end date for the selected year
//       const startDate = new Date(selectedYear, 0, 1); // January 1st
//       const endDate = new Date(selectedYear, 11, 31); // December 31st
      
//       // Query RTE applications within the date range
//       const rteApplications = await AdmissionApplication.find({
//         school: schoolId,
//         admissionType: 'RTE',
//         createdAt: {
//           $gte: startDate,
//           $lte: endDate
//         }
//       });
      
//       // Generate RTE-specific statistics
//       const stats = {
//         totalRTEApplications: rteApplications.length,
//         byStatus: {
//           pending: rteApplications.filter(app => app.status === 'pending').length,
//           verified: rteApplications.filter(app => app.status === 'document_verification').length,
//           approved: rteApplications.filter(app => app.status === 'approved').length,
//           confirmed: rteApplications.filter(app => app.status === 'confirmed').length,
//           rejected: rteApplications.filter(app => app.status === 'rejected').length
//         },
//         byCategory: {},
//         byClass: {}
//       };
      
//       // Calculate RTE applications by category and class
//       rteApplications.forEach(app => {
//         // Count by socio-economic category if available
//         if (app.studentDetails.category) {
//           const category = app.studentDetails.category;
//           stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
//         }
        
//         // Count by class
//         const classLevel = app.studentDetails.appliedClass;
//         stats.byClass[classLevel] = (stats.byClass[classLevel] || 0) + 1;
//       });
      
//       // Calculate monthly trends for RTE applications
//       const monthlyTrends = Array(12).fill(0);
//       rteApplications.forEach(app => {
//         const month = app.createdAt.getMonth();
//         monthlyTrends[month]++;
//       });
      
//       res.json({
//         status: 'success',
//         year: selectedYear,
//         stats,
//         monthlyTrends,
//         rteQuota: {
//           total: 25, // assuming 25% RTE quota
//           filled: rteApplications.filter(app => app.status === 'confirmed').length,
//           remaining: 25 - rteApplications.filter(app => app.status === 'confirmed').length
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Method for application status check by tracking ID
//   checkApplicationStatus: async (req, res) => {
//     try {
//       const { trackingId } = req.params;
      
//       const application = await AdmissionApplication.findOne({ trackingId });
      
//       if (!application) {
//         return res.status(404).json({ 
//           message: 'Application not found with the given tracking ID' 
//         });
//       }
      
//       const statusInfo = {
//         trackingId: application.trackingId,
//         studentName: application.studentDetails.name,
//         appliedClass: application.studentDetails.appliedClass,
//         admissionType: application.admissionType,
//         status: application.status,
//         paymentStatus: application.paymentStatus,
//         timeline: [
//           {
//             stage: 'Application Submitted',
//             date: application.createdAt,
//             completed: true
//           },
//           {
//             stage: 'Payment',
//             date: application.paymentDetails?.paidAt || null,
//             completed: application.paymentStatus === 'completed' || application.admissionType === 'RTE'
//           },
//           {
//             stage: 'Document Verification',
//             date: application.clerkVerification?.verifiedAt || null,
//             completed: application.clerkVerification?.status === 'verified'
//           },
//           {
//             stage: 'Fees Verification',
//             date: application.feesVerification?.verifiedAt || null,
//             completed: application.feesVerification?.status === 'verified' || application.admissionType === 'RTE'
//           },
//           {
//             stage: 'Admission Confirmed',
//             date: application.status === 'confirmed' ? new Date() : null,
//             completed: application.status === 'confirmed'
//           }
//         ],
//         nextSteps: getNextSteps(application)
//       };
      
//       res.json({
//         status: 'success',
//         application: statusInfo
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
//   getAvailableClasses: async (req, res) => {
//     try {
//       const { schoolId } = req.school;
//       const { appliedClass } = req.query;
      
//       const classes = await Class.find({
//         school: schoolId,
//         name: appliedClass,
//         $expr: {
//           $lt: [{ $size: "$students" }, "$capacity"] // Check if class has capacity
//         }
//       })
//       .select('name division capacity students')
//       .populate('classTeacher', 'name');
      
//       res.json({
//         status: 'success',
//         classes: classes.map(cls => ({
//           id: cls._id,
//           name: cls.name,
//           division: cls.division,
//           availableSeats: cls.capacity - cls.students.length,
//           totalSeats: cls.capacity,
//           classTeacher: cls.classTeacher?.name
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  
//   // Get student details by class
//   getStudentsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
      
//       const students = await User.find({
//         'studentDetails.class': classId,
//         role: 'student'
//       })
//       .select('name email studentDetails');
      
//       res.json({
//         status: 'success',
//         count: students.length,
//         students: students.map(student => ({
//           id: student._id,
//           name: student.name,
//           email: student.email,
//           grNumber: student.studentDetails.grNumber,
//           admissionType: student.studentDetails.admissionType
//         }))
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };

// // Helper function to determine next steps based on application status
// function getNextSteps(application) {
//   switch(application.status) {
//     case 'pending':
//       return application.admissionType === 'RTE' ? 
//         'Visit clerk with original documents for verification' : 
//         'Complete payment and visit clerk with original documents';
//     case 'document_verification':
//       return 'Awaiting document verification by clerk';
//     case 'fees_pending':
//       return 'Visit fees department for payment verification';
//     case 'approved':
//       return 'Return to clerk for final admission confirmation';
//     case 'confirmed':
//       return 'Admission process completed successfully';
//     case 'rejected':
//       return 'Application rejected. Please contact the school for more information.';
//     default:
//       return 'Contact school administration for status update';
//   }
// }


// module.exports = admissionController;

const { upload, cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const AdmissionForm = require('../models/AdmissionForm');
const AdmissionApplication = require('../models/AdmissionApplication');
const { generateTrackingId } = require('../utils/helpers');


const uploadDocuments = upload.fields([
  { name: 'studentPhoto', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
  { name: 'birthCertificate', maxCount: 1 },
  { name: 'schoolLeavingCertificate', maxCount: 1 },
  { name: 'rteCertificate', maxCount: 1 }
]);

const admissionController = {
 

  createAdmissionForm: async (req, res) => {
    try {
      const schoolId = req.user.school;  // Get from authenticated user

      if (!schoolId) {
        return res.status(400).json({ error: "School ID is required" });
      }

      const {
        title,
        description,
        additionalFields = []
      } = req.body;

      const formUrl = `admission/${schoolId}/${Date.now()}`;
      const admissionForm = new AdmissionForm({
        school: schoolId,
        title,
        description,
        additionalFields,
        formUrl
      });

      await admissionForm.save();
      res.status(201).json(admissionForm);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
},

  getAdmissionForm: async (req, res) => {
    try {
      // const { schoolId, timestamp } = req.user.school;
      const schoolId = req.user.school; // From authenticated user
      const { timestamp } = req.params;

      const formUrl = `admission/${schoolId}/${timestamp}`;

      const admissionForm = await AdmissionForm.findOne({ 
        formUrl,
        isActive: true,
        school: schoolId
      });

      if (!admissionForm) {
        return res.status(404).json({ 
          message: 'Admission form not found or no longer active'
        });
      }

      res.json({
        status: 'success',
        form: {
          title: admissionForm.title,
          description: admissionForm.description,
          standardFields: admissionForm.standardFields,
          regularDocuments: admissionForm.regularDocuments,
          rteDocuments: admissionForm.rteDocuments,
          additionalFields: admissionForm.additionalFields,
          schoolId: admissionForm.school,
          formUrl: admissionForm.formUrl
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllForms : async (req, res) => {
    try {
      const schoolId = req.user.school;
      const forms = await AdmissionForm.find({ school: schoolId });
      res.status(200).json(forms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // submitApplication: async (req, res) => {
  //   try {
  //     const schoolId = req.user.school;
  //     const {
  //       studentDetails,
  //       parentDetails,
  //       admissionType,
  //       additionalResponses = {}
  //     } = req.body;

  //     if (!studentDetails || !parentDetails || !admissionType) {
  //       return res.status(400).json({
  //         message: 'Missing required fields'
  //       });
  //     }

  //     // Process uploaded files
  //     const uploadedDocuments = [];
  //     for (const fileType in req.files) {
  //       const file = req.files[fileType][0];
  //       const cloudinaryFolder = `admissions/${schoolId}/${Date.now()}`;
        
  //       const result = await cloudinary.uploader.upload(file.path, {
  //         folder: cloudinaryFolder,
  //         resource_type: 'auto'
  //       });

  //       uploadedDocuments.push({
  //         type: fileType,
  //         documentUrl: result.secure_url,
  //         public_id: result.public_id
  //       });
  //     }

  //     const trackingId = generateTrackingId(schoolId);
      
  //     const application = new AdmissionApplication({
  //       school: schoolId,
  //       studentDetails,
  //       parentDetails,
  //       admissionType,
  //       documents: uploadedDocuments,
  //       trackingId,
  //       paymentStatus: admissionType === 'RTE' ? 'not_applicable' : 'pending'
  //     });

  //     if (!application.validateDocuments()) {
  //       // Delete uploaded files if validation fails
  //       for (const doc of uploadedDocuments) {
  //         await cloudinary.uploader.destroy(doc.public_id);
  //       }

  //       return res.status(400).json({
  //         message: 'Missing required documents',
  //         required: admissionType === 'RTE' ? 
  //           ['rteCertificate', 'studentPhoto', 'aadharCard'] :
  //           studentDetails.appliedClass === '1st' ?
  //             ['studentPhoto', 'aadharCard', 'birthCertificate'] :
  //             ['studentPhoto', 'aadharCard', 'birthCertificate', 'schoolLeavingCertificate']
  //       });
  //     }

  //     await application.save();

  //     res.status(201).json({
  //       message: 'Application submitted successfully',
  //       trackingId,
  //       nextSteps: admissionType === 'RTE' ? 
  //         'Visit clerk with original documents for verification' : 
  //         'Complete payment and visit clerk with original documents'
  //     });
  //   } catch (error) {
  //     // Delete uploaded files if there's an error
  //     if (req.files) {
  //       for (const fileType in req.files) {
  //         const file = req.files[fileType][0];
  //         const public_id = file.filename; // Assuming filename is the public_id
  //         await cloudinary.uploader.destroy(public_id);
  //       }
  //     }
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  submitApplication: async (req, res) => {
    try {
      const {
        formUrl,
        studentDetails,
        parentDetails,
        admissionType,
        additionalResponses = {},
      } = req.body;

      // Find the form by formUrl
      const form = await AdmissionForm.findOne({ formUrl, isActive: true });
      if (!form) {
        return res.status(404).json({ message: "Form not found or inactive" });
      }

      const schoolId = form.school;

      if (!studentDetails || !parentDetails || !admissionType) {
        return res.status(400).json({
          message: "Missing required fields",
        });
      }

      // Process uploaded files
      const uploadedDocuments = [];
      for (const fileType in req.files) {
        const file = req.files[fileType][0];
        const cloudinaryFolder = `admissions/${schoolId}/${Date.now()}`;

        const result = await cloudinary.uploader.upload(file.path, {
          folder: cloudinaryFolder,
          resource_type: "auto",
        });

        uploadedDocuments.push({
          type: fileType,
          documentUrl: result.secure_url,
          public_id: result.public_id,
        });
      }

      const trackingId = generateTrackingId(schoolId);

      const application = new AdmissionApplication({
        school: schoolId,
        studentDetails,
        parentDetails,
        admissionType,
        documents: uploadedDocuments,
        trackingId,
        paymentStatus: admissionType === "RTE" ? "not_applicable" : "pending",
      });

      if (!application.validateDocuments()) {
        for (const doc of uploadedDocuments) {
          await cloudinary.uploader.destroy(doc.public_id);
        }

        return res.status(400).json({
          message: "Missing required documents",
          required:
            admissionType === "RTE"
              ? ["rteCertificate", "studentPhoto", "aadharCard"]
              : studentDetails.appliedClass === "1st"
              ? ["studentPhoto", "aadharCard", "birthCertificate"]
              : [
                  "studentPhoto",
                  "aadharCard",
                  "birthCertificate",
                  "schoolLeavingCertificate",
                ],
        });
      }

      await application.save();

      res.status(201).json({
        message: "Application submitted successfully",
        trackingId,
        nextSteps:
          admissionType === "RTE"
            ? "Visit clerk with original documents for verification"
            : "Complete payment and visit clerk with original documents",
      });
    } catch (error) {
      if (req.files) {
        for (const fileType in req.files) {
          const file = req.files[fileType][0];
          const public_id = file.filename;
          await cloudinary.uploader.destroy(public_id);
        }
      }
      res.status(500).json({ error: error.message });
    }
  },

  deleteApplicationDocuments: async (applicationId) => {
    try {
      const application = await AdmissionApplication.findById(applicationId);
      if (!application) return;

      // Delete all documents from Cloudinary
      for (const doc of application.documents) {
        if (doc.public_id) {
          await cloudinary.uploader.destroy(doc.public_id);
        }
      }
    } catch (error) {
      console.error('Error deleting documents:', error);
    }
  },

  // Payment Processing
  processPayment: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { paymentDetails } = req.body;

      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      if (application.admissionType === 'RTE') {
        return res.status(400).json({ 
          message: 'Payment not required for RTE applications' 
        });
      }

      application.paymentStatus = 'completed';
      application.paymentDetails = {
        ...paymentDetails,
        paidAt: new Date()
      };
      application.status = 'document_verification';

      await application.save();

      res.json({
        message: 'Payment processed successfully',
        nextStep: 'Visit clerk with original documents for verification'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Status Check and Reports
  checkApplicationStatus: async (req, res) => {
    try {
      const { trackingId } = req.params;
      
      const application = await AdmissionApplication.findOne({ trackingId });
      
      if (!application) {
        return res.status(404).json({ 
          message: 'Application not found with the given tracking ID' 
        });
      }
      
      const statusInfo = {
        trackingId: application.trackingId,
        studentName: application.studentDetails.name,
        appliedClass: application.studentDetails.appliedClass,
        admissionType: application.admissionType,
        status: application.status,
        paymentStatus: application.paymentStatus,
        timeline: [
          {
            stage: 'Application Submitted',
            date: application.createdAt,
            completed: true
          },
          {
            stage: 'Payment',
            date: application.paymentDetails?.paidAt || null,
            completed: application.paymentStatus === 'completed' || application.admissionType === 'RTE'
          },
          {
            stage: 'Document Verification',
            date: application.clerkVerification?.verifiedAt || null,
            completed: application.clerkVerification?.status === 'verified'
          },
          {
            stage: 'Fees Verification',
            date: application.feesVerification?.verifiedAt || null,
            completed: application.feesVerification?.status === 'verified' || application.admissionType === 'RTE'
          },
          {
            stage: 'Admission Confirmed',
            date: application.status === 'confirmed' ? new Date() : null,
            completed: application.status === 'confirmed'
          }
        ],
        nextSteps: getNextSteps(application)
      };
      
      res.json({
        status: 'success',
        application: statusInfo
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Form Management - Admin Only
  getAllFormsBySchool: async (req, res) => {
    try {
      const schoolId = req.school;
      
      const forms = await AdmissionForm.find({ 
        school: schoolId 
      }).sort({ createdAt: -1 });
      
      res.json({
        status: 'success',
        count: forms.length,
        forms: forms.map(form => ({
          id: form._id,
          title: form.title,
          status: form.isActive ? 'Active' : 'Inactive',
          formUrl: form.formUrl,
          createdAt: form.createdAt
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  toggleFormStatus: async (req, res) => {
    try {
      const { formId } = req.params;
      const { isActive } = req.body;
      
      const form = await AdmissionForm.findById(formId);
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }
      
      form.isActive = isActive;
      await form.save();
      
      res.json({
        status: 'success',
        message: `Form ${isActive ? 'activated' : 'deactivated'} successfully`,
        form: {
          id: form._id,
          title: form.title,
          status: form.isActive ? 'Active' : 'Inactive'
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // validateFormUrl: async (req, res) => {
  //   try {
  //     const { formUrl } = req.params;
      
  //     const form = await AdmissionForm.findOne({ 
  //       formUrl,
  //       isActive: true
  //     });
      
  //     if (!form) {
  //       return res.status(404).json({ 
  //         valid: false,
  //         message: 'Form not found or no longer active'
  //       });
  //     }
      
  //     res.json({
  //       valid: true,
  //       formId: form._id,
  //       schoolId: form.school
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  validateFormUrl: async (req, res) => {
    try {
      const { formUrl } = req.params;

      const form = await AdmissionForm.findOne({
        formUrl,
        isActive: true,
      });

      if (!form) {
        return res.status(404).json({
          valid: false,
          message: "Form not found or no longer active",
        });
      }

      res.json({
        valid: true,
        form: {
          id: form._id,
          schoolId: form.school,
          title: form.title,
          description: form.description,
          standardFields: form.standardFields,
          regularDocuments: form.regularDocuments,
          rteDocuments: form.rteDocuments,
          additionalFields: form.additionalFields,
          formUrl: form.formUrl,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  //   // Get pending fees applications for fees department
  getPendingFeesApplications: async (req, res) => {
    try {
      const applications = await AdmissionApplication.find({
        status: 'fees_pending',
        admissionType: 'Regular',
        paymentStatus: 'completed',
        'feesVerification.status': 'pending'
      }).sort({ createdAt: -1 });
      
      res.json({
        status: 'success',
        count: applications.length,
        applications: applications.map(app => ({
          id: app._id,
          trackingId: app.trackingId,
          studentName: app.studentDetails.name,
          appliedClass: app.studentDetails.appliedClass,
          paymentDetails: app.paymentDetails,
          submittedOn: app.createdAt
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

    feesVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, receiptNumber } = req.body;

      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }

      if (application.admissionType === 'RTE') {
        return res.status(400).json({ 
          message: 'Fees verification not required for RTE applications' 
        });
      }

      application.feesVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        receiptNumber
      };

      if (status === 'verified') {
        application.status = 'approved';
      } else {
        application.status = 'rejected';
      }

      await application.save();

      res.json({
        message: 'Fees verification completed',
        nextStep: status === 'verified' ? 
          'Return to clerk for final admission' : 
          'Application rejected'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  //   // Get student details by class
  getStudentsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      
      const students = await User.find({
        'studentDetails.class': classId,
        role: 'student'
      })
      .select('name email studentDetails');
      
      res.json({
        status: 'success',
        count: students.length,
        students: students.map(student => ({
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber: student.studentDetails.grNumber,
          admissionType: student.studentDetails.admissionType
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  searchApplications : async (req, res) => {
    try {
      const { 
        status, 
        admissionType, 
        class: studentClass, 
        dateRange,
        searchTerm 
      } = req.query;
  
      let query = {};
      
      if (status) query.status = status;
      if (admissionType) query.admissionType = admissionType;
      if (studentClass) query['studentDetails.appliedClass'] = studentClass;
      if (searchTerm) {
        query.$or = [
          { 'studentDetails.name': { $regex: searchTerm, $options: 'i' } },
          { trackingId: { $regex: searchTerm, $options: 'i' } },
          { 'parentDetails.name': { $regex: searchTerm, $options: 'i' } }
        ];
      }
      if (dateRange) {
        query.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }
  
      const applications = await AdmissionApplication.find(query)
        .sort({ createdAt: -1 });
  
      res.json({
        status: 'success',
        count: applications.length,
        applications
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // 2. Missing: RTE Statistics Report
  getRTEStats : async (req, res) => {
    try {
      const { schoolId } = req.school;
      const { year } = req.query;
  
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
  
      const stats = await AdmissionApplication.aggregate([
        {
          $match: {
            school: mongoose.Types.ObjectId(schoolId),
            admissionType: 'RTE',
            createdAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            byClass: {
              $push: {
                class: '$studentDetails.appliedClass',
                status: '$status'
              }
            }
          }
        }
      ]);
  
      res.json({
        status: 'success',
        year,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // 3. Missing: Get Application by ID
  getApplicationById : async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      const application = await AdmissionApplication.findById(applicationId)
        .populate('assignedClass', 'name division capacity')
        .populate('clerkVerification.verifiedBy', 'name')
        .populate('feesVerification.verifiedBy', 'name');
      
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
      
      res.json({
        status: 'success',
        application
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  // 4. Missing: Fee Receipt Generation
  generateFeeReceipt : async (applicationId, receiptNumber) => {
    const application = await AdmissionApplication.findById(applicationId)
      .populate('school');
      
    // Generate receipt data
    const receiptData = {
      receiptNumber,
      studentName: application.studentDetails.name,
      class: application.studentDetails.appliedClass,
      admissionType: application.admissionType,
      amount: application.paymentDetails.amount,
      paidDate: application.paymentDetails.paidAt,
      school: application.school.name,
      generatedAt: new Date()
    };
    
    return receiptData;
  },
  
  // Update feesVerification to include receipt generation
  updatedFeesVerification : async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, receiptNumber } = req.body;
  
      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
  
      if (application.admissionType === 'RTE') {
        return res.status(400).json({ 
          message: 'Fees verification not required for RTE applications' 
        });
      }
  
      // Generate fee receipt
      const receiptData = await generateFeeReceipt(applicationId, receiptNumber);
  
      application.feesVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        receiptNumber,
        receiptData // Store receipt data
      };
  
      if (status === 'verified') {
        application.status = 'approved';
      } else {
        application.status = 'rejected';
      }
  
      await application.save();
  
      res.json({
        message: 'Fees verification completed',
        receipt: receiptData,
        nextStep: status === 'verified' ? 
          'Return to clerk for final admission' : 
          'Application rejected'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }

  }
};

// Helper function
function getNextSteps(application) {
  switch(application.status) {
    case 'pending':
      return application.admissionType === 'RTE' ? 
        'Visit clerk with original documents for verification' : 
        'Complete payment and visit clerk with original documents';
    case 'document_verification':
      return 'Awaiting document verification by clerk';
    case 'fees_pending':
      return 'Visit fees department for payment verification';
    case 'approved':
      return 'Return to clerk for final admission confirmation';
    case 'confirmed':
      return 'Admission process completed successfully';
    case 'rejected':
      return 'Application rejected. Please contact the school for more information.';
    default:
      return 'Contact school administration for status update';
  }
}

module.exports = {
  admissionController,
  uploadDocuments
};