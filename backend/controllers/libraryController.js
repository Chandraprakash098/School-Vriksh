


// const mongoose = require('mongoose');
// const logger = require('../utils/logger');
// // const { Library, BookIssue } = require('../models/Library');
// const User = require('../models/User');
// const { uploadToS3, getPublicFileUrl } = require('../config/s3Upload');
// const path = require('path');
// const sharp = require('sharp');
// const multer = require('multer');
// const { uploadBookCover } = require('../config/s3Upload');
// const libraryModelFactory = require('../models/Library');


// // Configure Multer for memory storage
// const storage = multer.memoryStorage();
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter: (req, file, cb) => {
//     logger.info('Processing book cover upload', {
//       fieldname: file.fieldname,
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//     });
//     const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       const error = new Error('Only JPEG, PNG, and JPG files are allowed for book covers');
//       logger.error('File type rejected', { mimetype: file.mimetype });
//       cb(error, false);
//     }
//   },
// }).single('cover');

// const libraryController = {
//   // Add a new book to the library
//   addBook: async (req, res) => {
//     try {
//       const { bookTitle, author, isbn, category, totalCopies, description } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       // Get the models using the correct import
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!bookTitle || !author || !isbn || !totalCopies || !category) {
//         return res.status(400).json({ message: 'All required fields must be provided' });
//       }

//       const existingBook = await LibraryModel.findOne({ isbn, school: schoolId });
//       if (existingBook) {
//         return res.status(400).json({ message: 'Book with this ISBN already exists' });
//       }

//       const book = new LibraryModel({
//         school: schoolId,
//         bookTitle,
//         author,
//         isbn,
//         category,
//         totalCopies,
//         availableCopies: totalCopies,
//         description,
//         status: 'available',
//       });

//       await book.save();
//       logger.info(`Book added: ${bookTitle} by ${author}`, { schoolId, isbn });
//       res.status(201).json({ message: 'Book added successfully', book });
//     } catch (error) {
//       logger.error(`Error adding book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Update book details
//   updateBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const { bookTitle, author, isbn, category, totalCopies, description, status } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       const updates = {
//         bookTitle: bookTitle || book.bookTitle,
//         author: author || book.author,
//         isbn: isbn || book.isbn,
//         category: category || book.category,
//         totalCopies: totalCopies || book.totalCopies,
//         description: description || book.description,
//         status: status || book.status,
//       };

//       if (totalCopies) {
//         const issuedCopies = book.totalCopies - book.availableCopies;
//         updates.availableCopies = totalCopies - issuedCopies;
//         if (updates.availableCopies < 0) {
//           return res.status(400).json({ message: 'Cannot reduce total copies below issued copies' });
//         }
//       }

//       Object.assign(book, updates);
//       await book.save();
//       logger.info(`Book updated: ${bookTitle || book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book updated successfully', book });
//     } catch (error) {
//       logger.error(`Error updating book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Delete a book
//   deleteBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       if (book.availableCopies < book.totalCopies) {
//         return res.status(400).json({ message: 'Cannot delete book with issued copies' });
//       }

//       // Delete book cover from S3 if it exists
//       if (book.coverImage) {
//         const key = book.coverImage.split('/').slice(-3).join('/'); // Extract key from URL
//         await require('../config/s3Upload').deleteFromS3(key);
//       }

//       await LibraryModel.deleteOne({ _id: bookId });
//       await BookIssueModel.deleteMany({ book: bookId, school: schoolId });
//       logger.info(`Book deleted: ${book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book deleted successfully' });
//     } catch (error) {
//       logger.error(`Error deleting book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

  
//   getBookIssueRequests: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       // const BookIssueModel = BookIssue(connection);
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const pendingRequests = await BookIssueModel.find({
//         school: schoolId,
//         status: 'requested',
//       })
//         .populate('book', 'bookTitle author isbn category coverImage')
//         .populate('user', 'name studentDetails.grNumber email')
//         .sort({ issueDate: 1 }); // Sort by request date (issueDate in schema)

//       logger.info(`Fetched ${pendingRequests.length} pending book issue requests`, { schoolId });
//       res.json({
//         message: 'Pending book issue requests retrieved successfully',
//         requests: pendingRequests,
//       });
//     } catch (error) {
//       logger.error(`Error fetching book issue requests: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },



// // issueBook: async (req, res) => {
// //   try {
// //     const { bookId, studentId } = req.params;
// //     const { dueDate, requestId } = req.body; // Add requestId to handle student requests
// //     const schoolId = req.school._id.toString();
// //     const connection = req.connection;
// //     // const LibraryModel = Library(connection);
// //     // const BookIssueModel = BookIssue(connection);
// //     const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
// //     const UserModel = User(connection);
// //     const user = await UserModel.findById(req.user._id);

// //     if (!user.permissions.canManageLibrary) {
// //       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
// //     }

// //     if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(studentId)) {
// //       return res.status(400).json({ message: 'Invalid book or student ID' });
// //     }

// //     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
// //     if (!book) {
// //       return res.status(404).json({ message: 'Book not found' });
// //     }
// //     if (book.availableCopies === 0) {
// //       return res.status(400).json({ message: 'No copies available' });
// //     }

// //     const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
// //     if (!student) {
// //       return res.status(404).json({ message: 'Student not found' });
// //     }

// //     // Check borrowing limit
// //     const activeIssues = await BookIssueModel.countDocuments({
// //       user: studentId,
// //       school: schoolId,
// //       status: { $in: ['issued', 'overdue'] },
// //     });
// //     if (activeIssues >= 3) {
// //       return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
// //     }

// //     let issue;
// //     if (requestId) {
// //       // Handle existing student request
// //       if (!mongoose.Types.ObjectId.isValid(requestId)) {
// //         return res.status(400).json({ message: 'Invalid request ID' });
// //       }

// //       issue = await BookIssueModel.findOne({
// //         _id: requestId,
// //         book: bookId,
// //         user: studentId,
// //         school: schoolId,
// //         status: 'requested',
// //       });

// //       if (!issue) {
// //         return res.status(404).json({ message: 'Book request not found or already processed' });
// //       }

// //       // Update the existing request to issued
// //       issue.status = 'issued';
// //       issue.issueDate = new Date();
// //       issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
// //     } else {
// //       // Create a new issue (direct issuance by librarian)
// //       const existingIssue = await BookIssueModel.findOne({
// //         book: bookId,
// //         user: studentId,
// //         school: schoolId,
// //         status: { $in: ['issued', 'overdue'] },
// //       });
// //       if (existingIssue) {
// //         return res.status(400).json({ message: 'This book is already issued to the student' });
// //       }

// //       issue = new BookIssueModel({
// //         school: schoolId,
// //         book: bookId,
// //         user: studentId,
// //         issueDate: new Date(),
// //         dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
// //         status: 'issued',
// //       });
// //     }

// //     book.availableCopies -= 1;
// //     if (book.availableCopies === 0) {
// //       book.status = 'unavailable';
// //     }

// //     await Promise.all([issue.save(), book.save()]);
// //     logger.info(`Book issued: ${book.bookTitle} to student ${studentId}`, { schoolId, requestId: requestId || 'direct' });
// //     res.json({ message: 'Book issued successfully', issue });
// //   } catch (error) {
// //     logger.error(`Error issuing book: ${error.message}`, { error });
// //     res.status(500).json({ error: error.message });
// //   }
// // },

// issueBook: async (req, res) => {
//   try {
//     const { bookId, studentId } = req.params;
//     const { dueDate, requestId } = req.body;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//     const UserModel = User(connection);
//     const user = await UserModel.findById(req.user._id);

//     if (!user.permissions.canManageLibrary) {
//       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(studentId)) {
//       return res.status(400).json({ message: 'Invalid book or student ID' });
//     }

//     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//     if (!book) {
//       return res.status(404).json({ message: 'Book not found' });
//     }
//     if (book.availableCopies === 0) {
//       return res.status(400).json({ message: 'No copies available' });
//     }

//     const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//     if (!student) {
//       return res.status(404).json({ message: 'Student not found' });
//     }

//     // Check borrowing limit
//     const activeIssues = await BookIssueModel.countDocuments({
//       user: studentId,
//       school: schoolId,
//       status: { $in: ['issued', 'overdue'] },
//     });
//     if (activeIssues >= 3) {
//       return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
//     }

//     let issue;

//     // Check for an existing pending request even if requestId is not provided
//     const existingRequest = await BookIssueModel.findOne({
//       book: bookId,
//       user: studentId,
//       school: schoolId,
//       status: 'requested',
//     });

//     if (requestId) {
//       // Handle issuance from a specific request
//       if (!mongoose.Types.ObjectId.isValid(requestId)) {
//         return res.status(400).json({ message: 'Invalid request ID' });
//       }

//       issue = await BookIssueModel.findOne({
//         _id: requestId,
//         book: bookId,
//         user: studentId,
//         school: schoolId,
//         status: 'requested',
//       });

//       if (!issue) {
//         return res.status(404).json({ message: 'Book request not found or already processed' });
//       }

//       // Update the existing request to issued
//       issue.status = 'issued';
//       issue.issueDate = new Date();
//       issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
//     } else if (existingRequest) {
//       // If no requestId is provided but a pending request exists, use it
//       issue = existingRequest;
//       issue.status = 'issued';
//       issue.issueDate = new Date();
//       issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
//     } else {
//       // Check if the book is already issued to the student
//       const existingIssue = await BookIssueModel.findOne({
//         book: bookId,
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       });
//       if (existingIssue) {
//         return res.status(400).json({ message: 'This book is already issued to the student' });
//       }

//       // Create a new issue (direct issuance by librarian)
//       issue = new BookIssueModel({
//         school: schoolId,
//         book: bookId,
//         user: studentId,
//         issueDate: new Date(),
//         dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
//         status: 'issued',
//       });
//     }

//     book.availableCopies -= 1;
//     if (book.availableCopies === 0) {
//       book.status = 'unavailable';
//     }

//     await Promise.all([issue.save(), book.save()]);
//     logger.info(`Book issued: ${book.bookTitle} to student ${studentId}`, { schoolId, requestId: requestId || 'direct' });
//     res.json({ message: 'Book issued successfully', issue });
//   } catch (error) {
//     logger.error(`Error issuing book: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// },

// rejectBookRequest: async (req, res) => {
//   try {
//     const { requestId } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const { BookIssue: BookIssueModel } = libraryModelFactory(connection);
//     const UserModel = User(connection);
//     const user = await UserModel.findById(req.user._id);

//     if (!user.permissions.canManageLibrary) {
//       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(requestId)) {
//       return res.status(400).json({ message: 'Invalid request ID' });
//     }

//     const issue = await BookIssueModel.findOne({ _id: requestId, school: schoolId, status: 'requested' });
//     if (!issue) {
//       return res.status(404).json({ message: 'Book request not found or already processed' });
//     }

//     issue.status = 'rejected';
//     await issue.save();

//     logger.info(`Book request rejected: ${issue.book} for student ${issue.user}`, { schoolId, requestId });
//     res.json({ message: 'Book request rejected successfully', issue });
//   } catch (error) {
//     logger.error(`Error rejecting book request: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// },

//   // Return a book
//   returnBook: async (req, res) => {
//     try {
//       const { issueId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       // const LibraryModel = Library(connection);
//       // const BookIssueModel = BookIssue(connection);
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(issueId)) {
//         return res.status(400).json({ message: 'Invalid issue ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book issue record not found' });
//       }
//       if (issue.status === 'returned') {
//         return res.status(400).json({ message: 'Book already returned' });
//       }

//       const book = await LibraryModel.findOne({ _id: issue.book, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       const today = new Date();
//       const fine = issue.dueDate < today ? Math.ceil((today - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5 : 0;

//       issue.status = 'returned';
//       issue.returnDate = new Date();
//       issue.fine = fine;
//       book.availableCopies += 1;
//       book.status = 'available';

//       await Promise.all([issue.save(), book.save()]);
//       logger.info(`Book returned: ${book.bookTitle} by student ${issue.user}`, { schoolId, fine });
//       res.json({ message: 'Book returned successfully', issue });
//     } catch (error) {
//       logger.error(`Error returning book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get library statistics
//   getLibraryStats: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       // const LibraryModel = Library(connection);
//       // const BookIssueModel = BookIssue(connection);
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const totalBooks = await LibraryModel.countDocuments({ school: schoolId });
//       const availableBooks = await LibraryModel.countDocuments({ school: schoolId, status: 'available' });
//       const issuedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'issued' });
//       const overdueBooks = await BookIssueModel.countDocuments({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       });

//       const totalFines = await BookIssueModel.aggregate([
//         { $match: { school: new mongoose.Types.ObjectId(schoolId), fine: { $gt: 0 } } },
//         { $group: { _id: null, total: { $sum: '$fine' } } },
//       ]);

//       logger.info(`Library stats fetched`, { schoolId });
//       res.json({
//         totalBooks,
//         availableBooks,
//         issuedBooks,
//         overdueBooks,
//         totalFines: totalFines.length > 0 ? totalFines[0].total : 0,
//       });
//     } catch (error) {
//       logger.error(`Error fetching library stats: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Search books
//   searchBooks: async (req, res) => {
//     try {
//       const { query, category } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       const LibraryModel = Library(connection);

//       const searchCriteria = { school: schoolId };
//       if (query) {
//         searchCriteria.$or = [
//           { bookTitle: { $regex: query, $options: 'i' } },
//           { author: { $regex: query, $options: 'i' } },
//           { isbn: { $regex: query, $options: 'i' } },
//         ];
//       }
//       if (category) {
//         searchCriteria.category = category;
//       }

//       const books = await LibraryModel.find(searchCriteria)
//         .select('bookTitle author isbn category totalCopies availableCopies status coverImage')
//         .sort({ bookTitle: 1 });

//       logger.info(`Books searched: ${query || category}`, { schoolId });
//       res.json({ books });
//     } catch (error) {
//       logger.error(`Error searching books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get overdue books
//   getOverdueBooks: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
      
//       const BookIssueModel = BookIssue(connection);
//       const UserModel = User(connection);
//       const user = await UserModel.findById(req.user._id);

//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const overdueBooks = await BookIssueModel.find({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       })
//         .populate('book', 'bookTitle author isbn')
//         .populate('user', 'name studentDetails.grNumber');

//       const booksWithFine = overdueBooks.map((issue) => {
//         const fine = Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)),
//         };
//       });

//       logger.info(`Overdue books fetched`, { schoolId });
//       res.json({ overdueBooks: booksWithFine });
//     } catch (error) {
//       logger.error(`Error fetching overdue books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

  


  

// uploadBookCover: async (req, res) => {
//   try {
//     const { bookId } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const { Library: LibraryModel } = libraryModelFactory(connection);
//     const UserModel = User(connection);
//     const user = await UserModel.findById(req.user._id);

//     // Permission check
//     if (!user.permissions.canManageLibrary) {
//       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(bookId)) {
//       return res.status(400).json({ message: 'Invalid book ID' });
//     }

//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     // Validate image
//     const metadata = await sharp(req.file.buffer).metadata();
//     if (metadata.width < 200 || metadata.height < 200) {
//       return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
//     }

//     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//     if (!book) {
//       return res.status(404).json({ message: 'Book not found' });
//     }

//     // Delete old cover if exists
//     if (book.coverImage) {
//       try {
//         const oldKey = book.coverImage.split('/').slice(-3).join('/');
//         await deleteFromS3(oldKey);
//       } catch (deleteError) {
//         logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
//       }
//     }

//     // Generate S3 key and upload
//     const fileExt = path.extname(req.file.originalname);
//     const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
//     const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
//     const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

//     // Update book record
//     book.coverImage = coverUrl;
//     await book.save();

//     logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
//     res.json({ 
//       success: true,
//       message: 'Book cover uploaded successfully',
//       coverUrl 
//     });
//   } catch (error) {
//     logger.error(`Error uploading book cover: ${error.message}`, { error });
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// },



//   updateOverdueStatus : async (req, res) => {
//   try {
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const BookIssueModel = BookIssue(connection);
//     const UserModel = User(connection);
//     const user = await UserModel.findById(req.user._id);

//     if (!user.permissions.canManageLibrary) {
//       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//     }

//     const updatedIssues = await BookIssueModel.updateMany(
//       {
//         school: schoolId,
//         status: 'issued',
//         dueDate: { $lt: new Date() },
//       },
//       { $set: { status: 'overdue' } }
//     );

//     logger.info(`Updated ${updatedIssues.modifiedCount} book issues to overdue status`, { schoolId });
//     res.json({ message: `Updated ${updatedIssues.modifiedCount} book issues to overdue status` });
//   } catch (error) {
//     logger.error(`Error updating overdue status: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// }
// }

// module.exports = libraryController;






// const mongoose = require('mongoose');
// const logger = require('../utils/logger');
// const User = require('../models/User');
// const getModel = require("../models/index");
// const { uploadToS3, getPublicFileUrl, deleteFromS3 } = require('../config/s3Upload');
// const path = require('path');
// const sharp = require('sharp');
// const multer = require('multer');
// const libraryModelFactory = require('../models/Library');
// const { sendEmail } = require('../utils/notifications'); // Hypothetical email service
// const csv = require('csv-parse');
// const { Readable } = require('stream');

// // Configure Multer for memory storage
// const storage = multer.memoryStorage();
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
//   fileFilter: (req, file, cb) => {
//     logger.info('Processing book cover upload', {
//       fieldname: file.fieldname,
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//     });
//     const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       const error = new Error('Only JPEG, PNG, and JPG files are allowed for book covers');
//       logger.error('File type rejected', { mimetype: file.mimetype });
//       cb(error, false);
//     }
//   },
// }).single('cover');

// const csvUpload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for CSV
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'text/csv') {
//       cb(null, true);
//     } else {
//       cb(new Error('Only CSV files are allowed for bulk import'), false);
//     }
//   },
// }).single('csvFile');

// const libraryController = {
//   // Add a new book to the library
//   addBook: async (req, res) => {
//     try {
//       const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!bookTitle || !author || !isbn || !totalCopies || !category) {
//         return res.status(400).json({ message: 'All required fields must be provided' });
//       }

//       const existingBook = await LibraryModel.findOne({ isbn, school: schoolId });
//       if (existingBook) {
//         return res.status(400).json({ message: 'Book with this ISBN already exists' });
//       }

//       // Validate category
//       // const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
//       // if (!categoryExists) {
//       //   return res.status(400).json({ message: 'Invalid category' });
//       // }

//       const book = new LibraryModel({
//         school: schoolId,
//         bookTitle,
//         author,
//         isbn,
//         category,
//         class: classId || null,
//         isGeneral: isGeneral !== undefined ? isGeneral : true,
//         totalCopies,
//         availableCopies: totalCopies,
//         description,
//         publisher,
//         publicationYear,
//         language,
//         status: 'available',
//       });

//       await book.save();
//       logger.info(`Book added: ${bookTitle} by ${author}`, { schoolId, isbn });
//       res.status(201).json({ message: 'Book added successfully', book });
//     } catch (error) {
//       logger.error(`Error adding book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Bulk import books via CSV
//   bulkImportBooks: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!req.file) {
//         return res.status(400).json({ message: 'No CSV file uploaded' });
//       }

//       const books = [];
//       const errors = [];
//       const stream = Readable.from(req.file.buffer.toString());
//       stream
//         .pipe(csv.parse({ columns: true }))
//         .on('data', (row) => {
//           books.push({
//             school: schoolId,
//             bookTitle: row.bookTitle,
//             author: row.author,
//             isbn: row.isbn,
//             category: row.category,
//             class: row.classId || null,
//             isGeneral: row.isGeneral === 'true',
//             totalCopies: parseInt(row.totalCopies),
//             availableCopies: parseInt(row.totalCopies),
//             publisher: row.publisher,
//             publicationYear: parseInt(row.publicationYear),
//             language: row.language || 'English',
//             description: row.description,
//             status: 'available',
//           });
//         })
//         .on('end', async () => {
//           for (const book of books) {
//             try {
//               const existingBook = await LibraryModel.findOne({ isbn: book.isbn, school: schoolId });
//               if (existingBook) {
//                 errors.push(`Book with ISBN ${book.isbn} already exists`);
//                 continue;
//               }
//               // const categoryExists = await CategoryModel.findOne({ name: book.category, school: schoolId });
//               // if (!categoryExists) {
//               //   errors.push(`Invalid category ${book.category} for ISBN ${book.isbn}`);
//               //   continue;
//               // }
//               await new LibraryModel(book).save();
//             } catch (error) {
//               errors.push(`Error importing book ${book.isbn}: ${error.message}`);
//             }
//           }
//           logger.info(`Bulk import completed: ${books.length - errors.length} books imported`, { schoolId, errors });
//           res.json({ message: 'Bulk import completed', imported: books.length - errors.length, errors });
//         })
//         .on('error', (error) => {
//           logger.error(`Error parsing CSV: ${error.message}`, { error });
//           res.status(500).json({ error: error.message });
//         });
//     } catch (error) {
//       logger.error(`Error in bulk import: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Update book details
//   updateBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral, status } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       if (category) {
//         const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
//         if (!categoryExists) {
//           return res.status(400).json({ message: 'Invalid category' });
//         }
//       }

//       const updates = {
//         bookTitle: bookTitle || book.bookTitle,
//         author: author || book.author,
//         isbn: isbn || book.isbn,
//         category: category || book.category,
//         class: classId || book.class,
//         isGeneral: isGeneral !== undefined ? isGeneral : book.isGeneral,
//         totalCopies: totalCopies || book.totalCopies,
//         description: description || book.description,
//         publisher: publisher || book.publisher,
//         publicationYear: publicationYear || book.publicationYear,
//         language: language || book.language,
//         status: status || book.status,
//       };

//       if (totalCopies) {
//         const issuedCopies = book.totalCopies - book.availableCopies;
//         updates.availableCopies = totalCopies - issuedCopies;
//         if (updates.availableCopies < 0) {
//           return res.status(400).json({ message: 'Cannot reduce total copies below issued copies' });
//         }
//       }

//       Object.assign(book, updates);
//       await book.save();
//       logger.info(`Book updated: ${bookTitle || book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book updated successfully', book });
//     } catch (error) {
//       logger.error(`Error updating book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Delete a book
//   deleteBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       if (book.availableCopies < book.totalCopies) {
//         return res.status(400).json({ message: 'Cannot delete book with issued copies' });
//       }

//       if (book.coverImage) {
//         const key = book.coverImage.split('/').slice(-3).join('/');
//         await deleteFromS3(key);
//       }

//       await LibraryModel.deleteOne({ _id: bookId });
//       await BookIssueModel.deleteMany({ book: bookId, school: schoolId });
//       logger.info(`Book deleted: ${book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book deleted successfully' });
//     } catch (error) {
//       logger.error(`Error deleting book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Upload book cover
//   // uploadBookCover: async (req, res) => {
//   //   try {
//   //     const { bookId } = req.params;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const { Library: LibraryModel } = libraryModelFactory(connection);
//   //     const UserModel = User(connection);

//   //     const user = await UserModel.findById(req.user._id);
//   //     if (!user.permissions.canManageLibrary) {
//   //       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//   //     }

//   //     if (!mongoose.Types.ObjectId.isValid(bookId)) {
//   //       return res.status(400).json({ message: 'Invalid book ID' });
//   //     }

//   //     if (!req.file) {
//   //       return res.status(400).json({ message: 'No file uploaded' });
//   //     }

//   //     const metadata = await sharp(req.file.buffer).metadata();
//   //     if (metadata.width < 200 || metadata.height < 200) {
//   //       return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
//   //     }

//   //     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//   //     if (!book) {
//   //       return res.status(404).json({ message: 'Book not found' });
//   //     }

//   //     if (book.coverImage) {
//   //       try {
//   //         const oldKey = book.coverImage.split('/').slice(-3).join('/');
//   //         await deleteFromS3(oldKey);
//   //       } catch (deleteError) {
//   //         logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
//   //       }
//   //     }

//   //     const fileExt = path.extname(req.file.originalname);
//   //     const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
//   //     const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
//   //     const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

//   //     book.coverImage = coverUrl;
//   //     await book.save();

//   //     logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
//   //     res.json({
//   //       success: true,
//   //       message: 'Book cover uploaded successfully',
//   //       coverUrl,
//   //     });
//   //   } catch (error) {
//   //     logger.error(`Error uploading book cover: ${error.message}`, { error });
//   //     res.status(500).json({
//   //       success: false,
//   //       error: error.message,
//   //     });
//   //   }
//   // },



//   uploadBookCover: async (req, res) => {
//   try {
//     upload(req, res, async (err) => {
//       if (err) {
//         logger.error(`Multer error: ${err.message}`, { error: err });
//         return res.status(400).json({ error: err.message });
//       }

//       const { bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.dbConnection; // Fixed: Use dbConnection consistently
//       const { Library: LibraryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       if (!req.file) {
//         return res.status(400).json({ message: 'No file uploaded' });
//       }

//       // Validate image dimensions
//       const metadata = await sharp(req.file.buffer).metadata();
//       if (metadata.width < 200 || metadata.height < 200) {
//         return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       // Delete old cover if exists
//       if (book.coverImage) {
//         try {
//           const oldKey = book.coverImage.split('/').slice(-3).join('/');
//           await deleteFromS3(oldKey);
//         } catch (deleteError) {
//           logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
//         }
//       }

//       // Upload new cover to S3
//       const fileExt = path.extname(req.file.originalname).toLowerCase();
//       const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
//       const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
//       const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

//       book.coverImage = coverUrl;
//       await book.save();

//       logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
//       res.json({
//         success: true,
//         message: 'Book cover uploaded successfully',
//         coverUrl,
//       });
//     });
//   } catch (error) {
//     logger.error(`Error uploading book cover: ${error.message}`, { error });
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// },

// getClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Class = getModel("Class", connection);
//       const User = getModel("User", connection);
//       const Subject= getModel("Subject",connection)

//       const classes = await Class.find({ school: schoolId })
//         .populate("classTeacher", "name email profile", User)
//         .populate("subjects", "name")
//         .sort({ name: 1, division: 1 })
//         .lean();

//       res.json(classes);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },


//   // Get book issue requests
//   getBookIssueRequests: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const pendingRequests = await BookIssueModel.find({
//         school: schoolId,
//         status: { $in: ['requested', 'reserved'] },
//       })
//         .populate('book', 'bookTitle author isbn category coverImage class isGeneral')
//         .populate('user', 'name studentDetails.grNumber email studentDetails.class')
//         .sort({ issueDate: 1 });

//       logger.info(`Fetched ${pendingRequests.length} pending book issue/reservation requests`, { schoolId });
//       res.json({
//         message: 'Pending book issue requests retrieved successfully',
//         requests: pendingRequests,
//       });
//     } catch (error) {
//       logger.error(`Error fetching book issue requests: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Issue book
//   issueBook: async (req, res) => {
//     try {
//       const { bookId, studentId, grNumber } = req.params;
//       const { dueDate, requestId, remarks } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       let student;
//       if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
//         student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       } else if (grNumber) {
//         student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
//       }
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }
//       if (book.availableCopies === 0) {
//         return res.status(400).json({ message: 'No copies available' });
//       }

