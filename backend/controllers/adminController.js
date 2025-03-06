
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { cloudinary } = require('../config/cloudinary');
const getModel = require('../models/index');
const multer = require('multer');
const streamifier = require('streamifier');
const fs = require('fs');
const { getSchoolConnection } = require('../config/database');


const adminController = {
  // ============ User Management ============
  createUser: async (req, res) => {
    try {
      const { name, email, password, role, profile } = req.body;
      if (!req.school) return res.status(400).json({ error: 'No school associated with this admin' });

      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel('User', connection);

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser) return res.status(400).json({ message: 'Email already registered' });

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
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);

      const users = await User.find({ 
        school: schoolId, 
        role: { $ne: 'student' } // Exclude users with role 'student'
      })
        .select('-password')
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name')
        .populate('permissions.canEnterMarks.class', 'name division', Class)
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
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);

      const user = await User.findOne({ _id: userId, school: schoolId })
        .select('-password')
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name')
        .populate('permissions.canEnterMarks.class', 'name division', Class)
        .lean();

      if (!user) return res.status(404).json({ message: 'User not found' });
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
        const Class = require('../models/Class')(connection);
        const User = require('../models/User')(connection);
  
        // Validate classId
        if (!mongoose.Types.ObjectId.isValid(classId)) {
          return res.status(400).json({ message: 'Invalid class ID' });
        }
  
        // Check if class exists
        const selectedClass = await Class.findOne({ _id: classId, school: schoolId });
        if (!selectedClass) {
          return res.status(404).json({ message: 'Class not found' });
        }
  
        // Fetch students enrolled in this class
        const students = await User.find({
          school: schoolId,
          'studentDetails.class': classId,
          role: 'student',
        })
          .select('name email studentDetails')
          .lean();
  
        res.json({
          status: 'success',
          class: {
            name: selectedClass.name,
            division: selectedClass.division,
            academicYear: selectedClass.academicYear,
            capacity: selectedClass.capacity,
            enrolledCount: selectedClass.students.length,
          },
          count: students.length,
          students: students.map(student => ({
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
      if (!req.school) return res.status(400).json({ error: 'No school associated with this user' });
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel('Class', connection);

      const [availableClasses, assignedClasses] = await Promise.all([
        Class.find({ school: schoolId, $or: [{ classTeacher: null }, { classTeacher: { $exists: false } }] })
          .select('name division academicYear')
          .sort({ name: 1, division: 1 })
          .lean(),
        Class.find({ school: schoolId, classTeacher: { $exists: true, $ne: null } })
          .select('name division academicYear classTeacher')
          .populate('classTeacher', 'name')
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
      const Subject = getModel('Subject', connection);

      if (!classId || !schoolId) return res.status(400).json({ error: 'Invalid classId or schoolId' });

      const subjects = await Subject.find({ school: schoolId, class: classId }).select('name').lean();
      if (!subjects.length) return res.status(404).json({ error: 'No subjects found' });

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  createTeacher: async (req, res) => {
    const connection = req.connection;
    if (connection.readyState !== 1) {
      return res.status(500).json({ success: false, message: 'Database connection not ready' });
    }

    const session = await connection.startSession();
    session.startTransaction();

    try {
      const {
        name, email, password, phone, address, photo, teachingClass, selectedSubjects, classTeacherOf,
      } = req.body;
      const schoolId = req.school._id;
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);
      const TeacherAssignment = getModel('TeacherAssignment', connection);

      if (!teachingClass || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
        return res.status(400).json({ success: false, message: 'Class and subjects required' });
      }

      const existingUser = await User.findOne({ email }).lean();
      if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered' });

      const subjects = await Subject.find({ _id: { $in: selectedSubjects }, class: teachingClass, school: schoolId }).lean();
      if (subjects.length !== selectedSubjects.length) {
        return res.status(400).json({ success: false, message: 'Invalid subjects for class' });
      }

      const assignedSubjects = subjects.filter(s => s.teachers?.length > 0);
      if (assignedSubjects.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign already assigned subjects: ${assignedSubjects.map(s => s.name).join(', ')}`,
          assignedSubjects: assignedSubjects.map(s => ({ name: s.name, assignedTo: s.teachers[0].teacher })),
        });
      }

      if (classTeacherOf) {
        const classData = await Class.findOne({ _id: classTeacherOf, school: schoolId }).lean();
        if (!classData) return res.status(400).json({ success: false, message: 'Class not found' });
        if (classData.classTeacher) return res.status(400).json({ success: false, message: 'Class already has a teacher' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const permissions = {
        canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
        canEnterMarks: selectedSubjects.map(subjectId => ({ class: teachingClass, subject: subjectId })),
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
        role: 'teacher',
        profile: { phone, address, photo },
        permissions,
      });
      await teacher.save({ session });

      const teacherAssignment = new TeacherAssignment({
        school: schoolId,
        teacher: teacher._id,
        classTeacherAssignment: classTeacherOf ? { class: classTeacherOf, assignedAt: new Date() } : null,
        subjectAssignments: selectedSubjects.map(subjectId => ({ class: teachingClass, subject: subjectId, assignedAt: new Date() })),
        academicYear: getCurrentAcademicYear(),
      });
      await teacherAssignment.save({ session });

      if (classTeacherOf) {
        await Class.findByIdAndUpdate(classTeacherOf, { classTeacher: teacher._id, lastUpdated: new Date(), updatedBy: req.user._id }, { session });
      }

      await Promise.all(selectedSubjects.map(subjectId =>
        Subject.findByIdAndUpdate(subjectId, { $push: { teachers: { teacher: teacher._id, assignedAt: new Date() } } }, { session })
      ));

      await session.commitTransaction();

      const populatedTeacher = await User.findById(teacher._id)
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name', Subject)
        .populate('permissions.canEnterMarks.class', 'name division', Class)
        .lean();

      const populatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject)
        .lean();

      res.status(201).json({
        success: true,
        teacher: populatedTeacher,
        assignment: populatedAssignment,
        message: 'Teacher created successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({ success: false, message: 'Failed to create teacher', error: error.message });
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
      const { classTeacherOf, removeClassTeacherRole, addSubjectAssignments, removeSubjectAssignments } = req.body;
      const schoolId = req.school._id;
      const adminId = req.user._id;

      const User = getModel('User', connection);
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);
      const TeacherAssignment = getModel('TeacherAssignment', connection);

      const teacher = await User.findOne({ _id: teacherId, school: schoolId, role: 'teacher' }).lean();
      if (!teacher) return res.status(404).json({ message: 'Teacher not found' });

      let teacherAssignment = await TeacherAssignment.findOne({ teacher: teacherId, school: schoolId });
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
        const newClass = await Class.findOne({ _id: classTeacherOf, school: schoolId }).lean();
        if (!newClass) return res.status(400).json({ message: 'Class not found' });
        if (newClass.classTeacher && newClass.classTeacher.toString() !== teacherId) {
          return res.status(400).json({ message: 'Class already assigned to another teacher' });
        }

        if (teacherAssignment.classTeacherAssignment?.class?.toString() !== classTeacherOf) {
          await Class.findByIdAndUpdate(
            teacherAssignment.classTeacherAssignment?.class,
            { $unset: { classTeacher: '' }, lastUpdated: new Date(), updatedBy: adminId },
            { session }
          );
          await User.findByIdAndUpdate(
            teacherId,
            { $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment?.class } },
            { session }
          );
        }

        await Class.findByIdAndUpdate(classTeacherOf, { classTeacher: teacherId, lastUpdated: new Date(), updatedBy: adminId }, { session });
        teacherAssignment.classTeacherAssignment = { class: classTeacherOf, assignedAt: new Date() };
        await User.findByIdAndUpdate(teacherId, { $addToSet: { 'permissions.canTakeAttendance': classTeacherOf } }, { session });
      } else if (removeClassTeacherRole && teacherAssignment.classTeacherAssignment) {
        await Class.findByIdAndUpdate(
          teacherAssignment.classTeacherAssignment.class,
          { $unset: { classTeacher: '' }, lastUpdated: new Date(), updatedBy: adminId },
          { session }
        );
        await User.findByIdAndUpdate(
          teacherId,
          { $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class } },
          { session }
        );
        teacherAssignment.classTeacherAssignment = null;
      }

      if (addSubjectAssignments?.length) {
        const validAssignments = await Promise.all(addSubjectAssignments.map(async ({ classId, subjectId }) => {
          const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId }).lean();
          if (!subject) throw new Error(`Invalid subject assignment: ${subjectId} for class ${classId}`);
          return { classId, subjectId };
        }));

        for (const { classId, subjectId } of validAssignments) {
          if (!teacherAssignment.subjectAssignments.some(a => a.class.toString() === classId && a.subject.toString() === subjectId)) {
            teacherAssignment.subjectAssignments.push({ class: classId, subject: subjectId, assignedAt: new Date() });
            await Subject.findByIdAndUpdate(subjectId, { $addToSet: { teachers: { teacher: teacherId, assignedAt: new Date() } } }, { session });
            await User.findByIdAndUpdate(teacherId, { $addToSet: { 'permissions.canEnterMarks': { class: classId, subject: subjectId } } }, { session });
          }
        }
      }

      if (removeSubjectAssignments?.length) {
        for (const { classId, subjectId } of removeSubjectAssignments) {
          teacherAssignment.subjectAssignments = teacherAssignment.subjectAssignments.filter(
            a => !(a.class.toString() === classId && a.subject.toString() === subjectId)
          );
          await Subject.findByIdAndUpdate(subjectId, { $pull: { teachers: { teacher: teacherId } } }, { session });
          await User.findByIdAndUpdate(teacherId, { $pull: { 'permissions.canEnterMarks': { class: classId, subject: subjectId } } }, { session });
        }
      }

      await teacherAssignment.save({ session });
      await session.commitTransaction();

      const updatedTeacher = await User.findById(teacherId)
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name', Subject)
        .populate('permissions.canEnterMarks.class', 'name division', Class)
        .lean();

      const updatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject)
        .lean();

      res.json({ teacher: updatedTeacher, assignment: updatedAssignment, message: 'Teacher assignments updated successfully' });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({ error: error.message, message: 'Failed to update teacher assignments' });
    } finally {
      session.endSession();
    }
  },

  getAssignableSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = getModel('Subject', connection);
      const User = getModel('User', connection);

      if (!classId || !schoolId) return res.status(400).json({ error: 'Invalid classId or schoolId' });

      const subjects = await Subject.find({ school: schoolId, class: classId })
        .select('name teachers')
        .populate('teachers.teacher', 'name email', User)
        .lean();

      if (!subjects.length) return res.status(404).json({ error: 'No subjects found for this class' });

      const subjectsWithStatus = subjects.map(subject => ({
        _id: subject._id.toString(),
        name: subject.name,
        isAssigned: subject.teachers?.length > 0,
        assignedTo: subject.teachers.length > 0 ? { name: subject.teachers[0].teacher.name, email: subject.teachers[0].teacher.email } : null,
      }));

      res.json({ subjects: subjectsWithStatus, message: 'Subjects retrieved successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  getAllTeacherAssignments: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const TeacherAssignment = getModel('TeacherAssignment', connection);
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);

      const assignments = await TeacherAssignment.find({ school: schoolId })
        .populate('teacher', 'name email profile', User)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject)
        .lean();

      const classAssignmentMap = {};
      const subjectAssignmentMap = {};

      assignments.forEach(assignment => {
        if (assignment.classTeacherAssignment?.class) {
          const classId = assignment.classTeacherAssignment.class._id.toString();
          classAssignmentMap[classId] = {
            teacher: { id: assignment.teacher._id, name: assignment.teacher.name, email: assignment.teacher.email },
            assignedAt: assignment.classTeacherAssignment.assignedAt,
          };
        }

        assignment.subjectAssignments.forEach(subAssignment => {
          const classId = subAssignment.class._id.toString();
          const subjectId = subAssignment.subject._id.toString();
          const key = `${classId}:${subjectId}`;
          if (!subjectAssignmentMap[key]) subjectAssignmentMap[key] = [];
          subjectAssignmentMap[key].push({
            teacher: { id: assignment.teacher._id, name: assignment.teacher.name, email: assignment.teacher.email },
            assignedAt: subAssignment.assignedAt,
          });
        });
      });

      res.json({ raw: assignments, classTeachers: classAssignmentMap, subjectTeachers: subjectAssignmentMap });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTeachers: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel('User', connection);
      const TeacherAssignment = getModel('TeacherAssignment', connection);
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);

      const teachers = await User.find({ school: schoolId, role: 'teacher' }).select('-password').lean();
      const assignments = await TeacherAssignment.find({ school: schoolId, teacher: { $in: teachers.map(t => t._id) } })
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject)
        .lean();

      const currentClasses = await Class.find({ school: schoolId, classTeacher: { $in: teachers.map(t => t._id) } })
        .select('name division classTeacher')
        .lean();

      const currentSubjects = await Subject.find({ school: schoolId, 'teachers.teacher': { $in: teachers.map(t => t._id) } })
        .select('name class teachers')
        .populate('class', 'name division', Class)
        .lean();

      const classTeacherMap = new Map(currentClasses.map(c => [c.classTeacher.toString(), c]));
      const subjectTeacherMap = new Map();
      currentSubjects.forEach(subject => {
        subject.teachers.forEach(t => {
          const key = t.teacher.toString();
          if (!subjectTeacherMap.has(key)) subjectTeacherMap.set(key, []);
          subjectTeacherMap.get(key).push({ subject: subject.name, class: subject.class });
        });
      });

      const teachersWithAssignments = teachers.map(teacher => {
        const teacherId = teacher._id.toString();
        const teacherAssignments = assignments.find(a => a.teacher.toString() === teacherId);
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
      res.status(500).json({ success: false, error: error.message, message: 'Failed to fetch teachers' });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, permissions, classId, subjects } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel('User', connection);

      if (role === 'teacher' && (classId || subjects)) {
        req.body.teacherId = userId;
        return await adminController.assignTeacherRole(req, res);
      }

      const updatedPermissions = { ...getDefaultPermissions(role), ...permissions };
      const user = await User.findByIdAndUpdate(
        userId,
        { role, permissions: updatedPermissions, 'profile.lastRoleUpdate': new Date() },
        { new: true }
      ).lean();

      if (!user) return res.status(404).json({ message: 'User not found' });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // uploadSyllabus: async (req, res) => {
  //   try {
  //     const { classId, subjectId, content } = req.body;
  //     const schoolId = req.school._id;
  //     const uploadedBy = req.user._id;
  //     const connection = req.connection;
  //     const Class = getModel('Class', connection);
  //     const Subject = getModel('Subject', connection);
  //     const Syllabus = getModel('Syllabus', connection);

  //     const classExists = await Class.findOne({ _id: classId, school: schoolId }).lean();
  //     if (!classExists) {
  //       if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
  //       return res.status(404).json({ message: 'Class not found' });
  //     }

  //     const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId }).lean();
  //     if (!subject) {
  //       if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
  //       return res.status(404).json({ message: 'Subject not found' });
  //     }

  //     const documents = req.files?.map(file => ({
  //       title: file.originalname,
  //       url: file.path,
  //       public_id: file.filename.replace(/^syllabuses\//, ''),
  //       uploadedBy,
  //     })) || [];

  //     let syllabus = await Syllabus.findOne({ subject: subjectId });
  //     if (!syllabus) {
  //       syllabus = new Syllabus({ school: schoolId, subject: subjectId, class: classId, content, documents });
  //     } else {
  //       syllabus.content = content;
  //       if (documents.length > 0) syllabus.documents = [...syllabus.documents, ...documents];
  //     }

  //     await syllabus.save();
  //     await Subject.findByIdAndUpdate(subjectId, { syllabus: syllabus._id });

  //     res.status(201).json(syllabus);
  //   } catch (error) {
  //     if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  uploadSyllabus: async (req, res) => {
    try {
      const { classId, subjectId, content } = req.body;
      const schoolId = req.school._id;
      const uploadedBy = req.user._id;
      const connection = req.connection;
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);
      const Syllabus = getModel('Syllabus', connection);
  
      // Validate class and subject
      const classExists = await Class.findOne({ _id: classId, school: schoolId }).lean();
      if (!classExists) {
        throw new Error('Class not found');
      }
  
      const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId }).lean();
      if (!subject) {
        throw new Error('Subject not found');
      }
  
      // Process uploaded files
      const documents = req.files?.map(file => ({
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
          req.files.map(file => cloudinary.uploader.destroy(file.filename).catch(err => console.error('Cleanup failed:', err)))
        );
      }
      console.error('Syllabus upload error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  createClass: async (req, res) => {
    try {
      const { name, division, capacity, rteSeats, academicYear, schedule } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = getModel('Class', connection);
      const TeacherAssignment = getModel('TeacherAssignment', connection);
      const User = getModel('User', connection);

      const existingClass = await Class.findOne({ school: schoolId, name, division, academicYear }).lean();
      if (existingClass) {
        return res.status(400).json({ error: `Class ${name} division ${division} already exists for academic year ${academicYear}` });
      }

      const existingTeacherAssignment = await TeacherAssignment.findOne({
        school: schoolId,
        class: null,
        assignmentType: 'classTeacher',
        academicYear,
      }).lean();

      const newClass = new Class({
        school: schoolId,
        name,
        division,
        capacity,
        classTeacher: existingTeacherAssignment ? existingTeacherAssignment.teacher : null,
        rteSeats,
        academicYear,
        schedule,
      });

      await newClass.save();

      if (existingTeacherAssignment) {
        await TeacherAssignment.findByIdAndUpdate(existingTeacherAssignment._id, { class: newClass._id });
        await User.findByIdAndUpdate(existingTeacherAssignment.teacher, { $push: { 'permissions.canTakeAttendance': newClass._id } });
      }

      const populatedClass = await Class.findById(newClass._id)
        .populate('classTeacher', 'name email profile', User)
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
      const Class = getModel('Class', connection);
      const User = getModel('User', connection);

      const classes = await Class.find({ school: schoolId })
        .populate('classTeacher', 'name email profile', User)
        .populate('subjects', 'name')
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
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);

      const classExists = await Class.findOne({ _id: classId, school: schoolId }).lean();
      if (!classExists) return res.status(400).json({ message: 'Invalid class selected' });

      const subject = new Subject({
        school: schoolId,
        class: classId,
        name: name || 'Untitled Subject',
        teachers: [],
        createdBy: adminId,
      });

      await subject.save();
      await Class.findByIdAndUpdate(classId, { $push: { subjects: subject._id } });

      res.status(201).json({ message: 'Subject created successfully', subject });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllSubjects: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = getModel('Subject', connection);
      const Class = getModel('Class', connection);
      const User = getModel('User', connection);
      const Syllabus = getModel('Syllabus', connection);

      const subjects = await Subject.find({ school: schoolId })
        .populate('class', 'name division', Class)
        .populate('teachers.teacher', 'name email', User)
        .populate('syllabus', '', Syllabus)
        .sort({ 'class.name': 1, name: 1 })
        .lean();

      res.json(subjects);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // getSyllabus: async (req, res) => {
  //   try {
  //     const { subjectId } = req.params;
  //     const schoolId = req.school._id;
  //     const connection = req.connection;
  //     const Syllabus = getModel('Syllabus', connection);
  //     const Subject = getModel('Subject', connection);
  //     const Class = getModel('Class', connection);

  //     const syllabus = await Syllabus.findOne({ subject: subjectId, school: schoolId })
  //       .populate('subject', 'name', Subject)
  //       .populate('class', 'name division', Class)
  //       .lean();

  //     if (!syllabus) return res.status(404).json({ message: 'Syllabus not found' });

  //     if (syllabus.documents?.length > 0) {
  //       syllabus.documents = syllabus.documents.map(doc => {
  //         try {
  //           if (!doc.public_id) throw new Error(`Missing public_id for document: ${doc.title}`);
  //           const fileExtension = doc.title.split('.').pop().toLowerCase();
  //           const contentType = {
  //             'pdf': 'application/pdf',
  //             'doc': 'application/msword',
  //             'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  //             'jpg': 'image/jpeg',
  //             'jpeg': 'image/jpeg',
  //           }[fileExtension] || 'application/octet-stream';

  //           const downloadUrl = cloudinary.url(doc.public_id, {
  //             resource_type: 'raw',
  //             format: fileExtension,
  //             secure: true,
  //             sign_url: true,
  //             type: 'upload',
  //             attachment: true,
  //             flags: 'attachment',
  //             timestamp: Math.round(new Date().getTime() / 1000),
  //           });

  //           return { ...doc, downloadUrl, contentType };
  //         } catch (error) {
  //           return { ...doc, downloadUrl: null, contentType: 'application/octet-stream' };
  //         }
  //       });
  //     }

  //     res.json(syllabus);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // getSyllabus: async (req, res) => {
  //   try {
  //     const { subjectId } = req.params;
  //     const schoolId = req.school._id;
  //     const connection = req.connection;
  //     const Syllabus = getModel('Syllabus', connection);
  //     const Subject = getModel('Subject', connection);
  //     const Class = getModel('Class', connection);
  
  //     const syllabus = await Syllabus.findOne({ subject: subjectId, school: schoolId })
  //       .populate('subject', 'name', Subject)
  //       .populate('class', 'name division', Class)
  //       .lean();
  
  //     if (!syllabus) return res.status(404).json({ message: 'Syllabus not found' });
  
  //     if (syllabus.documents?.length > 0) {
  //       syllabus.documents = syllabus.documents.map(doc => {
  //         try {
  //           if (!doc.public_id) throw new Error(`Missing public_id for document: ${doc.title}`);
  
  //           // Extract file extension dynamically
  //           const fileExtension = doc.title.split('.').pop().toLowerCase();
  //           const contentType = mime.lookup(fileExtension) || 'application/octet-stream';
  
  //           // Generate signed URL for download
  //           const downloadUrl = cloudinary.url(doc.public_id, {
  //             resource_type: 'raw', // For non-image files
  //             secure: true,
  //             sign_url: true,
  //             type: 'upload',
  //             attachment: true, // Forces download
  //             flags: 'attachment',
  //             expires_at: Math.round(new Date().getTime() / 1000) + 3600, // URL valid for 1 hour
  //           });
  
  //           return { ...doc, downloadUrl, contentType };
  //         } catch (error) {
  //           console.error(`Error generating URL for ${doc.title}:`, error.message);
  //           return { ...doc, downloadUrl: null, contentType: 'application/octet-stream', error: error.message };
  //         }
  //       });
  //     }
  
  //     res.json(syllabus);
  //   } catch (error) {
  //     console.error('Get syllabus error:', error);
  //     res.status(500).json({ error: 'Failed to retrieve syllabus', details: error.message });
  //   }
  // },

  getSyllabus: async (req, res) => {
    try {
      const { subjectId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Syllabus = getModel('Syllabus', connection);
      const Subject = getModel('Subject', connection);
      const Class = getModel('Class', connection);
  
      const syllabus = await Syllabus.findOne({ subject: subjectId, school: schoolId })
        .populate('subject', 'name', Subject)
        .populate('class', 'name division', Class)
        .lean();
  
      if (!syllabus) return res.status(404).json({ message: 'Syllabus not found' });
  
      if (syllabus.documents?.length > 0) {
        syllabus.documents = syllabus.documents.map(doc => {
          try {
            if (!doc.public_id) throw new Error(`Missing public_id for document: ${doc.title}`);
  
            // Generate a signed URL for download
            const downloadUrl = cloudinary.utils.private_download_url(doc.public_id, null, {
              resource_type: 'raw', // Assume raw for all documents
              attachment: true, // Force download
              expires_at: Math.floor(Date.now() / 1000) + 3600, // URL valid for 1 hour
            });
  
            // Determine content type from mime type or extension
            const fileExtension = doc.title.split('.').pop().toLowerCase();
            const contentTypeMap = {
              pdf: 'application/pdf',
              doc: 'application/msword',
              docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              png: 'image/png',
              xls: 'application/vnd.ms-excel',
              xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              ppt: 'application/vnd.ms-powerpoint',
              pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              txt: 'text/plain',
            };
            const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';
  
            return { ...doc, downloadUrl, contentType };
          } catch (error) {
            console.error('Error generating download URL:', error);
            return { ...doc, downloadUrl: null, contentType: 'application/octet-stream' };
          }
        });
      }
  
      res.json(syllabus);
    } catch (error) {
      console.error('Syllabus retrieval error:', error);
      res.status(500).json({ error: error.message });
    }
  },

  assignTeacherRole: async (req, res) => {
    try {
      const { teacherId, classTeacherOf, subjectAssignments, academicYear } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel('User', connection);
      const TeacherAssignment = getModel('TeacherAssignment', connection);
      const Class = getModel('Class', connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const teacher = await User.findById(teacherId).lean();
        if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ message: 'Teacher not found' });

        let assignment = await TeacherAssignment.findOne({ teacher: teacherId, academicYear });
        const assignmentType = classTeacherOf ? 'classTeacher' : 'subjectTeacher';

        if (!assignment) {
          assignment = new TeacherAssignment({
            school: schoolId,
            teacher: teacherId,
            class: assignmentType === 'classTeacher' ? classTeacherOf : null,
            subjects: subjectAssignments?.map(s => ({ class: s.classId, subject: s.subjectId })) || [],
            assignmentType,
            academicYear,
          });
        } else {
          assignment.class = assignmentType === 'classTeacher' ? classTeacherOf : null;
          assignment.subjects = subjectAssignments?.map(s => ({ class: s.classId, subject: s.subjectId })) || [];
          assignment.assignmentType = assignmentType;
        }

        await assignment.save({ session });

        let permissionUpdate = { ...teacher.permissions };
        if (assignmentType === 'classTeacher') {
          if (!permissionUpdate.canTakeAttendance.includes(classTeacherOf)) {
            permissionUpdate.canTakeAttendance.push(classTeacherOf);
          }
          await Class.findByIdAndUpdate(classTeacherOf, { classTeacher: teacherId }, { session });
        }

        const markEntryPermissions = subjectAssignments?.map(s => ({ class: s.classId, subject: s.subjectId })) || [];
        permissionUpdate.canEnterMarks = [
          ...new Map([...permissionUpdate.canEnterMarks, ...markEntryPermissions]
            .map(item => [`${item.class.toString()}-${item.subject.toString()}`, item])).values(),
        ];

        await User.findByIdAndUpdate(teacherId, { $set: { permissions: permissionUpdate } }, { session });

        await session.commitTransaction();
        res.json({ assignment, permissions: permissionUpdate, message: 'Teacher role updated successfully' });
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
      const Timetable = getModel('Timetable', connection);

      const teacherConflicts = await checkTeacherConflicts(schedule);
      if (teacherConflicts.length > 0) {
        return res.status(400).json({ error: 'Teacher scheduling conflicts detected', conflicts: teacherConflicts });
      }

      const optimizedSchedule = optimizeSchedule(schedule, constraints);
      const timetable = new Timetable({ school: schoolId, class: classId, type, schedule: optimizedSchedule });

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
      const Attendance = getModel('Attendance', connection);
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);

      const query = {
        school: schoolId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate('user', 'name', User)
        .populate('class', 'name division', Class)
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
      const { name, classId, subject, date, duration, totalMarks, availableRooms } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = getModel('Exam', connection);
      const Class = getModel('Class', connection);
      const User = getModel('User', connection);

      const classDetails = await Class.findById(classId).populate('students', '', User).lean();
      const totalStudents = classDetails.students.length;

      const seatingArrangement = generateSeatingArrangement(classDetails.students, availableRooms, totalStudents);

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

  reviewClassResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const ClassResult = getModel('ClassResult', connection);
      const Class = getModel('Class', connection);
      const User = getModel('User', connection);
      const SubjectMarks = getModel('SubjectMarks', connection);
      const Subject = getModel('Subject', connection);

      const classResults = await ClassResult.find({ exam: examId, school: schoolId, status: 'submitted' })
        .populate('class', '', Class)
        .populate('classTeacher', '', User)
        .populate({
          path: 'subjectMarks',
          model: SubjectMarks,
          populate: [
            { path: 'subject', model: Subject },
            { path: 'teacher', model: User },
            { path: 'students.student', model: User },
          ],
        })
        .lean();

      res.json(classResults);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  publishResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const adminId = req.user._id;
      const schoolId = req.school._id;
      const connection = req.connection;
      const ClassResult = getModel('ClassResult', connection);
      const Result = getModel('Result', connection);
      const SubjectMarks = getModel('SubjectMarks', connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const classResults = await ClassResult.find({ exam: examId, school: schoolId, status: 'submitted' })
          .populate('subjectMarks', '', SubjectMarks)
          .lean();

        for (const classResult of classResults) {
          const reportCards = await generateStudentReportCards(classResult);
          await Result.insertMany(reportCards, { session });
          await ClassResult.findByIdAndUpdate(classResult._id, { status: 'published', publishedAt: new Date(), publishedBy: adminId }, { session });
        }

        await session.commitTransaction();
        res.json({ message: 'Results published successfully' });
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

  // createAnnouncement: async (req, res) => {
  //   try {
  //     const { title, content, targetGroups, priority, validFrom, validUntil } = req.body;
  //     const schoolId = req.school._id;
  //     const connection = req.connection;
  //     const Announcement = getModel('Announcement', connection);

  //     const attachments = req.files?.map(file => ({
  //       fileName: file.originalname,
  //       fileUrl: file.path,
  //       fileType: file.mimetype,
  //       fileSize: file.size,
  //       publicId: file.filename,
  //     })) || [];

  //     const announcement = new Announcement({
  //       school: schoolId,
  //       title,
  //       content,
  //       targetGroups: JSON.parse(targetGroups),
  //       priority,
  //       validFrom,
  //       validUntil,
  //       attachments,
  //       createdBy: req.user._id,
  //     });

  //     await announcement.save();
  //     res.status(201).json(announcement);
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  createAnnouncement: async (req, res) => {
    try {
      const { title, content, targetGroups, priority, validFrom, validUntil } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel('Announcement', connection);
  
      console.log('Request body:', { title, content, targetGroups, priority, validFrom, validUntil });
      console.log('Files received:', req.files ? req.files.map(f => ({ name: f.originalname, size: f.size })) : 'No files');
  
      // Process uploaded files with streaming
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const uploadPromise = new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              {
                folder: 'announcements',
                resource_type: 'auto',
                public_id: `announcements/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9]/g, '_')}`,
                timeout: 120000, // Explicitly set to 120 seconds
              },
              (error, result) => {
                if (error) {
                  console.error('Cloudinary upload error:', error);
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
      console.log('Announcement saved:', announcement._id);
      res.status(201).json(announcement);
    } catch (error) {
      console.error('Error in createAnnouncement:', { message: error.message, stack: error.stack });
      if (error.message?.includes('timeout')) {
        return res.status(408).json({ error: 'Upload timeout', details: error.message });
      }
      res.status(500).json({ error: 'Failed to create announcement', details: error.message });
    }
  },


 

  

  updateAnnouncement: async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, targetGroups, priority, validFrom, validUntil, removeAttachments } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel('Announcement', connection);

      const announcement = await Announcement.findById(id);
      if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to update this announcement' });
      }

      const newAttachments = req.files?.map(file => ({
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
          .filter(attach => attachmentsToRemove.includes(attach._id.toString()))
          .map(attach => attach.publicId);

        if (attachmentsToDelete.length > 0) {
          await Promise.all(attachmentsToDelete.map(publicId => cloudinary.uploader.destroy(publicId)));
        }
        currentAttachments = announcement.attachments.filter(attach => !attachmentsToRemove.includes(attach._id.toString()));
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
      const Announcement = getModel('Announcement', connection);

      const announcement = await Announcement.findById(id);
      if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to delete this announcement' });
      }

      if (announcement.attachments?.length > 0) {
        await Promise.all(announcement.attachments.map(attachment => cloudinary.uploader.destroy(attachment.publicId)));
      }

      await Announcement.findByIdAndDelete(id);
      res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAnnouncements: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = getModel('Announcement', connection);
      const User = getModel('User', connection);

      const announcements = await Announcement.find({ school: schoolId })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name email', User)
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
      const Announcement = getModel('Announcement', connection);
      const User = getModel('User', connection);

      const announcement = await Announcement.findById(id)
        .populate('createdBy', 'name email', User)
        .lean();

      if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to view this announcement' });
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
      const Leave = getModel('Leave', connection);
      const User = getModel('User', connection);

      const pendingLeaves = await Leave.find({ school: schoolId, status: 'pending' })
        .populate('user', 'name role')
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: 'success',
        count: pendingLeaves.length,
        leaves: pendingLeaves.map(leave => ({
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
      const Leave = getModel('Leave', connection);
      const User = getModel('User', connection);

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Status must be "approved" or "rejected"' });
      }

      const leave = await Leave.findOne({ _id: leaveId, school: schoolId });
      if (!leave) {
        return res.status(404).json({ message: 'Leave request not found' });
      }

      if (leave.status !== 'pending') {
        return res.status(400).json({ message: 'This leave request has already been reviewed' });
      }

      leave.status = status;
      leave.reviewedBy = adminId;
      leave.reviewedAt = new Date();
      leave.comments = comments || '';

      await leave.save();

      const user = await User.findById(leave.user).select('name role');
      
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

  manageTrustee: async (req, res) => {
    try {
      const { trusteeId } = req.params;
      const { permissions, role } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = getModel('User', connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const trustee = await User.findByIdAndUpdate(
          trusteeId,
          {
            role: 'trustee',
            permissions: {
              ...permissions,
              canAccessFinancials: role === 'finance_trustee',
              canAccessHrDocs: role === 'hr_trustee',
            },
          },
          { new: true, session }
        ).lean();

        if (!trustee) throw new Error('Trustee not found');

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
      const Meeting = getModel('Meeting', connection);

      const meeting = new Meeting({
        school: schoolId,
        title,
        date,
        type,
        agenda: agenda.map(item => ({ ...item, duration: item.duration || 30 })),
        attendees: attendees.map(attendee => ({ user: attendee, status: 'invited' })),
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
      const Meeting = getModel('Meeting', connection);

      const meeting = await Meeting.findOne({ _id: meetingId, school: schoolId });
      if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

      meeting.minutes = minutes;
      meeting.decisions = decisions;
      meeting.actionItems = actionItems;
      meeting.status = 'completed';

      await meeting.save();
      res.status(200).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // generateSeatingArrangement: (studentsOrCount, availableRooms, totalStudents) => {
  //   const isStudentsArray = Array.isArray(studentsOrCount);
  //   const students = isStudentsArray ? studentsOrCount : [];
  //   const studentCount = isStudentsArray ? students.length : totalStudents;
  //   const seatingArrangement = [];
  //   const studentsPerRoom = Math.ceil(studentCount / availableRooms.length);
  //   const shuffledStudents = isStudentsArray ? shuffleArray([...students]) : [];

  //   availableRooms.forEach((room, roomIndex) => {
  //     const startIndex = roomIndex * studentsPerRoom;
  //     const endIndex = Math.min(startIndex + studentsPerRoom, studentCount);
  //     const roomStudents = isStudentsArray ? shuffledStudents.slice(startIndex, endIndex) : [];

  //     const arrangement = [];
  //     const rows = Math.ceil(studentsPerRoom / 5);
  //     for (let i = 0; i < rows; i++) {
  //       const rowStudents = roomStudents.slice(i * 5, (i + 1) * 5);
  //       arrangement.push({
  //         row: i + 1,
  //         students: rowStudents.map((student, pos) => ({ student: student._id, position: pos + 1 })),
  //       });
  //     }

  //     seatingArrangement.push({ classroom: room, capacity: studentsPerRoom, arrangement });
  //   });

  //   return seatingArrangement;
  // },

  generateSeatingArrangement: (studentsOrCount, availableRooms, totalStudents) => {
    const isStudentsArray = Array.isArray(studentsOrCount);
    const students = isStudentsArray ? studentsOrCount : [];
    const studentCount = isStudentsArray ? students.length : totalStudents;
    const seatingArrangement = [];
    const studentsPerRoom = Math.ceil(studentCount / availableRooms.length);
    const shuffledStudents = isStudentsArray ? shuffleArray([...students]) : [];

    availableRooms.forEach((room, roomIndex) => {
        const startIndex = roomIndex * studentsPerRoom;
        const endIndex = Math.min(startIndex + studentsPerRoom, studentCount);
        const roomStudents = isStudentsArray ? shuffledStudents.slice(startIndex, endIndex) : [];

        const arrangement = [];
        const rows = Math.ceil(roomStudents.length / 5); // Use actual students, not theoretical
        for (let i = 0; i < rows; i++) {
            const rowStudents = roomStudents.slice(i * 5, (i + 1) * 5);
            arrangement.push({
                row: i + 1,
                students: rowStudents.map((student, pos) => ({ student: student._id, position: pos + 1 })),
            });
        }

        seatingArrangement.push({ 
            classroom: room, 
            capacity: roomStudents.length, // Actual number of students assigned
            arrangement ,
            startIndex
        });
    });

    return seatingArrangement;
},

  generateAttendanceReport: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const { startDate, endDate, type, classId, reportType } = req.query;
      const connection = req.connection;
      const Attendance = getModel('Attendance', connection);
      const User = getModel('User', connection);
      const Class = getModel('Class', connection);

      const query = {
        school: schoolId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) },
      };
      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate('user', 'name', User)
        .populate('class', 'name division', Class)
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
//   const { name, examType, startDate, endDate, classes, subjects, availableRooms } = req.body;
//   const schoolId = req.school._id;
//   const connection = req.connection;
//   const Exam = getModel('Exam', connection);
//   const User = getModel('User', connection);

//   const session = await connection.startSession();
//   let transactionCommitted = false;

//   try {
//       session.startTransaction();

//       const exams = [];
//       const seatingArrangements = {};

//       const examsByDate = {};
//       for (const classId of classes) {
//           for (const subject of subjects) {
//               if (subject.classes.includes(classId)) {
//                   const examEntry = new Exam({
//                       school: schoolId,
//                       name,
//                       examType,
//                       startDate,
//                       endDate,
//                       class: classId,
//                       subject: subject.id,
//                       date: subject.date,
//                       duration: (new Date(`1970-01-01T${subject.endTime}Z`) - new Date(`1970-01-01T${subject.startTime}Z`)) / 60000,
//                       totalMarks: subject.totalMarks,
//                       seatingArrangement: [],
//                   });
//                   await examEntry.save({ session });
//                   exams.push(examEntry);

//                   if (!examsByDate[subject.date]) examsByDate[subject.date] = [];
//                   examsByDate[subject.date].push(examEntry);
//               }
//           }
//       }

//       const uniqueDates = [...new Set(subjects.map(s => s.date))];
//       for (const date of uniqueDates) {
//           const classesOnThisDate = classes.filter(c => subjects.some(s => s.date === date && s.classes.includes(c)));
//           const students = await User.find({ 
//               role: 'student', 
//               'studentDetails.class': { $in: classesOnThisDate }, 
//               school: schoolId 
//           }).lean();

//           console.log(`Students for ${date}:`, students.length);

//           seatingArrangements[date] = adminController.generateSeatingArrangement(students, availableRooms, students.length);

//           // Added check to prevent error when examsByDate[date] is undefined
//           if (examsByDate[date]) {
//               for (const exam of examsByDate[date]) {
//                   const relevantStudents = students.filter(student => 
//                       student.studentDetails && student.studentDetails.class.toString() === exam.class.toString()
//                   );
//                   const examSeating = adminController.generateSeatingArrangement(relevantStudents, availableRooms, relevantStudents.length);
//                   exam.seatingArrangement = examSeating; // Use full structure
//                   await Exam.findByIdAndUpdate(exam._id, { seatingArrangement: examSeating }, { session });
//               }
//           }
//       }

//       await session.commitTransaction();
//       transactionCommitted = true;

//       res.status(201).json({ exams, seatingArrangements });

//   } catch (error) {
//       if (!transactionCommitted) {
//           await session.abortTransaction();
//       }
//       console.error('Error in createExamSchedule:', error);
//       res.status(500).json({ error: error.message });
//   } finally {
//       session.endSession();
//   }
// },

// getExamSchedules: async (req, res) => {
//   try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Exam = getModel('Exam', connection);
//       const Class = getModel('Class', connection);
//       const Subject = getModel('Subject', connection);
//       const User = getModel('User', connection);

//       // Fetch all exams for the school
//       const exams = await Exam.find({ school: schoolId })
//           .populate('class', 'name division', Class)
//           .populate('subject', 'name', Subject)
//           .lean();

//       if (!exams.length) {
//           return res.status(404).json({ message: 'No exam schedules found for this school' });
//       }

//       // Generate seating arrangements for response consistency
//       const seatingArrangements = {};
//       const uniqueDates = [...new Set(exams.map(exam => exam.date.toISOString().split('T')[0]))];

//       for (const date of uniqueDates) {
//           const examsOnThisDate = exams.filter(exam => exam.date.toISOString().split('T')[0] === date);
//           const classesOnThisDate = [...new Set(examsOnThisDate.map(exam => exam.class._id.toString()))];
//           const students = await User.find({
//               role: 'student',
//               'studentDetails.class': { $in: classesOnThisDate },
//               school: schoolId
//           }).lean();

//           const availableRooms = examsOnThisDate[0].seatingArrangement.map(seat => seat.classroom); // Assume rooms are consistent
//           seatingArrangements[date] = adminController.generateSeatingArrangement(students, availableRooms, students.length);
//       }

//       res.status(200).json({
//           exams,
//           seatingArrangements,
//           message: 'Exam schedules retrieved successfully'
//       });
//   } catch (error) {
//       console.error('Error in getExamSchedules:', error);
//       res.status(500).json({ error: error.message });
//   }
// },


// createExamSchedule: async (req, res) => {
//   const { 
//     name, 
//     examType, 
//     startDate, 
//     endDate, 
//     classId, 
//     subjects, // Array of { subjectId, totalMarks, durationHours (optional), startTime (optional), endTime (optional) }
//     maxExamsPerDay = 2, 
//     availableRooms 
//   } = req.body;
//   const schoolId = req.school._id;
//   const connection = req.connection;
//   const Exam = getModel('Exam', connection);
//   const Class = getModel('Class', connection);
//   const Subject = getModel('Subject', connection);
//   const User = getModel('User', connection);

//   const session = await connection.startSession();
//   let transactionCommitted = false;

//   try {
//     session.startTransaction();

//     // Validate class
//     const classData = await Class.findById(classId).lean();
//     if (!classData) throw new Error('Class not found');

//     // Validate subjects belong to the selected class
//     const subjectIds = subjects.map(s => s.subjectId);
//     const validSubjects = await Subject.find({ 
//       _id: { $in: subjectIds }, 
//       class: classId, 
//       school: schoolId 
//     }).lean();

//     if (validSubjects.length !== subjects.length) {
//       const invalidSubjects = subjectIds.filter(id => !validSubjects.some(s => s._id.toString() === id));
//       throw new Error(`Invalid subjects for class ${classData.name}: ${invalidSubjects.join(', ')}`);
//     }

//     // Map subjects to include their names for later use
//     const subjectMap = validSubjects.reduce((acc, subj) => {
//       acc[subj._id.toString()] = subj.name;
//       return acc;
//     }, {});

//     // Calculate available exam slots
//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     const daysAvailable = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
//     const totalSlots = daysAvailable * maxExamsPerDay;
//     if (subjects.length > totalSlots) {
//       throw new Error('Not enough days to schedule all exams');
//     }

//     // Default durations based on exam type (in hours)
//     const defaultDurations = {
//       'Midterm': 2,
//       'Final': 3,
//       'Unit Test': 1,
//       'Practical': 2
//     };

//     // Default time slots if not provided
//     const defaultTimeSlots = {
//       morning: { start: "09:00", end: "11:00" }, // 2 hours default
//       afternoon: { start: "13:00", end: "15:00" } // 2 hours default
//     };

//     // Generate exam schedule
//     const students = await User.find({ 
//       role: 'student', 
//       'studentDetails.class': classId, 
//       school: schoolId 
//     }).lean();

//     const examSchedule = [];
//     let currentDate = new Date(start);
//     let examsToday = 0;

//     for (const subject of subjects) {
//       if (examsToday >= maxExamsPerDay) {
//         currentDate.setDate(currentDate.getDate() + 1);
//         examsToday = 0;
//       }

//       // Determine duration and times
//       const defaultDuration = defaultDurations[examType] || 2;
//       const durationHours = subject.durationHours || defaultDuration;
//       const durationMinutes = durationHours * 60;

//       const slotKey = examsToday === 0 ? 'morning' : 'afternoon';
//       let startTime = subject.startTime || defaultTimeSlots[slotKey].start;
//       let endTime = subject.endTime;

//       // If endTime not provided, calculate it based on duration
//       if (!endTime) {
//         endTime = calculateEndTime(startTime, durationMinutes);
//       } else {
//         // Validate that provided endTime matches duration
//         const actualDuration = calculateDuration(startTime, endTime);
//         if (Math.abs(actualDuration - durationMinutes) > 5) { // Allow 5-minute tolerance
//           throw new Error(`Duration mismatch for subject ${subjectMap[subject.subjectId]}: specified ${durationHours} hours, but ${startTime}-${endTime} is ${actualDuration/60} hours`);
//         }
//       }

//       // Validate time format
//       if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
//         throw new Error(`Invalid time format for subject ${subjectMap[subject.subjectId]}: ${startTime}-${endTime}`);
//       }

//       const seating = adminController.generateSeatingArrangement(
//         students,
//         availableRooms,
//         students.length
//       );

//       const examDate = new Date(currentDate);
//       if (isNaN(examDate.getTime())) {
//         throw new Error(`Invalid date generated for subject ${subjectMap[subject.subjectId]}`);
//       }

//       const exam = new Exam({
//         school: schoolId,
//         name,
//         examType,
//         startDate,
//         endDate,
//         class: classId,
//         subject: subject.subjectId,
//         examDate: examDate,
//         startTime,
//         endTime,
//         duration: durationMinutes,
//         totalMarks: subject.totalMarks,
//         seatingArrangement: seating
//       });

//       await exam.save({ session });
//       examSchedule.push(exam);
//       examsToday++;
//     }

//     await session.commitTransaction();
//     transactionCommitted = true;

//     const populatedSchedule = await Exam.find({ _id: { $in: examSchedule.map(e => e._id) } })
//       .populate('subject', 'name')
//       .populate('class', 'name division')
//       .lean();

//     res.status(201).json({
//       success: true,
//       schedule: populatedSchedule,
//       message: 'Exam schedule created successfully'
//     });

//   } catch (error) {
//     if (!transactionCommitted) {
//       await session.abortTransaction();
//     }
//     console.error('Error in createExamSchedule:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message,
//       message: 'Failed to create exam schedule'
//     });
//   } finally {
//     session.endSession();
//   }
// },


createExamSchedule: async (req, res) => {
  const { 
    examType, 
    customExamType, // New field for custom exam type
    startDate, 
    endDate, 
    classId, 
    subjects, // Array of { subjectId, totalMarks, durationHours (optional), startTime (optional), endTime (optional) }
    maxExamsPerDay = 2, 
    availableRooms 
  } = req.body;
  const schoolId = req.school._id;
  const connection = req.connection;
  const Exam = getModel('Exam', connection);
  const Class = getModel('Class', connection);
  const Subject = getModel('Subject', connection);
  const User = getModel('User', connection);

  const session = await connection.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction();

    // Validate class
    const classData = await Class.findById(classId).lean();
    if (!classData) throw new Error('Class not found');

    // Validate subjects belong to the selected class
    const subjectIds = subjects.map(s => s.subjectId);
    const validSubjects = await Subject.find({ 
      _id: { $in: subjectIds }, 
      class: classId, 
      school: schoolId 
    }).lean();

    if (validSubjects.length !== subjects.length) {
      const invalidSubjects = subjectIds.filter(id => !validSubjects.some(s => s._id.toString() === id));
      throw new Error(`Invalid subjects for class ${classData.name}: ${invalidSubjects.join(', ')}`);
    }

    const subjectMap = validSubjects.reduce((acc, subj) => {
      acc[subj._id.toString()] = subj.name;
      return acc;
    }, {});

    // Validate examType and customExamType
    const validExamTypes = ['Unit Test', 'Midterm', 'Final', 'Practical', 'Other'];
    if (!validExamTypes.includes(examType)) {
      throw new Error('Invalid exam type');
    }
    if (examType === 'Other' && (!customExamType || customExamType.trim() === '')) {
      throw new Error('Custom exam type is required when selecting "Other"');
    }

    // Calculate available exam slots
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysAvailable = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    const totalSlots = daysAvailable * maxExamsPerDay;
    if (subjects.length > totalSlots) {
      throw new Error('Not enough days to schedule all exams');
    }

    // Default durations based on exam type (in hours)
    const defaultDurations = {
      'Midterm': 2,
      'Final': 3,
      'Unit Test': 1,
      'Practical': 2,
      'Other': 2 // Default for custom type
    };

    const defaultTimeSlots = {
      morning: { start: "09:00", end: "11:00" },
      afternoon: { start: "13:00", end: "15:00" }
    };

    // Generate exam schedule
    const students = await User.find({ 
      role: 'student', 
      'studentDetails.class': classId, 
      school: schoolId 
    }).lean();

    const examSchedule = [];
    let currentDate = new Date(start);
    let examsToday = 0;

    for (const subject of subjects) {
      if (examsToday >= maxExamsPerDay) {
        currentDate.setDate(currentDate.getDate() + 1);
        examsToday = 0;
      }

      const defaultDuration = defaultDurations[examType] || 2;
      const durationHours = subject.durationHours || defaultDuration;
      const durationMinutes = durationHours * 60;

      const slotKey = examsToday === 0 ? 'morning' : 'afternoon';
      let startTime = subject.startTime || defaultTimeSlots[slotKey].start;
      let endTime = subject.endTime;

      if (!endTime) {
        endTime = calculateEndTime(startTime, durationMinutes);
      } else {
        const actualDuration = calculateDuration(startTime, endTime);
        if (Math.abs(actualDuration - durationMinutes) > 5) {
          throw new Error(`Duration mismatch for subject ${subjectMap[subject.subjectId]}: specified ${durationHours} hours, but ${startTime}-${endTime} is ${actualDuration/60} hours`);
        }
      }

      if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
        throw new Error(`Invalid time format for subject ${subjectMap[subject.subjectId]}: ${startTime}-${endTime}`);
      }

      const seating = adminController.generateSeatingArrangement(
        students,
        availableRooms,
        students.length
      );

      const examDate = new Date(currentDate);
      if (isNaN(examDate.getTime())) {
        throw new Error(`Invalid date generated for subject ${subjectMap[subject.subjectId]}`);
      }

      const exam = new Exam({
        school: schoolId,
        examType,
        customExamType: examType === 'Other' ? customExamType : undefined,
        startDate,
        endDate,
        class: classId,
        subject: subject.subjectId,
        examDate: examDate,
        startTime,
        endTime,
        duration: durationMinutes,
        totalMarks: subject.totalMarks,
        seatingArrangement: seating
      });

      await exam.save({ session });
      examSchedule.push(exam);
      examsToday++;
    }

    await session.commitTransaction();
    transactionCommitted = true;

    const populatedSchedule = await Exam.find({ _id: { $in: examSchedule.map(e => e._id) } })
      .populate('subject', 'name')
      .populate('class', 'name division')
      .lean();

    res.status(201).json({
      success: true,
      schedule: populatedSchedule,
      message: 'Exam schedule created successfully'
    });

  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    console.error('Error in createExamSchedule:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to create exam schedule'
    });
  } finally {
    session.endSession();
  }
},
// Updated getExamSchedules to work with new structure
// In adminController
// getExamSchedules: async (req, res) => {
//   try {
//     const schoolId = req.school._id;
//     const connection = req.connection;
//     const Exam = getModel('Exam', connection);
//     const Class = getModel('Class', connection);
//     const Subject = getModel('Subject', connection);

//     const exams = await Exam.find({ school: schoolId })
//       .populate('class', 'name division', Class)
//       .populate('subject', 'name', Subject)
//       .sort({ examDate: 1, startTime: 1 })
//       .lean();

//     if (!exams.length) {
//       return res.status(404).json({ message: 'No exam schedules found' });
//     }

//     // Group exams by date with proper date validation
//     const scheduleByDate = exams.reduce((acc, exam) => {
//       // Check if examDate exists and is valid
//       if (!exam.examDate || !(exam.examDate instanceof Date) || isNaN(exam.examDate.getTime())) {
//         console.warn(`Invalid examDate for exam ${exam._id}: ${exam.examDate}`);
//         // Use a fallback date or skip this exam
//         const fallbackDate = new Date().toISOString().split('T')[0]; // Current date as fallback
//         acc[fallbackDate] = acc[fallbackDate] || [];
//         acc[fallbackDate].push({ ...exam, examDate: new Date(fallbackDate) });
//         return acc;
//       }

//       const dateKey = exam.examDate.toISOString().split('T')[0];
//       acc[dateKey] = acc[dateKey] || [];
//       acc[dateKey].push(exam);
//       return acc;
//     }, {});

//     // Sort exams within each date by startTime
//     Object.keys(scheduleByDate).forEach(date => {
//       scheduleByDate[date].sort((a, b) => {
//         if (!a.startTime || !b.startTime) return 0;
//         return a.startTime.localeCompare(b.startTime);
//       });
//     });

//     res.status(200).json({
//       success: true,
//       schedule: scheduleByDate,
//       totalExams: exams.length,
//       message: 'Exam schedules retrieved successfully'
//     });
//   } catch (error) {
//     console.error('Error in getExamSchedules:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message,
//       message: 'Failed to retrieve exam schedules'
//     });
//   }
// },

getExamSchedules: async (req, res) => {
  try {
    const schoolId = req.school._id;
    const connection = req.connection;
    const Exam = getModel('Exam', connection);
    const Class = getModel('Class', connection);
    const Subject = getModel('Subject', connection);

    const exams = await Exam.find({ school: schoolId })
      .populate('class', 'name division', Class)
      .populate('subject', 'name', Subject)
      .sort({ examDate: 1, startTime: 1 })
      .lean();

    if (!exams.length) {
      return res.status(404).json({ message: 'No exam schedules found' });
    }

    const scheduleByDate = exams.reduce((acc, exam) => {
      if (!exam.examDate || !(exam.examDate instanceof Date) || isNaN(exam.examDate.getTime())) {
        console.warn(`Invalid examDate for exam ${exam._id}: ${exam.examDate}`);
        const fallbackDate = new Date().toISOString().split('T')[0];
        acc[fallbackDate] = acc[fallbackDate] || [];
        acc[fallbackDate].push({ ...exam, examDate: new Date(fallbackDate) });
        return acc;
      }

      const dateKey = exam.examDate.toISOString().split('T')[0];
      acc[dateKey] = acc[dateKey] || [];
      acc[dateKey].push({
        ...exam,
        displayExamType: exam.examType === 'Other' ? exam.customExamType : exam.examType
      });
      return acc;
    }, {});

    Object.keys(scheduleByDate).forEach(date => {
      scheduleByDate[date].sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return a.startTime.localeCompare(b.startTime);
      });
    });

    res.status(200).json({
      success: true,
      schedule: scheduleByDate,
      totalExams: exams.length,
      message: 'Exam schedules retrieved successfully'
    });
  } catch (error) {
    console.error('Error in getExamSchedules:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      message: 'Failed to retrieve exam schedules'
    });
  }
},

  enterResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const { results } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = getModel('Exam', connection);
      const Result = getModel('Result', connection);

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const examSchedule = await Exam.findById(examId).lean();
        if (!examSchedule) throw new Error('Exam schedule not found');

        const resultPromises = results.map(async studentResult => {
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

  generateReportCards: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Result = getModel('Result', connection);
      const Exam = getModel('Exam', connection);
      const User = getModel('User', connection);

      const results = await Result.find({ exam: examId, class: classId, school: schoolId })
        .populate('student', 'name profile', User)
        .populate('exam', 'examType academicYear', Exam)
        .lean();

      const classStats = calculateClassStatistics(results);
      const reportCards = results.map(result => generateReportCard(result, classStats));

      res.json(reportCards);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

// Helper Functions
const getDefaultPermissions = role => {
  const permissions = {
    canTakeAttendance: [],
    canEnterMarks: [],
    canPublishAnnouncements: false,
    canManageInventory: false,
    canManageFees: false,
    canManageLibrary: false,
  };

  switch (role) {
    case 'teacher':
      permissions.canEnterMarks = [];
      break;
    case 'librarian':
      permissions.canManageLibrary = true;
      break;
    case 'inventory_manager':
      permissions.canManageInventory = true;
      break;
    case 'fee_manager':
      permissions.canManageFees = true;
      break;
  }

  return permissions;
};

const checkTeacherConflicts = async schedule => {
  const conflicts = [];
  const teacherSchedule = {};

  schedule.forEach(slot => {
    const key = `${slot.day}-${slot.period}`;
    if (teacherSchedule[key]?.includes(slot.teacher)) {
      conflicts.push({ teacher: slot.teacher, day: slot.day, period: slot.period });
    } else {
      teacherSchedule[key] = teacherSchedule[key] || [];
      teacherSchedule[key].push(slot.teacher);
    }
  });

  return conflicts;
};

const optimizeSchedule = (schedule, constraints) => {
  const optimizedSchedule = [...schedule];
  optimizedSchedule.sort((a, b) => (constraints.subjectWeights[b.subject] || 1) - (constraints.subjectWeights[a.subject] || 1));

  const daysPerWeek = 5;
  const periodsPerDay = 8;
  const distribution = Array(daysPerWeek).fill().map(() => Array(periodsPerDay).fill(null));

  optimizedSchedule.forEach(slot => {
    let placed = false;
    for (let day = 0; day < daysPerWeek && !placed; day++) {
      for (let period = 0; period < periodsPerDay && !placed; period++) {
        if (!distribution[day][period] && isValidPlacement(slot, day, period, constraints)) {
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
    if (previousSlot && isHeavySubject(previousSlot.subject, subjectWeights)) return false;
  }
  return true;
};

const isHeavySubject = (subject, subjectWeights) => (subjectWeights[subject] || 1) > 2;

const shuffleArray = array => {
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
  groupedData.forEach(period => {
    const periodStats = {
      present: period.filter(a => a.status === 'present').length,
      absent: period.filter(a => a.status === 'absent').length,
      late: period.filter(a => a.status === 'late').length,
    };

    statistics.totalPresent += periodStats.present;
    statistics.totalAbsent += periodStats.absent;
    statistics.totalLate += periodStats.late;

    const total = periodStats.present + periodStats.absent + periodStats.late;
    const percentage = total ? (periodStats.present / total) * 100 : 0;

    statistics.trendByPeriod.push({ period: period[0].date.toISOString().split('T')[0], percentage });

    period.forEach(record => {
      if (!statistics.studentWiseAnalysis.has(record.user._id.toString())) {
        statistics.studentWiseAnalysis.set(record.user._id.toString(), { name: record.user.name, present: 0, absent: 0, late: 0 });
      }
      const studentStats = statistics.studentWiseAnalysis.get(record.user._id.toString());
      studentStats[record.status]++;
    });
  });

  const total = statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
  statistics.percentagePresent = total ? (statistics.totalPresent / total) * 100 : 0;

  return statistics;
};

const generateDetailedAttendanceReport = (attendanceData, reportType) => {
  const report = { byClass: new Map(), byTeacher: new Map(), byDate: new Map() };

  attendanceData.forEach(record => {
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
        report.byTeacher.set(teacherId, { recordsMarked: 0, classes: new Set() });
      }
      const teacherStats = report.byTeacher.get(teacherId);
      teacherStats.recordsMarked++;
      teacherStats.classes.add(classId);
    }

    const dateKey = record.date.toISOString().split('T')[0];
    if (!report.byDate.has(dateKey)) {
      report.byDate.set(dateKey, { present: 0, absent: 0, late: 0 });
    }
    const dateStats = report.byDate.get(dateKey);
    dateStats[record.status]++;
  });

  return {
    classWise: Array.from(report.byClass, ([id, stats]) => ({ id, ...stats })),
    teacherWise: Array.from(report.byTeacher, ([id, stats]) => ({ id, ...stats, classes: Array.from(stats.classes) })),
    dateWise: Array.from(report.byDate, ([date, stats]) => ({ date, ...stats })),
  };
};

const generateAttendanceCharts = attendanceData => {
  const trendsOverTime = [];
  const classComparison = new Map();
  const dayWisePatterns = new Map(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => [day, { present: 0, absent: 0, late: 0 }]));

  attendanceData.forEach(record => {
    const dateStr = record.date.toISOString().split('T')[0];
    const dayName = new Date(record.date).toLocaleString('en-US', { weekday: 'short' });

    if (!trendsOverTime.some(t => t.date === dateStr)) {
      trendsOverTime.push({ date: dateStr, present: 0, absent: 0, late: 0 });
    }
    const trend = trendsOverTime.find(t => t.date === dateStr);
    trend[record.status]++;

    const classId = record.class._id.toString();
    if (!classComparison.has(classId)) {
      classComparison.set(classId, { name: `${record.class.name}-${record.class.division}`, present: 0, absent: 0, late: 0 });
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
    dayWisePatterns: Array.from(dayWisePatterns, ([day, stats]) => ({ day, ...stats })),
  };
};

const calculateGrade = subjects => {
  const percentage = calculatePercentage(subjects);
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  return 'F';
};

const groupAttendanceByPeriod = (attendanceData, reportType) => {
  const grouped = new Map();
  attendanceData.forEach(record => {
    const periodKey = getPeriodKey(record.date, reportType);
    if (!grouped.has(periodKey)) grouped.set(periodKey, []);
    grouped.get(periodKey).push(record);
  });
  return Array.from(grouped.values());
};

const getPeriodKey = (date, reportType) => {
  const d = new Date(date);
  switch (reportType) {
    case 'daily': return d.toISOString().split('T')[0];
    case 'weekly': return `${d.getFullYear()}-W${getWeekNumber(d)}`;
    case 'monthly': return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'yearly': return d.getFullYear().toString();
    default: return d.toISOString().split('T')[0];
  }
};

const getWeekNumber = date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const getCurrentAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return month < 6 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
};

// Fully Implemented Helper Functions
const generateStudentReportCards = classResult => {
  const reportCards = [];
  const subjectMarks = classResult.subjectMarks || [];

  subjectMarks.forEach(subjectMark => {
    subjectMark.students.forEach(student => {
      const existingCard = reportCards.find(card => card.student.toString() === student.student.toString());
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
          grade: '',
          status: 'pending',
          publishedBy: classResult.updatedBy,
        });
      }
    });
  });

  reportCards.forEach(card => {
    card.totalMarks = calculateTotalMarks(card.subjects);
    card.percentage = calculatePercentage(card.subjects);
    card.grade = calculateGrade(card.subjects);
    card.status = 'completed';
  });

  return reportCards;
};

const calculateTotalMarks = subjects => {
  return subjects.reduce((sum, subject) => sum + (subject.marks || 0), 0);
};

const calculatePercentage = subjects => {
  const totalObtained = calculateTotalMarks(subjects);
  const totalPossible = subjects.reduce((sum, subject) => sum + (subject.totalMarks || 100), 0);
  return totalPossible ? (totalObtained / totalPossible) * 100 : 0;
};

const determineStatus = subjects => {
  const allMarked = subjects.every(subject => typeof subject.marks === 'number');
  return allMarked ? 'completed' : 'pending';
};
const calculateEndTime = (startTime, durationMinutes) => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startMinutes = hours * 60 + minutes;
  const endMinutes = startMinutes + durationMinutes;
  
  const endHours = Math.floor(endMinutes / 60) % 24;
  const endMins = endMinutes % 60;
  
  return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
};

const calculateDuration = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);
  
  const startTotal = startHours * 60 + startMinutes;
  let endTotal = endHours * 60 + endMinutes;
  
  // Handle case where end time crosses midnight
  if (endTotal < startTotal) {
    endTotal += 24 * 60;
  }
  
  return endTotal - startTotal;
};

const isValidTimeFormat = (time) => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

const calculateClassStatistics = results => {
  const stats = {
    totalStudents: results.length,
    averagePercentage: 0,
    highestPercentage: 0,
    lowestPercentage: Infinity,
    subjectAverages: new Map(),
  };

  if (!results.length) return stats;

  let totalPercentage = 0;
  results.forEach(result => {
    const percentage = calculatePercentage(result.subjects);
    totalPercentage += percentage;
    stats.highestPercentage = Math.max(stats.highestPercentage, percentage);
    stats.lowestPercentage = Math.min(stats.lowestPercentage, percentage);

    result.subjects.forEach(subject => {
      if (!stats.subjectAverages.has(subject.subject.toString())) {
        stats.subjectAverages.set(subject.subject.toString(), { total: 0, count: 0 });
      }
      const subjectStats = stats.subjectAverages.get(subject.subject.toString());
      subjectStats.total += subject.marks;
      subjectStats.count++;
    });
  });

  stats.averagePercentage = totalPercentage / results.length;
  stats.subjectAverages = Array.from(stats.subjectAverages, ([subjectId, { total, count }]) => ({
    subjectId,
    average: total / count,
  }));

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
    subjects: result.subjects.map(subject => ({
      subjectId: subject.subject,
      marks: subject.marks,
      totalMarks: subject.totalMarks,
    })),
    totalMarks,
    percentage,
    grade,
    classRank: classStats.totalStudents
      ? Math.floor((classStats.highestPercentage - percentage) / (classStats.highestPercentage - classStats.lowestPercentage) * (classStats.totalStudents - 1)) + 1
      : 1,
    classAverage: classStats.averagePercentage,
  };
};

module.exports = adminController;