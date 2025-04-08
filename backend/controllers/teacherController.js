
// const mongoose = require('mongoose');

// const teacherController = {
//   // View schedule
//   getSchedule: async (req, res) => {
//     try {
//       const { teacherId } = req.params;
//       const schoolId = req.school._id.toString(); // Use req.school from auth middleware
//       const connection = req.connection;
//       const TeacherSchedule = require('../models/TeacherSchedule')(connection);
//       const Class = require('../models/Class')(connection);

//       const currentDate = new Date();

//       const schedule = await TeacherSchedule.findOne({
//         teacher: teacherId,
//         school: schoolId, // Add school filter
//         academicYear: getCurrentAcademicYear(),
//       })
//         .populate('schedule.periods.class', 'name division', Class)
//         .lean();

//       if (!schedule) {
//         return res.status(404).json({ message: 'Schedule not found' });
//       }

//       // Get any substitutions for today
//       const todaySubstitutions = schedule.substitutions.filter(sub =>
//         isSameDay(sub.date, currentDate)
//       );

//       res.json({ schedule, todaySubstitutions });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Assign homework
//   assignHomework: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { classId } = req.params; // Use classId from params
//       const homeworkData = req.body;
//       const connection = req.connection;
//       const Homework = require('../models/Homework')(connection);

//       const homework = new Homework({
//         school: schoolId,
//         class: classId, // Use classId instead of homeworkData.classId
//         ...homeworkData,
//         assignedBy: req.user._id,
//       });

//       await homework.save();
//       res.status(201).json(homework);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   markAttendance: async (req, res) => {
//     try {
//       const { classId } = req.params; // Removed schoolId from params
//       const { date, attendanceData } = req.body;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString(); // Use req.school
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Attendance = require('../models/Attendance')(connection);

//       const teacher = await User.findById(teacherId);
//       if (!teacher || !teacher.permissions.canTakeAttendance.some(id => id.toString() === classId)) {
//         return res.status(403).json({
//           message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.',
//         });
//       }

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         const attendancePromises = attendanceData.map(async (student) => {
//           const attendance = new Attendance({
//             school: schoolId,
//             class: classId,
//             user: student.userId,
//             date,
//             status: student.status,
//             type: 'student',
//             markedBy: teacherId,
//           });
//           return attendance.save({ session });
//         });

//         const attendanceRecords = await Promise.all(attendancePromises);

//         await session.commitTransaction();
//         res.json(attendanceRecords);
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

//   markOwnAttendance: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString(); // Use req.school instead of req.params
//       const { date, status, remarks } = req.body;
//       const teacherId = req.user._id;
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);

//       const attendance = new Attendance({
//         school: schoolId,
//         user: teacherId,
//         date,
//         status,
//         remarks,
//         type: 'teacher',
//         markedBy: teacherId,
//       });

//       await attendance.save();
//       res.status(201).json(attendance);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   uploadStudyMaterial: async (req, res) => {
//     try {
//       const { classId } = req.params; // Removed schoolId from params
//       const { title, description, subject, type, fileUrl } = req.body;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const StudyMaterial = require('../models/StudyMaterial')(connection);

//       // Verify if teacher teaches this class (updated to use dynamic User model)
//       const isAssigned = await verifyTeacherClassAssignment(teacherId, classId, connection);
//       if (!isAssigned) {
//         return res.status(403).json({ message: 'You are not authorized to upload materials for this class' });
//       }

//       const material = new StudyMaterial({
//         school: schoolId, // Add school field
//         title,
//         description,
//         class: classId,
//         subject,
//         type,
//         fileUrl,
//         uploadedBy: teacherId,
//         isActive: true,
//       });

//       await material.save();

//       // Notify students about new material (implement notifyNewStudyMaterial if needed)
//       // await notifyNewStudyMaterial(material);

//       res.status(201).json(material);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   enterStudentMarks: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const { studentsMarks } = req.body;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const exam = await Exam.findOne({ _id: examId, school: schoolId });
//       if (!exam) {
//         return res.status(404).json({ message: 'Exam not found' });
//       }

//       // Verify teacher permission for this subject/class
//       const subjectInfo = await Subject.findById(exam.subject);
//       const isAuthorized = subjectInfo.teachers.some(t =>
//         t.teacher.toString() === teacherId.toString()
//       );

//       if (!isAuthorized) {
//         return res.status(403).json({ message: 'Unauthorized to enter marks for this exam' });
//       }

//       // Update student marks
//       const results = studentsMarks.map(entry => ({
//         student: entry.studentId,
//         marks: entry.marks,
//         remarks: entry.remarks || '',
//       }));

//       exam.results = results;
//       exam.marksEnteredBy = teacherId;
//       exam.marksEnteredAt = new Date();

//       await exam.save();
//       res.json(exam);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   generateProgressReport: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const { month, year, studentId } = req.body;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const Attendance = require('../models/Attendance')(connection);
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);
//       const ProgressReport = require('../models/ProgressReport')(connection);

//       // Verify if teacher is class teacher
//       const classInfo = await Class.findOne({ _id: classId, school: schoolId });
//       if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
//         return res.status(403).json({ message: 'Only class teachers can generate progress reports' });
//       }

//       // Get attendance for the month
//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);

//       const attendance = await Attendance.find({
//         school: schoolId,
//         class: classId,
//         user: studentId,
//         date: { $gte: startDate, $lte: endDate },
//       });

//       // Get exam results for the period
//       const exams = await Exam.find({
//         school: schoolId,
//         class: classId,
//         date: { $gte: startDate, $lte: endDate },
//       }).select('name subject results');

//       // Get subjects for the class
//       const subjects = await Subject.find({ school: schoolId, class: classId })
//         .populate('teachers.teacher', 'name');

//       // Compile report
//       const report = new ProgressReport({
//         school: schoolId, // Add school field
//         student: studentId,
//         class: classId,
//         month,
//         year,
//         academicYear: getCurrentAcademicYear(),
//         attendanceSummary: {
//           totalDays: attendance.length,
//           present: attendance.filter(a => a.status === 'present').length,
//           absent: attendance.filter(a => a.status === 'absent').length,
//           late: attendance.filter(a => a.status === 'late').length,
//         },
//         subjects: subjects.map(subject => {
//           const subjectExams = exams.filter(e => e.subject.toString() === subject._id.toString());
//           const studentResults = subjectExams.map(exam => {
//             const result = exam.results.find(r => r.student.toString() === studentId);
//             return result ? { exam: exam.name, marks: result.marks } : null;
//           }).filter(Boolean);