//       const activeIssues = await BookIssueModel.countDocuments({
//         user: student._id,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       });
//       if (activeIssues >= 3) {
//         return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
//       }

//       let issue;
//       if (requestId) {
//         if (!mongoose.Types.ObjectId.isValid(requestId)) {
//           return res.status(400).json({ message: 'Invalid request ID' });
//         }

//         issue = await BookIssueModel.findOne({
//           _id: requestId,
//           book: bookId,
//           user: student._id,
//           school: schoolId,
//           status: { $in: ['requested', 'reserved'] },
//         });

//         if (!issue) {
//           return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
//         }

//         issue.status = 'issued';
//         issue.issueDate = new Date();
//         issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
//         issue.remarks = remarks;
//       } else {
//         const existingIssue = await BookIssueModel.findOne({
//           book: bookId,
//           user: student._id,
//           school: schoolId,
//           status: { $in: ['issued', 'overdue'] },
//         });
//         if (existingIssue) {
//           return res.status(400).json({ message: 'This book is already issued to the student' });
//         }

//         issue = new BookIssueModel({
//           school: schoolId,
//           book: bookId,
//           user: student._id,
//           issueDate: new Date(),
//           dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
//           status: 'issued',
//           remarks,
//         });
//       }

//       book.availableCopies -= 1;
//       if (book.availableCopies === 0) {
//         book.status = 'unavailable';
//       }
//       if (book.reservedBy.includes(student._id)) {
//         book.reservedBy = book.reservedBy.filter(id => id.toString() !== student._id.toString());
//       }

