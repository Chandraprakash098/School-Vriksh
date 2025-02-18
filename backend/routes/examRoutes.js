const express = require('express');
const router = express.Router();
const examController = require('../controllers/examController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck');

router.post(
  '/:schoolId/schedule',
  [auth, roleCheck(['admin']), schoolCheck],
  examController.createExamSchedule
);

router.post(
  '/results/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), schoolCheck],
  examController.enterResults
);

router.get(
  '/report-cards/:examId/:classId',
  [auth, roleCheck(['teacher', 'admin']), schoolCheck],
  examController.generateReportCards
);

module.exports = router;