const { Library, BookIssue } = require('../models/Library');
const User = require('../models/User');

const libraryController = {
  // Add new book
  addBook: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const bookData = req.body;

      const book = new Library({
        school: schoolId,
        ...bookData,
        availableQuantity: bookData.quantity,
        status: bookData.quantity > 0 ? 'available' : 'out-of-stock'
      });

      await book.save();
      res.status(201).json(book);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Issue book
  issueBook: async (req, res) => {
    try {
      const { schoolId, bookId, userId } = req.params;
      const { dueDate } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Check book availability
        const book = await Library.findById(bookId);
        if (book.availableQuantity <= 0) {
          throw new Error('Book not available');
        }

        // Check if user has any overdue books
        const overdueBooks = await BookIssue.find({
          user: userId,
          status: 'overdue'
        });

        if (overdueBooks.length > 0) {
          throw new Error('User has overdue books');
        }

        // Create book issue record
        const bookIssue = new BookIssue({
          school: schoolId,
          book: bookId,
          user: userId,
          issueDate: new Date(),
          dueDate: new Date(dueDate),
          status: 'issued'
        });

        // Update book quantity
        book.availableQuantity -= 1;
        book.status = book.availableQuantity === 0 ? 'out-of-stock' : 
                     book.availableQuantity < 5 ? 'low-stock' : 'available';

        await bookIssue.save({ session });
        await book.save({ session });

        await session.commitTransaction();
        res.status(201).json(bookIssue);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Return book
  returnBook: async (req, res) => {
    try {
      const { issueId } = req.params;
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const bookIssue = await BookIssue.findById(issueId);
        if (!bookIssue) {
          throw new Error('Book issue record not found');
        }

        // Calculate fine if overdue
        const currentDate = new Date();
        const dueDate = new Date(bookIssue.dueDate);
        let fine = 0;

        if (currentDate > dueDate) {
          const daysOverdue = Math.ceil((currentDate - dueDate) / (1000 * 60 * 60 * 24));
          fine = daysOverdue * 10; // ₹10 per day fine
        }

        // Update book issue record
        bookIssue.returnDate = currentDate;
        bookIssue.fine = fine;
        bookIssue.status = 'returned';

        // Update book quantity
        const book = await Library.findById(bookIssue.book);
        book.availableQuantity += 1;
        book.status = book.availableQuantity === 0 ? 'out-of-stock' : 
                     book.availableQuantity < 5 ? 'low-stock' : 'available';

        await bookIssue.save({ session });
        await book.save({ session });

        await session.commitTransaction();
        res.json(bookIssue);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = libraryController;