//       await Promise.all([issue.save(), book.save()]);
//       // await sendEmail({
//       //   to: student.email,
//       //   subject: 'Book Issued Successfully',
//       //   text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been issued to you. Due date: ${issue.dueDate.toDateString()}. Please return it on time to avoid fines.\n\nRegards,\nLibrary Team`,
//       // });

//       logger.info(`Book issued: ${book.bookTitle} to student ${student._id}`, { schoolId, requestId: requestId || 'direct' });
//       res.json({ message: 'Book issued successfully', issue });
//     } catch (error) {
//       logger.error(`Error issuing book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Reject book request
//   rejectBookRequest: async (req, res) => {
//     try {
//       const { requestId } = req.params;
//       const { remarks } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(requestId)) {
//         return res.status(400).json({ message: 'Invalid request ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: requestId, school: schoolId, status: { $in: ['requested', 'reserved'] } });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
//       }

//       const student = await UserModel.findById(issue.user);
//       issue.status = 'rejected';
//       issue.remarks = remarks || 'Request rejected by librarian';
//       await issue.save();

//       await sendEmail({
//         to: student.email,
//         subject: 'Book Request Rejected',
//         text: `Dear ${student.name},\n\nYour request for the book "${(await LibraryModel.findById(issue.book)).bookTitle}" has been rejected. Reason: ${issue.remarks}.\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book request rejected: ${issue.book} for student ${issue.user}`, { schoolId, requestId });
//       res.json({ message: 'Book request rejected successfully', issue });
//     } catch (error) {
//       logger.error(`Error rejecting book request: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Return book
//   returnBook: async (req, res) => {
//     try {
//       const { issueId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(issueId)) {
//         return res.status(400).json({ message: 'Invalid issue ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book issue record not found' });
//       }
//       if (issue.status === 'returned') {
//         return res.status(400).json({ message: 'Book already returned' });
//       }

//       const book = await LibraryModel.findOne({ _id: issue.book, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       const today = new Date();
//       const fine = issue.dueDate < today ? Math.ceil((today - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5 : 0;

//       issue.status = 'returned';
//       issue.returnDate = new Date();
//       issue.fine = fine;
//       book.availableCopies += 1;
//       book.status = 'available';

//       await Promise.all([issue.save(), book.save()]);

//       const student = await UserModel.findById(issue.user);
//       await sendEmail({
//         to: student.email,
//         subject: 'Book Returned Successfully',
//         text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been returned successfully. ${fine > 0 ? `A fine of INR ${fine} has been applied. Please pay at the earliest.` : ''}\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book returned: ${book.bookTitle} by student ${issue.user}`, { schoolId, fine });
//       res.json({ message: 'Book returned successfully', issue });
//     } catch (error) {
//       logger.error(`Error returning book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Reserve a book
//   reserveBook: async (req, res) => {
//     try {
//       const { studentId, bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only reserve books for yourself' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }
//       if (book.availableCopies > 0) {
//         return res.status(400).json({ message: 'Book is available, please request instead of reserving' });
//       }

//       if (book.reservedBy.includes(studentId)) {
//         return res.status(400).json({ message: 'You have already reserved this book' });
//       }

//       const existingRecord = await BookIssueModel.findOne({
//         book: bookId,
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['requested', 'issued', 'overdue', 'reserved'] },
//       });
//       if (existingRecord) {
//         return res.status(400).json({
//           message: `Cannot reserve book: already ${existingRecord.status === 'requested' ? 'requested' : existingRecord.status === 'reserved' ? 'reserved' : 'issued or overdue'}`,
//         });
//       }

//       const reservation = new BookIssueModel({
//         school: schoolId,
//         book: bookId,
//         user: studentId,
//         issueDate: new Date(),
//         status: 'reserved',
//       });

//       book.reservedBy.push(studentId);
//       await Promise.all([reservation.save(), book.save()]);

//       const student = await UserModel.findById(studentId);
//       await sendEmail({
//         to: student.email,
//         subject: 'Book Reservation Successful',
//         text: `Dear ${student.name},\n\nYou have successfully reserved the book "${book.bookTitle}". You will be notified when it becomes available.\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book reserved: ${book.bookTitle} by student ${studentId}`, { schoolId });
//       res.status(201).json({ message: 'Book reservation submitted successfully', reservation });
//     } catch (error) {
//       logger.error(`Error reserving book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get library statistics
//   getLibraryStats: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const totalBooks = await LibraryModel.countDocuments({ school: schoolId });
//       const availableBooks = await LibraryModel.countDocuments({ school: schoolId, status: 'available' });
//       const issuedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'issued' });
//       const reservedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'reserved' });
//       const overdueBooks = await BookIssueModel.countDocuments({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       });
//       const totalFines = await BookIssueModel.aggregate([
//         { $match: { school: new mongoose.Types.ObjectId(schoolId), fine: { $gt: 0 } } },
//         { $group: { _id: null, total: { $sum: '$fine' } } },
//       ]);

//       logger.info(`Library stats fetched`, { schoolId });
//       res.json({
//         totalBooks,
//         availableBooks,
//         issuedBooks,
//         reservedBooks,
//         overdueBooks,
//         totalFines: totalFines.length > 0 ? totalFines[0].total : 0,
//       });
//     } catch (error) {
//       logger.error(`Error fetching library stats: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Search books (accessible to students and librarians)
//   searchBooks: async (req, res) => {
//     try {
//       const { query, category, classId, isGeneral } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);

//       const searchCriteria = { school: schoolId };
//       if (query) {
//         searchCriteria.$or = [
//           { bookTitle: { $regex: query, $options: 'i' } },
//           { author: { $regex: query, $options: 'i' } },
//           { isbn: { $regex: query, $options: 'i' } },
//         ];
//       }
//       if (category) {
//         const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
//         if (!categoryExists) {
//           return res.status(400).json({ message: 'Invalid category' });
//         }
//         searchCriteria.category = category;
//       }
//       if (classId) {
//         if (!mongoose.Types.ObjectId.isValid(classId)) {
//           return res.status(400).json({ message: 'Invalid class ID' });
//         }
//         searchCriteria.class = classId;
//       }
//       if (isGeneral !== undefined) {
//         searchCriteria.isGeneral = isGeneral === 'true';
//       }

//       const books = await LibraryModel.find(searchCriteria)
//         .select('bookTitle author isbn category class isGeneral totalCopies availableCopies status coverImage publisher publicationYear language')
//         .populate('class', 'name')
//         .sort({ bookTitle: 1 });

