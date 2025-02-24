
const { upload, cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const AdmissionForm = require('../models/AdmissionForm');
const AdmissionApplication = require('../models/AdmissionApplication');
const { generateTrackingId } = require('../utils/helpers');
// const { generatePaymentQR } = require('../utils/qrGenerator');
const razorpayService = require('../utils/razorpayService');


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
    const schoolId = req.user.school?._id?.toString() || req.user.school;

    if (!schoolId) {
      return res.status(400).json({ error: "School ID is required" });
    }

    const { title, description, additionalFields = [],admissionFee  } = req.body;

    if (admissionFee === undefined || admissionFee < 0) {
      return res.status(400).json({ error: "Valid admission fee is required" });
    }

    // Get current academic year (e.g., "2024-2025")
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const academicYear = currentDate.getMonth() >= 3 ? 
      `${currentYear}-${currentYear + 1}` : 
      `${currentYear - 1}-${currentYear}`;

    const timestamp = Date.now();
    const formUrl = `admission/${schoolId}/${timestamp}`;
    
    const admissionForm = new AdmissionForm({
      school: schoolId,
      title,
      description,
      additionalFields,
      formUrl,
      academicYear,
      admissionFee // Add the academic year
    });

    await admissionForm.save();
    res.status(201).json({
      id: admissionForm._id,
      schoolId: admissionForm.school,
      title: admissionForm.title,
      description: admissionForm.description,
      formUrl: admissionForm.formUrl,
      academicYear: admissionForm.academicYear,
      admissionFee: admissionForm.admissionFee,
      createdAt: admissionForm.createdAt,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},


  getAdmissionForm: async (req, res) => {
    try {
      const schoolId = req.user.school;
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


  //new for Payment

  getPaymentDetails: async (req, res) => {
    try {
      const { formUrl } = req.params;
      
      const form = await AdmissionForm.findOne({ formUrl, isActive: true });
      if (!form) {
        return res.status(404).json({ message: 'Form not found' });
      }

      const paymentDetails = {
        admissionFee: form.admissionFee,
        schoolId: form.school,
        formUrl: form.formUrl
      };

      res.json({
        status: 'success',
        paymentDetails
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  generatePaymentQR: async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      const application = await AdmissionApplication.findById(applicationId)
        .populate({
          path: 'school',
          select: 'name'
        });
  
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
  
      if (application.admissionType === 'RTE') {
        return res.status(400).json({ message: 'Payment not required for RTE applications' });
      }
  
      const form = await AdmissionForm.findOne({ school: application.school });
      
      const paymentData = await razorpayService.generatePaymentQR(
        form.admissionFee,
        applicationId,
        application.school._id
      );
  
      res.json({
        status: 'success',
        data: {
          qrCode: paymentData.qrCode,
          orderId: paymentData.orderId,
          amount: paymentData.amount,
          applicationId: application._id
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // submitApplication : async (req, res) => {
  //   try {
  //     const {
  //       formUrl,
  //       studentDetails,
  //       parentDetails,
  //       admissionType,
  //       additionalResponses = {},
  //     } = req.body;
  
  //     // Basic validation
  //     if (!formUrl) {
  //       return res.status(400).json({ error: "Form URL is missing" });
  //     }
  //     if (typeof studentDetails !== "string" || typeof parentDetails !== "string") {
  //       return res.status(400).json({ error: "studentDetails and parentDetails must be JSON strings" });
  //     }
  
  //     // Parse JSON data
  //     let parsedStudentDetails;
  //     let parsedParentDetails;
  //     try {
  //       parsedStudentDetails = JSON.parse(studentDetails);
  //       parsedParentDetails = JSON.parse(parentDetails);
  //     } catch (error) {
  //       return res.status(400).json({ error: "Invalid JSON format in student or parent details" });
  //     }
  
  //     // Find and validate form
  //     const form = await AdmissionForm.findOne({ formUrl, isActive: true });
  //     if (!form) {
  //       return res.status(404).json({ message: "Form not found or inactive" });
  //     }
  
  //     const schoolId = form.school;
  
  //     // Validate admission type
  //     if (!['Regular', 'RTE'].includes(admissionType)) {
  //       return res.status(400).json({ error: "Invalid admission type" });
  //     }
  
  //     // Validate additional fields if present
  //     if (form.additionalFields?.length > 0) {
  //       for (const field of form.additionalFields) {
  //         if (field.required && !additionalResponses[field.name]) {
  //           return res.status(400).json({
  //             message: `Missing required additional field: ${field.label}`
  //           });
  //         }
  //       }
  //     }
  
  //     // Process uploaded files
  //     const uploadedDocuments = [];
  //     try {
  //       for (const fileType in req.files) {
  //         const file = req.files[fileType][0];
  //         const cloudinaryFolder = `admissions/${schoolId}/${Date.now()}`;
  
  //         const result = await cloudinary.uploader.upload(file.path, {
  //           folder: cloudinaryFolder,
  //           resource_type: "auto",
  //         });
  
  //         uploadedDocuments.push({
  //           type: fileType,
  //           documentUrl: result.secure_url,
  //           public_id: result.public_id,
  //         });
  //       }
  //     } catch (error) {
  //       // Cleanup any uploaded files if there's an error
  //       for (const doc of uploadedDocuments) {
  //         await cloudinary.uploader.destroy(doc.public_id);
  //       }
  //       throw new Error("File upload failed: " + error.message);
  //     }
  
  //     const trackingId = generateTrackingId(schoolId);
  
  //     // Create application instance
  //     const application = new AdmissionApplication({
  //       school: schoolId,
  //       studentDetails: parsedStudentDetails,
  //       parentDetails: parsedParentDetails,
  //       admissionType,
  //       documents: uploadedDocuments,
  //       trackingId,
  //       status: 'pending',
  //       paymentStatus: admissionType === "RTE" ? "not_applicable" : "pending",
  //       additionalResponses,
  //       clerkVerification: { status: 'pending' },
  //       feesVerification: { status: 'pending' }
  //     });
  
  //     // Validate application data against mongoose schema
  //     const validationError = application.validateSync();
  //     if (validationError) {
  //       // Cleanup uploaded files if validation fails
  //       for (const doc of uploadedDocuments) {
  //         await cloudinary.uploader.destroy(doc.public_id);
  //       }
  //       return res.status(400).json({ error: validationError.message });
  //     }
  
  //     // Validate required documents
  //     if (!application.validateDocuments()) {
  //       // Cleanup uploaded files if document validation fails
  //       for (const doc of uploadedDocuments) {
  //         await cloudinary.uploader.destroy(doc.public_id);
  //       }
  
  //       return res.status(400).json({
  //         message: "Missing required documents",
  //         required: getRequiredDocuments(admissionType, parsedStudentDetails.appliedClass)
  //       });
  //     }
  
  //     await application.save();
  
  //     res.status(201).json({
  //       message: "Application submitted successfully",
  //       trackingId,
  //       nextSteps: getNextSteps(admissionType),
  //       status: application.status
  //     });
  
  //   } catch (error) {
  //     // Cleanup files in case of any error
  //     if (req.files) {
  //       for (const fileType in req.files) {
  //         const file = req.files[fileType][0];
  //         if (file.public_id) {
  //           await cloudinary.uploader.destroy(file.public_id);
  //         }
  //       }
  //     }
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  verifyPayment: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { 
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature 
      } = req.body;
  
      const application = await AdmissionApplication.findById(applicationId);
      if (!application) {
        return res.status(404).json({ message: 'Application not found' });
      }
  
      if (application.admissionType === 'RTE') {
        return res.status(400).json({ message: 'Payment verification not required for RTE applications' });
      }
  
      // Verify payment signature
      const isValid = razorpayService.verifyPayment(
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );
  
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid payment signature' });
      }
  
      // Get payment details from Razorpay
      const paymentDetails = await razorpayService.getPaymentDetails(razorpayPaymentId);
  
      // Update application with payment details
      application.paymentStatus = 'completed';
      application.paymentDetails = {
        transactionId: razorpayPaymentId,
        orderId: razorpayOrderId,
        amount: paymentDetails.amount / 100, // Convert from paise to rupees
        paidAt: new Date()
      };
  
      await application.save();
  
      res.json({
        status: 'success',
        message: 'Payment verified successfully',
        nextStep: 'Submit your application form'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },



  submitApplication: async (req, res) => {
    try {
      const {
        formUrl,
        studentDetails,
        parentDetails,
        admissionType,
        additionalResponses = {},
        paymentTransactionId // Add this
      } = req.body;

      if (!formUrl) {
        return res.status(400).json({ error: "Form URL is missing" });
      }

      // Find and validate form
      const form = await AdmissionForm.findOne({ formUrl, isActive: true });
      if (!form) {
        return res.status(404).json({ message: "Form not found or inactive" });
      }

      // Check payment for regular admission
      if (admissionType === 'Regular') {
        if (!paymentTransactionId) {
          return res.status(400).json({ 
            error: "Payment is required for regular admission" 
          });
        }
      }

      // Rest of your existing submitApplication code...
      let parsedStudentDetails;
      let parsedParentDetails;
      try {
        parsedStudentDetails = JSON.parse(studentDetails);
        parsedParentDetails = JSON.parse(parentDetails);
      } catch (error) {
        return res.status(400).json({ error: "Invalid JSON format in student or parent details" });
      }

      const schoolId = form.school;
      const trackingId = generateTrackingId(schoolId);

      // Process uploaded files
      const uploadedDocuments = [];
      try {
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
      } catch (error) {
        // Cleanup any uploaded files if there's an error
        for (const doc of uploadedDocuments) {
          await cloudinary.uploader.destroy(doc.public_id);
        }
        throw new Error("File upload failed: " + error.message);
      }

      const application = new AdmissionApplication({
        school: schoolId,
        studentDetails: parsedStudentDetails,
        parentDetails: parsedParentDetails,
        admissionType,
        documents: uploadedDocuments,
        trackingId,
        status: 'pending',
        paymentStatus: admissionType === 'Regular' ? 
          (paymentTransactionId ? 'completed' : 'pending') : 
          'not_applicable',
        paymentDetails: admissionType === 'Regular' ? {
          transactionId: paymentTransactionId,
          amount: form.admissionFee,
          paidAt: new Date()
        } : undefined,
        additionalResponses,
        clerkVerification: { status: 'pending' },
        feesVerification: { status: 'pending' }
      });

      await application.save();

      res.status(201).json({
        message: "Application submitted successfully",
        trackingId,
        nextSteps: getNextSteps(application),
        status: application.status
      });

    } catch (error) {
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

  // // Payment Processing
  // processPayment: async (req, res) => {
  //   try {
  //     const { applicationId } = req.params;
  //     const { paymentDetails } = req.body;

  //     const application = await AdmissionApplication.findById(applicationId);
  //     if (!application) {
  //       return res.status(404).json({ message: 'Application not found' });
  //     }

  //     if (application.admissionType === 'RTE') {
  //       return res.status(400).json({ 
  //         message: 'Payment not required for RTE applications' 
  //       });
  //     }

  //     application.paymentStatus = 'completed';
  //     application.paymentDetails = {
  //       ...paymentDetails,
  //       paidAt: new Date()
  //     };
  //     application.status = 'document_verification';

  //     await application.save();

  //     res.json({
  //       message: 'Payment processed successfully',
  //       nextStep: 'Visit clerk with original documents for verification'
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

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
      // const schoolId = req.school;
      const schoolId = req.user.school;
      
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