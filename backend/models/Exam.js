// const mongoose = require('mongoose');

// const examSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   subject: { type: String, required: true },
//   date: { type: Date, required: true },
//   duration: { type: Number, required: true }, // in minutes
//   totalMarks: { type: Number, required: true },
//   seatingArrangement: [{
//     classroom: String,
//     students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
//   }],
//   results: [{
//     student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//     marksObtained: Number,
//     remarks: String
//   }]
// }, { timestamps: true });

// // module.exports = mongoose.model('Exam', examSchema);
// module.exports = (connection) => connection.model('Exam', examSchema);



// const mongoose = require('mongoose');

// const examSchema = new mongoose.Schema({
//   school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
//   name: { type: String, required: true },
//   class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
//   subject: { type: String, required: true },
//   date: { type: Date, required: true },
//   duration: { type: Number, required: true },
//   totalMarks: { type: Number, required: true },
//   seatingArrangement: [{
//       classroom: String,
//       capacity: Number,
//       arrangement: [{
//           row: Number,
//           students: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, position: Number }]
//       }]
//   }],
//   results: [{
//       student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
//       marksObtained: Number,
//       remarks: String
//   }]
// }, { timestamps: true });

// module.exports = (connection) => connection.model('Exam', examSchema);


// In your exam model file

const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  // name: { type: String, required: true },
  // examType: { 
  //   type: String, 
  //   enum: ['Unit Test', 'Midterm', 'Final', 'Practical'],
  //   required: true 
  // },

  examType: { 
    type: String, 
    enum: ['Unit Test', 'Midterm', 'Final', 'Practical', 'Other'],
    required: true 
  },
  customExamType: { 
    type: String,
    required: function() { return this.examType === 'Other'; } // Required only if examType is 'Other'
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  // examDate: { type: Date, required: true },  // Specific date for this subject exam
  examDate: { 
    type: Date, 
    required: true,
    validate: {
      validator: function(v) {
        return v instanceof Date && !isNaN(v.getTime());
      },
      message: 'examDate must be a valid date'
    }
  },
  startTime: { type: String, required: true }, // e.g., "09:00"
  endTime: { type: String, required: true },   // e.g., "11:00"
  totalMarks: { type: Number, required: true },
  seatingArrangement: [{
    classroom: String,
    capacity: Number,
    arrangement: [{
      row: Number,
      students: [{
        student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        position: Number
      }]
    }]
  }],
  results: [{
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    marksObtained: Number,
    remarks: String
  }]
}, { timestamps: true });

module.exports = (connection) => connection.model('Exam', examSchema);