//           return {
//             name: subject.name,
//             teacher: subject.teachers[0]?.teacher,
//             performance: studentResults,
//             comments: '', // To be filled by teacher
//           };
//         }),
//         generatedBy: teacherId,
//       });

//       await report.save();

//       // Notify student and parents (implement notifyProgressReport if needed)
//       // await notifyProgressReport(report);

//       res.status(201).json(report);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   createAnnouncement: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString(); // Use req.school instead of req.params
//       const { title, content, targetGroups, validFrom, validUntil, attachments } = req.body;
//       const teacherId = req.user._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);

//       const announcement = new Announcement({
//         school: schoolId,
//         title,
//         content,
//         targetGroups, // Array of target groups: ['students', 'parents']
//         priority: 'normal',
//         validFrom,
//         validUntil,
//         attachments,
//         createdBy: teacherId,
//       });

//       await announcement.save();

//       // Notify target groups (implement notifyAnnouncementTargets if needed)
//       // await notifyAnnouncementTargets(announcement);

//       res.status(201).json(announcement);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },


//   requestLeave: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const { reason, startDate, endDate, type } = req.body;
//       const teacherId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leave = new Leave({
//         school: schoolId,
//         user: teacherId,
//         reason,
//         startDate,
//         endDate,
//         type,
//         status: 'pending',
//         appliedOn: new Date(),
//       });

//       await leave.save();
//       res.status(201).json(leave);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getLeaveStatus: async (req, res) => {
//     try {
//       const schoolId = req.school._id.toString();
//       const teacherId = req.user._id;
//       const connection = req.connection;
//       const Leave = require('../models/Leave')(connection);

//       const leaves = await Leave.find({ school: schoolId, user: teacherId })
//         .sort({ appliedOn: -1 })
//         .lean();

//       res.json({
//         status: 'success',
//         count: leaves.length,
//         leaves: leaves.map(leave => ({
//           id: leave._id,
//           reason: leave.reason,
//           startDate: leave.startDate,
//           endDate: leave.endDate,
//           type: leave.type,
//           status: leave.status,
//           appliedOn: leave.appliedOn,
//           reviewedBy: leave.reviewedBy,
//           reviewedAt: leave.reviewedAt,
//           comments: leave.comments,
//         })),
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   communicateWithParent: async (req, res) => {
//     try {
//       const { studentId } = req.params; // Removed schoolId from params
//       const { subject, message, type } = req.body;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const ParentCommunication = require('../models/ParentCommunication')(connection);

//       // Get student's parent
//       const student = await User.findOne({ _id: studentId, school: schoolId })
//         .select('studentDetails.parentDetails');

//       if (!student || !student.studentDetails.parentDetails) {
//         return res.status(404).json({ message: 'Student or parent details not found' });
//       }

//       const communication = new ParentCommunication({
//         school: schoolId,
//         student: studentId,
//         parent: null, // Assuming parent is a separate User; adjust if parentDetails contains a User ID
//         teacher: req.user._id,
//         subject,
//         message,
//         type,
//       });

//       await communication.save();

//       // Notify parent (implement notifyParent if needed)
//       // await notifyParent(communication);

//       res.status(201).json(communication);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // enterSubjectMarks: async (req, res) => {
//   //   try {
//   //     const { examId } = req.params;
//   //     const { studentsMarks } = req.body;
//   //     const teacherId = req.user._id;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const Exam = require('../models/Exam')(connection);
//   //     const SubjectMarks = require('../models/SubjectMarks')(connection);
//   //     const User = require('../models/User')(connection);

//   //     // Verify exam exists
//   //     const exam = await Exam.findOne({ _id: examId, school: schoolId });
//   //     if (!exam) {
//   //       return res.status(404).json({ message: 'Exam not found' });
//   //     }

//   //     // Verify teacher permission for this subject/class
//   //     const teacher = await User.findById(teacherId);
//   //     const hasPermission = teacher.permissions.canEnterMarks.some(
//   //       p => p.class.toString() === exam.class.toString()
//   //     );

//   //     if (!hasPermission) {
//   //       return res.status(403).json({ message: 'Not authorized to enter marks for this class' });
//   //     }

//   //     // Create or update subject marks
//   //     let subjectMarks = await SubjectMarks.findOne({
//   //       exam: examId,
//   //       teacher: teacherId,
//   //       class: exam.class,
//   //       school: schoolId, // Add school filter
//   //     });

//   //     if (!subjectMarks) {
//   //       subjectMarks = new SubjectMarks({
//   //         school: schoolId,
//   //         exam: examId,
//   //         subject: teacher.permissions.canEnterMarks.find(
//   //           p => p.class.toString() === exam.class.toString()
//   //         ).subject,
//   //         class: exam.class,
//   //         teacher: teacherId,
//   //         students: studentsMarks,
//   //       });
//   //     } else {
//   //       subjectMarks.students = studentsMarks;
//   //       subjectMarks.status = 'draft';
//   //     }

//   //     await subjectMarks.save();

//   //     res.json(subjectMarks);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   enterSubjectMarks: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const { studentsMarks } = req.body; // [{ studentId, marks, remarks }]
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const exam = await Exam.findOne({ _id: examId, school: schoolId });
//       if (!exam) return res.status(404).json({ message: 'Exam not found' });

//       // Verify teacher permission for this subject/class
//       const subject = await Subject.findById(exam.subject);
//       const isAuthorized = subject.teachers.some(t => t.teacher.toString() === teacherId.toString());
//       if (!isAuthorized) return res.status(403).json({ message: 'Not authorized to enter marks for this exam' });

//       exam.results = studentsMarks.map(entry => ({
//         student: entry.studentId,
//         marksObtained: entry.marks,
//         remarks: entry.remarks || ''
//       }));
//       exam.marksEnteredBy = teacherId;
//       exam.marksEnteredAt = new Date();
//       exam.status = 'draft';

//       await exam.save();
//       res.json({ message: 'Marks entered successfully', exam });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // submitMarksToClassTeacher: async (req, res) => {
//   //   try {
//   //     const { examId } = req.params;
//   //     const teacherId = req.user._id;
//   //     const schoolId = req.school._id.toString();
//   //     const connection = req.connection;
//   //     const SubjectMarks = require('../models/SubjectMarks')(connection);
//   //     const ClassResult = require('../models/ClassResult')(connection);
//   //     const Class = require('../models/Class')(connection);

//   //     const subjectMarks = await SubjectMarks.findOne({
//   //       exam: examId,
//   //       teacher: teacherId,
//   //       school: schoolId,
//   //     });

//   //     if (!subjectMarks) {
//   //       return res.status(404).json({ message: 'Marks not found' });
//   //     }

//   //     subjectMarks.status = 'submitted';
//   //     subjectMarks.submittedAt = new Date();
//   //     await subjectMarks.save();

//   //     // Update class result status
//   //     await ClassResult.findOneAndUpdate(
//   //       { exam: examId, class: subjectMarks.class, school: schoolId },
//   //       {
//   //         $addToSet: { subjectMarks: subjectMarks._id },
//   //         $setOnInsert: {
//   //           classTeacher: (await Class.findById(subjectMarks.class)).classTeacher,
//   //         },
//   //       },
//   //       { upsert: true }
//   //     );

//   //     res.json({ message: 'Marks submitted to class teacher successfully' });
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   submitMarksToClassTeacher: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Class = require('../models/Class')(connection);

//       const exam = await Exam.findOne({ _id: examId, school: schoolId });
//       if (!exam) return res.status(404).json({ message: 'Exam not found' });
//       if (exam.marksEnteredBy.toString() !== teacherId.toString()) {
//         return res.status(403).json({ message: 'Not authorized to submit these marks' });
//       }
//       if (exam.status !== 'draft') {
//         return res.status(400).json({ message: 'Marks already submitted or in invalid state' });
//       }

//       const classInfo = await Class.findById(exam.class);
//       if (!classInfo.classTeacher) {
//         return res.status(400).json({ message: 'No class teacher assigned to this class' });
//       }

//       exam.status = 'submittedToClassTeacher';
//       exam.submittedToClassTeacherAt = new Date();
//       await exam.save();

//       res.json({ message: 'Marks submitted to class teacher successfully', exam });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   reviewSubjectMarks: async (req, res) => {
//     try {
//       const { classId, examId } = req.params;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);
  
//       const classInfo = await Class.findOne({ _id: classId, school: schoolId });
//       if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
//         return res.status(403).json({ message: 'Not authorized as class teacher' });
//       }
  
//       const query = {
//         school: schoolId,
//         class: classId,
//         status: 'submittedToClassTeacher'
//       };
  
//       // If examId is provided, filter by _id instead of examDate
//       if (examId) {
//         query._id = examId;
//       }
  
//       const exams = await Exam.find(query)
//         .populate('subject', 'name')
//         .populate('results.student', 'name')
//         .lean();
  
//       res.json(exams);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },



//   submitResultsToAdmin: async (req, res) => {
//     try {
//       const { classId, examId } = req.params;
//       const teacherId = req.user._id;
//       const schoolId = req.school._id.toString();
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection); // Load Subject model explicitly
  
