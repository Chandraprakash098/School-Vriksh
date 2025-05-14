const mongoose = require("mongoose");
const { uploadToS3 } = require("../config/s3Upload");
const path = require("path");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const ExcelJS = require('exceljs');
const { uploadStudyMaterial, uploadSyllabus,uploadExcelResults,getPublicFileUrl } = require("../config/s3Upload");
const logger = require("../utils/logger");
const getModel= require('../models/index')
const {getOwnerConnection}= require('../config/database')


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



  // getExamsForTeacher: async (req, res) => {
  //   try {
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const { classId } = req.query; // Optional filter by class
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Subject = require("../models/Subject")(connection);
  //     const Class = require("../models/Class")(connection);
  //     const User = require("../models/User")(connection);

  //     // Find subjects taught by the teacher
  //     const subjectQuery = {
  //       school: schoolId,
  //       "teachers.teacher": teacherId,
  //     };
  //     if (classId) subjectQuery.class = classId;

  //     const subjects = await Subject.find(subjectQuery).select("_id name class");
  //     const subjectIds = subjects.map((s) => s._id);

  //     // Find exams for those subjects
  //     const examQuery = {
  //       school: schoolId,
  //       subject: { $in: subjectIds },
  //       status: { $in: ["draft", "pending"] }, // Exams available for mark entry
  //     };
  //     if (classId) examQuery.class = classId;

  //     const exams = await Exam.find(examQuery)
  //       .populate("class", "name division students")
  //       .populate("subject", "name")
  //       .lean();

  //     const formattedExams = await Promise.all(
  //       exams.map(async (exam) => {
  //         const students = await User.find({ _id: { $in: exam.class.students } })
  //           .select("name rollNumber")
  //           .lean();
  //         return {
  //           examId: exam._id,
  //           examType: exam.examType === "Other" ? exam.customExamType : exam.examType,
  //           classId: exam.class._id,
  //           class: `${exam.class.name}${exam.class.division ? " " + exam.class.division : ""}`,
  //           subject: exam.subject.name,
  //           examDate: exam.examDate,
  //           totalMarks: exam.totalMarks,
  //           status: exam.status || "draft",
  //           students: students.map((s) => ({
  //             studentId: s._id,
  //             name: s.name,
  //             rollNumber: s.rollNumber,
  //           })),
  //         };
  //       })
  //     );

  //     res.json({ message: "Exams retrieved successfully", exams: formattedExams });
  //   } catch (error) {
  //     console.error("Error in getExamsForTeacher:", error);
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // getExamsForTeacher: async (req, res) => {
  //   try {
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const { classId } = req.query; // Optional filter by class
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Subject = require("../models/Subject")(connection);
  //     const Class = require("../models/Class")(connection);
  //     const User = require("../models/User")(connection);

  //     // Find subjects taught by the teacher
  //     const subjectQuery = {
  //       school: schoolId,
  //       "teachers.teacher": teacherId,
  //     };
  //     if (classId) subjectQuery.class = classId;

  //     const subjects = await Subject.find(subjectQuery).select("_id name class");
  //     const subjectIds = subjects.map((s) => s._id);

  //     // Find exams for those subjects
  //     const examQuery = {
  //       school: schoolId,
  //       subject: { $in: subjectIds },
  //       status: { $in: ["draft", "pending"] }, // Exams available for mark entry
  //     };
  //     if (classId) examQuery.class = classId;

  //     const exams = await Exam.find(examQuery)
  //       .populate("class", "name division students")
  //       .populate("subject", "name")
  //       .lean();

  //     const formattedExams = await Promise.all(
  //       exams.map(async (exam) => {
  //         const students = await User.find({ _id: { $in: exam.class.students } })
  //           .select("name rollNumber")
  //           .lean();
  //         return {
  //           examId: exam._id,
  //           examType: exam.examType === "Other" ? exam.customExamType : exam.examType,
  //           classId: exam.class._id,
  //           class: `${exam.class.name}${exam.class.division ? " " + exam.class.division : ""}`,
  //           subject: exam.subject.name,
  //           subjectId: exam.subject._id,
  //           examDate: exam.examDate,
  //           totalMarks: exam.totalMarks,
  //           status: exam.status || "draft",
  //           students: students.map((s) => ({
  //             studentId: s._id,
  //             name: s.name,
  //             rollNumber: s.rollNumber,
  //           })),
  //         };
  //       })
  //     );

  //     res.json({ message: "Exams retrieved successfully", exams: formattedExams });
  //   } catch (error) {
  //     console.error("Error in getExamsForTeacher:", error);
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  getExamsForTeacher: async (req, res) => {
    try {
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const { classId, examEventId } = req.query;
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const ExamEvent = getModel("ExamEvent", connection);
      const Subject = getModel("Subject", connection);
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);

      const subjectQuery = {
        school: schoolId,
        "teachers.teacher": teacherId,
      };
      if (classId) subjectQuery.class = classId;

      const subjects = await Subject.find(subjectQuery).select("_id name class");
      const subjectIds = subjects.map((s) => s._id);

      const examQuery = {
        school: schoolId,
        subject: { $in: subjectIds },
        status: { $in: ["draft", "pending"] },
      };
      if (classId) examQuery.class = classId;
      if (examEventId) examQuery.examEvent = examEventId;

      const exams = await Exam.find(examQuery)
        .populate("class", "name division students")
        .populate("subject", "name")
        .populate("examEvent", "name examType")
        .lean();

      const formattedExams = await Promise.all(
        exams.map(async (exam) => {
          const students = await User.find({ _id: { $in: exam.class.students } })
            .select("name rollNumber")
            .lean();
          return {
            examId: exam._id,
            examEvent: {
              id: exam.examEvent._id,
              name: exam.examEvent.name,
              type: exam.examEvent.examType === "Other" ? exam.examEvent.customExamType : exam.examEvent.examType,
            },
            examType: exam.examType === "Other" ? exam.customExamType : exam.examType,
            classId: exam.class._id,
            class: `${exam.class.name}${exam.class.division ? " " + exam.class.division : ""}`,
            subject: exam.subject.name,
            subjectId: exam.subject._id,
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

  
  // enterSubjectMarks: async (req, res) => {
  //   try {
  //     const { examId } = req.params;
  //     const { subjectId, studentsMarks } = req.body;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Subject = require("../models/Subject")(connection);
  //     const User = require("../models/User")(connection);
  //     const Result = require("../models/Results")(connection);
  //     const Class = require('../models/Class')(connection)

  //     if (!mongoose.Types.ObjectId.isValid(examId)) {
  //       return res.status(400).json({ message: "Invalid exam ID" });
  //     }
  //     if (!mongoose.Types.ObjectId.isValid(subjectId)) {
  //       return res.status(400).json({ message: "Invalid subject ID" });
  //     }

  //     const exam = await Exam.findOne({ _id: examId, school: schoolId })
  //       .populate("class", "students")
  //       .lean();
  //     if (!exam) {
  //       return res.status(404).json({ message: "Exam not found" });
  //     }

  //     const subject = await Subject.findOne({
  //       _id: subjectId,
  //       class: exam.class._id,
  //       school: schoolId,
  //       "teachers.teacher": teacherId,
  //     });
  //     if (!subject) {
  //       return res.status(403).json({
  //         message: "Subject not found or you are not authorized to enter marks for this subject",
  //       });
  //     }

  //     const validStudentIds = exam.class.students.map((s) => s.toString());
  //     for (const entry of studentsMarks) {
  //       if (!validStudentIds.includes(entry.studentId)) {
  //         return res.status(400).json({ message: `Invalid student ID: ${entry.studentId}` });
  //       }
  //       if (entry.marks > exam.totalMarks || entry.marks < 0) {
  //         return res.status(400).json({
  //           message: `Marks for student ${entry.studentId} must be between 0 and ${exam.totalMarks}`,
  //         });
  //       }
  //     }

  //     const results = [];
  //     for (const entry of studentsMarks) {
  //       const result = await Result.findOneAndUpdate(
  //         {
  //           school: schoolId,
  //           exam: examId,
  //           subject: subjectId,
  //           student: entry.studentId,
  //           class: exam.class._id,
  //         },
  //         {
  //           marksObtained: entry.marks,
  //           totalMarks: exam.totalMarks,
  //           remarks: entry.remarks || "",
  //           status: "pending",
  //           marksEnteredBy: teacherId,
  //           marksEnteredAt: new Date(),
  //         },
  //         { upsert: true, new: true }
  //       );
  //       results.push(result);
  //     }

  //     await Exam.updateOne(
  //       { _id: examId, school: schoolId },
  //       { status: "pending", marksEnteredBy: teacherId }
  //     );

  //     res.json({
  //       message: "Marks entered successfully",
  //       examId,
  //       subjectId,
  //       results: results.map((r) => ({
  //         studentId: r.student,
  //         marksObtained: r.marksObtained,
  //         remarks: r.remarks,
  //       })),
  //     });
  //   } catch (error) {
  //     logger.error(`Error entering subject marks: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  enterSubjectMarks: async (req, res) => {
    try {
      const { examId } = req.params;
      const { examEventId, subjectId, studentsMarks } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const ExamEvent = getModel("ExamEvent", connection);
      const Subject = getModel("Subject", connection);
      const User = getModel("User", connection);
      const Result = getModel("Result", connection);

      if (!mongoose.Types.ObjectId.isValid(examId) || !mongoose.Types.ObjectId.isValid(examEventId)) {
        return res.status(400).json({ message: "Invalid exam or exam event ID" });
      }
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }

      const exam = await Exam.findOne({ _id: examId, school: schoolId, examEvent: examEventId })
        .populate("class", "students")
        .lean();
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const subject = await Subject.findOne({
        _id: subjectId,
        class: exam.class._id,
        school: schoolId,
        "teachers.teacher": teacherId,
      });
      if (!subject) {
        return res.status(403).json({
          message: "Subject not found or you are not authorized to enter marks for this subject",
        });
      }

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

      const results = [];
      for (const entry of studentsMarks) {
        const result = await Result.findOneAndUpdate(
          {
            school: schoolId,
            exam: examId,
            examEvent: examEventId,
            subject: subjectId,
            student: entry.studentId,
            class: exam.class._id,
          },
          {
            marksObtained: entry.marks,
            totalMarks: exam.totalMarks,
            remarks: entry.remarks || "",
            status: "pending",
            marksEnteredBy: teacherId,
            marksEnteredAt: new Date(),
          },
          { upsert: true, new: true }
        );
        results.push(result);
      }

      await Exam.updateOne(
        { _id: examId, school: schoolId },
        { status: "pending", marksEnteredBy: teacherId }
      );

      res.json({
        message: "Marks entered successfully",
        examId,
        examEventId,
        subjectId,
        results: results.map((r) => ({
          studentId: r.student,
          marksObtained: r.marksObtained,
          remarks: r.remarks,
        })),
      });
    } catch (error) {
      logger.error(`Error entering subject marks: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  

  // submitMarksToClassTeacher: async (req, res) => {
  //   try {
  //     const { examId } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Class = require("../models/Class")(connection);
  //     const Result = require("../models/Results")(connection);
  //     const Subject = require("../models/Subject")(connection);

  //     // Validate examId
  //     if (!mongoose.Types.ObjectId.isValid(examId)) {
  //       return res.status(400).json({ message: "Invalid exam ID" });
  //     }

  //     // Find the exam and populate class and subject
  //     const exam = await Exam.findOne({ _id: examId, school: schoolId })
  //       .populate("class", "classTeacher")
  //       .populate("subject");
  //     if (!exam) {
  //       return res.status(404).json({ message: "Exam not found" });
  //     }

  //     // Verify the teacher is authorized (either marksEnteredBy or subject teacher)
  //     const isSubjectTeacher = await Subject.findOne({
  //       _id: exam.subject._id,
  //       school: schoolId,
  //       "teachers.teacher": teacherId,
  //     });
  //     const isMarksEnteredBy = exam.marksEnteredBy && exam.marksEnteredBy.toString() === teacherId.toString();

  //     if (!isSubjectTeacher && !isMarksEnteredBy) {
  //       return res.status(403).json({ message: "Not authorized to submit these marks" });
  //     }

  //     // Check if marks exist in Result model
  //     const results = await Result.find({
  //       school: schoolId,
  //       exam: examId,
  //       subject: exam.subject._id,
  //       status: "pending",
  //     });
  //     if (results.length === 0) {
  //       return res.status(400).json({ message: "No pending marks found for this exam and subject" });
  //     }

  //     // Check exam status
  //     if (exam.status !== "pending") {
  //       return res.status(400).json({ message: "Marks already submitted or in invalid state" });
  //     }

  //     // Verify class teacher exists
  //     if (!exam.class.classTeacher) {
  //       return res.status(400).json({ message: "No class teacher assigned to this class" });
  //     }

  //     // Update exam status
  //     exam.status = "submittedToClassTeacher";
  //     exam.submittedToClassTeacherAt = new Date();
  //     await exam.save();

  //     // Update Result documents to reflect submission
  //     await Result.updateMany(
  //       {
  //         school: schoolId,
  //         exam: examId,
  //         subject: exam.subject._id,
  //         status: "pending",
  //       },
  //       {
  //         status: "submittedToClassTeacher",
  //         submittedToClassTeacherAt: new Date(),
  //       }
  //     );

  //     res.json({
  //       message: "Marks submitted to class teacher successfully",
  //       exam: {
  //         examId: exam._id,
  //         examType: exam.examType,
  //         subject: exam.subject.name,
  //         status: exam.status,
  //       },
  //     });
  //   } catch (error) {
  //     logger.error(`Error submitting marks to class teacher: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },
  
  // submitMarksToClassTeacher: async (req, res) => {
  //   try {
  //     const { examId } = req.params;
  //     const { subjectId } = req.body; // Specify which subject's marks to submit
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Class = require("../models/Class")(connection);
  //     const Result = require("../models/Results")(connection);
  //     const Subject = require("../models/Subject")(connection);

  //     // Validate inputs
  //     if (!mongoose.Types.ObjectId.isValid(examId)) {
  //       return res.status(400).json({ message: "Invalid exam ID" });
  //     }
  //     if (!mongoose.Types.ObjectId.isValid(subjectId)) {
  //       return res.status(400).json({ message: "Invalid subject ID" });
  //     }

  //     // Find the exam and populate class
  //     const exam = await Exam.findOne({ _id: examId, school: schoolId })
  //       .populate("class", "classTeacher");
  //     if (!exam) {
  //       return res.status(404).json({ message: "Exam not found" });
  //     }

  //     // Verify the subject belongs to the exam's class and teacher is authorized
  //     const subject = await Subject.findOne({
  //       _id: subjectId,
  //       class: exam.class._id,
  //       school: schoolId,
  //       "teachers.teacher": teacherId,
  //     });
  //     if (!subject) {
  //       return res.status(403).json({
  //         message: "Subject not found or you are not authorized to submit marks for this subject",
  //       });
  //     }

  //     // Check if pending marks exist in Result model for the specified subject
  //     const results = await Result.find({
  //       school: schoolId,
  //       exam: examId,
  //       subject: subjectId,
  //       status: "pending",
  //     });
  //     if (results.length === 0) {
  //       return res.status(400).json({ message: "No pending marks found for this exam and subject" });
  //     }

  //     // Verify class teacher exists
  //     if (!exam.class.classTeacher) {
  //       return res.status(400).json({ message: "No class teacher assigned to this class" });
  //     }

  //     // Update Result documents to submittedToClassTeacher
  //     await Result.updateMany(
  //       {
  //         school: schoolId,
  //         exam: examId,
  //         subject: subjectId,
  //         status: "pending",
  //       },
  //       {
  //         status: "submittedToClassTeacher",
  //         submittedToClassTeacherAt: new Date(),
  //       }
  //     );

  //     // Update exam status to pending if not already (optional, since exam may cover multiple subjects)
  //     await Exam.updateOne(
  //       { _id: examId, school: schoolId },
  //       { status: "pending" }
  //     );

  //     res.json({
  //       message: "Marks submitted to class teacher successfully",
  //       examId,
  //       subjectId,
  //       subjectName: subject.name,
  //       status: "submittedToClassTeacher",
  //     });
  //   } catch (error) {
  //     logger.error(`Error submitting marks to class teacher: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  submitMarksToClassTeacher: async (req, res) => {
    try {
      const { examId } = req.params;
      const { subjectId } = req.body;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = require("../models/Exam")(connection);
      const Class = require("../models/Class")(connection);
      const Result = require("../models/Results")(connection);
      const Subject = require("../models/Subject")(connection);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        return res.status(400).json({ message: "Invalid exam ID" });
      }
      if (!mongoose.Types.ObjectId.isValid(subjectId)) {
        return res.status(400).json({ message: "Invalid subject ID" });
      }

      const exam = await Exam.findOne({ _id: examId, school: schoolId })
        .populate("class", "classTeacher");
      if (!exam) {
        return res.status(404).json({ message: "Exam not found" });
      }

      const subject = await Subject.findOne({
        _id: subjectId,
        class: exam.class._id,
        school: schoolId,
        "teachers.teacher": teacherId,
      });
      if (!subject) {
        return res.status(403).json({
          message: "Subject not found or you are not authorized to submit marks for this subject",
        });
      }

      const results = await Result.find({
        school: schoolId,
        exam: examId,
        subject: subjectId,
        status: "pending",
      });
      if (results.length === 0) {
        return res.status(400).json({ message: "No pending marks found for this exam and subject" });
      }

      if (!exam.class.classTeacher) {
        return res.status(400).json({ message: "No class teacher assigned to this class" });
      }

      await Result.updateMany(
        {
          school: schoolId,
          exam: examId,
          subject: subjectId,
          status: "pending",
        },
        {
          status: "submittedToClassTeacher",
          submittedToClassTeacherAt: new Date(),
        }
      );

      await Exam.updateOne(
        { _id: examId, school: schoolId },
        { status: "pending" }
      );

      res.json({
        message: "Marks submitted to class teacher successfully",
        examId,
        subjectId,
        subjectName: subject.name,
        status: "submittedToClassTeacher",
      });
    } catch (error) {
      logger.error(`Error submitting marks to class teacher: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },



  // reviewSubjectMarks: async (req, res) => {
  //   try {
  //     const { classId, examId } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     // const Exam = require("../models/Exam")(connection);
  //     const Class = require("../models/Class")(connection);

  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: "Not authorized as class teacher" });
  //     }

  //     const query = {
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToClassTeacher",
  //     };
  //     // if (examId) query._id = examId;
  //     // if (examId && examId !== "all") query._id = examId;

  //     // const exams = await Exam.find(query)
  //     //   .populate("subject", "name")
  //     //   .populate("results.student", "name")
  //     //   .lean();

  //     // res.json(exams);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  reviewSubjectMarks: async (req, res) => {
    try {
      const { classId, examId } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require("../models/Class")(connection);
      const Result = require("../models/Results")(connection);
      const Exam = require("../models/Exam")(connection);
      const Subject = require("../models/Subject")(connection);
      const User = require("../models/User")(connection);

      // Validate class teacher
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized as class teacher" });
      }

      // Build query for Result documents
      const query = {
        school: schoolId,
        class: classId,
        status: "submittedToClassTeacher",
      };
      if (examId && examId !== "all") query.exam = examId;

      // Aggregate results by exam and subject
      const results = await Result.find(query)
        .populate("exam", "examType totalMarks")
        .populate("subject", "name")
        .populate("student", "name rollNumber")
        .lean();

      // Group results by exam and subject
      const examsMap = {};
      results.forEach((result) => {
        const examId = result.exam._id.toString();
        const subjectId = result.subject._id.toString();

        if (!examsMap[examId]) {
          examsMap[examId] = {
            examId: examId,
            examType: result.exam.examType,
            totalMarks: result.exam.totalMarks,
            classId: result.class.toString(),
            subjects: {},
          };
        }

        if (!examsMap[examId].subjects[subjectId]) {
          examsMap[examId].subjects[subjectId] = {
            subjectId: subjectId,
            subjectName: result.subject.name,
            results: [],
          };
        }

        examsMap[examId].subjects[subjectId].results.push({
          studentId: result.student._id,
          studentName: result.student.name,
          rollNumber: result.student.rollNumber,
          marksObtained: result.marksObtained,
          totalMarks: result.totalMarks,
          remarks: result.remarks,
          status: result.status,
        });
      });

      // Convert examsMap to array
      const formattedExams = Object.values(examsMap).map((exam) => ({
        ...exam,
        subjects: Object.values(exam.subjects),
      }));

      res.json(formattedExams);
    } catch (error) {
      logger.error(`Error reviewing subject marks: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  
  


  // compileAndSubmitResults: async (req, res) => {
  //   try {
  //     const { classId, examType } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = require("../models/Exam")(connection);
  //     const Class = require("../models/Class")(connection);
  //     const Subject = require("../models/Subject")(connection);
  //     const User = require("../models/User")(connection);
  //     const Result = require("../models/Results")(connection);

  //     // Verify class teacher role
  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: "Not authorized as class teacher" });
  //     }

  //     // Get all subjects for the class
  //     const subjects = await Subject.find({ class: classId }).lean();

  //     // Get all results for the class and exam type with status submittedToClassTeacher
  //     const results = await Result.find({
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToClassTeacher",
  //     })
  //       .populate({
  //         path: "exam",
  //         match: { examType: { $regex: `^${examType}$`, $options: "i" } }, // Case-insensitive match
  //         select: "examType totalMarks subject",
  //       })
  //       .populate("subject", "name")
  //       .populate("student", "name rollNumber")
  //       .lean();

  //     // Log results with invalid exam references
  //     const invalidResults = results.filter((result) => !result.exam);
  //     if (invalidResults.length > 0) {
  //       logger.warn(`Found ${invalidResults.length} results with invalid or missing exam references`, {
  //         classId,
  //         examType,
  //         invalidExamIds: invalidResults.map((r) => r.exam?.toString() || "null"),
  //       });
  //     }

  //     // Filter out results where exam is null (wrong examType or missing exam)
  //     const validResults = results.filter((result) => result.exam);

  //     // Check if all subjects have submitted marks
  //     const submittedSubjectIds = [...new Set(validResults.map((r) => r.subject._id.toString()))];
  //     const allSubjectIds = subjects.map((s) => s._id.toString());
  //     const missingSubjectIds = allSubjectIds.filter((id) => !submittedSubjectIds.includes(id));
  //     const missingSubjects = subjects
  //       .filter((s) => missingSubjectIds.includes(s._id.toString()))
  //       .map((s) => s.name);

  //     if (submittedSubjectIds.length !== subjects.length) {
  //       logger.warn(`Missing marks for subjects: ${missingSubjects.join(", ")}`, {
  //         classId,
  //         examType,
  //         missingSubjectIds,
  //       });
  //       return res.status(400).json({
  //         message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${submittedSubjectIds.length}. Missing subjects: ${missingSubjects.join(", ")}`,
  //       });
  //     }

  //     // Get students
  //     const students = await User.find({ _id: { $in: classInfo.students } })
  //       .select("name rollNumber")
  //       .lean();

  //     // Compile results, handling multiple exams per subject
  //     const compiledResults = students.map((student) => {
  //       const studentResult = {
  //         studentId: student._id,
  //         name: student.name,
  //         rollNumber: student.rollNumber,
  //         subjects: {},
  //         totalMarks: 0,
  //         percentage: 0,
  //       };

  //       subjects.forEach((subject) => {
  //         // Find the first result for this student and subject
  //         const result = validResults.find(
  //           (r) =>
  //             r.student._id.toString() === student._id.toString() &&
  //             r.subject._id.toString() === subject._id.toString()
  //         );
  //         studentResult.subjects[subject.name] = result ? result.marksObtained : 0;
  //         studentResult.totalMarks += result ? result.marksObtained : 0;
  //       });

  //       const maxTotalMarks = subjects.length * 100; // Assuming 100 marks per subject
  //       studentResult.percentage = (studentResult.totalMarks / maxTotalMarks) * 100;

  //       return studentResult;
  //     });

  //     // Generate Excel file
  //     const workbook = new ExcelJS.Workbook();
  //     const worksheet = workbook.addWorksheet("Exam Results");

  //     // Define columns
  //     const columns = [
  //       { header: "Roll Number", key: "rollNumber", width: 15 },
  //       { header: "Student Name", key: "name", width: 30 },
  //       ...subjects.map((subject) => ({
  //         header: subject.name,
  //         key: subject.name,
  //         width: 15,
  //       })),
  //       { header: "Total Marks", key: "totalMarks", width: 15 },
  //       { header: "Percentage", key: "percentage", width: 15 },
  //     ];
  //     worksheet.columns = columns;

  //     // Add data
  //     compiledResults.forEach((result) => {
  //       const row = {
  //         rollNumber: result.rollNumber,
  //         name: result.name,
  //         totalMarks: result.totalMarks,
  //         percentage: result.percentage.toFixed(2),
  //       };
  //       subjects.forEach((subject) => {
  //         row[subject.name] = result.subjects[subject.name] || 0;
  //       });
  //       worksheet.addRow(row);
  //     });

  //     // Style the header
  //     worksheet.getRow(1).eachCell((cell) => {
  //       cell.font = { bold: true };
  //       cell.fill = {
  //         type: "pattern",
  //         pattern: "solid",
  //         fgColor: { argb: "FFCCCCCC" },
  //       };
  //       cell.alignment = { vertical: "middle", horizontal: "center" };
  //     });

  //     // Save Excel file to buffer
  //     const buffer = await workbook.xlsx.writeBuffer();

  //     // Upload to S3
  //     const fileKey = `results/${schoolId}/${classId}/${examType}_${Date.now()}.xlsx`;
  //     await uploadToS3(buffer, fileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  //     // Update results with Excel file reference
  //     const session = await connection.startSession();
  //     session.startTransaction();

  //     try {
  //       await Result.updateMany(
  //         {
  //           school: schoolId,
  //           class: classId,
  //           status: "submittedToClassTeacher",
  //           exam: { $in: validResults.map((r) => r.exam._id) },
  //         },
  //         {
  //           $set: {
  //             status: "compiled",
  //             excelFile: {
  //               key: fileKey,
  //               url: getPublicFileUrl(fileKey),
  //               originalName: `${examType}_Results.xlsx`,
  //             },
  //             compiledBy: teacherId,
  //             compiledAt: new Date(),
  //           },
  //         },
  //         { session }
  //       );

  //       await session.commitTransaction();

  //       res.json({
  //         message: "Results compiled successfully. Please review the Excel file before submitting to admin.",
  //         class: `${classInfo.name}${classInfo.division ? " " + classInfo.division : ""}`,
  //         examType,
  //         excelFileUrl: getPublicFileUrl(fileKey),
  //         results: compiledResults,
  //       });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     logger.error(`Error in compileAndSubmitResults: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  // compileAndSubmitResults: async (req, res) => {
  //   try {
  //     const { classId, examType } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const Subject = getModel("Subject", connection);
  //     const User = getModel("User", connection);
  //     const Result = getModel("Result", connection);
  //     const ExamEvent = getModel("ExamEvent", connection);
  
  //     // Verify class teacher role
  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: "Not authorized as class teacher" });
  //     }
  
  //     // Get all subjects for the class
  //     const subjects = await Subject.find({ class: classId }).lean();
  
  //     // Get all results for the class and exam type with status submittedToClassTeacher
  //     const results = await Result.find({
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToClassTeacher",
  //     })
  //       .populate({
  //         path: "exam",
  //         match: { examType: { $regex: `^${examType}$`, $options: "i" } },
  //         select: "examType totalMarks subject examEvent",
  //       })
  //       .populate("subject", "name")
  //       .populate("student", "name rollNumber studentDetails.grNumber")
  //       .populate("examEvent", "name")
  //       .lean();
  
  //     // Filter out results where exam is null (wrong examType or missing exam)
  //     const validResults = results.filter((result) => result.exam);
  
  //     // Get any exam event ID to fetch additional info if needed
  //     const examEventId = validResults.length > 0 ? validResults[0].examEvent?._id : null;
  //     let examEventInfo = null;
  //     if (examEventId) {
  //       examEventInfo = await ExamEvent.findById(examEventId).lean();
  //     }
  
  //     // Check if all subjects have submitted marks
  //     const submittedSubjectIds = [...new Set(validResults.map((r) => r.subject._id.toString()))];
  //     const allSubjectIds = subjects.map((s) => s._id.toString());
  //     const missingSubjectIds = allSubjectIds.filter((id) => !submittedSubjectIds.includes(id));
  //     const missingSubjects = subjects
  //       .filter((s) => missingSubjectIds.includes(s._id.toString()))
  //       .map((s) => s.name);
  
  //     // if (submittedSubjectIds.length !== subjects.length) {
  //     //   return res.status(400).json({
  //     //     message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${submittedSubjectIds.length}. Missing subjects: ${missingSubjects.join(", ")}`,
  //     //   });
  //     // }
  
  //     // Get students with all necessary details for marksheet generation
  //     const students = await User.find({ _id: { $in: classInfo.students } })
  //       .select("name rollNumber studentDetails.grNumber studentDetails.dob studentDetails.gender studentDetails.admissionType")
  //       .lean();
  
  //     // Compile results, handling multiple exams per subject
  //     const compiledResults = students.map((student) => {
  //       const studentResult = {
  //         studentId: student._id,
  //         name: student.name,
  //         rollNumber: student.rollNumber,
  //         grNumber: student.studentDetails?.grNumber || "",
  //         dob: student.studentDetails?.dob || "",
  //         gender: student.studentDetails?.gender || "",
  //         admissionType: student.studentDetails?.admissionType || "Regular",
  //         subjects: {},
  //         totalMarks: 0,
  //         totalMaxMarks: 0,
  //         percentage: 0,
  //       };
  
  //       subjects.forEach((subject) => {
  //         // Find the first result for this student and subject
  //         const result = validResults.find(
  //           (r) =>
  //             r.student._id.toString() === student._id.toString() &&
  //             r.subject._id.toString() === subject._id.toString()
  //         );
          
  //         if (result) {
  //           studentResult.subjects[subject.name] = {
  //             obtained: result.marksObtained,
  //             total: result.totalMarks,
  //             remarks: result.remarks || ""
  //           };
  //           studentResult.totalMarks += result.marksObtained;
  //           studentResult.totalMaxMarks += result.totalMarks;
  //         } else {
  //           studentResult.subjects[subject.name] = {
  //             obtained: 0,
  //             total: 100, // Default total marks
  //             remarks: "Absent"
  //           };
  //           studentResult.totalMaxMarks += 100; // Default total marks
  //         }
  //       });
  
  //       studentResult.percentage = studentResult.totalMaxMarks > 0 
  //         ? (studentResult.totalMarks / studentResult.totalMaxMarks) * 100 
  //         : 0;
  
  //       // Calculate grade based on percentage (you can adjust the grading scale)
  //       studentResult.grade = calculateGrade(studentResult.percentage);
  
  //       return studentResult;
  //     });
  
  //     // Generate Excel file
  //     const workbook = new ExcelJS.Workbook();
  //     const worksheet = workbook.addWorksheet("Exam Results");
  
  //     // Add header with exam details
  //     worksheet.mergeCells('A1:F1');
  //     worksheet.getCell('A1').value = 'EXAM RESULTS';
  //     worksheet.getCell('A1').font = { bold: true, size: 14 };
  //     worksheet.getCell('A1').alignment = { horizontal: 'center' };
  
  //     // Add exam metadata
  //     worksheet.mergeCells('A2:C2');
  //     worksheet.getCell('A2').value = `Class: ${classInfo.name}${classInfo.division ? " " + classInfo.division : ""}`;
  //     worksheet.getCell('A2').font = { bold: true };
  
  //     worksheet.mergeCells('D2:F2');
  //     worksheet.getCell('D2').value = `Exam Type: ${examType}`;
  //     worksheet.getCell('D2').font = { bold: true };
  
  //     if (examEventInfo) {
  //       worksheet.mergeCells('A3:C3');
  //       worksheet.getCell('A3').value = `Exam Event: ${examEventInfo.name || ""}`;
  //       worksheet.getCell('A3').font = { bold: true };
  //     }
  
  //     // Add empty row
  //     worksheet.addRow([]);
  
  //     // Define columns
  //     const columns = [
  //       { header: "GR Number", key: "grNumber", width: 15 },
  //       { header: "Roll Number", key: "rollNumber", width: 15 },
  //       { header: "Student Name", key: "name", width: 30 },
  //       { header: "DOB", key: "dob", width: 15 },
  //       { header: "Gender", key: "gender", width: 10 },
  //       { header: "Admission Type", key: "admissionType", width: 15 },
  //     ];
  
  //     // Add subject columns
  //     subjects.forEach((subject) => {
  //       columns.push({ 
  //         header: `${subject.name} (Marks)`, 
  //         key: `${subject.name}_marks`, 
  //         width: 15 
  //       });
  //       columns.push({ 
  //         header: `${subject.name} (Total)`, 
  //         key: `${subject.name}_total`, 
  //         width: 15 
  //       });
  //       columns.push({ 
  //         header: `${subject.name} (Remarks)`, 
  //         key: `${subject.name}_remarks`, 
  //         width: 20 
  //       });
  //     });
  
  //     // Add summary columns
  //     columns.push(
  //       { header: "Total Marks", key: "totalMarks", width: 15 },
  //       { header: "Max Marks", key: "totalMaxMarks", width: 15 },
  //       { header: "Percentage", key: "percentage", width: 15 },
  //       { header: "Grade", key: "grade", width: 10 }
  //     );
  
  //     worksheet.columns = columns;
  
  //     // Add data rows
  //     compiledResults.forEach((result) => {
  //       const row = {
  //         grNumber: result.grNumber,
  //         rollNumber: result.rollNumber,
  //         name: result.name,
  //         dob: result.dob instanceof Date ? result.dob.toISOString().split('T')[0] : result.dob,
  //         gender: result.gender,
  //         admissionType: result.admissionType,
  //         totalMarks: result.totalMarks,
  //         totalMaxMarks: result.totalMaxMarks,
  //         percentage: result.percentage.toFixed(2),
  //         grade: result.grade
  //       };
  
  //       // Add subject data
  //       subjects.forEach((subject) => {
  //         const subjectData = result.subjects[subject.name] || { obtained: 0, total: 0, remarks: "" };
  //         row[`${subject.name}_marks`] = subjectData.obtained;
  //         row[`${subject.name}_total`] = subjectData.total;
  //         row[`${subject.name}_remarks`] = subjectData.remarks;
  //       });
  
  //       worksheet.addRow(row);
  //     });
  
  //     // Style the header rows
  //     const headerRowIndex = 5; // Adjusted for the metadata rows
  //     worksheet.getRow(headerRowIndex).eachCell((cell) => {
  //       cell.font = { bold: true };
  //       cell.fill = {
  //         type: "pattern",
  //         pattern: "solid",
  //         fgColor: { argb: "FFCCCCCC" },
  //       };
  //       cell.alignment = { vertical: "middle", horizontal: "center" };
  //       cell.border = {
  //         top: { style: 'thin' },
  //         left: { style: 'thin' },
  //         bottom: { style: 'thin' },
  //         right: { style: 'thin' }
  //       };
  //     });
  
  //     // Style data cells
  //     for (let i = headerRowIndex + 1; i <= headerRowIndex + compiledResults.length; i++) {
  //       worksheet.getRow(i).eachCell((cell) => {
  //         cell.border = {
  //           top: { style: 'thin' },
  //           left: { style: 'thin' },
  //           bottom: { style: 'thin' },
  //           right: { style: 'thin' }
  //         };
  //         cell.alignment = { vertical: "middle", horizontal: "center" };
  //       });
  //     }
  
  //     // Save Excel file to buffer
  //     const buffer = await workbook.xlsx.writeBuffer();
  
  //     // Upload to S3
  //     const fileKey = `results/${schoolId}/${classId}/${examType}_${Date.now()}.xlsx`;
  //     await uploadToS3(buffer, fileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  
  //     // Update results with Excel file reference
  //     const session = await connection.startSession();
  //     session.startTransaction();
  
  //     try {
  //       await Result.updateMany(
  //         {
  //           school: schoolId,
  //           class: classId,
  //           status: "submittedToClassTeacher",
  //           exam: { $in: validResults.map((r) => r.exam._id) },
  //         },
  //         {
  //           $set: {
  //             status: "compiled",
  //             excelFile: {
  //               key: fileKey,
  //               url: getPublicFileUrl(fileKey),
  //               originalName: `${examType}_Results.xlsx`,
  //             },
  //             compiledBy: teacherId,
  //             compiledAt: new Date(),
  //           },
  //         },
  //         { session }
  //       );
  
  //       await session.commitTransaction();
  
  //       res.json({
  //         message: "Results compiled successfully. Please review the Excel file before submitting to admin.",
  //         class: `${classInfo.name}${classInfo.division ? " " + classInfo.division : ""}`,
  //         examType,
  //         excelFileUrl: getPublicFileUrl(fileKey),
  //         results: compiledResults,
  //       });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     logger.error(`Error in compileAndSubmitResults: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  // compileAndSubmitResults: async (req, res) => {
  //   try {
  //     const { classId, examType } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const Subject = getModel("Subject", connection);
  //     const User = getModel("User", connection);
  //     const Result = getModel("Result", connection);
  //     const ExamEvent = getModel("ExamEvent", connection);
  //     const School = getModel("School", connection);
  
  //     // Get school details for the header
  //     // const schoolInfo = await School.findById(schoolId).select("name address logo").lean();
  
  //     // Verify class teacher role
  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: "Not authorized as class teacher" });
  //     }
  
  //     // Get all subjects for the class
  //     const subjects = await Subject.find({ class: classId }).lean();
  
  //     // Get all results for the class and exam type with status submittedToClassTeacher
  //     const results = await Result.find({
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToClassTeacher",
  //     })
  //       .populate({
  //         path: "exam",
  //         match: { examType: { $regex: `^${examType}$`, $options: "i" } },
  //         select: "examType totalMarks subject examEvent",
  //       })
  //       .populate("subject", "name")
  //       .populate("student", "name rollNumber studentDetails")
  //       .populate("examEvent", "name startDate endDate")
  //       .lean();
  
  //     // Filter out results where exam is null
  //     const validResults = results.filter((result) => result.exam);
  
  //     // Get exam event details
  //     const examEventId = validResults.length > 0 ? validResults[0].exam.examEvent : null;
  //     let examEventInfo = null;
  //     if (examEventId) {
  //       examEventInfo = await ExamEvent.findById(examEventId).lean();
  //     }
  
  //     // Check if all subjects have submitted marks
  //     const submittedSubjectIds = [...new Set(validResults.map((r) => r.subject._id.toString()))];
  //     const allSubjectIds = subjects.map((s) => s._id.toString());
  //     const missingSubjectIds = allSubjectIds.filter((id) => !submittedSubjectIds.includes(id));
  //     const missingSubjects = subjects
  //       .filter((s) => missingSubjectIds.includes(s._id.toString()))
  //       .map((s) => s.name);
  
  //     // if (submittedSubjectIds.length !== subjects.length) {
  //     //   return res.status(400).json({
  //     //     message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${submittedSubjectIds.length}. Missing subjects: ${missingSubjects.join(", ")}`,
  //     //   });
  //     // }
  
  //     // Get students with all necessary details
  //     const students = await User.find({ _id: { $in: classInfo.students } })
  //       .select("name rollNumber studentDetails")
  //       .lean();
  
  //     // Compile results
  //     const compiledResults = students.map((student) => {
  //       const studentResult = {
  //         studentId: student._id,
  //         name: student.name,
  //         rollNumber: student.rollNumber,
  //         grNumber: student.studentDetails?.grNumber || "",
  //         dob: student.studentDetails?.dob || "",
  //         gender: student.studentDetails?.gender || "",
  //         admissionType: student.studentDetails?.admissionType || "Regular",
  //         subjects: {},
  //         totalMarks: 0,
  //         totalMaxMarks: 0,
  //         percentage: 0,
  //       };
  
  //       subjects.forEach((subject) => {
  //         // Find the result for this student and subject
  //         const result = validResults.find(
  //           (r) =>
  //             r.student._id.toString() === student._id.toString() &&
  //             r.subject._id.toString() === subject._id.toString()
  //         );
          
  //         if (result) {
  //           studentResult.subjects[subject.name] = {
  //             obtained: result.marksObtained,
  //             total: result.totalMarks,
  //             remarks: result.remarks || ""
  //           };
  //           studentResult.totalMarks += result.marksObtained;
  //           studentResult.totalMaxMarks += result.totalMarks;
  //         } else {
  //           studentResult.subjects[subject.name] = {
  //             obtained: 0,
  //             total: 100,
  //             remarks: "Absent"
  //           };
  //           studentResult.totalMaxMarks += 100;
  //         }
  //       });
  
  //       studentResult.percentage = studentResult.totalMaxMarks > 0 
  //         ? (studentResult.totalMarks / studentResult.totalMaxMarks) * 100 
  //         : 0;
  
  //       studentResult.grade = calculateGrade(studentResult.percentage);
  //       studentResult.result = studentResult.percentage >= 40 ? "PASS" : "FAIL";
  
  //       return studentResult;
  //     });
  
  //     // Generate Excel file
  //     const workbook = new ExcelJS.Workbook();
      
  //     // Add metadata
  //     workbook.creator = 'School Management System';
  //     workbook.lastModifiedBy = 'Class Teacher';
  //     workbook.created = new Date();
  //     workbook.modified = new Date();
      
  //     // Create worksheet with proper name
  //     const className = `${classInfo.name}${classInfo.division ? classInfo.division : ""}`;
  //     const sheetName = `${className}_${examType}`.replace(/[*?:/\\[\]]/g, '_').substring(0, 31);
  //     const worksheet = workbook.addWorksheet(sheetName, {
  //       properties: {
  //         tabColor: { argb: '6495ED' }
  //       },
  //       pageSetup: {
  //         paperSize: 9, // A4
  //         orientation: 'landscape',
  //         fitToPage: true
  //       }
  //     });
  
  //     // ===== HEADER SECTION =====
      
  //     // School name (row 1)
  //     // worksheet.mergeCells('A1:K1');
  //     // const schoolNameCell = worksheet.getCell('A1');
  //     // // schoolNameCell.value = schoolInfo?.name || "SCHOOL NAME";
  //     // schoolNameCell.font = { bold: true, size: 16 };
  //     // schoolNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  //     // worksheet.getRow(1).height = 25;
      
  //     // // School address (row 2)
  //     // worksheet.mergeCells('A2:K2');
  //     // const schoolAddressCell = worksheet.getCell('A2');
  //     // // schoolAddressCell.value = schoolInfo?.address || "";
  //     // schoolAddressCell.font = { size: 10 };
  //     // schoolAddressCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
  //     // Title (row 3)
  //     worksheet.mergeCells('A3:K3');
  //     const titleCell = worksheet.getCell('A3');
  //     titleCell.value = `${examType.toUpperCase()} EXAMINATION RESULT ${examEventInfo?.name ? `- ${examEventInfo.name}` : ''}`;
  //     titleCell.font = { bold: true, size: 14 };
  //     titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  //     titleCell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: 'E0E0E0' }
  //     };
  //     worksheet.getRow(3).height = 22;
      
  //     // Separator
  //     worksheet.addRow([]);
      
  //     // Class info (row 5)
  //     const classRow = worksheet.addRow([
  //       'Class & Section:',
  //       className,
  //       '',
  //       'Academic Year:',
  //       examEventInfo?.startDate ? new Date(examEventInfo.startDate).getFullYear() : new Date().getFullYear()
  //     ]);
  //     classRow.font = { bold: true };
  //     classRow.height = 20;
      
  //     // Blank row
  //     worksheet.addRow([]);
      
  //     // ===== STUDENT DATA SECTION =====
      
  //     // Header row for student data
  //     const headerRow = worksheet.addRow([
  //       'GR No.',
  //       'Student Name',
  //       'Gender',
  //       'Admission Type'
  //     ]);
      
  //     // Add subject headers
  //     subjects.forEach(subject => {
  //       headerRow.getCell(headerRow.cellCount + 1).value = subject.name;
  //     });
      
  //     // Add summary columns
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Total';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Max Marks';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Percentage';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Grade';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Result';
      
  //     // Style the header row
  //     headerRow.eachCell((cell) => {
  //       cell.font = { bold: true, color: { argb: 'FFFFFF' } };
  //       cell.fill = {
  //         type: 'pattern',
  //         pattern: 'solid',
  //         fgColor: { argb: '4472C4' }
  //       };
  //       cell.alignment = { horizontal: 'center', vertical: 'middle' };
  //       cell.border = {
  //         top: { style: 'thin' },
  //         left: { style: 'thin' },
  //         bottom: { style: 'thin' },
  //         right: { style: 'thin' }
  //       };
  //     });
  //     headerRow.height = 20;
      
  //     // Format columns
  //     const columnCount = headerRow.cellCount;
  //     for (let i = 1; i <= columnCount; i++) {
  //       const col = worksheet.getColumn(i);
  //       if (i === 3) { // Student Name
  //         col.width = 30;
  //       } else if (i >= 6 && i < 6 + subjects.length) { // Subject marks
  //         col.width = 15;
  //       } else {
  //         col.width = 12;
  //       }
  //       col.alignment = { horizontal: 'center', vertical: 'middle' };
  //     }
      
  //     // Add student data rows
  //     compiledResults.forEach((result, index) => {
  //       const dataRow = worksheet.addRow([
  //         result.grNumber,
  //         // result.rollNumber,
  //         result.name,
  //         result.gender,
  //         result.admissionType
  //       ]);
        
  //       // Add subject marks
  //       subjects.forEach((subject) => {
  //         const subjectData = result.subjects[subject.name];
  //         dataRow.getCell(dataRow.cellCount + 1).value = subjectData.obtained;
  //       });
        
  //       // Add summary data
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.totalMarks;
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.totalMaxMarks;
  //       dataRow.getCell(dataRow.cellCount + 1).value = parseFloat(result.percentage.toFixed(2));
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.grade;
        
  //       const resultCell = dataRow.getCell(dataRow.cellCount + 1);
  //       resultCell.value = result.result;
        
  //       // Apply alternating row background colors
  //       if (index % 2 === 1) {
  //         dataRow.eachCell((cell) => {
  //           cell.fill = {
  //             type: 'pattern',
  //             pattern: 'solid',
  //             fgColor: { argb: 'F2F2F2' }
  //           };
  //         });
  //       }
        
  //       // Apply conditional formatting for passing/failing
  //       if (result.result === 'FAIL') {
  //         resultCell.font = { color: { argb: 'FF0000' }, bold: true };
  //       } else {
  //         resultCell.font = { color: { argb: '008000' }, bold: true };
  //       }
        
  //       // Add borders to all cells
  //       dataRow.eachCell((cell) => {
  //         cell.border = {
  //           top: { style: 'thin' },
  //           left: { style: 'thin' },
  //           bottom: { style: 'thin' },
  //           right: { style: 'thin' }
  //         };
  //       });
  //     });
      
  //     // ===== FOOTER SECTION =====
      
  //     // Add some empty rows
  //     worksheet.addRow([]);
  //     worksheet.addRow([]);
      
  //     // Add signature sections
  //     const signatureRow = worksheet.addRow(['', '', 'Class Teacher', '', '', '', 'Principal']);
  //     signatureRow.font = { bold: true };
  //     signatureRow.height = 30;
      
  //     // Add date of generation
  //     worksheet.mergeCells(`A${worksheet.rowCount + 2}:D${worksheet.rowCount + 2}`);
  //     worksheet.getCell(`A${worksheet.rowCount}`).value = `Generated on: ${new Date().toLocaleDateString()}`;
      
  //     // Save Excel file to buffer
  //     const buffer = await workbook.xlsx.writeBuffer();
  
  //     // Upload to S3
  //     const fileKey = `results/${schoolId}/${classId}/${examType}_${Date.now()}.xlsx`;
  //     await uploadToS3(buffer, fileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  
  //     // Update results with Excel file reference
  //     const session = await connection.startSession();
  //     session.startTransaction();
  
  //     try {
  //       await Result.updateMany(
  //         {
  //           school: schoolId,
  //           class: classId,
  //           status: "submittedToClassTeacher",
  //           exam: { $in: validResults.map((r) => r.exam._id) },
  //         },
  //         {
  //           $set: {
  //             status: "compiled",
  //             excelFile: {
  //               key: fileKey,
  //               url: getPublicFileUrl(fileKey),
  //               originalName: `${className}_${examType}_Results.xlsx`,
  //             },
  //             compiledBy: teacherId,
  //             compiledAt: new Date(),
  //           },
  //         },
  //         { session }
  //       );
  
  //       await session.commitTransaction();
  
  //       res.json({
  //         message: "Results compiled successfully. Please review the Excel file before submitting to admin.",
  //         class: className,
  //         examType,
  //         excelFileUrl: getPublicFileUrl(fileKey),
  //         results: compiledResults,
  //       });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     logger.error(`Error in compileAndSubmitResults: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  // compileAndSubmitResults: async (req, res) => {
  //   try {
  //     const { classId, examType } = req.params;
  //     const teacherId = req.user._id;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const Subject = getModel("Subject", connection);
  //     const User = getModel("User", connection);
  //     const Result = getModel("Result", connection);
  //     const ExamEvent = getModel("ExamEvent", connection);
  //     const School = getModel("School", connection);
  
  //     // Get school details for the header
  //     // const schoolInfo = await School.findById(schoolId).select("name address logo").lean();
  
  //     // Verify class teacher role
  //     const classInfo = await Class.findOne({ _id: classId, school: schoolId });
  //     if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
  //       return res.status(403).json({ message: "Not authorized as class teacher" });
  //     }
  
  //     // Get all subjects for the class
  //     const subjects = await Subject.find({ class: classId }).lean();
  
  //     // Get all results for the class and exam type with status submittedToClassTeacher
  //     const results = await Result.find({
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToClassTeacher",
  //     })
  //       .populate({
  //         path: "exam",
  //         match: { examType: { $regex: `^${examType}$`, $options: "i" } },
  //         select: "examType totalMarks subject examEvent",
  //       })
  //       .populate("subject", "name")
  //       .populate("student", "name rollNumber studentDetails")
  //       .populate("examEvent", "name startDate endDate")
  //       .lean();
  
  //     // Filter out results where exam is null
  //     const validResults = results.filter((result) => result.exam);
  
  //     // Get exam event details
  //     const examEventId = validResults.length > 0 ? validResults[0].exam.examEvent : null;
  //     let examEventInfo = null;
  //     if (examEventId) {
  //       examEventInfo = await ExamEvent.findById(examEventId).lean();
  //     }
  
  //     // Check if all subjects have submitted marks
  //     const submittedSubjectIds = [...new Set(validResults.map((r) => r.subject._id.toString()))];
  //     const allSubjectIds = subjects.map((s) => s._id.toString());
  //     const missingSubjectIds = allSubjectIds.filter((id) => !submittedSubjectIds.includes(id));
  //     const missingSubjects = subjects
  //       .filter((s) => missingSubjectIds.includes(s._id.toString()))
  //       .map((s) => s.name);
  
  //     if (submittedSubjectIds.length !== subjects.length) {
  //       return res.status(400).json({
  //         message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${submittedSubjectIds.length}. Missing subjects: ${missingSubjects.join(", ")}`,
  //       });
  //     }
  
  //     // Get students with all necessary details
  //     const students = await User.find({ _id: { $in: classInfo.students } })
  //       .select("name rollNumber studentDetails")
  //       .lean();
  
  //     // Compile results
  //     const compiledResults = students.map((student) => {
  //       const studentResult = {
  //         studentId: student._id,
  //         name: student.name,
  //         rollNumber: student.rollNumber,
  //         grNumber: student.studentDetails?.grNumber || "",
  //         dob: student.studentDetails?.dob || "",
  //         gender: student.studentDetails?.gender || "",
  //         admissionType: student.studentDetails?.admissionType || "Regular",
  //         subjects: {},
  //         totalMarks: 0,
  //         totalMaxMarks: 0,
  //         percentage: 0,
  //         failedSubjects: [] // Track failed subjects
  //       };
  
  //       subjects.forEach((subject) => {
  //         // Find the result for this student and subject
  //         const result = validResults.find(
  //           (r) =>
  //             r.student._id.toString() === student._id.toString() &&
  //             r.subject._id.toString() === subject._id.toString()
  //         );
          
  //         if (result) {
  //           const subjectPercentage = (result.marksObtained / result.totalMarks) * 100;
            
  //           studentResult.subjects[subject.name] = {
  //             obtained: result.marksObtained,
  //             total: result.totalMarks,
  //             percentage: subjectPercentage,
  //             remarks: result.remarks || ""
  //           };
            
  //           // Check if subject percentage is less than 33%
  //           if (subjectPercentage < 33) {
  //             studentResult.failedSubjects.push(subject.name);
  //             studentResult.subjects[subject.name].remarks = "Fail";
  //           }
            
  //           studentResult.totalMarks += result.marksObtained;
  //           studentResult.totalMaxMarks += result.totalMarks;
  //         } else {
  //           studentResult.subjects[subject.name] = {
  //             obtained: 0,
  //             total: 100,
  //             percentage: 0,
  //             remarks: "Absent"
  //           };
  //           studentResult.failedSubjects.push(subject.name);
  //           studentResult.totalMaxMarks += 100;
  //         }
  //       });
  
  //       studentResult.percentage = studentResult.totalMaxMarks > 0 
  //         ? (studentResult.totalMarks / studentResult.totalMaxMarks) * 100 
  //         : 0;
  
  //       studentResult.grade = calculateGrade(studentResult.percentage);
        
  //       // Student fails if overall percentage is below 40% OR if any subject has less than 33%
  //       studentResult.result = (studentResult.percentage >= 40 && studentResult.failedSubjects.length === 0) 
  //         ? "PASS" 
  //         : "FAIL";
  
  //       return studentResult;
  //     });
  
  //     // Generate Excel file
  //     const workbook = new ExcelJS.Workbook();
      
  //     // Add metadata
  //     workbook.creator = 'School Management System';
  //     workbook.lastModifiedBy = 'Class Teacher';
  //     workbook.created = new Date();
  //     workbook.modified = new Date();
      
  //     // Create worksheet with proper name
  //     const className = `${classInfo.name}${classInfo.division ? classInfo.division : ""}`;
  //     const sheetName = `${className}_${examType}`.replace(/[*?:/\\[\]]/g, '_').substring(0, 31);
  //     const worksheet = workbook.addWorksheet(sheetName, {
  //       properties: {
  //         tabColor: { argb: '6495ED' }
  //       },
  //       pageSetup: {
  //         paperSize: 9, // A4
  //         orientation: 'landscape',
  //         fitToPage: true
  //       }
  //     });
  
  //     // ===== HEADER SECTION =====
      
  //     // School name (row 1)
  //     // worksheet.mergeCells('A1:K1');
  //     // const schoolNameCell = worksheet.getCell('A1');
  //     // schoolNameCell.value = schoolInfo?.name || "SCHOOL NAME";
  //     // schoolNameCell.font = { bold: true, size: 16 };
  //     // schoolNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
  //     // worksheet.getRow(1).height = 25;
      
  //     // // School address (row 2)
  //     // worksheet.mergeCells('A2:K2');
  //     // const schoolAddressCell = worksheet.getCell('A2');
  //     // schoolAddressCell.value = schoolInfo?.address || "";
  //     // schoolAddressCell.font = { size: 10 };
  //     // schoolAddressCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
  //     // Title (row 3)
  //     worksheet.mergeCells('A3:K3');
  //     const titleCell = worksheet.getCell('A3');
  //     titleCell.value = `${examType.toUpperCase()} EXAMINATION RESULT ${examEventInfo?.name ? `- ${examEventInfo.name}` : ''}`;
  //     titleCell.font = { bold: true, size: 14 };
  //     titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  //     titleCell.fill = {
  //       type: 'pattern',
  //       pattern: 'solid',
  //       fgColor: { argb: 'E0E0E0' }
  //     };
  //     worksheet.getRow(3).height = 22;
      
  //     // Separator
  //     worksheet.addRow([]);
      
  //     // Class info (row 5)
  //     const classRow = worksheet.addRow([
  //       'Class & Section:',
  //       className,
  //       '',
  //       'Academic Year:',
  //       examEventInfo?.startDate ? new Date(examEventInfo.startDate).getFullYear() : new Date().getFullYear()
  //     ]);
  //     classRow.font = { bold: true };
  //     classRow.height = 20;
      
  //     // Blank row
  //     worksheet.addRow([]);
      
  //     // ===== STUDENT DATA SECTION =====
      
  //     // Header row for student data
  //     const headerRow = worksheet.addRow([
  //       'GR No.',
  //       // 'Roll No.',
  //       'Student Name',
  //       'Gender',
  //       'Admission Type'
  //     ]);
      
  //     // Add subject headers
  //     subjects.forEach(subject => {
  //       headerRow.getCell(headerRow.cellCount + 1).value = subject.name;
  //     });
      
  //     // Add summary columns
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Total';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Max Marks';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Percentage';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Grade';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Result';
  //     headerRow.getCell(headerRow.cellCount + 1).value = 'Failed Subjects';
      
  //     // Style the header row
  //     headerRow.eachCell((cell) => {
  //       cell.font = { bold: true, color: { argb: 'FFFFFF' } };
  //       cell.fill = {
  //         type: 'pattern',
  //         pattern: 'solid',
  //         fgColor: { argb: '4472C4' }
  //       };
  //       cell.alignment = { horizontal: 'center', vertical: 'middle' };
  //       cell.border = {
  //         top: { style: 'thin' },
  //         left: { style: 'thin' },
  //         bottom: { style: 'thin' },
  //         right: { style: 'thin' }
  //       };
  //     });
  //     headerRow.height = 20;
      
  //     // Format columns
  //     const columnCount = headerRow.cellCount;
  //     for (let i = 1; i <= columnCount; i++) {
  //       const col = worksheet.getColumn(i);
  //       if (i === 3) { // Student Name
  //         col.width = 30;
  //       } else if (i >= 6 && i < 6 + subjects.length) { // Subject marks
  //         col.width = 15;
  //       } else if (i === columnCount) { // Failed Subjects
  //         col.width = 25;
  //       } else {
  //         col.width = 12;
  //       }
  //       col.alignment = { horizontal: 'center', vertical: 'middle' };
  //     }
      
  //     // Add student data rows
  //     compiledResults.forEach((result, index) => {
  //       const dataRow = worksheet.addRow([
  //         result.grNumber,
  //         // result.rollNumber,
  //         result.name,
  //         result.gender,
  //         result.admissionType
  //       ]);
        
  //       // Add subject marks
  //       subjects.forEach((subject) => {
  //         const subjectData = result.subjects[subject.name];
  //         const subjectCell = dataRow.getCell(dataRow.cellCount + 1);
  //         subjectCell.value = subjectData.obtained;
          
  //         // Highlight failed subjects
  //         if (result.failedSubjects.includes(subject.name)) {
  //           subjectCell.font = { color: { argb: 'FF0000' }, bold: true };
  //         }
  //       });
        
  //       // Add summary data
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.totalMarks;
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.totalMaxMarks;
  //       dataRow.getCell(dataRow.cellCount + 1).value = parseFloat(result.percentage.toFixed(2));
  //       dataRow.getCell(dataRow.cellCount + 1).value = result.grade;
        
  //       const resultCell = dataRow.getCell(dataRow.cellCount + 1);
  //       resultCell.value = result.result;
        
  //       // Add failed subjects list
  //       const failedSubjectsCell = dataRow.getCell(dataRow.cellCount + 1);
  //       failedSubjectsCell.value = result.failedSubjects.join(", ");
        
  //       // Apply alternating row background colors
  //       if (index % 2 === 1) {
  //         dataRow.eachCell((cell) => {
  //           cell.fill = {
  //             type: 'pattern',
  //             pattern: 'solid',
  //             fgColor: { argb: 'F2F2F2' }
  //           };
  //         });
  //       }
        
  //       // Apply conditional formatting for passing/failing
  //       if (result.result === 'FAIL') {
  //         resultCell.font = { color: { argb: 'FF0000' }, bold: true };
  //         failedSubjectsCell.font = { color: { argb: 'FF0000' } };
  //       } else {
  //         resultCell.font = { color: { argb: '008000' }, bold: true };
  //       }
        
  //       // Add borders to all cells
  //       dataRow.eachCell((cell) => {
  //         cell.border = {
  //           top: { style: 'thin' },
  //           left: { style: 'thin' },
  //           bottom: { style: 'thin' },
  //           right: { style: 'thin' }
  //         };
  //       });
  //     });
      
  //     // ===== FOOTER SECTION =====
      
  //     // Add some empty rows
  //     worksheet.addRow([]);
  //     worksheet.addRow([]);
      
  //     // Add passing criteria information
  //     const passingCriteriaRow = worksheet.addRow(['', '', 'Passing Criteria: Overall 40% and at least 33% in each subject']);
  //     passingCriteriaRow.font = { italic: true };
      
  //     // Add signature sections
  //     const signatureRow = worksheet.addRow(['', '', 'Class Teacher', '', '', '', 'Principal']);
  //     signatureRow.font = { bold: true };
  //     signatureRow.height = 30;
      
  //     // Add date of generation
  //     worksheet.mergeCells(`A${worksheet.rowCount + 2}:D${worksheet.rowCount + 2}`);
  //     worksheet.getCell(`A${worksheet.rowCount}`).value = `Generated on: ${new Date().toLocaleDateString()}`;
      
  //     // Save Excel file to buffer
  //     const buffer = await workbook.xlsx.writeBuffer();
  
  //     // Upload to S3
  //     const fileKey = `results/${schoolId}/${classId}/${examType}_${Date.now()}.xlsx`;
  //     await uploadToS3(buffer, fileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  
  //     // Update results with Excel file reference
  //     const session = await connection.startSession();
  //     session.startTransaction();
  
  //     try {
  //       await Result.updateMany(
  //         {
  //           school: schoolId,
  //           class: classId,
  //           status: "submittedToClassTeacher",
  //           exam: { $in: validResults.map((r) => r.exam._id) },
  //         },
  //         {
  //           $set: {
  //             status: "compiled",
  //             excelFile: {
  //               key: fileKey,
  //               url: getPublicFileUrl(fileKey),
  //               originalName: `${className}_${examType}_Results.xlsx`,
  //             },
  //             compiledBy: teacherId,
  //             compiledAt: new Date(),
  //           },
  //         },
  //         { session }
  //       );
  
  //       await session.commitTransaction();
  
  //       res.json({
  //         message: "Results compiled successfully. Please review the Excel file before submitting to admin.",
  //         class: className,
  //         examType,
  //         excelFileUrl: getPublicFileUrl(fileKey),
  //         results: compiledResults,
  //       });
  //     } catch (error) {
  //       await session.abortTransaction();
  //       throw error;
  //     } finally {
  //       session.endSession();
  //     }
  //   } catch (error) {
  //     logger.error(`Error in compileAndSubmitResults: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


  compileAndSubmitResults: async (req, res) => {
    try {
      const { classId, examType } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);
      const User = getModel("User", connection);
      const Result = getModel("Result", connection);
      const ExamEvent = getModel("ExamEvent", connection);

      // Use owner_db connection for School model
      const ownerConnection = getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);

      // Debug logging
      console.log('Fetching school with schoolId:', schoolId);
      console.log('Owner connection name:', ownerConnection.name);

      // Get school details for the header
      const schoolInfo = await School.findById(schoolId).select("name address logo").lean();
      if (!schoolInfo) {
        console.error('School not found for schoolId:', schoolId);
        return res.status(404).json({ message: "School not found" });
      }
      console.log('School found:', schoolInfo);

      // Verify class teacher role
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized as class teacher" });
      }

      // Get all subjects for the class
      const subjects = await Subject.find({ class: classId }).lean();

      // Get all results for the class and exam type with status submittedToClassTeacher
      const results = await Result.find({
        school: schoolId,
        class: classId,
        status: "submittedToClassTeacher",
      })
        .populate({
          path: "exam",
          match: { examType: { $regex: `^${examType}$`, $options: "i" } },
          select: "examType totalMarks subject examEvent",
        })
        .populate("subject", "name")
        .populate("student", "name rollNumber studentDetails")
        .populate("examEvent", "name startDate endDate")
        .lean();

      // Filter out results where exam is null
      const validResults = results.filter((result) => result.exam);

      // Get exam event details
      const examEventId = validResults.length > 0 ? validResults[0].exam.examEvent : null;
      let examEventInfo = null;
      if (examEventId) {
        examEventInfo = await ExamEvent.findById(examEventId).lean();
      }

      // Check if all subjects have submitted marks
      const submittedSubjectIds = [...new Set(validResults.map((r) => r.subject._id.toString()))];
      const allSubjectIds = subjects.map((s) => s._id.toString());
      const missingSubjectIds = allSubjectIds.filter((id) => !submittedSubjectIds.includes(id));
      const missingSubjects = subjects
        .filter((s) => missingSubjectIds.includes(s._id.toString()))
        .map((s) => s.name);

      if (submittedSubjectIds.length !== subjects.length) {
        return res.status(400).json({
          message: `Not all subjects have submitted marks. Expected: ${subjects.length}, Found: ${submittedSubjectIds.length}. Missing subjects: ${missingSubjects.join(", ")}`,
        });
      }

      // Get students with all necessary details
      const students = await User.find({ _id: { $in: classInfo.students } })
        .select("name rollNumber studentDetails")
        .lean();

      // Compile results
      const compiledResults = students.map((student) => {
        const studentResult = {
          studentId: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          grNumber: student.studentDetails?.grNumber || "",
          dob: student.studentDetails?.dob || "",
          gender: student.studentDetails?.gender || "",
          admissionType: student.studentDetails?.admissionType || "Regular",
          subjects: {},
          totalMarks: 0,
          totalMaxMarks: 0,
          percentage: 0,
          failedSubjects: [] // Track failed subjects
        };

        subjects.forEach((subject) => {
          // Find the result for this student and subject
          const result = validResults.find(
            (r) =>
              r.student._id.toString() === student._id.toString() &&
              r.subject._id.toString() === subject._id.toString()
          );
          
          if (result) {
            const subjectPercentage = (result.marksObtained / result.totalMarks) * 100;
            
            studentResult.subjects[subject.name] = {
              obtained: result.marksObtained,
              total: result.totalMarks,
              percentage: subjectPercentage,
              remarks: result.remarks || ""
            };
            
            // Check if subject percentage is less than 33%
            if (subjectPercentage < 33) {
              studentResult.failedSubjects.push(subject.name);
              studentResult.subjects[subject.name].remarks = "Fail";
            }
            
            studentResult.totalMarks += result.marksObtained;
            studentResult.totalMaxMarks += result.totalMarks;
          } else {
            studentResult.subjects[subject.name] = {
              obtained: 0,
              total: 100,
              percentage: 0,
              remarks: "Absent"
            };
            studentResult.failedSubjects.push(subject.name);
            studentResult.totalMaxMarks += 100;
          }
        });

        studentResult.percentage = studentResult.totalMaxMarks > 0 
          ? (studentResult.totalMarks / studentResult.totalMaxMarks) * 100 
          : 0;

        studentResult.grade = calculateGrade(studentResult.percentage);
        
        // Student fails if overall percentage is below 40% OR if any subject has less than 33%
        studentResult.result = (studentResult.percentage >= 40 && studentResult.failedSubjects.length === 0) 
          ? "PASS" 
          : "FAIL";

        return studentResult;
      });

      // Generate Excel file
      const workbook = new ExcelJS.Workbook();
      
      // Add metadata
      workbook.creator = 'School Management System';
      workbook.lastModifiedBy = 'Class Teacher';
      workbook.created = new Date();
      workbook.modified = new Date();
      
      // Create worksheet with proper name
      const className = `${classInfo.name}${classInfo.division ? classInfo.division : ""}`;
      const sheetName = `${className}_${examType}`.replace(/[*?:/\\[\]]/g, '_').substring(0, 31);
      const worksheet = workbook.addWorksheet(sheetName, {
        properties: {
          tabColor: { argb: '6495ED' }
        },
        pageSetup: {
          paperSize: 9, // A4
          orientation: 'landscape',
          fitToPage: true
        }
      });

      // ===== HEADER SECTION =====
      
      // School name (row 1)
      worksheet.mergeCells('A1:K1');
      const schoolNameCell = worksheet.getCell('A1');
      schoolNameCell.value = schoolInfo?.name || "SCHOOL NAME";
      schoolNameCell.font = { bold: true, size: 16 };
      schoolNameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 25;
      
      // School address (row 2)
      worksheet.mergeCells('A2:K2');
      const schoolAddressCell = worksheet.getCell('A2');
      schoolAddressCell.value = schoolInfo?.address || "";
      schoolAddressCell.font = { size: 10 };
      schoolAddressCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Title (row 3)
      worksheet.mergeCells('A3:K3');
      const titleCell = worksheet.getCell('A3');
      titleCell.value = `${examType.toUpperCase()} EXAMINATION RESULT ${examEventInfo?.name ? `- ${examEventInfo.name}` : ''}`;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E0E0E0' }
      };
      worksheet.getRow(3).height = 22;
      
      // Separator
      worksheet.addRow([]);
      
      // Class info (row 5)
      const classRow = worksheet.addRow([
        'Class & Section:',
        className,
        '',
        'Academic Year:',
        examEventInfo?.startDate ? new Date(examEventInfo.startDate).getFullYear() : new Date().getFullYear()
      ]);
      classRow.font = { bold: true };
      classRow.height = 20;
      
      // Blank row
      worksheet.addRow([]);
      
      // ===== STUDENT DATA SECTION =====
      
      // Header row for student data
      const headerRow = worksheet.addRow([
        'GR No.',
        // 'Roll No.',
        'Student Name',
        'Gender',
        'Admission Type'
      ]);
      
      // Add subject headers
      subjects.forEach(subject => {
        headerRow.getCell(headerRow.cellCount + 1).value = subject.name;
      });
      
      // Add summary columns
      headerRow.getCell(headerRow.cellCount + 1).value = 'Total';
      headerRow.getCell(headerRow.cellCount + 1).value = 'Max Marks';
      headerRow.getCell(headerRow.cellCount + 1).value = 'Percentage';
      headerRow.getCell(headerRow.cellCount + 1).value = 'Grade';
      headerRow.getCell(headerRow.cellCount + 1).value = 'Result';
      headerRow.getCell(headerRow.cellCount + 1).value = 'Failed Subjects';
      
      // Style the header row
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: '4472C4' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      headerRow.height = 20;
      
      // Format columns
      const columnCount = headerRow.cellCount;
      for (let i = 1; i <= columnCount; i++) {
        const col = worksheet.getColumn(i);
        if (i === 3) { // Student Name
          col.width = 30;
        } else if (i >= 6 && i < 6 + subjects.length) { // Subject marks
          col.width = 15;
        } else if (i === columnCount) { // Failed Subjects
          col.width = 25;
        } else {
          col.width = 12;
        }
        col.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      
      // Add student data rows
      compiledResults.forEach((result, index) => {
        const dataRow = worksheet.addRow([
          result.grNumber,
          // result.rollNumber,
          result.name,
          result.gender,
          result.admissionType
        ]);
        
        // Add subject marks
        subjects.forEach((subject) => {
          const subjectData = result.subjects[subject.name];
          const subjectCell = dataRow.getCell(dataRow.cellCount + 1);
          subjectCell.value = subjectData.obtained;
          
          // Highlight failed subjects
          if (result.failedSubjects.includes(subject.name)) {
            subjectCell.font = { color: { argb: 'FF0000' }, bold: true };
          }
        });
        
        // Add summary data
        dataRow.getCell(dataRow.cellCount + 1).value = result.totalMarks;
        dataRow.getCell(dataRow.cellCount + 1).value = result.totalMaxMarks;
        dataRow.getCell(dataRow.cellCount + 1).value = parseFloat(result.percentage.toFixed(2));
        dataRow.getCell(dataRow.cellCount + 1).value = result.grade;
        
        const resultCell = dataRow.getCell(dataRow.cellCount + 1);
        resultCell.value = result.result;
        
        // Add failed subjects list
        const failedSubjectsCell = dataRow.getCell(dataRow.cellCount + 1);
        failedSubjectsCell.value = result.failedSubjects.join(", ");
        
        // Apply alternating row background colors
        if (index % 2 === 1) {
          dataRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'F2F2F2' }
            };
          });
        }
        
        // Apply conditional formatting for passing/failing
        if (result.result === 'FAIL') {
          resultCell.font = { color: { argb: 'FF0000' }, bold: true };
          failedSubjectsCell.font = { color: { argb: 'FF0000' } };
        } else {
          resultCell.font = { color: { argb: '008000' }, bold: true };
        }
        
        // Add borders to all cells
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      });
      
      // ===== FOOTER SECTION =====
      
      // Add some empty rows
      worksheet.addRow([]);
      worksheet.addRow([]);
      
      // Add passing criteria information
      const passingCriteriaRow = worksheet.addRow(['', '', 'Passing Criteria: Overall 40% and at least 33% in each subject']);
      passingCriteriaRow.font = { italic: true };
      
      // Add signature sections
      const signatureRow = worksheet.addRow(['', '', 'Class Teacher', '', '', '', 'Principal']);
      signatureRow.font = { bold: true };
      signatureRow.height = 30;
      
      // Add date of generation
      worksheet.mergeCells(`A${worksheet.rowCount + 2}:D${worksheet.rowCount + 2}`);
      worksheet.getCell(`A${worksheet.rowCount}`).value = `Generated on: ${new Date().toLocaleDateString()}`;
      
      // Save Excel file to buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Upload to S3
      const fileKey = `results/${schoolId}/${classId}/${examType}_${Date.now()}.xlsx`;
      await uploadToS3(buffer, fileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

      // Update results with Excel file reference
      const session = await connection.startSession();
      session.startTransaction();

      try {
        await Result.updateMany(
          {
            school: schoolId,
            class: classId,
            status: "submittedToClassTeacher",
            exam: { $in: validResults.map((r) => r.exam._id) },
          },
          {
            $set: {
              status: "compiled",
              excelFile: {
                key: fileKey,
                url: getPublicFileUrl(fileKey),
                originalName: `${className}_${examType}_Results.xlsx`,
              },
              compiledBy: teacherId,
              compiledAt: new Date(),
            },
          },
          { session }
        );

        await session.commitTransaction();

        res.json({
          message: "Results compiled successfully. Please review the Excel file before submitting to admin.",
          class: className,
          examType,
          excelFileUrl: getPublicFileUrl(fileKey),
          results: compiledResults,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error(`Error in compileAndSubmitResults: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },
  
  getCompiledExcel: async (req, res) => {
    try {
      const { classId, examType } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Result = require("../models/Results")(connection);
      const Class = require("../models/Class")(connection);
      const Exam= require('../models/Exam')(connection)

      // Validate inputs
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: "Invalid class ID" });
      }

      // Verify class teacher role
      const classData = await Class.findOne({
        _id: classId,
        school: schoolId,
        classTeacher: teacherId,
      });
      if (!classData) {
        return res.status(403).json({ message: "Class not found or you are not authorized as class teacher" });
      }

      // Find a result with the Excel file
      const result = await Result.findOne({
        school: schoolId,
        class: classId,
        status: "compiled",
        excelFile: { $ne: null },
      })
        .populate({
          path: "exam",
          match: { examType: { $regex: `^${examType}$`, $options: "i" } },
          select: "examType",
        })
        .lean();

      if (!result || !result.exam) {
        return res.status(404).json({ message: "Compiled Excel file not found for this exam type and class" });
      }

      res.json({
        message: "Excel file retrieved successfully",
        excelFile: result.excelFile,
      });
    } catch (error) {
      logger.error(`Error fetching compiled Excel: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  submitCompiledResultsToAdmin: async (req, res) => {
    try {
      const { classId, examType } = req.params;
      const teacherId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Result = require("../models/Results")(connection);
      const Class = require("../models/Class")(connection);
      const Exam = require('../models/Exam')(connection)

      // Verify class teacher role
      const classInfo = await Class.findOne({ _id: classId, school: schoolId });
      if (!classInfo || classInfo.classTeacher.toString() !== teacherId.toString()) {
        return res.status(403).json({ message: "Not authorized as class teacher" });
      }

      // Find compiled results
      const results = await Result.find({
        school: schoolId,
        class: classId,
        status: "compiled",
      })
        .populate({
          path: "exam",
          match: { examType: { $regex: `^${examType}$`, $options: "i" } },
          select: "examType",
        })
        .lean();

      const validResults = results.filter((result) => result.exam);
      if (!validResults.length) {
        return res.status(400).json({
          message: "No compiled results found for this exam type and class",
        });
      }

      // Update result statuses
      const session = await connection.startSession();
      session.startTransaction();

      try {
        await Result.updateMany(
          {
            _id: { $in: validResults.map((r) => r._id) },
          },
          {
            $set: {
              status: "submittedToAdmin",
              submittedToAdminAt: new Date(),
              submittedToAdminBy: teacherId,
            },
          },
          { session }
        );

        await session.commitTransaction();

        res.json({
          message: "Results submitted to admin successfully",
          class: `${classInfo.name}${classInfo.division ? " " + classInfo.division : ""}`,
          examType,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      logger.error(`Error in submitCompiledResultsToAdmin: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },
};

// Helper Functions


function calculateGrade(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

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
