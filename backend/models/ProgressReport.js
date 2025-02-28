const mongoose = require('mongoose');

const progressReportSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    month: Number,
    year: Number,
    term: String,
    subjects: [{
      name: String,
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      marks: Number,
      maxMarks: Number,
      grade: String,
      remarks: String
    }],
    attendance: {
      totalDays: Number,
      presentDays: Number,
      percentage: Number
    },
    remarks: String
  }, { timestamps: true });

  // module.exports = mongoose.model('ProgressReport', progressReportSchema)
  module.exports = (connection) => connection.model('ProgressReport',progressReportSchema);