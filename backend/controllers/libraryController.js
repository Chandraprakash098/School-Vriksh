// const mongoose = require('mongoose');

// const libraryController = {
//   addBook: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString(); // Use req.school instead of req.params
//       const bookData = req.body;
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library; // Adjust based on model export

//       const book = new Library({
//         school: schoolId,
//         ...bookData,
//         availableQuantity: bookData.quantity,
//         status: bookData.quantity > 0 ? 'available' : 'out-of-stock',
//       });

//       await book.save();
//       res.status(201).json(book);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   issueBook: async (req, res) => {
//     try {
//       const { bookId, userId } = req.params; // Removed schoolId from params
//       const { dueDate } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         const book = await Library.findOne({ _id: bookId, school: schoolId });
//         if (!book || book.availableQuantity <= 0) {
//           throw new Error('Book not available');
//         }

//         const overdueBooks = await BookIssue.find({
//           user: userId,
//           school: schoolId,
//           status: 'overdue',
//         });

//         if (overdueBooks.length > 0) {
//           throw new Error('User has overdue books');
//         }

//         const bookIssue = new BookIssue({
//           school: schoolId,
//           book: bookId,
//           user: userId,
//           issueDate: new Date(),
//           dueDate: new Date(dueDate),
//           status: 'issued',
//         });

//         book.availableQuantity -= 1;
//         book.status = book.availableQuantity === 0 ? 'out-of-stock'
//           : book.availableQuantity < 5 ? 'low-stock' : 'available';

//         await bookIssue.save({ session });
//         await book.save({ session });

