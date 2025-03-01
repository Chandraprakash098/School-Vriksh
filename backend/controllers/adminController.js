
// const User = require('../models/User');
// const Class = require('../models/Class');
// const Subject = require('../models/Subject');
// const Syllabus = require('../models/Syllabus');
// const TeacherAssignment = require('../models/TeacherAssignment');
// const Timetable = require('../models/Timetable');
// const Attendance = require('../models/Attendance');
// const Exam = require('../models/Exam');
// const Result = require('../models/Results');
// const Announcement = require('../models/Announcement');
// const Meeting = require('../models/Meeting');
// const SubjectMarks = require('../models/SubjectMarks')
// const classResult = require('../models/ClassResult')
// // const TrusteeActivity = require('../models/TrusteeActivity');
// const bcrypt = require('bcryptjs');
// const mongoose = require('mongoose');
// const { cloudinary } = require('../config/cloudinary')
// const multer = require('multer');


// const adminController = {
//   // ============ User Management ============
//   createUser: async (req, res) => {
//     try {
//       const { name, email, password, role, profile } = req.body;
//       if (!req.school) {
//         return res.status(400).json({ error: 'No school associated with this admin' });
//       }
//       const schoolId = req.school._id; // Updated to use req.school from auth middleware
//       const connection = req.connection; // Use school-specific connection
//       const User = require('../models/User')(connection);

//       // Check if email already exists
//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({ message: 'Email already registered' });
//       }

//       // Generate hashed password
//       const salt = await bcrypt.genSalt(10);
//       const hashedPassword = await bcrypt.hash(password, salt);

//       // Set default permissions based on role
//       const permissions = getDefaultPermissions(role);

//       const user = new User({
//         school: schoolId,
//         name,
//         email,
//         password: hashedPassword,
//         role,
//         profile,
//         permissions,
//       });

//       await user.save();
//       res.status(201).json(user);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all users
//   getUsers: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const users = await User.find({ school: schoolId })
//         .select('-password')
//         .populate('permissions.canTakeAttendance', 'name division', Class)
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division', Class);

//       res.json(users);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get specific user
//   getUser: async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const user = await User.findOne({ _id: userId, school: schoolId })
//         .select('-password')
//         .populate('permissions.canTakeAttendance', 'name division', Class)
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division', Class);

//       if (!user) {
//         return res.status(404).json({ message: 'User not found' });
//       }

//       res.json(user);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAvailableClasses: async (req, res) => {
//     try {
//       if (!req.school) {
//         return res.status(400).json({ error: 'No school associated with this user' });
//       }
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);

//       // Fetch classes that don't have a class teacher assigned
//       const availableClasses = await Class.find({
//         school: schoolId,
//         $or: [
//           { classTeacher: null },
//           { classTeacher: { $exists: false } },
//         ],
//       })
//         .select('name division academicYear')
//         .sort({ name: 1, division: 1 });

//       // Also fetch classes that have a class teacher for reference
//       const assignedClasses = await Class.find({
//         school: schoolId,
//         classTeacher: { $exists: true, $ne: null },
//       })
//         .select('name division academicYear classTeacher')
//         .populate('classTeacher', 'name')
//         .sort({ name: 1, division: 1 });

//       res.json({
//         available: availableClasses,
//         assigned: assignedClasses,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getSubjectsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Subject = require('../models/Subject')(connection);

//       if (!classId || !schoolId) {
//         return res.status(400).json({ error: 'Invalid classId or schoolId' });
//       }

//       const subjects = await Subject.find({
//         school: schoolId,
//         class: classId,
//       }).select('name');

//       if (!subjects) {
//         return res.status(404).json({ error: 'No subjects found' });
//       }

//       res.json(subjects);
//     } catch (error) {
//       console.error('Error fetching subjects:', error);
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   },

//   // createTeacher: async (req, res) => {

//   //   const connection = req.connection;

//   //   const session = await mongoose.startSession();
//   //   session.startTransaction();

//   //   try {
//   //     const {
//   //       name,
//   //       email,
//   //       password,
//   //       phone,
//   //       address,
//   //       photo,
//   //       teachingClass,
//   //       selectedSubjects,
//   //       classTeacherOf,
//   //     } = req.body;
//   //     const schoolId = req.school._id;
//   //     // const connection = req.connection;
//   //     const User = require('../models/User')(connection);
//   //     const Class = require('../models/Class')(connection);
//   //     const Subject = require('../models/Subject')(connection);
//   //     const TeacherAssignment = require('../models/TeacherAssignment')(connection);

//   //     // Basic validation
//   //     if (!teachingClass || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
//   //       return res.status(400).json({
//   //         success: false,
//   //         message: 'Please select a class and at least one subject for teaching',
//   //       });
//   //     }

//   //     // Check if email exists
//   //     const existingUser = await User.findOne({ email });
//   //     if (existingUser) {
//   //       return res.status(400).json({
//   //         success: false,
//   //         message: 'Email already registered',
//   //       });
//   //     }

//   //     // Validate subjects and check availability
//   //     const subjects = await Subject.find({
//   //       _id: { $in: selectedSubjects },
//   //       class: teachingClass,
//   //       school: schoolId,
//   //     });

//   //     // Check if all selected subjects exist
//   //     if (subjects.length !== selectedSubjects.length) {
//   //       return res.status(400).json({
//   //         success: false,
//   //         message: 'One or more selected subjects are invalid for the chosen class',
//   //       });
//   //     }

//   //     // Check if any selected subjects are already assigned
//   //     const assignedSubjects = subjects.filter(subject =>
//   //       subject.teachers && subject.teachers.length > 0
//   //     );

//   //     if (assignedSubjects.length > 0) {
//   //       return res.status(400).json({
//   //         success: false,
//   //         message: `Cannot assign already assigned subjects: ${assignedSubjects.map(s => s.name).join(', ')}`,
//   //         assignedSubjects: assignedSubjects.map(s => ({
//   //           name: s.name,
//   //           assignedTo: s.teachers[0].teacher,
//   //         })),
//   //       });
//   //     }

//   //     // Validate class teacher assignment if provided
//   //     if (classTeacherOf) {
//   //       const classTeacherData = await Class.findOne({
//   //         _id: classTeacherOf,
//   //         school: schoolId,
//   //       });

//   //       if (!classTeacherData) {
//   //         return res.status(400).json({
//   //           success: false,
//   //           message: 'Selected class for class teacher role not found',
//   //         });
//   //       }

//   //       if (classTeacherData.classTeacher) {
//   //         return res.status(400).json({
//   //           success: false,
//   //           message: 'Selected class already has a class teacher assigned',
//   //         });
//   //       }
//   //     }

//   //     // Create user account
//   //     const salt = await bcrypt.genSalt(10);
//   //     const hashedPassword = await bcrypt.hash(password, salt);

//   //     // Prepare permissions
//   //     const permissions = {
//   //       canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
//   //       canEnterMarks: selectedSubjects.map(subjectId => ({
//   //         class: teachingClass,
//   //         subject: subjectId,
//   //       })),
//   //       canPublishAnnouncements: true,
//   //       canManageInventory: false,
//   //       canManageFees: false,
//   //       canManageLibrary: false,
//   //     };

//   //     // Create teacher user
//   //     const teacher = new User({
//   //       school: schoolId,
//   //       name,
//   //       email,
//   //       password: hashedPassword,
//   //       role: 'teacher',
//   //       profile: { phone, address, photo },
//   //       permissions,
//   //     });

//   //     await teacher.save({ session });

//   //     // Create teacher assignment record
//   //     const teacherAssignment = new TeacherAssignment({
//   //       school: schoolId,
//   //       teacher: teacher._id,
//   //       classTeacherAssignment: classTeacherOf ? {
//   //         class: classTeacherOf,
//   //         assignedAt: new Date(),
//   //       } : null,
//   //       subjectAssignments: selectedSubjects.map(subjectId => ({
//   //         class: teachingClass,
//   //         subject: subjectId,
//   //         assignedAt: new Date(),
//   //       })),
//   //       academicYear: getCurrentAcademicYear(),
//   //     });

//   //     await teacherAssignment.save({ session });

//   //     // Update class if assigned as class teacher
//   //     if (classTeacherOf) {
//   //       await Class.findByIdAndUpdate(
//   //         classTeacherOf,
//   //         {
//   //           classTeacher: teacher._id,
//   //           lastUpdated: new Date(),
//   //           updatedBy: req.user._id,
//   //         },
//   //         { session }
//   //       );
//   //     }

//   //     // Update all selected subjects
//   //     await Promise.all(selectedSubjects.map(subjectId =>
//   //       Subject.findByIdAndUpdate(
//   //         subjectId,
//   //         {
//   //           $push: {
//   //             teachers: {
//   //               teacher: teacher._id,
//   //               assignedAt: new Date(),
//   //             },
//   //           },
//   //         },
//   //         { session }
//   //       )
//   //     ));

//   //     await session.commitTransaction();

//   //     // Fetch populated data for response
//   //     const populatedTeacher = await User.findById(teacher._id)
//   //       .populate('permissions.canTakeAttendance', 'name division', Class)
//   //       .populate('permissions.canEnterMarks.subject', 'name', Subject)
//   //       .populate('permissions.canEnterMarks.class', 'name division', Class);

//   //     const populatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
//   //       .populate('classTeacherAssignment.class', 'name division', Class)
//   //       .populate('subjectAssignments.class', 'name division', Class)
//   //       .populate('subjectAssignments.subject', 'name', Subject);

//   //     res.status(201).json({
//   //       success: true,
//   //       teacher: populatedTeacher,
//   //       assignment: populatedAssignment,
//   //       message: 'Teacher created successfully',
//   //     });
//   //   } catch (error) {
//   //     await session.abortTransaction();
//   //     res.status(500).json({
//   //       success: false,
//   //       message: 'Failed to create teacher',
//   //       error: error.message,
//   //     });
//   //   } finally {
//   //     session.endSession();
//   //   }
//   // },

