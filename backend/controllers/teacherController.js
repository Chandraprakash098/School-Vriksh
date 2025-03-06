
// const TeacherSchedule = require('../models/TeacherSchedule');
// const Homework = require('../models/Homework');
// const Attendance = require('../models/Attendance');
// const ParentCommunication = require('../models/ParentCommunication');
// const StudyMaterial = require('../models/StudyMaterial');
// const Exam = require('../models/Exam');
// const Result = require('../models/Results');
// const ProgressReport = require('../models/ProgressReport');
// const Announcement = require('../models/Announcement');
// const Leave = require('../models/Leave');
// const User = require('../models/User');

// const teacherController = {
//   // View schedule
//   getSchedule: async (req, res) => {
//     try {
//       const { teacherId } = req.params;
//       const currentDate = new Date();
      
//       const schedule = await TeacherSchedule.findOne({
//         teacher: teacherId,
//         academicYear: getCurrentAcademicYear()
//       })
//       .populate('schedule.periods.class', 'name division')
//       .lean();

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
//       const { schoolId, classId } = req.school;
//       const homeworkData = req.body;

//       const homework = new Homework({
//         school: schoolId,
//         class: classId,
//         ...homeworkData,
//         assignedBy: req.user._id
//       });

//       await homework.save();

//       // Notify students and parents
//       await notifyHomeworkAssigned(homework);

//       res.status(201).json(homework);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

 

//   markAttendance: async (req, res) => {
//     try {
//       const { schoolId, classId } = req.params;
//       const { date, attendanceData } = req.body;
//       const teacherId = req.user._id;
  
//       // Verify if the teacher has permission to take attendance for this class
//       const teacher = await User.findById(teacherId);
//       if (!teacher || !teacher.permissions.canTakeAttendance.includes(classId)) {
//         return res.status(403).json({ 
//           message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.'
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
//             markedBy: teacherId
//           });
//           return attendance.save({ session });
//         });
  
//         const attendanceRecords = await Promise.all(attendancePromises);
  
//         // Notify parents of absent students
//         const absentStudents = attendanceRecords.filter(record => 
//           record.status === 'absent'
//         );
//         await notifyAbsentStudents(absentStudents);
  
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

//   // Mark own attendance for teacher
//   markOwnAttendance: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { date, status, remarks } = req.body;
//       const teacherId = req.user._id;

//       const attendance = new Attendance({
//         school: schoolId,
//         user: teacherId,
//         date,
//         status,
//         remarks,
//         type: 'teacher',
//         markedBy: teacherId
//       });

//       await attendance.save();
//       res.status(201).json(attendance);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Upload study materials
//   uploadStudyMaterial: async (req, res) => {
//     try {
//       const { schoolId, classId } = req.params;
//       const { title, description, subject, type, fileUrl } = req.body;
//       const teacherId = req.user._id;

//       // Verify if teacher teaches this class
//       const isAssigned = await verifyTeacherClassAssignment(teacherId, classId);
//       if (!isAssigned) {
//         return res.status(403).json({ message: 'You are not authorized to upload materials for this class' });
//       }

//       const material = new StudyMaterial({
//         title,
//         description,
//         class: classId,
//         subject,
//         type,
//         fileUrl,
//         uploadedBy: teacherId,
//         isActive: true
//       });

//       await material.save();

//       // Notify students about new material
//       await notifyNewStudyMaterial(material);

//       res.status(201).json(material);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Enter and verify student marks
//   enterStudentMarks: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const { studentsMarks } = req.body;
//       const teacherId = req.user._id;

//       const exam = await Exam.findById(examId);
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
//         remarks: entry.remarks || ''
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

//   // Generate progress reports
//   generateProgressReport: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const { month, year, studentId } = req.body;
//       const teacherId = req.user._id;

//       // Verify if teacher is class teacher
//       const classInfo = await Class.findById(classId);
//       if (classInfo.classTeacher.toString() !== teacherId.toString()) {
//         return res.status(403).json({ message: 'Only class teachers can generate progress reports' });
//       }

//       // Get attendance for the month
//       const startDate = new Date(year, month - 1, 1);
//       const endDate = new Date(year, month, 0);
      
//       const attendance = await Attendance.find({
//         class: classId,
//         user: studentId,
//         date: { $gte: startDate, $lte: endDate }
//       });

