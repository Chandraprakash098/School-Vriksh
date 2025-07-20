const express = require("express");
const router = express.Router();
const { clerkController } = require("../controllers/clerkController");
const { certificateUpload } = require("../config/s3Upload");
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

router.use(auth, roleCheck(["clerk"]));

router.get("/dashboard", clerkController.getDashboard);
router.get(
  "/applications/pending-verification",
  clerkController.getPendingVerifications
);

router.put("/verify/:applicationId", clerkController.clerkVerification);
router.get("/classes/available", clerkController.getAvailableClasses);
router.post("/enroll/:applicationId", clerkController.enrollStudent);
router.put("/verify-documents/:studentId", clerkController.verifyDocuments);

router.get("/students/class/:classId", clerkController.getStudentsByClass);

router.post("/leave-requests", clerkController.requestLeave);
router.get("/leave-status", clerkController.getLeaveStatus);

router.get("/certificates/pending", clerkController.getPendingCertificates);
router.get("/certificates/history", clerkController.getCertificateHistory);
router.get("/certificates/verify-serial/:serialNumber", clerkController.verifyCertificateBySerial);

router.post(
  "/certificates/:certificateId/generate",
  clerkController.generateCertificate
);
router.post(
  "/certificates/:certificateId/upload-signed",
  certificateUpload,
  clerkController.uploadSignedCertificate
);
router.post(
  "/certificates/:certificateId/send-to-student",
  clerkController.sendCertificateToStudent
);

router.get(
  "/documents/:applicationId/:documentKey",
  clerkController.streamDocument
);
router.get(
  "/certificates/:certificateId/:documentKey",
  clerkController.streamCertificate
);

router.post("/rte-report/:schoolId", clerkController.generateRTEReport);

router.get(
  "/application/:applicationId/documents",
  clerkController.viewApplicationDocuments
);

router.post(
  "/register-existing-student",
  clerkController.registerExistingStudent
);

router.get(
  "/admission-history/:grNumber",
  clerkController.getAdmissionHistoryByGRNumber
);

router.post("/upgrade-student-class", clerkController.upgradeStudentClass);
module.exports = router;