//   createTeacher: async (req, res) => {
//     const connection = req.connection;
  
//     // Debugging: Log connection state
//     console.log('Connection readyState before session:', connection.readyState);
//     console.log('Connection name:', connection.name);
  
//     // Check if connection is ready
//     if (connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database connection is not ready',
//         readyState: connection.readyState,
//       });
//     }
  
//     // Start session with increased timeout
//     let session;
//     try {
//       session = await connection.startSession({
//         defaultTransactionOptions: {
//           readPreference: 'primary',
//           readConcern: { level: 'local' },
//           writeConcern: { w: 'majority' },
//         },
//       });
//       console.log('Session started successfully');
//       session.startTransaction();
//     } catch (error) {
//       console.error('Failed to start session:', error.message);
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to start database session',
//         error: error.message,
//       });
//     }
  
//     try {
//       const {
//         name,
//         email,
//         password,
//         phone,
//         address,
//         photo,
//         teachingClass,
//         selectedSubjects,
//         classTeacherOf,
//       } = req.body;
//       const schoolId = req.school._id;
  
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
  
//       if (!teachingClass || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: 'Please select a class and at least one subject for teaching',
//         });
//       }
  
//       const existingUser = await User.findOne({ email }).session(session);
//       if (existingUser) {
//         return res.status(400).json({
//           success: false,
//           message: 'Email already registered',
//         });
//       }
  
//       const subjects = await Subject.find({
//         _id: { $in: selectedSubjects },
//         class: teachingClass,
//         school: schoolId,
//       }).session(session);
  
//       if (subjects.length !== selectedSubjects.length) {
//         return res.status(400).json({
//           success: false,
//           message: 'One or more selected subjects are invalid for the chosen class',
//         });
//       }
  
//       const assignedSubjects = subjects.filter(subject =>
//         subject.teachers && subject.teachers.length > 0
//       );
  
//       if (assignedSubjects.length > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot assign already assigned subjects: ${assignedSubjects.map(s => s.name).join(', ')}`,
//           assignedSubjects: assignedSubjects.map(s => ({
//             name: s.name,
//             assignedTo: s.teachers[0].teacher,
//           })),
//         });
//       }
  
//       if (classTeacherOf) {
//         const classTeacherData = await Class.findOne({
//           _id: classTeacherOf,
//           school: schoolId,
//         }).session(session);
  
//         if (!classTeacherData) {
//           return res.status(400).json({
//             success: false,
//             message: 'Selected class for class teacher role not found',
//           });
//         }
  
//         if (classTeacherData.classTeacher) {
//           return res.status(400).json({
//             success: false,
//             message: 'Selected class already has a class teacher assigned',
//           });
//         }
//       }
  
//       const salt = await bcrypt.genSalt(10);
//       const hashedPassword = await bcrypt.hash(password, salt);
  
//       const permissions = {
//         canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
//         canEnterMarks: selectedSubjects.map(subjectId => ({
//           class: teachingClass,
//           subject: subjectId,
//         })),
//         canPublishAnnouncements: true,
//         canManageInventory: false,
//         canManageFees: false,
//         canManageLibrary: false,
//       };
  
//       const teacher = new User({
//         school: schoolId,
//         name,
//         email,
//         password: hashedPassword,
//         role: 'teacher',
//         profile: { phone, address, photo },
//         permissions,
//       });
  
//       await teacher.save({ session });
  
//       const teacherAssignment = new TeacherAssignment({
//         school: schoolId,
//         teacher: teacher._id,
//         classTeacherAssignment: classTeacherOf ? {
//           class: classTeacherOf,
//           assignedAt: new Date(),
//         } : null,
//         subjectAssignments: selectedSubjects.map(subjectId => ({
//           class: teachingClass,
//           subject: subjectId,
//           assignedAt: new Date(),
//         })),
//         academicYear: getCurrentAcademicYear(),
//       });
  
//       await teacherAssignment.save({ session });
  
//       if (classTeacherOf) {
//         await Class.findByIdAndUpdate(
//           classTeacherOf,
//           {
//             classTeacher: teacher._id,
//             lastUpdated: new Date(),
//             updatedBy: req.user._id,
//           },
//           { session }
//         );
//       }
  
//       await Promise.all(selectedSubjects.map(subjectId =>
//         Subject.findByIdAndUpdate(
//           subjectId,
//           {
//             $push: {
//               teachers: {
//                 teacher: teacher._id,
//                 assignedAt: new Date(),
//               },
//             },
//           },
//           { session }
//         )
//       ));
  
//       await session.commitTransaction();
  
//       const populatedTeacher = await User.findById(teacher._id)
//         .populate('permissions.canTakeAttendance', 'name division', Class)
//         .populate('permissions.canEnterMarks.subject', 'name', Subject)
//         .populate('permissions.canEnterMarks.class', 'name division', Class);
  
//       const populatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
//         .populate('classTeacherAssignment.class', 'name division', Class)
//         .populate('subjectAssignments.class', 'name division', Class)
//         .populate('subjectAssignments.subject', 'name', Subject);
  
//       res.status(201).json({
//         success: true,
//         teacher: populatedTeacher,
//         assignment: populatedAssignment,
//         message: 'Teacher created successfully',
//       });
//     } catch (error) {
//       console.error('Transaction error:', error.message);
//       await session.abortTransaction();
//       res.status(500).json({
//         success: false,
//         message: 'Failed to create teacher',
//         error: error.message,
//       });
//     } finally {
//       session.endSession();
//       console.log('Session ended');
//     }
//   },

  
//   updateTeacherAssignments: async (req, res) => {
//     const connection = req.connection;
  
//     // Debugging: Log connection state
//     console.log('Connection readyState before session:', connection.readyState);
//     console.log('Connection name:', connection.name);
  
//     // Check if connection is ready
//     if (connection.readyState !== 1) {
//       return res.status(500).json({
//         success: false,
//         message: 'Database connection is not ready',
//         readyState: connection.readyState,
//       });
//     }
  
//     // Start session using the specific connection
//     let session;
//     try {
//       session = await connection.startSession({
//         defaultTransactionOptions: {
//           readPreference: 'primary',
//           readConcern: { level: 'local' },
//           writeConcern: { w: 'majority' },
//         },
//       });
//       console.log('Session started successfully');
//       session.startTransaction();
//     } catch (error) {
//       console.error('Failed to start session:', error.message);
//       return res.status(500).json({
//         success: false,
//         message: 'Failed to start database session',
//         error: error.message,
//       });
//     }
  
//     try {
//       const { teacherId } = req.params;
//       const {
//         classTeacherOf, // New class ID for class teacher role
//         removeClassTeacherRole, // Boolean to remove class teacher role
//         addSubjectAssignments, // Array of {classId, subjectId} to add
//         removeSubjectAssignments, // Array of {classId, subjectId} to remove
//       } = req.body;
//       const schoolId = req.school._id;
//       const adminId = req.user._id;
  
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
  
//       // Verify teacher exists
//       const teacher = await User.findOne({
//         _id: teacherId,
//         school: schoolId,
//         role: 'teacher',
//       }).session(session);
  
//       if (!teacher) {
//         return res.status(404).json({ message: 'Teacher not found' });
//       }
  
//       // Get current teacher assignment
//       let teacherAssignment = await TeacherAssignment.findOne({
//         teacher: teacherId,
//         school: schoolId,
//       }).session(session);
  
//       if (!teacherAssignment) {
//         teacherAssignment = new TeacherAssignment({
//           school: schoolId,
//           teacher: teacherId,
//           classTeacherAssignment: null,
//           subjectAssignments: [],
//           academicYear: getCurrentAcademicYear(),
//         });
//       }
  
//       // HANDLE CLASS TEACHER ASSIGNMENT
//       if (classTeacherOf) {
//         const newClass = await Class.findOne({
//           _id: classTeacherOf,
//           school: schoolId,
//         }).session(session);
  
//         if (!newClass) {
//           return res.status(400).json({ message: 'Class not found' });
//         }
  
//         if (newClass.classTeacher && newClass.classTeacher.toString() !== teacherId) {
//           return res.status(400).json({
//             message: 'This class already has a different class teacher assigned',
//           });
//         }
  
//         if (
//           teacherAssignment.classTeacherAssignment &&
//           teacherAssignment.classTeacherAssignment.class &&
//           teacherAssignment.classTeacherAssignment.class.toString() !== classTeacherOf
//         ) {
//           await Class.findByIdAndUpdate(
//             teacherAssignment.classTeacherAssignment.class,
//             {
//               $unset: { classTeacher: '' },
//               lastUpdated: new Date(),
//               updatedBy: adminId,
//             },
//             { session }
//           );
  
//           await User.findByIdAndUpdate(
//             teacherId,
//             {
//               $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class },
//             },
//             { session }
//           );
//         }
  
//         await Class.findByIdAndUpdate(
//           classTeacherOf,
//           {
//             classTeacher: teacherId,
//             lastUpdated: new Date(),
//             updatedBy: adminId,
//           },
//           { session }
//         );
  
//         teacherAssignment.classTeacherAssignment = {
//           class: classTeacherOf,
//           assignedAt: new Date(),
//         };
  
//         await User.findByIdAndUpdate(
//           teacherId,
//           {
//             $addToSet: { 'permissions.canTakeAttendance': classTeacherOf },
//           },
//           { session }
//         );
//       } else if (removeClassTeacherRole && teacherAssignment.classTeacherAssignment) {
//         await Class.findByIdAndUpdate(
//           teacherAssignment.classTeacherAssignment.class,
//           {
//             $unset: { classTeacher: '' },
//             lastUpdated: new Date(),
//             updatedBy: adminId,
//           },
//           { session }
//         );
  