//       // Get exam results for the period
//       const exams = await Exam.find({
//         class: classId,
//         date: { $gte: startDate, $lte: endDate }
//       }).select('name subject results');

//       // Get subjects for the class
//       const subjects = await Subject.find({ class: classId })
//         .populate('teachers.teacher', 'name');

//       // Compile report
//       const report = new ProgressReport({
//         student: studentId,
//         class: classId,
//         month,
//         year,
//         academicYear: getCurrentAcademicYear(),
//         attendanceSummary: {
//           totalDays: attendance.length,
//           present: attendance.filter(a => a.status === 'present').length,
//           absent: attendance.filter(a => a.status === 'absent').length,
//           late: attendance.filter(a => a.status === 'late').length
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
//             comments: ''  // To be filled by teacher
//           };
//         }),
//         generatedBy: teacherId
//       });

//       await report.save();

//       // Notify student and parents
//       await notifyProgressReport(report);

//       res.status(201).json(report);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Create announcement
//   createAnnouncement: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { title, content, targetGroups, validFrom, validUntil, attachments } = req.body;
//       const teacherId = req.user._id;

//       const announcement = new Announcement({
//         school: schoolId,
//         title,
//         content,
//         targetGroups, // Array of target groups: ['students', 'parents']
//         priority: 'normal',
//         validFrom,
//         validUntil,
//         attachments,
//         createdBy: teacherId
//       });

//       await announcement.save();

//       // Notify target groups
//       await notifyAnnouncementTargets(announcement);

//       res.status(201).json(announcement);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Request leave
//   requestLeave: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { reason, startDate, endDate, type } = req.body;
//       const teacherId = req.user._id;

//       const leave = new Leave({
//         school: schoolId,
//         user: teacherId,
//         reason,
//         startDate,
//         endDate,
//         type, // 'sick', 'casual', 'vacation'
//         status: 'pending',
//         appliedOn: new Date()
//       });

//       await leave.save();

//       // Notify admin about leave request
//       await notifyLeaveRequest(leave);

//       res.status(201).json(leave);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Communicate with parents
//   communicateWithParent: async (req, res) => {
//     try {
//       const { schoolId, studentId } = req.params;
//       const { subject, message, type } = req.body;

//       // Get student's parent
//       const student = await User.findById(studentId)
//         .select('profile.parentId');
      
//       const communication = new ParentCommunication({
//         school: schoolId,
//         student: studentId,
//         parent: student.profile.parentId,
//         teacher: req.user._id,
//         subject,
//         message,
//         type
//       });

//       await communication.save();

//       // Notify parent
//       await notifyParent(communication);

//       res.status(201).json(communication);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   enterSubjectMarks: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const { studentsMarks } = req.body;
//       const teacherId = req.user._id;

//       // Verify exam exists
//       const exam = await Exam.findById(examId);
//       if (!exam) {
//         return res.status(404).json({ message: 'Exam not found' });
//       }

//       // Verify teacher permission for this subject/class
//       const teacher = await User.findById(teacherId);
//       const hasPermission = teacher.permissions.canEnterMarks.some(
//         p => p.class.toString() === exam.class.toString()
//       );

//       if (!hasPermission) {
//         return res.status(403).json({ message: 'Not authorized to enter marks for this class' });
//       }

//       // Create or update subject marks
//       let subjectMarks = await SubjectMarks.findOne({
//         exam: examId,
//         teacher: teacherId,
//         class: exam.class
//       });

//       if (!subjectMarks) {
//         subjectMarks = new SubjectMarks({
//           exam: examId,
//           subject: teacher.permissions.canEnterMarks.find(
//             p => p.class.toString() === exam.class.toString()
//           ).subject,
//           class: exam.class,
//           teacher: teacherId,
//           students: studentsMarks
//         });
//       } else {
//         subjectMarks.students = studentsMarks;
//         subjectMarks.status = 'draft';
//       }

//       await subjectMarks.save();

//       res.json(subjectMarks);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // For subject teachers to submit marks to class teacher
//   submitMarksToClassTeacher: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const teacherId = req.user._id;

//       const subjectMarks = await SubjectMarks.findOne({
//         exam: examId,
//         teacher: teacherId
//       });

//       if (!subjectMarks) {
//         return res.status(404).json({ message: 'Marks not found' });
//       }

//       subjectMarks.status = 'submitted';
//       subjectMarks.submittedAt = new Date();
//       await subjectMarks.save();

