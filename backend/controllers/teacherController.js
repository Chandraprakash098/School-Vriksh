// const TeacherSchedule = require('../models/TeacherSchedule');
// const Homework = require('../models/Homework');
// const Attendance = require('../models/Attendance');
// const ParentCommunication = require('../models/ParentCommunication');

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
//       const { schoolId, classId } = req.params;
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

//   // Mark attendance
//   markAttendance: async (req, res) => {
//     try {
//       const { schoolId, classId } = req.params;
//       const { date, attendanceData } = req.body;

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
//             markedBy: req.user._id
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
//   }
// };

// module.exports = teacherController;



const TeacherSchedule = require('../models/TeacherSchedule');
const Homework = require('../models/Homework');
const Attendance = require('../models/Attendance');
const ParentCommunication = require('../models/ParentCommunication');
const StudyMaterial = require('../models/StudyMaterial');
const Exam = require('../models/Exam');
const Result = require('../models/Results');
const ProgressReport = require('../models/ProgressReport');
const Announcement = require('../models/Announcement');
const Leave = require('../models/Leave');
const User = require('../models/User');

const teacherController = {
  // View schedule
  getSchedule: async (req, res) => {
    try {
      const { teacherId } = req.params;
      const currentDate = new Date();
      
      const schedule = await TeacherSchedule.findOne({
        teacher: teacherId,
        academicYear: getCurrentAcademicYear()
      })
      .populate('schedule.periods.class', 'name division')
      .lean();

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
      const { schoolId, classId } = req.params;
      const homeworkData = req.body;

      const homework = new Homework({
        school: schoolId,
        class: classId,
        ...homeworkData,
        assignedBy: req.user._id
      });

      await homework.save();

      // Notify students and parents
      await notifyHomeworkAssigned(homework);

      res.status(201).json(homework);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Mark attendance for students (class teacher only)
  // markAttendance: async (req, res) => {
  //   try {
  //     const { schoolId, classId } = req.params;
  //     const { date, attendanceData } = req.body;
  //     const teacherId = req.user._id;

  //     // Verify if the teacher is the class teacher
  //     const classInfo = await Class.findById(classId);
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: 'Only class teachers can mark attendance for this class' });
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
  //           markedBy: teacherId
  //         });
  //         return attendance.save({ session });
  //       });

  //       const attendanceRecords = await Promise.all(attendancePromises);

  //       // Notify parents of absent students
  //       const absentStudents = attendanceRecords.filter(record => 
  //         record.status === 'absent'
  //       );
  //       await notifyAbsentStudents(absentStudents);

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
      const { schoolId, classId } = req.params;
      const { date, attendanceData } = req.body;
      const teacherId = req.user._id;
  
      // Verify if the teacher has permission to take attendance for this class
      const teacher = await User.findById(teacherId);
      if (!teacher || !teacher.permissions.canTakeAttendance.includes(classId)) {
        return res.status(403).json({ 
          message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.'
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
            markedBy: teacherId
          });
          return attendance.save({ session });
        });
  
        const attendanceRecords = await Promise.all(attendancePromises);
  
        // Notify parents of absent students
        const absentStudents = attendanceRecords.filter(record => 
          record.status === 'absent'
        );
        await notifyAbsentStudents(absentStudents);
  
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

  // Mark own attendance for teacher
  markOwnAttendance: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { date, status, remarks } = req.body;
      const teacherId = req.user._id;

      const attendance = new Attendance({
        school: schoolId,
        user: teacherId,
        date,
        status,
        remarks,
        type: 'teacher',
        markedBy: teacherId
      });

      await attendance.save();
      res.status(201).json(attendance);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Upload study materials
  uploadStudyMaterial: async (req, res) => {
    try {
      const { schoolId, classId } = req.params;
      const { title, description, subject, type, fileUrl } = req.body;
      const teacherId = req.user._id;

      // Verify if teacher teaches this class
      const isAssigned = await verifyTeacherClassAssignment(teacherId, classId);
      if (!isAssigned) {
        return res.status(403).json({ message: 'You are not authorized to upload materials for this class' });
      }

      const material = new StudyMaterial({
        title,
        description,
        class: classId,
        subject,
        type,
        fileUrl,
        uploadedBy: teacherId,
        isActive: true
      });

      await material.save();

      // Notify students about new material
      await notifyNewStudyMaterial(material);

      res.status(201).json(material);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Enter and verify student marks
  enterStudentMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { studentsMarks } = req.body;
      const teacherId = req.user._id;

      const exam = await Exam.findById(examId);
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
        remarks: entry.remarks || ''
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

  // Generate progress reports
  generateProgressReport: async (req, res) => {
    try {
      const { classId } = req.params;
      const { month, year, studentId } = req.body;
      const teacherId = req.user._id;

      // Verify if teacher is class teacher
      const classInfo = await Class.findById(classId);
      if (classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: 'Only class teachers can generate progress reports' });
      }

      // Get attendance for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      const attendance = await Attendance.find({
        class: classId,
        user: studentId,
        date: { $gte: startDate, $lte: endDate }
      });

      // Get exam results for the period
      const exams = await Exam.find({
        class: classId,
        date: { $gte: startDate, $lte: endDate }
      }).select('name subject results');

      // Get subjects for the class
      const subjects = await Subject.find({ class: classId })
        .populate('teachers.teacher', 'name');

      // Compile report
      const report = new ProgressReport({
        student: studentId,
        class: classId,
        month,
        year,
        academicYear: getCurrentAcademicYear(),
        attendanceSummary: {
          totalDays: attendance.length,
          present: attendance.filter(a => a.status === 'present').length,
          absent: attendance.filter(a => a.status === 'absent').length,
          late: attendance.filter(a => a.status === 'late').length
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
            comments: ''  // To be filled by teacher
          };
        }),
        generatedBy: teacherId
      });

      await report.save();

      // Notify student and parents
      await notifyProgressReport(report);

      res.status(201).json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Create announcement
  createAnnouncement: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { title, content, targetGroups, validFrom, validUntil, attachments } = req.body;
      const teacherId = req.user._id;

      const announcement = new Announcement({
        school: schoolId,
        title,
        content,
        targetGroups, // Array of target groups: ['students', 'parents']
        priority: 'normal',
        validFrom,
        validUntil,
        attachments,
        createdBy: teacherId
      });

      await announcement.save();

      // Notify target groups
      await notifyAnnouncementTargets(announcement);

      res.status(201).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Request leave
  requestLeave: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { reason, startDate, endDate, type } = req.body;
      const teacherId = req.user._id;

      const leave = new Leave({
        school: schoolId,
        user: teacherId,
        reason,
        startDate,
        endDate,
        type, // 'sick', 'casual', 'vacation'
        status: 'pending',
        appliedOn: new Date()
      });

      await leave.save();

      // Notify admin about leave request
      await notifyLeaveRequest(leave);

      res.status(201).json(leave);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Communicate with parents
  communicateWithParent: async (req, res) => {
    try {
      const { schoolId, studentId } = req.params;
      const { subject, message, type } = req.body;

      // Get student's parent
      const student = await User.findById(studentId)
        .select('profile.parentId');
      
      const communication = new ParentCommunication({
        school: schoolId,
        student: studentId,
        parent: student.profile.parentId,
        teacher: req.user._id,
        subject,
        message,
        type
      });

      await communication.save();

      // Notify parent
      await notifyParent(communication);

      res.status(201).json(communication);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

// Helper function to verify if teacher is assigned to a class
// const verifyTeacherClassAssignment = async (teacherId, classId) => {
//   // Check if teacher is class teacher
//   const classInfo = await Class.findById(classId);
//   if (classInfo.classTeacher.toString() === teacherId.toString()) {
//     return true;
//   }

//   // Check if teacher teaches any subject in this class
//   const subjects = await Subject.find({ class: classId });
//   for (const subject of subjects) {
//     if (subject.teachers.some(t => t.teacher.toString() === teacherId.toString())) {
//       return true;
//     }
//   }

//   return false;
// };

const verifyTeacherClassAssignment = async (teacherId, classId) => {
  // Get teacher details to check permissions
  const teacher = await User.findById(teacherId);
  if (!teacher) return false;

  // Check if teacher is the class teacher (for attendance)
  if (teacher.permissions.canTakeAttendance.includes(classId)) {
    return true;
  }

  // Check if teacher is assigned to teach any subject in this class
  const hasSubjectPermission = teacher.permissions.canEnterMarks.some(entry => 
    entry.class.toString() === classId.toString()
  );

  return hasSubjectPermission;
};

// Helper to get current academic year
const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Assuming academic year starts in July
  if (month < 6) { // Before July
    return `${year-1}-${year}`;
  } else { // July onwards
    return `${year}-${year+1}`;
  }
};

// Helper to check if two dates are the same day
const isSameDay = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

module.exports = teacherController;