//         await User.findByIdAndUpdate(
//           teacherId,
//           {
//             $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class },
//           },
//           { session }
//         );
  
//         teacherAssignment.classTeacherAssignment = null;
//       }
  
//       // HANDLE SUBJECT TEACHER ASSIGNMENTS - ADDITIONS
//       if (addSubjectAssignments?.length) {
//         const validationPromises = addSubjectAssignments.map(async ({ classId, subjectId }) => {
//           const subject = await Subject.findOne({
//             _id: subjectId,
//             class: classId,
//             school: schoolId,
//           }).session(session);
  
//           if (!subject) {
//             throw new Error(`Invalid subject assignment: Subject ${subjectId} for class ${classId}`);
//           }
  
//           return { classId, subjectId };
//         });
  
//         const validAssignments = await Promise.all(validationPromises);
  
//         for (const { classId, subjectId } of validAssignments) {
//           const existingAssignment = teacherAssignment.subjectAssignments.find(
//             a => a.class.toString() === classId && a.subject.toString() === subjectId
//           );
  
//           if (!existingAssignment) {
//             teacherAssignment.subjectAssignments.push({
//               class: classId,
//               subject: subjectId,
//               assignedAt: new Date(),
//             });
  
//             await Subject.findByIdAndUpdate(
//               subjectId,
//               {
//                 $addToSet: {
//                   teachers: {
//                     teacher: teacherId,
//                     assignedAt: new Date(),
//                   },
//                 },
//               },
//               { session }
//             );
  
//             await User.findByIdAndUpdate(
//               teacherId,
//               {
//                 $addToSet: {
//                   'permissions.canEnterMarks': {
//                     class: classId,
//                     subject: subjectId,
//                   },
//                 },
//               },
//               { session }
//             );
//           }
//         }
//       }
  
//       // HANDLE SUBJECT TEACHER ASSIGNMENTS - REMOVALS
//       if (removeSubjectAssignments?.length) {
//         for (const { classId, subjectId } of removeSubjectAssignments) {
//           teacherAssignment.subjectAssignments = teacherAssignment.subjectAssignments.filter(
//             a => !(a.class.toString() === classId && a.subject.toString() === subjectId)
//           );
  
//           await Subject.findByIdAndUpdate(
//             subjectId,
//             {
//               $pull: {
//                 teachers: {
//                   teacher: teacherId,
//                 },
//               },
//             },
//             { session }
//           );
  
//           await User.findByIdAndUpdate(
//             teacherId,
//             {
//               $pull: {
//                 'permissions.canEnterMarks': {
//                   class: classId,
//                   subject: subjectId,
//                 },
//               },
//             },
//             { session }
//           );
//         }
//       }
  
//       // Save all changes
//       await teacherAssignment.save({ session });
//       await session.commitTransaction();
  
//       // Fetch fully populated data for response
//       const updatedTeacher = await User.findById(teacherId)
//         .populate('permissions.canTakeAttendance', 'name division', Class)
//         .populate('permissions.canEnterMarks.subject', 'name', Subject)
//         .populate('permissions.canEnterMarks.class', 'name division', Class);
  
//       const updatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
//         .populate('classTeacherAssignment.class', 'name division', Class)
//         .populate('subjectAssignments.class', 'name division', Class)
//         .populate('subjectAssignments.subject', 'name', Subject);
  
//       res.json({
//         teacher: updatedTeacher,
//         assignment: updatedAssignment,
//         message: 'Teacher assignments updated successfully',
//       });
//     } catch (error) {
//       console.error('Transaction error:', error.message);
//       await session.abortTransaction();
//       res.status(500).json({
//         error: error.message,
//         message: 'Failed to update teacher assignments',
//       });
//     } finally {
//       session.endSession();
//       console.log('Session ended');
//     }
//   },

//   // adminController.js (Backend)
//   getAssignableSubjectsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Subject = require('../models/Subject')(connection);
//       const User = require('../models/User')(connection);

//       if (!classId || !schoolId) {
//         return res.status(400).json({ error: 'Invalid classId or schoolId' });
//       }

//       // Fetch subjects for the given class and school
//       const subjects = await Subject.find({
//         school: schoolId,
//         class: classId,
//       })
//         .select('name teachers')
//         .populate('teachers.teacher', 'name email', User);

//       if (!subjects || subjects.length === 0) {
//         return res.status(404).json({ error: 'No subjects found for this class' });
//       }

//       // Transform subjects into the expected format
//       const subjectsWithStatus = subjects.map((subject) => ({
//         _id: subject._id.toString(), // Ensure _id is a string for frontend compatibility
//         name: subject.name,
//         isAssigned: subject.teachers && subject.teachers.length > 0,
//         assignedTo:
//           subject.teachers.length > 0
//             ? {
//                 name: subject.teachers[0].teacher.name,
//                 email: subject.teachers[0].teacher.email,
//               }
//             : null,
//       }));

//       res.json({
//         subjects: subjectsWithStatus,
//         message: 'Subjects retrieved successfully',
//       });
//     } catch (error) {
//       console.error('Error fetching assignable subjects:', error);
//       res.status(500).json({ error: 'Internal Server Error' });
//     }
//   },

//   // Get all teacher assignments - useful for admin dashboard
//   getAllTeacherAssignments: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);

//       const assignments = await TeacherAssignment.find({ school: schoolId })
//         .populate('teacher', 'name email profile', User)
//         .populate('classTeacherAssignment.class', 'name division', Class)
//         .populate('subjectAssignments.class', 'name division', Class)
//         .populate('subjectAssignments.subject', 'name', Subject);

//       const classAssignmentMap = {};
//       const subjectAssignmentMap = {};

//       // Organize data for easy reference
//       assignments.forEach(assignment => {
//         // Map class teachers
//         if (assignment.classTeacherAssignment && assignment.classTeacherAssignment.class) {
//           const classId = assignment.classTeacherAssignment.class._id.toString();
//           classAssignmentMap[classId] = {
//             teacher: {
//               id: assignment.teacher._id,
//               name: assignment.teacher.name,
//               email: assignment.teacher.email,
//             },
//             assignedAt: assignment.classTeacherAssignment.assignedAt,
//           };
//         }

//         // Map subject teachers
//         assignment.subjectAssignments.forEach(subAssignment => {
//           const classId = subAssignment.class._id.toString();
//           const subjectId = subAssignment.subject._id.toString();
//           const key = `${classId}:${subjectId}`;

//           if (!subjectAssignmentMap[key]) {
//             subjectAssignmentMap[key] = [];
//           }

//           subjectAssignmentMap[key].push({
//             teacher: {
//               id: assignment.teacher._id,
//               name: assignment.teacher.name,
//               email: assignment.teacher.email,
//             },
//             assignedAt: subAssignment.assignedAt,
//           });
//         });
//       });

//       res.json({
//         raw: assignments,
//         classTeachers: classAssignmentMap,
//         subjectTeachers: subjectAssignmentMap,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getTeachers: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);

//       // Get all teachers
//       const teachers = await User.find({
//         school: schoolId,
//         role: 'teacher',
//       })
//         .select('-password')
//         .lean(); // Using lean() for better performance with plain objects

//       // Get all teacher assignments in one query
//       const assignments = await TeacherAssignment.find({
//         school: schoolId,
//         teacher: { $in: teachers.map(t => t._id) },
//       })
//         .populate({
//           path: 'classTeacherAssignment.class',
//           select: 'name division',
//           model: Class,
//         })
//         .populate({
//           path: 'subjectAssignments.class',
//           select: 'name division',
//           model: Class,
//         })
//         .populate({
//           path: 'subjectAssignments.subject',
//           select: 'name',
//           model: Subject,
//         })
//         .lean();

//       // Get current classes where teachers are assigned
//       const currentClasses = await Class.find({
//         school: schoolId,
//         classTeacher: { $in: teachers.map(t => t._id) },
//       })
//         .select('name division classTeacher')
//         .lean();

//       // Get current subjects where teachers are assigned
//       const currentSubjects = await Subject.find({
//         school: schoolId,
//         'teachers.teacher': { $in: teachers.map(t => t._id) },
//       })
//         .select('name class teachers')
//         .populate('class', 'name division', Class)
//         .lean();

//       // Create maps for quick lookups
//       const classTeacherMap = new Map(
//         currentClasses.map(c => [c.classTeacher.toString(), c])
//       );

//       const subjectTeacherMap = new Map();
//       currentSubjects.forEach(subject => {
//         subject.teachers.forEach(t => {
//           const key = t.teacher.toString();
//           if (!subjectTeacherMap.has(key)) {
//             subjectTeacherMap.set(key, []);
//           }
//           subjectTeacherMap.get(key).push({
//             subject: subject.name,
//             class: subject.class,
//           });
//         });
//       });

//       // Combine all data
//       const teachersWithAssignments = teachers.map(teacher => {
//         const teacherId = teacher._id.toString();
//         const teacherAssignments = assignments.find(a => a.teacher.toString() === teacherId);

//         return {
//           ...teacher,
//           assignments: {
//             classTeacher: teacherAssignments?.classTeacherAssignment || null,
//             subjectTeacher: teacherAssignments?.subjectAssignments || [],
//           },
//           currentAssignments: {
//             classTeacher: classTeacherMap.get(teacherId) || null,
//             subjectTeacher: subjectTeacherMap.get(teacherId) || [],
//           },
//         };
//       });

//       res.json({
//         success: true,
//         data: teachersWithAssignments,
//       });
//     } catch (error) {
//       console.error('Error in getTeachers:', error);
//       res.status(500).json({
//         success: false,
//         error: error.message,
//         message: 'Failed to fetch teachers data',
//       });
//     }
//   },

