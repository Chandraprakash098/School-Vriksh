const mongoose = require('mongoose');

const librarySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  bookTitle: { type: String, required: true },
  author: { type: String, required: true },
  isbn: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true },
  availableQuantity: { type: Number, required: true },
  location: { type: String, required: true },
  addedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['available', 'low-stock', 'out-of-stock'], required: true }
}, { timestamps: true });

const bookIssueSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date, required: true },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date },
  fine: { type: Number, default: 0 },
  status: { type: String, enum: ['issued', 'returned', 'overdue'], required: true }
}, { timestamps: true });

// module.exports = {
//   Library: mongoose.model('Library', librarySchema),
//   BookIssue: mongoose.model('BookIssue', bookIssueSchema)
// };

module.exports = {
  Library: (connection) => connection.model('Library', librarySchema),
  BookIssue: (connection) => connection.model('BookIssue', bookIssueSchema)
};