//       logger.info(`Books searched: ${query || category || classId || isGeneral}`, { schoolId });
//       res.json({ books });
//     } catch (error) {
//       logger.error(`Error searching books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student's book issue history
//   getStudentBookHistory: async (req, res) => {
//     try {
//       const { studentId, grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary && user._id.toString() !== studentId) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own history or need librarian permissions' });
//       }

//       let student;
//       if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
//         student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       } else if (grNumber) {
//         student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
//       }
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const history = await BookIssueModel.find({ user: student._id, school: schoolId })
//         .populate('book', 'bookTitle author isbn category coverImage')
//         .sort({ issueDate: -1 });

//       logger.info(`Fetched book history for student ${student._id}`, { schoolId });
//       res.json({
//         message: 'Book history retrieved successfully',
//         student: {
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class,
//           email: student.email,
//           parentDetails: student.studentDetails.parentDetails,
//         },
//         history,
//       });
//     } catch (error) {
//       logger.error(`Error fetching student book history: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get overdue books
//   getOverdueBooks: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const overdueBooks = await BookIssueModel.find({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       })
//         .populate('book', 'bookTitle author isbn')
//         .populate('user', 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails');

//       const booksWithFine = overdueBooks.map((issue) => {
//         const fine = Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)),
//         };
//       });

//       logger.info(`Overdue books fetched`, { schoolId });
//       res.json({ overdueBooks: booksWithFine });
//     } catch (error) {
//       logger.error(`Error fetching overdue books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Update overdue status
//   updateOverdueStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const updatedIssues = await BookIssueModel.updateMany(
//         {
//           school: schoolId,
//           status: 'issued',
//           dueDate: { $lt: new Date() },
//         },
//         { $set: { status: 'overdue' } }
//       );

//       logger.info(`Updated ${updatedIssues.modifiedCount} book issues to overdue status`, { schoolId });
//       res.json({ message: `Updated ${updatedIssues.modifiedCount} book issues to overdue status` });
//     } catch (error) {
//       logger.error(`Error updating overdue status: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Manage book categories
//   manageCategories: async (req, res) => {
//     try {
//       const { action, name, description } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (action === 'add') {
//         if (!name) {
//           return res.status(400).json({ message: 'Category name is required' });
//         }
//         const existingCategory = await CategoryModel.findOne({ name, school: schoolId });
//         if (existingCategory) {
//           return res.status(400).json({ message: 'Category already exists' });
//         }
//         const category = new CategoryModel({ school: schoolId, name, description });
//         await category.save();
//         logger.info(`Category added: ${name}`, { schoolId });
//         res.status(201).json({ message: 'Category added successfully', category });
//       } else if (action === 'update') {
//         const { categoryId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//           return res.status(400).json({ message: 'Invalid category ID' });
//         }
//         const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
//         if (!category) {
//           return res.status(404).json({ message: 'Category not found' });
//         }
//         category.name = name || category.name;
//         category.description = description || category.description;
//         await category.save();
//         logger.info(`Category updated: ${name || category.name}`, { schoolId });
//         res.json({ message: 'Category updated successfully', category });
//       } else if (action === 'delete') {
//         const { categoryId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//           return res.status(400).json({ message: 'Invalid category ID' });
//         }
//         const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
//         if (!category) {
//           return res.status(404).json({ message: 'Category not found' });
//         }
//         const booksInCategory = await LibraryModel.countDocuments({ category: category.name, school: schoolId });
//         if (booksInCategory > 0) {
//           return res.status(400).json({ message: 'Cannot delete category with associated books' });
//         }
//         await CategoryModel.deleteOne({ _id: categoryId });
//         logger.info(`Category deleted: ${category.name}`, { schoolId });
//         res.json({ message: 'Category deleted successfully' });
//       } else {
//         const categories = await CategoryModel.find({ school: schoolId });
//         res.json({ categories });
//       }
//     } catch (error) {
//       logger.error(`Error managing categories: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get student's own book history (for student panel)
//   getMyBookHistory: async (req, res) => {
//     try {
//       const studentId = req.user._id.toString();
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const history = await BookIssueModel.find({ user: studentId, school: schoolId })
//         .populate('book', 'bookTitle author isbn category coverImage')
//         .sort({ issueDate: -1 });

//       const historyWithFines = history.map(issue => {
//         const fine = issue.status === 'overdue' || (issue.status === 'issued' && issue.dueDate < new Date())
//           ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5
//           : issue.fine;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
//         };
//       });

//       logger.info(`Fetched book history for student ${studentId}`, { schoolId });
//       res.json({
//         message: 'Book history retrieved successfully',
//         history: historyWithFines,
//       });
//     } catch (error) {
//       logger.error(`Error fetching student book history: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = libraryController;





// const mongoose = require('mongoose');
// const logger = require('../utils/logger');
// const User = require('../models/User');
// const getModel = require("../models/index");
// const { uploadToS3, getPublicFileUrl, deleteFromS3 } = require('../config/s3Upload');
// const path = require('path');
// const sharp = require('sharp');
// const multer = require('multer');
// const libraryModelFactory = require('../models/Library');
// const { sendEmail } = require('../utils/notifications');
// const csv = require('csv-parse');
// const { Readable } = require('stream');

// // Configure Multer for memory storage
// const storage = multer.memoryStorage();
// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     logger.info('Processing book cover upload', {
//       fieldname: file.fieldname,
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//     });
//     const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       const error = new Error('Only JPEG, PNG, and JPG files are allowed for book covers');
//       logger.error('File type rejected', { mimetype: file.mimetype });
//       cb(error, false);
//     }
//   },
// }).single('cover');

// const csvUpload = multer({
//   storage,
//   limits: { fileSize: 10 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'text/csv') {
//       cb(null, true);
//     } else {
//       cb(new Error('Only CSV files are allowed for bulk import'), false);
//     }
//   },
// }).single('csvFile');

// const libraryController = {
//   addBook: async (req, res) => {
//     try {
//       const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!bookTitle || !author || !isbn || !totalCopies || !category) {
//         return res.status(400).json({ message: 'All required fields must be provided' });
//       }

//       const existingBook = await LibraryModel.findOne({ isbn, school: schoolId });
//       if (existingBook) {
//         return res.status(400).json({ message: 'Book with this ISBN already exists' });
//       }

//       const book = new LibraryModel({
//         school: schoolId,
//         bookTitle,
//         author,
//         isbn,
//         category,
//         class: classId || null,
//         isGeneral: isGeneral !== undefined ? isGeneral : true,
//         totalCopies,
//         availableCopies: totalCopies,
//         description,
//         publisher,
//         publicationYear,
//         language,
//         status: 'available',
//       });

//       await book.save();
//       logger.info(`Book added: ${bookTitle} by ${author}`, { schoolId, isbn });
//       res.status(201).json({ message: 'Book added successfully', book });
//     } catch (error) {
//       logger.error(`Error adding book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   bulkImportBooks: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!req.file) {
//         return res.status(400).json({ message: 'No CSV file uploaded' });
//       }

//       const books = [];
//       const errors = [];
//       const stream = Readable.from(req.file.buffer.toString());
//       stream
//         .pipe(csv.parse({ columns: true }))
//         .on('data', (row) => {
//           books.push({
//             school: schoolId,
//             bookTitle: row.bookTitle,
//             author: row.author,
//             isbn: row.isbn,
//             category: row.category,
//             class: row.classId || null,
//             isGeneral: row.isGeneral === 'true',
//             totalCopies: parseInt(row.totalCopies),
//             availableCopies: parseInt(row.totalCopies),
//             publisher: row.publisher,
//             publicationYear: parseInt(row.publicationYear),
//             language: row.language || 'English',
//             description: row.description,
//             status: 'available',
//           });
//         })
//         .on('end', async () => {
//           for (const book of books) {
//             try {
//               const existingBook = await LibraryModel.findOne({ isbn: book.isbn, school: schoolId });
//               if (existingBook) {
//                 errors.push(`Book with ISBN ${book.isbn} already exists`);
//                 continue;
//               }
//               await new LibraryModel(book).save();
//             } catch (error) {
//               errors.push(`Error importing book ${book.isbn}: ${error.message}`);
//             }
//           }
//           logger.info(`Bulk import completed: ${books.length - errors.length} books imported`, { schoolId, errors });
//           res.json({ message: 'Bulk import completed', imported: books.length - errors.length, errors });
//         })
//         .on('error', (error) => {
//           logger.error(`Error parsing CSV: ${error.message}`, { error });
//           res.status(500).json({ error: error.message });
//         });
//     } catch (error) {
//       logger.error(`Error in bulk import: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   updateBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral, status } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       if (category) {
//         const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
//         if (!categoryExists) {
//           return res.status(400).json({ message: 'Invalid category' });
//         }
//       }

//       const updates = {
//         bookTitle: bookTitle || book.bookTitle,
//         author: author || book.author,
//         isbn: isbn || book.isbn,
//         category: category || book.category,
//         class: classId || book.class,
//         isGeneral: isGeneral !== undefined ? isGeneral : book.isGeneral,
//         totalCopies: totalCopies || book.totalCopies,
//         description: description || book.description,
//         publisher: publisher || book.publisher,
//         publicationYear: publicationYear || book.publicationYear,
//         language: language || book.language,
//         status: status || book.status,
//       };

//       if (totalCopies) {
//         const issuedCopies = book.totalCopies - book.availableCopies;
//         updates.availableCopies = totalCopies - issuedCopies;
//         if (updates.availableCopies < 0) {
//           return res.status(400).json({ message: 'Cannot reduce total copies below issued copies' });
//         }
//       }

//       Object.assign(book, updates);
//       await book.save();
//       logger.info(`Book updated: ${bookTitle || book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book updated successfully', book });
//     } catch (error) {
//       logger.error(`Error updating book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   deleteBook: async (req, res) => {
//     try {
//       const { bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       if (book.availableCopies < book.totalCopies) {
//         return res.status(400).json({ message: 'Cannot delete book with issued copies' });
//       }

//       if (book.coverImage) {
//         const key = book.coverImage.split('/').slice(-3).join('/');
//         await deleteFromS3(key);
//       }

//       await LibraryModel.deleteOne({ _id: bookId });
//       await BookIssueModel.deleteMany({ book: bookId, school: schoolId });
//       logger.info(`Book deleted: ${book.bookTitle}`, { bookId, schoolId });
//       res.json({ message: 'Book deleted successfully' });
//     } catch (error) {
//       logger.error(`Error deleting book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   uploadBookCover: async (req, res) => {
//     try {
//       upload(req, res, async (err) => {
//         if (err) {
//           logger.error(`Multer error: ${err.message}`, { error: err });
//           return res.status(400).json({ error: err.message });
//         }

//         const { bookId } = req.params;
//         const schoolId = req.school._id.toString();
//         const connection = req.dbConnection;
//         const { Library: LibraryModel } = libraryModelFactory(connection);
//         const UserModel = User(connection);

//         const user = await UserModel.findById(req.user._id);
//         if (!user.permissions.canManageLibrary) {
//           return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//         }

//         if (!mongoose.Types.ObjectId.isValid(bookId)) {
//           return res.status(400).json({ message: 'Invalid book ID' });
//         }

//         if (!req.file) {
//           return res.status(400).json({ message: 'No file uploaded' });
//         }

//         const metadata = await sharp(req.file.buffer).metadata();
//         if (metadata.width < 200 || metadata.height < 200) {
//           return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
//         }

//         const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//         if (!book) {
//           return res.status(404).json({ message: 'Book not found' });
//         }

//         if (book.coverImage) {
//           try {
//             const oldKey = book.coverImage.split('/').slice(-3).join('/');
//             await deleteFromS3(oldKey);
//           } catch (deleteError) {
//             logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
//           }
//         }

//         const fileExt = path.extname(req.file.originalname).toLowerCase();
//         const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
//         const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
//         const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

//         book.coverImage = coverUrl;
//         await book.save();