//   updateUserRole: async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const { role, permissions, classId, subjects } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);

//       // If changing to teacher role with class assignments
//       if (role === 'teacher' && (classId || subjects)) {
//         // Call the more specific teacher assignment function
//         req.body.teacherId = userId;
//         req.body.assignmentType = classId ? 'classTeacher' : 'subjectTeacher';
//         req.body.academicYear = getCurrentAcademicYear();
//         return await assignTeacherRole(req, res);
//       }

//       // For other role changes
//       const updatedPermissions = {
//         ...getDefaultPermissions(role),
//         ...permissions,
//       };

//       const user = await User.findByIdAndUpdate(
//         userId,
//         {
//           role,
//           permissions: updatedPermissions,
//           'profile.lastRoleUpdate': new Date(),
//         },
//         { new: true }
//       );

//       if (!user) {
//         return res.status(404).json({ message: 'User not found' });
//       }

//       res.json(user);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

  
//   uploadSyllabus : async (req, res) => {
//     try {
//       const { classId, subjectId, content } = req.body;
//       const schoolId = req.school._id;
//       const uploadedBy = req.user._id;
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);
//       const Syllabus = require('../models/Syllabus')(connection);
  
//       // Validate class
//       const classExists = await Class.findOne({ _id: classId, school: schoolId });
//       if (!classExists) {
//         if (req.files?.length > 0) {
//           // req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//           req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
//         }
//         return res.status(404).json({ message: 'Class not found' });
//       }
  
//       // Validate subject
//       const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId });
//       if (!subject) {
//         if (req.files?.length > 0) {
//           // req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//           req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
//         }
//         return res.status(404).json({ message: 'Subject not found in the specified class' });
//       }
  
//       // Check uploaded files
//       if (!req.files || req.files.length === 0) {
//         console.log('No files uploaded');
//       } else {
//         console.log('Files uploaded:', req.files);
//       }
  
//       const documents = req.files?.map(file => {
//         // if (!file.public_id) {
//         //   throw new Error('Missing public_id for document');
//         // }

//         const publicId = file.filename.replace(/^syllabuses\//, '');
//         return {
//           title: file.originalname,
//           url: file.path,
//           // public_id: file.public_id,
//           public_id: publicId,
//           uploadedBy,
//         };
//       }) || [];
  
//       let syllabus = await Syllabus.findOne({ subject: subjectId });
//       if (!syllabus) {
//         syllabus = new Syllabus({
//           school: schoolId,
//           subject: subjectId,
//           class: classId,
//           content,
//           documents,
//         });
//       } else {
//         syllabus.content = content;
//         if (documents.length > 0) {
//           syllabus.documents = [...syllabus.documents, ...documents];
//         }
//       }
  
//       await syllabus.save();
//       subject.syllabus = syllabus._id;
//       await subject.save();
  
//       res.status(201).json(syllabus);
//     } catch (error) {
//       console.error('Error in uploadSyllabus:', error);
//       if (req.files?.length > 0) {
//         // req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//         req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
//       }
//       res.status(500).json({ error: error.message });
//     }
//   },

//   createClass: async (req, res) => {
//     try {
//       const {
//         name,
//         division,
//         capacity,
//         // subjects,
//         rteSeats,
//         academicYear,
//         schedule,
//       } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
//       const User = require('../models/User')(connection);

//       // Check if a class with same name and division already exists for this school and academic year
//       const existingClass = await Class.findOne({
//         school: schoolId,
//         name: name,
//         division: division,
//         academicYear: academicYear,
//       });

//       if (existingClass) {
//         return res.status(400).json({
//           error: `Class ${name} division ${division} already exists for academic year ${academicYear}`,
//         });
//       }

//       // Check if a teacher is already assigned as class teacher for this class
//       const existingTeacherAssignment = await TeacherAssignment.findOne({
//         school: schoolId,
//         class: null, // Will be updated after class creation
//         assignmentType: 'classTeacher',
//         academicYear: academicYear,
//       });

//       const newClass = new Class({
//         school: schoolId,
//         name,
//         division,
//         capacity,
//         classTeacher: existingTeacherAssignment ? existingTeacherAssignment.teacher : null,
//         // subjects,
//         rteSeats,
//         academicYear,
//         schedule,
//       });

//       await newClass.save();

//       // If there's a pending class teacher assignment, update it with the new class ID
//       if (existingTeacherAssignment) {
//         await TeacherAssignment.findByIdAndUpdate(
//           existingTeacherAssignment._id,
//           { class: newClass._id }
//         );

//         // Update teacher's permissions to include the new class
//         await User.findByIdAndUpdate(
//           existingTeacherAssignment.teacher,
//           {
//             $push: { 'permissions.canTakeAttendance': newClass._id },
//           }
//         );
//       }

//       // Populate the class teacher details before sending response
//       const populatedClass = await Class.findById(newClass._id)
//         .populate('classTeacher', 'name email profile', User);
//       // .populate('subjects');

//       res.status(201).json(populatedClass);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getClasses: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       const classes = await Class.find({ school: schoolId })
//         .populate('classTeacher', 'name email profile', User)
//         .populate('subjects', 'name')
//         .sort({ name: 1, division: 1 });

//       res.json(classes);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Subject Management ============
//   createSubject: async (req, res) => {
//     try {
//       const { classId, name } = req.body;
//       const schoolId = req.school._id; // School ID extracted from authenticated user
//       const adminId = req.user._id;
//       const connection = req.connection;
//       const Class = require('../models/Class')(connection);
//       const Subject = require('../models/Subject')(connection);

//       // Validate if class exists and was created by this admin
//       const classExists = await Class.findOne({
//         _id: classId,
//         school: schoolId,
//       });

//       if (!classExists) {
//         return res.status(400).json({
//           message: 'Invalid class selected. Please select a class you have created.',
//         });
//       }

//       // Create subject with default values
//       const subject = new Subject({
//         school: schoolId,
//         class: classId,
//         name: name || 'Untitled Subject', // Use provided name or default
//         teachers: [], // No teachers initially
//         createdBy: adminId, // Track which admin created the subject
//       });

//       await subject.save();

//       // Add subject to class
//       await Class.findByIdAndUpdate(classId, {
//         $push: { subjects: subject._id }, // Push ObjectId instead of object
//       });

//       res.status(201).json({
//         message: 'Subject created successfully',
//         subject: subject,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getAllSubjects: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Subject = require('../models/Subject')(connection);
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);
//       const Syllabus = require('../models/Syllabus')(connection);

//       const subjects = await Subject.find({ school: schoolId })
//         .populate('class', 'name division', Class)
//         .populate('teachers.teacher', 'name email', User)
//         .populate('syllabus', '', Syllabus)
//         .sort({ 'class.name': 1, name: 1 });

//       res.json(subjects);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getSyllabus: async (req, res) => {
//     try {
//       const { subjectId } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Syllabus = require('../models/Syllabus')(connection);
//       const Subject = require('../models/Subject')(connection);
//       const Class = require('../models/Class')(connection);

//       const syllabus = await Syllabus.findOne({
//         subject: subjectId,
//         school: schoolId,
//       })
//         .populate('subject', 'name', Subject)
//         .populate('class', 'name division', Class);

//       if (!syllabus) {
//         return res.status(404).json({ message: 'Syllabus not found' });
//       }

//       if (syllabus.documents?.length > 0) {
//         syllabus.documents = syllabus.documents.map(doc => {
//           try {
//             if (!doc.public_id) {
//               throw new Error(`Missing public_id for document: ${doc.title}`);
//             }

//             // Extract file extension
//             const fileExtension = doc.title.split('.').pop().toLowerCase();

//             // Set proper content type
//             const contentType = {
//               'pdf': 'application/pdf',
//               'doc': 'application/msword',
//               'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//               'jpg': 'image/jpeg',
//               'jpeg': 'image/jpeg',
//             }[fileExtension] || 'application/octet-stream';

//             // Generate signed URL
//             const downloadUrl = cloudinary.url(doc.public_id, {
//               resource_type: 'raw',
//               format: fileExtension,
//               secure: true,
//               sign_url: true,
//               type: 'upload',
//               attachment: true,
//               flags: 'attachment',
//               timestamp: Math.round(new Date().getTime() / 1000),
//             });

//             console.log(`Generated download URL for ${doc.title}: ${downloadUrl}`);

//             return {
//               ...doc.toObject(),
//               downloadUrl,
//               contentType,
//             };
//           } catch (error) {
//             console.error(`Error generating URL for ${doc.title}:`, error);
//             return {
//               ...doc.toObject(),
//               downloadUrl: null,
//               contentType: 'application/octet-stream',
//             };
//           }
//         });
//       }

//       res.json(syllabus);
//     } catch (error) {
//       console.error('Error in getSyllabus:', error);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   assignTeacherRole: async (req, res) => {
//     try {
//       const { teacherId, classTeacherOf, subjectAssignments, academicYear } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       const TeacherAssignment = require('../models/TeacherAssignment')(connection);
//       const Class = require('../models/Class')(connection);

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         // Get the teacher to update
//         const teacher = await User.findById(teacherId);
//         if (!teacher || teacher.role !== 'teacher') {
//           return res.status(404).json({ message: 'Teacher not found' });
//         }

//         // Create or update teacher assignment
//         let assignment = await TeacherAssignment.findOne({
//           teacher: teacherId,
//           academicYear,
//         });

//         const assignmentType = classTeacherOf ? 'classTeacher' : 'subjectTeacher';