//         await session.commitTransaction();
//         res.status(201).json(bookIssue);
//       } catch (error) {
//         await session.abortTransaction();
//         throw error;
//       } finally {
//         session.endSession();
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   returnBook: async (req, res) => {
//     try {
//       const { issueId } = req.params;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Library = require('../models/Library')(connection).Library;
//       const BookIssue = require('../models/Library')(connection).BookIssue;

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         const bookIssue = await BookIssue.findOne({ _id: issueId, school: schoolId });
//         if (!bookIssue) {
//           throw new Error('Book issue record not found');
//         }

//         const currentDate = new Date();
//         const dueDate = new Date(bookIssue.dueDate);
//         let fine = 0;

//         if (currentDate > dueDate) {
//           const daysOverdue = Math.ceil((currentDate - dueDate) / (1000 * 60 * 60 * 24));
//           fine = daysOverdue * 10; // ₹10 per day fine
//         }

//         bookIssue.returnDate = currentDate;
//         bookIssue.fine = fine;
//         bookIssue.status = 'returned';

//         const book = await Library.findById(bookIssue.book);
//         book.availableQuantity += 1;
//         book.status = book.availableQuantity === 0 ? 'out-of-stock'
//           : book.availableQuantity < 5 ? 'low-stock' : 'available';

//         await bookIssue.save({ session });
//         await book.save({ session });

//         await session.commitTransaction();
//         res.json(bookIssue);
//       } catch (error) {
//         await session.abortTransaction();
//         throw error;
//       } finally {
//         session.endSession();
//       }
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// module.exports = libraryController;


const mongoose = require('mongoose');
const logger = require('../utils/logger');
// const { Library, BookIssue } = require('../models/Library');
const User = require('../models/User');
const { uploadToS3, getPublicFileUrl } = require('../config/s3Upload');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const { uploadBookCover } = require('../config/s3Upload');
const libraryModelFactory = require('../models/Library');


// Configure Multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

const libraryController = {
  // Add a new book to the library
  addBook: async (req, res) => {
    try {
      const { bookTitle, author, isbn, category, totalCopies, description } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      // Get the models using the correct import
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
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
        totalCopies,
        availableCopies: totalCopies,
        description,
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

  // Update book details
  updateBook: async (req, res) => {
    try {
      const { bookId } = req.params;
      const { bookTitle, author, isbn, category, totalCopies, description, status } = req.body;
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

      const updates = {
        bookTitle: bookTitle || book.bookTitle,
        author: author || book.author,
        isbn: isbn || book.isbn,
        category: category || book.category,
        totalCopies: totalCopies || book.totalCopies,
        description: description || book.description,
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

  // Delete a book
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

      // Delete book cover from S3 if it exists
      if (book.coverImage) {
        const key = book.coverImage.split('/').slice(-3).join('/'); // Extract key from URL
        await require('../config/s3Upload').deleteFromS3(key);
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

  
  getBookIssueRequests: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      // const BookIssueModel = BookIssue(connection);
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);
      const user = await UserModel.findById(req.user._id);

      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const pendingRequests = await BookIssueModel.find({
        school: schoolId,
        status: 'requested',
      })
        .populate('book', 'bookTitle author isbn category coverImage')
        .populate('user', 'name studentDetails.grNumber email')
        .sort({ issueDate: 1 }); // Sort by request date (issueDate in schema)

      logger.info(`Fetched ${pendingRequests.length} pending book issue requests`, { schoolId });
      res.json({
        message: 'Pending book issue requests retrieved successfully',
        requests: pendingRequests,
      });
    } catch (error) {
      logger.error(`Error fetching book issue requests: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },



// issueBook: async (req, res) => {
//   try {
//     const { bookId, studentId } = req.params;
//     const { dueDate, requestId } = req.body; // Add requestId to handle student requests
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     // const LibraryModel = Library(connection);
//     // const BookIssueModel = BookIssue(connection);
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
//     if (requestId) {
//       // Handle existing student request
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
//     } else {
//       // Create a new issue (direct issuance by librarian)
//       const existingIssue = await BookIssueModel.findOne({
//         book: bookId,
//         user: studentId,
//         school: schoolId,
//         status: { $in: ['issued', 'overdue'] },
//       });
//       if (existingIssue) {
//         return res.status(400).json({ message: 'This book is already issued to the student' });
//       }

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

issueBook: async (req, res) => {
  try {
    const { bookId, studentId } = req.params;
    const { dueDate, requestId } = req.body;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
    const UserModel = User(connection);
    const user = await UserModel.findById(req.user._id);

    if (!user.permissions.canManageLibrary) {
      return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ message: 'Invalid book or student ID' });
    }

    const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    if (book.availableCopies === 0) {
      return res.status(400).json({ message: 'No copies available' });
    }

    const student = await UserModel.findOne({ _id: studentId, school: schoolId, role: 'student' });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check borrowing limit
    const activeIssues = await BookIssueModel.countDocuments({
      user: studentId,
      school: schoolId,
      status: { $in: ['issued', 'overdue'] },
    });
    if (activeIssues >= 3) {
      return res.status(400).json({ message: 'Student has reached maximum borrowing limit (3 books)' });
    }

    let issue;

    // Check for an existing pending request even if requestId is not provided
    const existingRequest = await BookIssueModel.findOne({
      book: bookId,
      user: studentId,
      school: schoolId,
      status: 'requested',
    });

    if (requestId) {
      // Handle issuance from a specific request
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ message: 'Invalid request ID' });
      }

      issue = await BookIssueModel.findOne({
        _id: requestId,
        book: bookId,
        user: studentId,
        school: schoolId,
        status: 'requested',
      });

      if (!issue) {
        return res.status(404).json({ message: 'Book request not found or already processed' });
      }

      // Update the existing request to issued
      issue.status = 'issued';
      issue.issueDate = new Date();
      issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else if (existingRequest) {
      // If no requestId is provided but a pending request exists, use it
      issue = existingRequest;
      issue.status = 'issued';
      issue.issueDate = new Date();
      issue.dueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    } else {
      // Check if the book is already issued to the student
      const existingIssue = await BookIssueModel.findOne({
        book: bookId,
        user: studentId,
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
      });
      if (existingIssue) {
        return res.status(400).json({ message: 'This book is already issued to the student' });
      }

      // Create a new issue (direct issuance by librarian)
      issue = new BookIssueModel({
        school: schoolId,
        book: bookId,
        user: studentId,
        issueDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'issued',
      });
    }

    book.availableCopies -= 1;
    if (book.availableCopies === 0) {
      book.status = 'unavailable';
    }

    await Promise.all([issue.save(), book.save()]);
    logger.info(`Book issued: ${book.bookTitle} to student ${studentId}`, { schoolId, requestId: requestId || 'direct' });
    res.json({ message: 'Book issued successfully', issue });
  } catch (error) {
    logger.error(`Error issuing book: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

rejectBookRequest: async (req, res) => {
  try {
    const { requestId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const { BookIssue: BookIssueModel } = libraryModelFactory(connection);
    const UserModel = User(connection);
    const user = await UserModel.findById(req.user._id);

    if (!user.permissions.canManageLibrary) {
      return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const issue = await BookIssueModel.findOne({ _id: requestId, school: schoolId, status: 'requested' });
    if (!issue) {
      return res.status(404).json({ message: 'Book request not found or already processed' });
    }

    issue.status = 'rejected';
    await issue.save();

    logger.info(`Book request rejected: ${issue.book} for student ${issue.user}`, { schoolId, requestId });
    res.json({ message: 'Book request rejected successfully', issue });
  } catch (error) {
    logger.error(`Error rejecting book request: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

  // Return a book
  returnBook: async (req, res) => {
    try {
      const { issueId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      // const LibraryModel = Library(connection);
      // const BookIssueModel = BookIssue(connection);
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
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
      const fine = issue.dueDate < today ? Math.ceil((today - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5 : 0;

      issue.status = 'returned';
      issue.returnDate = new Date();
      issue.fine = fine;
      book.availableCopies += 1;
      book.status = 'available';

      await Promise.all([issue.save(), book.save()]);
      logger.info(`Book returned: ${book.bookTitle} by student ${issue.user}`, { schoolId, fine });
      res.json({ message: 'Book returned successfully', issue });
    } catch (error) {
      logger.error(`Error returning book: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get library statistics
  getLibraryStats: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      // const LibraryModel = Library(connection);
      // const BookIssueModel = BookIssue(connection);
      const { Library: LibraryModel, BookIssue: BookIssueModel } = libraryModelFactory(connection);
      const UserModel = User(connection);
      const user = await UserModel.findById(req.user._id);

      if (!user.permissions.canManageLibrary) {
        return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
      }

      const totalBooks = await LibraryModel.countDocuments({ school: schoolId });
      const availableBooks = await LibraryModel.countDocuments({ school: schoolId, status: 'available' });
      const issuedBooks = await BookIssueModel.countDocuments({ school: schoolId, status: 'issued' });
      const overdueBooks = await BookIssueModel.countDocuments({
        school: schoolId,
        status: { $in: ['issued', 'overdue'] },
        dueDate: { $lt: new Date() },
      });

      const totalFines = await BookIssueModel.aggregate([
        { $match: { school: new mongoose.Types.ObjectId(schoolId), fine: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$fine' } } },
      ]);

      logger.info(`Library stats fetched`, { schoolId });
      res.json({
        totalBooks,
        availableBooks,
        issuedBooks,
        overdueBooks,
        totalFines: totalFines.length > 0 ? totalFines[0].total : 0,
      });
    } catch (error) {
      logger.error(`Error fetching library stats: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Search books
  searchBooks: async (req, res) => {
    try {
      const { query, category } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      const LibraryModel = Library(connection);

      const searchCriteria = { school: schoolId };
      if (query) {
        searchCriteria.$or = [
          { bookTitle: { $regex: query, $options: 'i' } },
          { author: { $regex: query, $options: 'i' } },
          { isbn: { $regex: query, $options: 'i' } },
        ];
      }
      if (category) {
        searchCriteria.category = category;
      }

      const books = await LibraryModel.find(searchCriteria)
        .select('bookTitle author isbn category totalCopies availableCopies status coverImage')
        .sort({ bookTitle: 1 });

      logger.info(`Books searched: ${query || category}`, { schoolId });
      res.json({ books });
    } catch (error) {
      logger.error(`Error searching books: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // Get overdue books
  getOverdueBooks: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      const BookIssueModel = BookIssue(connection);
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
        .populate('user', 'name studentDetails.grNumber');

      const booksWithFine = overdueBooks.map((issue) => {
        const fine = Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)) * 5;
        return {
          ...issue.toObject(),
          fine,
          daysOverdue: Math.ceil((new Date() - issue.dueDate) / (1000 * 60 * 60 * 24)),
        };
      });

      logger.info(`Overdue books fetched`, { schoolId });
      res.json({ overdueBooks: booksWithFine });
    } catch (error) {
      logger.error(`Error fetching overdue books: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  


  // uploadBookCover : async (req, res) => {
  // try {
  //   const { bookId } = req.params;
  //   const schoolId = req.school._id.toString();
  //   const connection = req.connection;
  //   const LibraryModel = Library(connection);
  //   const UserModel = User(connection);
  //   const user = await UserModel.findById(req.user._id);

  //   if (!user.permissions.canManageLibrary) {
  //     return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
  //   }

  //   if (!mongoose.Types.ObjectId.isValid(bookId)) {
  //     return res.status(400).json({ message: 'Invalid book ID' });
  //   }

  //   if (!req.file) {
  //     return res.status(400).json({ message: 'No file uploaded' });
  //   }

  //   // Validate image dimensions
  //   const metadata = await sharp(req.file.buffer).metadata();
  //   if (metadata.width < 200 || metadata.height < 200) {
  //     return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
  //   }

  //   const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
  //   if (!book) {
  //     return res.status(404).json({ message: 'Book not found' });
  //   }

  //   if (book.coverImage) {
  //     try {
  //       const oldKey = book.coverImage.split('/').slice(-3).join('/');
  //       await require('../config/s3Upload').deleteFromS3(oldKey);
  //     } catch (deleteError) {
  //       logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
  //     }
  //   }

  //   const fileExt = path.extname(req.file.originalname);
  //   const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
  //   const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
  //   const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

  //   book.coverImage = coverUrl;
  //   await book.save();

  //   logger.info(`Book cover uploaded for book ${book.bookTitle}`, { bookId, schoolId, coverUrl });
  //   res.json({ message: 'Book cover uploaded successfully', coverUrl });
  // } catch (error) {
  //   logger.error(`Error uploading book cover: ${error.message}`, { error });
  //   res.status(500).json({ error: error.message });
  // }
  // },


//  uploadBookCover: async (req, res) => {
//   try {
//     const { bookId } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
    
//     // Use the factory pattern consistently
//     const { Library: LibraryModel } = libraryModelFactory(connection);
//     const UserModel = User(connection);
//     const user = await UserModel.findById(req.user._id);

//     if (!user.permissions.canManageLibrary) {
//       return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
//     }

//     if (!mongoose.Types.ObjectId.isValid(bookId)) {
//       return res.status(400).json({ message: 'Invalid book ID' });
//     }

//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded' });
//     }

//     // Validate image dimensions
//     const metadata = await sharp(req.file.buffer).metadata();
//     if (metadata.width < 200 || metadata.height < 200) {
//       return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
//     }

//     const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
//     if (!book) {
//       return res.status(404).json({ message: 'Book not found' });
//     }

//     // Delete old cover image if exists
//     if (book.coverImage) {
//       try {
//         const oldKey = book.coverImage.split('/').slice(-3).join('/');
//         const { deleteFromS3 } = require('../config/s3Upload');
//         await deleteFromS3(oldKey);
//       } catch (deleteError) {
//         logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
//       }
//     }

//     // Generate file key
//     const fileExt = path.extname(req.file.originalname);
//     const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
//     const fileKey = `library/${schoolId}/${bookId}/${fileName}`;

//     // Upload directly using uploadToS3 function
//     const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

//     // Update book with new cover URL
//     book.coverImage = coverUrl;
//     await book.save();

//     logger.info(`Book cover uploaded for book ${book.bookTitle}`, { bookId, schoolId, coverUrl });
//     res.json({ message: 'Book cover uploaded successfully', coverUrl });
//   } catch (error) {
//     logger.error(`Error uploading book cover: ${error.message}`, { error });
//     res.status(500).json({ error: error.message });
//   }
// },


uploadBookCover: async (req, res) => {
  try {
    const { bookId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const { Library: LibraryModel } = libraryModelFactory(connection);
    const UserModel = User(connection);
    const user = await UserModel.findById(req.user._id);

    // Permission check
    if (!user.permissions.canManageLibrary) {
      return res.status(403).json({ message: 'Unauthorized: You do not have permission to manage library' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: 'Invalid book ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Validate image
    const metadata = await sharp(req.file.buffer).metadata();
    if (metadata.width < 200 || metadata.height < 200) {
      return res.status(400).json({ message: 'Image dimensions must be at least 200x200 pixels' });
    }

    const book = await LibraryModel.findOne({ _id: bookId, school: schoolId });
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    // Delete old cover if exists
    if (book.coverImage) {
      try {
        const oldKey = book.coverImage.split('/').slice(-3).join('/');
        await deleteFromS3(oldKey);
      } catch (deleteError) {
        logger.warn(`Failed to delete old cover image: ${deleteError.message}`);
      }
    }

    // Generate S3 key and upload
    const fileExt = path.extname(req.file.originalname);
    const fileName = `cover_${bookId}_${Date.now()}${fileExt}`;
    const fileKey = `library/${schoolId}/${bookId}/${fileName}`;
    const coverUrl = await uploadToS3(req.file.buffer, fileKey, req.file.mimetype);

    // Update book record
    book.coverImage = coverUrl;
    await book.save();

    logger.info(`Book cover uploaded for ${book.bookTitle}`, { bookId, schoolId });
    res.json({ 
      success: true,
      message: 'Book cover uploaded successfully',
      coverUrl 
    });
  } catch (error) {
    logger.error(`Error uploading book cover: ${error.message}`, { error });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
},



  updateOverdueStatus : async (req, res) => {
  try {
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const BookIssueModel = BookIssue(connection);
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
}
}

module.exports = libraryController;