//         logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
//         res.json({
//           success: true,
//           message: 'Book cover uploaded successfully',
//           coverUrl,
//         });
//       });
//     } catch (error) {
//       logger.error(`Error uploading book cover: ${error.message}`, { error });
//       res.status(500).json({
//         success: false,
//         error: error.message,
//       });
//     }
//   },

//   getClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Class = getModel("Class", connection);
//       const User = getModel("User", connection);
//       const Subject = getModel("Subject", connection);

//       const classes = await Class.find({ school: schoolId })
//         .populate("classTeacher", "name email profile", User)
//         .populate("subjects", "name")
//         .sort({ name: 1, division: 1 })
//         .lean();

//       res.json(classes);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getBookIssueRequests: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const pendingRequests = await BookIssueModel.find({
//         school: schoolId,
//         status: { $in: ['requested', 'reserved'] },
//       })
//         .populate('book', 'bookTitle author isbn category coverImage class isGeneral')
//         .populate('user', 'name studentDetails.grNumber email studentDetails.class')
//         .sort({ issueDate: 1 });

//       logger.info(`Fetched ${pendingRequests.length} pending book issue/reservation requests`, { schoolId });
//       res.json({
//         message: 'Pending book issue requests retrieved successfully',
//         requests: pendingRequests,
//       });
//     } catch (error) {
//       logger.error(`Error fetching book issue requests: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   issueBook: async (req, res) => {
//     try {
//       const { bookId, studentId, grNumber } = req.params;
//       const { dueDate, requestId, remarks, loanPeriodDays, finePerDay } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       let student;
//       if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
//         student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       } else if (grNumber) {
//         student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
//       }
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }
//       if (book.availableCopies === 0) {
//         return res.status(400).json({ message: 'No copies available' });
//       }

//       const activeIssues = await BookIssueModel.countDocuments({
//         user: student._id,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       });
//       if (activeIssues >= 3) {
//         return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
//       }

//       // Validate loan period and fine per day
//       const parsedLoanPeriod = parseInt(loanPeriodDays) || 14;
//       const parsedFinePerDay = parseFloat(finePerDay) || 5;
//       if (parsedLoanPeriod < 1 || parsedLoanPeriod > 30) {
//         return res.status(400).json({ message: 'Loan period must be between 1 and 30 days' });
//       }
//       if (parsedFinePerDay < 0 || parsedFinePerDay > 100) {
//         return res.status(400).json({ message: 'Fine per day must be between 0 and 100' });
//       }

//       let issue;
//       if (requestId) {
//         if (!mongoose.Types.ObjectId.isValid(requestId)) {
//           return res.status(400).json({ message: 'Invalid request ID' });
//         }

//         issue = await BookIssueModel.findOne({
//           _id: requestId,
//           book: bookId,
//           user: student._id,
//           school: schoolId,
//           status: { $in: ['requested', 'reserved'] },
//         });

//         if (!issue) {
//           return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
//         }

//         issue.status = 'issued';
//         issue.issueDate = new Date();
//         issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + parsedLoanPeriod * 24 * 60 * 60 * 1000);
//         issue.loanPeriodDays = parsedLoanPeriod;
//         issue.finePerDay = parsedFinePerDay;
//         issue.remarks = remarks;
//       } else {
//         const existingIssue = await BookIssueModel.findOne({
//           book: bookId,
//           user: student._id,
//           school: schoolId,
//           status: { $in: ['issued', 'overdue'] },
//         });
//         if (existingIssue) {
//           return res.status(400).json({ message: 'This book is already issued to the student' });
//         }

//         issue = new BookIssueModel({
//           school: schoolId,
//           book: bookId,
//           user: student._id,
//           issueDate: new Date(),
//           dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + parsedLoanPeriod * 24 * 60 * 60 * 1000),
//           status: 'issued',
//           loanPeriodDays: parsedLoanPeriod,
//           finePerDay: parsedFinePerDay,
//           remarks,
//         });
//       }

//       book.availableCopies -= 1;
//       if (book.availableCopies === 0) {
//         book.status = 'unavailable';
//       }
//       if (book.reservedBy.includes(student._id)) {
//         book.reservedBy = book.reservedBy.filter(id => id.toString() !== student._id.toString());
//       }

//       await Promise.all([issue.save(), book.save()]);
//       // await sendEmail({
//       //   to: student.email,
//       //   subject: 'Book Issued Successfully',
//       //   text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been issued to you. Due date: ${issue.dueDate.toDateString()}. Fine per day for overdue: INR ${issue.finePerDay}. Please return it on time to avoid fines.\n\nRegards,\nLibrary Team`,
//       // });

//       logger.info(`Book issued: ${book.bookTitle} to student ${student._id}`, { schoolId, requestId: requestId || 'direct', loanPeriodDays: parsedLoanPeriod, finePerDay: parsedFinePerDay });
//       res.json({ message: 'Book issued successfully', issue });
//     } catch (error) {
//       logger.error(`Error issuing book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   rejectBookRequest: async (req, res) => {
//     try {
//       const { requestId } = req.params;
//       const { remarks } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(requestId)) {
//         return res.status(400).json({ message: 'Invalid request ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: requestId, school: schoolId, status: { $in: ['requested', 'reserved'] } });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
//       }

//       const student = await UserModel.findById(issue.user);
//       issue.status = 'rejected';
//       issue.remarks = remarks || 'Request rejected by librarian';
//       await issue.save();

//       await sendEmail({
//         to: student.email,
//         subject: 'Book Request Rejected',
//         text: `Dear ${student.name},\n\nYour request for the book "${(await LibraryModel.findById(issue.book)).bookTitle}" has been rejected. Reason: ${issue.remarks}.\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book request rejected: ${issue.book} for student ${issue.user}`, { schoolId, requestId });
//       res.json({ message: 'Book request rejected successfully', issue });
//     } catch (error) {
//       logger.error(`Error rejecting book request: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   returnBook: async (req, res) => {
//     try {
//       const { issueId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(issueId)) {
//         return res.status(400).json({ message: 'Invalid issue ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book issue record not found' });
//       }
//       if (issue.status === 'returned') {
//         return res.status(400).json({ message: 'Book already returned' });
//       }

//       const book = await LibraryModel.findOne({ _id: issue.book, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }

//       const today = new Date();
//       const fine = issue.finePardoned ? 0 : issue.dueDate < today ? Math.ceil((today - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay : 0;

//       issue.status = 'returned';
//       issue.returnDate = new Date();
//       issue.fine = fine;
//       book.availableCopies += 1;
//       book.status = 'available';

//       await Promise.all([issue.save(), book.save()]);

//       const student = await UserModel.findById(issue.user);
//       await sendEmail({
//         to: student.email,
//         subject: 'Book Returned Successfully',
//         text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been returned successfully. ${fine > 0 ? `A fine of INR ${fine} has been applied. Please pay at the earliest.` : issue.finePardoned ? 'The fine has been pardoned.' : 'No fine applied.'}\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book returned: ${book.bookTitle} by student ${issue.user}`, { schoolId, fine, finePardoned: issue.finePardoned });
//       res.json({ message: 'Book returned successfully', issue });
//     } catch (error) {
//       logger.error(`Error returning book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   pardonFine: async (req, res) => {
//     try {
//       const { issueId } = req.params;
//       const { remarks } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(issueId)) {
//         return res.status(400).json({ message: 'Invalid issue ID' });
//       }

//       const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
//       if (!issue) {
//         return res.status(404).json({ message: 'Book issue record not found' });
//       }
//       if (issue.status === 'returned' && issue.fine === 0) {
//         return res.status(400).json({ message: 'No fine to pardon' });
//       }

//       issue.finePardoned = true;
//       issue.fine = 0;
//       issue.remarks = remarks ? `${issue.remarks ? issue.remarks + '; ' : ''}Fine pardoned: ${remarks}` : issue.remarks;
//       await issue.save();

//       const student = await UserModel.findById(issue.user);
//       const book = await LibraryModel.findById(issue.book);
//       await sendEmail({
//         to: student.email,
//         subject: 'Library Fine Pardoned',
//         text: `Dear ${student.name},\n\nThe fine for the book "${book.bookTitle}" has been pardoned. ${remarks ? `Reason: ${remarks}` : ''}\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Fine pardoned for issue ${issueId} by student ${issue.user}`, { schoolId, remarks });
//       res.json({ message: 'Fine pardoned successfully', issue });
//     } catch (error) {
//       logger.error(`Error pardoning fine: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   reserveBook: async (req, res) => {
//     try {
//       const { studentId, bookId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       if (studentId !== req.user._id.toString()) {
//         return res.status(403).json({ message: 'Unauthorized: You can only reserve books for yourself' });
//       }

//       if (!mongoose.Types.ObjectId.isValid(bookId)) {
//         return res.status(400).json({ message: 'Invalid book ID' });
//       }

//       const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//       if (!book) {
//         return res.status(404).json({ message: 'Book not found' });
//       }
//       if (book.availableCopies > 0) {
//         return res.status(400).json({ message: 'Book is available, please request instead of reserving' });
//       }

//       if (book.reservedBy.includes(studentId)) {
//         return res.status(400).json({ message: 'You have already reserved this book' });
//       }

//       const existingRecord = await BookIssueModel.findOne({
//         book: bookId,
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['requested', 'issued', 'overdue', 'reserved'] },
//       });
//       if (existingRecord) {
//         return res.status(400).json({
//           message: `Cannot reserve book: already ${existingRecord.status === 'requested' ? 'requested' : existingRecord.status === 'reserved' ? 'reserved' : 'issued or overdue'}`,
//         });
//       }

//       const reservation = new BookIssueModel({
//         school: schoolId,
//         book: bookId,
//         user: studentId,
//         issueDate: new Date(),
//         status: 'reserved',
//       });

//       book.reservedBy.push(studentId);
//       await Promise.all([reservation.save(), book.save()]);

//       const student = await UserModel.findById(studentId);
//       await sendEmail({
//         to: student.email,
//         subject: 'Book Reservation Successful',
//         text: `Dear ${student.name},\n\nYou have successfully reserved the book "${book.bookTitle}". You will be notified when it becomes available.\n\nRegards,\nLibrary Team`,
//       });

//       logger.info(`Book reserved: ${book.bookTitle} by student ${studentId}`, { schoolId });
//       res.status(201).json({ message: 'Book reservation submitted successfully', reservation });
//     } catch (error) {
//       logger.error(`Error reserving book: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getLibraryStats: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const totalBooks = await LibraryModel.countDocuments({ school: schoolId });
//       const availableBooks = await LibraryModel.countDocuments({ school: schoolId, status: 'available' });
//       const issuedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'issued' });
//       const reservedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'reserved' });
//       const overdueBooks = await BookIssueModel.countDocuments({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       });
//       const totalFines = await BookIssueModel.aggregate([
//         { $match: { school: new mongoose.Types.ObjectId(schoolId), fine: { $gt: 0 }, finePardoned: false } },
//         { $group: { _id: null, total: { $sum: '$fine' } } },
//       ]);

//       logger.info(`Library stats fetched`, { schoolId });
//       res.json({
//         totalBooks,
//         availableBooks,
//         issuedBooks,
//         reservedBooks,
//         overdueBooks,
//         totalFines: totalFines.length > 0 ? totalFines[0].total : 0,
//       });
//     } catch (error) {
//       logger.error(`Error fetching library stats: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   searchBooks: async (req, res) => {
//     try {
//       const { query, category, classId, isGeneral } = req.query;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);

