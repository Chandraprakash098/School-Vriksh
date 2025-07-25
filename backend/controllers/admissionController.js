const Razorpay = require("razorpay");
const crypto = require("crypto");
const { generateTrackingId } = require("../utils/helpers");
const { encrypt, decrypt } = require("../utils/encryption");
const { getOwnerConnection } = require("../config/database");
const {
  uploadDocuments,
  uploadToS3,
  deleteFromS3,
  streamS3Object,
} = require("../config/s3Upload");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const admissionController = {
  createAdmissionForm: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      if (!schoolId) {
        return res.status(400).json({ error: "School ID is required" });
      }

      const {
        title,
        description,
        additionalFields = [],
        admissionFee,
      } = req.body;

      if (admissionFee === undefined || admissionFee < 0) {
        return res
          .status(400)
          .json({ error: "Valid admission fee is required" });
      }

      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const academicYear =
        currentDate.getMonth() >= 3
          ? `${currentYear}-${currentYear + 1}`
          : `${currentYear - 1}-${currentYear}`;

      const timestamp = Date.now();
      const formUrl = `admission/${schoolId}/${timestamp}`;

      const admissionForm = new AdmissionForm({
        school: schoolId,
        title,
        description,
        additionalFields,
        formUrl,
        academicYear,
        admissionFee,
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
      const schoolId = req.school._id.toString();
      const { timestamp } = req.params;
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      const formUrl = `admission/${schoolId}/${timestamp}`;

      const admissionForm = await AdmissionForm.findOne({
        formUrl,
        isActive: true,
        school: schoolId,
      });

      if (!admissionForm) {
        return res.status(404).json({
          message: "Admission form not found or no longer active",
        });
      }

      res.json({
        status: "success",
        form: {
          title: admissionForm.title,
          description: admissionForm.description,
          standardFields: admissionForm.standardFields,
          regularDocuments: admissionForm.regularDocuments,
          rteDocuments: admissionForm.rteDocuments,
          additionalFields: admissionForm.additionalFields,
          schoolId: admissionForm.school,
          formUrl: admissionForm.formUrl,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllForms: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      const forms = await AdmissionForm.find({ school: schoolId });
      res.status(200).json(forms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPaymentDetails: async (req, res) => {
    try {
      const { formUrl } = req.params;
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      const form = await AdmissionForm.findOne({ formUrl, isActive: true });
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);
      const school = await School.findById(form.school).select("paymentConfig");

      if (!school || !school.paymentConfig?.isPaymentConfigured) {
        return res
          .status(400)
          .json({ error: "School payment configuration not set up" });
      }

      const decryptedKeyId = decrypt(school.paymentConfig.razorpayKeyId);
      const decryptedKeySecret = decrypt(
        school.paymentConfig.razorpayKeySecret
      );

      const razorpay = new Razorpay({
        key_id: decryptedKeyId,
        key_secret: decryptedKeySecret,
      });

      const options = {
        amount: form.admissionFee * 100,
        currency: "INR",
        receipt: `adm_${Date.now()}`,
        notes: {
          formUrl: form.formUrl,
          schoolId: form.school.toString(),
        },
      };

      const order = await razorpay.orders.create(options);

      const paymentDetails = {
        orderId: order.id,
        amount: form.admissionFee,
        currency: order.currency,
        schoolId: form.school,
        formUrl: form.formUrl,
        key: decryptedKeyId,
      };

      res.json({
        status: "success",
        paymentDetails,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  verifyPayment: async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        schoolId,
      } = req.body;

      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);
      const school = await School.findById(schoolId).select("paymentConfig");

      if (!school || !school.paymentConfig?.isPaymentConfigured) {
        return res
          .status(400)
          .json({ error: "School payment configuration not set up" });
      }

      const decryptedKeyId = decrypt(school.paymentConfig.razorpayKeyId);
      const decryptedKeySecret = decrypt(
        school.paymentConfig.razorpayKeySecret
      );

      const razorpay = new Razorpay({
        key_id: decryptedKeyId,
        key_secret: decryptedKeySecret,
      });

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", decryptedKeySecret)
        .update(body.toString())
        .digest("hex");

      const isAuthentic = expectedSignature === razorpay_signature;

      if (!isAuthentic) {
        return res.status(400).json({ message: "Invalid payment signature" });
      }

      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      res.json({
        status: "success",
        message: "Payment verified successfully",
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
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
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      } = req.body;

      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      if (!formUrl) {
        return res.status(400).json({ error: "Form URL is missing" });
      }

      const form = await AdmissionForm.findOne({ formUrl, isActive: true });
      if (!form) {
        return res.status(404).json({ message: "Form not found or inactive" });
      }

      if (admissionType === "Regular") {
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
          return res.status(400).json({
            error:
              "Payment verification failed. Required payment details missing.",
          });
        }

        const ownerConnection = await getOwnerConnection();
        const School = require("../models/School")(ownerConnection);
        const school = await School.findById(form.school).select(
          "paymentConfig"
        );

        const decryptedKeyId = decrypt(school.paymentConfig.razorpayKeyId);
        const decryptedKeySecret = decrypt(
          school.paymentConfig.razorpayKeySecret
        );

        const razorpay = new Razorpay({
          key_id: decryptedKeyId,
          key_secret: decryptedKeySecret,
        });

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac("sha256", decryptedKeySecret)
          .update(body.toString())
          .digest("hex");

        if (expectedSignature !== razorpay_signature) {
          return res.status(400).json({
            error: "Payment verification failed. Invalid signature.",
          });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment.amount !== form.admissionFee * 100) {
          return res.status(400).json({
            error: "Payment amount mismatch",
          });
        }
      }

      let parsedStudentDetails;
      let parsedParentDetails;
      try {
        parsedStudentDetails = JSON.parse(studentDetails);
        parsedParentDetails = JSON.parse(parentDetails);
      } catch (error) {
        return res
          .status(400)
          .json({ error: "Invalid JSON format in student or parent details" });
      }

      const schoolId = form.school;
      const trackingId = generateTrackingId(schoolId);

      const uploadedDocuments = [];
      try {
        for (const fileType in req.files) {
          const file = req.files[fileType][0];
          uploadedDocuments.push({
            type: fileType,
            documentUrl: file.location,
            key: file.key,
            verified: false,
          });
        }
      } catch (error) {
        for (const doc of uploadedDocuments) {
          await deleteFromS3(doc.key);
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
        status: "pending",
        paymentStatus:
          admissionType === "Regular" ? "completed" : "not_applicable",
        paymentDetails:
          admissionType === "Regular"
            ? {
                transactionId: razorpay_payment_id,
                orderId: razorpay_order_id,
                amount: form.admissionFee,
                paidAt: new Date(),
              }
            : undefined,
        additionalResponses,
        clerkVerification: { status: "pending" },
        feesVerification: { status: "pending" },
      });

      await application.save();

      const documentsWithUrls = uploadedDocuments.map((doc) => ({
        type: doc.type,
        documentUrl: doc.documentUrl,
        key: doc.key,
        accessUrl: `/documents/${application._id}/${doc.key.split("/").pop()}`,
      }));

      res.status(201).json({
        message: "Application submitted successfully",
        trackingId,
        nextSteps: getNextSteps(application),
        status: application.status,
        documents: documentsWithUrls,
      });
    } catch (error) {
      for (const doc of req.files ? Object.values(req.files).flat() : []) {
        await deleteFromS3(doc.key);
      }
      res.status(500).json({ error: error.message });
    }
  },

  deleteApplicationDocuments: async (applicationId) => {
    try {
      const connection = require("../db").connectToDatabase;
      const schoolDb =
        await connection(/* fetch dbName from schoolId if needed */);
      const AdmissionApplication = require("../models/AdmissionApplication")(
        schoolDb
      );

      const application = await AdmissionApplication.findById(applicationId);
      if (!application) return;

      for (const doc of application.documents) {
        if (doc.key) {
          await deleteFromS3(doc.key);
        }
      }
    } catch (error) {
      console.error("Error deleting documents:", error);
    }
  },

  checkApplicationStatus: async (req, res) => {
    try {
      const { trackingId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const application = await AdmissionApplication.findOne({
        trackingId,
        school: schoolId,
      });

      if (!application) {
        return res.status(404).json({
          message: "Application not found with the given tracking ID",
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
            stage: "Application Submitted",
            date: application.createdAt,
            completed: true,
          },
          {
            stage: "Payment",
            date: application.paymentDetails?.paidAt || null,
            completed:
              application.paymentStatus === "completed" ||
              application.admissionType === "RTE",
          },
          {
            stage: "Document Verification",
            date: application.clerkVerification?.verifiedAt || null,
            completed: application.clerkVerification?.status === "verified",
          },
          {
            stage: "Fees Verification",
            date: application.feesVerification?.verifiedAt || null,
            completed:
              application.feesVerification?.status === "verified" ||
              application.admissionType === "RTE",
          },
          {
            stage: "Admission Confirmed",
            date: application.status === "confirmed" ? new Date() : null,
            completed: application.status === "confirmed",
          },
        ],
        nextSteps: getNextSteps(application),
      };

      res.json({
        status: "success",
        application: statusInfo,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllFormsBySchool: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      const forms = await AdmissionForm.find({ school: schoolId }).sort({
        createdAt: -1,
      });

      res.json({
        status: "success",
        count: forms.length,
        forms: forms.map((form) => ({
          id: form._id,
          title: form.title,
          status: form.isActive ? "Active" : "Inactive",
          formUrl: form.formUrl,
          createdAt: form.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  toggleFormStatus: async (req, res) => {
    try {
      const { formId } = req.params;
      const { isActive } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

      const form = await AdmissionForm.findOne({
        _id: formId,
        school: schoolId,
      });
      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      form.isActive = isActive;
      await form.save();

      res.json({
        status: "success",
        message: `Form ${isActive ? "activated" : "deactivated"} successfully`,
        form: {
          id: form._id,
          title: form.title,
          status: form.isActive ? "Active" : "Inactive",
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  validateFormUrl: async (req, res) => {
    try {
      const { formUrl } = req.params;
      const connection = req.connection;
      const AdmissionForm = require("../models/AdmissionForm")(connection);

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

  getPendingFeesApplications: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const applications = await AdmissionApplication.find({
        school: schoolId,
        status: "fees_pending",
        "feesVerification.status": "pending",
      }).sort({ createdAt: -1 });

      res.json({
        status: "success",
        count: applications.length,
        applications: applications.map((app) => ({
          id: app._id,
          trackingId: app.trackingId,
          studentName: app.studentDetails.name,
          appliedClass: app.studentDetails.appliedClass,
          admissionType: app.admissionType,
          paymentDetails: app.paymentDetails || {
            note: "RTE - No payment required",
          },
          submittedOn: app.createdAt,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  feesVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, receiptNumber, comments } = req.body;
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

      application.feesVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        receiptNumber:
          application.admissionType === "RTE"
            ? receiptNumber || "RTE-NoPayment"
            : receiptNumber,
        comments:
          comments ||
          (application.admissionType === "RTE"
            ? "RTE eligibility verified"
            : undefined),
      };

      application.status = status === "verified" ? "approved" : "rejected";
      await application.save();

      res.json({
        message: "Fees verification completed",
        nextStep:
          status === "verified"
            ? "Return to clerk for final admission"
            : "Application rejected",
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
      const User = require("../models/User")(connection);

      const students = await User.find({
        "studentDetails.class": classId,
        role: "student",
        school: schoolId,
      }).select("name email studentDetails");

      res.json({
        status: "success",
        count: students.length,
        students: students.map((student) => ({
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber: student.studentDetails.grNumber,
          admissionType: student.studentDetails.admissionType,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  searchApplications: async (req, res) => {
    try {
      const {
        status,
        admissionType,
        class: studentClass,
        dateRange,
        searchTerm,
      } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      let query = { school: schoolId };

      if (status) query.status = status;
      if (admissionType) query.admissionType = admissionType;
      if (studentClass) query["studentDetails.appliedClass"] = studentClass;
      if (searchTerm) {
        query.$or = [
          { "studentDetails.name": { $regex: searchTerm, $options: "i" } },
          { trackingId: { $regex: searchTerm, $options: "i" } },
          { "parentDetails.name": { $regex: searchTerm, $options: "i" } },
        ];
      }
      if (dateRange) {
        query.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end),
        };
      }

      const applications = await AdmissionApplication.find(query).sort({
        createdAt: -1,
      });

      res.json({
        status: "success",
        count: applications.length,
        applications,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getRTEStats: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { year } = req.query;
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );

      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);

      const stats = await AdmissionApplication.aggregate([
        {
          $match: {
            school: mongoose.Types.ObjectId(schoolId),
            admissionType: "RTE",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            byClass: {
              $push: {
                class: "$studentDetails.appliedClass",
                status: "$status",
              },
            },
          },
        },
      ]);

      res.json({
        status: "success",
        year,
        stats,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getApplicationById: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const AdmissionApplication = require("../models/AdmissionApplication")(
        connection
      );
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      const application = await AdmissionApplication.findOne({
        _id: applicationId,
        school: schoolId,
      })
        .populate("assignedClass", "name division capacity", Class)
        .populate("clerkVerification.verifiedBy", "name", User)
        .populate("feesVerification.verifiedBy", "name", User);

      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }

      // Add pre-signed URLs to documents
      const documentsWithPresignedUrls = await Promise.all(
        application.documents.map(async (doc) => ({
          ...doc.toObject(),
          presignedUrl: await getPresignedUrl(doc.key),
        }))
      );
      application.documents = documentsWithPresignedUrls;

      res.json({
        status: "success",
        application,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  generateFeeReceipt: async (applicationId, receiptNumber) => {
    const connection = require("../db").connectToDatabase;
    const schoolDb =
      await connection(/* fetch dbName from schoolId if needed */);
    const AdmissionApplication = require("../models/AdmissionApplication")(
      schoolDb
    );
    const School = require("../models/School")(
      require("../db").getOwnerConnection()
    );

    const application = await AdmissionApplication.findById(
      applicationId
    ).populate("school", "", School);

    const receiptData = {
      receiptNumber,
      studentName: application.studentDetails.name,
      class: application.studentDetails.appliedClass,
      admissionType: application.admissionType,
      amount: application.paymentDetails.amount,
      paidDate: application.paymentDetails.paidAt,
      school: application.school.name,
      generatedAt: new Date(),
    };

    return receiptData;
  },

  updatedFeesVerification: async (req, res) => {
    try {
      const { applicationId } = req.params;
      const { status, receiptNumber } = req.body;
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

      if (application.admissionType === "RTE") {
        return res.status(400).json({
          message: "Fees verification not required for RTE applications",
        });
      }

      const receiptData = await admissionController.generateFeeReceipt(
        applicationId,
        receiptNumber
      );

      application.feesVerification = {
        status,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
        receiptNumber,
        receiptData,
      };

      if (status === "verified") {
        application.status = "approved";
      } else {
        application.status = "rejected";
      }

      await application.save();

      res.json({
        message: "Fees verification completed",
        receipt: receiptData,
        nextStep:
          status === "verified"
            ? "Return to clerk for final admission"
            : "Application rejected",
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

function getNextSteps(application) {
  switch (application.status) {
    case "pending":
      return "Visit clerk with original documents for verification";
    case "document_verification":
      return "Awaiting document verification by clerk";
    case "fees_pending":
      return "Visit fees department for verification";
    case "approved":
      return "Return to clerk for final admission confirmation";
    case "confirmed":
    case "enrolled":
      return "Admission process completed successfully";
    case "rejected":
      return "Application rejected. Please contact the school for more information.";
    default:
      return "Contact school administration for status update";
  }
}

module.exports = {
  admissionController,
  uploadDocuments: require("../config/s3Upload").uploadDocuments, // Ensure this matches the v3 export
};
