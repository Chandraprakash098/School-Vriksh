const ExamSchedule = require('../models/ExamSchedule');
const Result = require('../models/Result');
const Class = require('../models/Class');

const examController = {
  // Create exam schedule
  createExamSchedule: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const examData = req.body;

      // Validate class exists
      const classExists = await Class.findById(examData.class);
      if (!classExists) {
        return res.status(404).json({ message: 'Class not found' });
      }

      // Create exam schedule
      const examSchedule = new ExamSchedule({
        school: schoolId,
        ...examData
      });

      // Generate seating arrangement
      const seatingArrangement = await generateSeatingArrangement(
        examSchedule.class,
        examData.venues
      );
      examSchedule.seatingArrangement = seatingArrangement;

      await examSchedule.save();
      res.status(201).json(examSchedule);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Enter exam results
  enterResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const { results } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Get exam schedule
        const examSchedule = await ExamSchedule.findById(examId);
        if (!examSchedule) {
          throw new Error('Exam schedule not found');
        }

        // Process results for each student
        const resultPromises = results.map(async (studentResult) => {
          const result = new Result({
            school: examSchedule.school,
            student: studentResult.studentId,
            examSchedule: examId,
            class: classId,
            subjects: studentResult.subjects,
            totalMarks: calculateTotalMarks(studentResult.subjects),
            percentage: calculatePercentage(studentResult.subjects),
            grade: calculateGrade(studentResult.subjects),
            status: determineStatus(studentResult.subjects),
            publishedBy: req.user._id
          });

          return result.save({ session });
        });

        await Promise.all(resultPromises);
        await session.commitTransaction();

        res.json({ message: 'Results entered successfully' });
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

  // Generate report cards
  generateReportCards: async (req, res) => {
    try {
      const { examId, classId } = req.params;

      // Get all results for the exam and class
      const results = await Result.find({
        examSchedule: examId,
        class: classId
      })
      .populate('student', 'name profile')
      .populate('examSchedule', 'examType academicYear')
      .lean();

      // Calculate class statistics
      const classStats = calculateClassStatistics(results);

      // Generate report cards
      const reportCards = results.map(result => 
        generateReportCard(result, classStats)
      );

      res.json(reportCards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

// Helper functions for exam controller
function calculateTotalMarks(subjects) {
  return subjects.reduce((total, subject) => total + subject.marksObtained, 0);
}

function calculatePercentage(subjects) {
  const totalObtained = subjects.reduce((total, subject) => total + subject.marksObtained, 0);
  const totalPossible = subjects.reduce((total, subject) => total + subject.totalMarks, 0);
  return (totalObtained / totalPossible) * 100;
}

function calculateGrade(subjects) {
  const percentage = calculatePercentage(subjects);
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'F';
}

function determineStatus(subjects) {
  const failedSubjects = subjects.filter(
    subject => (subject.marksObtained / subject.totalMarks) * 100 < 35
  );
  return failedSubjects.length > 0 ? 'fail' : 'pass';
}

module.exports = examController;