//       const classInfo = await Class.findOne({ _id: classId, school: schoolId });
//       if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
//         return res.status(403).json({ message: 'Not authorized as class teacher' });
//       }
  
//       // Modified query: Use _id instead of examDate when examId is provided
//       const query = {
//         school: schoolId,
//         class: classId,
//         status: 'submittedToClassTeacher'
//       };
  
//       // If examId is provided, filter by _id
//       if (examId) {
//         query._id = examId;
//       }
  
//       const exams = await Exam.find(query);
  
//       if (!exams.length) {
//         return res.status(404).json({ message: 'No submitted marks found for this class and exam' });
//       }
  
//       // Verify all subjects have submitted marks
//       const subjects = await Subject.find({ class: classId });
//       if (exams.length !== subjects.length) {
//         return res.status(400).json({ message: 'Not all subjects have submitted marks' });
//       }
  
//       const session = await connection.startSession();
//       session.startTransaction();
  
//       try {
//         for (const exam of exams) {
//           exam.status = 'submittedToAdmin';
//           exam.submittedToAdminAt = new Date();
//           await exam.save({ session });
//         }
  
//         await session.commitTransaction();
//         res.json({ message: 'Results submitted to admin successfully' });
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

// // Helper Functions
// const verifyTeacherClassAssignment = async (teacherId, classId, connection) => {
//   const User = require('../models/User')(connection);

//   // Get teacher details to check permissions
//   const teacher = await User.findById(teacherId);
//   if (!teacher) return false;

//   // Check if teacher is the class teacher (for attendance)
//   if (teacher.permissions.canTakeAttendance.some(id => id.toString() === classId)) {
//     return true;
//   }

//   // Check if teacher is assigned to teach any subject in this class
//   const hasSubjectPermission = teacher.permissions.canEnterMarks.some(entry =>
//     entry.class.toString() === classId
//   );

//   return hasSubjectPermission;
// };

// const verifyAllSubjectsSubmitted = async (examId, classId, connection) => {
//   const Subject = require('../models/Subject')(connection);
//   const SubjectMarks = require('../models/SubjectMarks')(connection);

//   const subjects = await Subject.find({ class: classId });
//   const submittedMarks = await SubjectMarks.find({
//     exam: examId,
//     class: classId,
//     status: 'submitted',
//   });

//   return subjects.length === submittedMarks.length;
// };

// const getCurrentAcademicYear = () => {
//   const now = new Date();
//   const year = now.getFullYear();
//   const month = now.getMonth();

//   // Assuming academic year starts in July
//   if (month < 6) { // Before July
//     return `${year - 1}-${year}`;
//   } else { // July onwards
//     return `${year}-${year + 1}`;
//   }
// };

// const isSameDay = (date1, date2) => {
//   const d1 = new Date(date1);
//   const d2 = new Date(date2);
//   return d1.getFullYear() === d2.getFullYear() &&
//          d1.getMonth() === d2.getMonth() &&
//          d1.getDate() === d2.getDate();
// };

// module.exports = teacherController;




const mongoose = require('mongoose');
const { uploadToS3 } = require('../config/s3Upload'); // Import S3 upload utility
const path = require('path');

