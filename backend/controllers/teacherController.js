const mongoose = require("mongoose");
const { uploadToS3 } = require("../config/s3Upload");
const path = require("path");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { uploadStudyMaterial, uploadSyllabus,getPublicFileUrl } = require("../config/s3Upload");
const logger = require("../utils/logger");

const teacherController = {

  submitDailyWork: async (req, res) => {
    try {
      const { date, description } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const DailyWork = require("../models/DailyWork")(connection);

      // Validate input
      if (!date || !description) {
        return res.status(400).json({ message: "Date and description are required" });
      }

      const workDate = new Date(date);
      if (isNaN(workDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // Check if work already submitted for this date
      const existingWork = await DailyWork.findOne({
        school: schoolId,
        teacher: teacherId,
        date: {
          $gte: new Date(workDate.setHours(0, 0, 0, 0)),
          $lte: new Date(workDate.setHours(23, 59, 59, 999)),
        },
      });

      if (existingWork) {
        return res.status(400).json({ message: "Daily work already submitted for this date" });
      }

      // Create new daily work entry
      const dailyWork = new DailyWork({
        school: schoolId,
        teacher: teacherId,
        date: workDate,
        description,
        status: "pending",
      });

      await dailyWork.save();

      res.status(201).json({
        message: "Daily work submitted successfully",
        dailyWork,
      });
    } catch (error) {
      console.error("Error in submitDailyWork:", error);
      res.status(500).json({ error: error.message });
    }
  },

  
  enterSubjectProgress: async (req, res) => {
    try {
      const { classId, subjectId } = req.params;
      const { studentProgress } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const ProgressReport = require("../models/ProgressReport")(connection);
      const Subject = require("../models/Subject")(connection);
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      const subject = await Subject.findOne({
        _id: subjectId,
        school: schoolId,
        "teachers.teacher": teacherId,
      });
      if (!subject) {
        return res.status(403).json({
          message: "Not authorized to enter progress for this subject",
        });
      }

      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
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
            status: "draft",
          });
        }

        await progressReport.save();
        progressReports.push(progressReport);
      }

      res.status(201).json({
        message: "Progress reports saved successfully",
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
      const ProgressReport = require("../models/ProgressReport")(connection);
      const Subject = require("../models/Subject")(connection);

      // Verify that the teacher is assigned to the subject in this class
      const subject = await Subject.findOne({
        _id: subjectId,
        school: schoolId,
        class: classId,
        "teachers.teacher": teacherId,
      });

      if (!subject) {
        return res.status(403).json({
          message:
            "You are not authorized to submit progress for this subject in this class",
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
        status: "draft",
      });

      if (!progressReports.length) {
        return res.status(404).json({
          message: "No draft progress reports found for this subject",
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
          status: "draft",
        },
        {
          $set: {
            status: "submittedToClassTeacher",
            submittedToClassTeacherAt: new Date(),
          },
        }
      );

      res.json({
        message: "Progress reports submitted to class teacher successfully",
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
      const ProgressReport = require("../models/ProgressReport")(connection);
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);

      // Verify that the teacher is the class teacher
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });

      if (!classInfo) {
        return res.status(403).json({
          message: "You are not the class teacher of this class",
        });
      }

      const academicYear = getCurrentAcademicYear();
      const progressReports = await ProgressReport.find({
        school: schoolId,
        class: classId,
        subject: subjectId, // Filter by subject instead of student
        academicYear,
        status: "submittedToClassTeacher",
      })
        .populate("subject", "name")
        .populate("student", "name rollNumber") // Populate student details instead of enteredBy
        .populate("enteredBy", "name")
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
      const ProgressReport = require("../models/ProgressReport")(connection);
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);
      const User = require("../models/User")(connection);

      // Validate classId
      if (
        !classId ||
        classId.length !== 24 ||
        !/^[0-9a-fA-F]{24}$/.test(classId)
      ) {
        return res.status(400).json({
          message:
            "Invalid classId format. Must be a 24-character hexadecimal string.",
        });
      }

      console.log("Received classId:", classId);
      console.log("classId length:", classId.length);
      console.log("teacherId:", teacherId);
      console.log("schoolId:", schoolId);

      // Verify that the teacher is the class teacher
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });
      console.log("Class found:", classInfo ? classInfo : "Not found");

      if (!classInfo) {
        return res.status(403).json({
          message: "You are not the class teacher of this class",
        });
      }

      const subjects = await Subject.find({ class: classId });
      if (!subjects.length) {
        return res
          .status(404)
          .json({ message: "No subjects found for this class" });
      }

      const students = await User.find({ _id: { $in: classInfo.students } })
        .select("name rollNumber")
        .lean();

      const academicYear = getCurrentAcademicYear();
      console.log("academicYear:", academicYear);

      const compiledReports = [];
      for (const student of students) {
        const progressReports = await ProgressReport.find({
          school: schoolId,
          class: classId,
          student: student._id,
          academicYear,
          status: "submittedToClassTeacher",
        })
          .populate("subject", "name")
          .populate("enteredBy", "name")
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
            status: "submittedToClassTeacher",
          },
          {
            $set: {
              status: "submittedToAdmin",
              submittedToAdminAt: new Date(),
            },
          },
          { session }
        );

        await session.commitTransaction();

        res.json({
          message:
            "Progress reports compiled and submitted to admin successfully",
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
      console.error("Error in compileAndSubmitProgressReports:", error);
      res.status(500).json({ error: error.message });
    }
  },


  getAssignedClasses: async (req, res) => {
    try {
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);

      // Find classes where the teacher is the class teacher
      const classTeacherClasses = await Class.find({
        school: schoolId,
        classTeacher: teacherId,
      }).select("name division _id");

      // Find classes where the teacher is a subject teacher
      const subjectClasses = await Subject.find({
        school: schoolId,
        "teachers.teacher": teacherId,
      })
        .populate("class", "name division")
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
          displayName: `${c.name}${c.division ? c.division : ""}`, // Format as "Class 1A"
        };
      }

      // Do NOT filter out the class teacher's class from subjectTeacherClasses
      const formattedSubjectTeacherClasses = subjectTeacherClasses.reduce(
        (acc, curr) => {
          const existing = acc.find(
            (item) => item._id.toString() === curr._id.toString()
          );
          if (existing) {
            existing.subjects.push(curr.subject);
          } else {
            acc.push({
              _id: curr._id,
              name: curr.name,
              division: curr.division,
              displayName: `${curr.name}${curr.division ? curr.division : ""}`, // Format as "Class 1A"
              subjects: [curr.subject],
            });
          }
          return acc;
        },
        []
      );

      // Format the response
      res.json({
        classTeacherClass: classTeacherClass ? { ...classTeacherClass } : null,
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
      const TeacherSchedule = require("../models/TeacherSchedule")(connection);
      const Class = require("../models/Class")(connection);

      const currentDate = new Date();

      const schedule = await TeacherSchedule.findOne({
        teacher: teacherId,
        school: schoolId,
        academicYear: getCurrentAcademicYear(),
      })
        .populate("schedule.periods.class", "name division", Class)
        .lean();

      if (!schedule) {
        return res.status(404).json({ message: "Schedule not found" });
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
      const Subject = require("../models/Subject")(connection);

      const subjects = await Subject.find({
        school: schoolId,
        class: classId,
        "teachers.teacher": teacherId,
      }).select("name _id");

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
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      }).populate("students", "name studentDetails.grNumber");

      if (!classInfo) {
        return res.status(403).json({
          message: "You are not the class teacher of this class",
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
      const User = require("../models/User")(connection);
      const Attendance = require("../models/Attendance")(connection);

      const teacher = await User.findById(teacherId);
      if (
        !teacher ||
        !teacher.permissions.canTakeAttendance.some(
          (id) => id.toString() === classId
        )
      ) {
        return res.status(403).json({
          message:
            "You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.",
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
            type: "student",
            markedBy: teacherId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      }));

      // Execute bulk write
      const result = await Attendance.bulkWrite(bulkOps, { ordered: false });

      res.json({
        message: "Attendance marked successfully",
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
      const teacherId = req.user._id;
      const { latitude, longitude } = req.body;
      const connection = req.connection;
      const Attendance = require("../models/Attendance")(connection);

      // Check if location data is provided
      if (!latitude || !longitude) {
        return res
          .status(400)
          .json({ message: "Location data is required to mark attendance" });
      }

      // Validate latitude and longitude
      if (
        isNaN(latitude) ||
        isNaN(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res
          .status(400)
          .json({ message: "Invalid latitude or longitude values" });
      }

      // Get current date in UTC
      const today = new Date();
      const startOfDay = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
      const endOfDay = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );

      // Check for existing attendance
      const existingAttendance = await Attendance.findOne({
        school: schoolId,
        user: teacherId,
        date: { $gte: startOfDay, $lte: endOfDay },
        type: "teacher",
      });

      if (existingAttendance) {
        return res
          .status(400)
          .json({ message: "Attendance already marked for today" });
      }

      // Reverse geocode to get readable address
      let address = "Unknown location";
      try {
        const response = await axios.get(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        if (response.data && response.data.display_name) {
          address = response.data.display_name; // e.g., "Mumbai, Maharashtra, India"
        }
      } catch (error) {
        console.error("Geocoding error:", error.message);
        // Fallback to coordinates if geocoding fails
        address = `Lat: ${latitude}, Lon: ${longitude}`;
      }

      // Create new attendance record with location and address
      const attendance = new Attendance({
        school: schoolId,
        user: teacherId,
        date: new Date(),
        status: "present",
        type: "teacher",
        markedBy: teacherId,
        location: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
        address, // Store the readable address
      });

      await attendance.save();
      res.status(201).json({
        message: "Attendance marked successfully",
        attendance: {
          ...attendance.toObject(),
          location: { latitude, longitude, address }, // Include address in response
        },
      });
    } catch (error) {
      console.error("Error in markOwnAttendance:", error);
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
      const Class = require("../models/Class")(connection);
      const Attendance = require("../models/Attendance")(connection);
      const User = require("../models/User")(connection);

      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });

      if (!classInfo) {
        return res.status(403).json({
          message: "You are not the class teacher of this class",
        });
      }

      // Construct the date range in UTC
      const attendanceDate = new Date(Date.UTC(year, month - 1, date));
      const startOfDay = new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0));
      const endOfDay = new Date(
        Date.UTC(year, month - 1, date, 23, 59, 59, 999)
      );

      const attendanceRecords = await Attendance.find({
        school: schoolId,
        class: classId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
        type: "student",
      })
        .populate("user", "name rollNumber")
        .lean();

      if (!attendanceRecords.length) {
        return res.status(404).json({
          message: "No attendance records found for the specified date",
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
      const Leave = require("../models/Leave")(connection);

      const leave = new Leave({
        school: schoolId,
        user: teacherId,
        reason,
        startDate,
        endDate,
        type,
        status: "pending",
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
      const Leave = require("../models/Leave")(connection);

      const leaves = await Leave.find({ school: schoolId, user: teacherId })
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: "success",
        count: leaves.length,
        leaves: leaves.map((leave) => ({
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
      const User = require("../models/User")(connection);
      const ParentCommunication = require("../models/ParentCommunication")(
        connection
      );

      // Get student's parent
      const student = await User.findOne({
        _id: studentId,
        school: schoolId,
      }).select("studentDetails.parentDetails");

      if (!student || !student.studentDetails.parentDetails) {
        return res
          .status(404)
          .json({ message: "Student or parent details not found" });
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
  // assignHomework: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id.toString();
  //     const { classId } = req.params;
  //     const { title, description, dueDate, subject } = req.body;
  //     const files = req.files; // Expecting files from multer
  //     const connection = req.connection;
  //     const Homework = require("../models/Homework")(connection);

  //     const attachments = [];
  //     if (files && files.length > 0) {
  //       for (const file of files) {
  //         const fileKey = `homework/${schoolId}/${classId}/${Date.now()}_${
  //           file.originalname
  //         }`;
  //         await uploadToS3(file.buffer, fileKey);
  //         attachments.push({
  //           fileName: file.originalname,
  //           fileUrl: `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileKey}`,
  //           fileType: file.mimetype,
  //         });
  //       }
  //     }

  //     const homework = new Homework({
  //       school: schoolId,
  //       class: classId,
  //       subject,
  //       title,
  //       description,
  //       assignedBy: req.user._id,
  //       dueDate,
  //       attachments,
  //     });

  //     await homework.save();
  //     res.status(201).json(homework);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  assignHomework: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { classId } = req.params;
      const { title, description, dueDate, subjectId } = req.body; // Changed subject to subjectId
      const files = req.files; // Expecting files from multer
      const teacherId = req.user._id;
      const connection = req.connection;
      const Homework = require("../models/Homework")(connection);
  
      if (!subjectId) {
        return res.status(400).json({ message: "Subject ID is required" });
      }
  
      // Verify teacher is assigned to the class and subject
      const isAssigned = await verifyTeacherSubjectAssignment(
        teacherId,
        classId,
        subjectId,
        connection
      );
      if (!isAssigned) {
        return res.status(403).json({
          message: "You are not authorized to assign homework for this class and subject",
        });
      }
  
      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const fileKey = `homework/${schoolId}/${classId}/${Date.now()}_${file.originalname}`;
          await uploadToS3(file.buffer, fileKey, file.mimetype);
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
        subject: subjectId, // Use subjectId
        title,
        description,
        assignedBy: teacherId,
        dueDate,
        attachments,
      });
  
      await homework.save();
      res.status(201).json({ message: "Homework assigned successfully", homework });
    } catch (error) {
      console.error("Error in assignHomework:", error);
      res.status(500).json({ error: error.message });
    }
  },



  uploadStudyMaterial: async (req, res) => {
    try {
      logger.info('Entering uploadStudyMaterial controller', {
        classId: req.params.classId,
        subjectId: req.params.subjectId,
        userId: req.user?._id,
        dbConnectionName: req.dbConnection?.name,
        hasConnection: !!req.dbConnection,
        hasReqConnection: !!req.connection,
      });
  
      const { classId, subjectId } = req.params;
      const { title, description, type } = req.body;
      const schoolId = req.school._id.toString();
      const teacherId = req.user._id.toString();
      const connection = req.dbConnection;
      const {getPublicFileUrl}= require('../config/s3Upload')
  
      // Validate connection
      if (!connection || typeof connection !== 'object' || !connection.name) {
        logger.error('Invalid database connection', { connection });
        return res.status(500).json({ error: 'Database connection is not properly initialized' });
      }
      logger.info('Database connection validated', { connectionName: connection.name });
  
      const StudyMaterial = require('../models/StudyMaterial')(connection);
      const ClassModel = require('../models/Class')(connection);
      const SubjectModel = require('../models/Subject')(connection);
  
      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
        logger.warn('Invalid class or subject ID', { classId, subjectId });
        return res.status(400).json({ message: 'Invalid class or subject ID' });
      }
      if (!title || !type) {
        logger.warn('Missing required fields', { title, type });
        return res.status(400).json({ message: 'Title and type are required' });
      }
      if (!['notes', 'assignment', 'questionPaper', 'other'].includes(type)) {
        logger.warn('Invalid material type', { type });
        return res.status(400).json({ message: 'Invalid material type' });
      }
  
      // Verify class and subject exist
      const classInfo = await ClassModel.findOne({ _id: classId, school: schoolId });
      if (!classInfo) {
        logger.warn('Class not found', { classId, schoolId });
        return res.status(404).json({ message: 'Class not found' });
      }
      const subject = await SubjectModel.findOne({ _id: subjectId, school: schoolId });
      if (!subject) {
        logger.warn('Subject not found', { subjectId, schoolId });
        return res.status(404).json({ message: 'Subject not found' });
      }
  
      // Verify teacher is assigned to the class and subject
      const isTeacherAssigned = subject.teachers.some(t => t.teacher.toString() === teacherId);
      if (!isTeacherAssigned) {
        logger.warn('Teacher not authorized', { teacherId, classId, subjectId });
        return res.status(403).json({ message: 'You are not authorized to upload materials for this subject' });
      }
  
      // Check if file was uploaded
      if (!req.file) {
        logger.warn('No file uploaded in controller');
        return res.status(400).json({ message: 'No file uploaded' });
      }
  
      // Create study material document
      const studyMaterial = new StudyMaterial({
        school: schoolId,
        class: classId,
        subject: subjectId,
        title,
        description,
        type,
        uploadedBy: teacherId,
        attachments: [
          {
            fileName: req.file.originalname,
            fileUrl: getPublicFileUrl(req.file.key),
            fileType: req.file.mimetype,
            s3Key: req.file.key,
          },
        ],
        isActive: true,
      });
  
      await studyMaterial.save();
  
      logger.info(`Study material uploaded by teacher ${teacherId} for class ${classId}, subject ${subjectId}`);
  
      res.status(201).json({
        message: 'Study material uploaded successfully',
        studyMaterial: {
          id: studyMaterial._id,
          title: studyMaterial.title,
          description: studyMaterial.description,
          subject: subjectId,
          type: studyMaterial.type,
          attachments: studyMaterial.attachments,
          createdAt: studyMaterial.createdAt,
        },
      });
    } catch (error) {
      logger.error(`Error uploading study material: ${error.message}`, { error });
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  },


  uploadSyllabus: async (req, res) => {
    try {
      logger.info('Entering uploadSyllabus controller', {
        classId: req.params.classId,
        subjectId: req.params.subjectId,
        userId: req.user?._id,
      });

      const { classId, subjectId } = req.params;
      const { content } = req.body;
      const schoolId = req.school._id.toString();
      const teacherId = req.user._id.toString();
      const connection = req.dbConnection;
      

      // Validate connection
      if (!connection || typeof connection !== 'object') {
        logger.error('Invalid database connection', { connection });
        throw new Error('Database connection is not properly initialized');
      }
      logger.info('Database connection validated', { connectionName: connection.name });

      const Syllabus = require('../models/Syllabus')(connection);
      const ClassModel = require('../models/Class')(connection);
      const SubjectModel = require('../models/Subject')(connection);

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
        logger.warn('Invalid class or subject ID', { classId, subjectId });
        return res.status(400).json({ message: 'Invalid class or subject ID' });
      }
      if (!content) {
        logger.warn('Missing content field');
        return res.status(400).json({ message: 'Syllabus content is required' });
      }

      // Verify class and subject exist
      const classInfo = await ClassModel.findOne({ _id: classId, school: schoolId });
      if (!classInfo) {
        logger.warn('Class not found', { classId, schoolId });
        return res.status(404).json({ message: 'Class not found' });
      }
      const subject = await SubjectModel.findOne({ _id: subjectId, school: schoolId });
      if (!subject) {
        logger.warn('Subject not found', { subjectId, schoolId });
        return res.status(404).json({ message: 'Subject not found' });
      }

      // Verify teacher is assigned to the class and subject
      // if (!classInfo.teachers.includes(teacherId) || !subject.teachers.includes(teacherId)) {
      //   logger.warn('Teacher not authorized', { teacherId, classId, subjectId });
      //   return res.status(403).json({ message: 'You are not authorized to upload syllabus for this class or subject' });
      // }

      // Check if file was uploaded (already checked in route, but kept for safety)
      if (!req.file) {
        logger.warn('No file uploaded in controller');
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Create or update syllabus document
      let syllabus = await Syllabus.findOne({
        school: schoolId,
        class: classId,
        subject: subjectId,
      });

      const document = {
        title: req.file.originalname,
        url: getPublicFileUrl(req.file.key),
        uploadedBy: teacherId,
        s3Key: req.file.key,
        uploadedAt: new Date(),
      };

      if (syllabus) {
        syllabus.content = content;
        syllabus.documents.push(document);
        syllabus.updatedAt = new Date();
      } else {
        syllabus = new Syllabus({
          school: schoolId,
          class: classId,
          subject: subjectId,
          content,
          documents: [document],
          uploadedBy: teacherId,
        });
      }

      await syllabus.save();

      logger.info(`Syllabus uploaded by teacher ${teacherId} for class ${classId}, subject ${subjectId}`);
      
      // Ensure response is only sent once
      if (!res.headersSent) {
        res.status(201).json({
          message: 'Syllabus uploaded successfully',
          syllabus: {
            id: syllabus._id,
            subject: subjectId,
            content: syllabus.content,
            documents: syllabus.documents,
            createdAt: syllabus.createdAt,
            updatedAt: syllabus.updatedAt,
          },
        });
      }
    } catch (error) {
      logger.error(`Error uploading syllabus: ${error.message}`, { error });
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  },
  // Get students of a class for entering marks
  getClassStudentsForSubject: async (req, res) => {
    try {
      const { classId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);
      const Subject = require("../models/Subject")(connection);

      // Check if the teacher is a subject teacher for this class
      const isSubjectTeacher = await Subject.findOne({
        school: schoolId,
        class: classId,
        "teachers.teacher": teacherId,
      });

      // Check if the teacher is the class teacher
      const isClassTeacher = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });

      if (!isSubjectTeacher && !isClassTeacher) {
        return res.status(403).json({
          message: "You are not authorized to view students of this class",
        });
      }

      const classInfo = await Class.findById(classId).populate(
        "students",
        "name rollNumber"
      );

      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      res.json(classInfo.students);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },



  getExamsForTeacher: async (req, res) => {
    try {
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const { classId } = req.query; // Optional filter by class
      const connection = req.connection;
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      // Find subjects taught by the teacher
      const subjectQuery = {
        school: schoolId,
        "teachers.teacher": teacherId,
      };
      if (classId) subjectQuery.class = classId;

      const subjects = await Subject.find(subjectQuery).select("_id name class");
      const subjectIds = subjects.map((s) => s._id);

      // Find exams for those subjects
      const examQuery = {
        school: schoolId,
        subject: { $in: subjectIds },
        status: { $in: ["draft", "pending"] }, // Exams available for mark entry
      };
      if (classId) examQuery.class = classId;

      const exams = await Exam.find(examQuery)
        .populate("class", "name division students")
        .populate("subject", "name")
        .lean();

      const formattedExams = await Promise.all(
        exams.map(async (exam) => {
          const students = await User.find({ _id: { $in: exam.class.students } })
            .select("name rollNumber")
            .lean();
          return {
            examId: exam._id,
            examType: exam.examType === "Other" ? exam.customExamType : exam.examType,
            classId: exam.class._id,
            class: `${exam.class.name}${exam.class.division ? " " + exam.class.division : ""}`,
            subject: exam.subject.name,
            examDate: exam.examDate,
            totalMarks: exam.totalMarks,
            status: exam.status || "draft",
            students: students.map((s) => ({
              studentId: s._id,
              name: s.name,
              rollNumber: s.rollNumber,
            })),
          };
        })
      );

      res.json({ message: "Exams retrieved successfully", exams: formattedExams });
    } catch (error) {
      console.error("Error in getExamsForTeacher:", error);
      res.status(500).json({ error: error.message });
    }
  },

 

  // Enter marks for a specific exam (subject teacher)
  enterSubjectMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { studentsMarks } = req.body; // [{ studentId, marks, remarks }]
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);
      const User = require("../models/User")(connection);

      const exam = await Exam.findOne({ _id: examId, school: schoolId })
        .populate("subject")
        .populate("class", "students");
      if (!exam) return res.status(404).json({ message: "Exam not found" });

      // Verify teacher is assigned to the subject
      const subject = exam.subject;
      const isAuthorized = subject.teachers.some(
        (t) => t.teacher.toString() === teacherId.toString()
      );
      if (!isAuthorized) {
        return res.status(403).json({ message: "Not authorized to enter marks for this exam" });
      }

      // Validate students and marks
      const validStudentIds = exam.class.students.map((s) => s.toString());
      for (const entry of studentsMarks) {
        if (!validStudentIds.includes(entry.studentId)) {
          return res.status(400).json({ message: `Invalid student ID: ${entry.studentId}` });
        }
        if (entry.marks > exam.totalMarks || entry.marks < 0) {
          return res.status(400).json({
            message: `Marks for student ${entry.studentId} must be between 0 and ${exam.totalMarks}`,
          });
        }
      }

      // Update exam with marks
      exam.results = studentsMarks.map((entry) => ({
        student: entry.studentId,
        marksObtained: entry.marks,
        remarks: entry.remarks || "",
      }));
      exam.marksEnteredBy = teacherId;
      exam.marksEnteredAt = new Date();
      exam.status = "pending"; // Changed from "draft" to "pending" for clarity

      await exam.save();
      res.json({ message: "Marks entered successfully", exam });
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
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);

      const exam = await Exam.findOne({ _id: examId, school: schoolId })
        .populate("class", "classTeacher");

      // const exam = await Exam.findOne({ _id: examId, school: schoolId })
      //   .populate("class", "classTeacher")
      //   .populate("subject", "name"); // Add this to populate the subject

      if (!exam) return res.status(404).json({ message: "Exam not found" });

      if (exam.marksEnteredBy.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized to submit these marks" });
      }
      if (exam.status !== "pending") {
        return res.status(400).json({ message: "Marks already submitted or in invalid state" });
      }

      if (!exam.class.classTeacher) {
        return res.status(400).json({ message: "No class teacher assigned to this class" });
      }

      exam.status = "submittedToClassTeacher";
      exam.submittedToClassTeacherAt = new Date();
      await exam.save();

      res.json({ message: "Marks submitted to class teacher successfully", exam });
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
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);

      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized as class teacher" });
      }

      const query = {
        school: schoolId,
        class: classId,
        status: "submittedToClassTeacher",
      };
      // if (examId) query._id = examId;
      if (examId && examId !== "all") query._id = examId;

      const exams = await Exam.find(query)
        .populate("subject", "name")
        .populate("results.student", "name")
        .lean();

      res.json(exams);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  
  

  compileAndSubmitResults: async (req, res) => {
    try {
      const { classId, examType } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);
      const Subject = require("../models/Subject")(connection);
      const User = require("../models/User")(connection);

      // Verify class teacher role
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized as class teacher" });
      }

      // Get all subjects and exams
      const subjects = await Subject.find({ class: classId });
      const exams = await Exam.find({
        school: schoolId,
        class: classId,
        examType: examType,
        status: "submittedToClassTeacher",
      }).populate("subject", "name");

      if (exams.length !== subjects.length) {
        return res.status(400).json({
          message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${exams.length}`,
        });
      }

      const students = await User.find({ _id: { $in: classInfo.students } })
        .select("name rollNumber")
        .lean();

      // Compile results
      const compiledResults = students.map((student) => {
        const studentResult = {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          subjects: {},
          totalMarks: 0,
          percentage: 0,
        };

        exams.forEach((exam) => {
          const result = exam.results.find(
            (r) => r.student.toString() === student._id.toString()
          );
          studentResult.subjects[exam.subject.name] = result ? result.marksObtained : 0;
          studentResult.totalMarks += result ? result.marksObtained : 0;
        });

        const maxTotalMarks = subjects.length * 100;
        studentResult.percentage = (studentResult.totalMarks / maxTotalMarks) * 100;

        return studentResult;
      });

      // Update exam statuses in a transaction
      const session = await connection.startSession();
      session.startTransaction();

      try {
        await Exam.updateMany(
          { _id: { $in: exams.map((e) => e._id) } },
          { status: "submittedToAdmin", submittedToAdminAt: new Date() },
          { session }
        );

        await session.commitTransaction();
        res.json({
          message: "Results compiled and submitted to admin successfully",
          class: `${classInfo.name}${classInfo.division ? " " + classInfo.division : ""}`,
          examType,
          results: compiledResults,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error("Error in compileAndSubmitResults:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

// Helper Functions

const verifyTeacherSubjectAssignment = async (teacherId, classId, subjectId, connection) => {
  const Subject = require("../models/Subject")(connection);
  const subject = await Subject.findOne({
    _id: subjectId,
    class: classId,
    school: connection.db.name, // Assuming schoolId is tied to connection
    "teachers.teacher": teacherId,
  });
  return !!subject; // Returns true if the teacher is assigned, false otherwise
};

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

const verifyTeacherClassAssignment = async (teacherId, classId, connection) => {
  const User = require("../models/User")(connection);
  const teacher = await User.findById(teacherId);
  if (!teacher) return false;

  if (
    teacher.permissions.canTakeAttendance.some(
      (id) => id.toString() === classId
    )
  ) {
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
  let suffix = "th";
  if (number === 1) suffix = "st";
  else if (number === 2) suffix = "nd";
  else if (number === 3) suffix = "rd";
  return `Class ${number}${suffix}`;
};

module.exports = teacherController;
