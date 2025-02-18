const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck');

router.post(
  '/:schoolId',
  [auth, roleCheck(['admin', 'teacher']), schoolCheck],
  announcementController.createAnnouncement
);

router.get(
  '/:schoolId',
  [auth, schoolCheck],
  announcementController.getAnnouncements
);

module.exports = router;