//       // Update class result status
//       await ClassResult.findOneAndUpdate(
//         { exam: examId, class: subjectMarks.class },
//         { 
//           $addToSet: { subjectMarks: subjectMarks._id },
//           $setOnInsert: { 
//             classTeacher: (await Class.findById(subjectMarks.class)).classTeacher 
//           }
//         },
//         { upsert: true }
//       );

//       res.json({ message: 'Marks submitted to class teacher successfully' });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // For class teachers to review subject marks
//   reviewSubjectMarks: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const teacherId = req.user._id;

//       // Get class result and verify class teacher
//       const classResult = await ClassResult.findOne({ exam: examId })
//         .populate('subjectMarks')
//         .populate('class');

//       if (!classResult || classResult.class.classTeacher.toString() !== teacherId) {
//         return res.status(403).json({ message: 'Not authorized as class teacher' });
//       }

//       // Get all submitted subject marks
//       const subjectMarks = await SubjectMarks.find({
//         _id: { $in: classResult.subjectMarks },
//         status: 'submitted'
//       }).populate('subject').populate('students.student');

//       res.json(subjectMarks);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // For class teachers to submit compiled results to admin
//   submitResultsToAdmin: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const teacherId = req.user._id;

//       const classResult = await ClassResult.findOne({ 
//         exam: examId,
//         classTeacher: teacherId
//       });

//       if (!classResult) {
//         return res.status(404).json({ message: 'Class result not found' });
//       }

//       // Verify all subjects have submitted marks
//       const allSubjectsSubmitted = await verifyAllSubjectsSubmitted(examId, classResult.class);
//       if (!allSubjectsSubmitted) {
//         return res.status(400).json({ message: 'All subject marks not yet submitted' });
//       }

//       classResult.status = 'submitted';
//       classResult.submittedAt = new Date();
//       await classResult.save();

//       res.json({ message: 'Results submitted to admin successfully' });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };


// const verifyTeacherClassAssignment = async (teacherId, classId) => {
//   // Get teacher details to check permissions
//   const teacher = await User.findById(teacherId);
//   if (!teacher) return false;

//   // Check if teacher is the class teacher (for attendance)
//   if (teacher.permissions.canTakeAttendance.includes(classId)) {
//     return true;
//   }

//   // Check if teacher is assigned to teach any subject in this class
//   const hasSubjectPermission = teacher.permissions.canEnterMarks.some(entry => 
//     entry.class.toString() === classId.toString()
//   );

//   return hasSubjectPermission;
// };

// // Helper to get current academic year
// const getCurrentAcademicYear = () => {
//   const now = new Date();
//   const year = now.getFullYear();
//   const month = now.getMonth();

//   // Assuming academic year starts in July
//   if (month < 6) { // Before July
//     return `${year-1}-${year}`;
//   } else { // July onwards
//     return `${year}-${year+1}`;
//   }
// };

// // Helper to check if two dates are the same day
// const isSameDay = (date1, date2) => {
//   const d1 = new Date(date1);
//   const d2 = new Date(date2);
//   return d1.getFullYear() === d2.getFullYear() &&
//          d1.getMonth() === d2.getMonth() &&
//          d1.getDate() === d2.getDate();
// };

// module.exports = teacherController;


const mongoose = require('mongoose');

