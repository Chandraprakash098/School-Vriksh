// // models/Library.js
// const mongoose = require('mongoose');

// const bookSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   bookTitle: { type: String, required: true },
//   author: { type: String, required: true },
//   isbn: { type: String, required: true, unique: true },
//   category: { type: String, required: true },
//   totalCopies: { type: Number, required: true },
//   availableCopies: { type: Number, required: true },
//   description: String,
//   status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
//   coverImage: String,
// }, { timestamps: true });

// const bookIssueSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   issueDate: Date,
//   dueDate: Date,
//   returnDate: Date,
//   fine: { type: Number, default: 0 },
//   status: { type: String, enum: ['requested', 'issued', 'overdue', 'returned'], required: true },
//   requestDate: Date,
// }, { timestamps: true });

// module.exports = (connection) => ({
//   Library: connection.model('Library', bookSchema),
//   BookIssue: connection.model('BookIssue', bookIssueSchema),
// });


// const mongoose = require('mongoose');

// const bookSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   bookTitle: { type: String, required: true },
//   author: { type: String, required: true },
//   isbn: { type: String, required: true, unique: true },
//   category: { type: String, required: true },
//   totalCopies: { type: Number, required: true },
//   availableCopies: { type: Number, required: true },
//   description: String,
//   status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
//   coverImage: String,
// }, { timestamps: true });

// const bookIssueSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   issueDate: Date,
//   dueDate: Date,
//   returnDate: Date,
//   fine: { type: Number, default: 0 },
//   status: { type: String, enum: ['requested', 'issued', 'overdue', 'returned'], required: true },
//   requestDate: Date,
// }, { timestamps: true });

// // Export both models and the combined function for flexibility
// module.exports = {
//   // Individual model creators
//   Library: (connection) => connection.model('Library', bookSchema),
//   BookIssue: (connection) => connection.model('BookIssue', bookIssueSchema),
  
//   // Combined function (for backward compatibility)
//   default: (connection) => ({
//     Library: connection.model('Library', bookSchema),
//     BookIssue: connection.model('BookIssue', bookIssueSchema),
//   })
// };


// models/Library.js
const mongoose = require('mongoose');

const librarySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  bookTitle: { type: String, required: true },
  isbn: { type: String, required: true, unique: true },
  author: { type: String, required: true },
  category: { type: String, required: true },
  totalCopies: { type: Number, required: true },
  availableCopies: { type: Number, required: true },
  status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
  coverImage: { type: String },
}, { timestamps: true });



const bookIssueSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date },
  dueDate: { type: Date },
  returnDate: { type: Date },
  fine: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['requested', 'issued', 'returned', 'overdue'],
    default: 'requested',
  },
}, { timestamps: true });

module.exports = (connection) => {
  const Library = connection.model('Library', librarySchema);
  const BookIssue = connection.model('BookIssue', bookIssueSchema);
  return { Library, BookIssue };
};