const teacherController = {

  //new Controoler


  // enterSubjectProgress: async (req, res) => {
  //   try {
  //     const { classId, subjectId } = req.params;
  //     const { studentProgress } = req.body; // Array of { studentId, grade, feedback }
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const ProgressReport = require('../models/ProgressReport')(connection);
  //     const Subject = require('../models/Subject')(connection);
  //     const Class = require('../models/Class')(connection);

  //     // Verify teacher is assigned to the subject
  //     const subject = await Subject.findOne({
  //       _id: subjectId,
  //       school: schoolId,
  //       'teachers.teacher': teacherId,
  //     });
  //     if (!subject) {
  //       return res.status(403).json({ message: 'Not authorized to enter progress for this subject' });
  //     }

  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo) {
  //       return res.status(404).json({ message: 'Class not found' });
  //     }

  //     const academicYear = getCurrentAcademicYear();
  //     const progressReports = [];

  //     // Process each student's progress
  //     for (const progress of studentProgress) {
  //       const { studentId, grade, feedback } = progress;

  //       // Check if a progress report already exists for this student, subject, and academic year
  //       let progressReport = await ProgressReport.findOne({
  //         school: schoolId,
  //         class: classId,
  //         student: studentId,
  //         subject: subjectId,
  //         academicYear,
  //       });

  //       if (progressReport) {
  //         // Update existing progress report
  //         progressReport.grade = grade;
  //         progressReport.feedback = feedback;
  //         progressReport.enteredBy = teacherId;
  //         progressReport.updatedAt = new Date();
  //       } else {
  //         // Create a new progress report
  //         progressReport = new ProgressReport({
  //           school: schoolId,
  //           class: classId,
  //           student: studentId,
  //           subject: subjectId,
  //           grade,
  //           feedback,
  //           enteredBy: teacherId,
  //           academicYear,
  //           status: 'draft',
  //         });
  //       }

  //       await progressReport.save();
  //       progressReports.push(progressReport);
  //     }

  //     res.status(201).json({
  //       message: 'Progress reports saved successfully',
  //       progressReports,
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  enterSubjectProgress: async (req, res) => {
    try {
      const { classId, subjectId } = req.params;
      const { studentProgress } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const Subject = require('../models/Subject')(connection);
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
  
      const subject = await Subject.findOne({
        _id: subjectId,
        school: schoolId,
        'teachers.teacher': teacherId,
      });
      if (!subject) {
        return res.status(403).json({ message: 'Not authorized to enter progress for this subject' });
      }
  
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }
  
      const academicYear = getCurrentAcademicYear();
      const progressReports = [];
  
      for (const progress of studentProgress) {
        const { studentId, grade, feedback } = progress;
  
        // Validate student exists
        const student = await User.findById(studentId);
        if (!student) {
          console.log(`Student ${studentId} not found in User collection`);
          continue; // Skip invalid students or handle as needed
        }
  
        let progressReport = await ProgressReport.findOne({
          school: schoolId,
          class: classId,
          student: studentId,
          subject: subjectId,
          academicYear,
        });
  
        if (progressReport) {
          progressReport.grade = grade;
          progressReport.feedback = feedback;
          progressReport.enteredBy = teacherId;
          progressReport.updatedAt = new Date();
        } else {
          progressReport = new ProgressReport({
            school: schoolId,
            class: classId,
            student: studentId,
            subject: subjectId,
            grade,
            feedback,
            enteredBy: teacherId,
            academicYear,
            status: 'draft',
          });
        }
  
        await progressReport.save();
        progressReports.push(progressReport);
      }
  
      res.status(201).json({
        message: 'Progress reports saved successfully',
        progressReports,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Subject teacher submits progress to class teacher
  submitProgressToClassTeacher: async (req, res) => {
    try {
      const { classId, subjectId } = req.params; // No studentId needed
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const Subject = require('../models/Subject')(connection);
  
      // Verify that the teacher is assigned to the subject in this class
      const subject = await Subject.findOne({
        _id: subjectId,
        school: schoolId,
        class: classId,
        'teachers.teacher': teacherId,
      });
  
      if (!subject) {
        return res.status(403).json({
          message: 'You are not authorized to submit progress for this subject in this class',
        });
      }
  
      // Find all draft progress reports for this subject
      const academicYear = getCurrentAcademicYear();
      const progressReports = await ProgressReport.find({
        school: schoolId,
        class: classId,
        subject: subjectId,
        academicYear,
        enteredBy: teacherId,
        status: 'draft',
      });
  
      if (!progressReports.length) {
        return res.status(404).json({
          message: 'No draft progress reports found for this subject',
        });
      }
  
      // Update all draft progress reports to 'submittedToClassTeacher'
      const result = await ProgressReport.updateMany(
        {
          school: schoolId,
          class: classId,
          subject: subjectId,
          academicYear,
          enteredBy: teacherId,
          status: 'draft',
        },
        {
          $set: {
            status: 'submittedToClassTeacher',
            submittedToClassTeacherAt: new Date(),
          },
        }
      );
  
      res.json({
        message: 'Progress reports submitted to class teacher successfully',
        updatedCount: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Class teacher reviews progress reports for a student
  reviewStudentProgress: async (req, res) => {
    try {
      const { classId, subjectId } = req.params; // Changed from studentId to subjectId
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
  
      // Verify that the teacher is the class teacher
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });
  
      if (!classInfo) {
        return res.status(403).json({
          message: 'You are not the class teacher of this class',
        });
      }
  
      const academicYear = getCurrentAcademicYear();
      const progressReports = await ProgressReport.find({
        school: schoolId,
        class: classId,
        subject: subjectId, // Filter by subject instead of student
        academicYear,
        status: 'submittedToClassTeacher',
      })
        .populate('subject', 'name')
        .populate('student', 'name rollNumber') // Populate student details instead of enteredBy
        .populate('enteredBy', 'name')
        .lean();
  
      res.json(progressReports);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },



  compileAndSubmitProgressReports: async (req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require('../models/ProgressReport')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
      const User = require('../models/User')(connection);
  
      // Validate classId
      if (!classId || classId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(classId)) {
        return res.status(400).json({ message: 'Invalid classId format. Must be a 24-character hexadecimal string.' });
      }
  
      console.log('Received classId:', classId);
      console.log('classId length:', classId.length);
      console.log('teacherId:', teacherId);
      console.log('schoolId:', schoolId);
  
      // Verify that the teacher is the class teacher
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });
      console.log('Class found:', classInfo ? classInfo : 'Not found');
  
      if (!classInfo) {
        return res.status(403).json({
          message: 'You are not the class teacher of this class',
        });
      }
  
      const subjects = await Subject.find({ class: classId });
      if (!subjects.length) {
        return res.status(404).json({ message: 'No subjects found for this class' });
      }
  
      const students = await User.find({ _id: { $in: classInfo.students } })
        .select('name rollNumber')
        .lean();
  
      const academicYear = getCurrentAcademicYear();
      console.log('academicYear:', academicYear);
  
      const compiledReports = [];
      for (const student of students) {
        const progressReports = await ProgressReport.find({
          school: schoolId,
          class: classId,
          student: student._id,
          academicYear,
          status: 'submittedToClassTeacher',
        })
          .populate('subject', 'name')
          .populate('enteredBy', 'name')
          .lean();
  
        if (progressReports.length !== subjects.length) {
          return res.status(400).json({
            message: `Not all subjects have submitted progress reports for student ${student.name}. Expected: ${subjects.length}, Found: ${progressReports.length}`,
          });
        }
  
        const studentReport = {
          studentId: student._id,
          studentName: student.name,
          rollNumber: student.rollNumber,
          class: `${classInfo.name} ${classInfo.division}`,
          academicYear,
          subjects: progressReports.map((report) => ({
            subject: report.subject.name,
            grade: report.grade,
            feedback: report.feedback,
            teacher: report.enteredBy.name,
          })),
        };
        compiledReports.push(studentReport);
      }
  
      const session = await connection.startSession();
      session.startTransaction();
  
      try {
        await ProgressReport.updateMany(
          {
            school: schoolId,
            class: classId,
            academicYear,
            status: 'submittedToClassTeacher',
          },
          {
            $set: {
              status: 'submittedToAdmin',
              submittedToAdminAt: new Date(),
            },
          },
          { session }
        );
  
        await session.commitTransaction();
  
        res.json({
          message: 'Progress reports compiled and submitted to admin successfully',
          class: `${classInfo.name} ${classInfo.division}`,
          academicYear,
          reports: compiledReports,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error('Error in compileAndSubmitProgressReports:', error);
      res.status(500).json({ error: error.message });
    }
  },


  // Get classes where the teacher is assigned (class teacher or subject teacher)
  // getAssignedClasses: async (req, res) => {
  //   try {
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Class = require('../models/Class')(connection);
  //     const Subject = require('../models/Subject')(connection);

  //     // Find classes where the teacher is the class teacher
  //     const classTeacherClasses = await Class.find({
  //       school: schoolId,
  //       classTeacher: teacherId,
  //     }).select('name division _id');

  //     // Find classes where the teacher is a subject teacher
  //     const subjectClasses = await Subject.find({
  //       school: schoolId,
  //       'teachers.teacher': teacherId,
  //     })
  //       .populate('class', 'name division')
  //       .lean();

  //     const subjectTeacherClasses = subjectClasses.map((subject) => ({
  //       _id: subject.class._id,
  //       name: subject.class.name,
  //       division: subject.class.division,
  //       subject: subject.name,
  //     }));

  //     // Combine and deduplicate classes
  //     const allClasses = [
  //       ...classTeacherClasses.map((c) => ({
  //         _id: c._id,
  //         name: c.name,
  //         division: c.division,
  //         role: 'classTeacher',
  //       })),
  //       ...subjectTeacherClasses.map((c) => ({
  //         _id: c._id,
  //         name: c.name,
  //         division: c.division,
  //         role: 'subjectTeacher',
  //         subject: c.subject,
  //       })),
  //     ];

  //     const uniqueClasses = Array.from(
  //       new Map(allClasses.map((item) => [item._id.toString(), item])).values()
  //     );

  //     res.json(uniqueClasses);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // getAssignedClasses: async (req, res) => {
  //   try {
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Class = require('../models/Class')(connection);
  //     const Subject = require('../models/Subject')(connection);
  
  //     // Find classes where the teacher is the class teacher
  //     const classTeacherClasses = await Class.find({
  //       school: schoolId,
  //       classTeacher: teacherId,
  //     }).select('name division _id');
  
  //     // Find classes where the teacher is a subject teacher
  //     const subjectClasses = await Subject.find({
  //       school: schoolId,
  //       'teachers.teacher': teacherId,
  //     })
  //       .populate('class', 'name division')
  //       .lean();
  
  //     const subjectTeacherClasses = subjectClasses.map((subject) => ({
  //       _id: subject.class._id,
  //       name: subject.class.name,
  //       division: subject.class.division,
  //       subject: subject.name,
  //     }));
  
  //     // Create a map to combine roles
  //     const classMap = new Map();
  
  //     // Add class teacher roles
  //     classTeacherClasses.forEach((c) => {
  //       classMap.set(c._id.toString(), {
  //         _id: c._id,
  //         name: c.name,
  //         division: c.division,
  //         roles: ['classTeacher'],
  //       });
  //     });
  
  //     // Add subject teacher roles
  //     subjectTeacherClasses.forEach((c) => {
  //       const classIdStr = c._id.toString();
  //       if (classMap.has(classIdStr)) {
  //         // If class already exists (teacher is classTeacher), add subjectTeacher role
  //         const existing = classMap.get(classIdStr);
  //         existing.roles.push('subjectTeacher');
  //         existing.subjects = existing.subjects || [];
  //         existing.subjects.push(c.subject);
  //       } else {
  //         // New class, only subjectTeacher role
  //         classMap.set(classIdStr, {
  //           _id: c._id,
  //           name: c.name,
  //           division: c.division,
  //           roles: ['subjectTeacher'],
  //           subjects: [c.subject],
  //         });
  //       }
  //     });
  
  //     // Convert map to array
  //     const uniqueClasses = Array.from(classMap.values());
  
  //     res.json(uniqueClasses);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  getAssignedClasses: async (req, res) => {
    try {
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
  
      // Find classes where the teacher is the class teacher
      const classTeacherClasses = await Class.find({
        school: schoolId,
        classTeacher: teacherId,
      }).select('name division _id');
  
      // Find classes where the teacher is a subject teacher
      const subjectClasses = await Subject.find({
        school: schoolId,
        'teachers.teacher': teacherId,
      })
        .populate('class', 'name division')
        .lean();
  
      // Map subject teacher classes
      const subjectTeacherClasses = subjectClasses.map((subject) => ({
        _id: subject.class._id,
        name: subject.class.name,
        division: subject.class.division,
        subject: subject.name,
      }));
  
      // Identify the class where the teacher is the class teacher
      let classTeacherClass = null;
      if (classTeacherClasses.length > 0) {
        const c = classTeacherClasses[0]; // Assuming a teacher can be class teacher for only one class
        classTeacherClass = {
          _id: c._id,
          name: c.name,
          division: c.division,
          displayName: `${c.name}${c.division ? c.division : ''}`, // Format as "Class 1A"
        };
      }
  
      // Do NOT filter out the class teacher's class from subjectTeacherClasses
      const formattedSubjectTeacherClasses = subjectTeacherClasses
        .reduce((acc, curr) => {
          const existing = acc.find((item) => item._id.toString() === curr._id.toString());
          if (existing) {
            existing.subjects.push(curr.subject);
          } else {
            acc.push({
              _id: curr._id,
              name: curr.name,
              division: curr.division,
              displayName: `${curr.name}${curr.division ? curr.division : ''}`, // Format as "Class 1A"
              subjects: [curr.subject],
            });
          }
          return acc;
        }, []);
  
      // Format the response
      res.json({
        classTeacherClass: classTeacherClass
          ? { ...classTeacherClass }
          : null,
        subjectTeacherClasses: formattedSubjectTeacherClasses,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
 

  
 
  // View schedule
  getSchedule: async (req, res) => {
    try {
      const { teacherId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const TeacherSchedule = require('../models/TeacherSchedule')(connection);
      const Class = require('../models/Class')(connection);

      const currentDate = new Date();

      const schedule = await TeacherSchedule.findOne({
        teacher: teacherId,
        school: schoolId,
        academicYear: getCurrentAcademicYear(),
      })
        .populate('schedule.periods.class', 'name division', Class)
        .lean();

      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }

      const todaySubstitutions = schedule.substitutions.filter((sub) =>
        isSameDay(sub.date, currentDate)
      );

      res.json({ schedule, todaySubstitutions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get subjects taught by the teacher in a specific class
  getSubjectsForClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Subject = require('../models/Subject')(connection);

      const subjects = await Subject.find({
        school: schoolId,
        class: classId,
        'teachers.teacher': teacherId,
      }).select('name _id');

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // List students of a class (for class teachers only)
  getClassStudents: async (req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      }).populate('students', 'name studentDetails.grNumber');

      if (!classInfo) {
        return res.status(403).json({
          message: 'You are not the class teacher of this class',
        });
      }

      res.json(classInfo.students);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  markAttendance: async (req, res) => {
    try {
      const { classId } = req.params;
      const { date, month, year, attendanceData } = req.body; // [{ studentId, status }]
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Attendance = require('../models/Attendance')(connection);
  
      const teacher = await User.findById(teacherId);
      if (
        !teacher ||
        !teacher.permissions.canTakeAttendance.some((id) => id.toString() === classId)
      ) {
        return res.status(403).json({
          message:
            'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.',
        });
      }
  
      const attendanceDate = new Date(year, month - 1, date);
  
      // Prepare bulk write operations
      const bulkOps = attendanceData.map((student) => ({
        insertOne: {
          document: {
            school: schoolId,
            class: classId,
            user: student.studentId,
            date: attendanceDate,
            status: student.status,
            type: 'student',
            markedBy: teacherId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }));
  
      // Execute bulk write
      const result = await Attendance.bulkWrite(bulkOps, { ordered: false });
  
      res.json({
        message: 'Attendance marked successfully',
        insertedCount: result.insertedCount,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Mark teacher's own attendance
  markOwnAttendance: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { date, month, year, status, remarks } = req.body;
      const teacherId = req.user._id;
      const connection = req.connection;
      const Attendance = require('../models/Attendance')(connection);

      const attendanceDate = new Date(year, month - 1, date);

      const attendance = new Attendance({
        school: schoolId,
        user: teacherId,
        date: attendanceDate,
        status,
        remarks,
        type: 'teacher',
        markedBy: teacherId,
      });

      await attendance.save();
      res.status(201).json(attendance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAttendanceHistory: async (req, res) => {
    try {
      const { classId } = req.params;
      const { date, month, year } = req.query;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const Attendance = require('../models/Attendance')(connection);
      const User = require('../models/User')(connection);
  
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });
  
      if (!classInfo) {
        return res.status(403).json({
          message: 'You are not the class teacher of this class',
        });
      }
  
      // Construct the date range in UTC
      const attendanceDate = new Date(Date.UTC(year, month - 1, date));
      const startOfDay = new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, date, 23, 59, 59, 999));
  
      const attendanceRecords = await Attendance.find({
        school: schoolId,
        class: classId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        type: 'student',
      })
        .populate('user', 'name rollNumber')
        .lean();
  
      if (!attendanceRecords.length) {
        return res.status(404).json({
          message: 'No attendance records found for the specified date',
        });
      }
  
      const formattedAttendance = attendanceRecords.map((record) => ({
        studentId: record.user._id,
        name: record.user.name,
        rollNumber: record.user.rollNumber,
        status: record.status,
        date: record.date,
        markedBy: record.markedBy,
      }));
  
      res.json({
        classId,
        date: attendanceDate,
        attendance: formattedAttendance,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },


    requestLeave: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { reason, startDate, endDate, type } = req.body;
      const teacherId = req.user._id;
      const connection = req.connection;
      const Leave = require('../models/Leave')(connection);

      const leave = new Leave({
        school: schoolId,
        user: teacherId,
        reason,
        startDate,
        endDate,
        type,
        status: 'pending',
        appliedOn: new Date(),
      });

      await leave.save();
      res.status(201).json(leave);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getLeaveStatus: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const teacherId = req.user._id;
      const connection = req.connection;
      const Leave = require('../models/Leave')(connection);

      const leaves = await Leave.find({ school: schoolId, user: teacherId })
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: 'success',
        count: leaves.length,
        leaves: leaves.map(leave => ({
          id: leave._id,
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          status: leave.status,
          appliedOn: leave.appliedOn,
          reviewedBy: leave.reviewedBy,
          reviewedAt: leave.reviewedAt,
          comments: leave.comments,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  communicateWithParent: async (req, res) => {
    try {
      const { studentId } = req.params; // Removed schoolId from params
      const { subject, message, type } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const ParentCommunication = require('../models/ParentCommunication')(connection);

      // Get student's parent
      const student = await User.findOne({ _id: studentId, school: schoolId })
        .select('studentDetails.parentDetails');

      if (!student || !student.studentDetails.parentDetails) {
        return res.status(404).json({ message: 'Student or parent details not found' });
      }

      const communication = new ParentCommunication({
        school: schoolId,
        student: studentId,
        parent: null, // Assuming parent is a separate User; adjust if parentDetails contains a User ID
        teacher: req.user._id,
        subject,
        message,
        type,
      });

      await communication.save();

      // Notify parent (implement notifyParent if needed)
      // await notifyParent(communication);

      res.status(201).json(communication);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Assign homework with file upload
  assignHomework: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { classId } = req.params;
      const { title, description, dueDate, subject } = req.body;
      const files = req.files; // Expecting files from multer
      const connection = req.connection;
      const Homework = require('../models/Homework')(connection);

      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileKey = `homework/${schoolId}/${classId}/${Date.now()}_${file.originalname}`;
          await uploadToS3(file.buffer, fileKey);
          attachments.push({
            fileName: file.originalname,
            fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
            fileType: file.mimetype,
          });
        }
      }

      const homework = new Homework({
        school: schoolId,
        class: classId,
        subject,
        title,
        description,
        assignedBy: req.user._id,
        dueDate,
        attachments,
      });

      await homework.save();
      res.status(201).json(homework);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },



  uploadStudyMaterial: async (req, res) => {
    try {
      console.log('Request received at uploadStudyMaterial');
      console.log('req.file:', req.file);
      console.log('req.body:', req.body);
      console.log('req.params:', req.params);
      console.log('req.dbConnection type:', typeof req.dbConnection);
      console.log('req.dbConnection:', req.dbConnection.name);
      console.log('req.connection:', req.connection instanceof require('net').Socket ? 'Socket' : 'Unexpected');
  
      const { classId } = req.params;
      const { title, description, subject, type } = req.body;
      const file = req.file;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.dbConnection; // Use dbConnection for this route
      const StudyMaterial = require('../models/StudyMaterial')(connection);
      const { uploadToS3 } = require('../config/s3Upload');
  
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded.' });
      }
  
      const isAssigned = await verifyTeacherClassAssignment(teacherId, classId, connection);
      if (!isAssigned) {
        return res.status(403).json({
          message: 'You are not authorized to upload materials for this class',
        });
      }
  
      const fileExt = path.extname(file.originalname);
      const fileName = `file_${Date.now()}${fileExt}`;
      const fileKey = `study-materials/${schoolId}/${classId}/${fileName}`;
  
      await uploadToS3(file.buffer, fileKey, file.mimetype);
      const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`;
  
      const attachments = [{
        fileName: file.originalname,
        fileUrl: fileUrl,
        fileType: file.mimetype,
      }];
  
      const material = new StudyMaterial({
        school: schoolId,
        title,
        description,
        class: classId,
        subject,
        type,
        fileUrl: fileUrl,
        attachments,
        uploadedBy: teacherId,
        isActive: true,
      });
  
      await material.save();
      res.status(201).json(material);
    } catch (error) {
      console.error('Error in uploadStudyMaterial:', error.stack);
      res.status(500).json({ error: error.message });
    }
  },


  // Get students of a class for entering marks
  getClassStudentsForSubject: async (req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
      const Subject = require('../models/Subject')(connection);

      // Check if the teacher is a subject teacher for this class
      const isSubjectTeacher = await Subject.findOne({
        school: schoolId,
        class: classId,
        'teachers.teacher': teacherId,
      });

      // Check if the teacher is the class teacher
      const isClassTeacher = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });

      if (!isSubjectTeacher && !isClassTeacher) {
        return res.status(403).json({
          message: 'You are not authorized to view students of this class',
        });
      }

      const classInfo = await Class.findById(classId).populate('students', 'name rollNumber');

      if (!classInfo) {
        return res.status(404).json({ message: 'Class not found' });
      }

      res.json(classInfo.students);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },


  // Other existing methods remain unchanged for brevity
  // enterSubjectMarks: async (req, res) => {
  //   try {
  //     const { examId } = req.params;
  //     const { studentsMarks } = req.body;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.dbConnection;
  //     const Exam = require('../models/Exam')(connection);
  //     const Subject = require('../models/Subject')(connection);

  //     const exam = await Exam.findOne({ _id: examId, school: schoolId });
  //     if (!exam) return res.status(404).json({ message: 'Exam not found' });

  //     const subject = await Subject.findById(exam.subject);
  //     const isAuthorized = subject.teachers.some((t) =>
  //       t.teacher.toString() === teacherId.toString()
  //     );
  //     if (!isAuthorized)
  //       return res.status(403).json({ message: 'Not authorized to enter marks for this exam' });

  //     exam.results = studentsMarks.map((entry) => ({
  //       student: entry.studentId,
  //       marksObtained: entry.marks,
  //       remarks: entry.remarks || '',
  //     }));
  //     exam.marksEnteredBy = teacherId;
  //     exam.marksEnteredAt = new Date();
  //     exam.status = 'draft';

  //     await exam.save();
  //     res.json({ message: 'Marks entered successfully', exam });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // Enter marks for a subject (by subject teacher)
  enterSubjectMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { studentsMarks } = req.body; // [{ studentId, marks, remarks }]
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);

      const exam = await Exam.findOne({ _id: examId, school: schoolId });
      if (!exam) return res.status(404).json({ message: 'Exam not found' });

      const subject = await Subject.findById(exam.subject);
      const isAuthorized = subject.teachers.some((t) =>
        t.teacher.toString() === teacherId.toString()
      );
      if (!isAuthorized) {
        return res.status(403).json({ message: 'Not authorized to enter marks for this exam' });
      }

      // Validate marks
      for (const entry of studentsMarks) {
        if (entry.marks > exam.totalMarks || entry.marks < 0) {
          return res.status(400).json({
            message: `Marks for student ${entry.studentId} must be between 0 and ${exam.totalMarks}`,
          });
        }
      }

      exam.results = studentsMarks.map((entry) => ({
        student: entry.studentId,
        marksObtained: entry.marks,
        remarks: entry.remarks || '',
      }));
      exam.marksEnteredBy = teacherId;
      exam.marksEnteredAt = new Date();
      exam.status = 'draft';

      await exam.save();
      res.json({ message: 'Marks entered successfully', exam });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // submitMarksToClassTeacher: async (req, res) => {
  //   try {
  //     const { examId } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.dbConnection;
  //     const Exam = require('../models/Exam')(connection);
  //     const Class = require('../models/Class')(connection);

  //     const exam = await Exam.findOne({ _id: examId, school: schoolId });
  //     if (!exam) return res.status(404).json({ message: 'Exam not found' });
  //     if (exam.marksEnteredBy.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: 'Not authorized to submit these marks' });
  //     }
  //     if (exam.status !== 'draft') {
  //       return res.status(400).json({ message: 'Marks already submitted or in invalid state' });
  //     }

  //     const classInfo = await Class.findById(exam.class);
  //     if (!classInfo.classTeacher) {
  //       return res.status(400).json({ message: 'No class teacher assigned to this class' });
  //     }

  //     exam.status = 'submittedToClassTeacher';
  //     exam.submittedToClassTeacherAt = new Date();
  //     await exam.save();

  //     res.json({ message: 'Marks submitted to class teacher successfully', exam });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  submitMarksToClassTeacher: async (req, res) => {
    try {
      const { examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const Class = require('../models/Class')(connection);

      const exam = await Exam.findOne({ _id: examId, school: schoolId });
      if (!exam) return res.status(404).json({ message: 'Exam not found' });

      if (exam.marksEnteredBy.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: 'Not authorized to submit these marks' });
      }
      if (exam.status !== 'draft') {
        return res.status(400).json({ message: 'Marks already submitted or in invalid state' });
      }

      const classInfo = await Class.findById(exam.class);
      if (!classInfo.classTeacher) {
        return res.status(400).json({ message: 'No class teacher assigned to this class' });
      }

      exam.status = 'submittedToClassTeacher';
      exam.submittedToClassTeacherAt = new Date();
      await exam.save();

      res.json({ message: 'Marks submitted to class teacher successfully', exam });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  

  reviewSubjectMarks: async (req, res) => {
    try {
      const { classId, examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      
      // Explicitly register all models with the connection
      const Exam = require('../models/Exam')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection); // Add this line
  
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: 'Not authorized as class teacher' });
      }
  
      const query = {
        school: schoolId,
        class: classId,
        status: 'submittedToClassTeacher',
      };
      if (examId) query._id = examId;
  
      const exams = await Exam.find(query)
        .populate('subject', 'name')
        .populate('results.student', 'name')
        .lean();
  
      res.json(exams);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // submitResultsToAdmin: async (req, res) => {
  //   try {
  //     const { classId, examId } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.dbConnection;
  //     const Exam = require('../models/Exam')(connection);
  //     const Class = require('../models/Class')(connection);
  //     const Subject = require('../models/Subject')(connection);

  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: 'Not authorized as class teacher' });
  //     }

  //     const query = {
  //       school: schoolId,
  //       class: classId,
  //       status: 'submittedToClassTeacher',
  //     };
  //     if (examId) query._id = examId;

  //     const exams = await Exam.find(query);
  //     if (!exams.length) {
  //       return res.status(404).json({ message: 'No submitted marks found for this class and exam' });
  //     }

  //     const subjects = await Subject.find({ class: classId });
  //     if (exams.length !== subjects.length) {
  //       return res.status(400).json({ message: 'Not all subjects have submitted marks' });
  //     }

  //     const session = await connection.startSession();
  //     session.startTransaction();

  //     try {
  //       for (const exam of exams) {
  //         exam.status = 'submittedToAdmin';
  //         exam.submittedToAdminAt = new Date();
  //         await exam.save({ session });
  //       }

  //       await session.commitTransaction();
  //       res.json({ message: 'Results submitted to admin successfully' });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  // Compile marks for all subjects, calculate totals and percentages, and submit to admin (by class teacher)
  compileAndSubmitResults: async (req, res) => {
    try {
      const { classId, examType } = req.params; // examType to identify the exam (e.g., "Midterm")
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
      const User = require('../models/User')(connection);

      // Verify that the teacher is the class teacher
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: 'Not authorized as class teacher' });
      }

      // Get all subjects for the class
      const subjects = await Subject.find({ class: classId });
      if (!subjects.length) {
        return res.status(404).json({ message: 'No subjects found for this class' });
      }

      // Get all exams for the given examType and class
      const exams = await Exam.find({
        school: schoolId,
        class: classId,
        examType: examType,
        status: 'submittedToClassTeacher',
      }).populate('subject', 'name');

      // Check if all subjects have submitted marks
      if (exams.length !== subjects.length) {
        return res.status(400).json({
          message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${exams.length}`,
        });
      }

      // Get all students in the class
      const students = await User.find({ _id: { $in: classInfo.students } })
        .select('name rollNumber')
        .lean();

      // Compile marks for each student
      const compiledResults = students.map((student) => {
        const studentResult = {
          rollNumber: student.rollNumber,
          name: student.name,
          studentId: student._id,
          subjects: {},
          totalMarks: 0,
          percentage: 0,
        };

        // Initialize marks for each subject
        subjects.forEach((subject) => {
          studentResult.subjects[subject.name] = 0; // Default to 0
        });

        // Populate marks from each exam
        exams.forEach((exam) => {
          const result = exam.results.find(
            (r) => r.student.toString() === student._id.toString()
          );
          if (result) {
            studentResult.subjects[exam.subject.name] = result.marksObtained;
            studentResult.totalMarks += result.marksObtained;
          }
        });

        // Calculate percentage (total marks out of 500 for 5 subjects, each out of 100)
        const maxTotalMarks = subjects.length * 100; // e.g., 500 for 5 subjects
        studentResult.percentage = (studentResult.totalMarks / maxTotalMarks) * 100;

        return studentResult;
      });

      // Update exam statuses to 'submittedToAdmin'
      const session = await connection.startSession();
      session.startTransaction();

      try {
        for (const exam of exams) {
          exam.status = 'submittedToAdmin';
          exam.submittedToAdminAt = new Date();
          await exam.save({ session });
        }

        await session.commitTransaction();

        // Return the compiled results (similar to the marksheet)
        res.json({
          message: 'Results compiled and submitted to admin successfully',
          class: `${classInfo.name} ${classInfo.division}`,
          examType: examType,
          results: compiledResults,
        });
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
};

// Helper Functions


function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}


const verifyTeacherClassAssignment = async (teacherId, classId, connection) => {
  const User = require('../models/User')(connection);
  const teacher = await User.findById(teacherId);
  if (!teacher) return false;

  if (teacher.permissions.canTakeAttendance.some((id) => id.toString() === classId)) {
    return true;
  }

  const hasSubjectPermission = teacher.permissions.canEnterMarks.some(
    (entry) => entry.class.toString() === classId
  );
  return hasSubjectPermission;
};

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatClassName = (name) => {
  const match = name.match(/Class (\d+)/i);
  if (!match) return name;
  const number = parseInt(match[1], 10);
  let suffix = 'th';
  if (number === 1) suffix = 'st';
  else if (number === 2) suffix = 'nd';
  else if (number === 3) suffix = 'rd';
  return `Class ${number}${suffix}`;
};

module.exports = teacherController;