const teacherController = {
  // View schedule
  getSchedule: async (req, res) => {
    try {
      const { teacherId } = req.params;
      const schoolId = req.school._id.toString(); // Use req.school from auth middleware
      const connection = req.connection;
      const TeacherSchedule = require('../models/TeacherSchedule')(connection);
      const Class = require('../models/Class')(connection);

      const currentDate = new Date();

      const schedule = await TeacherSchedule.findOne({
        teacher: teacherId,
        school: schoolId, // Add school filter
        academicYear: getCurrentAcademicYear(),
      })
        .populate('schedule.periods.class', 'name division', Class)
        .lean();

      if (!schedule) {
        return res.status(404).json({ message: 'Schedule not found' });
      }

      // Get any substitutions for today
      const todaySubstitutions = schedule.substitutions.filter(sub =>
        isSameDay(sub.date, currentDate)
      );

      res.json({ schedule, todaySubstitutions });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Assign homework
  assignHomework: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { classId } = req.params; // Use classId from params
      const homeworkData = req.body;
      const connection = req.connection;
      const Homework = require('../models/Homework')(connection);

      const homework = new Homework({
        school: schoolId,
        class: classId, // Use classId instead of homeworkData.classId
        ...homeworkData,
        assignedBy: req.user._id,
      });

      await homework.save();
      res.status(201).json(homework);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // markAttendance: async (req, res) => {
  //   try {
  //     const { classId } = req.params; // Removed schoolId from params, use req.school
  //     const { date, attendanceData } = req.body;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const User = require('../models/User')(connection);
  //     const Attendance = require('../models/Attendance')(connection);

  //     // Verify if the teacher has permission to take attendance for this class
  //     const teacher = await User.findById(teacherId);
  //     if (!teacher || !teacher.permissions.canTakeAttendance.some(id => id.toString() === classId)) {
  //       return res.status(403).json({
  //         message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.',
  //       });
  //     }

  //     const session = await mongoose.startSession();
  //     session.startTransaction();

  //     try {
  //       const attendancePromises = attendanceData.map(async (student) => {
  //         const attendance = new Attendance({
  //           school: schoolId,
  //           class: classId,
  //           user: student.userId,
  //           date,
  //           status: student.status,
  //           type: 'student',
  //           markedBy: teacherId,
  //         });
  //         return attendance.save({ session });
  //       });

  //       const attendanceRecords = await Promise.all(attendancePromises);

  //       // Notify parents of absent students (implement notifyAbsentStudents if needed)
  //       const absentStudents = attendanceRecords.filter(record => record.status === 'absent');
  //       // await notifyAbsentStudents(absentStudents);

  //       await session.commitTransaction();
  //       res.json(attendanceRecords);
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

  markAttendance: async (req, res) => {
    try {
      const { classId } = req.params; // Removed schoolId from params
      const { date, attendanceData } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString(); // Use req.school
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Attendance = require('../models/Attendance')(connection);

      const teacher = await User.findById(teacherId);
      if (!teacher || !teacher.permissions.canTakeAttendance.some(id => id.toString() === classId)) {
        return res.status(403).json({
          message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.',
        });
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const attendancePromises = attendanceData.map(async (student) => {
          const attendance = new Attendance({
            school: schoolId,
            class: classId,
            user: student.userId,
            date,
            status: student.status,
            type: 'student',
            markedBy: teacherId,
          });
          return attendance.save({ session });
        });

        const attendanceRecords = await Promise.all(attendancePromises);

        await session.commitTransaction();
        res.json(attendanceRecords);
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

  markOwnAttendance: async (req, res) => {
    try {
      const schoolId = req.school._id.toString(); // Use req.school instead of req.params
      const { date, status, remarks } = req.body;
      const teacherId = req.user._id;
      const connection = req.connection;
      const Attendance = require('../models/Attendance')(connection);

      const attendance = new Attendance({
        school: schoolId,
        user: teacherId,
        date,
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

  uploadStudyMaterial: async (req, res) => {
    try {
      const { classId } = req.params; // Removed schoolId from params
      const { title, description, subject, type, fileUrl } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const StudyMaterial = require('../models/StudyMaterial')(connection);

      // Verify if teacher teaches this class (updated to use dynamic User model)
      const isAssigned = await verifyTeacherClassAssignment(teacherId, classId, connection);
      if (!isAssigned) {
        return res.status(403).json({ message: 'You are not authorized to upload materials for this class' });
      }

      const material = new StudyMaterial({
        school: schoolId, // Add school field
        title,
        description,
        class: classId,
        subject,
        type,
        fileUrl,
        uploadedBy: teacherId,
        isActive: true,
      });

      await material.save();

      // Notify students about new material (implement notifyNewStudyMaterial if needed)
      // await notifyNewStudyMaterial(material);

      res.status(201).json(material);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  enterStudentMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { studentsMarks } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);

      const exam = await Exam.findOne({ _id: examId, school: schoolId });
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Verify teacher permission for this subject/class
      const subjectInfo = await Subject.findById(exam.subject);
      const isAuthorized = subjectInfo.teachers.some(t =>
        t.teacher.toString() === teacherId.toString()
      );

      if (!isAuthorized) {
        return res.status(403).json({ message: 'Unauthorized to enter marks for this exam' });
      }

      // Update student marks
      const results = studentsMarks.map(entry => ({
        student: entry.studentId,
        marks: entry.marks,
        remarks: entry.remarks || '',
      }));

      exam.results = results;
      exam.marksEnteredBy = teacherId;
      exam.marksEnteredAt = new Date();

      await exam.save();
      res.json(exam);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  generateProgressReport: async (req, res) => {
    try {
      const { classId } = req.params;
      const { month, year, studentId } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const Attendance = require('../models/Attendance')(connection);
      const Exam = require('../models/Exam')(connection);
      const Subject = require('../models/Subject')(connection);
      const ProgressReport = require('../models/ProgressReport')(connection);

      // Verify if teacher is class teacher
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: 'Only class teachers can generate progress reports' });
      }

      // Get attendance for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const attendance = await Attendance.find({
        school: schoolId,
        class: classId,
        user: studentId,
        date: { $gte: startDate, $lte: endDate },
      });

      // Get exam results for the period
      const exams = await Exam.find({
        school: schoolId,
        class: classId,
        date: { $gte: startDate, $lte: endDate },
      }).select('name subject results');

      // Get subjects for the class
      const subjects = await Subject.find({ school: schoolId, class: classId })
        .populate('teachers.teacher', 'name');

      // Compile report
      const report = new ProgressReport({
        school: schoolId, // Add school field
        student: studentId,
        class: classId,
        month,
        year,
        academicYear: getCurrentAcademicYear(),
        attendanceSummary: {
          totalDays: attendance.length,
          present: attendance.filter(a => a.status === 'present').length,
          absent: attendance.filter(a => a.status === 'absent').length,
          late: attendance.filter(a => a.status === 'late').length,
        },
        subjects: subjects.map(subject => {
          const subjectExams = exams.filter(e => e.subject.toString() === subject._id.toString());
          const studentResults = subjectExams.map(exam => {
            const result = exam.results.find(r => r.student.toString() === studentId);
            return result ? { exam: exam.name, marks: result.marks } : null;
          }).filter(Boolean);

          return {
            name: subject.name,
            teacher: subject.teachers[0]?.teacher,
            performance: studentResults,
            comments: '', // To be filled by teacher
          };
        }),
        generatedBy: teacherId,
      });

      await report.save();

      // Notify student and parents (implement notifyProgressReport if needed)
      // await notifyProgressReport(report);

      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createAnnouncement: async (req, res) => {
    try {
      const schoolId = req.school._id.toString(); // Use req.school instead of req.params
      const { title, content, targetGroups, validFrom, validUntil, attachments } = req.body;
      const teacherId = req.user._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);

      const announcement = new Announcement({
        school: schoolId,
        title,
        content,
        targetGroups, // Array of target groups: ['students', 'parents']
        priority: 'normal',
        validFrom,
        validUntil,
        attachments,
        createdBy: teacherId,
      });

      await announcement.save();

      // Notify target groups (implement notifyAnnouncementTargets if needed)
      // await notifyAnnouncementTargets(announcement);

      res.status(201).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // requestLeave: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString(); // Use req.school instead of req.params
  //     const { reason, startDate, endDate, type } = req.body;
  //     const teacherId = req.user._id;
  //     const connection = req.connection;
  //     const Leave = require('../models/Leave')(connection);

  //     const leave = new Leave({
  //       school: schoolId,
  //       user: teacherId,
  //       reason,
  //       startDate,
  //       endDate,
  //       type, // 'sick', 'casual', 'vacation'
  //       status: 'pending',
  //       appliedOn: new Date(),
  //     });

  //     await leave.save();

  //     // Notify admin about leave request (implement notifyLeaveRequest if needed)
  //     // await notifyLeaveRequest(leave);

  //     res.status(201).json(leave);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

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

  enterSubjectMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { studentsMarks } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);
      const User = require('../models/User')(connection);

      // Verify exam exists
      const exam = await Exam.findOne({ _id: examId, school: schoolId });
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }

      // Verify teacher permission for this subject/class
      const teacher = await User.findById(teacherId);
      const hasPermission = teacher.permissions.canEnterMarks.some(
        p => p.class.toString() === exam.class.toString()
      );

      if (!hasPermission) {
        return res.status(403).json({ message: 'Not authorized to enter marks for this class' });
      }

      // Create or update subject marks
      let subjectMarks = await SubjectMarks.findOne({
        exam: examId,
        teacher: teacherId,
        class: exam.class,
        school: schoolId, // Add school filter
      });

      if (!subjectMarks) {
        subjectMarks = new SubjectMarks({
          school: schoolId,
          exam: examId,
          subject: teacher.permissions.canEnterMarks.find(
            p => p.class.toString() === exam.class.toString()
          ).subject,
          class: exam.class,
          teacher: teacherId,
          students: studentsMarks,
        });
      } else {
        subjectMarks.students = studentsMarks;
        subjectMarks.status = 'draft';
      }

      await subjectMarks.save();

      res.json(subjectMarks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  submitMarksToClassTeacher: async (req, res) => {
    try {
      const { examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const SubjectMarks = require('../models/SubjectMarks')(connection);
      const ClassResult = require('../models/ClassResult')(connection);
      const Class = require('../models/Class')(connection);

      const subjectMarks = await SubjectMarks.findOne({
        exam: examId,
        teacher: teacherId,
        school: schoolId,
      });

      if (!subjectMarks) {
        return res.status(404).json({ message: 'Marks not found' });
      }

      subjectMarks.status = 'submitted';
      subjectMarks.submittedAt = new Date();
      await subjectMarks.save();

      // Update class result status
      await ClassResult.findOneAndUpdate(
        { exam: examId, class: subjectMarks.class, school: schoolId },
        {
          $addToSet: { subjectMarks: subjectMarks._id },
          $setOnInsert: {
            classTeacher: (await Class.findById(subjectMarks.class)).classTeacher,
          },
        },
        { upsert: true }
      );

      res.json({ message: 'Marks submitted to class teacher successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  reviewSubjectMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ClassResult = require('../models/ClassResult')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);
      const Subject = require('../models/Subject')(connection);
      const User = require('../models/User')(connection);

      // Get class result and verify class teacher
      const classResult = await ClassResult.findOne({ exam: examId, school: schoolId })
        .populate('subjectMarks', '', SubjectMarks)
        .populate('class', '', require('../models/Class')(connection));

      if (!classResult || classResult.class.classTeacher.toString() !== teacherId) {
        return res.status(403).json({ message: 'Not authorized as class teacher' });
      }

      // Get all submitted subject marks
      const subjectMarks = await SubjectMarks.find({
        _id: { $in: classResult.subjectMarks },
        status: 'submitted',
        school: schoolId,
      })
        .populate('subject', '', Subject)
        .populate('students.student', '', User);

      res.json(subjectMarks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  submitResultsToAdmin: async (req, res) => {
    try {
      const { examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ClassResult = require('../models/ClassResult')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);

      const classResult = await ClassResult.findOne({
        exam: examId,
        classTeacher: teacherId,
        school: schoolId,
      });

      if (!classResult) {
        return res.status(404).json({ message: 'Class result not found' });
      }

      // Verify all subjects have submitted marks
      const allSubjectsSubmitted = await verifyAllSubjectsSubmitted(examId, classResult.class, connection);
      if (!allSubjectsSubmitted) {
        return res.status(400).json({ message: 'All subject marks not yet submitted' });
      }

      classResult.status = 'submitted';
      classResult.submittedAt = new Date();
      await classResult.save();

      res.json({ message: 'Results submitted to admin successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

// Helper Functions
const verifyTeacherClassAssignment = async (teacherId, classId, connection) => {
  const User = require('../models/User')(connection);

  // Get teacher details to check permissions
  const teacher = await User.findById(teacherId);
  if (!teacher) return false;

  // Check if teacher is the class teacher (for attendance)
  if (teacher.permissions.canTakeAttendance.some(id => id.toString() === classId)) {
    return true;
  }

  // Check if teacher is assigned to teach any subject in this class
  const hasSubjectPermission = teacher.permissions.canEnterMarks.some(entry =>
    entry.class.toString() === classId
  );

  return hasSubjectPermission;
};

const verifyAllSubjectsSubmitted = async (examId, classId, connection) => {
  const Subject = require('../models/Subject')(connection);
  const SubjectMarks = require('../models/SubjectMarks')(connection);

  const subjects = await Subject.find({ class: classId });
  const submittedMarks = await SubjectMarks.find({
    exam: examId,
    class: classId,
    status: 'submitted',
  });

  return subjects.length === submittedMarks.length;
};

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Assuming academic year starts in July
  if (month < 6) { // Before July
    return `${year - 1}-${year}`;
  } else { // July onwards
    return `${year}-${year + 1}`;
  }
};

const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

module.exports = teacherController;