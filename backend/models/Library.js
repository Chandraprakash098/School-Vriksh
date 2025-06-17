


// const mongoose = require('mongoose');

// const librarySchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   bookTitle: { type: String, required: true },
//   isbn: { type: String, required: true, unique: true },
//   author: { type: String, required: true },
//   category: { type: String, required: true },
//   totalCopies: { type: Number, required: true },
//   availableCopies: { type: Number, required: true },
//   status: { type: String, enum: ['available', 'unavailable'], default: 'available' },
//   coverImage: { type: String },
// }, { timestamps: true });



// const bookIssueSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   issueDate: { type: Date },
//   dueDate: { type: Date },
//   returnDate: { type: Date },
//   fine: { type: Number, default: 0 },
//   status: {
//     type: String,
//     enum: ['requested', 'issued', 'returned', 'overdue','rejected'],
//     default: 'requested',
//   },
// }, { timestamps: true });

// module.exports = (connection) => {
//   const Library = connection.model('Library', librarySchema);
//   const BookIssue = connection.model('BookIssue', bookIssueSchema);
//   return { Library, BookIssue };
// };


// const mongoose = require('mongoose');

// const librarySchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   bookTitle: { type: String, required: true },
//   isbn: { type: String, required: true, unique: true },
//   author: { type: String, required: true },
//   category: { type: String, required: false },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null }, // For class-specific books
//   isGeneral: { type: Boolean, default: true }, // General or class-specific
//   totalCopies: { type: Number, required: true },
//   availableCopies: { type: Number, required: true },
//   coverImage: { type: String },
//   publisher: { type: String },
//   publicationYear: { type: Number },
//   language: { type: String, default: 'English' },
//   description: { type: String },
//   status: { type: String, enum: ['available', 'unavailable', 'discontinued'], default: 'available' },
//   reservedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Students reserving the book
// }, { timestamps: true });

// const bookIssueSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   issueDate: { type: Date },
//   dueDate: { type: Date },
//   returnDate: { type: Date },
//   fine: { type: Number, default: 0 },
//   status: {
//     type: String,
//     enum: ['requested', 'issued', 'returned', 'overdue', 'rejected', 'reserved'],
//     default: 'requested',
//   },
//   remarks: { type: String }, // Librarian's comments on rejection or issuance
// }, { timestamps: true });

// const categorySchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true, unique: true },
//   description: { type: String },
// }, { timestamps: true });

// module.exports = (connection) => {
//   const Library = connection.model('Library', librarySchema);
//   const BookIssue = connection.model('BookIssue', bookIssueSchema);
//   const Category = connection.model('Category', categorySchema);
//   return { Library, BookIssue, Category };
// };



// const mongoose = require('mongoose');

// const librarySchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   bookTitle: { type: String, required: true },
//   isbn: { type: String, required: true, unique: true },
//   author: { type: String, required: true },
//   category: { type: String, required: false },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
//   isGeneral: { type: Boolean, default: true },
//   totalCopies: { type: Number, required: true },
//   availableCopies: { type: Number, required: true },
//   coverImage: { type: String },
//   publisher: { type: String },
//   publicationYear: { type: Number },
//   language: { type: String, default: 'English' },
//   description: { type: String },
//   status: { type: String, enum: ['available', 'unavailable', 'discontinued'], default: 'available' },
//   reservedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
// }, { timestamps: true });

// const bookIssueSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
//   user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   issueDate: { type: Date },
//   dueDate: { type: Date },
//   returnDate: { type: Date },
//   fine: { type: Number, default: 0 },
//   finePerDay: { type: Number, default: 5, min: [0, 'Fine per day cannot be negative'], max: [100, 'Fine per day cannot exceed 100'] },
//   loanPeriodDays: { type: Number, default: 14, min: [1, 'Loan period must be at least 1 day'], max: [30, 'Loan period cannot exceed 30 days'] },
//   finePardoned: { type: Boolean, default: false },
//   renewalCount: { type: Number, default: 0, min: [0, 'Renewal count cannot be negative'] }, // Track renewals
//   status: {
//     type: String,
//     enum: ['requested', 'issued', 'returned', 'overdue', 'rejected', 'reserved'],
//     default: 'requested',
//   },
//   remarks: { type: String },
// }, { timestamps: true });

// const categorySchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true, unique: true },
//   description: { type: String },
// }, { timestamps: true });

// module.exports = (connection) => {
//   const Library = connection.model('Library', librarySchema);
//   const BookIssue = connection.model('BookIssue', bookIssueSchema);
//   const Category = connection.model('Category', categorySchema);
//   return { Library, BookIssue, Category };
// };




const mongoose = require('mongoose');

const librarySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  bookTitle: { type: String, required: true },
  isbn: { type: String, required: true, unique: true },
  author: { type: String, required: true },
  category: { type: String, required: false },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  isGeneral: { type: Boolean, default: true },
  totalCopies: { type: Number, required: true },
  availableCopies: { type: Number, required: true },
  coverImage: { type: String },
  publisher: { type: String },
  publicationYear: { type: Number },
  language: { type: String, default: 'English' },
  description: { type: String },
  status: { type: String, enum: ['available', 'unavailable', 'discontinued'], default: 'available' },
  reservedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const bookIssueSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date },
  dueDate: { type: Date },
  returnDate: { type: Date },
  fine: { type: Number, default: 0 },
  finePerDay: { type: Number, default: 5, min: [0, 'Fine per day cannot be negative'], max: [100, 'Fine per day cannot exceed 100'] },
  loanPeriodDays: { type: Number, default: 14, min: [1, 'Loan period must be at least 1 day'], max: [30, 'Loan period cannot exceed 30 days'] },
  finePardoned: { type: Boolean, default: false },
  renewalCount: { type: Number, default: 0, min: [0, 'Renewal count cannot be negative'] }, // Track renewals
  status: {
    type: String,
    enum: ['requested', 'issued', 'returned', 'overdue', 'rejected', 'reserved'],
    default: 'requested',
  },
  remarks: { type: String },
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  name: { type: String, required: true, unique: true },
  description: { type: String },
}, { timestamps: true });

const auditLogSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  action: { 
    type: String, 
    enum: ['book_request', 'book_issue', 'book_renewal', 'book_return', 'book_reject', 'book_reserve', 'fine_pardon'], 
    required: true 
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Library' },
  details: { type: Object },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = (connection) => {
  const Library = connection.model('Library', librarySchema);
  const BookIssue = connection.model('BookIssue', bookIssueSchema);
  const Category = connection.model('Category', categorySchema);
  const AuditLog = connection.model('AuditLog', auditLogSchema);
  return { Library, BookIssue, Category, AuditLog };
};