//       const searchCriteria = { school: schoolId };
//       if (query) {
//         searchCriteria.$or = [
//           { bookTitle: { $regex: query, $options: 'i' } },
//           { author: { $regex: query, $options: 'i' } },
//           { isbn: { $regex: query, $options: 'i' } },
//         ];
//       }
//       if (category) {
//         const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
//         if (!categoryExists) {
//           return res.status(400).json({ message: 'Invalid category' });
//         }
//         searchCriteria.category = category;
//       }
//       if (classId) {
//         if (!mongoose.Types.ObjectId.isValid(classId)) {
//           return res.status(400).json({ message: 'Invalid class ID' });
//         }
//         searchCriteria.class = classId;
//       }
//       if (isGeneral !== undefined) {
//         searchCriteria.isGeneral = isGeneral === 'true';
//       }

//       const books = await LibraryModel.find(searchCriteria)
//         .select('bookTitle author isbn category class isGeneral totalCopies availableCopies status coverImage publisher publicationYear language')
//         .populate('class', 'name')
//         .sort({ bookTitle: 1 });

//       logger.info(`Books searched: ${query || category || classId || isGeneral}`, { schoolId });
//       res.json({ books });
//     } catch (error) {
//       logger.error(`Error searching books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getStudentBookHistory: async (req, res) => {
//     try {
//       const { studentId, grNumber } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary && user._id.toString() !== studentId) {
//         return res.status(403).json({ message: 'Unauthorized: You can only view your own history or need librarian permissions' });
//       }

//       let student;
//       if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
//         student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       } else if (grNumber) {
//         student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
//       }
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const history = await BookIssueModel.find({ user: student._id, school: schoolId })
//         .populate('book', 'bookTitle author isbn category coverImage')
//         .sort({ issueDate: -1 });

//       const historyWithFines = history.map(issue => {
//         const fine = issue.finePardoned ? 0 : (issue.status === 'overdue' || (issue.status === 'issued' && issue.dueDate < new Date()))
//           ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay
//           : issue.fine;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
//           finePerDay: issue.finePerDay,
//           finePardoned: issue.finePardoned,
//         };
//       });

//       logger.info(`Fetched book history for student ${student._id}`, { schoolId });
//       res.json({
//         message: 'Book history retrieved successfully',
//         student: {
//           name: student.name,
//           grNumber: student.studentDetails.grNumber,
//           class: student.studentDetails.class,
//           email: student.email,
//           parentDetails: student.studentDetails.parentDetails,
//         },
//         history: historyWithFines,
//       });
//     } catch (error) {
//       logger.error(`Error fetching student book history: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getOverdueBooks: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const overdueBooks = await BookIssueModel.find({
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//         dueDate: { $lt: new Date() },
//       })
//         .populate('book', 'bookTitle author isbn')
//         .populate('user', 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails');

//       const booksWithFine = overdueBooks.map((issue) => {
//         const fine = issue.finePardoned ? 0 : Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
//           finePerDay: issue.finePerDay,
//           finePardoned: issue.finePardoned,
//         };
//       });

//       logger.info(`Overdue books fetched`, { schoolId });
//       res.json({ overdueBooks: booksWithFine });
//     } catch (error) {
//       logger.error(`Error fetching overdue books: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   updateOverdueStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       const updatedIssues = await BookIssueModel.updateMany(
//         {
//           school: schoolId,
//           status: 'issued',
//           dueDate: { $lt: new Date() },
//         },
//         { $set: { status: 'overdue' } }
//       );

//       logger.info(`Updated ${updatedIssues.modifiedCount} book issues to overdue status`, { schoolId });
//       res.json({ message: `Updated ${updatedIssues.modifiedCount} book issues to overdue status` });
//     } catch (error) {
//       logger.error(`Error updating overdue status: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   manageCategories: async (req, res) => {
//     try {
//       const { action, name, description } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Category: CategoryModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const user = await UserModel.findById(req.user._id);
//       if (!user.permissions.canManageLibrary) {
//         return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//       }

//       if (action === 'add') {
//         if (!name) {
//           return res.status(400).json({ message: 'Category name is required' });
//         }
//         const existingCategory = await CategoryModel.findOne({ name, school: schoolId });
//         if (existingCategory) {
//           return res.status(400).json({ message: 'Category already exists' });
//         }
//         const category = new CategoryModel({ school: schoolId, name, description });
//         await category.save();
//         logger.info(`Category added: ${name}`, { schoolId });
//         res.status(201).json({ message: 'Category added successfully', category });
//       } else if (action === 'update') {
//         const { categoryId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//           return res.status(400).json({ message: 'Invalid category ID' });
//         }
//         const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
//         if (!category) {
//           return res.status(404).json({ message: 'Category not found' });
//         }
//         category.name = name || category.name;
//         category.description = description || category.description;
//         await category.save();
//         logger.info(`Category updated: ${name || category.name}`, { schoolId });
//         res.json({ message: 'Category updated successfully', category });
//       } else if (action === 'delete') {
//         const { categoryId } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(categoryId)) {
//           return res.status(400).json({ message: 'Invalid category ID' });
//         }
//         const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
//         if (!category) {
//           return res.status(404).json({ message: 'Category not found' });
//         }
//         const booksInCategory = await LibraryModel.countDocuments({ category: category.name, school: schoolId });
//         if (booksInCategory > 0) {
//           return res.status(400).json({ message: 'Cannot delete category with associated books' });
//         }
//         await CategoryModel.deleteOne({ _id: categoryId });
//         logger.info(`Category deleted: ${category.name}`, { schoolId });
//         res.json({ message: 'Category deleted successfully' });
//       } else {
//         const categories = await CategoryModel.find({ school: schoolId });
//         res.json({ categories });
//       }
//     } catch (error) {
//       logger.error(`Error managing categories: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getMyBookHistory: async (req, res) => {
//     try {
//       const studentId = req.user._id.toString();
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
//       const UserModel = User(connection);

//       const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
//       if (!student) {
//         return res.status(404).json({ message: 'Student not found' });
//       }

//       const history = await BookIssueModel.find({ user: studentId, school: schoolId })
//         .populate('book', 'bookTitle author isbn category coverImage')
//         .sort({ issueDate: -1 });

//       const historyWithFines = history.map(issue => {
//         const fine = issue.finePardoned ? 0 : (issue.status === 'overdue' || (issue.status === 'issued' && issue.dueDate < new Date()))
//           ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay
//           : issue.fine;
//         return {
//           ...issue.toObject(),
//           fine,
//           daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
//           finePerDay: issue.finePerDay,
//           loanPeriodDays: issue.loanPeriodDays,
//           finePardoned: issue.finePardoned,
//         };
//       });

//       logger.info(`Fetched book history for student ${studentId}`, { schoolId });
//       res.json({
//         message: 'Book history retrieved successfully',
//         history: historyWithFines,
//       });
//     } catch (error) {
//       logger.error(`Error fetching student book history: ${error.message}`, { error });
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = libraryController;





const mongoose = require('mongoose');
const logger = require('../utils/logger');
const User = require('../models/User');
const getModel = require("../models/index");
const { uploadToS3, getPublicFileUrl, deleteFromS3 } = require('../config/s3Upload');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const libraryModelFactory = require('../models/Library');
const { sendEmail } = require('../utils/notifications');
const csv = require('csv-parse');
const { Readable } = require('stream');

// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    logger.info('Processing book cover upload', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error = new Error('Only JPEG, PNG, and JPG files are allowed for book covers');
      logger.error('File type rejected', { mimetype: file.mimetype });
      cb(error, false);
    }
  },
}).single('cover');

const csvUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed for bulk import'), false);
    }
  },
}).single('csvFile');

