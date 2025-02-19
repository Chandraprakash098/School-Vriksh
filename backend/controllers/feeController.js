const AdmissionForm = require('../models/AdmissionForm');
const AdmissionApplication = require('../models/AdmissionApplication');



const feesController = {
    getPendingFees: async (req, res) => {
      try {
        const applications = await AdmissionApplication.find({
          status: 'fees_pending',
          admissionType: 'Regular',
          paymentStatus: 'completed',
          'feesVerification.status': 'pending'
        }).sort({ createdAt: -1 });
        
        res.json({
          status: 'success',
          applications: applications.map(app => ({
            id: app._id,
            trackingId: app.trackingId,
            studentName: app.studentDetails.name,
            paymentDetails: app.paymentDetails
          }))
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    },
  
    verifyFees: async (req, res) => {
      try {
        const { applicationId } = req.params;
        const { status, receiptNumber } = req.body;
  
        const application = await AdmissionApplication.findById(applicationId);
        
        application.feesVerification = {
          status,
          verifiedBy: req.user._id,
          verifiedAt: new Date(),
          receiptNumber
        };
  
        application.status = status === 'verified' ? 'approved' : 'rejected';
        await application.save();
  
        res.json({
          message: 'Fees verification completed',
          nextStep: getNextStep(application)
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    }
  };
  
  // Helper Functions
  function getNextStep(application) {
    switch(application.status) {
      case 'pending':
        return application.admissionType === 'RTE' ? 
          'Visit clerk for verification' : 
          'Complete payment and visit clerk';
      case 'document_verification':
        return 'Awaiting document verification';
      case 'fees_pending':
        return 'Visit fees department';
      case 'approved':
        return 'Return to clerk for enrollment';
      case 'enrolled':
        return 'Admission completed';
      case 'rejected':
        return 'Application rejected';
      default:
        return 'Contact administration';
    }
  }
  
  function getApplicationTimeline(application) {
    return [
      {
        stage: 'Application Submitted',
        date: application.createdAt,
        completed: true
      },
      {
        stage: 'Payment',
        date: application.paymentDetails?.paidAt,
        completed: application.paymentStatus === 'completed' || 
                  application.admissionType === 'RTE'
      },
      {
        stage: 'Document Verification',
        date: application.clerkVerification?.verifiedAt,
        completed: application.clerkVerification?.status === 'verified'
      },
      {
        stage: 'Fees Verification',
        date: application.feesVerification?.verifiedAt,
        completed: application.feesVerification?.status === 'verified' || 
                  application.admissionType === 'RTE'
      },
      {
        stage: 'Enrollment',
        date: application.status === 'enrolled' ? new Date() : null,
        completed: application.status === 'enrolled'
      }
    ];
  }
  
  function generateAdmissionStats(applications) {
    return {
      totalApplications: applications.length,
      byStatus: {
        pending: applications.filter(app => app.status === 'pending').length,
        verified: applications.filter(app => 
          app.status === 'document_verification').length,
        feesPending: applications.filter(app => 
          app.status === 'fees_pending').length,
        approved: applications.filter(app => app.status === 'approved').length,
        enrolled: applications.filter(app => app.status === 'enrolled').length,
        rejected: applications.filter(app => app.status === 'rejected').length
      },
      byAdmissionType: {
        regular: applications.filter(app => 
          app.admissionType === 'Regular').length,
        rte: applications.filter(app => app.admissionType === 'RTE').length
      }
    };
  }
  
  module.exports = {
    feesController
  };