//         if (!assignment) {
//           assignment = new TeacherAssignment({
//             school: schoolId,
//             teacher: teacherId,
//             class: assignmentType === 'classTeacher' ? classTeacherOf : null,
//             subjects: subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId })),
//             assignmentType,
//             academicYear,
//           });
//         } else {
//           assignment.class = assignmentType === 'classTeacher' ? classTeacherOf : null;
//           assignment.subjects = subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId }));
//           assignment.assignmentType = assignmentType;
//         }

//         await assignment.save({ session });

//         // Update teacher permissions
//         let permissionUpdate = {
//           ...teacher.permissions,
//         };

//         // Handle class teacher attendance permissions
//         if (assignmentType === 'classTeacher') {
//           // Add the new class to attendance permissions if not already there
//           if (!permissionUpdate.canTakeAttendance.includes(classTeacherOf)) {
//             permissionUpdate.canTakeAttendance.push(classTeacherOf);
//           }

//           // Update class document to set this teacher as class teacher
//           await Class.findByIdAndUpdate(
//             classTeacherOf,
//             { classTeacher: teacherId },
//             { session }
//           );
//         }

//         // Update subject marks entry permissions
//         const markEntryPermissions = subjectAssignments.map(s => ({
//           class: s.classId,
//           subject: s.subjectId,
//         }));

//         // Merge with existing permissions to avoid duplicates
//         permissionUpdate.canEnterMarks = [
//           ...new Map([
//             ...permissionUpdate.canEnterMarks,
//             ...markEntryPermissions,
//           ].map(item => [
//             `${item.class.toString()}-${item.subject.toString()}`,
//             item,
//           ])).values(),
//         ];

//         await User.findByIdAndUpdate(
//           teacherId,
//           { $set: { permissions: permissionUpdate } },
//           { session }
//         );

//         await session.commitTransaction();
//         res.json({
//           assignment,
//           permissions: permissionUpdate,
//           message: 'Teacher role and permissions updated successfully',
//         });
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

//   // ============ Timetable Management ============
//   generateTimetable: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const { schedule, type, constraints } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Timetable = require('../models/Timetable')(connection);

//       // Validate teacher availability
//       const teacherConflicts = await checkTeacherConflicts(schedule);
//       if (teacherConflicts.length > 0) {
//         return res.status(400).json({
//           error: 'Teacher scheduling conflicts detected',
//           conflicts: teacherConflicts,
//         });
//       }

//       // Generate optimized timetable
//       const optimizedSchedule = optimizeSchedule(schedule, constraints);

//       const timetable = new Timetable({
//         school: schoolId, // Added schoolId
//         class: classId,
//         type, // 'regular', 'exam', 'substitute'
//         schedule: optimizedSchedule,
//       });

//       await timetable.save();

//       // Notify affected teachers (implement notifyTeachersAboutTimetable if needed)
//       // await notifyTeachersAboutTimetable(timetable);

