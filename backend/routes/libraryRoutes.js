// const express = require('express');
// const router = express.Router();
// const libraryController = require('../controllers/libraryController');
// const auth = require('../middleware/auth');
// const roleCheck = require('../middleware/roleCheck');
// const schoolCheck = require('../middleware/schoolCheck');

// router.post(
//   '/:schoolId/books',
//   [auth, roleCheck(['librarian', 'admin']), schoolCheck],
//   libraryController.addBook
// );

// router.post(
//   '/:schoolId/books/:bookId/issue/:userId',
//   [auth, roleCheck(['librarian']), schoolCheck],
//   libraryController.issueBook
// );

// router.put(
//   '/issue/:issueId/return',
//   [auth, roleCheck(['librarian']), schoolCheck],
//   libraryController.returnBook
// );

// module.exports = router;


// const express = require('express');
// const router = express.Router();
// const libraryController = require('../controllers/libraryController');
// const authMiddleware = require("../middleware/auth");
// const { uploadBookCover } = require('../config/s3Upload'); // Use the upload middleware from s3Upload

// // Library routes (accessible to librarians with canManageLibrary permission)
// router.post('/books', authMiddleware, libraryController.addBook);
// router.put('/books/:bookId', authMiddleware, libraryController.updateBook);
// router.delete('/books/:bookId', authMiddleware, libraryController.deleteBook);
// router.get('/requests', authMiddleware, libraryController.getBookIssueRequests);
// router.post('/books/:bookId/issue/:studentId', authMiddleware, libraryController.issueBook);
// router.post('/requests/reject/:requestId', authMiddleware, libraryController.rejectBookRequest);
// router.post('/books/return/:issueId', authMiddleware, libraryController.returnBook);
// router.get('/stats', authMiddleware, libraryController.getLibraryStats);
// router.get('/search', authMiddleware, libraryController.searchBooks);
// router.get('/overdue', authMiddleware, libraryController.getOverdueBooks);
// // router.post('/books/:bookId/cover', authMiddleware, libraryController.uploadBookCover);
// router.post(
//   '/books/:bookId/cover',
//   authMiddleware,
//   (req, res, next) => {
//     // Handle Multer upload
//     uploadBookCover(req, res, (err) => {
//       if (err instanceof multer.MulterError) {
//         // A Multer error occurred during upload
//         return res.status(400).json({ 
//           success: false,
//           error: err.message 
//         });
//       } else if (err) {
//         // An unknown error occurred
//         return res.status(500).json({ 
//           success: false,
//           error: err.message 
//         });
//       }
//       // Everything went fine, proceed to controller
//       next();
//     });
//   },
//   libraryController.uploadBookCover
// );
// router.post('/update-overdue', authMiddleware, libraryController.updateOverdueStatus);
// module.exports = router;




// const express = require('express');
// const router = express.Router();
// const libraryController = require('../controllers/libraryController');
// const authMiddleware = require("../middleware/auth");
// const { uploadBookCover } = require('../config/s3Upload');
// const multer = require('multer');

// const csvUpload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'text/csv') {
//       cb(null, true);
//     } else {
//       cb(new Error('Only CSV files are allowed for bulk import'), false);
//     }
//   },
// }).single('csvFile');

