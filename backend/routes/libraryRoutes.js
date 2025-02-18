const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const schoolCheck = require('../middleware/schoolCheck');

router.post(
  '/:schoolId/books',
  [auth, roleCheck(['librarian', 'admin']), schoolCheck],
  libraryController.addBook
);

router.post(
  '/:schoolId/books/:bookId/issue/:userId',
  [auth, roleCheck(['librarian']), schoolCheck],
  libraryController.issueBook
);

router.put(
  '/issue/:issueId/return',
  [auth, roleCheck(['librarian']), schoolCheck],
  libraryController.returnBook
);

module.exports = router;