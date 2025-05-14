const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { cloudinary } = require("../config/cloudinary");
const getModel = require("../models/index");
const multer = require("multer");
const { uploadToS3, getPublicFileUrl, deleteFromS3 } = require("../config/s3Upload");
const streamifier = require("streamifier");
const fs = require("fs");
const { getSchoolConnection,getOwnerConnection } = require("../config/database");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const stream = require("stream");
const Exam= require('../models/Exam')
const ExamEvent= require('../models/ExamEvent')
const axios = require('axios');



const adminController = {

  getDailyWorkForAdmin: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const DailyWork = require("../models/DailyWork")(connection);

      // Fetch daily work entries with teacher details
      const dailyWorkEntries = await DailyWork.find({ school: schoolId })
        .populate("teacher", "name email") // Populate teacher name and email
        .sort({ date: -1, createdAt: -1 })
        .lean();

      res.json({
        message: "Daily work entries retrieved successfully",
        count: dailyWorkEntries.length,
        dailyWork: dailyWorkEntries.map((entry) => ({
          id: entry._id,
          teacher: {
            id: entry.teacher._id,
            name: entry.teacher.name,
            email: entry.teacher.email,
          },
          date: entry.date,
          description: entry.description,
          status: entry.status,
          createdAt: entry.createdAt,
          reviewedBy: entry.reviewedBy,
          reviewedAt: entry.reviewedAt,
          comments: entry.comments,
        })),
      });
    } catch (error) {
      console.error("Error in getDailyWorkForAdmin:", error);
      res.status(500).json({ error: error.message });
    }
  },

  
  createUser: async (req, res) => {
    try {
      const { name, email, password, role, profile } = req.body;
      if (!req.school)
        return res
          .status(400)
          .json({ error: "No school associated with this admin" });

      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser)
        return res.status(400).json({ message: "Email already registered" });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const permissions = getDefaultPermissions(role);

      const user = new User({
        school: schoolId,
        name,
        email,
        password: hashedPassword,
        role,
        profile,
        permissions,
      });

      await user.save();
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUsers: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);

      const users = await User.find({
        school: schoolId,
        role: { $ne: "student" }, // Exclude users with role 'student'
      })
        .select("-password")
        .populate("permissions.canTakeAttendance", "name division", Class)
        .populate("permissions.canEnterMarks.subject", "name")
        .populate("permissions.canEnterMarks.class", "name division", Class)
        .lean();

      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);

      const user = await User.findOne({ _id: userId, school: schoolId })
        .select("-password")
        .populate("permissions.canTakeAttendance", "name division", Class)
        .populate("permissions.canEnterMarks.subject", "name")
        .populate("permissions.canEnterMarks.class", "name division", Class)
        .lean();

      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getStudentsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Class = require("../models/Class")(connection);
      const User = require("../models/User")(connection);

      // Validate classId
      if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: "Invalid class ID" });
      }

      // Check if class exists
      const selectedClass = await Class.findOne({
        _id: classId,
        school: schoolId,
      });
      if (!selectedClass) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Fetch students enrolled in this class
      const students = await User.find({
        school: schoolId,
        "studentDetails.class": classId,
        role: "student",
      })
        .select("name email studentDetails")
        .lean();

      res.json({
        status: "success",
        class: {
          name: selectedClass.name,
          division: selectedClass.division,
          academicYear: selectedClass.academicYear,
          capacity: selectedClass.capacity,
          enrolledCount: selectedClass.students.length,
        },
        count: students.length,
        students: students.map((student) => ({
          id: student._id,
          name: student.name,
          email: student.email,
          grNumber: student.studentDetails.grNumber,
          admissionType: student.studentDetails.admissionType,
          dob: student.studentDetails.dob,
          gender: student.studentDetails.gender,
          parentDetails: student.studentDetails.parentDetails,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAvailableClasses: async (req, res) => {
    try {
      if (!req.school)
        return res
          .status(400)
          .json({ error: "No school associated with this user" });
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);

      const [availableClasses, assignedClasses] = await Promise.all([
        Class.find({
          school: schoolId,
          $or: [{ classTeacher: null }, { classTeacher: { $exists: false } }],
        })
          .select("name division academicYear")
          .sort({ name: 1, division: 1 })
          .lean(),
        Class.find({
          school: schoolId,
          classTeacher: { $exists: true, $ne: null },
        })
          .select("name division academicYear classTeacher")
          .populate("classTeacher", "name")
          .sort({ name: 1, division: 1 })
          .lean(),
      ]);

      res.json({ available: availableClasses, assigned: assignedClasses });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = getModel("Subject", connection);

      if (!classId || !schoolId)
        return res.status(400).json({ error: "Invalid classId or schoolId" });

      const subjects = await Subject.find({ school: schoolId, class: classId })
        .select("name")
        .lean();
      if (!subjects.length)
        return res.status(404).json({ error: "No subjects found" });

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  createTeacher: async (req, res) => {
    const connection = req.connection;
    if (connection.readyState !== 1) {
      return res
        .status(500)
        .json({ success: false, message: "Database connection not ready" });
    }

    const session = await connection.startSession();
    session.startTransaction();

    try {
      const {
        name,
        email,
        password,
        phone,
        address,
        photo,
        subjectAssignments,
        classTeacherOf,
      } = req.body; // Changed `teachingClass, selectedSubjects` to `subjectAssignments`
      const schoolId = req.school._id;
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);
      const TeacherAssignment = getModel("TeacherAssignment", connection);

      // Expect `subjectAssignments` as an array of { classId, subjectId }
      if (
        !subjectAssignments ||
        !Array.isArray(subjectAssignments) ||
        subjectAssignments.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Subject assignments are required",
          });
      }

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser)
        return res
          .status(400)
          .json({ success: false, message: "Email already registered" });

      // Validate subject assignments across multiple classes
      const subjectIds = subjectAssignments.map((s) => s.subjectId);
      const classIds = [...new Set(subjectAssignments.map((s) => s.classId))];
      const subjects = await Subject.find({
        _id: { $in: subjectIds },
        class: { $in: classIds },
        school: schoolId,
      }).lean();

      if (subjects.length !== subjectIds.length) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Invalid subjects for specified classes",
          });
      }

      const assignedSubjects = subjects.filter((s) => s.teachers?.length > 0);
      if (assignedSubjects.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign already assigned subjects: ${assignedSubjects
            .map((s) => s.name)
            .join(", ")}`,
          assignedSubjects: assignedSubjects.map((s) => ({
            name: s.name,
            assignedTo: s.teachers[0].teacher,
          })),
        });
      }

      if (classTeacherOf) {
        const classData = await Class.findOne({
          _id: classTeacherOf,
          school: schoolId,
        }).lean();
        if (!classData)
          return res
            .status(400)
            .json({ success: false, message: "Class not found" });
        if (classData.classTeacher)
          return res
            .status(400)
            .json({ success: false, message: "Class already has a teacher" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const permissions = {
        canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
        canEnterMarks: subjectAssignments.map(({ classId, subjectId }) => ({
          class: classId,
          subject: subjectId,
        })),
        canPublishAnnouncements: true,
        canManageInventory: false,
        canManageFees: false,
        canManageLibrary: false,
      };

      const teacher = new User({
        school: schoolId,
        name,
        email,
        password: hashedPassword,
        role: "teacher",
        profile: { phone, address, photo },
        permissions,
      });
      await teacher.save({ session });

      const teacherAssignment = new TeacherAssignment({
        school: schoolId,
        teacher: teacher._id,
        classTeacherAssignment: classTeacherOf
          ? { class: classTeacherOf, assignedAt: new Date() }
          : null,
        subjectAssignments: subjectAssignments.map(
          ({ classId, subjectId }) => ({
            class: classId,
            subject: subjectId,
            assignedAt: new Date(),
          })
        ),
        academicYear: getCurrentAcademicYear(),
      });
      await teacherAssignment.save({ session });

      if (classTeacherOf) {
        await Class.findByIdAndUpdate(
          classTeacherOf,
          {
            classTeacher: teacher._id,
            lastUpdated: new Date(),
            updatedBy: req.user._id,
          },
          { session }
        );
      }

      await Promise.all(
        subjectAssignments.map(({ subjectId }) =>
          Subject.findByIdAndUpdate(
            subjectId,
            {
              $push: {
                teachers: { teacher: teacher._id, assignedAt: new Date() },
              },
            },
            { session }
          )
        )
      );

      await session.commitTransaction();

      const populatedTeacher = await User.findById(teacher._id)
        .populate("permissions.canTakeAttendance", "name division", Class)
        .populate("permissions.canEnterMarks.subject", "name", Subject)
        .populate("permissions.canEnterMarks.class", "name division", Class)
        .lean();

      const populatedAssignment = await TeacherAssignment.findById(
        teacherAssignment._id
      )
        .populate("classTeacherAssignment.class", "name division", Class)
        .populate("subjectAssignments.class", "name division", Class)
        .populate("subjectAssignments.subject", "name", Subject)
        .lean();

      res.status(201).json({
        success: true,
        teacher: populatedTeacher,
        assignment: populatedAssignment,
        message: "Teacher created successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to create teacher",
          error: error.message,
        });
    } finally {
      session.endSession();
    }
  },

  updateTeacherAssignments: async (req, res) => {
    const connection = req.connection;
    const session = await connection.startSession();
    session.startTransaction();

    try {
      const { teacherId } = req.params;
      const {
        classTeacherOf,
        removeClassTeacherRole,
        addSubjectAssignments,
        removeSubjectAssignments,
      } = req.body;
      const schoolId = req.school._id;
      const adminId = req.user._id;

      const User = getModel("User", connection);
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);
      const TeacherAssignment = getModel("TeacherAssignment", connection);

      const teacher = await User.findOne({
        _id: teacherId,
        school: schoolId,
        role: "teacher",
      }).lean();
      if (!teacher)
        return res.status(404).json({ message: "Teacher not found" });

      let teacherAssignment = await TeacherAssignment.findOne({
        teacher: teacherId,
        school: schoolId,
      });
      if (!teacherAssignment) {
        teacherAssignment = new TeacherAssignment({
          school: schoolId,
          teacher: teacherId,
          classTeacherAssignment: null,
          subjectAssignments: [],
          academicYear: getCurrentAcademicYear(),
        });
      }

      if (classTeacherOf) {
        const newClass = await Class.findOne({
          _id: classTeacherOf,
          school: schoolId,
        }).lean();
        if (!newClass)
          return res.status(400).json({ message: "Class not found" });
        if (
          newClass.classTeacher &&
          newClass.classTeacher.toString() !== teacherId
        ) {
          return res
            .status(400)
            .json({ message: "Class already assigned to another teacher" });
        }

        if (
          teacherAssignment.classTeacherAssignment?.class?.toString() !==
          classTeacherOf
        ) {
          await Class.findByIdAndUpdate(
            teacherAssignment.classTeacherAssignment?.class,
            {
              $unset: { classTeacher: "" },
              lastUpdated: new Date(),
              updatedBy: adminId,
            },
            { session }
          );
          await User.findByIdAndUpdate(
            teacherId,
            {
              $pull: {
                "permissions.canTakeAttendance":
                  teacherAssignment.classTeacherAssignment?.class,
              },
            },
            { session }
          );
        }

        await Class.findByIdAndUpdate(
          classTeacherOf,
          {
            classTeacher: teacherId,
            lastUpdated: new Date(),
            updatedBy: adminId,
          },
          { session }
        );
        teacherAssignment.classTeacherAssignment = {
          class: classTeacherOf,
          assignedAt: new Date(),
        };
        await User.findByIdAndUpdate(
          teacherId,
          { $addToSet: { "permissions.canTakeAttendance": classTeacherOf } },
          { session }
        );
      } else if (
        removeClassTeacherRole &&
        teacherAssignment.classTeacherAssignment
      ) {
        await Class.findByIdAndUpdate(
          teacherAssignment.classTeacherAssignment.class,
          {
            $unset: { classTeacher: "" },
            lastUpdated: new Date(),
            updatedBy: adminId,
          },
          { session }
        );
        await User.findByIdAndUpdate(
          teacherId,
          {
            $pull: {
              "permissions.canTakeAttendance":
                teacherAssignment.classTeacherAssignment.class,
            },
          },
          { session }
        );
        teacherAssignment.classTeacherAssignment = null;
      }

      if (addSubjectAssignments?.length) {
        const validAssignments = await Promise.all(
          addSubjectAssignments.map(async ({ classId, subjectId }) => {
            const subject = await Subject.findOne({
              _id: subjectId,
              class: classId,
              school: schoolId,
            }).lean();
            if (!subject)
              throw new Error(
                `Invalid subject assignment: ${subjectId} for class ${classId}`
              );
            return { classId, subjectId };
          })
        );

        for (const { classId, subjectId } of validAssignments) {
          if (
            !teacherAssignment.subjectAssignments.some(
              (a) =>
                a.class.toString() === classId &&
                a.subject.toString() === subjectId
            )
          ) {
            teacherAssignment.subjectAssignments.push({
              class: classId,
              subject: subjectId,
              assignedAt: new Date(),
            });
            await Subject.findByIdAndUpdate(
              subjectId,
              {
                $addToSet: {
                  teachers: { teacher: teacherId, assignedAt: new Date() },
                },
              },
              { session }
            );
            await User.findByIdAndUpdate(
              teacherId,
              {
                $addToSet: {
                  "permissions.canEnterMarks": {
                    class: classId,
                    subject: subjectId,
                  },
                },
              },
              { session }
            );
          }
        }
      }

      if (removeSubjectAssignments?.length) {
        for (const { classId, subjectId } of removeSubjectAssignments) {
          teacherAssignment.subjectAssignments =
            teacherAssignment.subjectAssignments.filter(
              (a) =>
                !(
                  a.class.toString() === classId &&
                  a.subject.toString() === subjectId
                )
            );
          await Subject.findByIdAndUpdate(
            subjectId,
            { $pull: { teachers: { teacher: teacherId } } },
            { session }
          );
          await User.findByIdAndUpdate(
            teacherId,
            {
              $pull: {
                "permissions.canEnterMarks": {
                  class: classId,
                  subject: subjectId,
                },
              },
            },
            { session }
          );
        }
      }

      await teacherAssignment.save({ session });
      await session.commitTransaction();

      const updatedTeacher = await User.findById(teacherId)
        .populate("permissions.canTakeAttendance", "name division", Class)
        .populate("permissions.canEnterMarks.subject", "name", Subject)
        .populate("permissions.canEnterMarks.class", "name division", Class)
        .lean();

      const updatedAssignment = await TeacherAssignment.findById(
        teacherAssignment._id
      )
        .populate("classTeacherAssignment.class", "name division", Class)
        .populate("subjectAssignments.class", "name division", Class)
        .populate("subjectAssignments.subject", "name", Subject)
        .lean();

      res.json({
        teacher: updatedTeacher,
        assignment: updatedAssignment,
        message: "Teacher assignments updated successfully",
      });
    } catch (error) {
      await session.abortTransaction();
      res
        .status(500)
        .json({
          error: error.message,
          message: "Failed to update teacher assignments",
        });
    } finally {
      session.endSession();
    }
  },

  getAssignableSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = getModel("Subject", connection);
      const User = getModel("User", connection);

      if (!classId || !schoolId)
        return res.status(400).json({ error: "Invalid classId or schoolId" });

      const subjects = await Subject.find({ school: schoolId, class: classId })
        .select("name teachers")
        .populate("teachers.teacher", "name email", User)
        .lean();

      if (!subjects.length)
        return res
          .status(404)
          .json({ error: "No subjects found for this class" });

      const subjectsWithStatus = subjects.map((subject) => ({
        _id: subject._id.toString(),
        name: subject.name,
        isAssigned: subject.teachers?.length > 0,
        assignedTo:
          subject.teachers.length > 0
            ? {
                name: subject.teachers[0].teacher.name,
                email: subject.teachers[0].teacher.email,
              }
            : null,
      }));

      res.json({
        subjects: subjectsWithStatus,
        message: "Subjects retrieved successfully",
      });
    } catch (error) {
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  getAllTeacherAssignments: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const TeacherAssignment = getModel("TeacherAssignment", connection);
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);

      // Fetch all teacher assignments with populated data
      const assignments = await TeacherAssignment.find({ school: schoolId })
        .populate("teacher", "name email profile", User)
        .populate("classTeacherAssignment.class", "name division", Class)
        .populate("subjectAssignments.class", "name division", Class)
        .populate("subjectAssignments.subject", "name", Subject)
        .lean();

      // Maps to organize assignments
      const classAssignmentMap = {};
      const subjectAssignmentMap = {};
      const teacherAssignments = {}; // New map to track all teachers comprehensively

      // Process each assignment
      assignments.forEach((assignment) => {
        const teacherId = assignment.teacher._id.toString();

        // Initialize teacher entry if not already present
        if (!teacherAssignments[teacherId]) {
          teacherAssignments[teacherId] = {
            teacher: {
              id: teacherId,
              name: assignment.teacher.name,
              email: assignment.teacher.email,
            },
            classTeacher: null,
            subjectAssignments: [],
          };
        }

        // Handle class teacher assignment
        if (assignment.classTeacherAssignment?.class) {
          const classId =
            assignment.classTeacherAssignment.class._id.toString();
          classAssignmentMap[classId] = {
            teacher: {
              id: teacherId,
              name: assignment.teacher.name,
              email: assignment.teacher.email,
            },
            class: {
              id: classId,
              name: assignment.classTeacherAssignment.class.name,
              division: assignment.classTeacherAssignment.class.division,
            },
            assignedAt: assignment.classTeacherAssignment.assignedAt,
          };
          teacherAssignments[teacherId].classTeacher = {
            class: {
              id: classId,
              name: assignment.classTeacherAssignment.class.name,
              division: assignment.classTeacherAssignment.class.division,
            },
            assignedAt: assignment.classTeacherAssignment.assignedAt,
          };
        } else {
          teacherAssignments[teacherId].classTeacher = null; // Explicitly indicate no class teacher role
        }

        // Handle subject assignments
        if (assignment.subjectAssignments.length > 0) {
          assignment.subjectAssignments.forEach((subAssignment) => {
            const classId = subAssignment.class._id.toString();
            const subjectId = subAssignment.subject._id.toString();
            const key = `${classId}:${subjectId}`;

            if (!subjectAssignmentMap[key]) subjectAssignmentMap[key] = [];
            subjectAssignmentMap[key].push({
              teacher: {
                id: teacherId,
                name: assignment.teacher.name,
                email: assignment.teacher.email,
              },
              class: {
                id: classId,
                name: subAssignment.class.name,
                division: subAssignment.class.division,
              },
              subject: { id: subjectId, name: subAssignment.subject.name },
              assignedAt: subAssignment.assignedAt,
            });

            teacherAssignments[teacherId].subjectAssignments.push({
              class: {
                id: classId,
                name: subAssignment.class.name,
                division: subAssignment.class.division,
              },
              subject: { id: subjectId, name: subAssignment.subject.name },
              assignedAt: subAssignment.assignedAt,
            });
          });
        } else {
          teacherAssignments[teacherId].subjectAssignments = []; // Explicitly indicate no subject assignments
        }
      });

      // Convert teacherAssignments map to array for easier consumption
      const allTeacherAssignments = Object.values(teacherAssignments);

      res.json({
        raw: assignments, // Raw data with populated fields
        classTeachers: classAssignmentMap, // Class-based class teacher assignments
        subjectTeachers: subjectAssignmentMap, // Class-subject-based subject assignments
        teachers: allTeacherAssignments, // Comprehensive per-teacher breakdown
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTeachers: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);
      const TeacherAssignment = getModel("TeacherAssignment", connection);
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);

      const teachers = await User.find({ school: schoolId, role: "teacher" })
        .select("-password")
        .lean();
      const assignments = await TeacherAssignment.find({
        school: schoolId,
        teacher: { $in: teachers.map((t) => t._id) },
      })
        .populate("classTeacherAssignment.class", "name division", Class)
        .populate("subjectAssignments.class", "name division", Class)
        .populate("subjectAssignments.subject", "name", Subject)
        .lean();

      const currentClasses = await Class.find({
        school: schoolId,
        classTeacher: { $in: teachers.map((t) => t._id) },
      })
        .select("name division classTeacher")
        .lean();

      const currentSubjects = await Subject.find({
        school: schoolId,
        "teachers.teacher": { $in: teachers.map((t) => t._id) },
      })
        .select("name class teachers")
        .populate("class", "name division", Class)
        .lean();

      const classTeacherMap = new Map(
        currentClasses.map((c) => [c.classTeacher.toString(), c])
      );
      const subjectTeacherMap = new Map();
      currentSubjects.forEach((subject) => {
        subject.teachers.forEach((t) => {
          const key = t.teacher.toString();
          if (!subjectTeacherMap.has(key)) subjectTeacherMap.set(key, []);
          subjectTeacherMap
            .get(key)
            .push({ subject: subject.name, class: subject.class });
        });
      });

      const teachersWithAssignments = teachers.map((teacher) => {
        const teacherId = teacher._id.toString();
        const teacherAssignments = assignments.find(
          (a) => a.teacher.toString() === teacherId
        );
        return {
          ...teacher,
          assignments: {
            classTeacher: teacherAssignments?.classTeacherAssignment || null,
            subjectTeacher: teacherAssignments?.subjectAssignments || [],
          },
          currentAssignments: {
            classTeacher: classTeacherMap.get(teacherId) || null,
            subjectTeacher: subjectTeacherMap.get(teacherId) || [],
          },
        };
      });

      res.json({ success: true, data: teachersWithAssignments });
    } catch (error) {
      res
        .status(500)
        .json({
          success: false,
          error: error.message,
          message: "Failed to fetch teachers",
        });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, permissions, classId, subjects } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);

      if (role === "teacher" && (classId || subjects)) {
        req.body.teacherId = userId;
        return await adminController.assignTeacherRole(req, res);
      }

      const updatedPermissions = {
        ...getDefaultPermissions(role),
        ...permissions,
      };
      const user = await User.findByIdAndUpdate(
        userId,
        {
          role,
          permissions: updatedPermissions,
          "profile.lastRoleUpdate": new Date(),
        },
        { new: true }
      ).lean();

      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  uploadSyllabus: async (req, res) => {
    try {
      const { classId, subjectId, content } = req.body;
      const schoolId = req.school._id;
      const uploadedBy = req.user._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);
      const Syllabus = getModel("Syllabus", connection);

      // Validate class and subject
      const classExists = await Class.findOne({
        _id: classId,
        school: schoolId,
      }).lean();
      if (!classExists) {
        throw new Error("Class not found");
      }

      const subject = await Subject.findOne({
        _id: subjectId,
        class: classId,
        school: schoolId,
      }).lean();
      if (!subject) {
        throw new Error("Subject not found");
      }

      // Process uploaded files
      const documents =
        req.files?.map((file) => ({
          title: file.originalname,
          url: file.path, // Cloudinary secure_url
          public_id: file.filename, // Cloudinary public_id
          uploadedBy,
        })) || [];

      // Save or update syllabus
      let syllabus = await Syllabus.findOne({ subject: subjectId });
      if (!syllabus) {
        syllabus = new Syllabus({
          school: schoolId,
          subject: subjectId,
          class: classId,
          content,
          documents,
        });
      } else {
        syllabus.content = content || syllabus.content;
        if (documents.length > 0) {
          syllabus.documents = [...syllabus.documents, ...documents];
        }
      }

      await syllabus.save();
      await Subject.findByIdAndUpdate(subjectId, { syllabus: syllabus._id });

      res.status(201).json(syllabus);
    } catch (error) {
      // Cleanup uploaded files on error
      if (req.files?.length > 0) {
        await Promise.all(
          req.files.map((file) =>
            cloudinary.uploader
              .destroy(file.filename)
              .catch((err) => console.error("Cleanup failed:", err))
          )
        );
      }
      console.error("Syllabus upload error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  createClass: async (req, res) => {
    try {
      const { name, division, capacity, rteSeats, academicYear, schedule } =
        req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);
      const TeacherAssignment = getModel("TeacherAssignment", connection);
      const User = getModel("User", connection);

      const existingClass = await Class.findOne({
        school: schoolId,
        name,
        division,
        academicYear,
      }).lean();
      if (existingClass) {
        return res
          .status(400)
          .json({
            error: `Class ${name} division ${division} already exists for academic year ${academicYear}`,
          });
      }

      const existingTeacherAssignment = await TeacherAssignment.findOne({
        school: schoolId,
        class: null,
        assignmentType: "classTeacher",
        academicYear,
      }).lean();

      const newClass = new Class({
        school: schoolId,
        name,
        division,
        capacity,
        classTeacher: existingTeacherAssignment
          ? existingTeacherAssignment.teacher
          : null,
        rteSeats,
        academicYear,
        schedule,
      });

      await newClass.save();

      if (existingTeacherAssignment) {
        await TeacherAssignment.findByIdAndUpdate(
          existingTeacherAssignment._id,
          { class: newClass._id }
        );
        await User.findByIdAndUpdate(existingTeacherAssignment.teacher, {
          $push: { "permissions.canTakeAttendance": newClass._id },
        });
      }

      const populatedClass = await Class.findById(newClass._id)
        .populate("classTeacher", "name email profile", User)
        .lean();

      res.status(201).json(populatedClass);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getClasses: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);

      const classes = await Class.find({ school: schoolId })
        .populate("classTeacher", "name email profile", User)
        .populate("subjects", "name")
        .sort({ name: 1, division: 1 })
        .lean();

      res.json(classes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createSubject: async (req, res) => {
    try {
      const { classId, name } = req.body;
      const schoolId = req.school._id;
      const adminId = req.user._id;
      const connection = req.connection;
      const Class = getModel("Class", connection);
      const Subject = getModel("Subject", connection);

      const classExists = await Class.findOne({
        _id: classId,
        school: schoolId,
      }).lean();
      if (!classExists)
        return res.status(400).json({ message: "Invalid class selected" });

      const subject = new Subject({
        school: schoolId,
        class: classId,
        name: name || "Untitled Subject",
        teachers: [],
        createdBy: adminId,
      });

      await subject.save();
      await Class.findByIdAndUpdate(classId, {
        $push: { subjects: subject._id },
      });

      res
        .status(201)
        .json({ message: "Subject created successfully", subject });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllSubjects: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = getModel("Subject", connection);
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);
      const Syllabus = getModel("Syllabus", connection);

      const subjects = await Subject.find({ school: schoolId })
        .populate("class", "name division", Class)
        .populate("teachers.teacher", "name email", User)
        .populate("syllabus", "", Syllabus)
        .sort({ "class.name": 1, name: 1 })
        .lean();

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSyllabus: async (req, res) => {
    try {
      const { subjectId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Syllabus = getModel("Syllabus", connection);
      const Subject = getModel("Subject", connection);
      const Class = getModel("Class", connection);

      const syllabus = await Syllabus.findOne({
        subject: subjectId,
        school: schoolId,
      })
        .populate("subject", "name", Subject)
        .populate("class", "name division", Class)
        .lean();

      if (!syllabus)
        return res.status(404).json({ message: "Syllabus not found" });

      if (syllabus.documents?.length > 0) {
        syllabus.documents = syllabus.documents.map((doc) => {
          try {
            if (!doc.public_id)
              throw new Error(`Missing public_id for document: ${doc.title}`);

            // Generate a signed URL for download
            const downloadUrl = cloudinary.utils.private_download_url(
              doc.public_id,
              null,
              {
                resource_type: "raw", // Assume raw for all documents
                attachment: true, // Force download
                expires_at: Math.floor(Date.now() / 1000) + 3600, // URL valid for 1 hour
              }
            );

            // Determine content type from mime type or extension
            const fileExtension = doc.title.split(".").pop().toLowerCase();
            const contentTypeMap = {
              pdf: "application/pdf",
              doc: "application/msword",
              docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              xls: "application/vnd.ms-excel",
              xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ppt: "application/vnd.ms-powerpoint",
              pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              txt: "text/plain",
            };
            const contentType =
              contentTypeMap[fileExtension] || "application/octet-stream";

            return { ...doc, downloadUrl, contentType };
          } catch (error) {
            console.error("Error generating download URL:", error);
            return {
              ...doc,
              downloadUrl: null,
              contentType: "application/octet-stream",
            };
          }
        });
      }

      res.json(syllabus);
    } catch (error) {
      console.error("Syllabus retrieval error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  assignTeacherRole: async (req, res) => {
    try {
      const { teacherId, classTeacherOf, subjectAssignments, academicYear } =
        req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);
      const TeacherAssignment = getModel("TeacherAssignment", connection);
      const Class = getModel("Class", connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const teacher = await User.findById(teacherId).lean();
        if (!teacher || teacher.role !== "teacher")
          return res.status(404).json({ message: "Teacher not found" });

        let assignment = await TeacherAssignment.findOne({
          teacher: teacherId,
          academicYear,
        });
        const assignmentType = classTeacherOf
          ? "classTeacher"
          : "subjectTeacher";

        if (!assignment) {
          assignment = new TeacherAssignment({
            school: schoolId,
            teacher: teacherId,
            class: assignmentType === "classTeacher" ? classTeacherOf : null,
            subjects:
              subjectAssignments?.map((s) => ({
                class: s.classId,
                subject: s.subjectId,
              })) || [],
            assignmentType,
            academicYear,
          });
        } else {
          assignment.class =
            assignmentType === "classTeacher" ? classTeacherOf : null;
          assignment.subjects =
            subjectAssignments?.map((s) => ({
              class: s.classId,
              subject: s.subjectId,
            })) || [];
          assignment.assignmentType = assignmentType;
        }

        await assignment.save({ session });

        let permissionUpdate = { ...teacher.permissions };
        if (assignmentType === "classTeacher") {
          if (!permissionUpdate.canTakeAttendance.includes(classTeacherOf)) {
            permissionUpdate.canTakeAttendance.push(classTeacherOf);
          }
          await Class.findByIdAndUpdate(
            classTeacherOf,
            { classTeacher: teacherId },
            { session }
          );
        }

        const markEntryPermissions =
          subjectAssignments?.map((s) => ({
            class: s.classId,
            subject: s.subjectId,
          })) || [];
        permissionUpdate.canEnterMarks = [
          ...new Map(
            [...permissionUpdate.canEnterMarks, ...markEntryPermissions].map(
              (item) => [
                `${item.class.toString()}-${item.subject.toString()}`,
                item,
              ]
            )
          ).values(),
        ];

        await User.findByIdAndUpdate(
          teacherId,
          { $set: { permissions: permissionUpdate } },
          { session }
        );

        await session.commitTransaction();
        res.json({
          assignment,
          permissions: permissionUpdate,
          message: "Teacher role updated successfully",
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

  generateTimetable: async (req, res) => {
    try {
      const { classId } = req.params;
      const { schedule, type, constraints } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Timetable = getModel("Timetable", connection);

      const teacherConflicts = await checkTeacherConflicts(schedule);
      if (teacherConflicts.length > 0) {
        return res
          .status(400)
          .json({
            error: "Teacher scheduling conflicts detected",
            conflicts: teacherConflicts,
          });
      }

      const optimizedSchedule = optimizeSchedule(schedule, constraints);
      const timetable = new Timetable({
        school: schoolId,
        class: classId,
        type,
        schedule: optimizedSchedule,
      });

      await timetable.save();
      res.status(201).json(timetable);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAttendanceReport: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const { startDate, endDate, type, classId, reportType } = req.query;
      const connection = req.connection;
      const Attendance = getModel("Attendance", connection);
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);

      const query = {
        school: schoolId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate("user", "name", User)
        .populate("class", "name division", Class)
        .lean();

      const report = {
        summary: calculateAttendanceStatistics(attendanceData, reportType),
        details: generateDetailedAttendanceReport(attendanceData, reportType),
        charts: generateAttendanceCharts(attendanceData),
      };

      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  createExam: async (req, res) => {
    try {
      const {
        name,
        classId,
        subject,
        date,
        duration,
        totalMarks,
        availableRooms,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);

      const classDetails = await Class.findById(classId)
        .populate("students", "", User)
        .lean();
      const totalStudents = classDetails.students.length;

      const seatingArrangement = generateSeatingArrangement(
        classDetails.students,
        availableRooms,
        totalStudents
      );

      const exam = new Exam({
        school: schoolId,
        name,
        class: classId,
        subject,
        date,
        duration,
        totalMarks,
        seatingArrangement,
      });

      await exam.save();
      res.status(201).json(exam);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // reviewClassResults: async (req, res) => {
  //   try {
  //     const { examId, classId } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const User = getModel("User", connection);
  //     const Subject = getModel("Subject", connection);
  
  //     // Validate class
  //     const classInfo = await Class.findOne({
  //       _id: classId,
  //       school: schoolId,
  //     }).lean();
  //     if (!classInfo) {
  //       return res.status(404).json({ message: "Class not found" });
  //     }
  
  //     // Build query for exams
  //     const query = {
  //       school: schoolId,
  //       class: classId,
  //       status: "submittedToAdmin",
  //     };
  //     if (examId) {
  //       query._id = examId; // Use examId as the _id of the Exam document
  //     }
  
  //     // Fetch exams with populated data
  //     const exams = await Exam.find(query)
  //       .populate("class", "name division")
  //       .populate("subject", "name")
  //       .populate("results.student", "name rollNumber")
  //       .populate("marksEnteredBy", "name")
  //       .lean();
  
  //     if (!exams.length) {
  //       return res
  //         .status(404)
  //         .json({ message: "No submitted results found for review" });
  //     }
  
  //     // Fetch all subjects for the class to ensure completeness
  //     const subjects = await Subject.find({
  //       class: classId,
  //       school: schoolId,
  //     }).lean();
  //     const subjectMap = subjects.reduce((acc, subj) => {
  //       acc[subj._id.toString()] = subj.name;
  //       return acc;
  //     }, {});
  
  //     // Aggregate results by student
  //     const studentResults = new Map();
  //     const examMetadata = [];
  //     exams.forEach((exam) => {
  //       exam.results.forEach((result) => {
  //         const studentId = result.student._id.toString();
  //         if (!studentResults.has(studentId)) {
  //           studentResults.set(studentId, {
  //             student: {
  //               id: studentId,
  //               name: result.student.name,
  //               rollNumber: result.student.rollNumber,
  //             },
  //             subjects: {},
  //             totalMarks: 0,
  //             percentage: 0,
  //           });
  //         }
  //         const studentData = studentResults.get(studentId);
  //         studentData.subjects[exam.subject._id.toString()] = {
  //           subjectName: exam.subject.name,
  //           marksObtained: result.marksObtained,
  //           totalMarks: exam.totalMarks,
  //           remarks: result.remarks || "",
  //         };
  //         studentData.totalMarks += result.marksObtained;
  //       });
  
  //       examMetadata.push({
  //         examId: exam._id,
  //         examType:
  //           exam.examType === "Other" ? exam.customExamType : exam.examType,
  //         subject: exam.subject.name,
  //         examDate: exam.examDate,
  //         totalMarks: exam.totalMarks,
  //         submittedBy: exam.marksEnteredBy?.name || "Unknown",
  //         submittedAt: exam.submittedToAdminAt,
  //       });
  //     });
  
  //     // Calculate percentages and statistics
  //     const resultsArray = Array.from(studentResults.values()).map((result) => {
  //       const maxTotalMarks = Object.values(result.subjects).reduce(
  //         (sum, subj) => sum + subj.totalMarks,
  //         0
  //       );
  //       result.percentage = maxTotalMarks
  //         ? (result.totalMarks / maxTotalMarks) * 100
  //         : 0;
  //       result.grade = calculateGrade([result]);
  //       return result;
  //     });
  
  //     // Calculate class statistics
  //     const classStats = calculateClassStatistics(resultsArray, subjects.length);
  
  //     // Format response
  //     const response = {
  //       success: true,
  //       class: {
  //         id: classInfo._id,
  //         name: classInfo.name,
  //         division: classInfo.division,
  //       },
  //       examMetadata,
  //       results: resultsArray,
  //       statistics: classStats,
  //       subjects: subjects.map((s) => ({ id: s._id, name: s.name })),
  //       totalStudents: resultsArray.length,
  //       totalSubjects: subjects.length,
  //       message: "Results retrieved successfully for review",
  //     };
  
  //     res.json(response);
  //   } catch (error) {
  //     console.error("Error in reviewClassResults:", error);
  //     res.status(500).json({
  //       success: false,
  //       error: error.message,
  //       message: "Failed to retrieve results for review",
  //     });
  //   }
  // },

  // reviewClassResults: async (req, res) => {
  //   try {
  //     const { examId, classId } = req.params;
  //     const { status = "submittedToAdmin", page = 1, limit = 20 } = req.query;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const User = getModel("User", connection);
  //     const Subject = getModel("Subject", connection);

  //     // Validate class
  //     const classInfo = await Class.findOne({
  //       _id: classId,
  //       school: schoolId,
  //     }).lean();
  //     if (!classInfo) {
  //       return res.status(404).json({ message: "Class not found" });
  //     }

  //     // Validate status
  //     const validStatuses = ["submittedToAdmin", "published", "all"];
  //     const queryStatus = status === "all" ? ["submittedToAdmin", "published"] : [status];
  //     if (!validStatuses.includes(status) && status !== "all") {
  //       return res.status(400).json({ message: "Invalid status filter" });
  //     }

  //     // Build query for exams
  //     const query = {
  //       school: schoolId,
  //       class: classId,
  //       status: { $in: queryStatus },
  //     };
  //     if (examId) {
  //       query._id = examId;
  //     }

  //     // Fetch exams with populated data and pagination
  //     const exams = await Exam.find(query)
  //       .populate("class", "name division")
  //       .populate("subject", "name")
  //       .populate("results.student", "name  studentDetails.grNumber") // Include grNumber
  //       .populate("marksEnteredBy", "name")
  //       .populate("publishedBy", "name")
  //       .skip((page - 1) * limit)
  //       .limit(Number(limit))
  //       .lean();

  //     if (!exams.length) {
  //       return res
  //         .status(404)
  //         .json({ message: "No results found for the specified criteria" });
  //     }

  //     // Fetch total count for pagination
  //     const totalExams = await Exam.countDocuments(query);

  //     // Fetch all subjects for the class
  //     const subjects = await Subject.find({
  //       class: classId,
  //       school: schoolId,
  //     }).lean();
  //     const subjectMap = subjects.reduce((acc, subj) => {
  //       acc[subj._id.toString()] = subj.name;
  //       return acc;
  //     }, {});

  //     // Aggregate results by student
  //     const studentResults = new Map();
  //     const examMetadata = [];
  //     exams.forEach((exam) => {
  //       exam.results.forEach((result) => {
  //         const studentId = result.student._id.toString();
  //         if (!studentResults.has(studentId)) {
  //           studentResults.set(studentId, {
  //             student: {
  //               id: studentId,
  //               name: result.student.name,
  //               // rollNumber: result.student.rollNumber || "N/A",
  //               grNumber: result.student.studentDetails?.grNumber || "N/A", // Include grNumber
  //             },
  //             subjects: {},
  //             totalMarks: 0,
  //             percentage: 0,
  //           });
  //         }
  //         const studentData = studentResults.get(studentId);
  //         studentData.subjects[exam.subject._id.toString()] = {
  //           subjectName: exam.subject.name,
  //           marksObtained: result.marksObtained,
  //           totalMarks: exam.totalMarks,
  //           remarks: result.remarks || "",
  //         };
  //         studentData.totalMarks += result.marksObtained;
  //       });

  //       examMetadata.push({
  //         examId: exam._id,
  //         examType:
  //           exam.examType === "Other" ? exam.customExamType : exam.examType,
  //         subject: exam.subject.name,
  //         examDate: exam.examDate,
  //         totalMarks: exam.totalMarks,
  //         status: exam.status,
  //         submittedBy: exam.marksEnteredBy?.name || "Unknown",
  //         submittedAt: exam.submittedToAdminAt,
  //         publishedBy: exam.publishedBy?.name || "N/A",
  //         publishedAt: exam.publishedAt || null,
  //       });
  //     });

  //     // Calculate percentages and statistics
  //     const resultsArray = Array.from(studentResults.values()).map((result) => {
  //       const maxTotalMarks = Object.values(result.subjects).reduce(
  //         (sum, subj) => sum + subj.totalMarks,
  //         0
  //       );
  //       result.percentage = maxTotalMarks
  //         ? (result.totalMarks / maxTotalMarks) * 100
  //         : 0;
  //       result.grade = calculateGrade([result]);
  //       return result;
  //     });

  //     // Calculate class statistics
  //     const classStats = calculateClassStatistics(resultsArray, subjects.length);

  //     // Format response
  //     const response = {
  //       success: true,
  //       class: {
  //         id: classInfo._id,
  //         name: classInfo.name,
  //         division: classInfo.division,
  //       },
  //       examMetadata,
  //       results: resultsArray,
  //       statistics: classStats,
  //       subjects: subjects.map((s) => ({ id: s._id, name: s.name })),
  //       totalStudents: resultsArray.length,
  //       totalSubjects: subjects.length,
  //       pagination: {
  //         page: Number(page),
  //         limit: Number(limit),
  //         totalExams,
  //         totalPages: Math.ceil(totalExams / limit),
  //       },
  //       message: "Results retrieved successfully",
  //     };

  //     res.json(response);
  //   } catch (error) {
  //     console.error("Error in reviewClassResults:", error);
  //     res.status(500).json({
  //       success: false,
  //       error: error.message,
  //       message: "Failed to retrieve results",
  //     });
  //   }
  // },

  reviewClassResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const { status = "submittedToAdmin", page = 1, limit = 20 } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);
      const Subject = getModel("Subject", connection);

      // Validate class
      const classInfo = await Class.findOne({
        _id: classId,
        school: schoolId,
      }).lean();
      if (!classInfo) {
        return res.status(404).json({ message: "Class not found" });
      }

      // Validate status
      const validStatuses = ["submittedToAdmin", "published", "all"];
      const queryStatus = status === "all" ? ["submittedToAdmin", "published"] : [status];
      if (!validStatuses.includes(status) && status !== "all") {
        return res.status(400).json({ message: "Invalid status filter" });
      }

      // Build query for exams
      const query = {
        school: schoolId,
        class: classId,
        status: { $in: queryStatus },
      };
      if (examId) {
        query._id = examId;
      }

      // Fetch exams with populated data and pagination
      const exams = await Exam.find(query)
        .populate("class", "name division")
        .populate("subject", "name")
        .populate("results.student", "name studentDetails.grNumber")
        .populate("marksEnteredBy", "name")
        .populate("publishedBy", "name")
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean();

      if (!exams.length) {
        return res
          .status(404)
          .json({ message: "No results found for the specified criteria" });
      }

      // Fetch total count for pagination
      const totalExams = await Exam.countDocuments(query);

      // Fetch all subjects for the class
      const subjects = await Subject.find({
        class: classId,
        school: schoolId,
      }).lean();
      const subjectMap = subjects.reduce((acc, subj) => {
        acc[subj._id.toString()] = subj.name;
        return acc;
      }, {});

      // Aggregate results by student
      const studentResults = new Map();
      const examMetadata = [];
      exams.forEach((exam) => {
        exam.results.forEach((result) => {
          const studentId = result.student._id.toString();
          if (!studentResults.has(studentId)) {
            studentResults.set(studentId, {
              student: {
                id: studentId,
                name: result.student.name,
                grNumber: result.student.studentDetails?.grNumber || "N/A",
              },
              subjects: {},
              totalMarks: 0,
              percentage: 0,
              excelFile: result.excelFile || null,
              marksheet: result.marksheet || null,
            });
          }
          const studentData = studentResults.get(studentId);
          studentData.subjects[exam.subject._id.toString()] = {
            subjectName: exam.subject.name,
            marksObtained: result.marksObtained,
            totalMarks: exam.totalMarks,
            remarks: result.remarks || "",
          };
          studentData.totalMarks += result.marksObtained;
        });

        examMetadata.push({
          examId: exam._id,
          examType:
            exam.examType === "Other" ? exam.customExamType : exam.examType,
          subject: exam.subject.name,
          examDate: exam.examDate,
          totalMarks: exam.totalMarks,
          status: exam.status,
          submittedBy: exam.marksEnteredBy?.name || "Unknown",
          submittedAt: exam.submittedToAdminAt,
          publishedBy: exam.publishedBy?.name || "N/A",
          publishedAt: exam.publishedAt || null,
        });
      });

      // Calculate percentages and statistics
      const resultsArray = Array.from(studentResults.values()).map((result) => {
        const maxTotalMarks = Object.values(result.subjects).reduce(
          (sum, subj) => sum + subj.totalMarks,
          0
        );
        result.percentage = maxTotalMarks
          ? (result.totalMarks / maxTotalMarks) * 100
          : 0;
        result.grade = calculateGrade([result]);
        return result;
      });

      // Calculate class statistics
      const classStats = calculateClassStatistics(resultsArray, subjects.length);

      // Format response
      const response = {
        success: true,
        class: {
          id: classInfo._id,
          name: classInfo.name,
          division: classInfo.division,
        },
        examMetadata,
        results: resultsArray,
        statistics: classStats,
        subjects: subjects.map((s) => ({ id: s._id, name: s.name })),
        totalStudents: resultsArray.length,
        totalSubjects: subjects.length,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          totalExams,
          totalPages: Math.ceil(totalExams / limit),
        },
        message: "Results retrieved successfully",
      };

      res.json(response);
    } catch (error) {
      console.error("Error in reviewClassResults:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Failed to retrieve results",
      });
    }
  },




getSubmittedExcelResults: async (req, res) => {
  try {
    const { examEventId, classId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Result = getModel("Result", connection);
    const Exam = getModel("Exam", connection);
    const ExamEvent = getModel("ExamEvent", connection);
    const Class = getModel("Class", connection);
    const Subject = getModel("Subject", connection);
    const User = getModel("User", connection);

    // Validate class and exam event
    const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
    if (!classInfo) return res.status(404).json({ message: "Class not found" });

    const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
    if (!examEvent) return res.status(404).json({ message: "Exam event not found" });

    // Verify class is part of the exam event
    if (!examEvent.classes.map(id => id.toString()).includes(classId)) {
      return res.status(400).json({ message: "Class is not associated with this exam event" });
    }

    // Find all exams for the exam event and class
    const exams = await Exam.find({ examEvent: examEventId, class: classId, school: schoolId }).lean();
    if (!exams.length) return res.status(404).json({ message: "No exams found for this event and class" });

    // Get results with Excel file information
    const results = await Result.find({
      school: schoolId,
      exam: { $in: exams.map(e => e._id) },
      class: classId,
      status: "submittedToAdmin",
    })
      .populate("subject", "name")
      .populate("student", "name studentDetails.grNumber")
      .lean();

    // Fetch students to verify class membership
    const students = await User.find({
      role: "student",
      "studentDetails.class": classId,
      school: schoolId,
    }).lean();
    const validStudentIds = students.map(s => s._id.toString());

    // Get the most recent Excel file
    const latestResult = await Result.findOne({
      school: schoolId,
      exam: { $in: exams.map(e => e._id) },
      class: classId,
      status: "submittedToAdmin",
      excelFile: { $ne: null },
    })
      .sort({ submittedToAdminAt: -1 })
      .lean();

    const excelFile = latestResult?.excelFile || null;

    // Format results for table display
    const formattedResults = results.reduce((acc, result) => {
      const studentId = result.student._id.toString();
      // Ensure student belongs to the class
      if (!validStudentIds.includes(studentId)) {
        return acc;
      }
      if (!acc[studentId]) {
        acc[studentId] = {
          student: {
            id: studentId,
            name: result.student.name,
            grNumber: result.student.studentDetails?.grNumber || "N/A",
          },
          subjects: {},
          excelFile,
        };
      }
      acc[studentId].subjects[result.subject._id.toString()] = {
        name: result.subject.name,
        marksObtained: result.marksObtained,
        totalMarks: result.totalMarks,
      };
      return acc;
    }, {});

    res.json({
      success: true,
      class: { id: classInfo._id, name: classInfo.name, division: classInfo.division },
      examEvent: {
        id: examEvent._id,
        name: examEvent.name,
        type: examEvent.examType === "Other" ? examEvent.customExamType : examEvent.examType,
      },
      results: Object.values(formattedResults),
      excelFile,
      message: "Submitted Excel results retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getSubmittedExcelResults:", error);
    res.status(500).json({ success: false, error: error.message });
  }
},




// uploadExcelResultsOfStudent: async (req, res) => {
//     try {
//       const { examEventId, classId } = req.params;
//       const schoolId = req.school._id.toString();
//       const adminId = req.user._id;
//       const connection = req.connection;
//       const Exam = getModel("Exam", connection);
//       const ExamEvent = getModel("ExamEvent", connection);
//       const Class = getModel("Class", connection);
//       const User = getModel("User", connection);
//       const Subject = getModel("Subject", connection);
//       const Result = getModel("Result", connection);

//       const session = await connection.startSession();
//       session.startTransaction();

//       try {
//         // Validate exam event and class
//         const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
//         if (!examEvent) throw new Error("Exam event not found");

//         const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
//         if (!classInfo) throw new Error("Class not found");
//         if (!examEvent.classes.map(id => id.toString()).includes(classId)) {
//           throw new Error("Class is not associated with this exam event");
//         }

//         // Get exams and subjects
//         const exams = await Exam.find({ examEvent: examEventId, class: classId, school: schoolId })
//           .populate("subject", "name")
//           .lean();
//         if (!exams.length) throw new Error("No exams found for this event and class");

//         const subjects = await Subject.find({ class: classId, school: schoolId }).lean();
//         const subjectMap = subjects.reduce((acc, subj) => {
//           acc[subj.name.toLowerCase()] = subj._id;
//           return acc;
//         }, {});

//         // Ensure examMap has one exam per subject
//         const examMap = exams.reduce((acc, exam) => {
//           const subjectId = exam.subject._id.toString();
//           // Only keep the first exam for each subject to avoid duplicates
//           if (!acc[subjectId]) {
//             acc[subjectId] = exam;
//           }
//           return acc;
//         }, {});

//         // Get all students in the class
//         const students = await User.find({
//           role: "student",
//           "studentDetails.class": classId,
//           school: schoolId,
//         }).lean();

//         // Validate uploaded file
//         if (!req.file || !req.file.buffer) {
//           throw new Error("No valid Excel file uploaded");
//         }

//         // Process Excel file
//         const workbook = new ExcelJS.Workbook();
//         try {
//           await workbook.xlsx.load(req.file.buffer);
//         } catch (error) {
//           throw new Error("Invalid or corrupted Excel file. Please upload a valid XLSX file.");
//         }

//         const worksheet = workbook.worksheets[0];
//         if (!worksheet) {
//           throw new Error("No worksheet found in the Excel file");
//         }

//         // --- IMPROVED DYNAMIC HEADER DETECTION ---
//         let headerRowNumber = -1;
//         let headerRow = null;
//         let headerColStart = 1;

//         // Scan first 20 rows and all columns for a cell containing 'gr no' or 'gr number'
//         worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
//           for (let col = 1; col <= row.cellCount; col++) {
//             const cellValue = row.getCell(col).value?.toString().trim().toLowerCase();
//             if (cellValue && (cellValue === 'gr no.' || cellValue === 'gr no' || cellValue === 'gr number')) {
//               headerRowNumber = rowNumber;
//               headerRow = row;
//               headerColStart = col;
//               break;
//             }
//           }
//           if (headerRowNumber !== -1) return false; // Stop iteration if found
//         });

//         if (headerRowNumber === -1) {
//           throw new Error("Could not find header row with 'GR No.' or similar in any column");
//         }

//         // Build column map from the detected header row, starting from headerColStart
//         const columnMap = {};
//         headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
//           const headerName = cell.value?.toString().trim().toLowerCase();
//           if (headerName) {
//             columnMap[headerName] = colNumber;
//           }
//         });

//         // Validate required columns
//         const requiredColumns = ['gr no', 'student name'];
//         for (const col of requiredColumns) {
//           if (!Object.keys(columnMap).some(header => header.startsWith(col))) {
//             throw new Error(`Required column '${col}' not found in header row`);
//           }
//         }

//         // Identify subject columns
//         const validSubjectNames = subjects.map(s => s.name.trim().toLowerCase());
//         const subjectColumns = Object.entries(columnMap)
//           .filter(([name]) => validSubjectNames.includes(name))
//           .map(([name, colNumber]) => ({ name, colNumber }));

//         if (subjectColumns.length === 0) {
//           throw new Error("No subject columns found in the Excel file. Found columns: " + Object.keys(columnMap).join(", "));
//         }

//         // Process student rows
//         const rowsToProcess = [];
//         const errors = [];
//         const marksheets = [];
//         const results = [];

//         // Start from row after headers, skip empty rows
//         for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
//           const row = worksheet.getRow(rowNumber);

//           // Find the actual column for 'gr no'
//           let grNoCol = Object.entries(columnMap).find(([header]) => header.startsWith('gr no') || header.startsWith('gr number'));
//           if (!grNoCol) continue;
//           const grNumber = row.getCell(grNoCol[1]).value?.toString().trim();
//           if (!grNumber) continue;

//           // Skip summary rows or other non-student rows
//           if (grNumber.toLowerCase().includes('generated on') ||
//               grNumber.toLowerCase().includes('passing criteria') ||
//               grNumber.toLowerCase().includes('class teacher') ||
//               grNumber.toLowerCase().includes('principal')) {
//             continue;
//           }

//           const student = students.find(s => s.studentDetails?.grNumber === grNumber);
//           if (!student) {
//             errors.push(`Student with GR Number ${grNumber} not found in row ${rowNumber}`);
//             continue;
//           }

//           // Process subject marks
//           const studentResults = [];
//           const subjectResultsMap = new Map(); // Use Map to prevent duplicate subjects

//           for (const { name: subjectName, colNumber } of subjectColumns) {
//             const subjectId = subjectMap[subjectName];
//             if (!subjectId) {
//               errors.push(`Subject '${subjectName}' not found in system for row ${rowNumber}`);
//               continue;
//             }

//             const exam = examMap[subjectId];
//             if (!exam) {
//               errors.push(`No exam found for subject ${subjectName} in row ${rowNumber}`);
//               continue;
//             }

//             const marksValue = row.getCell(colNumber).value;
//             const marks = parseFloat(marksValue);
//             if (isNaN(marks)) {
//               errors.push(`Invalid marks '${marksValue}' for ${subjectName} in row ${rowNumber}`);
//               continue;
//             }

//             if (marks < 0 || marks > exam.totalMarks) {
//               errors.push(`Marks ${marks} out of range for ${subjectName} in row ${rowNumber}`);
//               continue;
//             }

//             // Add to studentResults
//             studentResults.push({
//               exam: exam._id,
//               subject: subjectId,
//               marksObtained: marks,
//               totalMarks: exam.totalMarks,
//             });

//             // Add to subjectResultsMap to ensure uniqueness
//             subjectResultsMap.set(subjectId.toString(), {
//               name: subjects.find(s => s._id.toString() === subjectId.toString()).name,
//               marksObtained: marks,
//               totalMarks: exam.totalMarks,
//             });
//           }

//           if (studentResults.length === 0) {
//             errors.push(`No valid subject marks found for student ${grNumber} in row ${rowNumber}`);
//             continue;
//           }

//           // Add to processing queue
//           studentResults.forEach(result => {
//             rowsToProcess.push({
//               student,
//               resultEntry: {
//                 school: schoolId,
//                 student: student._id,
//                 examEvent: examEventId,
//                 exam: result.exam,
//                 class: classId,
//                 subject: result.subject,
//                 marksObtained: result.marksObtained,
//                 totalMarks: result.totalMarks,
//                 excelFile: {
//                   key: `results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`,
//                   url: getPublicFileUrl(`results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`),
//                   originalName: req.file.originalname,
//                 },
//                 status: "submittedToAdmin",
//                 submittedBy: adminId,
//                 submittedToAdminAt: new Date(),
//               },
//             });
//           });

//           // Prepare marksheet data with unique subjects
//           marksheets.push({
//             student,
//             subjectResults: Array.from(subjectResultsMap.values()),
//             exams,
//             examEvent,
//             classInfo,
//           });
//         }

//         if (errors.length > 0) {
//           throw new Error(`Excel processing errors: ${errors.join("; ")}`);
//         }

//         if (rowsToProcess.length === 0) {
//           throw new Error("No valid student records found in the Excel file");
//         }

//         // Upload Excel file to S3
//         const excelFileKey = `results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`;
//         await uploadToS3(req.file.buffer, excelFileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

//         // Update excelFile URLs in result entries
//         rowsToProcess.forEach(row => {
//           row.resultEntry.excelFile.key = excelFileKey;
//           row.resultEntry.excelFile.url = getPublicFileUrl(excelFileKey);
//           results.push(row.resultEntry);
//         });

//         // Generate marksheets
//         for (const marksheet of marksheets) {
//           const { student, subjectResults, exams, examEvent, classInfo } = marksheet;
//           const marksheetKey = `marksheets/${schoolId}/${classId}/${examEventId}/${student._id}_${Date.now()}.pdf`;

//           const pdfBuffer = await generateMarksheetPDF({
//             student,
//             classInfo,
//             examEvent,
//             subjects: subjectResults,
//             exams,
//           });

//           await uploadToS3(pdfBuffer, marksheetKey, "application/pdf");

//           // Update all results for this student with marksheet info
//           await Result.updateMany(
//             { student: student._id, exam: { $in: exams.map(e => e._id) }, class: classId },
//             {
//               $set: {
//                 marksheet: {
//                   key: marksheetKey,
//                   url: getPublicFileUrl(marksheetKey),
//                 },
//               },
//             },
//             { session }
//           );
//         }

//         // Insert all results
//         await Result.insertMany(results, { session });

//         await session.commitTransaction();
//         res.status(201).json({
//           success: true,
//           resultsCount: results.length,
//           marksheetsGenerated: marksheets.length,
//           message: "Excel results processed and marksheets generated successfully",
//         });
//       } catch (error) {
//         await session.abortTransaction();
//         throw error;
//       } finally {
//         session.endSession();
//       }
//     } catch (error) {
//       console.error("Error in uploadExcelResultsOfStudent:", error);
//       res.status(500).json({ success: false, error: error.message });
//     }
//   },

uploadExcelResultsOfStudent: async (req, res) => {
    try {
      const { examEventId, classId } = req.params;
      const schoolId = req.school._id.toString();
      const adminId = req.user._id;
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const ExamEvent = getModel("ExamEvent", connection);
      const Class = getModel("Class", connection);
      const User = getModel("User", connection);
      const Subject = getModel("Subject", connection);
      const Result = getModel("Result", connection);

      // Use owner_db connection for School model
      const ownerConnection = getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);

      // Debug logging
      console.log('Fetching school with schoolId:', schoolId);
      console.log('Owner connection name:', ownerConnection.name);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        // Get school details for the marksheet
        const schoolInfo = await School.findById(schoolId).select("name address logo").lean();
        if (!schoolInfo) {
          console.error('School not found for schoolId:', schoolId);
          throw new Error("School not found");
        }
        console.log('School found:', schoolInfo);

        // Validate exam event and class
        const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
        if (!examEvent) throw new Error("Exam event not found");

        const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
        if (!classInfo) throw new Error("Class not found");
        if (!examEvent.classes.map(id => id.toString()).includes(classId)) {
          throw new Error("Class is not associated with this exam event");
        }

        // Get exams and subjects
        const exams = await Exam.find({ examEvent: examEventId, class: classId, school: schoolId })
          .populate("subject", "name")
          .lean();
        if (!exams.length) throw new Error("No exams found for this event and class");

        const subjects = await Subject.find({ class: classId, school: schoolId }).lean();
        const subjectMap = subjects.reduce((acc, subj) => {
          acc[subj.name.toLowerCase()] = subj._id;
          return acc;
        }, {});

        // Ensure examMap has one exam per subject
        const examMap = exams.reduce((acc, exam) => {
          const subjectId = exam.subject._id.toString();
          // Only keep the first exam for each subject to avoid duplicates
          if (!acc[subjectId]) {
            acc[subjectId] = exam;
          }
          return acc;
        }, {});

        // Get all students in the class
        const students = await User.find({
          role: "student",
          "studentDetails.class": classId,
          school: schoolId,
        }).lean();

        // Validate uploaded file
        if (!req.file || !req.file.buffer) {
          throw new Error("No valid Excel file uploaded");
        }

        // Process Excel file
        const workbook = new ExcelJS.Workbook();
        try {
          await workbook.xlsx.load(req.file.buffer);
        } catch (error) {
          throw new Error("Invalid or corrupted Excel file. Please upload a valid XLSX file.");
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error("No worksheet found in the Excel file");
        }

        // --- IMPROVED DYNAMIC HEADER DETECTION ---
        let headerRowNumber = -1;
        let headerRow = null;
        let headerColStart = 1;

        // Scan first 20 rows and all columns for a cell containing 'gr no' or 'gr number'
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          for (let col = 1; col <= row.cellCount; col++) {
            const cellValue = row.getCell(col).value?.toString().trim().toLowerCase();
            if (cellValue && (cellValue === 'gr no.' || cellValue === 'gr no' || cellValue === 'gr number')) {
              headerRowNumber = rowNumber;
              headerRow = row;
              headerColStart = col;
              break;
            }
          }
          if (headerRowNumber !== -1) return false; // Stop iteration if found
        });

        if (headerRowNumber === -1) {
          throw new Error("Could not find header row with 'GR No.' or similar in any column");
        }

        // Build column map from the detected header row, starting from headerColStart
        const columnMap = {};
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          const headerName = cell.value?.toString().trim().toLowerCase();
          if (headerName) {
            columnMap[headerName] = colNumber;
          }
        });

        // Validate required columns
        const requiredColumns = ['gr no', 'student name'];
        for (const col of requiredColumns) {
          if (!Object.keys(columnMap).some(header => header.startsWith(col))) {
            throw new Error(`Required column '${col}' not found in header row`);
          }
        }

        // Identify subject columns
        const validSubjectNames = subjects.map(s => s.name.trim().toLowerCase());
        const subjectColumns = Object.entries(columnMap)
          .filter(([name]) => validSubjectNames.includes(name))
          .map(([name, colNumber]) => ({ name, colNumber }));

        if (subjectColumns.length === 0) {
          throw new Error("No subject columns found in the Excel file. Found columns: " + Object.keys(columnMap).join(", "));
        }

        // Process student rows
        const rowsToProcess = [];
        const errors = [];
        const marksheets = [];
        const results = [];

        // Start from row after headers, skip empty rows
        for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
          const row = worksheet.getRow(rowNumber);

          // Find the actual column for 'gr no'
          let grNoCol = Object.entries(columnMap).find(([header]) => header.startsWith('gr no') || header.startsWith('gr number'));
          if (!grNoCol) continue;
          const grNumber = row.getCell(grNoCol[1]).value?.toString().trim();
          if (!grNumber) continue;

          // Skip summary rows or other non-student rows
          if (grNumber.toLowerCase().includes('generated on') ||
              grNumber.toLowerCase().includes('passing criteria') ||
              grNumber.toLowerCase().includes('class teacher') ||
              grNumber.toLowerCase().includes('principal')) {
            continue;
          }

          const student = students.find(s => s.studentDetails?.grNumber === grNumber);
          if (!student) {
            errors.push(`Student with GR Number ${grNumber} not found in row ${rowNumber}`);
            continue;
          }

          // Process subject marks
          const studentResults = [];
          const subjectResultsMap = new Map(); // Use Map to prevent duplicate subjects

          for (const { name: subjectName, colNumber } of subjectColumns) {
            const subjectId = subjectMap[subjectName];
            if (!subjectId) {
              errors.push(`Subject '${subjectName}' not found in system for row ${rowNumber}`);
              continue;
            }

            const exam = examMap[subjectId];
            if (!exam) {
              errors.push(`No exam found for subject ${subjectName} in row ${rowNumber}`);
              continue;
            }

            const marksValue = row.getCell(colNumber).value;
            const marks = parseFloat(marksValue);
            if (isNaN(marks)) {
              errors.push(`Invalid marks '${marksValue}' for ${subjectName} in row ${rowNumber}`);
              continue;
            }

            if (marks < 0 || marks > exam.totalMarks) {
              errors.push(`Marks ${marks} out of range for ${subjectName} in row ${rowNumber}`);
              continue;
            }

            // Add to studentResults
            studentResults.push({
              exam: exam._id,
              subject: subjectId,
              marksObtained: marks,
              totalMarks: exam.totalMarks,
            });

            // Add to subjectResultsMap to ensure uniqueness
            subjectResultsMap.set(subjectId.toString(), {
              name: subjects.find(s => s._id.toString() === subjectId.toString()).name,
              marksObtained: marks,
              totalMarks: exam.totalMarks,
            });
          }

          if (studentResults.length === 0) {
            errors.push(`No valid subject marks found for student ${grNumber} in row ${rowNumber}`);
            continue;
          }

          // Add to processing queue
          studentResults.forEach(result => {
            rowsToProcess.push({
              student,
              resultEntry: {
                school: schoolId,
                student: student._id,
                examEvent: examEventId,
                exam: result.exam,
                class: classId,
                subject: result.subject,
                marksObtained: result.marksObtained,
                totalMarks: result.totalMarks,
                excelFile: {
                  key: `results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`,
                  url: getPublicFileUrl(`results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`),
                  originalName: req.file.originalname,
                },
                status: "submittedToAdmin",
                submittedBy: adminId,
                submittedToAdminAt: new Date(),
              },
            });
          });

          // Prepare marksheet data with unique subjects
          marksheets.push({
            student,
            subjectResults: Array.from(subjectResultsMap.values()),
            exams,
            examEvent,
            classInfo,
            schoolInfo // Add schoolInfo to marksheet
          });
        }

        if (errors.length > 0) {
          throw new Error(`Excel processing errors: ${errors.join("; ")}`);
        }

        if (rowsToProcess.length === 0) {
          throw new Error("No valid student records found in the Excel file");
        }

        // Upload Excel file to S3
        const excelFileKey = `results/${schoolId}/${classId}/results_${classId}_${examEventId}_${Date.now()}.xlsx`;
        await uploadToS3(req.file.buffer, excelFileKey, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        // Update excelFile URLs in result entries
        rowsToProcess.forEach(row => {
          row.resultEntry.excelFile.key = excelFileKey;
          row.resultEntry.excelFile.url = getPublicFileUrl(excelFileKey);
          results.push(row.resultEntry);
        });

        // Generate marksheets
        for (const marksheet of marksheets) {
          const { student, subjectResults, exams, examEvent, classInfo, schoolInfo } = marksheet;
          const marksheetKey = `marksheets/${schoolId}/${classId}/${examEventId}/${student._id}_${Date.now()}.pdf`;

          const pdfBuffer = await generateMarksheetPDF({
            student,
            classInfo,
            examEvent,
            subjects: subjectResults,
            exams,
            schoolInfo // Pass schoolInfo to generateMarksheetPDF
          });

          await uploadToS3(pdfBuffer, marksheetKey, "application/pdf");

          // Update all results for this student with marksheet info
          await Result.updateMany(
            { student: student._id, exam: { $in: exams.map(e => e._id) }, class: classId },
            {
              $set: {
                marksheet: {
                  key: marksheetKey,
                  url: getPublicFileUrl(marksheetKey),
                },
              },
            },
            { session }
          );
        }

        // Insert all results
        await Result.insertMany(results, { session });

        await session.commitTransaction();
        res.status(201).json({
          success: true,
          resultsCount: results.length,
          marksheetsGenerated: marksheets.length,
          message: "Excel results processed and marksheets generated successfully",
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error("Error in uploadExcelResultsOfStudent:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

// getAllMarksheets: async (req, res) => {
//   try {
//     const { examEventId, classId } = req.params;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const Result = getModel("Result", connection);
//     const Exam = getModel("Exam", connection);
//     const ExamEvent = getModel("ExamEvent", connection);
//     const Class = getModel("Class", connection);
//     const User = getModel("User", connection);

//     const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
//     if (!examEvent) return res.status(404).json({ message: "Exam event not found" });

//     const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
//     if (!classInfo) return res.status(404).json({ message: "Class not found" });

//     if (!examEvent.classes.map(id => id.toString()).includes(classId)) {
//       return res.status(400).json({ message: "Class is not associated with this exam event" });
//     }

//     const exams = await Exam.find({ examEvent: examEventId, class: classId, school: schoolId }).lean();
//     if (!exams.length) return res.status(404).json({ message: "No exams found for this event and class" });

//     const results = await Result.find({
//       school: schoolId,
//       exam: { $in: exams.map(e => e._id) },
//       class: classId,
//     })
//       .populate("student", "name studentDetails.grNumber")
//       .populate("subject", "name")
//       .lean();

//     const students = await User.find({
//       role: "student",
//       "studentDetails.class": classId,
//       school: schoolId,
//     }).lean();
//     const validStudentIds = students.map(s => s._id.toString());

//     const marksheets = results.reduce((acc, result) => {
//       const studentId = result.student._id.toString();
//       if (!validStudentIds.includes(studentId)) {
//         return acc;
//       }
//       if (!acc[studentId] && result.marksheet) {
//         acc[studentId] = {
//           student: {
//             id: studentId,
//             name: result.student.name,
//             grNumber: result.student.studentDetails?.grNumber || "N/A",
//           },
//           marksheet: result.marksheet,
//           status: result.status,
//           subjects: [],
//         };
//       }
//       if (acc[studentId]) {
//         acc[studentId].subjects.push({
//           subjectId: result.subject._id,
//           subjectName: result.subject.name,
//           marksObtained: result.marksObtained,
//           totalMarks: result.totalMarks,
//         });
//       }
//       return acc;
//     }, {});

//     res.json({
//       success: true,
//       class: { id: classInfo._id, name: classInfo.name, division: classInfo.division },
//       examEvent: {
//         id: examEvent._id,
//         name: examEvent.name,
//         type: examEvent.examType === "Other" ? examEvent.customExamType : examEvent.examType,
//       },
//       marksheets: Object.values(marksheets),
//       message: "Marksheets retrieved successfully",
//     });
//   } catch (error) {
//     console.error("Error in getAllMarksheets:", error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// },



getAllMarksheets : async (req, res) => {
  try {
    const { examEventId, classId } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const ExamEvent = getModel("ExamEvent", connection);
    const Class = getModel("Class", connection);
    const Result = getModel("Result", connection);

    // Validate exam event and class
    const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
    if (!examEvent) {
      return res.status(404).json({ success: false, error: "Exam event not found" });
    }

    const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
    if (!classInfo) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    // Aggregate results by student
    const marksheets = await Result.aggregate([
      {
        $match: {
          examEvent: new mongoose.Types.ObjectId(examEventId),
          class: new mongoose.Types.ObjectId(classId),
          school: new mongoose.Types.ObjectId(schoolId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "student",
          foreignField: "_id",
          as: "studentInfo",
        },
      },
      {
        $unwind: "$studentInfo",
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subject",
          foreignField: "_id",
          as: "subjectInfo",
        },
      },
      {
        $unwind: "$subjectInfo",
      },
      {
        $group: {
          _id: "$student",
          student: {
            $first: {
              id: "$studentInfo._id",
              name: "$studentInfo.name",
              grNumber: "$studentInfo.studentDetails.grNumber",
            },
          },
          marksheet: { $first: "$marksheet" },
          status: { $first: "$status" },
          subjects: {
            $addToSet: {
              subjectId: "$subject",
              subjectName: "$subjectInfo.name",
              marksObtained: "$marksObtained",
              totalMarks: "$totalMarks",
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          student: 1,
          marksheet: 1,
          status: 1,
          subjects: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      class: {
        id: classId,
        name: classInfo.name,
        division: classInfo.division,
      },
      examEvent: {
        id: examEventId,
        name: examEvent.examType === "Other" ? examEvent.customExamType : examEvent.examType,
        type: examEvent.examType,
      },
      marksheets,
      message: "Marksheets retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getAllMarksheets:", error);
    res.status(500).json({ success: false, error: error.message });
  }
},



publishIndividualMarksheet: async (req, res) => {
  try {
    const { examEventId, classId, studentId } = req.params;
    const adminId = req.user._id;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const Result = getModel("Result", connection);
    const Exam = getModel("Exam", connection);
    const ExamEvent = getModel("ExamEvent", connection);
    const User = getModel("User", connection);
    const Class = getModel("Class", connection);

    const session = await connection.startSession();
    session.startTransaction();

    try {
      const examEvent = await ExamEvent.findOne({ _id: examEventId, school: schoolId }).lean();
      if (!examEvent) throw new Error("Exam event not found");

      const classInfo = await Class.findOne({ _id: classId, school: schoolId }).lean();
      if (!classInfo) throw new Error("Class not found");

      if (!examEvent.classes.map(id => id.toString()).includes(classId)) {
        throw new Error("Class is not associated with this exam event");
      }

      const student = await User.findOne({ _id: studentId, school: schoolId, role: "student" }).lean();
      if (!student) throw new Error("Student not found");

      if (student.studentDetails?.class.toString() !== classId) {
        throw new Error("Student is not in the specified class");
      }

      const exams = await Exam.find({ examEvent: examEventId, class: classId, school: schoolId }).lean();
      if (!exams.length) throw new Error("No exams found for this event and class");

      const updatedResults = await Result.updateMany(
        {
          school: schoolId,
          exam: { $in: exams.map(e => e._id) },
          class: classId,
          student: studentId,
          status: "submittedToAdmin",
        },
        {
          $set: {
            status: "published",
            publishedBy: adminId,
            publishedAt: new Date(),
          },
        },
        { session }
      );

      if (updatedResults.matchedCount === 0) {
        throw new Error("No results found to publish or already published");
      }

      await session.commitTransaction();
      res.json({
        success: true,
        message: `Marksheet for student ${student.name} published successfully for exam event ${examEvent.name}`,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error("Error in publishIndividualMarksheet:", error);
    res.status(500).json({ success: false, error: error.message });
  }
},

  publishResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const adminId = req.user._id;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const Result = getModel("Result", connection);
  
      const session = await connection.startSession();
      session.startTransaction();
  
      try {
        // Build query for exams
        const query = {
          school: schoolId,
          class: classId,
          status: "submittedToAdmin",
        };
        if (examId) {
          query._id = examId; // Use examId as ObjectId to match _id
        }
  
        const exams = await Exam.find(query).lean();
  
        if (!exams.length) {
          return res.status(404).json({
            success: false,
            message: "No results to publish",
          });
        }
  
        const results = [];
        exams.forEach((exam) => {
          exam.results.forEach((result) => {
            results.push({
              school: schoolId,
              student: result.student,
              exam: exam._id,
              class: exam.class,
              subject: exam.subject,
              marksObtained: result.marksObtained,
              totalMarks: exam.totalMarks,
              remarks: result.remarks,
              status: "published",
              publishedBy: adminId,
              publishedAt: new Date(),
            });
          });
        });
  
        await Result.insertMany(results, { session });
        await Promise.all(
          exams.map((exam) =>
            Exam.findByIdAndUpdate(
              exam._id,
              {
                status: "published",
                publishedAt: new Date(),
                publishedBy: adminId,
              },
              { session }
            )
          )
        );
  
        await session.commitTransaction();
        res.json({
          success: true,
          message: "Results published successfully",
          examsPublished: exams.length,
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error("Error in publishResults:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Failed to publish results",
      });
    }
  },

  createAnnouncement: async (req, res) => {
    try {
      const { title, content, targetGroups, priority, validFrom, validUntil } =
        req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel("Announcement", connection);

      console.log("Request body:", {
        title,
        content,
        targetGroups,
        priority,
        validFrom,
        validUntil,
      });
      console.log(
        "Files received:",
        req.files
          ? req.files.map((f) => ({ name: f.originalname, size: f.size }))
          : "No files"
      );

      // Process uploaded files with streaming
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const uploadPromise = new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: "announcements",
                resource_type: "auto",
                public_id: `announcements/${Date.now()}_${file.originalname.replace(
                  /[^a-zA-Z0-9]/g,
                  "_"
                )}`,
                timeout: 120000, // Explicitly set to 120 seconds
              },
              (error, result) => {
                if (error) {
                  console.error("Cloudinary upload error:", error);
                  reject(error);
                } else {
                  resolve({
                    fileName: file.originalname,
                    fileUrl: result.secure_url,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    publicId: result.public_id,
                  });
                }
              }
            );
            streamifier.createReadStream(file.buffer).pipe(uploadStream);
          });
          attachments.push(await uploadPromise);
        }
      }

      const announcement = new Announcement({
        school: schoolId,
        title,
        content,
        targetGroups: JSON.parse(targetGroups),
        priority,
        validFrom,
        validUntil,
        attachments,
        createdBy: req.user._id,
      });

      await announcement.save();
      console.log("Announcement saved:", announcement._id);
      res.status(201).json(announcement);
    } catch (error) {
      console.error("Error in createAnnouncement:", {
        message: error.message,
        stack: error.stack,
      });
      if (error.message?.includes("timeout")) {
        return res
          .status(408)
          .json({ error: "Upload timeout", details: error.message });
      }
      res
        .status(500)
        .json({
          error: "Failed to create announcement",
          details: error.message,
        });
    }
  },

  updateAnnouncement: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        targetGroups,
        priority,
        validFrom,
        validUntil,
        removeAttachments,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel("Announcement", connection);

      const announcement = await Announcement.findById(id);
      if (!announcement)
        return res.status(404).json({ error: "Announcement not found" });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to update this announcement" });
      }

      const newAttachments =
        req.files?.map((file) => ({
          fileName: file.originalname,
          fileUrl: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
          publicId: file.filename,
        })) || [];

      let currentAttachments = announcement.attachments;
      if (removeAttachments && removeAttachments.length > 0) {
        const attachmentsToRemove = JSON.parse(removeAttachments);
        const attachmentsToDelete = announcement.attachments
          .filter((attach) =>
            attachmentsToRemove.includes(attach._id.toString())
          )
          .map((attach) => attach.publicId);

        if (attachmentsToDelete.length > 0) {
          await Promise.all(
            attachmentsToDelete.map((publicId) =>
              cloudinary.uploader.destroy(publicId)
            )
          );
        }
        currentAttachments = announcement.attachments.filter(
          (attach) => !attachmentsToRemove.includes(attach._id.toString())
        );
      }

      announcement.title = title;
      announcement.content = content;
      announcement.targetGroups = JSON.parse(targetGroups);
      announcement.priority = priority;
      announcement.validFrom = validFrom;
      announcement.validUntil = validUntil;
      announcement.attachments = [...currentAttachments, ...newAttachments];

      await announcement.save();
      res.status(200).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteAnnouncement: async (req, res) => {
    try {
      const { id } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel("Announcement", connection);

      const announcement = await Announcement.findById(id);
      if (!announcement)
        return res.status(404).json({ error: "Announcement not found" });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to delete this announcement" });
      }

      if (announcement.attachments?.length > 0) {
        await Promise.all(
          announcement.attachments.map((attachment) =>
            cloudinary.uploader.destroy(attachment.publicId)
          )
        );
      }

      await Announcement.findByIdAndDelete(id);
      res.status(200).json({ message: "Announcement deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAnnouncements: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel("Announcement", connection);
      const User = getModel("User", connection);

      const announcements = await Announcement.find({ school: schoolId })
        .sort({ createdAt: -1 })
        .populate("createdBy", "name email", User)
        .lean();

      res.status(200).json(announcements);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAnnouncementById: async (req, res) => {
    try {
      const { id } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel("Announcement", connection);
      const User = getModel("User", connection);

      const announcement = await Announcement.findById(id)
        .populate("createdBy", "name email", User)
        .lean();

      if (!announcement)
        return res.status(404).json({ error: "Announcement not found" });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res
          .status(403)
          .json({ error: "Not authorized to view this announcement" });
      }

      res.status(200).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getPendingLeaveRequests: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Leave = getModel("Leave", connection);
      const User = getModel("User", connection);

      const pendingLeaves = await Leave.find({
        school: schoolId,
        status: "pending",
      })
        .populate("user", "name role")
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: "success",
        count: pendingLeaves.length,
        leaves: pendingLeaves.map((leave) => ({
          id: leave._id,
          user: {
            id: leave.user._id,
            name: leave.user.name,
            role: leave.user.role,
          },
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          appliedOn: leave.appliedOn,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  reviewLeaveRequest: async (req, res) => {
    try {
      const { leaveId } = req.params;
      const { status, comments } = req.body;
      const schoolId = req.school._id.toString();
      const adminId = req.user._id;
      const connection = req.connection;
      const Leave = getModel("Leave", connection);
      const User = getModel("User", connection);

      if (!["approved", "rejected"].includes(status)) {
        return res
          .status(400)
          .json({ message: 'Status must be "approved" or "rejected"' });
      }

      const leave = await Leave.findOne({ _id: leaveId, school: schoolId });
      if (!leave) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      if (leave.status !== "pending") {
        return res
          .status(400)
          .json({ message: "This leave request has already been reviewed" });
      }

      leave.status = status;
      leave.reviewedBy = adminId;
      leave.reviewedAt = new Date();
      leave.comments = comments || "";

      await leave.save();

      const user = await User.findById(leave.user).select("name role");

      res.json({
        message: `Leave request ${status}`,
        leave: {
          id: leave._id,
          user: {
            id: user._id,
            name: user.name,
            role: user.role,
          },
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          status: leave.status,
          appliedOn: leave.appliedOn,
          reviewedBy: adminId,
          reviewedAt: leave.reviewedAt,
          comments: leave.comments,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getLeaveRequestHistory: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Leave = getModel("Leave", connection);

      // Find all reviewed leaves (both approved and rejected)
      const reviewedLeaves = await Leave.find({
        school: schoolId,
        status: { $in: ["approved", "rejected"] },
      })
        .populate("user", "name role")
        .populate("reviewedBy", "name")
        .sort({ reviewedAt: -1 })
        .lean();

      res.json({
        status: "success",
        count: reviewedLeaves.length,
        leaves: reviewedLeaves.map((leave) => ({
          id: leave._id,
          user: {
            id: leave.user._id,
            name: leave.user.name,
            role: leave.user.role,
          },
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          status: leave.status,
          appliedOn: leave.appliedOn,
          reviewedBy: leave.reviewedBy
            ? {
                id: leave.reviewedBy._id,
                name: leave.reviewedBy.name,
              }
            : null,
          reviewedAt: leave.reviewedAt,
          comments: leave.comments || "",
        })),
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  deleteLeaveRequest: async (req, res) => {
    try {
      const { leaveId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const Leave = getModel("Leave", connection);

      // Find the leave request
      const leave = await Leave.findOne({ _id: leaveId, school: schoolId });

      if (!leave) {
        return res.status(404).json({ message: "Leave request not found" });
      }

      // Delete the leave request
      await Leave.deleteOne({ _id: leaveId });

      res.json({
        status: "success",
        message: "Leave request deleted successfully",
        leaveId: leaveId,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  manageTrustee: async (req, res) => {
    try {
      const { trusteeId } = req.params;
      const { permissions, role } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel("User", connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const trustee = await User.findByIdAndUpdate(
          trusteeId,
          {
            role: "trustee",
            permissions: {
              ...permissions,
              canAccessFinancials: role === "finance_trustee",
              canAccessHrDocs: role === "hr_trustee",
            },
          },
          { new: true, session }
        ).lean();

        if (!trustee) throw new Error("Trustee not found");

        await session.commitTransaction();
        res.json(trustee);
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

  scheduleMeeting: async (req, res) => {
    try {
      const { title, date, type, agenda, attendees } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Meeting = getModel("Meeting", connection);

      const meeting = new Meeting({
        school: schoolId,
        title,
        date,
        type,
        agenda: agenda.map((item) => ({
          ...item,
          duration: item.duration || 30,
        })),
        attendees: attendees.map((attendee) => ({
          user: attendee,
          status: "invited",
        })),
      });

      await meeting.save();
      res.status(201).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  recordMeetingMinutes: async (req, res) => {
    try {
      const { meetingId } = req.params;
      const { minutes, decisions, actionItems } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Meeting = getModel("Meeting", connection);

      const meeting = await Meeting.findOne({
        _id: meetingId,
        school: schoolId,
      });
      if (!meeting)
        return res.status(404).json({ message: "Meeting not found" });

      meeting.minutes = minutes;
      meeting.decisions = decisions;
      meeting.actionItems = actionItems;
      meeting.status = "completed";

      await meeting.save();
      res.status(200).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

 
  generateAttendanceReport: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const { startDate, endDate, type, classId, reportType } = req.query;
      const connection = req.connection;
      const Attendance = getModel("Attendance", connection);
      const User = getModel("User", connection);
      const Class = getModel("Class", connection);

      const query = {
        school: schoolId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate("user", "name", User)
        .populate("class", "name division", Class)
        .lean();

      const report = {
        summary: calculateAttendanceStatistics(attendanceData, reportType),
        details: generateDetailedAttendanceReport(attendanceData, reportType),
        charts: generateAttendanceCharts(attendanceData),
      };

      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // createExamSchedule: async (req, res) => {
  //   const {
  //     examType,
  //     customExamType,
  //     startDate,
  //     endDate,
  //     classId,
  //     subjects,
  //     maxExamsPerDay = 2,
  //     availableRooms,
  //   } = req.body;
  //   const schoolId = req.school._id;
  //   const connection = req.connection;
  //   const Exam = getModel("Exam", connection);
  //   const Class = getModel("Class", connection);
  //   const Subject = getModel("Subject", connection);
  //   const User = getModel("User", connection);

  //   const session = await connection.startSession();
  //   let transactionCommitted = false;

  //   try {
  //     session.startTransaction();

  //     // Validate inputs
  //     const classData = await Class.findById(classId).lean();
  //     if (!classData) throw new Error("Class not found");

  //     // Validate exam type
  //     if (
  //       !["Unit Test", "Midterm", "Final", "Practical", "Other"].includes(
  //         examType
  //       )
  //     ) {
  //       throw new Error("Invalid exam type");
  //     }
  //     if (
  //       examType === "Other" &&
  //       (!customExamType || customExamType.trim() === "")
  //     ) {
  //       throw new Error('Custom exam type is required when selecting "Other"');
  //     }

  //     // Validate subjects
  //     const subjectIds = subjects.map((s) => s.subjectId);
  //     const validSubjects = await Subject.find({
  //       _id: { $in: subjectIds },
  //       class: classId,
  //       school: schoolId,
  //     }).lean();

  //     if (validSubjects.length !== subjects.length) {
  //       const invalidSubjects = subjectIds.filter(
  //         (id) => !validSubjects.some((s) => s._id.toString() === id)
  //       );
  //       throw new Error(
  //         `Invalid subjects for class ${classData.name}: ${invalidSubjects.join(
  //           ", "
  //         )}`
  //       );
  //     }

  //     const subjectMap = validSubjects.reduce((acc, subj) => {
  //       acc[subj._id.toString()] = subj.name;
  //       return acc;
  //     }, {});

  //     // Calculate available days and slots
  //     const start = new Date(startDate);
  //     const end = new Date(endDate);
  //     const daysAvailable =
  //       Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  //     const totalSlots = daysAvailable * maxExamsPerDay;

  //     if (subjects.length > totalSlots) {
  //       throw new Error(
  //         `Not enough days to schedule ${subjects.length} exams with max ${maxExamsPerDay} per day`
  //       );
  //     }

  //     const defaultDurations = {
  //       Midterm: 2,
  //       Final: 3,
  //       "Unit Test": 1,
  //       Practical: 2,
  //       Other: 2,
  //     };

  //     // Default time slots
  //     const defaultTimeSlots = [
  //       { start: "09:00", end: "11:00" },
  //       { start: "13:00", end: "15:00" },
  //     ];

  //     // Fetch students
  //     const students = await User.find({
  //       role: "student",
  //       "studentDetails.class": classId,
  //       school: schoolId,
  //     }).lean();

  //     const examSchedule = [];
  //     let currentDate = new Date(start);
  //     const schedulePlan = distributeExams(
  //       subjects,
  //       daysAvailable,
  //       maxExamsPerDay
  //     );

  //     for (const day of schedulePlan) {
  //       for (const subject of day) {
  //         const defaultDuration = defaultDurations[examType] || 2;
  //         const durationHours = subject.durationHours || defaultDuration;
  //         const durationMinutes = durationHours * 60;

  //         const slotIndex = examSchedule.filter(
  //           (e) =>
  //             e.examDate.toISOString().split("T")[0] ===
  //             currentDate.toISOString().split("T")[0]
  //         ).length;
  //         const defaultSlot = defaultTimeSlots[slotIndex % maxExamsPerDay];

  //         let startTime = subject.startTime || defaultSlot.start;
  //         let endTime =
  //           subject.endTime || calculateEndTime(startTime, durationMinutes);

  //         if (subject.endTime) {
  //           const actualDuration = calculateDuration(startTime, endTime);
  //           if (Math.abs(actualDuration - durationMinutes) > 5) {
  //             throw new Error(
  //               `Duration mismatch for subject ${
  //                 subjectMap[subject.subjectId]
  //               }: specified ${durationHours} hours, but ${startTime}-${endTime} is ${
  //                 actualDuration / 60
  //               } hours`
  //             );
  //           }
  //         }

  //         if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
  //           throw new Error(
  //             `Invalid time format for subject ${
  //               subjectMap[subject.subjectId]
  //             }: ${startTime}-${endTime}`
  //           );
  //         }

  //         const seating = adminController.generateSeatingArrangement(
  //           students,
  //           availableRooms,
  //           students.length
  //         );

  //         const exam = new Exam({
  //           school: schoolId,
  //           examType,
  //           customExamType: examType === "Other" ? customExamType : undefined,
  //           startDate,
  //           endDate,
  //           class: classId,
  //           subject: subject.subjectId,
  //           examDate: new Date(currentDate),
  //           startTime,
  //           endTime,
  //           duration: durationMinutes,
  //           totalMarks: subject.totalMarks,
  //           seatingArrangement: seating,
  //         });

  //         await exam.save({ session });
  //         examSchedule.push(exam);
  //       }
  //       currentDate.setDate(currentDate.getDate() + 1);
  //     }

  //     await session.commitTransaction();
  //     transactionCommitted = true;

  //     const populatedSchedule = await Exam.find({
  //       _id: { $in: examSchedule.map((e) => e._id) },
  //     })
  //       .populate("subject", "name")
  //       .populate("class", "name division")
  //       .lean();

  //     res.status(201).json({
  //       success: true,
  //       schedule: populatedSchedule,
  //       message: "Exam schedule created successfully",
  //     });
  //   } catch (error) {
  //     if (!transactionCommitted) {
  //       await session.abortTransaction();
  //     }
  //     console.error("Error in createExamSchedule:", error);
  //     res.status(500).json({
  //       success: false,
  //       error: error.message,
  //       message: "Failed to create exam schedule",
  //     });
  //   } finally {
  //     session.endSession();
  //   }
  // },


  // createExamSchedule: async (req, res) => {
  //   const {
  //     examName,
  //     examType,
  //     customExamType,
  //     startDate,
  //     endDate,
  //     classIds, // Now supports multiple classes
  //     subjects, // Array of { classId, subjectId, totalMarks, durationHours, startTime, endTime }
  //     maxExamsPerDay = 2,
  //     availableRooms,
  //     roomCapacities, // Object mapping room names to capacities
  //     nonWorkingDays = [],
  //   } = req.body;
  //   const schoolId = req.school._id;
  //   const connection = req.connection;
  //   const ExamEvent = getModel("ExamEvent", connection);
  //   const Exam = getModel("Exam", connection);
  //   const Class = getModel("Class", connection);
  //   const Subject = getModel("Subject", connection);
  //   const User = getModel("User", connection);

  //   const session = await connection.startSession();
  //   let transactionCommitted = false;

  //   try {
  //     session.startTransaction();

  //     // Validate inputs
  //     if (!examName) throw new Error("Exam name is required");
  //     if (!Array.isArray(classIds) || classIds.length === 0) {
  //       throw new Error("At least one class ID is required");
  //     }

  //     const classes = await Class.find({ _id: { $in: classIds } }).lean();
  //     if (classes.length !== classIds.length) {
  //       throw new Error("One or more classes not found");
  //     }

  //     // Validate exam type
  //     if (!["Unit Test", "Midterm", "Final", "Practical", "Other"].includes(examType)) {
  //       throw new Error("Invalid exam type");
  //     }
  //     if (examType === "Other" && (!customExamType || customExamType.trim() === "")) {
  //       throw new Error('Custom exam type is required when selecting "Other"');
  //     }

  //     // Validate startDate
  //     if (!startDate || isNaN(new Date(startDate))) {
  //       throw new Error("Invalid start date");
  //     }

  //     // Validate endDate
  //     if (!endDate || isNaN(new Date(endDate))) {
  //       throw new Error("Invalid end date");
  //     }

  //     // Validate and convert nonWorkingDays
  //     const validatedNonWorkingDays = nonWorkingDays
  //       .map(d => new Date(d))
  //       .filter(d => d instanceof Date && !isNaN(d));
  //     if (nonWorkingDays.length > 0 && validatedNonWorkingDays.length === 0) {
  //       throw new Error("All nonWorkingDays are invalid");
  //     }

  //     // Validate subjects
  //     const subjectMap = {};
  //     for (const sub of subjects) {
  //       const classData = classes.find(c => c._id.toString() === sub.classId);
  //       if (!classData) throw new Error(`Class ${sub.classId} not found for subject ${sub.subjectId}`);

  //       const subject = await Subject.findOne({
  //         _id: sub.subjectId,
  //         class: sub.classId,
  //         school: schoolId,
  //       }).lean();
  //       if (!subject) {
  //         throw new Error(`Invalid subject ${sub.subjectId} for class ${classData.name}`);
  //       }
  //       subjectMap[sub.subjectId] = { ...subject, classId: sub.classId };
  //     }

  //     // Calculate available days
  //     const start = new Date(startDate);
  //     const end = new Date(endDate);
  //     const daysAvailable = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  //     const totalSlots = daysAvailable * maxExamsPerDay;

  //     if (subjects.length > totalSlots) {
  //       throw new Error(
  //         `Not enough days to schedule ${subjects.length} exams with max ${maxExamsPerDay} per day`
  //       );
  //     }

  //     // Create ExamEvent
  //     const examEvent = new ExamEvent({
  //       school: schoolId,
  //       name: examName,
  //       examType,
  //       customExamType: examType === "Other" ? customExamType : undefined,
  //       startDate,
  //       endDate,
  //       classes: classIds,
  //       nonWorkingDays: validatedNonWorkingDays,
  //       createdBy: req.user._id,
  //     });
  //     await examEvent.save({ session });

  //     const defaultDurations = {
  //       Midterm: 2,
  //       Final: 3,
  //       "Unit Test": 1,
  //       Practical: 2,
  //       Other: 2,
  //     };
  //     const defaultTimeSlots = [
  //       { start: "09:00", end: "11:00" },
  //       { start: "13:00", end: "15:00" },
  //     ];

  //     // Fetch students for all classes
  //     const studentsByClass = {};
  //     for (const classId of classIds) {
  //       const students = await User.find({
  //         role: "student",
  //         "studentDetails.class": classId,
  //         school: schoolId,
  //       }).lean();
  //       studentsByClass[classId] = students;
  //     }

  //     // Prepare schedule plan
  //     const schedulePlan = [];
  //     for (const classId of classIds) {
  //       const classSubjects = subjects.filter(s => s.classId === classId).map(s => ({
  //         ...s,
  //         weight: subjectMap[s.subjectId].weight,
  //       }));
  //       const classPlan = distributeExams(classSubjects, daysAvailable, maxExamsPerDay, validatedNonWorkingDays, startDate);
  //       schedulePlan.push({ classId, plan: classPlan });
  //     }

  //     // Check for conflicts
  //     const scheduleForConflicts = [];
  //     for (const { classId, plan } of schedulePlan) {
  //       let currentDate = new Date(startDate);
  //       for (const day of plan) {
  //         for (const subject of day) {
  //           const slotIndex = scheduleForConflicts.filter(
  //             s => s.examDate.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
  //           ).length;
  //           const defaultSlot = defaultTimeSlots[slotIndex % maxExamsPerDay];
  //           const startTime = subject.startTime || defaultSlot.start;
  //           scheduleForConflicts.push({
  //             classId,
  //             subjectId: subject.subjectId,
  //             examDate: new Date(currentDate),
  //             startTime,
  //             rooms: availableRooms,
  //           });
  //         }
  //         currentDate.setDate(currentDate.getDate() + 1);
  //       }
  //     }

  //     const teacherConflicts = await checkTeacherConflicts(scheduleForConflicts, connection);
  //     if (teacherConflicts.length > 0) {
  //       throw new Error(`Teacher conflicts detected: ${JSON.stringify(teacherConflicts)}`);
  //     }

  //     const roomConflicts = await checkRoomConflicts(scheduleForConflicts, connection, schoolId);
  //     if (roomConflicts.length > 0) {
  //       throw new Error(`Room conflicts detected: ${JSON.stringify(roomConflicts)}`);
  //     }

  //     // Create exams
  //     const exams = [];
  //     for (const { classId, plan } of schedulePlan) {
  //       let currentDate = new Date(startDate);
  //       for (const day of plan) {
  //         if (validatedNonWorkingDays.some(d => d.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0])) {
  //           currentDate.setDate(currentDate.getDate() + 1);
  //           continue;
  //         }

  //         for (const subject of day) {
  //           const defaultDuration = defaultDurations[examType] || 2;
  //           const durationHours = subject.durationHours || defaultDuration;
  //           const durationMinutes = durationHours * 60;

  //           const slotIndex = exams.filter(
  //             e => e.examDate.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
  //           ).length;
  //           const defaultSlot = defaultTimeSlots[slotIndex % maxExamsPerDay];

  //           let startTime = subject.startTime || defaultSlot.start;
  //           let endTime = subject.endTime || calculateEndTime(startTime, durationMinutes);

  //           if (subject.endTime) {
  //             const actualDuration = calculateDuration(startTime, endTime);
  //             if (Math.abs(actualDuration - durationMinutes) > 5) {
  //               throw new Error(
  //                 `Duration mismatch for subject ${
  //                   subjectMap[subject.subjectId].name
  //                 }: specified ${durationHours} hours, but ${startTime}-${endTime} is ${
  //                   actualDuration / 60
  //                 } hours`
  //               );
  //             }
  //           }

  //           if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
  //             throw new Error(
  //               `Invalid time format for subject ${
  //                 subjectMap[subject.subjectId].name
  //               }: ${startTime}-${endTime}`
  //             );
  //           }

  //           const students = studentsByClass[classId];
  //           const seating = generateSeatingArrangement(
  //             students,
  //             availableRooms,
  //             students.length,
  //             roomCapacities
  //           );

  //           const exam = new Exam({
  //             school: schoolId,
  //             examEvent: examEvent._id,
  //             examType,
  //             customExamType: examType === "Other" ? customExamType : undefined,
  //             class: classId,
  //             subject: subject.subjectId,
  //             examDate: new Date(currentDate),
  //             startTime,
  //             endTime,
  //             duration: durationMinutes,
  //             totalMarks: subject.totalMarks,
  //             seatingArrangement: seating,
  //           });

  //           exams.push(exam);
  //         }
  //         currentDate.setDate(currentDate.getDate() + 1);
  //       }
  //     }

  //     // Bulk save exams
  //     await Exam.insertMany(exams, { session });

  //     // Update ExamEvent status
  //     await ExamEvent.updateOne(
  //       { _id: examEvent._id },
  //       { status: "scheduled" },
  //       { session }
  //     );

  //     await session.commitTransaction();
  //     transactionCommitted = true;

  //     const populatedSchedule = await Exam.find({
  //       _id: { $in: exams.map(e => e._id) },
  //     })
  //       .populate("subject", "name")
  //       .populate("class", "name division")
  //       .lean();

  //     res.status(201).json({
  //       success: true,
  //       examEvent: {
  //         id: examEvent._id,
  //         name: examEvent.name,
  //         status: examEvent.status,
  //       },
  //       schedule: populatedSchedule,
  //       message: "Exam schedule created successfully",
  //     });
  //   } catch (error) {
  //     if (!transactionCommitted) {
  //       await session.abortTransaction();
  //     }
  //     console.error("Error in createExamSchedule:", error);
  //     res.status(500).json({
  //       success: false,
  //       error: error.message,
  //       message: "Failed to create exam schedule",
  //     });
  //   } finally {
  //     session.endSession();
  //   }
  // },


  createExamSchedule: async (req, res) => {
    const {
      examName,
      examType,
      customExamType,
      startDate,
      endDate,
      classIds, // Now supports multiple classes
      subjects, // Array of { classId, subjectId, totalMarks, durationHours, startTime, endTime }
      maxExamsPerDay = 2,
      availableRooms,
      roomCapacities, // Object mapping room names to capacities
      nonWorkingDays = [],
    } = req.body;
    const schoolId = req.school._id;
    const connection = req.connection;
    const ExamEvent = getModel("ExamEvent", connection);
    const Exam = getModel("Exam", connection);
    const Class = getModel("Class", connection);
    const Subject = getModel("Subject", connection);
    const User = getModel("User", connection);
    

    const session = await connection.startSession();
    let transactionCommitted = false;

    try {
      session.startTransaction();

      // Validate inputs
      if (!examName) throw new Error("Exam name is required");
      if (!Array.isArray(classIds) || classIds.length === 0) {
        throw new Error("At least one class ID is required");
      }

      const classes = await Class.find({ _id: { $in: classIds } }).lean();
      if (classes.length !== classIds.length) {
        throw new Error("One or more classes not found");
      }

      // Validate exam type
      if (!["Unit Test", "Midterm", "Final", "Practical", "Other"].includes(examType)) {
        throw new Error("Invalid exam type");
      }
      if (examType === "Other" && (!customExamType || customExamType.trim() === "")) {
        throw new Error('Custom exam type is required when selecting "Other"');
      }

      // Validate startDate
      if (!startDate || isNaN(new Date(startDate))) {
        throw new Error("Invalid start date");
      }

      // Validate endDate
      if (!endDate || isNaN(new Date(endDate))) {
        throw new Error("Invalid end date");
      }

      // Validate and convert nonWorkingDays
      const validatedNonWorkingDays = nonWorkingDays
        .map(d => new Date(d))
        .filter(d => d instanceof Date && !isNaN(d));
      if (nonWorkingDays.length > 0 && validatedNonWorkingDays.length === 0) {
        throw new Error("All nonWorkingDays are invalid");
      }

      // Validate subjects
      const subjectMap = {};
      for (const sub of subjects) {
        const classData = classes.find(c => c._id.toString() === sub.classId);
        if (!classData) throw new Error(`Class ${sub.classId} not found for subject ${sub.subjectId}`);

        const subject = await Subject.findOne({
          _id: sub.subjectId,
          class: sub.classId,
          school: schoolId,
        }).lean();
        if (!subject) {
          throw new Error(`Invalid subject ${sub.subjectId} for class ${classData.name}`);
        }
        subjectMap[sub.subjectId] = { ...subject, classId: sub.classId };
      }

      // Calculate available days
      const start = new Date(startDate);
      const end = new Date(endDate);
      const daysAvailable = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      const totalSlots = daysAvailable * maxExamsPerDay;

      if (subjects.length > totalSlots) {
        throw new Error(
          `Not enough days to schedule ${subjects.length} exams with max ${maxExamsPerDay} per day`
        );
      }

      // Create ExamEvent
      const examEvent = new ExamEvent({
        school: schoolId,
        name: examName,
        examType,
        customExamType: examType === "Other" ? customExamType : undefined,
        startDate,
        endDate,
        classes: classIds,
        nonWorkingDays: validatedNonWorkingDays,
        createdBy: req.user._id,
      });
      await examEvent.save({ session });

      const defaultDurations = {
        Midterm: 2,
        Final: 3,
        "Unit Test": 1,
        Practical: 2,
        Other: 2,
      };
      const defaultTimeSlots = [
        { start: "09:00", end: "11:00" },
        { start: "13:00", end: "15:00" },
      ];

      // Fetch students for all classes
      const studentsByClass = {};
      for (const classId of classIds) {
        const students = await User.find({
          role: "student",
          "studentDetails.class": classId,
          school: schoolId,
        }).lean();
        studentsByClass[classId] = students;
      }

      // Prepare schedule plan
      const schedulePlan = [];
      for (const classId of classIds) {
        const classSubjects = subjects.filter(s => s.classId === classId).map(s => ({
          ...s,
          weight: subjectMap[s.subjectId].weight,
        }));
        const classPlan = distributeExams(classSubjects, daysAvailable, maxExamsPerDay, validatedNonWorkingDays, startDate);
        schedulePlan.push({ classId, plan: classPlan });
      }

      // Check for conflicts
      const scheduleForConflicts = [];
      for (const { classId, plan } of schedulePlan) {
        let currentDate = new Date(startDate);
        for (const day of plan) {
          for (const subject of day) {
            const slotIndex = scheduleForConflicts.filter(
              s => s.examDate.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
            ).length;
            const defaultSlot = defaultTimeSlots[slotIndex % maxExamsPerDay];
            const startTime = subject.startTime || defaultSlot.start;
            scheduleForConflicts.push({
              classId,
              subjectId: subject.subjectId,
              examDate: new Date(currentDate),
              startTime,
              rooms: availableRooms,
            });
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const teacherConflicts = await checkTeacherConflicts(scheduleForConflicts, connection);
      if (teacherConflicts.length > 0) {
        throw new Error(`Teacher conflicts detected: ${JSON.stringify(teacherConflicts)}`);
      }

      const roomConflicts = await checkRoomConflicts(scheduleForConflicts, connection, schoolId);
      if (roomConflicts.length > 0) {
        throw new Error(`Room conflicts detected: ${JSON.stringify(roomConflicts)}`);
      }

      // Create exams
      const exams = [];
      for (const { classId, plan } of schedulePlan) {
        let currentDate = new Date(startDate);
        for (const day of plan) {
          if (validatedNonWorkingDays.some(d => d.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0])) {
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          for (const subject of day) {
            const defaultDuration = defaultDurations[examType] || 2;
            const durationHours = subject.durationHours || defaultDuration;
            const durationMinutes = durationHours * 60;

            const slotIndex = exams.filter(
              e => e.examDate.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0]
            ).length;
            const defaultSlot = defaultTimeSlots[slotIndex % maxExamsPerDay];

            let startTime = subject.startTime || defaultSlot.start;
            let endTime = subject.endTime || calculateEndTime(startTime, durationMinutes);

            if (subject.endTime) {
              const actualDuration = calculateDuration(startTime, endTime);
              if (Math.abs(actualDuration - durationMinutes) > 5) {
                throw new Error(
                  `Duration mismatch for subject ${
                    subjectMap[subject.subjectId].name
                  }: specified ${durationHours} hours, but ${startTime}-${endTime} is ${
                    actualDuration / 60
                  } hours`
                );
              }
            }

            if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
              throw new Error(
                `Invalid time format for subject ${
                  subjectMap[subject.subjectId].name
                }: ${startTime}-${endTime}`
              );
            }

            const students = studentsByClass[classId];
            const seating = generateSeatingArrangement(
              students,
              availableRooms,
              students.length,
              roomCapacities
            );

            const exam = new Exam({
              school: schoolId,
              examEvent: examEvent._id,
              examType,
              customExamType: examType === "Other" ? customExamType : undefined,
              class: classId,
              subject: subject.subjectId,
              examDate: new Date(currentDate),
              startTime,
              endTime,
              duration: durationMinutes,
              totalMarks: subject.totalMarks,
              seatingArrangement: seating,
            });

            exams.push(exam);
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      // Bulk save exams
      await Exam.insertMany(exams, { session });

      // Update ExamEvent status
      const updateResult = await ExamEvent.updateOne(
        { _id: examEvent._id },
        { $set: { status: "scheduled" } },
        { session }
      );
      if (updateResult.matchedCount === 0) {
        throw new Error("Failed to update ExamEvent status");
      }

      await session.commitTransaction();
      transactionCommitted = true;

      const populatedSchedule = await Exam.find({
        _id: { $in: exams.map(e => e._id) },
      })
        .populate("subject", "name")
        .populate("class", "name division")
        .lean();

      // Fetch updated ExamEvent to confirm status
      const updatedExamEvent = await ExamEvent.findById(examEvent._id).lean();

      res.status(201).json({
        success: true,
        examEvent: {
          id: examEvent._id,
          name: examEvent.name,
          status: updatedExamEvent.status,
        },
        schedule: populatedSchedule,
        message: "Exam schedule created successfully",
      });
    } catch (error) {
      if (!transactionCommitted) {
        await session.abortTransaction();
      }
      console.error("Error in createExamSchedule:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Failed to create exam schedule",
      });
    } finally {
      session.endSession();
    }
  },

  // getExamSchedules: async (req, res) => {
  //   try {
  //     const schoolId = req.school._id;
  //     const connection = req.connection;
  //     const Exam = getModel("Exam", connection);
  //     const Class = getModel("Class", connection);
  //     const Subject = getModel("Subject", connection);
  //     const User = getModel("User", connection);

  //     const exams = await Exam.find({ school: schoolId })
  //       .populate("class", "name division", Class)
  //       .populate("subject", "name", Subject)
  //       .populate({
  //         path: "seatingArrangement.arrangement.students.student",
  //         model: User,
  //         select: "name",
  //       })
  //       .sort({ examDate: 1, startTime: 1 })
  //       .lean();

  //     if (!exams.length) {
  //       return res.status(404).json({ message: "No exam schedules found" });
  //     }

  //     const scheduleByDate = exams.reduce((acc, exam) => {
  //       if (
  //         !exam.examDate ||
  //         !(exam.examDate instanceof Date) ||
  //         isNaN(exam.examDate.getTime())
  //       ) {
  //         console.warn(
  //           `Invalid examDate for exam ${exam._id}: ${exam.examDate}`
  //         );
  //         const fallbackDate = new Date().toISOString().split("T")[0];
  //         acc[fallbackDate] = acc[fallbackDate] || [];
  //         acc[fallbackDate].push({
  //           ...exam,
  //           examDate: new Date(fallbackDate),
  //           displayExamType:
  //             exam.examType === "Other" ? exam.customExamType : exam.examType,
  //         });
  //         return acc;
  //       }

  //       const dateKey = exam.examDate.toISOString().split("T")[0];
  //       acc[dateKey] = acc[dateKey] || [];
  //       acc[dateKey].push({
  //         ...exam,
  //         displayExamType:
  //           exam.examType === "Other" ? exam.customExamType : exam.examType,
  //       });
  //       return acc;
  //     }, {});

  //     Object.keys(scheduleByDate).forEach((date) => {
  //       scheduleByDate[date].sort((a, b) => {
  //         if (!a.startTime || !b.startTime) return 0;
  //         return a.startTime.localeCompare(b.startTime);
  //       });
  //     });

  //     res.status(200).json({
  //       success: true,
  //       schedule: scheduleByDate,
  //       totalExams: exams.length,
  //       message: "Exam schedules retrieved successfully",
  //     });
  //   } catch (error) {
  //     console.error("Error in getExamSchedules:", error);
  //     res.status(500).json({
  //       success: false,
  //       error: error.message,
  //       message: "Failed to retrieve exam schedules",
  //     });
  //   }
  // },

  getExamSchedules: async (req, res) => {
    const schoolId = req.school._id;
    const connection = req.connection;
    const Exam = getModel("Exam", connection);

    try {
      const exams = await Exam.find({ school: schoolId })
        .populate("subject", "name")
        .populate("class", "name division")
        .populate("examEvent", "name examType customExamType")
        .lean();

      if (!exams.length) {
        return res.status(404).json({ message: "No exam schedules found" });
      }

      const schedule = {};
      exams.forEach((exam) => {
        const dateKey = exam.examDate.toISOString().split("T")[0];
        if (!schedule[dateKey]) {
          schedule[dateKey] = [];
        }
        schedule[dateKey].push({
          ...exam,
          examType: exam.examType === "Other" ? exam.examEvent.customExamType : exam.examType,
          displayExamType: exam.examType === "Other" ? exam.examEvent.customExamType : exam.examType,
        });
      });

      // Sort exams by startTime within each date
      Object.keys(schedule).forEach((date) => {
        schedule[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      res.status(200).json({
        success: true,
        schedule,
        totalExams: exams.length,
        message: "Exam schedules retrieved successfully",
      });
    } catch (error) {
      console.error("Error in getExamSchedules:", error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: "Failed to retrieve exam schedules",
      });
    }
  },
  

  enterResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const { results } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = getModel("Exam", connection);
      const Result = getModel("Result", connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const examSchedule = await Exam.findById(examId).lean();
        if (!examSchedule) throw new Error("Exam schedule not found");

        const resultPromises = results.map(async (studentResult) => {
          const result = new Result({
            school: schoolId,
            student: studentResult.studentId,
            exam: examId,
            class: classId,
            subjects: studentResult.subjects,
            totalMarks: calculateTotalMarks(studentResult.subjects),
            percentage: calculatePercentage(studentResult.subjects),
            grade: calculateGrade(studentResult.subjects),
            status: determineStatus(studentResult.subjects),
            publishedBy: req.user._id,
          });
          return result.save({ session });
        });

        await Promise.all(resultPromises);
        await session.commitTransaction();
        res.json({ message: "Results entered successfully" });
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

  generateReportCards: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Result = getModel("Result", connection);
      const Exam = getModel("Exam", connection);
      const User = getModel("User", connection);
      const Subject = getModel("Subject", connection);

      const results = await Result.find({
        school: schoolId,
        class: classId,
        exam: {
          $in: await Exam.find({
            class: classId,
            examDate: new Date(examId),
          }).distinct("_id"),
        },
      })
        .populate("student", "name profile", User)
        .populate("exam", "examType", Exam)
        .populate("subject", "name", Subject)
        .lean();

      const classStats = calculateClassStatistics(results);
      const reportCards = results
        .reduce((acc, result) => {
          let card = acc.find(
            (c) => c.student.id.toString() === result.student._id.toString()
          );
          if (!card) {
            card = {
              student: {
                id: result.student._id,
                name: result.student.name,
                profile: result.student.profile,
              },
              exam: { id: result.exam._id, type: result.exam.examType },
              class: result.class,
              subjects: [],
              totalMarks: 0,
              percentage: 0,
              grade: "",
            };
            acc.push(card);
          }
          card.subjects.push({
            subjectId: result.subject._id,
            subjectName: result.subject.name,
            marks: result.marksObtained,
            totalMarks: result.totalMarks,
            remarks: result.remarks,
          });
          return acc;
        }, [])
        .map((card) => {
          card.totalMarks = calculateTotalMarks(card.subjects);
          card.percentage = calculatePercentage(card.subjects);
          card.grade = calculateGrade(card.subjects);
          card.classRank = classStats.totalStudents
            ? Math.floor(
                ((classStats.highestPercentage - card.percentage) /
                  (classStats.highestPercentage -
                    classStats.lowestPercentage)) *
                  (classStats.totalStudents - 1)
              ) + 1
            : 1;
          card.classAverage = classStats.averagePercentage;
          return card;
        });

      res.json(reportCards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  trackPerformanceMetrics: async (req, res) => {
    try {
      const { classId, examId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Result = getModel("Result", connection);
      const Exam = getModel("Exam", connection);
      const Subject = getModel("Subject", connection);

      const results = await Result.find({
        school: schoolId,
        class: classId,
        exam: {
          $in: await Exam.find({
            class: classId,
            examDate: new Date(examId),
          }).distinct("_id"),
        },
      })
        .populate("exam", "examType", Exam)
        .populate("subject", "name", Subject)
        .lean();

      const metrics = {
        byStudent: new Map(),
        bySubject: new Map(),
        overall: { average: 0, highest: 0, lowest: Infinity, passRate: 0 },
      };

      results.forEach((result) => {
        const percentage = (result.marksObtained / result.totalMarks) * 100;

        // Student metrics
        if (!metrics.byStudent.has(result.student.toString())) {
          metrics.byStudent.set(result.student.toString(), {
            total: 0,
            count: 0,
            subjects: [],
          });
        }
        const studentStats = metrics.byStudent.get(result.student.toString());
        studentStats.total += percentage;
        studentStats.count++;
        studentStats.subjects.push({
          subject: result.subject.name,
          percentage,
        });

        // Subject metrics
        if (!metrics.bySubject.has(result.subject._id.toString())) {
          metrics.bySubject.set(result.subject._id.toString(), {
            total: 0,
            count: 0,
            name: result.subject.name,
          });
        }
        const subjectStats = metrics.bySubject.get(
          result.subject._id.toString()
        );
        subjectStats.total += percentage;
        subjectStats.count++;

        // Overall metrics
        metrics.overall.average =
          (metrics.overall.average * (metrics.overall.count || 0) +
            percentage) /
          ((metrics.overall.count || 0) + 1);
        metrics.overall.highest = Math.max(metrics.overall.highest, percentage);
        metrics.overall.lowest = Math.min(metrics.overall.lowest, percentage);
        metrics.overall.count = (metrics.overall.count || 0) + 1;
        if (percentage >= 40) metrics.overall.passRate++;
      });

      metrics.overall.passRate =
        (metrics.overall.passRate / metrics.overall.count) * 100;
      metrics.byStudent = Array.from(
        metrics.byStudent,
        ([studentId, stats]) => ({
          studentId,
          average: stats.total / stats.count,
          subjects: stats.subjects,
        })
      );
      metrics.bySubject = Array.from(
        metrics.bySubject,
        ([subjectId, stats]) => ({
          subjectId,
          name: stats.name,
          average: stats.total / stats.count,
        })
      );

      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

// Helper Functions


const generateSeatingArrangement = (
  students,
  availableRooms,
  totalStudents,
  roomCapacities
) => {
  const seatingArrangement = [];
  const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
  let studentIndex = 0;

  for (const room of availableRooms) {
    const capacity = roomCapacities[room] || 30; // Default capacity
    const roomStudents = shuffledStudents.slice(studentIndex, studentIndex + capacity);
    if (roomStudents.length === 0) break;

    const arrangement = [];
    const rows = Math.ceil(roomStudents.length / 5);
    for (let i = 0; i < rows; i++) {
      const rowStudents = roomStudents.slice(i * 5, (i + 1) * 5);
      arrangement.push({
        row: i + 1,
        students: rowStudents.map((student, pos) => ({
          student: student._id,
          position: pos + 1,
        })),
      });
    }

    seatingArrangement.push({
      classroom: room,
      capacity: roomStudents.length,
      arrangement,
    });

    studentIndex += capacity;
  }

  if (studentIndex < totalStudents) {
    throw new Error("Not enough room capacity to accommodate all students");
  }

  return seatingArrangement;
};


const storage = multer.memoryStorage();
const uploadExcelResults = (req, res, next) => {
  const upload = multer({
    storage: multer.memoryStorage(), // Keep using memory storage to maintain buffer access
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      if (allowedTypes.includes(file.mimetype)) {
        console.log(`File type accepted: ${file.mimetype}`);
        cb(null, true);
      } else {
        console.error(`Invalid file type: ${file.mimetype}`);
        cb(
          new Error(
            `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
          ),
          false
        );
      }
    },
  }).single("file");

  console.log("Applying uploadExcelResults middleware");
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error(`Multer error: ${err.message}`);
      return res.status(400).json({ success: false, error: `Multer error: ${err.message}` });
    } else if (err) {
      console.error(`File upload error: ${err.message}`);
      return res.status(400).json({ success: false, error: err.message });
    }
    console.log(`req.file after upload:`, req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: !!req.file.buffer
    } : null);
    next();
  });
};




// const generateMarksheetPDF = async ({ student, classInfo, examEvent, subjects, exams }) => {
//   return new Promise((resolve, reject) => {
//     const doc = new PDFDocument({ size: "A4", margin: 50 });
//     const buffers = [];

//     doc.on("data", buffers.push.bind(buffers));
//     doc.on("end", () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });
//     doc.on("error", reject);

//     // Header
//     doc.fontSize(20).text("Marksheet", { align: "center" });
//     doc.moveDown();
//     doc.fontSize(12).text(`Student: ${student.name}`, { align: "left" });
//     doc.text(`GR Number: ${student.studentDetails?.grNumber || "N/A"}`);
//     doc.text(`Class: ${classInfo.name} - ${classInfo.division}`);
//     doc.text(`Exam: ${examEvent.examType === "Other" ? examEvent.customExamType : examEvent.examType}`);
//     doc.moveDown();

//     // Table Header
//     doc.fontSize(10).font("Helvetica-Bold");
//     const tableTop = doc.y;
//     const col1 = 50,
//           col2 = 200,
//           col3 = 300,
//           col4 = 400;
//     doc.text("Subject", col1, tableTop);
//     doc.text("Marks Obtained", col2, tableTop);
//     doc.text("Total Marks", col3, tableTop);
//     doc.text("Percentage", col4, tableTop);
//     doc.moveDown(0.5);

//     // Table Rows
//     doc.font("Helvetica");
//     let totalObtained = 0,
//         totalPossible = 0;
//     subjects.forEach((subject, index) => {
//       const y = doc.y;
//       doc.text(subject.name, col1, y);
//       doc.text(subject.marksObtained.toString(), col2, y);
//       doc.text(subject.totalMarks.toString(), col3, y);
//       const percentage = (subject.marksObtained / subject.totalMarks) * 100;
//       doc.text(`${percentage.toFixed(2)}%`, col4, y);
//       totalObtained += subject.marksObtained;
//       totalPossible += subject.totalMarks;
//       doc.moveDown(0.5);
//     });

//     // Summary
//     doc.moveDown();
//     doc.font("Helvetica-Bold");
//     doc.text(`Total Marks: ${totalObtained} / ${totalPossible}`);
//     const overallPercentage = totalPossible ? (totalObtained / totalPossible) * 100 : 0;
//     doc.text(`Overall Percentage: ${overallPercentage.toFixed(2)}%`);
//     doc.text(`Grade: ${calculateGrade([{ percentage: overallPercentage }])}`);

//     doc.end();
//   });
// };

const generateMarksheetPDF = async ({ student, classInfo, examEvent, subjects, exams, schoolInfo }) => {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));

  const endPromise = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
  });

  // Header with school details
  doc.fontSize(16).font("Helvetica-Bold");
  doc.text(schoolInfo?.name || "SCHOOL NAME", { align: "center" });
  doc.fontSize(10).font("Helvetica");
  doc.text(schoolInfo?.address || "School Address", { align: "center" });
  doc.moveDown();

  // Add logo if available
  if (schoolInfo?.logo?.url) {
    try {
      const response = await axios.get(schoolInfo.logo.url, { responseType: 'arraybuffer' });
      const logoBuffer = Buffer.from(response.data);
      doc.image(logoBuffer, 50, 30, { width: 100, align: 'left' });
    } catch (error) {
      console.error('Error fetching logo for PDF:', error.message);
    }
  }

  doc.moveDown(2);
  doc.fontSize(20).font("Helvetica-Bold").text("Marksheet", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).font("Helvetica");
  doc.text(`Student: ${student.name}`, { align: "left" });
  doc.text(`GR Number: ${student.studentDetails?.grNumber || "N/A"}`);
  doc.text(`Class: ${classInfo.name} - ${classInfo.division || ''}`);
  doc.text(`Exam: ${examEvent.examType === "Other" ? examEvent.customExamType : examEvent.examType}`);
  doc.moveDown();

  // Table Header
  doc.fontSize(10).font("Helvetica-Bold");
  const tableTop = doc.y;
  const col1 = 50, col2 = 200, col3 = 300, col4 = 400;
  doc.text("Subject", col1, tableTop);
  doc.text("Marks Obtained", col2, tableTop);
  doc.text("Total Marks", col3, tableTop);
  doc.text("Percentage", col4, tableTop);
  doc.moveDown(0.5);

  // Table Rows
  doc.font("Helvetica");
  let totalObtained = 0, totalPossible = 0;
  subjects.forEach((subject) => {
    const y = doc.y;
    doc.text(subject.name, col1, y);
    doc.text(subject.marksObtained.toString(), col2, y);
    doc.text(subject.totalMarks.toString(), col3, y);
    const percentage = (subject.marksObtained / subject.totalMarks) * 100;
    doc.text(`${percentage.toFixed(2)}%`, col4, y);
    totalObtained += subject.marksObtained;
    totalPossible += subject.totalMarks;
    doc.moveDown(0.5);
  });

  // Summary
  // doc.moveDown();
  // doc.font("Helvetica-Bold");
  // doc.text(`Total Marks: ${totalObtained} / ${totalPossible}`);
  // const overallPercentage = totalPossible ? (totalObtained / totalPossible) * 100 : 0;
  // doc.text(`Overall Percentage: ${overallPercentage.toFixed(2)}%`);
  // doc.text(`Grade: ${calculateGrade(overallPercentage)}`);

  //     // Summary
    doc.moveDown();
    doc.font("Helvetica-Bold");
    doc.text(`Total Marks: ${totalObtained} / ${totalPossible}`);
    const overallPercentage = totalPossible ? (totalObtained / totalPossible) * 100 : 0;
    doc.text(`Overall Percentage: ${overallPercentage.toFixed(2)}%`);
    doc.text(`Grade: ${calculateGrade([{ percentage: overallPercentage }])}`);

  doc.end();
  return endPromise;
};


const getDefaultPermissions = (role) => {
  const permissions = {
    canTakeAttendance: [],
    canEnterMarks: [],
    canPublishAnnouncements: false,
    canManageInventory: false,
    canManageFees: false,
    canManageLibrary: false,
  };

  switch (role) {
    case "teacher":
      permissions.canEnterMarks = [];
      break;
    case "librarian":
      permissions.canManageLibrary = true;
      break;
    case "inventory_manager":
      permissions.canManageInventory = true;
      break;
    case "fee_manager":
      permissions.canManageFees = true;
      break;
  }

  return permissions;
};

// const checkTeacherConflicts = async (schedule) => {
//   const conflicts = [];
//   const teacherSchedule = {};

//   schedule.forEach((slot) => {
//     const key = `${slot.day}-${slot.period}`;
//     if (teacherSchedule[key]?.includes(slot.teacher)) {
//       conflicts.push({
//         teacher: slot.teacher,
//         day: slot.day,
//         period: slot.period,
//       });
//     } else {
//       teacherSchedule[key] = teacherSchedule[key] || [];
//       teacherSchedule[key].push(slot.teacher);
//     }
//   });

//   return conflicts;
// };

const checkTeacherConflicts = async (schedule, connection) => {
  const Subject = getModel("Subject", connection);
  const conflicts = [];
  const teacherSchedule = {};

  for (const slot of schedule) {
    const subject = await Subject.findById(slot.subjectId).lean();
    const teachers = subject.teachers.map(t => t.teacher.toString());
    const key = `${slot.examDate.toISOString().split("T")[0]}-${slot.startTime}`;

    for (const teacher of teachers) {
      if (teacherSchedule[key]?.includes(teacher)) {
        conflicts.push({
          teacher,
          examDate: slot.examDate,
          startTime: slot.startTime,
          subjectId: slot.subjectId,
        });
      } else {
        teacherSchedule[key] = teacherSchedule[key] || [];
        teacherSchedule[key].push(teacher);
      }
    }
  }

  return conflicts;
};

const optimizeSchedule = (schedule, constraints) => {
  const optimizedSchedule = [...schedule];
  optimizedSchedule.sort(
    (a, b) =>
      (constraints.subjectWeights[b.subject] || 1) -
      (constraints.subjectWeights[a.subject] || 1)
  );

  const daysPerWeek = 5;
  const periodsPerDay = 8;
  const distribution = Array(daysPerWeek)
    .fill()
    .map(() => Array(periodsPerDay).fill(null));

  optimizedSchedule.forEach((slot) => {
    let placed = false;
    for (let day = 0; day < daysPerWeek && !placed; day++) {
      for (let period = 0; period < periodsPerDay && !placed; period++) {
        if (
          !distribution[day][period] &&
          isValidPlacement(slot, day, period, constraints)
        ) {
          distribution[day][period] = slot;
          placed = true;
        }
      }
    }
  });

  return distribution.flat().filter(Boolean);
};

const isValidPlacement = (slot, day, period, constraints) => {
  const { subjectWeights, labRequirements } = constraints;
  if (subjectWeights[slot.subject] > 2 && period > 5) return false;
  if (labRequirements.includes(slot.subject)) return false;
  if (period > 0 && isHeavySubject(slot.subject, subjectWeights)) {
    const previousSlot = distribution[day][period - 1];
    if (previousSlot && isHeavySubject(previousSlot.subject, subjectWeights))
      return false;
  }
  return true;
};

const isHeavySubject = (subject, subjectWeights) =>
  (subjectWeights[subject] || 1) > 2;

const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const calculateAttendanceStatistics = (attendanceData, reportType) => {
  const statistics = {
    totalPresent: 0,
    totalAbsent: 0,
    totalLate: 0,
    percentagePresent: 0,
    trendByPeriod: [],
    studentWiseAnalysis: new Map(),
  };

  const groupedData = groupAttendanceByPeriod(attendanceData, reportType);
  groupedData.forEach((period) => {
    const periodStats = {
      present: period.filter((a) => a.status === "present").length,
      absent: period.filter((a) => a.status === "absent").length,
      late: period.filter((a) => a.status === "late").length,
    };

    statistics.totalPresent += periodStats.present;
    statistics.totalAbsent += periodStats.absent;
    statistics.totalLate += periodStats.late;

    const total = periodStats.present + periodStats.absent + periodStats.late;
    const percentage = total ? (periodStats.present / total) * 100 : 0;

    statistics.trendByPeriod.push({
      period: period[0].date.toISOString().split("T")[0],
      percentage,
    });

    period.forEach((record) => {
      if (!statistics.studentWiseAnalysis.has(record.user._id.toString())) {
        statistics.studentWiseAnalysis.set(record.user._id.toString(), {
          name: record.user.name,
          present: 0,
          absent: 0,
          late: 0,
        });
      }
      const studentStats = statistics.studentWiseAnalysis.get(
        record.user._id.toString()
      );
      studentStats[record.status]++;
    });
  });

  const total =
    statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
  statistics.percentagePresent = total
    ? (statistics.totalPresent / total) * 100
    : 0;

  return statistics;
};

const generateDetailedAttendanceReport = (attendanceData, reportType) => {
  const report = {
    byClass: new Map(),
    byTeacher: new Map(),
    byDate: new Map(),
  };

  attendanceData.forEach((record) => {
    const classId = record.class._id.toString();
    if (!report.byClass.has(classId)) {
      report.byClass.set(classId, {
        className: `${record.class.name}-${record.class.division}`,
        present: 0,
        absent: 0,
        late: 0,
      });
    }
    const classStats = report.byClass.get(classId);
    classStats[record.status]++;

    if (record.markedBy) {
      const teacherId = record.markedBy.toString();
      if (!report.byTeacher.has(teacherId)) {
        report.byTeacher.set(teacherId, {
          recordsMarked: 0,
          classes: new Set(),
        });
      }
      const teacherStats = report.byTeacher.get(teacherId);
      teacherStats.recordsMarked++;
      teacherStats.classes.add(classId);
    }

    const dateKey = record.date.toISOString().split("T")[0];
    if (!report.byDate.has(dateKey)) {
      report.byDate.set(dateKey, { present: 0, absent: 0, late: 0 });
    }
    const dateStats = report.byDate.get(dateKey);
    dateStats[record.status]++;
  });

  return {
    classWise: Array.from(report.byClass, ([id, stats]) => ({ id, ...stats })),
    teacherWise: Array.from(report.byTeacher, ([id, stats]) => ({
      id,
      ...stats,
      classes: Array.from(stats.classes),
    })),
    dateWise: Array.from(report.byDate, ([date, stats]) => ({
      date,
      ...stats,
    })),
  };
};

const generateAttendanceCharts = (attendanceData) => {
  const trendsOverTime = [];
  const classComparison = new Map();
  const dayWisePatterns = new Map(
    ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => [
      day,
      { present: 0, absent: 0, late: 0 },
    ])
  );

  attendanceData.forEach((record) => {
    const dateStr = record.date.toISOString().split("T")[0];
    const dayName = new Date(record.date).toLocaleString("en-US", {
      weekday: "short",
    });

    if (!trendsOverTime.some((t) => t.date === dateStr)) {
      trendsOverTime.push({ date: dateStr, present: 0, absent: 0, late: 0 });
    }
    const trend = trendsOverTime.find((t) => t.date === dateStr);
    trend[record.status]++;

    const classId = record.class._id.toString();
    if (!classComparison.has(classId)) {
      classComparison.set(classId, {
        name: `${record.class.name}-${record.class.division}`,
        present: 0,
        absent: 0,
        late: 0,
      });
    }
    const classStats = classComparison.get(classId);
    classStats[record.status]++;

    if (dayWisePatterns.has(dayName)) {
      dayWisePatterns.get(dayName)[record.status]++;
    }
  });

  return {
    trendsOverTime,
    classComparison: Array.from(classComparison.values()),
    dayWisePatterns: Array.from(dayWisePatterns, ([day, stats]) => ({
      day,
      ...stats,
    })),
  };
};

// const calculateGrade = (subjects) => {
//   const percentage = calculatePercentage(subjects);
//   if (percentage >= 90) return "A+";
//   if (percentage >= 80) return "A";
//   if (percentage >= 70) return "B+";
//   if (percentage >= 60) return "B";
//   if (percentage >= 50) return "C+";
//   if (percentage >= 40) return "C";
//   return "F";
// };

const calculateGrade = (results) => {
  const percentage = results[0].percentage || 0;
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C+";
  if (percentage >= 40) return "C";
  return "F";
};

const groupAttendanceByPeriod = (attendanceData, reportType) => {
  const grouped = new Map();
  attendanceData.forEach((record) => {
    const periodKey = getPeriodKey(record.date, reportType);
    if (!grouped.has(periodKey)) grouped.set(periodKey, []);
    grouped.get(periodKey).push(record);
  });
  return Array.from(grouped.values());
};

const getPeriodKey = (date, reportType) => {
  const d = new Date(date);
  switch (reportType) {
    case "daily":
      return d.toISOString().split("T")[0];
    case "weekly":
      return `${d.getFullYear()}-W${getWeekNumber(d)}`;
    case "monthly":
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    case "yearly":
      return d.getFullYear().toString();
    default:
      return d.toISOString().split("T")[0];
  }
};

const getWeekNumber = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

// Fully Implemented Helper Functions
const generateStudentReportCards = (classResult) => {
  const reportCards = [];
  const subjectMarks = classResult.subjectMarks || [];

  subjectMarks.forEach((subjectMark) => {
    subjectMark.students.forEach((student) => {
      const existingCard = reportCards.find(
        (card) => card.student.toString() === student.student.toString()
      );
      const subjectData = {
        subject: subjectMark.subject._id,
        subjectName: subjectMark.subject.name,
        marks: student.marks,
        totalMarks: subjectMark.totalMarks,
      };

      if (existingCard) {
        existingCard.subjects.push(subjectData);
      } else {
        reportCards.push({
          school: classResult.school,
          student: student.student,
          exam: classResult.exam,
          class: classResult.class,
          subjects: [subjectData],
          totalMarks: 0,
          percentage: 0,
          grade: "",
          status: "pending",
          publishedBy: classResult.updatedBy,
        });
      }
    });
  });

  reportCards.forEach((card) => {
    card.totalMarks = calculateTotalMarks(card.subjects);
    card.percentage = calculatePercentage(card.subjects);
    card.grade = calculateGrade(card.subjects);
    card.status = "completed";
  });

  return reportCards;
};

const calculateTotalMarks = (subjects) =>
  subjects.reduce(
    (sum, subject) => sum + (subject.marks || subject.marksObtained || 0),
    0
  );

const calculatePercentage = (subjects) => {
  const totalObtained = calculateTotalMarks(subjects);
  const totalPossible = subjects.reduce(
    (sum, subject) => sum + (subject.totalMarks || 100),
    0
  );
  return totalPossible ? (totalObtained / totalPossible) * 100 : 0;
};

const determineStatus = (subjects) => {
  const allMarked = subjects.every(
    (subject) => typeof subject.marks === "number"
  );
  return allMarked ? "completed" : "pending";
};

// const distributeExams = (subjects, daysAvailable, maxExamsPerDay) => {
//   const schedule = Array(daysAvailable)
//     .fill()
//     .map(() => []);
//   let dayIndex = 0;

//   for (const subject of subjects) {
//     schedule[dayIndex].push(subject);
//     dayIndex = (dayIndex + 1) % daysAvailable;
//     // Ensure we don't exceed maxExamsPerDay
//     while (schedule[dayIndex].length >= maxExamsPerDay) {
//       dayIndex = (dayIndex + 1) % daysAvailable;
//     }
//   }

//   // Filter out empty days
//   return schedule.filter((day) => day.length > 0);
// };

// const distributeExams = (exams, daysAvailable, maxExamsPerDay) => {
//   const schedule = Array.from({ length: daysAvailable }, () => []);
//   let examIndex = 0;

//   for (let day = 0; day < daysAvailable && examIndex < exams.length; day++) {
//     for (let slot = 0; slot < maxExamsPerDay && examIndex < exams.length; slot++) {
//       schedule[day].push(exams[examIndex]);
//       examIndex++;
//     }
//   }

//   return schedule.filter((day) => day.length > 0);
// };


// const distributeExams = (subjects, daysAvailable, maxExamsPerDay, nonWorkingDays, startDate) => {
//   const schedule = [];
//   let currentDay = 0;
//   const heavySubjects = subjects.filter(s => s.weight === "heavy");
//   const lightSubjects = subjects.filter(s => s.weight !== "heavy");
//   const shuffledSubjects = [...heavySubjects, ...lightSubjects].sort(() => Math.random() - 0.5);

//   for (const subject of shuffledSubjects) {
//     while (currentDay < daysAvailable) {
//       const currentDate = new Date(startDate);
//       currentDate.setDate(currentDate.getDate() + currentDay);
//       if (nonWorkingDays.some(d => d instanceof Date && !isNaN(d) && d.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0])) {
//         currentDay++;
//         continue;
//       }

//       if (!schedule[currentDay]) schedule[currentDay] = [];
//       if (schedule[currentDay].length < maxExamsPerDay) {
//         if (subject.weight === "heavy" && schedule[currentDay].some(s => s.weight === "heavy")) {
//           currentDay++;
//           continue;
//         }
//         schedule[currentDay].push(subject);
//         break;
//       }
//       currentDay++;
//     }
//     if (currentDay >= daysAvailable) {
//       throw new Error("Not enough days to schedule all exams");
//     }
//   }

//   return schedule;
// };


const distributeExams = (subjects, daysAvailable, maxExamsPerDay, nonWorkingDays, startDate) => {
  const schedule = [];
  let currentDay = 0;
  const heavySubjects = subjects.filter(s => s.weight === "heavy");
  const lightSubjects = subjects.filter(s => s.weight !== "heavy");
  const shuffledSubjects = [...heavySubjects, ...lightSubjects].sort(() => Math.random() - 0.5);
  const classExamsPerDay = {}; // Track exams per class per day

  for (const subject of shuffledSubjects) {
    while (currentDay < daysAvailable) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + currentDay);
      if (nonWorkingDays.some(d => d instanceof Date && !isNaN(d) && d.toISOString().split("T")[0] === currentDate.toISOString().split("T")[0])) {
        currentDay++;
        continue;
      }

      const dateKey = currentDate.toISOString().split("T")[0];
      if (!classExamsPerDay[dateKey]) classExamsPerDay[dateKey] = {};
      if (!classExamsPerDay[dateKey][subject.classId]) classExamsPerDay[dateKey][subject.classId] = 0;

      if (!schedule[currentDay]) schedule[currentDay] = [];
      if (schedule[currentDay].length < maxExamsPerDay && classExamsPerDay[dateKey][subject.classId] === 0) {
        if (subject.weight === "heavy" && schedule[currentDay].some(s => s.weight === "heavy")) {
          currentDay++;
          continue;
        }
        schedule[currentDay].push(subject);
        classExamsPerDay[dateKey][subject.classId]++;
        break;
      }
      currentDay++;
    }
    if (currentDay >= daysAvailable) {
      throw new Error("Not enough days to schedule all exams");
    }
  }

  return schedule;
};

// const calculateEndTime = (startTime, durationMinutes) => {
//   const [hours, minutes] = startTime.split(":").map(Number);
//   const startMinutes = hours * 60 + minutes;
//   const endMinutes = startMinutes + durationMinutes;

//   const endHours = Math.floor(endMinutes / 60) % 24;
//   const endMins = endMinutes % 60;

//   return `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(
//     2,
//     "0"
//   )}`;
// };

// const calculateDuration = (startTime, endTime) => {
//   const [startHours, startMinutes] = startTime.split(":").map(Number);
//   const [endHours, endMinutes] = endTime.split(":").map(Number);

//   const startTotal = startHours * 60 + startMinutes;
//   let endTotal = endHours * 60 + endMinutes;

//   // Handle case where end time crosses midnight
//   if (endTotal < startTotal) {
//     endTotal += 24 * 60;
//   }

//   return endTotal - startTotal;
// };

// const checkRoomConflicts = async (exams, availableRooms, schoolId, connection) => {
//   const Exam = connection.model("Exam");
//   const conflicts = [];

//   // Get existing exams for the same dates
//   const examDates = [...new Set(exams.map((e) => new Date(e.examDate).toISOString().split("T")[0]))];
//   const existingExams = await Exam.find({
//     school: schoolId,
//     examDate: {
//       $gte: new Date(examDates[0]),
//       $lte: new Date(examDates[examDates.length - 1]),
//     },
//   }).lean();

//   const roomSchedules = {};

//   // Add existing exams to room schedules
//   existingExams.forEach((exam) => {
//     const dateKey = exam.examDate.toISOString().split("T")[0];
//     const timeKey = `${exam.startTime}-${exam.endTime}`;
//     exam.seatingArrangement.forEach((room) => {
//       roomSchedules[room.classroom] = roomSchedules[room.classroom] || {};
//       roomSchedules[room.classroom][dateKey] = roomSchedules[room.classroom][dateKey] || [];
//       roomSchedules[room.classroom][dateKey].push({
//         subject: exam.subjects[0]?.subject?.toString() || "Unknown",
//         time: timeKey,
//         classId: exam.class.toString(),
//       });
//     });
//   });

//   // Add new exams to check for conflicts
//   exams.forEach((exam) => {
//     const dateKey = new Date(exam.examDate).toISOString().split("T")[0];
//     const timeKey = `${exam.startTime}-${exam.endTime}`;
//     availableRooms.forEach((room) => {
//       roomSchedules[room] = roomSchedules[room] || {};
//       roomSchedules[room][dateKey] = roomSchedules[room][dateKey] || [];
//       roomSchedules[room][dateKey].push({
//         subject: exam.subjectId,
//         time: timeKey,
//         classId,
//       });
//     });
//   });

//   // Check for conflicts
//   for (const room in roomSchedules) {
//     for (const date in roomSchedules[room]) {
//       const schedules = roomSchedules[room][date];
//       if (schedules.length > 1) {
//         schedules.sort((a, b) => a.time.localeCompare(b.time));
//         for (let i = 1; i < schedules.length; i++) {
//           const prevEnd = calculateDuration("00:00", schedules[i - 1].time.split("-")[1]);
//           const currStart = calculateDuration("00:00", schedules[i].time.split("-")[0]);
//           if (currStart < prevEnd) {
//             conflicts.push({
//               room,
//               date,
//               time: schedules[i].time,
//               subjects: [schedules[i - 1].subject, schedules[i].subject],
//             });
//           }
//         }
//       }
//     }
//   }

//   return conflicts;
// };


const checkRoomConflicts = async (schedule, connection, schoolId) => {
  const Exam = getModel("Exam", connection);
  const conflicts = [];

  for (const slot of schedule) {
    const existingExams = await Exam.find({
      school: schoolId,
      examDate: slot.examDate,
      startTime: slot.startTime,
    }).lean();

    for (const exam of existingExams) {
      for (const seating of exam.seatingArrangement) {
        if (slot.rooms.includes(seating.classroom)) {
          conflicts.push({
            room: seating.classroom,
            examDate: slot.examDate,
            startTime: slot.startTime,
            existingExamId: exam._id,
          });
        }
      }
    }
  }

  return conflicts;
};

const calculateEndTime = (startTime, durationMinutes) => {
  const [hours, minutes] = startTime.split(":").map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;

  const endHours = Math.floor(endMinutes / 60) % 24;
  const endMins = endMinutes % 60;

  return `${String(endHours).padStart(2, "0")}:${String(endMins).padStart(2, "0")}`;
};

const calculateDuration = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;

  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }

  return endTotal - startTotal;
};

const isValidTimeFormat = (time) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};





// const calculateClassStatistics = (results, totalSubjects) => {
//   if (!results.length) {
//     return {
//       averagePercentage: 0,
//       highestPercentage: 0,
//       lowestPercentage: 0,
//       passRate: 0,
//       totalStudents: 0,
//       subjectAverages: {},
//     };
//   }

//   const stats = {
//     averagePercentage: 0,
//     highestPercentage: 0,
//     lowestPercentage: Infinity,
//     passRate: 0,
//     totalStudents: results.length,
//     subjectAverages: {},
//   };

//   results.forEach((result) => {
//     stats.averagePercentage += result.percentage;
//     stats.highestPercentage = Math.max(
//       stats.highestPercentage,
//       result.percentage
//     );
//     stats.lowestPercentage = Math.min(
//       stats.lowestPercentage,
//       result.percentage
//     );
//     if (result.percentage >= 40) stats.passRate++;

//     Object.entries(result.subjects).forEach(([subjectId, subjectData]) => {
//       if (!stats.subjectAverages[subjectId]) {
//         stats.subjectAverages[subjectId] = {
//           name: subjectData.subjectName,
//           totalMarks: 0,
//           count: 0,
//         };
//       }
//       stats.subjectAverages[subjectId].totalMarks += subjectData.marksObtained;
//       stats.subjectAverages[subjectId].count++;
//     });
//   });

//   stats.averagePercentage /= results.length;
//   stats.passRate = (stats.passRate / results.length) * 100;

//   stats.subjectAverages = Object.entries(stats.subjectAverages).map(
//     ([subjectId, data]) => ({
//       subjectId,
//       name: data.name,
//       averageMarks: data.totalMarks / data.count,
//       averagePercentage: (data.totalMarks / data.count / 100) * 100, // Assuming 100 as max marks per subject
//     })
//   );

//   return stats;
// };

const calculateClassStatistics = (results, totalSubjects) => {
  if (!results.length) {
    return {
      averagePercentage: 0,
      highestPercentage: 0,
      lowestPercentage: 0,
      passRate: 0,
      totalStudents: 0,
      subjectAverages: {},
    };
  }

  const stats = {
    averagePercentage: 0,
    highestPercentage: 0,
    lowestPercentage: Infinity,
    passRate: 0,
    totalStudents: results.length,
    subjectAverages: {},
  };

  results.forEach((result) => {
    stats.averagePercentage += result.percentage;
    stats.highestPercentage = Math.max(
      stats.highestPercentage,
      result.percentage
    );
    stats.lowestPercentage = Math.min(
      stats.lowestPercentage,
      result.percentage
    );
    if (result.percentage >= 40) stats.passRate++;

    Object.entries(result.subjects).forEach(([subjectId, subjectData]) => {
      if (!stats.subjectAverages[subjectId]) {
        stats.subjectAverages[subjectId] = {
          name: subjectData.subjectName,
          totalMarks: 0,
          count: 0,
        };
      }
      stats.subjectAverages[subjectId].totalMarks += subjectData.marksObtained;
      stats.subjectAverages[subjectId].count++;
    });
  });

  stats.averagePercentage /= results.length;
  stats.passRate = (stats.passRate / results.length) * 100;

  stats.subjectAverages = Object.entries(stats.subjectAverages).map(
    ([subjectId, data]) => ({
      subjectId,
      name: data.name,
      averageMarks: data.totalMarks / data.count,
      averagePercentage: (data.totalMarks / data.count / 100) * 100, // Assuming 100 as max marks per subject
    })
  );

  return stats;
};


const generateReportCard = (result, classStats) => {
  const totalMarks = calculateTotalMarks(result.subjects);
  const percentage = calculatePercentage(result.subjects);
  const grade = calculateGrade(result.subjects);

  return {
    student: {
      id: result.student._id,
      name: result.student.name,
      profile: result.student.profile,
    },
    exam: {
      id: result.exam._id,
      type: result.exam.examType,
      academicYear: result.exam.academicYear,
    },
    class: result.class,
    subjects: result.subjects.map((subject) => ({
      subjectId: subject.subject,
      marks: subject.marks,
      totalMarks: subject.totalMarks,
    })),
    totalMarks,
    percentage,
    grade,
    classRank: classStats.totalStudents
      ? Math.floor(
          ((classStats.highestPercentage - percentage) /
            (classStats.highestPercentage - classStats.lowestPercentage)) *
            (classStats.totalStudents - 1)
        ) + 1
      : 1,
    classAverage: classStats.averagePercentage,
  };
};

module.exports = adminController;