// // Library routes (accessible to librarians with canManageLibrary permission)
// router.post('/books', authMiddleware, libraryController.addBook);
// router.post('/bulk-import', authMiddleware, csvUpload, libraryController.bulkImportBooks);
// router.put('/books/:bookId', authMiddleware, libraryController.updateBook);
// router.delete('/books/:bookId', authMiddleware, libraryController.deleteBook);
// router.get('/requests', authMiddleware, libraryController.getBookIssueRequests);
// router.post('/books/:bookId/issue/:studentId', authMiddleware, libraryController.issueBook);
// router.post('/books/:bookId/issue/gr/:grNumber', authMiddleware, libraryController.issueBook);
// router.post('/requests/reject/:requestId', authMiddleware, libraryController.rejectBookRequest);
// router.post('/books/return/:issueId', authMiddleware, libraryController.returnBook);
// router.get('/stats', authMiddleware, libraryController.getLibraryStats);
// router.get('/search', authMiddleware, libraryController.searchBooks);
// router.get('/overdue', authMiddleware, libraryController.getOverdueBooks);
// // router.post('/books/:bookId/cover', authMiddleware, uploadBookCover, libraryController.uploadBookCover);
// router.post('/books/:bookId/cover', authMiddleware, libraryController.uploadBookCover);
// router.post('/update-overdue', authMiddleware, libraryController.updateOverdueStatus);
// router.post('/categories', authMiddleware, libraryController.manageCategories);
// router.put('/categories/:categoryId', authMiddleware, libraryController.manageCategories);
// router.delete('/categories/:categoryId', authMiddleware, libraryController.manageCategories);
// router.get('/categories', authMiddleware, libraryController.manageCategories);
// router.get('/student/:studentId/history', authMiddleware, libraryController.getStudentBookHistory);
// router.get('/student/gr/:grNumber/history', authMiddleware, libraryController.getStudentBookHistory);
// router.get('/my-history', authMiddleware, libraryController.getMyBookHistory);
// router.post('/:studentId/library/reserve-book/:bookId', authMiddleware, libraryController.reserveBook);
// router.get("/classes", authMiddleware,  libraryController.getClasses);
// module.exports = router;



const express = require('express');
const router = express.Router();
const libraryController = require('../controllers/libraryController');
const authMiddleware = require("../middleware/auth");
const multer = require('multer');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed for bulk import'), false);
    }
  },
}).single('csvFile');

router.post('/books', authMiddleware, libraryController.addBook);
router.get('/all-books', authMiddleware, libraryController.getAllBooks);
router.post('/bulk-import', authMiddleware, csvUpload, libraryController.bulkImportBooks);
router.put('/books/:bookId', authMiddleware, libraryController.updateBook);
router.delete('/books/:bookId', authMiddleware, libraryController.deleteBook);
router.get('/requests', authMiddleware, libraryController.getBookIssueRequests);
router.post('/books/:bookId/issue/:studentId', authMiddleware, libraryController.issueBook);
router.post('/books/:bookId/issue/gr/:grNumber', authMiddleware, libraryController.issueBook);
router.post('/requests/reject/:requestId', authMiddleware, libraryController.rejectBookRequest);
router.post('/books/return/:issueId', authMiddleware, libraryController.returnBook);
router.post('/books/pardon-fine/:issueId', authMiddleware, libraryController.pardonFine);
router.get('/stats', authMiddleware, libraryController.getLibraryStats);
router.get('/search', authMiddleware, libraryController.searchBooks);
router.get('/overdue', authMiddleware, libraryController.getOverdueBooks);
router.post('/books/:bookId/cover', authMiddleware, libraryController.uploadBookCover);
router.post('/update-overdue', authMiddleware, libraryController.updateOverdueStatus);
router.post('/categories', authMiddleware, libraryController.manageCategories);
router.put('/categories/:categoryId', authMiddleware, libraryController.manageCategories);
router.delete('/categories/:categoryId', authMiddleware, libraryController.manageCategories);
router.get('/categories', authMiddleware, libraryController.manageCategories);
router.get('/student/:studentId/history', authMiddleware, libraryController.getStudentBookHistory);
router.get('/student/gr/:grNumber/history', authMiddleware, libraryController.getStudentBookHistory);
router.get('/my-history', authMiddleware, libraryController.getMyBookHistory);
router.post('/:studentId/library/reserve-book/:bookId', authMiddleware, libraryController.reserveBook);
router.get("/classes", authMiddleware, libraryController.getClasses);
router.post('/books/renew/:issueId', authMiddleware, libraryController.renewBook);
router.get('/audit-logs', authMiddleware, libraryController.getAuditLogs); 

module.exports = router;