const libraryController = {
  addBook: async (req, res) => {
    try {
      const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!bookTitle || !author || !isbn || !totalCopies || !category) {
        return res.status(400).json({ message: 'All required fields must be provided' });
      }

      const existingBook = await LibraryModel.findOne({ isbn, school: schoolId });
      if (existingBook) {
        return res.status(400).json({ message: 'Book with this ISBN already exists' });
      }

      const book = new LibraryModel({
        school: schoolId,
        bookTitle,
        author,
        isbn,
        category,
        class: classId || null,
        isGeneral: isGeneral !== undefined ? isGeneral : true,
        totalCopies,
        availableCopies: totalCopies,
        description,
        publisher,
        publicationYear,
        language,
        status: 'available',
      });

      await book.save();
      logger.info(`Book added: ${bookTitle} by ${author}`, { schoolId, isbn });
      res.status(201).json({ message: 'Book added successfully', book });
    } catch (error) {
      logger.error(`Error adding book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  bulkImportBooks: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No CSV file uploaded' });
      }

      const books = [];
      const errors = [];
      const stream = Readable.from(req.file.buffer.toString());
      stream
        .pipe(csv.parse({ columns: true }))
        .on('data', (row) => {
          books.push({
            school: schoolId,
            bookTitle: row.bookTitle,
            author: row.author,
            isbn: row.isbn,
            category: row.category,
            class: row.classId || null,
            isGeneral: row.isGeneral === 'true',
            totalCopies: parseInt(row.totalCopies),
            availableCopies: parseInt(row.totalCopies),
            publisher: row.publisher,
            publicationYear: parseInt(row.publicationYear),
            language: row.language || 'English',
            description: row.description,
            status: 'available',
          });
        })
        .on('end', async () => {
          for (const book of books) {
            try {
              const existingBook = await LibraryModel.findOne({ isbn: book.isbn, school: schoolId });
              if (existingBook) {
                errors.push(`Book with ISBN ${book.isbn} already exists`);
                continue;
              }
              await new LibraryModel(book).save();
            } catch (error) {
              errors.push(`Error importing book ${book.isbn}: ${error.message}`);
            }
          }
          logger.info(`Bulk import completed: ${books.length - errors.length} books imported`, { schoolId, errors });
          res.json({ message: 'Bulk import completed', imported: books.length - errors.length, errors });
        })
        .on('error', (error) => {
          logger.error(`Error parsing CSV: ${error.message}`, { error });
          res.status(500).json({ error: error.message });
        });
    } catch (error) {
      logger.error(`Error in bulk import: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  updateBook: async (req, res) => {
    try {
      const { bookId } = req.params;
      const { bookTitle, author, isbn, category, classId, totalCopies, description, publisher, publicationYear, language, isGeneral, status } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid book ID' });
      }

      const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      if (category) {
        const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
        if (!categoryExists) {
          return res.status(400).json({ message: 'Invalid category' });
        }
      }

      const updates = {
        bookTitle: bookTitle || book.bookTitle,
        author: author || book.author,
        isbn: isbn || book.isbn,
        category: category || book.category,
        class: classId || book.class,
        isGeneral: isGeneral !== undefined ? isGeneral : book.isGeneral,
        totalCopies: totalCopies || book.totalCopies,
        description: description || book.description,
        publisher: publisher || book.publisher,
        publicationYear: publicationYear || book.publicationYear,
        language: language || book.language,
        status: status || book.status,
      };

      if (totalCopies) {
        const issuedCopies = book.totalCopies - book.availableCopies;
        updates.availableCopies = totalCopies - issuedCopies;
        if (updates.availableCopies < 0) {
          return res.status(400).json({ message: 'Cannot reduce total copies below issued copies' });
        }
      }

      Object.assign(book, updates);
      await book.save();
      logger.info(`Book updated: ${bookTitle || book.bookTitle}`, { bookId, schoolId });
      res.json({ message: 'Book updated successfully', book });
    } catch (error) {
      logger.error(`Error updating book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  deleteBook: async (req, res) => {
    try {
      const { bookId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid book ID' });
      }

      const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      if (book.availableCopies < book.totalCopies) {
        return res.status(400).json({ message: 'Cannot delete book with issued copies' });
      }

      if (book.coverImage) {
        const key = book.coverImage.split('/').slice(-3).join('/');
        await deleteFromS3(key);
      }

      await LibraryModel.deleteOne({ _id: bookId });
      await BookIssueModel.deleteMany({ book: bookId, school: schoolId });
      logger.info(`Book deleted: ${book.bookTitle}`, { bookId, schoolId });
      res.json({ message: 'Book deleted successfully' });
    } catch (error) {
      logger.error(`Error deleting book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  uploadBookCover: async (req, res) => {
    try {
      upload(req, res, async (err) => {
        if (err) {
          logger.error(`Multer error: ${err.message}`, { error: err });
          return res.status(400).json({ error: err.message });
        }

        const { bookId } = req.params;
        const schoolId = req.school._id.toString();
        const connection = req.dbConnection;
        const { Library: LibraryModel } = libraryModelFactory(connection);
        const UserModel = User(connection);

        const user = await UserModel.findById(req.user._id);
        if (!user.permissions.canManageLibrary) {
          return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
        }

        if (!mongoose.Types.ObjectId.isValid(bookId)) {
          return res.status(400).json({ message: 'Invalid book ID' });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const metadata = await sharp(req.file.buffer).metadata();
        if (metadata.width < 200 || metadata.height < 200) {
          return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
        }

        const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
        if (!book) {
          return res.status(404).json({ message: 'Book not found' });
        }

        if (book.coverImage) {
          try {
            const oldKey = book.coverImage.split('/').slice(-3).join('/');
            await deleteFromS3(oldKey);
          } catch (deleteError) {
            logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
          }
        }

        const fileExt = path.extname(req.file.originalname).toLowerCase();
        const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
        const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
        const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

        book.coverImage = coverUrl;
        await book.save();

        logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
        res.json({
          success: true,
          message: 'Book cover uploaded successfully',
          coverUrl,
        });
      });
    } catch (error) {
      logger.error(`Error uploading book cover: ${error.message}`, { error });
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  getClasses: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);
      const Subject = getModel("Subject", connection);

      const classes = await Class.find({ school: schoolId })
        .populate("classTeacher", "name email profile", User)
        .populate("subjects", "name")
        .sort({ name: 1, division: 1 })
        .lean();

      res.json(classes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getBookIssueRequests: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const pendingRequests = await BookIssueModel.find({
        school: schoolId,
        status: { $in: ['requested', 'reserved'] },
      })
        .populate('book', 'bookTitle author isbn category coverImage class isGeneral')
        .populate('user', 'name studentDetails.grNumber email studentDetails.class')
        .sort({ issueDate: 1 });

      logger.info(`Fetched ${pendingRequests.length} pending book issue/reservation requests`, { schoolId });
      res.json({
        message: 'Pending book issue requests retrieved successfully',
        requests: pendingRequests,
      });
    } catch (error) {
      logger.error(`Error fetching book issue requests: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  issueBook: async (req, res) => {
    try {
      const { bookId, studentId, grNumber } = req.params;
      const { dueDate, requestId, remarks, loanPeriodDays, finePerDay } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      let student;
      if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
      } else if (grNumber) {
        student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
      }
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid book ID' });
      }

      const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }
      if (book.availableCopies === 0) {
        return res.status(400).json({ message: 'No copies available' });
      }

      const activeIssues = await BookIssueModel.countDocuments({
        user: student._id,
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
      });
      if (activeIssues >= 3) {
        return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
      }

      // Validate loan period and fine per day
      const parsedLoanPeriod = parseInt(loanPeriodDays) || 14;
      const parsedFinePerDay = parseFloat(finePerDay) || 5;
      if (parsedLoanPeriod < 1 || parsedLoanPeriod > 30) {
        return res.status(400).json({ message: 'Loan period must be between 1 and 30 days' });
      }
      if (parsedFinePerDay < 0 || parsedFinePerDay > 100) {
        return res.status(400).json({ message: 'Fine per day must be between 0 and 100' });
      }

      let issue;
      if (requestId) {
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
          return res.status(400).json({ message: 'Invalid request ID' });
        }

        issue = await BookIssueModel.findOne({
          _id: requestId,
          book: bookId,
          user: student._id,
          school: schoolId,
          status: { $in: ['requested', 'reserved'] },
        });

        if (!issue) {
          return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
        }

        issue.status = 'issued';
        issue.issueDate = new Date();
        issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + parsedLoanPeriod * 24 * 60 * 60 * 1000);
        issue.loanPeriodDays = parsedLoanPeriod;
        issue.finePerDay = parsedFinePerDay;
        issue.remarks = remarks;
      } else {
        const existingIssue = await BookIssueModel.findOne({
          book: bookId,
          user: student._id,
          school: schoolId,
          status: { $in: ['issued', 'overdue'] },
        });
        if (existingIssue) {
          return res.status(400).json({ message: 'This book is already issued to the student' });
        }

        issue = new BookIssueModel({
          school: schoolId,
          book: bookId,
          user: student._id,
          issueDate: new Date(),
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + parsedLoanPeriod * 24 * 60 * 60 * 1000),
          status: 'issued',
          loanPeriodDays: parsedLoanPeriod,
          finePerDay: parsedFinePerDay,
          remarks,
        });
      }

      book.availableCopies -= 1;
      if (book.availableCopies === 0) {
        book.status = 'unavailable';
      }
      if (book.reservedBy.includes(student._id)) {
        book.reservedBy = book.reservedBy.filter(id => id.toString() !== student._id.toString());
      }

      await Promise.all([issue.save(), book.save()]);

      // Log audit
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'book_issue',
        user: student._id,
        book: bookId,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
          dueDate: issue.dueDate,
          loanPeriodDays: parsedLoanPeriod,
          finePerDay: parsedFinePerDay,
          requestId: requestId || 'direct',
        },
      });
      await auditLog.save();

      // await sendEmail({
      //   to: student.email,
      //   subject: 'Book Issued Successfully',
      //   text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been issued to you. Due date: ${issue.dueDate.toDateString()}. Fine per day for overdue: INR ${issue.finePerDay}. Please return it on time to avoid fines.\n\nRegards,\nLibrary Team`,
      // });

      logger.info(`Book issued: ${book.bookTitle} to student ${student._id}`, { schoolId, requestId: requestId || 'direct', loanPeriodDays: parsedLoanPeriod, finePerDay: parsedFinePerDay });
      res.json({ message: 'Book issued successfully', issue });
    } catch (error) {
      logger.error(`Error issuing book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  rejectBookRequest: async (req, res) => {
    try {
      const { requestId } = req.params;
      const { remarks } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }

      const issue = await BookIssueModel.findOne({ _id: requestId, school: schoolId, status: { $in: ['requested', 'reserved'] } });
      if (!issue) {
        return res.status(404).json({ message: 'Book request/reservation not found or already processed' });
      }

      const student = await UserModel.findById(issue.user);
      const book = await LibraryModel.findById(issue.book);

      issue.status = 'rejected';
      issue.remarks = remarks || 'Request rejected by librarian';
      await issue.save();

      // Log audit
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'book_reject',
        user: student._id,
        book: issue.book,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
          remarks: issue.remarks,
        },
      });
      await auditLog.save();

      await sendEmail({
        to: student.email,
        subject: 'Book Request Rejected',
        text: `Dear ${student.name},\n\nYour request for the book "${book.bookTitle}" has been rejected. Reason: ${issue.remarks}.\n\nRegards,\nLibrary Team`,
      });

      logger.info(`Book request rejected: ${issue.book} for student ${issue.user}`, { schoolId, requestId });
      res.json({ message: 'Book request rejected successfully', issue });
    } catch (error) {
      logger.error(`Error rejecting book request: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  returnBook: async (req, res) => {
    try {
      const { issueId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!mongoose.Types.ObjectId.isValid(issueId)) {
        return res.status(400).json({ message: 'Invalid issue ID' });
      }

      const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
      if (!issue) {
        return res.status(404).json({ message: 'Book issue record not found' });
      }
      if (issue.status === 'returned') {
        return res.status(400).json({ message: 'Book already returned' });
      }

      const book = await LibraryModel.findOne({ _id: issue.book, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      const today = new Date();
      const fine = issue.finePardoned ? 0 : issue.dueDate < today ? Math.ceil((today - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay : 0;

      issue.status = 'returned';
      issue.returnDate = new Date();
      issue.fine = fine;
      book.availableCopies += 1;
      book.status = 'available';

      await Promise.all([issue.save(), book.save()]);

      // Log audit
      const student = await UserModel.findById(issue.user);
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'book_return',
        user: student._id,
        book: issue.book,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
          fine: fine,
          finePardoned: issue.finePardoned,
        },
      });
      await auditLog.save();

      await sendEmail({
        to: student.email,
        subject: 'Book Returned Successfully',
        text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been returned successfully. ${fine > 0 ? `A fine of INR ${fine} has been applied. Please pay at the earliest.` : issue.finePardoned ? 'The fine has been pardoned.' : 'No fine applied.'}\n\nRegards,\nLibrary Team`,
      });

      logger.info(`Book returned: ${book.bookTitle} by student ${issue.user}`, { schoolId, fine, finePardoned: issue.finePardoned });
      res.json({ message: 'Book returned successfully', issue });
    } catch (error) {
      logger.error(`Error returning book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  pardonFine: async (req, res) => {
    try {
      const { issueId } = req.params;
      const { remarks } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (!mongoose.Types.ObjectId.isValid(issueId)) {
        return res.status(400).json({ message: 'Invalid issue ID' });
      }

      const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId });
      if (!issue) {
        return res.status(404).json({ message: 'Book issue record not found' });
      }
      if (issue.status === 'returned' && issue.fine === 0) {
        return res.status(400).json({ message: 'No fine to pardon' });
      }

      issue.finePardoned = true;
      issue.fine = 0;
      issue.remarks = remarks ? `${issue.remarks ? issue.remarks + '; ' : ''}Fine pardoned: ${remarks}` : issue.remarks;
      await issue.save();

      // Log audit
      const student = await UserModel.findById(issue.user);
      const book = await LibraryModel.findById(issue.book);
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'fine_pardon',
        user: student._id,
        book: issue.book,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
          remarks: remarks,
        },
      });
      await auditLog.save();

      await sendEmail({
        to: student.email,
        subject: 'Library Fine Pardoned',
        text: `Dear ${student.name},\n\nThe fine for the book "${book.bookTitle}" has been pardoned. ${remarks ? `Reason: ${remarks}` : ''}\n\nRegards,\nLibrary Team`,
      });

      logger.info(`Fine pardoned for issue ${issueId} by student ${issue.user}`, { schoolId, remarks });
      res.json({ message: 'Fine pardoned successfully', issue });
    } catch (error) {
      logger.error(`Error pardoning fine: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  reserveBook: async (req, res) => {
    try {
      const { studentId, bookId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      if (studentId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized: You can only reserve books for yourself' });
      }

      if (!mongoose.Types.ObjectId.isValid(bookId)) {
        return res.status(400).json({ message: 'Invalid book ID' });
      }

      const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }
      if (book.availableCopies > 0) {
        return res.status(400).json({ message: 'Book is available, please request instead of reserving' });
      }

      if (book.reservedBy.includes(studentId)) {
        return res.status(400).json({ message: 'You have already reserved this book' });
      }

      const existingRecord = await BookIssueModel.findOne({
        book: bookId,
        user: studentId,
        school: schoolId,
        status: { $in: ['requested', 'issued', 'overdue', 'reserved'] },
      });
      if (existingRecord) {
        return res.status(400).json({
          message: `Cannot reserve book: already ${existingRecord.status === 'requested' ? 'requested' : existingRecord.status === 'reserved' ? 'reserved' : 'issued or overdue'}`,
        });
      }

      const reservation = new BookIssueModel({
        school: schoolId,
        book: bookId,
        user: studentId,
        issueDate: new Date(),
        status: 'reserved',
      });

      book.reservedBy.push(studentId);
      await Promise.all([reservation.save(), book.save()]);

      // Log audit
      const student = await UserModel.findById(studentId);
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'book_reserve',
        user: student._id,
        book: bookId,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
        },
      });
      await auditLog.save();

      await sendEmail({
        to: student.email,
        subject: 'Book Reservation Successful',
        text: `Dear ${student.name},\n\nYou have successfully reserved the book "${book.bookTitle}". You will be notified when it becomes available.\n\nRegards,\nLibrary Team`,
      });

      logger.info(`Book reserved: ${book.bookTitle} by student ${studentId}`, { schoolId });
      res.status(201).json({ message: 'Book reservation submitted successfully', reservation });
    } catch (error) {
      logger.error(`Error reserving book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  renewBook: async (req, res) => {
    try {
      const { issueId } = req.params;
      const { remarks } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel, AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (user._id.toString() !== req.user._id.toString() && !user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You can only renew your own books or need librarian permissions' });
      }

      if (!mongoose.Types.ObjectId.isValid(issueId)) {
        return res.status(400).json({ message: 'Invalid issue ID' });
      }

      const issue = await BookIssueModel.findOne({ _id: issueId, school: schoolId, user: req.user._id });
      if (!issue) {
        return res.status(404).json({ message: 'Book issue record not found' });
      }
      if (issue.status !== 'issued') {
        return res.status(400).json({ message: 'Book cannot be renewed; it is not currently issued' });
      }
      if (issue.dueDate < new Date()) {
        return res.status(400).json({ message: 'Cannot renew overdue book; please return and reissue' });
      }
      if (issue.renewalCount >= 2) {
        return res.status(400).json({ message: 'Maximum renewal limit (2) reached' });
      }

      const book = await LibraryModel.findOne({ _id: issue.book, school: schoolId });
      if (!book) {
        return res.status(404).json({ message: 'Book not found' });
      }

      issue.renewalCount += 1;
      issue.dueDate = new Date(issue.dueDate.getTime() + issue.loanPeriodDays * 24 * 60 * 60 * 1000);
      issue.remarks = remarks ? `${issue.remarks ? issue.remarks + '; ' : ''}Renewed: ${remarks}` : issue.remarks;
      await issue.save();

      // Log audit
      const student = await UserModel.findById(issue.user);
      const auditLog = new AuditLogModel({
        school: schoolId,
        action: 'book_renewal',
        user: student._id,
        book: issue.book,
        details: {
          bookTitle: book.bookTitle,
          studentName: student.name,
          grNumber: student.studentDetails.grNumber,
          newDueDate: issue.dueDate,
          renewalCount: issue.renewalCount,
          remarks: remarks,
        },
      });
      await auditLog.save();

      await sendEmail({
        to: student.email,
        subject: 'Book Renewal Successful',
        text: `Dear ${student.name},\n\nThe book "${book.bookTitle}" has been renewed successfully. New due date: ${issue.dueDate.toDateString()}. Renewal count: ${issue.renewalCount}/2.\n\nRegards,\nLibrary Team`,
      });

      logger.info(`Book renewed: ${book.bookTitle} by student ${issue.user}`, { schoolId, newDueDate: issue.dueDate });
      res.json({ message: 'Book renewed successfully', issue });
    } catch (error) {
      logger.error(`Error renewing book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getLibraryStats: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const totalBooks = await LibraryModel.countDocuments({ school: schoolId });
      const availableBooks = await LibraryModel.countDocuments({ school: schoolId, status: 'available' });
      const issuedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'issued' });
      const reservedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'reserved' });
      const overdueBooks = await BookIssueModel.countDocuments({
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
        dueDate: { $lt: new Date() },
      });
      const totalFines = await BookIssueModel.aggregate([
        { $match: { school: new mongoose.Types.ObjectId(schoolId), fine: { $gt: 0 }, finePardoned: false } },
        { $group: { _id: null, total: { $sum: '$fine' } } },
      ]);

      logger.info(`Library stats fetched`, { schoolId });
      res.json({
        totalBooks,
        availableBooks,
        issuedBooks,
        reservedBooks,
        overdueBooks,
        totalFines: totalFines.length > 0 ? totalFines[0].total : 0,
      });
    } catch (error) {
      logger.error(`Error fetching library stats: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  searchBooks: async (req, res) => {
    try {
      const { query, category, classId, isGeneral } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, Category: CategoryModel } = libraryModelFactory(connection);

      const searchCriteria = { school: schoolId };
      if (query) {
        searchCriteria.$or = [
          { bookTitle: { $regex: query, $options: 'i' } },
          { author: { $regex: query, $options: 'i' } },
          { isbn: { $regex: query, $options: 'i' } },
        ];
      }
      if (category) {
        const categoryExists = await CategoryModel.findOne({ name: category, school: schoolId });
        if (!categoryExists) {
          return res.status(400).json({ message: 'Invalid category' });
        }
        searchCriteria.category = category;
      }
      if (classId) {
        if (!mongoose.Types.ObjectId.isValid(classId)) {
          return res.status(400).json({ message: 'Invalid class ID' });
        }
        searchCriteria.class = classId;
      }
      if (isGeneral !== undefined) {
        searchCriteria.isGeneral = isGeneral === 'true';
      }

      const books = await LibraryModel.find(searchCriteria)
        .select('bookTitle author isbn category class isGeneral totalCopies availableCopies status coverImage publisher publicationYear language')
        .populate('class', 'name')
        .sort({ bookTitle: 1 });

      logger.info(`Books searched: ${query || category || classId || isGeneral}`, { schoolId });
      res.json({ books });
    } catch (error) {
      logger.error(`Error searching books: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getStudentBookHistory: async (req, res) => {
    try {
      const { studentId, grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary && user._id.toString() !== studentId) {
        return res.status(403).json({ message: 'Unauthorized: You can only view your own history or need librarian permissions' });
      }

      let student;
      if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
      } else if (grNumber) {
        student = await UserModel.findOne({ 'studentDetails.grNumber': grNumber, school: schoolId, role: 'student' });
      }
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const history = await BookIssueModel.find({ user: student._id, school: schoolId })
        .populate('book', 'bookTitle author isbn category coverImage')
        .sort({ issueDate: -1 });

      const historyWithFines = history.map(issue => {
        const fine = issue.finePardoned ? 0 : (issue.status === 'overdue' || (issue.status === 'issued' && issue.dueDate < new Date()))
          ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay
          : issue.fine;
        return {
          ...issue.toObject(),
          fine,
          daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
          finePerDay: issue.finePerDay,
          finePardoned: issue.finePardoned,
        };
      });

      logger.info(`Fetched book history for student ${student._id}`, { schoolId });
      res.json({
        message: 'Book history retrieved successfully',
        student: {
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class,
          email: student.email,
          parentDetails: student.studentDetails.parentDetails,
        },
        history: historyWithFines,
      });
    } catch (error) {
      logger.error(`Error fetching student book history: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getOverdueBooks: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const overdueBooks = await BookIssueModel.find({
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
        dueDate: { $lt: new Date() },
      })
        .populate('book', 'bookTitle author isbn')
        .populate('user', 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails');

      const booksWithFine = overdueBooks.map((issue) => {
        const fine = issue.finePardoned ? 0 : Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay;
        return {
          ...issue.toObject(),
          fine,
          daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
          finePerDay: issue.finePerDay,
          finePardoned: issue.finePardoned,
        };
      });

      logger.info(`Overdue books fetched`, { schoolId });
      res.json({ overdueBooks: booksWithFine });
    } catch (error) {
      logger.error(`Error fetching overdue books: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  updateOverdueStatus: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const updatedIssues = await BookIssueModel.updateMany(
        {
          school: schoolId,
          status: 'issued',
          dueDate: { $lt: new Date() },
        },
        { $set: { status: 'overdue' } }
      );

      logger.info(`Updated ${updatedIssues.modifiedCount} book issues to overdue status`, { schoolId });
      res.json({ message: `Updated ${updatedIssues.modifiedCount} book issues to overdue status` });
    } catch (error) {
      logger.error(`Error updating overdue status: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  manageCategories: async (req, res) => {
    try {
      const { action, name, description } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Category: CategoryModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      if (action === 'add') {
        if (!name) {
          return res.status(400).json({ message: 'Category name is required' });
        }
        const existingCategory = await CategoryModel.findOne({ name, school: schoolId });
        if (existingCategory) {
          return res.status(400).json({ message: 'Category already exists' });
        }
        const category = new CategoryModel({ school: schoolId, name, description });
        await category.save();
        logger.info(`Category added: ${name}`, { schoolId });
        res.status(201).json({ message: 'Category added successfully', category });
      } else if (action === 'update') {
        const { categoryId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
        const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
        if (!category) {
          return res.status(404).json({ message: 'Category not found' });
        }
        category.name = name || category.name;
        category.description = description || category.description;
        await category.save();
        logger.info(`Category updated: ${name || category.name}`, { schoolId });
        res.json({ message: 'Category updated successfully', category });
      } else if (action === 'delete') {
        const { categoryId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
          return res.status(400).json({ message: 'Invalid category ID' });
        }
        const category = await CategoryModel.findOne({ _id: categoryId, school: schoolId });
        if (!category) {
          return res.status(404).json({ message: 'Category not found' });
        }
        const booksInCategory = await LibraryModel.countDocuments({ category: category.name, school: schoolId });
        if (booksInCategory > 0) {
          return res.status(400).json({ message: 'Cannot delete category with associated books' });
        }
        await CategoryModel.deleteOne({ _id: categoryId });
        logger.info(`Category deleted: ${category.name}`, { schoolId });
        res.json({ message: 'Category deleted successfully' });
      } else {
        const categories = await CategoryModel.find({ school: schoolId });
        res.json({ categories });
      }
    } catch (error) {
      logger.error(`Error managing categories: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getMyBookHistory: async (req, res) => {
    try {
      const studentId = req.user._id.toString();
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }

      const history = await BookIssueModel.find({ user: studentId, school: schoolId })
        .populate('book', 'bookTitle author isbn category coverImage')
        .sort({ issueDate: -1 });

      const historyWithFines = history.map(issue => {
        const fine = issue.finePardoned ? 0 : (issue.status === 'overdue' || (issue.status === 'issued' && issue.dueDate < new Date()))
          ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * issue.finePerDay
          : issue.fine;
        return {
          ...issue.toObject(),
          fine,
          daysOverdue: fine > 0 ? Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) : 0,
          finePerDay: issue.finePerDay,
          loanPeriodDays: issue.loanPeriodDays,
          finePardoned: issue.finePardoned,
        };
      });

      logger.info(`Fetched book history for student ${studentId}`, { schoolId });
      res.json({
        message: 'Book history retrieved successfully',
        history: historyWithFines,
      });
    } catch (error) {
      logger.error(`Error fetching student book history: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getAuditLogs: async (req, res) => {
    try {
      const { startDate, endDate, action } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const { AuditLog: AuditLogModel } = libraryModelFactory(connection);
      const UserModel = User(connection);

      const user = await UserModel.findById(req.user._id);
      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to view audit logs' });
      }

      const query = { school: schoolId };
      if (startDate) {
        query.timestamp = { $gte: new Date(startDate) };
      }
      if (endDate) {
        query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };
      }
      if (action) {
        query.action = action;
      }

      const logs = await AuditLogModel.find(query)
        .populate('user', 'name studentDetails.grNumber')
        .populate('book', 'bookTitle isbn')
        .sort({ timestamp: -1 });

      // Aggregate daily stats
      const dailyStats = await AuditLogModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              action: '$action',
            },
            count: { $sum: 1 },
            students: { $addToSet: '$user' },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            actions: {
              $push: {
                action: '$_id.action',
                count: '$count',
                uniqueStudents: { $size: '$students' },
              },
            },
          },
        },
        { $sort: { _id: -1 } },
      ]);

      logger.info(`Fetched audit logs`, { schoolId, startDate, endDate, action });
      res.json({
        message: 'Audit logs retrieved successfully',
        logs,
        dailyStats,
      });
    } catch (error) {
      logger.error(`Error fetching audit logs: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = libraryController;