//       res.status(201).json(timetable);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Attendance Management ============
//   getAttendanceReport: async (req, res) => {
//     try {
//       const schoolId = req.school._id; // Updated from req.params
//       const { startDate, endDate, type, classId, reportType } = req.query;
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const query = {
//         school: schoolId,
//         date: {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate),
//         },
//       };

//       if (type) query.type = type;
//       if (classId) query.class = classId;

//       const attendanceData = await Attendance.find(query)
//         .populate('user', 'name', User)
//         .populate('class', 'name division', Class)
//         .lean();

//       // Generate comprehensive report
//       const report = {
//         summary: calculateAttendanceStatistics(attendanceData, reportType),
//         details: generateDetailedAttendanceReport(attendanceData, reportType),
//         charts: generateAttendanceCharts(attendanceData),
//       };

//       res.json(report);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Exam Management ============
//   createExam: async (req, res) => {
//     try {
//       const {
//         name,
//         classId,
//         subject,
//         date,
//         duration,
//         totalMarks,
//         availableRooms,
//       } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);

//       // Get total students in the class
//       const classDetails = await Class.findById(classId).populate('students', '', User);
//       const totalStudents = classDetails.students.length;

//       // Generate seating arrangement
//       const seatingArrangement = generateSeatingArrangement(
//         classDetails.students,
//         availableRooms,
//         totalStudents
//       );

//       const exam = new Exam({
//         school: schoolId,
//         name,
//         class: classId,
//         subject,
//         date,
//         duration,
//         totalMarks,
//         seatingArrangement,
//       });

//       await exam.save();

//       // Notify teachers and create exam schedule (implement if needed)
//       // await createExamSchedule(exam);
//       // await notifyExamCreation(exam);

//       res.status(201).json(exam);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   reviewClassResults: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const schoolId = req.school._id; // Added schoolId filter
//       const connection = req.connection;
//       const ClassResult = require('../models/ClassResult')(connection);
//       const Class = require('../models/Class')(connection);
//       const User = require('../models/User')(connection);
//       const SubjectMarks = require('../models/SubjectMarks')(connection);

//       const classResults = await ClassResult.find({
//         exam: examId,
//         school: schoolId, // Added schoolId filter
//         status: 'submitted',
//       })
//         .populate('class', '', Class)
//         .populate('classTeacher', '', User)
//         .populate({
//           path: 'subjectMarks',
//           model: SubjectMarks,
//           populate: [
//             { path: 'subject', model: Subject },
//             { path: 'teacher', model: User },
//             { path: 'students.student', model: User },
//           ],
//         });

//       res.json(classResults);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Result Management ============
//   publishResults: async (req, res) => {
//     try {
//       const { examId } = req.params;
//       const adminId = req.user._id;
//       const schoolId = req.school._id; // Added schoolId filter
//       const connection = req.connection;
//       const ClassResult = require('../models/ClassResult')(connection);
//       const Result = require('../models/Result')(connection);
//       const SubjectMarks = require('../models/SubjectMarks')(connection);

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         const classResults = await ClassResult.find({
//           exam: examId,
//           school: schoolId, // Added schoolId filter
//           status: 'submitted',
//         }).populate('subjectMarks', '', SubjectMarks);

//         // Generate report cards for each student
//         for (const classResult of classResults) {
//           const reportCards = await generateStudentReportCards(classResult);

//           // Save report cards
//           await Result.insertMany(reportCards, { session });

//           // Update class result status
//           classResult.status = 'published';
//           classResult.publishedAt = new Date();
//           classResult.publishedBy = adminId;
//           await classResult.save({ session });
//         }

//         await session.commitTransaction();
//         res.json({ message: 'Results published successfully' });
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

//   createAnnouncement: async (req, res) => {
//     try {
//       const {
//         title,
//         content,
//         targetGroups,
//         priority,
//         validFrom,
//         validUntil,
//       } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);

//       // Process uploaded files
//       let attachments = [];
//       if (req.files && req.files.length > 0) {
//         attachments = req.files.map(file => ({
//           fileName: file.originalname,
//           fileUrl: file.path, // Cloudinary URL
//           fileType: file.mimetype,
//           fileSize: file.size,
//           publicId: file.filename, // Store public ID for future management
//         }));
//       }

//       const announcement = new Announcement({
//         school: schoolId,
//         title,
//         content,
//         targetGroups: JSON.parse(targetGroups), // Parse JSON if sent as string
//         priority,
//         validFrom,
//         validUntil,
//         attachments,
//         createdBy: req.user._id,
//       });

//       await announcement.save();

//       // You can implement notification logic here or comment it out
//       // await notifyAnnouncementTargets(announcement);

//       res.status(201).json(announcement);
//     } catch (error) {
//       // Handle file upload errors specifically
//       if (error instanceof multer.MulterError) {
//         return res.status(400).json({ error: `File upload error: ${error.message}` });
//       }
//       res.status(500).json({ error: error.message });
//     }
//   },

//   updateAnnouncement: async (req, res) => {
//     try {
//       const { id } = req.params;
//       const {
//         title,
//         content,
//         targetGroups,
//         priority,
//         validFrom,
//         validUntil,
//         removeAttachments, // Array of attachment IDs to remove
//       } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);

//       const announcement = await Announcement.findById(id);

//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }

//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== schoolId.toString()) {
//         return res.status(403).json({ error: 'Not authorized to update this announcement' });
//       }

//       // Process new uploaded files
//       let newAttachments = [];
//       if (req.files && req.files.length > 0) {
//         newAttachments = req.files.map(file => ({
//           fileName: file.originalname,
//           fileUrl: file.path,
//           fileType: file.mimetype,
//           fileSize: file.size,
//           publicId: file.filename,
//         }));
//       }

//       // Handle attachment removal if specified
//       let currentAttachments = announcement.attachments;
//       if (removeAttachments && removeAttachments.length > 0) {
//         const attachmentsToRemove = JSON.parse(removeAttachments);

//         // Get public IDs of files to delete from Cloudinary
//         const attachmentsToDelete = announcement.attachments
//           .filter(attach => attachmentsToRemove.includes(attach._id.toString()))
//           .map(attach => attach.publicId);

//         // Delete from Cloudinary if there are files to remove
//         if (attachmentsToDelete.length > 0) {
//           for (const publicId of attachmentsToDelete) {
//             await cloudinary.uploader.destroy(publicId);
//           }
//         }

//         // Filter out removed attachments
//         currentAttachments = announcement.attachments.filter(
//           attach => !attachmentsToRemove.includes(attach._id.toString())
//         );
//       }

//       // Update announcement with new values
//       announcement.title = title;
//       announcement.content = content;
//       announcement.targetGroups = JSON.parse(targetGroups);
//       announcement.priority = priority;
//       announcement.validFrom = validFrom;
//       announcement.validUntil = validUntil;
//       announcement.attachments = [...currentAttachments, ...newAttachments];

//       await announcement.save();

//       res.status(200).json(announcement);
//     } catch (error) {
//       if (error instanceof multer.MulterError) {
//         return res.status(400).json({ error: `File upload error: ${error.message}` });
//       }
//       res.status(500).json({ error: error.message });
//     }
//   },

//   deleteAnnouncement: async (req, res) => {
//     try {
//       const { id } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);

//       const announcement = await Announcement.findById(id);

//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }

//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== schoolId.toString()) {
//         return res.status(403).json({ error: 'Not authorized to delete this announcement' });
//       }

//       // Delete files from Cloudinary
//       if (announcement.attachments && announcement.attachments.length > 0) {
//         for (const attachment of announcement.attachments) {
//           if (attachment.publicId) {
//             await cloudinary.uploader.destroy(attachment.publicId);
//           }
//         }
//       }

//       await Announcement.findByIdAndDelete(id);

//       res.status(200).json({ message: 'Announcement deleted successfully' });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all announcements (for admins to view)
//   getAnnouncements: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);
//       const User = require('../models/User')(connection);

//       const announcements = await Announcement.find({ school: schoolId })
//         .sort({ createdAt: -1 }) // Sort by newest first
//         .populate('createdBy', 'name email', User); // Include creator information

//       res.status(200).json(announcements);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get a single announcement by ID
//   getAnnouncementById: async (req, res) => {
//     try {
//       const { id } = req.params;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Announcement = require('../models/Announcement')(connection);
//       const User = require('../models/User')(connection);

//       const announcement = await Announcement.findById(id)
//         .populate('createdBy', 'name email', User);

//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }

//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== schoolId.toString()) {
//         return res.status(403).json({ error: 'Not authorized to view this announcement' });
//       }

//       res.status(200).json(announcement);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Trustee Management ============
//   manageTrustee: async (req, res) => {
//     try {
//       const { trusteeId } = req.params;
//       const { permissions, role } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const User = require('../models/User')(connection);
//       // const TrusteeActivity = require('../models/TrusteeActivity')(connection);

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         // Update trustee permissions
//         const trustee = await User.findByIdAndUpdate(
//           trusteeId,
//           {
//             role: 'trustee',
//             permissions: {
//               ...permissions,
//               canAccessFinancials: role === 'finance_trustee',
//               canAccessHrDocs: role === 'hr_trustee',
//             },
//           },
//           { new: true, session }
//         );

//         if (!trustee) {
//           throw new Error('Trustee not found');
//         }

//         // Log trustee activity (uncomment and implement TrusteeActivity model if needed)
//         /*
//         const activity = new TrusteeActivity({
//           trustee: trusteeId,
//           activity: 'role_update',
//           details: `Role updated to ${role}`,
//           timestamp: new Date(),
//         });
//         await activity.save({ session });
//         */

//         await session.commitTransaction();
//         res.json(trustee);
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

//   // ============ Meeting Management ============
//   scheduleMeeting: async (req, res) => {
//     try {
//       const { title, date, type, agenda, attendees } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Meeting = require('../models/Meeting')(connection);

//       const meeting = new Meeting({
//         school: schoolId,
//         title,
//         date,
//         type,
//         agenda: agenda.map(item => ({
//           ...item,
//           duration: item.duration || 30,
//         })),
//         attendees: attendees.map(attendee => ({
//           user: attendee,
//           status: 'invited',
//         })),
//       });

//       await meeting.save();

//       // Send meeting invitations (implement notifyMeetingAttendees if needed)
//       // await notifyMeetingAttendees(meeting);

//       res.status(201).json(meeting);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Add to adminController
//   recordMeetingMinutes: async (req, res) => {
//     try {
//       const { meetingId } = req.params;
//       const { minutes, decisions, actionItems } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Meeting = require('../models/Meeting')(connection);

//       const meeting = await Meeting.findOne({ _id: meetingId, school: schoolId });
//       if (!meeting) {
//         return res.status(404).json({ message: 'Meeting not found' });
//       }

//       meeting.minutes = minutes;
//       meeting.decisions = decisions;
//       meeting.actionItems = actionItems;
//       meeting.status = 'completed';

//       await meeting.save();

//       // Notify attendees about meeting minutes (implement if needed)
//       // await notifyMeetingAttendees(meeting, 'minutes_updated');

//       res.status(200).json(meeting);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   //============ seating Arrangement===========
//   generateSeatingArrangement: (totalStudents, availableRooms) => {
//     const seatingArrangement = [];
//     const studentsPerRoom = Math.ceil(totalStudents / availableRooms.length);

//     availableRooms.forEach((room, index) => {
//       const roomArrangement = {
//         room: room.name,
//         capacity: room.capacity,
//         rows: [],
//       };

//       const studentsInThisRoom = index === availableRooms.length - 1
//         ? totalStudents - (studentsPerRoom * index)
//         : studentsPerRoom;

//       // Create row-wise seating with gaps
//       const seatsPerRow = room.seatsPerRow || 5;
//       const totalRows = Math.ceil(studentsInThisRoom / seatsPerRow);

//       for (let row = 0; row < totalRows; row++) {
//         const rowSeats = [];
//         for (let seat = 0; seat < seatsPerRow; seat++) {
//           const studentNumber = row * seatsPerRow + seat;
//           if (studentNumber < studentsInThisRoom) {
//             // Alternate seats to maintain gap
//             rowSeats.push({
//               position: seat * 2, // Double the gap between seats
//               occupied: true,
//             });
//           }
//         }
//         roomArrangement.rows.push(rowSeats);
//       }

//       seatingArrangement.push(roomArrangement);
//     });

//     return seatingArrangement;
//   },

//   //===== generate Attendance Report
//   generateAttendanceReport: async (req, res) => {
//     try {
//       const schoolId = req.school._id;
//       const { startDate, endDate, type, classId, reportType } = req.query;
//       const connection = req.connection;
//       const Attendance = require('../models/Attendance')(connection);
//       const User = require('../models/User')(connection);
//       const Class = require('../models/Class')(connection);

//       const query = {
//         school: schoolId,
//         date: {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate),
//         },
//       };

//       if (type) query.type = type;
//       if (classId) query.class = classId;

//       const attendanceData = await Attendance.find(query)
//         .populate('user', 'name', User)
//         .populate('class', 'name division', Class)
//         .lean();

//       const report = {
//         summary: calculateAttendanceStatistics(attendanceData, reportType),
//         details: generateDetailedAttendanceReport(attendanceData, reportType),
//         charts: generateAttendanceCharts(attendanceData),
//       };

//       res.json(report);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // createExamSchedule: async (req, res) => {
//   //   try {
//   //     const {
//   //       name,
//   //       examType,
//   //       startDate,
//   //       endDate,
//   //       classes,
//   //       subjects,
//   //       availableRooms,
//   //       totalStudents,
//   //     } = req.body;
//   //     const schoolId = req.school._id;
//   //     const connection = req.connection;
//   //     const Exam = require('../models/Exam')(connection);
//   //     const SubjectMarks = require('../models/SubjectMarks')(connection);
//   //     const User = require('../models/User')(connection);

//   //     const session = await mongoose.startSession();
//   //     session.startTransaction();

//   //     try {
//   //       // Create master exam schedule
//   //       const examSchedule = new Exam({
//   //         school: schoolId,
//   //         name,
//   //         examType,
//   //         startDate,
//   //         endDate,
//   //         classes: classes.map(classId => ({
//   //           class: classId,
//   //           subjects: subjects.map(subject => ({
//   //             subject: subject.id,
//   //             date: subject.date,
//   //             startTime: subject.startTime,
//   //             endTime: subject.endTime,
//   //             totalMarks: subject.totalMarks,
//   //           })),
//   //         })),
//   //       });

//   //       await examSchedule.save({ session });

//   //       // Generate seating arrangements for each exam date
//   //       const seatingArrangements = {};
//   //       const uniqueDates = [...new Set(subjects.map(s => s.date))];

//   //       for (const date of uniqueDates) {
//   //         // Get total students appearing on this date
//   //         const classesOnThisDate = classes.filter(c =>
//   //           subjects.some(s => s.date === date && s.classes.includes(c))
//   //         );

//   //         const totalStudentsOnDate = await User.countDocuments({
//   //           role: 'student',
//   //           class: { $in: classesOnThisDate },
//   //         });

//   //         // Generate seating arrangement for this date
//   //         seatingArrangements[date] = generateSeatingArrangement(
//   //           totalStudentsOnDate,
//   //           availableRooms
//   //         );
//   //       }

//   //       // Update exam schedule with seating arrangements
//   //       examSchedule.seatingArrangement = seatingArrangements; // Changed from seatingArrangements to match schema
//   //       await examSchedule.save({ session });

//   //       // Create subject-wise exam entries for mark entry
//   //       for (const classObj of classes) {
//   //         for (const subject of subjects) {
//   //           if (subject.classes.includes(classObj)) {
//   //             const subjectExam = new SubjectMarks({
//   //               exam: examSchedule._id,
//   //               class: classObj,
//   //               subject: subject.id,
//   //               totalMarks: subject.totalMarks,
//   //               status: 'pending',
//   //             });
//   //             await subjectExam.save({ session });
//   //           }
//   //         }
//   //       }

//   //       await session.commitTransaction();

//   //       res.status(201).json({
//   //         examSchedule,
//   //         seatingArrangements,
//   //       });
//   //     } catch (error) {
//   //       await session.abortTransaction();
//   //       throw error;
//   //     } finally {
//   //       session.endSession();
//   //     }
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },


//   createExamSchedule: async (req, res) => {
//     try {
//       const {
//         name,
//         examType,
//         startDate,
//         endDate,
//         classes,
//         subjects,
//         availableRooms,
//       } = req.body;
//       const schoolId = req.school._id;
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection);
//       const SubjectMarks = require('../models/SubjectMarks')(connection);
//       const User = require('../models/User')(connection);
  
//       console.log(`Starting exam schedule creation for school: ${schoolId}`);
  
//       // Single query for total students across all classes
//       const totalStudents = await User.countDocuments({
//         role: 'student',
//         class: { $in: classes },
//         school: schoolId,
//       }, { timeout: 30000 }); // Explicit timeout
//       console.log(`Total students: ${totalStudents}`);
  
//       if (totalStudents === 0) {
//         return res.status(400).json({ error: 'No students found for the specified classes' });
//       }
  
//       console.log('Starting session');
//       const session = await connection.startSession({
//         defaultTransactionOptions: {
//           readPreference: 'primary',
//           readConcern: { level: 'local' },
//           writeConcern: { w: 'majority', wtimeout: 30000 },
//         },
//       });
  
//       session.startTransaction();
  
//       try {
//         const examSchedule = new Exam({
//           school: schoolId,
//           name,
//           examType,
//           startDate,
//           endDate,
//           classes: classes.map(classId => ({
//             class: classId,
//             subjects: subjects
//               .filter(subject => subject.classes.includes(classId))
//               .map(subject => ({
//                 subject: subject.id,
//                 date: subject.date,
//                 startTime: subject.startTime,
//                 endTime: subject.endTime,
//                 totalMarks: subject.totalMarks,
//               })),
//           })),
//         });
  
//         await examSchedule.save({ session });
//         console.log('Exam schedule saved:', examSchedule._id);
  
//         const seatingArrangements = {};
//         const uniqueDates = [...new Set(subjects.map(s => s.date))];
//         console.log('Unique exam dates:', uniqueDates);
  
//         for (const date of uniqueDates) {
//           const classesOnThisDate = classes.filter(c =>
//             subjects.some(s => s.date === date && s.classes.includes(c))
//           );
//           console.log(`Classes on ${date}:`, classesOnThisDate);
  
//           const totalStudentsOnDate = await User.countDocuments({
//             role: 'student',
//             class: { $in: classesOnThisDate },
//             school: schoolId,
//           }, { timeout: 30000 });
//           console.log(`Students on ${date}: ${totalStudentsOnDate}`);
  
//           seatingArrangements[date] = adminController.generateSeatingArrangement(
//             totalStudentsOnDate,
//             availableRooms
//           );
//         }
  
//         examSchedule.seatingArrangement = seatingArrangements;
//         await examSchedule.save({ session });
//         console.log('Seating arrangements saved');
  
//         for (const classObj of classes) {
//           for (const subject of subjects) {
//             if (subject.classes.includes(classObj)) {
//               const subjectExam = new SubjectMarks({
//                 exam: examSchedule._id,
//                 class: classObj,
//                 subject: subject.id,
//                 totalMarks: subject.totalMarks,
//                 status: 'pending',
//               });
//               await subjectExam.save({ session });
//               console.log(`SubjectMarks saved for class ${classObj}, subject ${subject.id}`);
//             }
//           }
//         }
  
//         await session.commitTransaction();
//         console.log('Transaction committed');
  
//         res.status(201).json({
//           examSchedule,
//           seatingArrangements,
//         });
//       } catch (error) {
//         console.error('Transaction error:', error.message);
//         await session.abortTransaction();
//         throw error;
//       } finally {
//         session.endSession();
//         console.log('Session ended');
//       }
//     } catch (error) {
//       console.error('Error in createExamSchedule:', error.message);
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Enter exam results
//   enterResults: async (req, res) => {
//     try {
//       const { examId, classId } = req.params;
//       const { results } = req.body;
//       const schoolId = req.school._id; // Added schoolId context
//       const connection = req.connection;
//       const Exam = require('../models/Exam')(connection); // Changed from ExamSchedule to Exam
//       const Result = require('../models/Result')(connection);

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         // Get exam schedule
//         const examSchedule = await Exam.findById(examId);
//         if (!examSchedule) {
//           throw new Error('Exam schedule not found');
//         }

//         // Process results for each student
//         const resultPromises = results.map(async (studentResult) => {
//           const result = new Result({
//             school: schoolId, // Added schoolId
//             student: studentResult.studentId,
//             exam: examId, // Changed from examSchedule to exam
//             class: classId,
//             subjects: studentResult.subjects,
//             totalMarks: calculateTotalMarks(studentResult.subjects),
//             percentage: calculatePercentage(studentResult.subjects),
//             grade: calculateGrade(studentResult.subjects),
//             status: determineStatus(studentResult.subjects),
//             publishedBy: req.user._id,
//           });

//           return result.save({ session });
//         });

//         await Promise.all(resultPromises);
//         await session.commitTransaction();

//         res.json({ message: 'Results entered successfully' });
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

//   // Generate report cards
//   generateReportCards: async (req, res) => {
//     try {
//       const { examId, classId } = req.params;
//       const schoolId = req.school._id; // Added schoolId context
//       const connection = req.connection;
//       const Result = require('../models/Result')(connection);
//       const Exam = require('../models/Exam')(connection); // Changed from ExamSchedule to Exam
//       const User = require('../models/User')(connection);

//       // Get all results for the exam and class
//       const results = await Result.find({
//         exam: examId, // Changed from examSchedule to exam
//         class: classId,
//         school: schoolId, // Added schoolId filter
//       })
//         .populate('student', 'name profile', User)
//         .populate('exam', 'examType academicYear', Exam) // Changed from examSchedule to exam
//         .lean();

//       // Calculate class statistics
//       const classStats = calculateClassStatistics(results);

//       // Generate report cards
//       const reportCards = results.map(result =>
//         generateReportCard(result, classStats)
//       );

//       res.json(reportCards);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

// // Helper Functions
// const getDefaultPermissions = (role) => {
//   const permissions = {
//     canTakeAttendance: [],
//     canEnterMarks: [],
//     canPublishAnnouncements: false,
//     canManageInventory: false,
//     canManageFees: false,
//     canManageLibrary: false,
//   };

//   switch (role) {
//     case 'teacher':
//       permissions.canEnterMarks = [];
//       break;
//     case 'librarian':
//       permissions.canManageLibrary = true;
//       break;
//     case 'inventory_manager':
//       permissions.canManageInventory = true;
//       break;
//     case 'fee_manager':
//       permissions.canManageFees = true;
//       break;
//     // Add more role-based permissions
//   }

//   return permissions;
// };

// const checkTeacherConflicts = async (schedule) => {
//   const conflicts = [];
//   const teacherSchedule = {};

//   schedule.forEach(slot => {
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

// const optimizeSchedule = (schedule, constraints) => {
//   const optimizedSchedule = [...schedule];

//   // Sort subjects by priority/weight
//   optimizedSchedule.sort((a, b) => {
//     const weightA = constraints.subjectWeights[a.subject] || 1;
//     const weightB = constraints.subjectWeights[b.subject] || 1;
//     return weightB - weightA;
//   });

//   // Distribute heavy subjects across the week
//   const daysPerWeek = 5;
//   const periodsPerDay = 8;
//   const distribution = Array(daysPerWeek).fill().map(() => Array(periodsPerDay).fill(null));

//   optimizedSchedule.forEach(slot => {
//     let placed = false;
//     // Try to place subject in optimal time slot
//     for (let day = 0; day < daysPerWeek && !placed; day++) {
//       for (let period = 0; period < periodsPerDay && !placed; period++) {
//         if (!distribution[day][period] && isValidPlacement(slot, day, period, constraints)) {
//           distribution[day][period] = slot;
//           placed = true;
//         }
//       }
//     }
//   });

//   return distribution.flat().filter(Boolean);
// };

// const isValidPlacement = (slot, day, period, constraints) => {
//   // Check if placement violates any constraints
//   const { subjectWeights, consecutiveHeavySubjects, labRequirements } = constraints;

//   // Don't place heavy subjects in last periods
//   if (subjectWeights[slot.subject] > 2 && period > 5) {
//     return false;
//   }

//   // Check lab requirements (implement isLabAvailable if needed)
//   if (labRequirements.includes(slot.subject) /* && !isLabAvailable(day, period) */) {
//     return false;
//   }

//   // Avoid consecutive heavy subjects
//   if (period > 0 && isHeavySubject(slot.subject, subjectWeights)) {
//     const previousSlot = distribution[day][period - 1];
//     if (previousSlot && isHeavySubject(previousSlot.subject, subjectWeights)) {
//       return false;
//     }
//   }

//   return true;
// };

// const isHeavySubject = (subject, subjectWeights) => {
//   return (subjectWeights[subject] || 1) > 2;
// };

// const generateSeatingArrangement = (students, availableRooms, totalStudents) => {
//   const seatingArrangement = [];
//   const studentsPerRoom = Math.ceil(totalStudents / availableRooms.length);

//   // Shuffle students for random seating
//   const shuffledStudents = shuffleArray([...students]);

//   availableRooms.forEach((room, roomIndex) => {
//     const startIndex = roomIndex * studentsPerRoom;
//     const endIndex = Math.min(startIndex + studentsPerRoom, totalStudents);
//     const roomStudents = shuffledStudents.slice(startIndex, endIndex);

//     // Create alternating seating pattern
//     const arrangement = [];
//     const rows = Math.ceil(roomStudents.length / 5); // 5 students per row
//     for (let i = 0; i < rows; i++) {
//       const rowStudents = roomStudents.slice(i * 5, (i + 1) * 5);
//       arrangement.push({
//         row: i + 1,
//         students: rowStudents.map((student, pos) => ({
//           student: student._id,
//           position: pos + 1,
//         })),
//       });
//     }

//     seatingArrangement.push({
//       classroom: room,
//       capacity: studentsPerRoom,
//       arrangement,
//     });
//   });

//   return seatingArrangement;
// };

// const calculateAttendanceStatistics = (attendanceData, reportType) => {
//   const statistics = {
//     totalPresent: 0,
//     totalAbsent: 0,
//     totalLate: 0,
//     percentagePresent: 0,
//     trendByPeriod: [],
//     studentWiseAnalysis: new Map(),
//   };

//   // Group data by period (day/week/month)
//   const groupedData = groupAttendanceByPeriod(attendanceData, reportType);

//   groupedData.forEach(period => {
//     const periodStats = {
//       present: period.filter(a => a.status === 'present').length,
//       absent: period.filter(a => a.status === 'absent').length,
//       late: period.filter(a => a.status === 'late').length,
//     };

//     statistics.totalPresent += periodStats.present;
//     statistics.totalAbsent += periodStats.absent;
//     statistics.totalLate += periodStats.late;

//     // Calculate percentage for the period
//     const total = periodStats.present + periodStats.absent + periodStats.late;
//     const percentage = total ? (periodStats.present / total) * 100 : 0;

//     statistics.trendByPeriod.push({
//       period: period[0].date,
//       percentage,
//     });
//   });

//   // Calculate overall percentage
//   const total = statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
//   statistics.percentagePresent = total ? (statistics.totalPresent / total) * 100 : 0;

//   return statistics;
// };

// const generateDetailedAttendanceReport = (attendanceData, reportType) => {
//   const report = {
//     byClass: new Map(),
//     byTeacher: new Map(),
//     byDate: new Map(),
//   };

//   attendanceData.forEach(record => {
//     // Class-wise analysis
//     if (!report.byClass.has(record.class._id)) {
//       report.byClass.set(record.class._id, {
//         className: `${record.class.name}-${record.class.division}`,
//         present: 0,
//         absent: 0,
//         late: 0,
//       });
//     }
//     const classStats = report.byClass.get(record.class._id);
//     classStats[record.status]++;

//     // Teacher-wise analysis
//     if (record.markedBy) {
//       if (!report.byTeacher.has(record.markedBy)) {
//         report.byTeacher.set(record.markedBy, {
//           recordsMarked: 0,
//           classes: new Set(),
//         });
//       }
//       const teacherStats = report.byTeacher.get(record.markedBy);
//       teacherStats.recordsMarked++;
//       teacherStats.classes.add(record.class._id);
//     }

//     // Date-wise analysis
//     const dateKey = record.date.toISOString().split('T')[0];
//     if (!report.byDate.has(dateKey)) {
//       report.byDate.set(dateKey, {
//         present: 0,
//         absent: 0,
//         late: 0,
//       });
//     }
//     const dateStats = report.byDate.get(dateKey);
//     dateStats[record.status]++;
//   });

//   return {
//     classWise: Array.from(report.byClass.entries()),
//     teacherWise: Array.from(report.byTeacher.entries()),
//     dateWise: Array.from(report.byDate.entries()),
//   };
// };

// const generateAttendanceCharts = (attendanceData) => {
//   // Prepare data for various charts
//   const charts = {
//     trendsOverTime: prepareTrendData(attendanceData),
//     classComparison: prepareClassComparisonData(attendanceData),
//     dayWisePatterns: prepareDayWisePatternData(attendanceData),
//   };

//   return charts;
// };

// const calculateGrade = (marks, totalMarks) => {
//   let percentage;
//   if (typeof marks === 'number') {
//     percentage = (marks / totalMarks) * 100; // For single subject
//   } else {
//     percentage = calculatePercentage(marks); // For multiple subjects
//   }

//   if (percentage >= 90) return 'A+';
//   if (percentage >= 80) return 'A';
//   if (percentage >= 70) return 'B+';
//   if (percentage >= 60) return 'B';
//   if (percentage >= 50) return 'C+';
//   if (percentage >= 40) return 'C';
//   return 'F';
// };

// // Utility functions
// const shuffleArray = (array) => {
//   for (let i = array.length - 1; i > 0; i--) {
//     const j = Math.floor(Math.random() * (i + 1));
//     [array[i], array[j]] = [array[j], array[i]];
//   }
//   return array;
// };

// const groupAttendanceByPeriod = (attendanceData, reportType) => {
//   const grouped = new Map();

//   attendanceData.forEach(record => {
//     const periodKey = getPeriodKey(record.date, reportType);
//     if (!grouped.has(periodKey)) {
//       grouped.set(periodKey, []);
//     }
//     grouped.get(periodKey).push(record);
//   });

//   return Array.from(grouped.values());
// };

// const getPeriodKey = (date, reportType) => {
//   const d = new Date(date);
//   switch (reportType) {
//     case 'daily':
//       return d.toISOString().split('T')[0];
//     case 'weekly':
//       const week = getWeekNumber(d);
//       return `${d.getFullYear()}-W${week}`;
//     case 'monthly':
//       return `${d.getFullYear()}-${d.getMonth() + 1}`;
//     case 'yearly':
//       return d.getFullYear().toString();
//     default:
//       return d.toISOString().split('T')[0];
//   }
// };



// const getWeekNumber = (date) => {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   d.setDate(d.getDate() + 4 - (d.getDay() || 7));
//   const yearStart = new Date(d.getFullYear(), 0, 1);
//   return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
// };

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

// module.exports = adminController;








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

      const users = await User.find({ school: schoolId })
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

  uploadSyllabus: async (req, res) => {
    try {
      const { classId, subjectId, content } = req.body;
      const schoolId = req.school._id;
      const uploadedBy = req.user._id;
      const connection = req.connection;
      const Class = getModel('Class', connection);
      const Subject = getModel('Subject', connection);
      const Syllabus = getModel('Syllabus', connection);

      const classExists = await Class.findOne({ _id: classId, school: schoolId }).lean();
      if (!classExists) {
        if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
        return res.status(404).json({ message: 'Class not found' });
      }

      const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId }).lean();
      if (!subject) {
        if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
        return res.status(404).json({ message: 'Subject not found' });
      }

      const documents = req.files?.map(file => ({
        title: file.originalname,
        url: file.path,
        public_id: file.filename.replace(/^syllabuses\//, ''),
        uploadedBy,
      })) || [];

      let syllabus = await Syllabus.findOne({ subject: subjectId });
      if (!syllabus) {
        syllabus = new Syllabus({ school: schoolId, subject: subjectId, class: classId, content, documents });
      } else {
        syllabus.content = content;
        if (documents.length > 0) syllabus.documents = [...syllabus.documents, ...documents];
      }

      await syllabus.save();
      await Subject.findByIdAndUpdate(subjectId, { syllabus: syllabus._id });

      res.status(201).json(syllabus);
    } catch (error) {
      if (req.files?.length > 0) req.files.forEach(file => cloudinary.uploader.destroy(file.filename));
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
            const fileExtension = doc.title.split('.').pop().toLowerCase();
            const contentType = {
              'pdf': 'application/pdf',
              'doc': 'application/msword',
              'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
            }[fileExtension] || 'application/octet-stream';

            const downloadUrl = cloudinary.url(doc.public_id, {
              resource_type: 'raw',
              format: fileExtension,
              secure: true,
              sign_url: true,
              type: 'upload',
              attachment: true,
              flags: 'attachment',
              timestamp: Math.round(new Date().getTime() / 1000),
            });

            return { ...doc, downloadUrl, contentType };
          } catch (error) {
            return { ...doc, downloadUrl: null, contentType: 'application/octet-stream' };
          }
        });
      }

      res.json(syllabus);
    } catch (error) {
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
      const rows = Math.ceil(studentsPerRoom / 5);
      for (let i = 0; i < rows; i++) {
        const rowStudents = roomStudents.slice(i * 5, (i + 1) * 5);
        arrangement.push({
          row: i + 1,
          students: rowStudents.map((student, pos) => ({ student: student._id, position: pos + 1 })),
        });
      }

      seatingArrangement.push({ classroom: room, capacity: studentsPerRoom, arrangement });
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

  createExamSchedule: async (req, res) => {
    try {
      const { name, examType, startDate, endDate, classes, subjects, availableRooms } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = getModel('Exam', connection);
      const SubjectMarks = getModel('SubjectMarks', connection);
      const User = getModel('User', connection);

      const totalStudents = await User.countDocuments({ role: 'student', class: { $in: classes }, school: schoolId });
      if (totalStudents === 0) return res.status(400).json({ error: 'No students found' });

      const session = await connection.startSession();
      session.startTransaction();

      try {
        const examSchedule = new Exam({
          school: schoolId,
          name,
          examType,
          startDate,
          endDate,
          classes: classes.map(classId => ({
            class: classId,
            subjects: subjects.filter(s => s.classes.includes(classId)).map(subject => ({
              subject: subject.id,
              date: subject.date,
              startTime: subject.startTime,
              endTime: subject.endTime,
              totalMarks: subject.totalMarks,
            })),
          })),
        });

        await examSchedule.save({ session });

        const seatingArrangements = {};
        const uniqueDates = [...new Set(subjects.map(s => s.date))];
        for (const date of uniqueDates) {
          const classesOnThisDate = classes.filter(c => subjects.some(s => s.date === date && s.classes.includes(c)));
          const totalStudentsOnDate = await User.countDocuments({ role: 'student', class: { $in: classesOnThisDate }, school: schoolId });
          seatingArrangements[date] = adminController.generateSeatingArrangement(totalStudentsOnDate, availableRooms, totalStudentsOnDate);
        }

        examSchedule.seatingArrangement = seatingArrangements;
        await examSchedule.save({ session });

        for (const classObj of classes) {
          for (const subject of subjects) {
            if (subject.classes.includes(classObj)) {
              const subjectExam = new SubjectMarks({
                exam: examSchedule._id,
                class: classObj,
                subject: subject.id,
                totalMarks: subject.totalMarks,
                status: 'pending',
              });
              await subjectExam.save({ session });
            }
          }
        }

        await session.commitTransaction();
        res.status(201).json({ examSchedule, seatingArrangements });
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