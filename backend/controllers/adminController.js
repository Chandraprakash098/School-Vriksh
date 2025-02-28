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


// const adminController = {
//   // ============ User Management ============
  
//   createUser: async (req, res) => {
//     try {
//       const { name, email, password, role, profile } = req.body;
//       const schoolId = req.school; // Get school ID from logged-in admin

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
//         permissions
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
//       const schoolId = req.school;
//       const users = await User.find({ school: schoolId })
//         .select('-password')
//         .populate('permissions.canTakeAttendance', 'name division')
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division');

//       res.json(users);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get specific user
//   getUser: async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const schoolId = req.school;

//       const user = await User.findOne({ _id: userId, school: schoolId })
//         .select('-password')
//         .populate('permissions.canTakeAttendance', 'name division')
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division');

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
//       const schoolId =  req.school;
      
//       // Fetch classes that don't have a class teacher assigned
//       const availableClasses = await Class.find({
//         school: schoolId,
//         $or: [
//           { classTeacher: null },
//           { classTeacher: { $exists: false } }
//         ]
//       })
//       .select('name division academicYear')
//       .sort({ name: 1, division: 1 });

//       // Also fetch classes that have a class teacher for reference
//       const assignedClasses = await Class.find({
//         school: schoolId,
//         classTeacher: { $exists: true, $ne: null }
//       })
//       .select('name division academicYear classTeacher')
//       .populate('classTeacher', 'name')
//       .sort({ name: 1, division: 1 });

//       res.json({
//         available: availableClasses,
//         assigned: assignedClasses
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   getSubjectsByClass: async (req, res) => {
//     try {
//       const { classId } = req.params;
//       const schoolId =  req.school;
        
//       if (!classId || !schoolId) {
//         return res.status(400).json({ error: "Invalid classId or schoolId" });
//       }

//       const subjects = await Subject.find({
//         school: schoolId,
//         class: classId
//       }).select('name');

//       if (!subjects) {
//         return res.status(404).json({ error: "No subjects found" });
//       }

//       res.json(subjects);
//     } catch (error) {
//       console.error("Error fetching subjects:", error);
//       res.status(500).json({ error: "Internal Server Error" });
//     }
//   },





//   createTeacher: async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();
  
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
//         classTeacherOf
//       } = req.body;
//       const schoolId = req.school;
  
//       // Basic validation
//       if (!teachingClass || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
//         return res.status(400).json({ 
//           success: false,
//           message: 'Please select a class and at least one subject for teaching' 
//         });
//       }
  
//       // Check if email exists
//       const existingUser = await User.findOne({ email });
//       if (existingUser) {
//         return res.status(400).json({ 
//           success: false,
//           message: 'Email already registered' 
//         });
//       }
  
//       // Validate subjects and check availability
//       const subjects = await Subject.find({
//         _id: { $in: selectedSubjects },
//         class: teachingClass,
//         school: schoolId
//       });
  
//       // Check if all selected subjects exist
//       if (subjects.length !== selectedSubjects.length) {
//         return res.status(400).json({ 
//           success: false,
//           message: 'One or more selected subjects are invalid for the chosen class' 
//         });
//       }
  
//       // Check if any selected subjects are already assigned
//       const assignedSubjects = subjects.filter(subject => 
//         subject.teachers && subject.teachers.length > 0
//       );
  
//       if (assignedSubjects.length > 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Cannot assign already assigned subjects: ${assignedSubjects.map(s => s.name).join(', ')}`,
//           assignedSubjects: assignedSubjects.map(s => ({
//             name: s.name,
//             assignedTo: s.teachers[0].teacher
//           }))
//         });
//       }
  
//       // Validate class teacher assignment if provided
//       if (classTeacherOf) {
//         const classTeacherData = await Class.findOne({
//           _id: classTeacherOf,
//           school: schoolId
//         });
  
//         if (!classTeacherData) {
//           return res.status(400).json({ 
//             success: false,
//             message: 'Selected class for class teacher role not found' 
//           });
//         }
  
//         if (classTeacherData.classTeacher) {
//           return res.status(400).json({ 
//             success: false,
//             message: 'Selected class already has a class teacher assigned' 
//           });
//         }
//       }
  
//       // Create user account
//       const salt = await bcrypt.genSalt(10);
//       const hashedPassword = await bcrypt.hash(password, salt);
  
//       // Prepare permissions
//       const permissions = {
//         canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
//         canEnterMarks: selectedSubjects.map(subjectId => ({
//           class: teachingClass,
//           subject: subjectId
//         })),
//         canPublishAnnouncements: true,
//         canManageInventory: false,
//         canManageFees: false,
//         canManageLibrary: false
//       };
  
//       // Create teacher user
//       const teacher = new User({
//         school: schoolId,
//         name,
//         email,
//         password: hashedPassword,
//         role: 'teacher',
//         profile: { phone, address, photo },
//         permissions
//       });
  
//       await teacher.save({ session });
  
//       // Create teacher assignment record
//       const teacherAssignment = new TeacherAssignment({
//         school: schoolId,
//         teacher: teacher._id,
//         classTeacherAssignment: classTeacherOf ? {
//           class: classTeacherOf,
//           assignedAt: new Date()
//         } : null,
//         subjectAssignments: selectedSubjects.map(subjectId => ({
//           class: teachingClass,
//           subject: subjectId,
//           assignedAt: new Date()
//         })),
//         academicYear: getCurrentAcademicYear()
//       });
  
//       await teacherAssignment.save({ session });
  
//       // Update class if assigned as class teacher
//       if (classTeacherOf) {
//         await Class.findByIdAndUpdate(
//           classTeacherOf,
//           { 
//             classTeacher: teacher._id,
//             lastUpdated: new Date(),
//             updatedBy: req.user._id
//           },
//           { session }
//         );
//       }
  
//       // Update all selected subjects
//       await Promise.all(selectedSubjects.map(subjectId =>
//         Subject.findByIdAndUpdate(
//           subjectId,
//           {
//             $push: {
//               teachers: {
//                 teacher: teacher._id,
//                 assignedAt: new Date()
//               }
//             }
//           },
//           { session }
//         )
//       ));
  
//       await session.commitTransaction();
  
//       // Fetch populated data for response
//       const populatedTeacher = await User.findById(teacher._id)
//         .populate('permissions.canTakeAttendance', 'name division')
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division');
  
//       const populatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
//         .populate('classTeacherAssignment.class', 'name division')
//         .populate('subjectAssignments.class', 'name division')
//         .populate('subjectAssignments.subject', 'name');
  
//       res.status(201).json({
//         success: true,
//         teacher: populatedTeacher,
//         assignment: populatedAssignment,
//         message: 'Teacher created successfully'
//       });
  
//     } catch (error) {
//       await session.abortTransaction();
//       res.status(500).json({ 
//         success: false,
//         message: 'Failed to create teacher',
//         error: error.message 
//       });
//     } finally {
//       session.endSession();
//     }
//   },


//   updateTeacherAssignments: async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();
  
//     try {
//       const { teacherId } = req.params;
//       const { 
//         classTeacherOf,           // New class ID for class teacher role
//         removeClassTeacherRole,   // Boolean to remove class teacher role
//         addSubjectAssignments,    // Array of {classId, subjectId} to add
//         removeSubjectAssignments  // Array of {classId, subjectId} to remove
//       } = req.body;
//       const schoolId = req.school;
//       const adminId = req.user._id;
  
//       // Verify teacher exists
//       const teacher = await User.findOne({ 
//         _id: teacherId,
//         school: schoolId,
//         role: 'teacher'
//       });
  
//       if (!teacher) {
//         return res.status(404).json({ message: 'Teacher not found' });
//       }
  
//       // Get current teacher assignment
//       let teacherAssignment = await TeacherAssignment.findOne({
//         teacher: teacherId,
//         school: schoolId
//       });
  
//       if (!teacherAssignment) {
//         // Create new assignment record if it doesn't exist
//         teacherAssignment = new TeacherAssignment({
//           school: schoolId,
//           teacher: teacherId,
//           classTeacherAssignment: null,
//           subjectAssignments: [],
//           academicYear: getCurrentAcademicYear()
//         });
//       }
  
//       // HANDLE CLASS TEACHER ASSIGNMENT
//       if (classTeacherOf) {
//         // Validate the new class
//         const newClass = await Class.findOne({
//           _id: classTeacherOf,
//           school: schoolId
//         });
  
//         if (!newClass) {
//           return res.status(400).json({ message: 'Class not found' });
//         }
  
//         // Check if the class already has a teacher assigned (that's not this teacher)
//         if (newClass.classTeacher && newClass.classTeacher.toString() !== teacherId) {
//           return res.status(400).json({ 
//             message: 'This class already has a different class teacher assigned' 
//           });
//         }
  
//         // If teacher is already class teacher of a different class, remove that assignment
//         if (teacherAssignment.classTeacherAssignment && 
//             teacherAssignment.classTeacherAssignment.class &&
//             teacherAssignment.classTeacherAssignment.class.toString() !== classTeacherOf) {
          
//           // Remove teacher from old class
//           await Class.findByIdAndUpdate(
//             teacherAssignment.classTeacherAssignment.class,
//             { 
//               $unset: { classTeacher: "" },
//               lastUpdated: new Date(),
//               updatedBy: adminId
//             },
//             { session }
//           );
  
//           // Update teacher's attendance permissions
//           await User.findByIdAndUpdate(
//             teacherId,
//             {
//               $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class }
//             },
//             { session }
//           );
//         }
  
//         // Assign teacher to new class
//         await Class.findByIdAndUpdate(
//           classTeacherOf,
//           { 
//             classTeacher: teacherId,
//             lastUpdated: new Date(),
//             updatedBy: adminId
//           },
//           { session }
//         );
  
//         // Update teacher assignment record
//         teacherAssignment.classTeacherAssignment = {
//           class: classTeacherOf,
//           assignedAt: new Date()
//         };
  
//         // Update teacher's attendance permissions
//         await User.findByIdAndUpdate(
//           teacherId,
//           {
//             $addToSet: { 'permissions.canTakeAttendance': classTeacherOf }
//           },
//           { session }
//         );
//       } 
//       // Handle class teacher removal
//       else if (removeClassTeacherRole && teacherAssignment.classTeacherAssignment) {
//         // Remove teacher from class
//         await Class.findByIdAndUpdate(
//           teacherAssignment.classTeacherAssignment.class,
//           { 
//             $unset: { classTeacher: "" },
//             lastUpdated: new Date(),
//             updatedBy: adminId
//           },
//           { session }
//         );
  
//         // Update teacher's attendance permissions
//         await User.findByIdAndUpdate(
//           teacherId,
//           {
//             $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class }
//           },
//           { session }
//         );
  
//         // Remove from assignment record
//         teacherAssignment.classTeacherAssignment = null;
//       }
  
//       // HANDLE SUBJECT TEACHER ASSIGNMENTS - ADDITIONS
//       if (addSubjectAssignments?.length) {
//         // Validate all new subject assignments
//         const validationPromises = addSubjectAssignments.map(async ({ classId, subjectId }) => {
//           const subject = await Subject.findOne({
//             _id: subjectId,
//             class: classId,
//             school: schoolId
//           });
  
//           if (!subject) {
//             throw new Error(`Invalid subject assignment: Subject ${subjectId} for class ${classId}`);
//           }
  
//           return { classId, subjectId };
//         });
  
//         const validAssignments = await Promise.all(validationPromises);
  
//         // Add new subject assignments
//         for (const { classId, subjectId } of validAssignments) {
//           // Check if assignment already exists
//           const existingAssignment = teacherAssignment.subjectAssignments.find(
//             a => a.class.toString() === classId && a.subject.toString() === subjectId
//           );
  
//           if (!existingAssignment) {
//             // Add to teacher assignment record
//             teacherAssignment.subjectAssignments.push({
//               class: classId,
//               subject: subjectId,
//               assignedAt: new Date()
//             });
  
//             // Add to subject's teachers
//             await Subject.findByIdAndUpdate(
//               subjectId,
//               {
//                 $addToSet: {
//                   teachers: {
//                     teacher: teacherId,
//                     assignedAt: new Date()
//                   }
//                 }
//               },
//               { session }
//             );
  
//             // Update teacher's mark-entry permissions
//             await User.findByIdAndUpdate(
//               teacherId,
//               {
//                 $addToSet: { 
//                   'permissions.canEnterMarks': {
//                     class: classId,
//                     subject: subjectId
//                   }
//                 }
//               },
//               { session }
//             );
//           }
//         }
//       }
  
//       // HANDLE SUBJECT TEACHER ASSIGNMENTS - REMOVALS
//       if (removeSubjectAssignments?.length) {
//         for (const { classId, subjectId } of removeSubjectAssignments) {
//           // Remove from teacher assignment record
//           teacherAssignment.subjectAssignments = teacherAssignment.subjectAssignments.filter(
//             a => !(a.class.toString() === classId && a.subject.toString() === subjectId)
//           );
  
//           // Remove from subject's teachers
//           await Subject.findByIdAndUpdate(
//             subjectId,
//             {
//               $pull: {
//                 teachers: {
//                   teacher: teacherId
//                 }
//               }
//             },
//             { session }
//           );
  
//           // Update teacher's mark-entry permissions
//           await User.findByIdAndUpdate(
//             teacherId,
//             {
//               $pull: { 
//                 'permissions.canEnterMarks': {
//                   class: classId,
//                   subject: subjectId
//                 }
//               }
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
//         .populate('permissions.canTakeAttendance', 'name division')
//         .populate('permissions.canEnterMarks.subject', 'name')
//         .populate('permissions.canEnterMarks.class', 'name division');
  
//       const updatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
//         .populate('classTeacherAssignment.class', 'name division')
//         .populate('subjectAssignments.class', 'name division')
//         .populate('subjectAssignments.subject', 'name');
  
//       res.json({
//         teacher: updatedTeacher,
//         assignment: updatedAssignment,
//         message: 'Teacher assignments updated successfully'
//       });
  
//     } catch (error) {
//       await session.abortTransaction();
//       res.status(500).json({ 
//         error: error.message,
//         message: 'Failed to update teacher assignments'
//       });
//     } finally {
//       session.endSession();
//     }
//   },


//   // getAssignableSubjectsByClass: async (req, res) => {
//   //   try {
//   //     const { classId } = req.params;
//   //     const schoolId = req.school;
        
//   //     if (!classId || !schoolId) {
//   //       return res.status(400).json({ error: "Invalid classId or schoolId" });
//   //     }
  
//   //     // Get all subjects for this class
//   //     const subjects = await Subject.find({
//   //       school: schoolId,
//   //       class: classId
//   //     })
//   //     .select('name teachers')
//   //     .populate('teachers.teacher', 'name email');
  
//   //     if (!subjects || subjects.length === 0) {
//   //       return res.status(404).json({ error: "No subjects found for this class" });
//   //     }
  
//   //     res.json(subjects);
//   //   } catch (error) {
//   //     console.error("Error fetching assignable subjects:", error);
//   //     res.status(500).json({ error: "Internal Server Error" });
//   //   }
//   // },

//   // adminController.js (Backend)
// getAssignableSubjectsByClass: async (req, res) => {
//   try {
//     const { classId } = req.params;
//     const schoolId = req.school;

//     if (!classId || !schoolId) {
//       return res.status(400).json({ error: "Invalid classId or schoolId" });
//     }

//     // Fetch subjects for the given class and school
//     const subjects = await Subject.find({
//       school: schoolId,
//       class: classId,
//     })
//       .select("name teachers")
//       .populate("teachers.teacher", "name email");

//     if (!subjects || subjects.length === 0) {
//       return res.status(404).json({ error: "No subjects found for this class" });
//     }

//     // Transform subjects into the expected format
//     const subjectsWithStatus = subjects.map((subject) => ({
//       _id: subject._id.toString(), // Ensure _id is a string for frontend compatibility
//       name: subject.name,
//       isAssigned: subject.teachers && subject.teachers.length > 0,
//       assignedTo:
//         subject.teachers.length > 0
//           ? {
//               name: subject.teachers[0].teacher.name,
//               email: subject.teachers[0].teacher.email,
//             }
//           : null,
//     }));

//     res.json({
//       subjects: subjectsWithStatus,
//       message: "Subjects retrieved successfully",
//     });
//   } catch (error) {
//     console.error("Error fetching assignable subjects:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// },
//   // Get all teacher assignments - useful for admin dashboard
//   getAllTeacherAssignments: async (req, res) => {
//     try {
//       const schoolId = req.school;
      
//       const assignments = await TeacherAssignment.find({ school: schoolId })
//         .populate('teacher', 'name email profile')
//         .populate('classTeacherAssignment.class', 'name division')
//         .populate('subjectAssignments.class', 'name division')
//         .populate('subjectAssignments.subject', 'name');
      
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
//               email: assignment.teacher.email
//             },
//             assignedAt: assignment.classTeacherAssignment.assignedAt
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
//               email: assignment.teacher.email
//             },
//             assignedAt: subAssignment.assignedAt
//           });
//         });
//       });
      
//       res.json({
//         raw: assignments,
//         classTeachers: classAssignmentMap,
//         subjectTeachers: subjectAssignmentMap
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // getTeachers: async (req, res) => {
//   //   try {
//   //     const schoolId = req.school;
      
//   //     const teachers = await User.find({ 
//   //       school: schoolId,
//   //       role: 'teacher'
//   //     })
//   //     .select('-password')
//   //     .populate('permissions.canTakeAttendance', 'name division')
//   //     .populate('permissions.canEnterMarks.subject', 'name')
//   //     .populate('permissions.canEnterMarks.class', 'name division');

//   //     // Get teacher assignments
//   //     const assignments = await TeacherAssignment.find({
//   //       teacher: { $in: teachers.map(t => t._id) }
//   //     })
//   //     // .populate('class', 'name division')
//   //     // .populate('subjects.class', 'name division')
//   //     // .populate('subjects.subject', 'name');

//   //     .populate('classTeacherAssignment.class', 'name division')  // Changed from 'class' to 'classTeacherAssignment.class'
//   //     .populate('subjectAssignments.class', 'name division')      // Changed from 'subjects.class' to 'subjectAssignments.class'
//   //     .populate('subjectAssignments.subject', 'name'); 

//   //     // Combine teacher data with assignments
//   //     const teachersWithAssignments = teachers.map(teacher => ({
//   //       ...teacher.toObject(),
//   //       assignments: assignments.filter(a => a.teacher.toString() === teacher._id.toString())
//   //     }));

//   //     res.json(teachersWithAssignments);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   getTeachers: async (req, res) => {
//     try {
//       const schoolId = req.school;
      
//       // Get all teachers
//       const teachers = await User.find({ 
//         school: schoolId,
//         role: 'teacher'
//       })
//       .select('-password')
//       .lean(); // Using lean() for better performance with plain objects
  
//       // Get all teacher assignments in one query
//       const assignments = await TeacherAssignment.find({
//         school: schoolId,
//         teacher: { $in: teachers.map(t => t._id) }
//       })
//       .populate({
//         path: 'classTeacherAssignment.class',
//         select: 'name division'
//       })
//       .populate({
//         path: 'subjectAssignments.class',
//         select: 'name division'
//       })
//       .populate({
//         path: 'subjectAssignments.subject',
//         select: 'name'
//       })
//       .lean();
  
//       // Get current classes where teachers are assigned
//       const currentClasses = await Class.find({
//         school: schoolId,
//         classTeacher: { $in: teachers.map(t => t._id) }
//       })
//       .select('name division classTeacher')
//       .lean();
  
//       // Get current subjects where teachers are assigned
//       const currentSubjects = await Subject.find({
//         school: schoolId,
//         'teachers.teacher': { $in: teachers.map(t => t._id) }
//       })
//       .select('name class teachers')
//       .populate('class', 'name division')
//       .lean();
  
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
//             class: subject.class
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
//             subjectTeacher: subjectTeacherMap.get(teacherId) || []
//           }
//         };
//       });
  
//       res.json({
//         success: true,
//         data: teachersWithAssignments
//       });
  
//     } catch (error) {
//       console.error('Error in getTeachers:', error);
//       res.status(500).json({ 
//         success: false, 
//         error: error.message,
//         message: 'Failed to fetch teachers data'
//       });
//     }
//   },

 
//   updateUserRole: async (req, res) => {
//     try {
//       const { userId } = req.params;
//       const { role, permissions, classId, subjects } = req.body;
//       const schoolId =  req.school;
  
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
//         ...permissions
//       };
  
//       const user = await User.findByIdAndUpdate(
//         userId,
//         { 
//           role,
//           permissions: updatedPermissions,
//           'profile.lastRoleUpdate': new Date()
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

//   //======= Syllabys =======

//   // uploadSyllabus: async (req, res) => {
//   //   try {
//   //     const { classId, subjectId } = req.body;
//   //     const { content } = req.body;
//   //     const schoolId = req.school;
//   //     const uploadedBy = req.user._id;

//   //     // Check if class exists
//   //     const classExists = await Class.findOne({
//   //       _id: classId,
//   //       school: schoolId
//   //     });
      
//   //     if (!classExists) {
//   //       if (req.files && req.files.length > 0) {
//   //         const { cloudinary } = require('../config/cloudinary');
//   //         req.files.forEach(file => {
//   //           cloudinary.uploader.destroy(file.public_id);
//   //         });
//   //       }
//   //       return res.status(404).json({ message: 'Class not found' });
//   //     }

//   //     // Check if subject exists and belongs to the specified class
//   //     const subject = await Subject.findOne({
//   //       _id: subjectId,
//   //       class: classId,
//   //       school: schoolId
//   //     });
      
//   //     if (!subject) {
//   //       if (req.files && req.files.length > 0) {
//   //         const { cloudinary } = require('../config/cloudinary');
//   //         req.files.forEach(file => {
//   //           cloudinary.uploader.destroy(file.public_id);
//   //         });
//   //       }
//   //       return res.status(404).json({ message: 'Subject not found in the specified class' });
//   //     }

//   //     // Process uploaded files
//   //     const documents = [];
//   //     if (req.files && req.files.length > 0) {
//   //       req.files.forEach(file => {
//   //         documents.push({
//   //           title: file.originalname,
//   //           url: file.path,
//   //           public_id: file.public_id, // Store Cloudinary public_id
//   //           uploadedBy
//   //         });
//   //       });
//   //     }

//   //     // Create or update syllabus
//   //     let syllabus = await Syllabus.findOne({ subject: subjectId });
//   //     if (!syllabus) {
//   //       syllabus = new Syllabus({
//   //         school: schoolId,
//   //         subject: subjectId,
//   //         class: classId,
//   //         content,
//   //         documents
//   //       });
//   //     } else {
//   //       syllabus.content = content;
//   //       if (documents.length > 0) {
//   //         syllabus.documents = [...syllabus.documents, ...documents];
//   //       }
//   //     }

//   //     await syllabus.save();
//   //     subject.syllabus = syllabus._id;
//   //     await subject.save();

//   //     res.status(201).json(syllabus);
//   //   } catch (error) {
//   //     if (req.files && req.files.length > 0) {
//   //       const { cloudinary } = require('../config/cloudinary');
//   //       req.files.forEach(file => {
//   //         cloudinary.uploader.destroy(file.public_id);
//   //       });
//   //     }
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

// //   uploadSyllabus : async (req, res) => {
// //     try {
// //         const { classId, subjectId, content } = req.body;
// //         const schoolId = req.school;
// //         const uploadedBy = req.user._id;

// //         // Check if class exists
// //         const classExists = await Class.findOne({
// //             _id: classId,
// //             school: schoolId
// //         });

// //         if (!classExists) {
// //             if (req.files && req.files.length > 0) {
// //                 req.files.forEach(file => {
// //                     cloudinary.uploader.destroy(file.public_id);
// //                 });
// //             }
// //             return res.status(404).json({ message: 'Class not found' });
// //         }

// //         // Check if subject exists
// //         const subject = await Subject.findOne({
// //             _id: subjectId,
// //             class: classId,
// //             school: schoolId
// //         });

// //         if (!subject) {
// //             if (req.files && req.files.length > 0) {
// //                 req.files.forEach(file => {
// //                     cloudinary.uploader.destroy(file.public_id);
// //                 });
// //             }
// //             return res.status(404).json({ message: 'Subject not found in the specified class' });
// //         }

// //         // Process uploaded files
// //         const documents = req.files?.map(file => ({
// //             title: file.originalname,
// //             url: file.path,
// //             public_id: file.public_id,
// //             uploadedBy
// //         })) || [];

// //         // Create or update syllabus
// //         let syllabus = await Syllabus.findOne({ subject: subjectId });
// //         if (!syllabus) {
// //             syllabus = new Syllabus({
// //                 school: schoolId,
// //                 subject: subjectId,
// //                 class: classId,
// //                 content,
// //                 documents
// //             });
// //         } else {
// //             syllabus.content = content;
// //             if (documents.length > 0) {
// //                 syllabus.documents = [...syllabus.documents, ...documents];
// //             }
// //         }

// //         await syllabus.save();
// //         subject.syllabus = syllabus._id;
// //         await subject.save();

// //         res.status(201).json(syllabus);
// //     } catch (error) {
// //         if (req.files && req.files.length > 0) {
// //             req.files.forEach(file => {
// //                 cloudinary.uploader.destroy(file.public_id);
// //             });
// //         }
// //         res.status(500).json({ error: error.message });
// //     }
// // },

// uploadSyllabus : async (req, res) => {
//   try {
//       const { classId, subjectId, content } = req.body;
//       const schoolId = req.school;
//       const uploadedBy = req.user._id;

//       const classExists = await Class.findOne({ _id: classId, school: schoolId });
//       if (!classExists) {
//           if (req.files?.length > 0) {
//               req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//           }
//           return res.status(404).json({ message: 'Class not found' });
//       }

//       const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId });
//       if (!subject) {
//           if (req.files?.length > 0) {
//               req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//           }
//           return res.status(404).json({ message: 'Subject not found in the specified class' });
//       }

//       const documents = req.files?.map(file => ({
//           title: file.originalname,
//           url: file.path,
//           public_id: file.public_id,
//           uploadedBy
//       })) || [];

//       let syllabus = await Syllabus.findOne({ subject: subjectId });
//       if (!syllabus) {
//           syllabus = new Syllabus({
//               school: schoolId,
//               subject: subjectId,
//               class: classId,
//               content,
//               documents
//           });
//       } else {
//           syllabus.content = content;
//           if (documents.length > 0) {
//               syllabus.documents = [...syllabus.documents, ...documents];
//           }
//       }

//       await syllabus.save();
//       subject.syllabus = syllabus._id;
//       await subject.save();

//       res.status(201).json(syllabus);
//   } catch (error) {
//       if (req.files?.length > 0) {
//           req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
//       }
//       res.status(500).json({ error: error.message });
//   }
// },

  
//   // createClass : async (req, res) => {
//   //   try {
//   //     const {
//   //       name,
//   //       division,
//   //       capacity,
//   //       // subjects,
//   //       rteSeats,
//   //       academicYear,
//   //       schedule
//   //     } = req.body;
//   //     const schoolId = req.school;
  
//   //     // Check if a teacher is already assigned as class teacher for this class
//   //     const existingTeacherAssignment = await TeacherAssignment.findOne({
//   //       school: schoolId,
//   //       class: null, // Will be updated after class creation
//   //       assignmentType: 'classTeacher',
//   //       academicYear: academicYear
//   //     });
  
//   //     const newClass = new Class({
//   //       school: schoolId,
//   //       name,
//   //       division,
//   //       capacity,
//   //       classTeacher: existingTeacherAssignment ? existingTeacherAssignment.teacher : null,
//   //       // subjects,
//   //       rteSeats,
//   //       academicYear,
//   //       schedule
//   //     });
  
//   //     await newClass.save();
  
//   //     // If there's a pending class teacher assignment, update it with the new class ID
//   //     if (existingTeacherAssignment) {
//   //       await TeacherAssignment.findByIdAndUpdate(
//   //         existingTeacherAssignment._id,
//   //         { class: newClass._id }
//   //       );
  
//   //       // Update teacher's permissions to include the new class
//   //       await User.findByIdAndUpdate(
//   //         existingTeacherAssignment.teacher,
//   //         {
//   //           $push: { 'permissions.canTakeAttendance': newClass._id }
//   //         }
//   //       );
//   //     }
  
//   //     // Populate the class teacher details before sending response
//   //     const populatedClass = await Class.findById(newClass._id)
//   //       .populate('classTeacher', 'name email profile')
//   //       // .populate('subjects');
  
//   //     res.status(201).json(populatedClass);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   // getClasses: async (req, res) => {
//   //   try {
//   //     const schoolId = req.school;
      
//   //     const classes = await Class.find({ school: schoolId })
//   //       .populate('classTeacher', 'name email profile')
//   //       .populate('subjects', 'name')
//   //       .sort({ name: 1, division: 1 });

//   //     res.json(classes);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },


//   createClass: async (req, res) => {
//     try {
//       const {
//         name,
//         division,
//         capacity,
//         // subjects,
//         rteSeats,
//         academicYear,
//         schedule
//       } = req.body;
//       const schoolId = req.school;

//       // Check if a class with same name and division already exists for this school and academic year
//       const existingClass = await Class.findOne({
//         school: schoolId,
//         name: name,
//         division: division,
//         academicYear: academicYear
//       });

//       if (existingClass) {
//         return res.status(400).json({
//           error: `Class ${name} division ${division} already exists for academic year ${academicYear}`
//         });
//       }

//       // Check if a teacher is already assigned as class teacher for this class
//       const existingTeacherAssignment = await TeacherAssignment.findOne({
//         school: schoolId,
//         class: null, // Will be updated after class creation
//         assignmentType: 'classTeacher',
//         academicYear: academicYear
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
//         schedule
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
//             $push: { 'permissions.canTakeAttendance': newClass._id }
//           }
//         );
//       }

//       // Populate the class teacher details before sending response
//       const populatedClass = await Class.findById(newClass._id)
//         .populate('classTeacher', 'name email profile')
//         // .populate('subjects');

//       res.status(201).json(populatedClass);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
// },

// getClasses: async (req, res) => {
//     try {
//       const schoolId = req.school;
      
//       const classes = await Class.find({ school: schoolId })
//         .populate('classTeacher', 'name email profile')
//         .populate('subjects', 'name')
//         .sort({ name: 1, division: 1 });

//       res.json(classes);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
// },


//   // ============ Subject Management ============
//   createSubject: async (req, res) => { 
//     try { 
//       const { classId, name } = req.body; 
//       const schoolId =  req.school;  // School ID extracted from authenticated user
//       const adminId = req.user._id;
      
//       // Validate if class exists and was created by this admin
//       const classExists = await Class.findOne({ 
//         _id: classId, 
//         school: schoolId,
//       }); 

//       if (!classExists) { 
//         return res.status(400).json({ 
//           message: "Invalid class selected. Please select a class you have created."
//         }); 
//       } 

//       // Create subject with default values 
//       const subject = new Subject({ 
//         school: schoolId, 
//         class: classId, 
//         name: name || "Untitled Subject", // Use provided name or default
//         teachers: [], // No teachers initially
//         createdBy: adminId // Track which admin created the subject
//       }); 

//       await subject.save(); 

//       // Add subject to class 
//       // await Class.findByIdAndUpdate(classId, { 
//       //   $push: { 
//       //     subjects: { 
//       //       name: subject.name, 
//       //       teacher: null, // No assigned teacher 
//       //       syllabus: null 
//       //     } 
//       //   } 
//       // }); 

//       await Class.findByIdAndUpdate(classId, { 
//         $push: { subjects: subject._id } // Push ObjectId instead of object
//       });
      

//       res.status(201).json({
//         message: "Subject created successfully",
//         subject: subject
//       }); 
//     } catch (error) { 
//       res.status(500).json({ error: error.message }); 
//     } 
//   },

//   getAllSubjects: async (req, res) => {
//     try {
//       const schoolId = req.school;
      
//       const subjects = await Subject.find({ school: schoolId })
//         .populate('class', 'name division')
//         .populate('teachers.teacher', 'name email')
//         .populate('syllabus')
//         .sort({ 'class.name': 1, name: 1 });

//       res.json(subjects);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // getSyllabus: async (req, res) => {
//   //   try {
//   //     const { subjectId } = req.params;
//   //     const schoolId = req.school;

//   //     const syllabus = await Syllabus.findOne({
//   //       subject: subjectId,
//   //       school: schoolId
//   //     })
//   //     .populate('subject', 'name')
//   //     .populate('class', 'name division');

//   //     if (!syllabus) {
//   //       return res.status(404).json({ message: 'Syllabus not found' });
//   //     }

//   //     // Generate signed URLs for each document with proper content disposition
//   //     if (syllabus.documents && syllabus.documents.length > 0) {
//   //       const { cloudinary } = require('../config/cloudinary');
//   //       syllabus.documents = syllabus.documents.map(doc => {
//   //         // Get file extension for proper content type
//   //         const fileExtension = doc.title.split('.').pop().toLowerCase() || '';
//   //         let contentType = 'application/octet-stream'; // Default
          
//   //         if (fileExtension === 'pdf') {
//   //           contentType = 'application/pdf';
//   //         } else if (fileExtension === 'doc') {
//   //           contentType = 'application/msword';
//   //         } else if (fileExtension === 'docx') {
//   //           contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
//   //         } else if (['jpg', 'jpeg'].includes(fileExtension)) {
//   //           contentType = 'image/jpeg';
//   //         }

//   //         // Create signed URL with proper content disposition and type
//   //         const downloadUrl = cloudinary.utils.private_download_url(doc.url, doc.title, {
//   //           expires_at: Math.floor(Date.now() / 1000) + 3600, // URL expires in 1 hour
//   //           attachment: true,
//   //           type: 'authenticated',
//   //           resource_type: 'auto',
//   //           format: fileExtension || 'any',
//   //           flags: 'attachment',
//   //           content_disposition: `attachment; filename="${doc.title}"`,
//   //           headers: {
//   //             'Content-Type': contentType,
//   //             'Cache-Control': 'no-cache'
//   //           }
//   //         });

//   //         return {
//   //           ...doc.toObject(),
//   //           downloadUrl,
//   //           contentType
//   //         };
//   //       });
//   //     }

//   //     res.json(syllabus);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   // getSyllabus : async (req, res) => {
//   //   try {
//   //       const { subjectId } = req.params;
//   //       const schoolId = req.school;

//   //       const syllabus = await Syllabus.findOne({
//   //           subject: subjectId,
//   //           school: schoolId
//   //       })
//   //           .populate('subject', 'name')
//   //           .populate('class', 'name division');

//   //       if (!syllabus) {
//   //           return res.status(404).json({ message: 'Syllabus not found' });
//   //       }

//   //       // Generate signed URLs for documents
//   //       if (syllabus.documents?.length > 0) {
//   //           syllabus.documents = syllabus.documents.map(doc => {
//   //               const fileExtension = doc.title.split('.').pop().toLowerCase();
//   //               const contentType = fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream';

//   //               const downloadUrl = cloudinary.url(doc.public_id, {
//   //                   resource_type: 'raw',
//   //                   secure: true,
//   //                   sign_url: true,
//   //                   expires_at: Math.floor(Date.now() / 1000) + 3600,
//   //                   attachment: true,
//   //                   content_disposition: `attachment; filename="${doc.title}"`,
//   //                   flags: 'attachment'
//   //               });

//   //               return {
//   //                   ...doc.toObject(),
//   //                   downloadUrl,
//   //                   contentType
//   //               };
//   //           });
//   //       }

//   //       res.json(syllabus);
//   //   } catch (error) {
//   //       res.status(500).json({ error: error.message });
//   //   }
//   // },

// //   getSyllabus : async (req, res) => {
// //     try {
// //         const { subjectId } = req.params;
// //         const schoolId = req.school;

// //         const syllabus = await Syllabus.findOne({
// //             subject: subjectId,
// //             school: schoolId
// //         })
// //             .populate('subject', 'name')
// //             .populate('class', 'name division');

// //         if (!syllabus) {
// //             return res.status(404).json({ message: 'Syllabus not found' });
// //         }

// //         if (syllabus.documents?.length > 0) {
// //             syllabus.documents = syllabus.documents.map(doc => {
// //                 const fileExtension = doc.title.split('.').pop().toLowerCase();
// //                 const contentType = fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream';

// //                 // Generate a signed URL
// //                 const downloadUrl = cloudinary.url(doc.public_id, {
// //                     resource_type: 'raw', // Correct for PDFs
// //                     secure: true, // HTTPS
// //                     sign_url: true, // Generate a signed URL
// //                     type: 'upload', // Ensure it’s an uploaded file
// //                     attachment: true, // Trigger download
// //                     format: fileExtension, // Use the actual file extension
// //                     expires_at: Math.floor(Date.now() / 1000) + 3600 // 1-hour expiry
// //                 });

// //                 console.log(`Generated download URL for ${doc.title}: ${downloadUrl}`);

// //                 return {
// //                     ...doc.toObject(),
// //                     downloadUrl: downloadUrl || null,
// //                     contentType
// //                 };
// //             });
// //         }

// //         res.json(syllabus);
// //     } catch (error) {
// //         console.error('Error in getSyllabus:', error);
// //         res.status(500).json({ error: error.message });
// //     }
// // },

// // getSyllabus : async (req, res) => {
// //   try {
// //       const { subjectId } = req.params;
// //       const schoolId = req.school;

// //       const syllabus = await Syllabus.findOne({
// //           subject: subjectId,
// //           school: schoolId
// //       })
// //           .populate('subject', 'name')
// //           .populate('class', 'name division');

// //       if (!syllabus) {
// //           return res.status(404).json({ message: 'Syllabus not found' });
// //       }

// //       if (syllabus.documents?.length > 0) {
// //           syllabus.documents = await Promise.all(syllabus.documents.map(async (doc) => {
// //               const fileExtension = doc.title.split('.').pop().toLowerCase();
// //               const contentType = fileExtension === 'pdf' ? 'application/pdf' : 'application/octet-stream';

// //               // Generate a signed URL with the correct resource type and format
// //               try {
// //                   const downloadUrl = cloudinary.url(doc.public_id, {
// //                       resource_type: 'raw',
// //                       secure: true,
// //                       sign_url: true,
// //                       type: 'upload',
// //                       attachment: true,
// //                       flags: 'attachment',
// //                       format: fileExtension
// //                   });

// //                   console.log(`Generated download URL for ${doc.title}: ${downloadUrl}`);

// //                   return {
// //                       ...doc.toObject(),
// //                       downloadUrl,
// //                       contentType
// //                   };
// //               } catch (error) {
// //                   console.error(`Error generating URL for ${doc.title}:`, error);
// //                   return {
// //                       ...doc.toObject(),
// //                       downloadUrl: null,
// //                       contentType
// //                   };
// //               }
// //           }));
// //       }

// //       res.json(syllabus);
// //   } catch (error) {
// //       console.error('Error in getSyllabus:', error);
// //       res.status(500).json({ error: error.message });
// //   }
// // },

// getSyllabus: async (req, res) => {
//   try {
//       const { subjectId } = req.params;
//       const schoolId = req.school;

//       const syllabus = await Syllabus.findOne({
//           subject: subjectId,
//           school: schoolId
//       })
//           .populate('subject', 'name')
//           .populate('class', 'name division');

//       if (!syllabus) {
//           return res.status(404).json({ message: 'Syllabus not found' });
//       }

//       if (syllabus.documents?.length > 0) {
//           syllabus.documents = syllabus.documents.map(doc => {
//               try {
//                   if (!doc.public_id) {
//                       throw new Error(`Missing public_id for document: ${doc.title}`);
//                   }

//                   // Extract file extension
//                   const fileExtension = doc.title.split('.').pop().toLowerCase();

//                   // Set proper content type
//                   const contentType = {
//                       'pdf': 'application/pdf',
//                       'doc': 'application/msword',
//                       'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//                       'jpg': 'image/jpeg',
//                       'jpeg': 'image/jpeg'
//                   }[fileExtension] || 'application/octet-stream';

//                   // Generate signed URL
//                   const downloadUrl = cloudinary.url(doc.public_id, {
//                       resource_type: 'raw',
//                       format: fileExtension,
//                       secure: true,
//                       sign_url: true,
//                       type: 'upload',
//                       attachment: true,
//                       flags: 'attachment',
//                       timestamp: Math.round(new Date().getTime() / 1000),
//                   });

//                   console.log(`Generated download URL for ${doc.title}: ${downloadUrl}`);

//                   return {
//                       ...doc.toObject(),
//                       downloadUrl,
//                       contentType
//                   };
//               } catch (error) {
//                   console.error(`Error generating URL for ${doc.title}:`, error);
//                   return {
//                       ...doc.toObject(),
//                       downloadUrl: null,
//                       contentType: 'application/octet-stream'
//                   };
//               }
//           });
//       }

//       res.json(syllabus);
//   } catch (error) {
//       console.error('Error in getSyllabus:', error);
//       res.status(500).json({ error: error.message });
//   }
// },

//   assignTeacherRole: async (req, res) => {
//     try {
//       const { teacherId, classTeacherOf, subjectAssignments, academicYear } = req.body;
//       const schoolId =  req.school;
  
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
//           academicYear 
//         });
  
//         const assignmentType = classTeacherOf ? 'classTeacher' : 'subjectTeacher';
        
//         if (!assignment) {
//           assignment = new TeacherAssignment({
//             school: schoolId,
//             teacher: teacherId,
//             class: assignmentType === 'classTeacher' ? classTeacherOf : null,
//             subjects: subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId })),
//             assignmentType,
//             academicYear
//           });
//         } else {
//           assignment.class = assignmentType === 'classTeacher' ? classTeacherOf : null;
//           assignment.subjects = subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId }));
//           assignment.assignmentType = assignmentType;
//         }
  
//         await assignment.save({ session });
  
//         // Update teacher permissions
//         let permissionUpdate = {
//           ...teacher.permissions
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
//           subject: s.subjectId
//         }));
        
//         // Merge with existing permissions to avoid duplicates
//         permissionUpdate.canEnterMarks = [
//           ...new Map([
//             ...permissionUpdate.canEnterMarks,
//             ...markEntryPermissions
//           ].map(item => [
//             `${item.class.toString()}-${item.subject.toString()}`, item
//           ])).values()
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
//           message: 'Teacher role and permissions updated successfully'
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

//       // Validate teacher availability
//       const teacherConflicts = await checkTeacherConflicts(schedule);
//       if (teacherConflicts.length > 0) {
//         return res.status(400).json({
//           error: 'Teacher scheduling conflicts detected',
//           conflicts: teacherConflicts
//         });
//       }

//       // Generate optimized timetable
//       const optimizedSchedule = optimizeSchedule(schedule, constraints);

//       const timetable = new Timetable({
//         class: classId,
//         type, // 'regular', 'exam', 'substitute'
//         schedule: optimizedSchedule
//       });

//       await timetable.save();

//       // Notify affected teachers
//       await notifyTeachersAboutTimetable(timetable);

//       res.status(201).json(timetable);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // ============ Attendance Management ============
//   getAttendanceReport: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { startDate, endDate, type, classId, reportType } = req.query;

//       const query = {
//         school: schoolId,
//         date: {
//           $gte: new Date(startDate),
//           $lte: new Date(endDate)
//         }
//       };

//       if (type) query.type = type;
//       if (classId) query.class = classId;

//       const attendanceData = await Attendance.find(query)
//         .populate('user', 'name')
//         .populate('class', 'name division')
//         .lean();

//       // Generate comprehensive report
//       const report = {
//         summary: calculateAttendanceStatistics(attendanceData, reportType),
//         details: generateDetailedAttendanceReport(attendanceData, reportType),
//         charts: generateAttendanceCharts(attendanceData)
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
//         availableRooms
//       } = req.body;
//       const schoolId  =  req.school;

//       // Get total students in the class
//       const classDetails = await Class.findById(classId).populate('students');
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
//         seatingArrangement
//       });

//       await exam.save();

//       // Notify teachers and create exam schedule
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
      
//       const classResults = await ClassResult.find({ 
//         exam: examId,
//         status: 'submitted'
//       })
//       .populate('class')
//       .populate('classTeacher')
//       .populate({
//         path: 'subjectMarks',
//         populate: [
//           { path: 'subject' },
//           { path: 'teacher' },
//           { path: 'students.student' }
//         ]
//       });

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

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         const classResults = await ClassResult.find({
//           exam: examId,
//           status: 'submitted'
//         }).populate('subjectMarks');

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


//   // ============ Announcement Management ============
//   // createAnnouncement: async (req, res) => {
//   //   try {
//   //     const {
//   //       title,
//   //       content,
//   //       targetGroups,
//   //       priority,
//   //       validFrom,
//   //       validUntil,
//   //       attachments
//   //     } = req.body;
//   //     // const { schoolId } = req.user.school;
//   //     const schoolId = req.school._id;

//   //     const announcement = new Announcement({
//   //       school: schoolId,
//   //       title,
//   //       content,
//   //       targetGroups,
//   //       priority,
//   //       validFrom,
//   //       validUntil,
//   //       attachments,
//   //       createdBy: req.user._id
//   //     });

//   //     await announcement.save();

//   //     // Send notifications to target groups
//   //     // await notifyAnnouncementTargets(announcement);

//   //     res.status(201).json(announcement);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   createAnnouncement: async (req, res) => { 
//     try { 
//       const { 
//         title, 
//         content, 
//         targetGroups, 
//         priority, 
//         validFrom, 
//         validUntil
//       } = req.body; 
      
//       const schoolId = req.school._id;
      
//       // Process uploaded files
//       let attachments = [];
//       if (req.files && req.files.length > 0) {
//         attachments = req.files.map(file => ({
//           fileName: file.originalname,
//           fileUrl: file.path, // Cloudinary URL
//           fileType: file.mimetype,
//           fileSize: file.size,
//           publicId: file.filename // Store public ID for future management
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
//         createdBy: req.user._id 
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
// },


//   // updateAnnouncement: async (req, res) => {
//   //   try {
//   //     const { id } = req.params;
//   //     const { 
//   //       title, 
//   //       content, 
//   //       targetGroups, 
//   //       priority, 
//   //       validFrom, 
//   //       validUntil, 
//   //       attachments 
//   //     } = req.body;
      
//   //     const announcement = await Announcement.findById(id);
      
//   //     if (!announcement) {
//   //       return res.status(404).json({ error: 'Announcement not found' });
//   //     }
      
//   //     // Check if user's school matches the announcement's school
//   //     if (announcement.school.toString() !== req.school._id.toString()) {
//   //       return res.status(403).json({ error: 'Not authorized to update this announcement' });
//   //     }
      
//   //     announcement.title = title;
//   //     announcement.content = content;
//   //     announcement.targetGroups = targetGroups;
//   //     announcement.priority = priority;
//   //     announcement.validFrom = validFrom;
//   //     announcement.validUntil = validUntil;
//   //     announcement.attachments = attachments;
      
//   //     await announcement.save();
      
//   //     res.status(200).json(announcement);
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },
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
//         removeAttachments // Array of attachment IDs to remove
//       } = req.body;
      
//       const announcement = await Announcement.findById(id);
      
//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }
      
//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== req.school._id.toString()) {
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
//           publicId: file.filename
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
  
//   // Delete an announcement
//   // deleteAnnouncement: async (req, res) => {
//   //   try {
//   //     const { id } = req.params;
      
//   //     const announcement = await Announcement.findById(id);
      
//   //     if (!announcement) {
//   //       return res.status(404).json({ error: 'Announcement not found' });
//   //     }
      
//   //     // Check if user's school matches the announcement's school
//   //     if (announcement.school.toString() !== req.school._id.toString()) {
//   //       return res.status(403).json({ error: 'Not authorized to delete this announcement' });
//   //     }
      
//   //     await Announcement.findByIdAndDelete(id);
      
//   //     res.status(200).json({ message: 'Announcement deleted successfully' });
//   //   } catch (error) {
//   //     res.status(500).json({ error: error.message });
//   //   }
//   // },

//   deleteAnnouncement: async (req, res) => {
//     try {
//       const { id } = req.params;
      
//       const announcement = await Announcement.findById(id);
      
//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }
      
//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== req.school._id.toString()) {
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
      
//       const announcements = await Announcement.find({ school: schoolId })
//         .sort({ createdAt: -1 }) // Sort by newest first
//         .populate('createdBy', 'name email'); // Include creator information
      
//       res.status(200).json(announcements);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
  
//   // Get a single announcement by ID
//   getAnnouncementById: async (req, res) => {
//     try {
//       const { id } = req.params;
      
//       const announcement = await Announcement.findById(id)
//         .populate('createdBy', 'name email');
      
//       if (!announcement) {
//         return res.status(404).json({ error: 'Announcement not found' });
//       }
      
//       // Check if user's school matches the announcement's school
//       if (announcement.school.toString() !== req.school._id.toString()) {
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
//               canAccessHrDocs: role === 'hr_trustee'
//             }
//           },
//           { new: true, session }
//         );

//         // Log trustee activity
//         const activity = new TrusteeActivity({
//           trustee: trusteeId,
//           activity: 'role_update',
//           details: `Role updated to ${role}`,
//           timestamp: new Date()
//         });

//         await activity.save({ session });
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
//       const schoolId  =  req.school;

//       const meeting = new Meeting({
//         school: schoolId,
//         title,
//         date,
//         type,
//         agenda: agenda.map(item => ({
//           ...item,
//           duration: item.duration || 30
//         })),
//         attendees: attendees.map(attendee => ({
//           user: attendee,
//           status: 'invited'
//         }))
//       });

//       await meeting.save();

//       // Send meeting invitations
//       await notifyMeetingAttendees(meeting);

//       res.status(201).json(meeting);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Add to adminController
// recordMeetingMinutes: async (req, res) => {
//   try {
//     const { meetingId } = req.params;
//     const { minutes, decisions, actionItems } = req.body;

//     const meeting = await Meeting.findById(meetingId);
//     if (!meeting) {
//       return res.status(404).json({ message: 'Meeting not found' });
//     }

//     meeting.minutes = minutes;
//     meeting.decisions = decisions;
//     meeting.actionItems = actionItems;
//     meeting.status = 'completed';

//     await meeting.save();

//     // Notify attendees about meeting minutes
//     await notifyMeetingAttendees(meeting, 'minutes_updated');

//     res.status(200).json(meeting);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// },


// //============ seating Arrangemnt===========


// // Add to adminController
// generateSeatingArrangement: (totalStudents, availableRooms) => {
//   const seatingArrangement = [];
//   const studentsPerRoom = Math.ceil(totalStudents / availableRooms.length);

//   availableRooms.forEach((room, index) => {
//     const roomArrangement = {
//       room: room.name,
//       capacity: room.capacity,
//       rows: [],
//     };

//     const studentsInThisRoom = index === availableRooms.length - 1 
//       ? totalStudents - (studentsPerRoom * index)
//       : studentsPerRoom;

//     // Create row-wise seating with gaps
//     const seatsPerRow = room.seatsPerRow || 5;
//     const totalRows = Math.ceil(studentsInThisRoom / seatsPerRow);

//     for (let row = 0; row < totalRows; row++) {
//       const rowSeats = [];
//       for (let seat = 0; seat < seatsPerRow; seat++) {
//         const studentNumber = row * seatsPerRow + seat;
//         if (studentNumber < studentsInThisRoom) {
//           // Alternate seats to maintain gap
//           rowSeats.push({
//             position: seat * 2, // Double the gap between seats
//             occupied: true
//           });
//         }
//       }
//       roomArrangement.rows.push(rowSeats);
//     }

//     seatingArrangement.push(roomArrangement);
//   });

//   return seatingArrangement;
// },


// //===== generate Attendace Report

// // Add to adminController
// generateAttendanceReport: async (req, res) => {
//   try {
//     const schoolId  =  req.school;
//     const { startDate, endDate, type, classId, reportType } = req.query;

//     const query = {
//       school: schoolId,
//       date: {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       }
//     };

//     if (type) query.type = type;
//     if (classId) query.class = classId;

//     const attendanceData = await Attendance.find(query)
//       .populate('user', 'name')
//       .populate('class', 'name division')
//       .lean();

//     const report = {
//       summary: calculateAttendanceStatistics(attendanceData, reportType),
//       details: generateDetailedAttendanceReport(attendanceData, reportType),
//       charts: generateAttendanceCharts(attendanceData)
//     };

//     res.json(report);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// },

// createExamSchedule: async (req, res) => {
//   try {
//     const {
//       name,
//       examType,
//       startDate,
//       endDate,
//       classes,
//       subjects,
//       availableRooms,
//       totalStudents
//     } = req.body;
//     const schoolId = req.school;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       // Create master exam schedule
//       const examSchedule = new Exam({
//         school: schoolId,
//         name,
//         examType,
//         startDate,
//         endDate,
//         classes: classes.map(classId => ({
//           class: classId,
//           subjects: subjects.map(subject => ({
//             subject: subject.id,
//             date: subject.date,
//             startTime: subject.startTime,
//             endTime: subject.endTime,
//             totalMarks: subject.totalMarks
//           }))
//         }))
//       });

//       await examSchedule.save({ session });

//       // Generate seating arrangements for each exam date
//       const seatingArrangements = {};
//       const uniqueDates = [...new Set(subjects.map(s => s.date))];

//       for (const date of uniqueDates) {
//         // Get total students appearing on this date
//         const classesOnThisDate = classes.filter(c => 
//           subjects.some(s => s.date === date && s.classes.includes(c))
//         );

//         const totalStudentsOnDate = await User.countDocuments({
//           role: 'student',
//           class: { $in: classesOnThisDate }
//         });

//         // Generate seating arrangement for this date
//         seatingArrangements[date] = generateSeatingArrangement(
//           totalStudentsOnDate,
//           availableRooms
//         );
//       }

//       // Update exam schedule with seating arrangements
//       examSchedule.seatingArrangements = seatingArrangements;
//       await examSchedule.save({ session });

//       // Create subject-wise exam entries for mark entry
//       for (const classObj of classes) {
//         for (const subject of subjects) {
//           if (subject.classes.includes(classObj)) {
//             const subjectExam = new SubjectMarks({
//               exam: examSchedule._id,
//               class: classObj,
//               subject: subject.id,
//               totalMarks: subject.totalMarks,
//               status: 'pending'
//             });
//             await subjectExam.save({ session });
//           }
//         }
//       }

//       await session.commitTransaction();

//       res.status(201).json({
//         examSchedule,
//         seatingArrangements
//       });
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

// // Enter exam results
// enterResults: async (req, res) => {
//   try {
//     const { examId, classId } = req.params;
//     const { results } = req.body;

//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       // Get exam schedule
//       const examSchedule = await ExamSchedule.findById(examId);
//       if (!examSchedule) {
//         throw new Error('Exam schedule not found');
//       }

//       // Process results for each student
//       const resultPromises = results.map(async (studentResult) => {
//         const result = new Result({
//           school: examSchedule.school,
//           student: studentResult.studentId,
//           examSchedule: examId,
//           class: classId,
//           subjects: studentResult.subjects,
//           totalMarks: calculateTotalMarks(studentResult.subjects),
//           percentage: calculatePercentage(studentResult.subjects),
//           grade: calculateGrade(studentResult.subjects),
//           status: determineStatus(studentResult.subjects),
//           publishedBy: req.user._id
//         });

//         return result.save({ session });
//       });

//       await Promise.all(resultPromises);
//       await session.commitTransaction();

//       res.json({ message: 'Results entered successfully' });
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

// // Generate report cards
// generateReportCards: async (req, res) => {
//   try {
//     const { examId, classId } = req.params;

//     // Get all results for the exam and class
//     const results = await Result.find({
//       examSchedule: examId,
//       class: classId
//     })
//     .populate('student', 'name profile')
//     .populate('examSchedule', 'examType academicYear')
//     .lean();

//     // Calculate class statistics
//     const classStats = calculateClassStatistics(results);

//     // Generate report cards
//     const reportCards = results.map(result => 
//       generateReportCard(result, classStats)
//     );

//     res.json(reportCards);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// }

// };

// async function verifyAllSubjectsSubmitted(examId, classId) {
//   const subjects = await Subject.find({ class: classId });
//   const submittedMarks = await SubjectMarks.find({
//     exam: examId,
//     class: classId,
//     status: 'submitted'
//   });

//   return subjects.length === submittedMarks.length;
// }

// async function generateStudentReportCard(studentId, examId, subjectMarks) {
//   const reportCard = {
//     student: studentId,
//     exam: examId,
//     subjects: [],
//     totalMarks: 0,
//     percentage: 0,
//     grade: '',
//     remarks: ''
//   };

//   let totalObtained = 0;
//   let totalPossible = 0;

//   // Compile marks for each subject
//   for (const subjectMark of subjectMarks) {
//     const studentResult = subjectMark.students.find(
//       s => s.student.toString() === studentId.toString()
//     );

//     if (studentResult) {
//       reportCard.subjects.push({
//         subject: subjectMark.subject,
//         marksObtained: studentResult.marks,
//         totalMarks: subjectMark.totalMarks,
//         grade: calculateGrade(studentResult.marks, subjectMark.totalMarks),
//         remarks: studentResult.remarks || ''
//       });

//       totalObtained += studentResult.marks;
//       totalPossible += subjectMark.totalMarks;
//     }
//   }

//   // Calculate overall results
//   reportCard.totalMarks = totalObtained;
//   reportCard.percentage = (totalObtained / totalPossible) * 100;
//   reportCard.grade = calculateOverallGrade(reportCard.percentage);
//   reportCard.remarks = generateOverallRemarks(reportCard.percentage);

//   return reportCard;
// }

// // Helper functions for exam controller
// function calculateTotalMarks(subjects) {
//   return subjects.reduce((total, subject) => total + subject.marksObtained, 0);
// }

// function calculatePercentage(subjects) {
//   const totalObtained = subjects.reduce((total, subject) => total + subject.marksObtained, 0);
//   const totalPossible = subjects.reduce((total, subject) => total + subject.totalMarks, 0);
//   return (totalObtained / totalPossible) * 100;
// }



// function determineStatus(subjects) {
//   const failedSubjects = subjects.filter(
//     subject => (subject.marksObtained / subject.totalMarks) * 100 < 35
//   );
//   return failedSubjects.length > 0 ? 'fail' : 'pass';
// }

// // Helper Functions
// const getDefaultPermissions = (role) => {
//   const permissions = {
//     canTakeAttendance: [],
//     canEnterMarks: [],
//     canPublishAnnouncements: false,
//     canManageInventory: false,
//     canManageFees: false,
//     canManageLibrary: false
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
//         period: slot.period
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

//   // Check lab requirements
//   if (labRequirements.includes(slot.subject) && !isLabAvailable(day, period)) {
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
//           position: pos + 1
//         }))
//       });
//     }

//     seatingArrangement.push({
//       classroom: room,
//       capacity: studentsPerRoom,
//       arrangement
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
//     studentWiseAnalysis: new Map()
//   };

//   // Group data by period (day/week/month)
//   const groupedData = groupAttendanceByPeriod(attendanceData, reportType);

//   groupedData.forEach(period => {
//     const periodStats = {
//       present: period.filter(a => a.status === 'present').length,
//       absent: period.filter(a => a.status === 'absent').length,
//       late: period.filter(a => a.status === 'late').length
//     };

//     statistics.totalPresent += periodStats.present;
//     statistics.totalAbsent += periodStats.absent;
//     statistics.totalLate += periodStats.late;

//     // Calculate percentage for the period
//     const total = periodStats.present + periodStats.absent + periodStats.late;
//     const percentage = (periodStats.present / total) * 100;

//     statistics.trendByPeriod.push({
//       period: period[0].date,
//       percentage
//     });
//   });

//   // Calculate overall percentage
//   const total = statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
//   statistics.percentagePresent = (statistics.totalPresent / total) * 100;

//   return statistics;
// };

// const generateDetailedAttendanceReport = (attendanceData, reportType) => {
//   const report = {
//     byClass: new Map(),
//     byTeacher: new Map(),
//     byDate: new Map()
//   };

//   attendanceData.forEach(record => {
//     // Class-wise analysis
//     if (!report.byClass.has(record.class._id)) {
//       report.byClass.set(record.class._id, {
//         className: `${record.class.name}-${record.class.division}`,
//         present: 0,
//         absent: 0,
//         late: 0
//       });
//     }
//     const classStats = report.byClass.get(record.class._id);
//     classStats[record.status]++;

//     // Teacher-wise analysis
//     if (record.markedBy) {
//       if (!report.byTeacher.has(record.markedBy)) {
//         report.byTeacher.set(record.markedBy, {
//           recordsMarked: 0,
//           classes: new Set()
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
//         late: 0
//       });
//     }
//     const dateStats = report.byDate.get(dateKey);
//     dateStats[record.status]++;
//   });

//   return {
//     classWise: Array.from(report.byClass.entries()),
//     teacherWise: Array.from(report.byTeacher.entries()),
//     dateWise: Array.from(report.byDate.entries())
//   };
// };

// function generateOverallRemarks(percentage) {
//   if (percentage >= 90) return 'Exceptional performance across all subjects';
//   if (percentage >= 80) return 'Excellent achievement in academics';
//   if (percentage >= 70) return 'Very good performance, keep it up';
//   if (percentage >= 60) return 'Good effort, room for improvement';
//   if (percentage >= 50) return 'Satisfactory performance, need more focus';
//   if (percentage >= 40) return 'Passed, but significant improvement needed';
//   return 'Need to work harder and seek additional support';
// }

// const generateAttendanceCharts = (attendanceData) => {
//   // Prepare data for various charts
//   const charts = {
//     trendsOverTime: prepareTrendData(attendanceData),
//     classComparison: prepareClassComparisonData(attendanceData),
//     dayWisePatterns: prepareDayWisePatternData(attendanceData)
//   };

//   return charts;
// };

// const calculateGrade = (marks, totalMarks) => {
//   const percentage = (marks / totalMarks) * 100;
  
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








const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { cloudinary } = require('../config/cloudinary');

const adminController = {
  // ============ User Management ============
  createUser: async (req, res) => {
    try {
      const { name, email, password, role, profile } = req.body;
      if (!req.school) {
        return res.status(400).json({ error: 'No school associated with this admin' });
      }
      const schoolId = req.school._id; // Updated to use req.school from auth middleware
      const connection = req.connection; // Use school-specific connection
      const User = require('../models/User')(connection);

      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      // Generate hashed password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Set default permissions based on role
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

  // Get all users
  getUsers: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const users = await User.find({ school: schoolId })
        .select('-password')
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name')
        .populate('permissions.canEnterMarks.class', 'name division', Class);

      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get specific user
  getUser: async (req, res) => {
    try {
      const { userId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const user = await User.findOne({ _id: userId, school: schoolId })
        .select('-password')
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name')
        .populate('permissions.canEnterMarks.class', 'name division', Class);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAvailableClasses: async (req, res) => {
    try {
      if (!req.school) {
        return res.status(400).json({ error: 'No school associated with this user' });
      }
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = require('../models/Class')(connection);

      // Fetch classes that don't have a class teacher assigned
      const availableClasses = await Class.find({
        school: schoolId,
        $or: [
          { classTeacher: null },
          { classTeacher: { $exists: false } },
        ],
      })
        .select('name division academicYear')
        .sort({ name: 1, division: 1 });

      // Also fetch classes that have a class teacher for reference
      const assignedClasses = await Class.find({
        school: schoolId,
        classTeacher: { $exists: true, $ne: null },
      })
        .select('name division academicYear classTeacher')
        .populate('classTeacher', 'name')
        .sort({ name: 1, division: 1 });

      res.json({
        available: availableClasses,
        assigned: assignedClasses,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = require('../models/Subject')(connection);

      if (!classId || !schoolId) {
        return res.status(400).json({ error: 'Invalid classId or schoolId' });
      }

      const subjects = await Subject.find({
        school: schoolId,
        class: classId,
      }).select('name');

      if (!subjects) {
        return res.status(404).json({ error: 'No subjects found' });
      }

      res.json(subjects);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  createTeacher: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        name,
        email,
        password,
        phone,
        address,
        photo,
        teachingClass,
        selectedSubjects,
        classTeacherOf,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);

      // Basic validation
      if (!teachingClass || !selectedSubjects || !Array.isArray(selectedSubjects) || selectedSubjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please select a class and at least one subject for teaching',
        });
      }

      // Check if email exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered',
        });
      }

      // Validate subjects and check availability
      const subjects = await Subject.find({
        _id: { $in: selectedSubjects },
        class: teachingClass,
        school: schoolId,
      });

      // Check if all selected subjects exist
      if (subjects.length !== selectedSubjects.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more selected subjects are invalid for the chosen class',
        });
      }

      // Check if any selected subjects are already assigned
      const assignedSubjects = subjects.filter(subject =>
        subject.teachers && subject.teachers.length > 0
      );

      if (assignedSubjects.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot assign already assigned subjects: ${assignedSubjects.map(s => s.name).join(', ')}`,
          assignedSubjects: assignedSubjects.map(s => ({
            name: s.name,
            assignedTo: s.teachers[0].teacher,
          })),
        });
      }

      // Validate class teacher assignment if provided
      if (classTeacherOf) {
        const classTeacherData = await Class.findOne({
          _id: classTeacherOf,
          school: schoolId,
        });

        if (!classTeacherData) {
          return res.status(400).json({
            success: false,
            message: 'Selected class for class teacher role not found',
          });
        }

        if (classTeacherData.classTeacher) {
          return res.status(400).json({
            success: false,
            message: 'Selected class already has a class teacher assigned',
          });
        }
      }

      // Create user account
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Prepare permissions
      const permissions = {
        canTakeAttendance: classTeacherOf ? [classTeacherOf] : [],
        canEnterMarks: selectedSubjects.map(subjectId => ({
          class: teachingClass,
          subject: subjectId,
        })),
        canPublishAnnouncements: true,
        canManageInventory: false,
        canManageFees: false,
        canManageLibrary: false,
      };

      // Create teacher user
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

      // Create teacher assignment record
      const teacherAssignment = new TeacherAssignment({
        school: schoolId,
        teacher: teacher._id,
        classTeacherAssignment: classTeacherOf ? {
          class: classTeacherOf,
          assignedAt: new Date(),
        } : null,
        subjectAssignments: selectedSubjects.map(subjectId => ({
          class: teachingClass,
          subject: subjectId,
          assignedAt: new Date(),
        })),
        academicYear: getCurrentAcademicYear(),
      });

      await teacherAssignment.save({ session });

      // Update class if assigned as class teacher
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

      // Update all selected subjects
      await Promise.all(selectedSubjects.map(subjectId =>
        Subject.findByIdAndUpdate(
          subjectId,
          {
            $push: {
              teachers: {
                teacher: teacher._id,
                assignedAt: new Date(),
              },
            },
          },
          { session }
        )
      ));

      await session.commitTransaction();

      // Fetch populated data for response
      const populatedTeacher = await User.findById(teacher._id)
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name', Subject)
        .populate('permissions.canEnterMarks.class', 'name division', Class);

      const populatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject);

      res.status(201).json({
        success: true,
        teacher: populatedTeacher,
        assignment: populatedAssignment,
        message: 'Teacher created successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        success: false,
        message: 'Failed to create teacher',
        error: error.message,
      });
    } finally {
      session.endSession();
    }
  },

  updateTeacherAssignments: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { teacherId } = req.params;
      const {
        classTeacherOf, // New class ID for class teacher role
        removeClassTeacherRole, // Boolean to remove class teacher role
        addSubjectAssignments, // Array of {classId, subjectId} to add
        removeSubjectAssignments, // Array of {classId, subjectId} to remove
      } = req.body;
      const schoolId = req.school._id;
      const adminId = req.user._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);

      // Verify teacher exists
      const teacher = await User.findOne({
        _id: teacherId,
        school: schoolId,
        role: 'teacher',
      });

      if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }

      // Get current teacher assignment
      let teacherAssignment = await TeacherAssignment.findOne({
        teacher: teacherId,
        school: schoolId,
      });

      if (!teacherAssignment) {
        // Create new assignment record if it doesn't exist
        teacherAssignment = new TeacherAssignment({
          school: schoolId,
          teacher: teacherId,
          classTeacherAssignment: null,
          subjectAssignments: [],
          academicYear: getCurrentAcademicYear(),
        });
      }

      // HANDLE CLASS TEACHER ASSIGNMENT
      if (classTeacherOf) {
        // Validate the new class
        const newClass = await Class.findOne({
          _id: classTeacherOf,
          school: schoolId,
        });

        if (!newClass) {
          return res.status(400).json({ message: 'Class not found' });
        }

        // Check if the class already has a teacher assigned (that's not this teacher)
        if (newClass.classTeacher && newClass.classTeacher.toString() !== teacherId) {
          return res.status(400).json({
            message: 'This class already has a different class teacher assigned',
          });
        }

        // If teacher is already class teacher of a different class, remove that assignment
        if (
          teacherAssignment.classTeacherAssignment &&
          teacherAssignment.classTeacherAssignment.class &&
          teacherAssignment.classTeacherAssignment.class.toString() !== classTeacherOf
        ) {
          // Remove teacher from old class
          await Class.findByIdAndUpdate(
            teacherAssignment.classTeacherAssignment.class,
            {
              $unset: { classTeacher: '' },
              lastUpdated: new Date(),
              updatedBy: adminId,
            },
            { session }
          );

          // Update teacher's attendance permissions
          await User.findByIdAndUpdate(
            teacherId,
            {
              $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class },
            },
            { session }
          );
        }

        // Assign teacher to new class
        await Class.findByIdAndUpdate(
          classTeacherOf,
          {
            classTeacher: teacherId,
            lastUpdated: new Date(),
            updatedBy: adminId,
          },
          { session }
        );

        // Update teacher assignment record
        teacherAssignment.classTeacherAssignment = {
          class: classTeacherOf,
          assignedAt: new Date(),
        };

        // Update teacher's attendance permissions
        await User.findByIdAndUpdate(
          teacherId,
          {
            $addToSet: { 'permissions.canTakeAttendance': classTeacherOf },
          },
          { session }
        );
      }
      // Handle class teacher removal
      else if (removeClassTeacherRole && teacherAssignment.classTeacherAssignment) {
        // Remove teacher from class
        await Class.findByIdAndUpdate(
          teacherAssignment.classTeacherAssignment.class,
          {
            $unset: { classTeacher: '' },
            lastUpdated: new Date(),
            updatedBy: adminId,
          },
          { session }
        );

        // Update teacher's attendance permissions
        await User.findByIdAndUpdate(
          teacherId,
          {
            $pull: { 'permissions.canTakeAttendance': teacherAssignment.classTeacherAssignment.class },
          },
          { session }
        );

        // Remove from assignment record
        teacherAssignment.classTeacherAssignment = null;
      }

      // HANDLE SUBJECT TEACHER ASSIGNMENTS - ADDITIONS
      if (addSubjectAssignments?.length) {
        // Validate all new subject assignments
        const validationPromises = addSubjectAssignments.map(async ({ classId, subjectId }) => {
          const subject = await Subject.findOne({
            _id: subjectId,
            class: classId,
            school: schoolId,
          });

          if (!subject) {
            throw new Error(`Invalid subject assignment: Subject ${subjectId} for class ${classId}`);
          }

          return { classId, subjectId };
        });

        const validAssignments = await Promise.all(validationPromises);

        // Add new subject assignments
        for (const { classId, subjectId } of validAssignments) {
          // Check if assignment already exists
          const existingAssignment = teacherAssignment.subjectAssignments.find(
            a => a.class.toString() === classId && a.subject.toString() === subjectId
          );

          if (!existingAssignment) {
            // Add to teacher assignment record
            teacherAssignment.subjectAssignments.push({
              class: classId,
              subject: subjectId,
              assignedAt: new Date(),
            });

            // Add to subject's teachers
            await Subject.findByIdAndUpdate(
              subjectId,
              {
                $addToSet: {
                  teachers: {
                    teacher: teacherId,
                    assignedAt: new Date(),
                  },
                },
              },
              { session }
            );

            // Update teacher's mark-entry permissions
            await User.findByIdAndUpdate(
              teacherId,
              {
                $addToSet: {
                  'permissions.canEnterMarks': {
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

      // HANDLE SUBJECT TEACHER ASSIGNMENTS - REMOVALS
      if (removeSubjectAssignments?.length) {
        for (const { classId, subjectId } of removeSubjectAssignments) {
          // Remove from teacher assignment record
          teacherAssignment.subjectAssignments = teacherAssignment.subjectAssignments.filter(
            a => !(a.class.toString() === classId && a.subject.toString() === subjectId)
          );

          // Remove from subject's teachers
          await Subject.findByIdAndUpdate(
            subjectId,
            {
              $pull: {
                teachers: {
                  teacher: teacherId,
                },
              },
            },
            { session }
          );

          // Update teacher's mark-entry permissions
          await User.findByIdAndUpdate(
            teacherId,
            {
              $pull: {
                'permissions.canEnterMarks': {
                  class: classId,
                  subject: subjectId,
                },
              },
            },
            { session }
          );
        }
      }

      // Save all changes
      await teacherAssignment.save({ session });
      await session.commitTransaction();

      // Fetch fully populated data for response
      const updatedTeacher = await User.findById(teacherId)
        .populate('permissions.canTakeAttendance', 'name division', Class)
        .populate('permissions.canEnterMarks.subject', 'name', Subject)
        .populate('permissions.canEnterMarks.class', 'name division', Class);

      const updatedAssignment = await TeacherAssignment.findById(teacherAssignment._id)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject);

      res.json({
        teacher: updatedTeacher,
        assignment: updatedAssignment,
        message: 'Teacher assignments updated successfully',
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        error: error.message,
        message: 'Failed to update teacher assignments',
      });
    } finally {
      session.endSession();
    }
  },

  // adminController.js (Backend)
  getAssignableSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = require('../models/Subject')(connection);
      const User = require('../models/User')(connection);

      if (!classId || !schoolId) {
        return res.status(400).json({ error: 'Invalid classId or schoolId' });
      }

      // Fetch subjects for the given class and school
      const subjects = await Subject.find({
        school: schoolId,
        class: classId,
      })
        .select('name teachers')
        .populate('teachers.teacher', 'name email', User);

      if (!subjects || subjects.length === 0) {
        return res.status(404).json({ error: 'No subjects found for this class' });
      }

      // Transform subjects into the expected format
      const subjectsWithStatus = subjects.map((subject) => ({
        _id: subject._id.toString(), // Ensure _id is a string for frontend compatibility
        name: subject.name,
        isAssigned: subject.teachers && subject.teachers.length > 0,
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
        message: 'Subjects retrieved successfully',
      });
    } catch (error) {
      console.error('Error fetching assignable subjects:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },

  // Get all teacher assignments - useful for admin dashboard
  getAllTeacherAssignments: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);

      const assignments = await TeacherAssignment.find({ school: schoolId })
        .populate('teacher', 'name email profile', User)
        .populate('classTeacherAssignment.class', 'name division', Class)
        .populate('subjectAssignments.class', 'name division', Class)
        .populate('subjectAssignments.subject', 'name', Subject);

      const classAssignmentMap = {};
      const subjectAssignmentMap = {};

      // Organize data for easy reference
      assignments.forEach(assignment => {
        // Map class teachers
        if (assignment.classTeacherAssignment && assignment.classTeacherAssignment.class) {
          const classId = assignment.classTeacherAssignment.class._id.toString();
          classAssignmentMap[classId] = {
            teacher: {
              id: assignment.teacher._id,
              name: assignment.teacher.name,
              email: assignment.teacher.email,
            },
            assignedAt: assignment.classTeacherAssignment.assignedAt,
          };
        }

        // Map subject teachers
        assignment.subjectAssignments.forEach(subAssignment => {
          const classId = subAssignment.class._id.toString();
          const subjectId = subAssignment.subject._id.toString();
          const key = `${classId}:${subjectId}`;

          if (!subjectAssignmentMap[key]) {
            subjectAssignmentMap[key] = [];
          }

          subjectAssignmentMap[key].push({
            teacher: {
              id: assignment.teacher._id,
              name: assignment.teacher.name,
              email: assignment.teacher.email,
            },
            assignedAt: subAssignment.assignedAt,
          });
        });
      });

      res.json({
        raw: assignments,
        classTeachers: classAssignmentMap,
        subjectTeachers: subjectAssignmentMap,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getTeachers: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);

      // Get all teachers
      const teachers = await User.find({
        school: schoolId,
        role: 'teacher',
      })
        .select('-password')
        .lean(); // Using lean() for better performance with plain objects

      // Get all teacher assignments in one query
      const assignments = await TeacherAssignment.find({
        school: schoolId,
        teacher: { $in: teachers.map(t => t._id) },
      })
        .populate({
          path: 'classTeacherAssignment.class',
          select: 'name division',
          model: Class,
        })
        .populate({
          path: 'subjectAssignments.class',
          select: 'name division',
          model: Class,
        })
        .populate({
          path: 'subjectAssignments.subject',
          select: 'name',
          model: Subject,
        })
        .lean();

      // Get current classes where teachers are assigned
      const currentClasses = await Class.find({
        school: schoolId,
        classTeacher: { $in: teachers.map(t => t._id) },
      })
        .select('name division classTeacher')
        .lean();

      // Get current subjects where teachers are assigned
      const currentSubjects = await Subject.find({
        school: schoolId,
        'teachers.teacher': { $in: teachers.map(t => t._id) },
      })
        .select('name class teachers')
        .populate('class', 'name division', Class)
        .lean();

      // Create maps for quick lookups
      const classTeacherMap = new Map(
        currentClasses.map(c => [c.classTeacher.toString(), c])
      );

      const subjectTeacherMap = new Map();
      currentSubjects.forEach(subject => {
        subject.teachers.forEach(t => {
          const key = t.teacher.toString();
          if (!subjectTeacherMap.has(key)) {
            subjectTeacherMap.set(key, []);
          }
          subjectTeacherMap.get(key).push({
            subject: subject.name,
            class: subject.class,
          });
        });
      });

      // Combine all data
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

      res.json({
        success: true,
        data: teachersWithAssignments,
      });
    } catch (error) {
      console.error('Error in getTeachers:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Failed to fetch teachers data',
      });
    }
  },

  updateUserRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, permissions, classId, subjects } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);

      // If changing to teacher role with class assignments
      if (role === 'teacher' && (classId || subjects)) {
        // Call the more specific teacher assignment function
        req.body.teacherId = userId;
        req.body.assignmentType = classId ? 'classTeacher' : 'subjectTeacher';
        req.body.academicYear = getCurrentAcademicYear();
        return await assignTeacherRole(req, res);
      }

      // For other role changes
      const updatedPermissions = {
        ...getDefaultPermissions(role),
        ...permissions,
      };

      const user = await User.findByIdAndUpdate(
        userId,
        {
          role,
          permissions: updatedPermissions,
          'profile.lastRoleUpdate': new Date(),
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

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
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);
      const Syllabus = require('../models/Syllabus')(connection);

      const classExists = await Class.findOne({ _id: classId, school: schoolId });
      if (!classExists) {
        if (req.files?.length > 0) {
          req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
        }
        return res.status(404).json({ message: 'Class not found' });
      }

      const subject = await Subject.findOne({ _id: subjectId, class: classId, school: schoolId });
      if (!subject) {
        if (req.files?.length > 0) {
          req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
        }
        return res.status(404).json({ message: 'Subject not found in the specified class' });
      }

      const documents = req.files?.map(file => ({
        title: file.originalname,
        url: file.path,
        public_id: file.public_id,
        uploadedBy,
      })) || [];

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
        syllabus.content = content;
        if (documents.length > 0) {
          syllabus.documents = [...syllabus.documents, ...documents];
        }
      }

      await syllabus.save();
      subject.syllabus = syllabus._id;
      await subject.save();

      res.status(201).json(syllabus);
    } catch (error) {
      if (req.files?.length > 0) {
        req.files.forEach(file => cloudinary.uploader.destroy(file.public_id));
      }
      res.status(500).json({ error: error.message });
    }
  },

  createClass: async (req, res) => {
    try {
      const {
        name,
        division,
        capacity,
        // subjects,
        rteSeats,
        academicYear,
        schedule,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);
      const User = require('../models/User')(connection);

      // Check if a class with same name and division already exists for this school and academic year
      const existingClass = await Class.findOne({
        school: schoolId,
        name: name,
        division: division,
        academicYear: academicYear,
      });

      if (existingClass) {
        return res.status(400).json({
          error: `Class ${name} division ${division} already exists for academic year ${academicYear}`,
        });
      }

      // Check if a teacher is already assigned as class teacher for this class
      const existingTeacherAssignment = await TeacherAssignment.findOne({
        school: schoolId,
        class: null, // Will be updated after class creation
        assignmentType: 'classTeacher',
        academicYear: academicYear,
      });

      const newClass = new Class({
        school: schoolId,
        name,
        division,
        capacity,
        classTeacher: existingTeacherAssignment ? existingTeacherAssignment.teacher : null,
        // subjects,
        rteSeats,
        academicYear,
        schedule,
      });

      await newClass.save();

      // If there's a pending class teacher assignment, update it with the new class ID
      if (existingTeacherAssignment) {
        await TeacherAssignment.findByIdAndUpdate(
          existingTeacherAssignment._id,
          { class: newClass._id }
        );

        // Update teacher's permissions to include the new class
        await User.findByIdAndUpdate(
          existingTeacherAssignment.teacher,
          {
            $push: { 'permissions.canTakeAttendance': newClass._id },
          }
        );
      }

      // Populate the class teacher details before sending response
      const populatedClass = await Class.findById(newClass._id)
        .populate('classTeacher', 'name email profile', User);
      // .populate('subjects');

      res.status(201).json(populatedClass);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getClasses: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      const classes = await Class.find({ school: schoolId })
        .populate('classTeacher', 'name email profile', User)
        .populate('subjects', 'name')
        .sort({ name: 1, division: 1 });

      res.json(classes);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Subject Management ============
  createSubject: async (req, res) => {
    try {
      const { classId, name } = req.body;
      const schoolId = req.school._id; // School ID extracted from authenticated user
      const adminId = req.user._id;
      const connection = req.connection;
      const Class = require('../models/Class')(connection);
      const Subject = require('../models/Subject')(connection);

      // Validate if class exists and was created by this admin
      const classExists = await Class.findOne({
        _id: classId,
        school: schoolId,
      });

      if (!classExists) {
        return res.status(400).json({
          message: 'Invalid class selected. Please select a class you have created.',
        });
      }

      // Create subject with default values
      const subject = new Subject({
        school: schoolId,
        class: classId,
        name: name || 'Untitled Subject', // Use provided name or default
        teachers: [], // No teachers initially
        createdBy: adminId, // Track which admin created the subject
      });

      await subject.save();

      // Add subject to class
      await Class.findByIdAndUpdate(classId, {
        $push: { subjects: subject._id }, // Push ObjectId instead of object
      });

      res.status(201).json({
        message: 'Subject created successfully',
        subject: subject,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllSubjects: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Subject = require('../models/Subject')(connection);
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
      const Syllabus = require('../models/Syllabus')(connection);

      const subjects = await Subject.find({ school: schoolId })
        .populate('class', 'name division', Class)
        .populate('teachers.teacher', 'name email', User)
        .populate('syllabus', '', Syllabus)
        .sort({ 'class.name': 1, name: 1 });

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
      const Syllabus = require('../models/Syllabus')(connection);
      const Subject = require('../models/Subject')(connection);
      const Class = require('../models/Class')(connection);

      const syllabus = await Syllabus.findOne({
        subject: subjectId,
        school: schoolId,
      })
        .populate('subject', 'name', Subject)
        .populate('class', 'name division', Class);

      if (!syllabus) {
        return res.status(404).json({ message: 'Syllabus not found' });
      }

      if (syllabus.documents?.length > 0) {
        syllabus.documents = syllabus.documents.map(doc => {
          try {
            if (!doc.public_id) {
              throw new Error(`Missing public_id for document: ${doc.title}`);
            }

            // Extract file extension
            const fileExtension = doc.title.split('.').pop().toLowerCase();

            // Set proper content type
            const contentType = {
              'pdf': 'application/pdf',
              'doc': 'application/msword',
              'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
            }[fileExtension] || 'application/octet-stream';

            // Generate signed URL
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

            console.log(`Generated download URL for ${doc.title}: ${downloadUrl}`);

            return {
              ...doc.toObject(),
              downloadUrl,
              contentType,
            };
          } catch (error) {
            console.error(`Error generating URL for ${doc.title}:`, error);
            return {
              ...doc.toObject(),
              downloadUrl: null,
              contentType: 'application/octet-stream',
            };
          }
        });
      }

      res.json(syllabus);
    } catch (error) {
      console.error('Error in getSyllabus:', error);
      res.status(500).json({ error: error.message });
    }
  },

  assignTeacherRole: async (req, res) => {
    try {
      const { teacherId, classTeacherOf, subjectAssignments, academicYear } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      const TeacherAssignment = require('../models/TeacherAssignment')(connection);
      const Class = require('../models/Class')(connection);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Get the teacher to update
        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher') {
          return res.status(404).json({ message: 'Teacher not found' });
        }

        // Create or update teacher assignment
        let assignment = await TeacherAssignment.findOne({
          teacher: teacherId,
          academicYear,
        });

        const assignmentType = classTeacherOf ? 'classTeacher' : 'subjectTeacher';

        if (!assignment) {
          assignment = new TeacherAssignment({
            school: schoolId,
            teacher: teacherId,
            class: assignmentType === 'classTeacher' ? classTeacherOf : null,
            subjects: subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId })),
            assignmentType,
            academicYear,
          });
        } else {
          assignment.class = assignmentType === 'classTeacher' ? classTeacherOf : null;
          assignment.subjects = subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId }));
          assignment.assignmentType = assignmentType;
        }

        await assignment.save({ session });

        // Update teacher permissions
        let permissionUpdate = {
          ...teacher.permissions,
        };

        // Handle class teacher attendance permissions
        if (assignmentType === 'classTeacher') {
          // Add the new class to attendance permissions if not already there
          if (!permissionUpdate.canTakeAttendance.includes(classTeacherOf)) {
            permissionUpdate.canTakeAttendance.push(classTeacherOf);
          }

          // Update class document to set this teacher as class teacher
          await Class.findByIdAndUpdate(
            classTeacherOf,
            { classTeacher: teacherId },
            { session }
          );
        }

        // Update subject marks entry permissions
        const markEntryPermissions = subjectAssignments.map(s => ({
          class: s.classId,
          subject: s.subjectId,
        }));

        // Merge with existing permissions to avoid duplicates
        permissionUpdate.canEnterMarks = [
          ...new Map([
            ...permissionUpdate.canEnterMarks,
            ...markEntryPermissions,
          ].map(item => [
            `${item.class.toString()}-${item.subject.toString()}`,
            item,
          ])).values(),
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
          message: 'Teacher role and permissions updated successfully',
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

  // ============ Timetable Management ============
  generateTimetable: async (req, res) => {
    try {
      const { classId } = req.params;
      const { schedule, type, constraints } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Timetable = require('../models/Timetable')(connection);

      // Validate teacher availability
      const teacherConflicts = await checkTeacherConflicts(schedule);
      if (teacherConflicts.length > 0) {
        return res.status(400).json({
          error: 'Teacher scheduling conflicts detected',
          conflicts: teacherConflicts,
        });
      }

      // Generate optimized timetable
      const optimizedSchedule = optimizeSchedule(schedule, constraints);

      const timetable = new Timetable({
        school: schoolId, // Added schoolId
        class: classId,
        type, // 'regular', 'exam', 'substitute'
        schedule: optimizedSchedule,
      });

      await timetable.save();

      // Notify affected teachers (implement notifyTeachersAboutTimetable if needed)
      // await notifyTeachersAboutTimetable(timetable);

      res.status(201).json(timetable);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Attendance Management ============
  getAttendanceReport: async (req, res) => {
    try {
      const schoolId = req.school._id; // Updated from req.params
      const { startDate, endDate, type, classId, reportType } = req.query;
      const connection = req.connection;
      const Attendance = require('../models/Attendance')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const query = {
        school: schoolId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      };

      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate('user', 'name', User)
        .populate('class', 'name division', Class)
        .lean();

      // Generate comprehensive report
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

  // ============ Exam Management ============
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
      const Exam = require('../models/Exam')(connection);
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);

      // Get total students in the class
      const classDetails = await Class.findById(classId).populate('students', '', User);
      const totalStudents = classDetails.students.length;

      // Generate seating arrangement
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

      // Notify teachers and create exam schedule (implement if needed)
      // await createExamSchedule(exam);
      // await notifyExamCreation(exam);

      res.status(201).json(exam);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  reviewClassResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const schoolId = req.school._id; // Added schoolId filter
      const connection = req.connection;
      const ClassResult = require('../models/ClassResult')(connection);
      const Class = require('../models/Class')(connection);
      const User = require('../models/User')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);

      const classResults = await ClassResult.find({
        exam: examId,
        school: schoolId, // Added schoolId filter
        status: 'submitted',
      })
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
        });

      res.json(classResults);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Result Management ============
  publishResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const adminId = req.user._id;
      const schoolId = req.school._id; // Added schoolId filter
      const connection = req.connection;
      const ClassResult = require('../models/ClassResult')(connection);
      const Result = require('../models/Result')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const classResults = await ClassResult.find({
          exam: examId,
          school: schoolId, // Added schoolId filter
          status: 'submitted',
        }).populate('subjectMarks', '', SubjectMarks);

        // Generate report cards for each student
        for (const classResult of classResults) {
          const reportCards = await generateStudentReportCards(classResult);

          // Save report cards
          await Result.insertMany(reportCards, { session });

          // Update class result status
          classResult.status = 'published';
          classResult.publishedAt = new Date();
          classResult.publishedBy = adminId;
          await classResult.save({ session });
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

  createAnnouncement: async (req, res) => {
    try {
      const {
        title,
        content,
        targetGroups,
        priority,
        validFrom,
        validUntil,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);

      // Process uploaded files
      let attachments = [];
      if (req.files && req.files.length > 0) {
        attachments = req.files.map(file => ({
          fileName: file.originalname,
          fileUrl: file.path, // Cloudinary URL
          fileType: file.mimetype,
          fileSize: file.size,
          publicId: file.filename, // Store public ID for future management
        }));
      }

      const announcement = new Announcement({
        school: schoolId,
        title,
        content,
        targetGroups: JSON.parse(targetGroups), // Parse JSON if sent as string
        priority,
        validFrom,
        validUntil,
        attachments,
        createdBy: req.user._id,
      });

      await announcement.save();

      // You can implement notification logic here or comment it out
      // await notifyAnnouncementTargets(announcement);

      res.status(201).json(announcement);
    } catch (error) {
      // Handle file upload errors specifically
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${error.message}` });
      }
      res.status(500).json({ error: error.message });
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
        removeAttachments, // Array of attachment IDs to remove
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);

      const announcement = await Announcement.findById(id);

      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      // Check if user's school matches the announcement's school
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to update this announcement' });
      }

      // Process new uploaded files
      let newAttachments = [];
      if (req.files && req.files.length > 0) {
        newAttachments = req.files.map(file => ({
          fileName: file.originalname,
          fileUrl: file.path,
          fileType: file.mimetype,
          fileSize: file.size,
          publicId: file.filename,
        }));
      }

      // Handle attachment removal if specified
      let currentAttachments = announcement.attachments;
      if (removeAttachments && removeAttachments.length > 0) {
        const attachmentsToRemove = JSON.parse(removeAttachments);

        // Get public IDs of files to delete from Cloudinary
        const attachmentsToDelete = announcement.attachments
          .filter(attach => attachmentsToRemove.includes(attach._id.toString()))
          .map(attach => attach.publicId);

        // Delete from Cloudinary if there are files to remove
        if (attachmentsToDelete.length > 0) {
          for (const publicId of attachmentsToDelete) {
            await cloudinary.uploader.destroy(publicId);
          }
        }

        // Filter out removed attachments
        currentAttachments = announcement.attachments.filter(
          attach => !attachmentsToRemove.includes(attach._id.toString())
        );
      }

      // Update announcement with new values
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
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${error.message}` });
      }
      res.status(500).json({ error: error.message });
    }
  },

  deleteAnnouncement: async (req, res) => {
    try {
      const { id } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);

      const announcement = await Announcement.findById(id);

      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      // Check if user's school matches the announcement's school
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to delete this announcement' });
      }

      // Delete files from Cloudinary
      if (announcement.attachments && announcement.attachments.length > 0) {
        for (const attachment of announcement.attachments) {
          if (attachment.publicId) {
            await cloudinary.uploader.destroy(attachment.publicId);
          }
        }
      }

      await Announcement.findByIdAndDelete(id);

      res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all announcements (for admins to view)
  getAnnouncements: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);
      const User = require('../models/User')(connection);

      const announcements = await Announcement.find({ school: schoolId })
        .sort({ createdAt: -1 }) // Sort by newest first
        .populate('createdBy', 'name email', User); // Include creator information

      res.status(200).json(announcements);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get a single announcement by ID
  getAnnouncementById: async (req, res) => {
    try {
      const { id } = req.params;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Announcement = require('../models/Announcement')(connection);
      const User = require('../models/User')(connection);

      const announcement = await Announcement.findById(id)
        .populate('createdBy', 'name email', User);

      if (!announcement) {
        return res.status(404).json({ error: 'Announcement not found' });
      }

      // Check if user's school matches the announcement's school
      if (announcement.school.toString() !== schoolId.toString()) {
        return res.status(403).json({ error: 'Not authorized to view this announcement' });
      }

      res.status(200).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Trustee Management ============
  manageTrustee: async (req, res) => {
    try {
      const { trusteeId } = req.params;
      const { permissions, role } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const User = require('../models/User')(connection);
      // const TrusteeActivity = require('../models/TrusteeActivity')(connection);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update trustee permissions
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
        );

        if (!trustee) {
          throw new Error('Trustee not found');
        }

        // Log trustee activity (uncomment and implement TrusteeActivity model if needed)
        /*
        const activity = new TrusteeActivity({
          trustee: trusteeId,
          activity: 'role_update',
          details: `Role updated to ${role}`,
          timestamp: new Date(),
        });
        await activity.save({ session });
        */

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

  // ============ Meeting Management ============
  scheduleMeeting: async (req, res) => {
    try {
      const { title, date, type, agenda, attendees } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Meeting = require('../models/Meeting')(connection);

      const meeting = new Meeting({
        school: schoolId,
        title,
        date,
        type,
        agenda: agenda.map(item => ({
          ...item,
          duration: item.duration || 30,
        })),
        attendees: attendees.map(attendee => ({
          user: attendee,
          status: 'invited',
        })),
      });

      await meeting.save();

      // Send meeting invitations (implement notifyMeetingAttendees if needed)
      // await notifyMeetingAttendees(meeting);

      res.status(201).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Add to adminController
  recordMeetingMinutes: async (req, res) => {
    try {
      const { meetingId } = req.params;
      const { minutes, decisions, actionItems } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Meeting = require('../models/Meeting')(connection);

      const meeting = await Meeting.findOne({ _id: meetingId, school: schoolId });
      if (!meeting) {
        return res.status(404).json({ message: 'Meeting not found' });
      }

      meeting.minutes = minutes;
      meeting.decisions = decisions;
      meeting.actionItems = actionItems;
      meeting.status = 'completed';

      await meeting.save();

      // Notify attendees about meeting minutes (implement if needed)
      // await notifyMeetingAttendees(meeting, 'minutes_updated');

      res.status(200).json(meeting);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  //============ seating Arrangement===========
  generateSeatingArrangement: (totalStudents, availableRooms) => {
    const seatingArrangement = [];
    const studentsPerRoom = Math.ceil(totalStudents / availableRooms.length);

    availableRooms.forEach((room, index) => {
      const roomArrangement = {
        room: room.name,
        capacity: room.capacity,
        rows: [],
      };

      const studentsInThisRoom = index === availableRooms.length - 1
        ? totalStudents - (studentsPerRoom * index)
        : studentsPerRoom;

      // Create row-wise seating with gaps
      const seatsPerRow = room.seatsPerRow || 5;
      const totalRows = Math.ceil(studentsInThisRoom / seatsPerRow);

      for (let row = 0; row < totalRows; row++) {
        const rowSeats = [];
        for (let seat = 0; seat < seatsPerRow; seat++) {
          const studentNumber = row * seatsPerRow + seat;
          if (studentNumber < studentsInThisRoom) {
            // Alternate seats to maintain gap
            rowSeats.push({
              position: seat * 2, // Double the gap between seats
              occupied: true,
            });
          }
        }
        roomArrangement.rows.push(rowSeats);
      }

      seatingArrangement.push(roomArrangement);
    });

    return seatingArrangement;
  },

  //===== generate Attendance Report
  generateAttendanceReport: async (req, res) => {
    try {
      const schoolId = req.school._id;
      const { startDate, endDate, type, classId, reportType } = req.query;
      const connection = req.connection;
      const Attendance = require('../models/Attendance')(connection);
      const User = require('../models/User')(connection);
      const Class = require('../models/Class')(connection);

      const query = {
        school: schoolId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
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
      const {
        name,
        examType,
        startDate,
        endDate,
        classes,
        subjects,
        availableRooms,
        totalStudents,
      } = req.body;
      const schoolId = req.school._id;
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection);
      const SubjectMarks = require('../models/SubjectMarks')(connection);
      const User = require('../models/User')(connection);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create master exam schedule
        const examSchedule = new Exam({
          school: schoolId,
          name,
          examType,
          startDate,
          endDate,
          classes: classes.map(classId => ({
            class: classId,
            subjects: subjects.map(subject => ({
              subject: subject.id,
              date: subject.date,
              startTime: subject.startTime,
              endTime: subject.endTime,
              totalMarks: subject.totalMarks,
            })),
          })),
        });

        await examSchedule.save({ session });

        // Generate seating arrangements for each exam date
        const seatingArrangements = {};
        const uniqueDates = [...new Set(subjects.map(s => s.date))];

        for (const date of uniqueDates) {
          // Get total students appearing on this date
          const classesOnThisDate = classes.filter(c =>
            subjects.some(s => s.date === date && s.classes.includes(c))
          );

          const totalStudentsOnDate = await User.countDocuments({
            role: 'student',
            class: { $in: classesOnThisDate },
          });

          // Generate seating arrangement for this date
          seatingArrangements[date] = generateSeatingArrangement(
            totalStudentsOnDate,
            availableRooms
          );
        }

        // Update exam schedule with seating arrangements
        examSchedule.seatingArrangement = seatingArrangements; // Changed from seatingArrangements to match schema
        await examSchedule.save({ session });

        // Create subject-wise exam entries for mark entry
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

        res.status(201).json({
          examSchedule,
          seatingArrangements,
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

  // Enter exam results
  enterResults: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const { results } = req.body;
      const schoolId = req.school._id; // Added schoolId context
      const connection = req.connection;
      const Exam = require('../models/Exam')(connection); // Changed from ExamSchedule to Exam
      const Result = require('../models/Result')(connection);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Get exam schedule
        const examSchedule = await Exam.findById(examId);
        if (!examSchedule) {
          throw new Error('Exam schedule not found');
        }

        // Process results for each student
        const resultPromises = results.map(async (studentResult) => {
          const result = new Result({
            school: schoolId, // Added schoolId
            student: studentResult.studentId,
            exam: examId, // Changed from examSchedule to exam
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

  // Generate report cards
  generateReportCards: async (req, res) => {
    try {
      const { examId, classId } = req.params;
      const schoolId = req.school._id; // Added schoolId context
      const connection = req.connection;
      const Result = require('../models/Result')(connection);
      const Exam = require('../models/Exam')(connection); // Changed from ExamSchedule to Exam
      const User = require('../models/User')(connection);

      // Get all results for the exam and class
      const results = await Result.find({
        exam: examId, // Changed from examSchedule to exam
        class: classId,
        school: schoolId, // Added schoolId filter
      })
        .populate('student', 'name profile', User)
        .populate('exam', 'examType academicYear', Exam) // Changed from examSchedule to exam
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
  },
};

// Helper Functions
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
    // Add more role-based permissions
  }

  return permissions;
};

const checkTeacherConflicts = async (schedule) => {
  const conflicts = [];
  const teacherSchedule = {};

  schedule.forEach(slot => {
    const key = `${slot.day}-${slot.period}`;
    if (teacherSchedule[key]?.includes(slot.teacher)) {
      conflicts.push({
        teacher: slot.teacher,
        day: slot.day,
        period: slot.period,
      });
    } else {
      teacherSchedule[key] = teacherSchedule[key] || [];
      teacherSchedule[key].push(slot.teacher);
    }
  });

  return conflicts;
};

const optimizeSchedule = (schedule, constraints) => {
  const optimizedSchedule = [...schedule];

  // Sort subjects by priority/weight
  optimizedSchedule.sort((a, b) => {
    const weightA = constraints.subjectWeights[a.subject] || 1;
    const weightB = constraints.subjectWeights[b.subject] || 1;
    return weightB - weightA;
  });

  // Distribute heavy subjects across the week
  const daysPerWeek = 5;
  const periodsPerDay = 8;
  const distribution = Array(daysPerWeek).fill().map(() => Array(periodsPerDay).fill(null));

  optimizedSchedule.forEach(slot => {
    let placed = false;
    // Try to place subject in optimal time slot
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
  // Check if placement violates any constraints
  const { subjectWeights, consecutiveHeavySubjects, labRequirements } = constraints;

  // Don't place heavy subjects in last periods
  if (subjectWeights[slot.subject] > 2 && period > 5) {
    return false;
  }

  // Check lab requirements (implement isLabAvailable if needed)
  if (labRequirements.includes(slot.subject) /* && !isLabAvailable(day, period) */) {
    return false;
  }

  // Avoid consecutive heavy subjects
  if (period > 0 && isHeavySubject(slot.subject, subjectWeights)) {
    const previousSlot = distribution[day][period - 1];
    if (previousSlot && isHeavySubject(previousSlot.subject, subjectWeights)) {
      return false;
    }
  }

  return true;
};

const isHeavySubject = (subject, subjectWeights) => {
  return (subjectWeights[subject] || 1) > 2;
};

const generateSeatingArrangement = (students, availableRooms, totalStudents) => {
  const seatingArrangement = [];
  const studentsPerRoom = Math.ceil(totalStudents / availableRooms.length);

  // Shuffle students for random seating
  const shuffledStudents = shuffleArray([...students]);

  availableRooms.forEach((room, roomIndex) => {
    const startIndex = roomIndex * studentsPerRoom;
    const endIndex = Math.min(startIndex + studentsPerRoom, totalStudents);
    const roomStudents = shuffledStudents.slice(startIndex, endIndex);

    // Create alternating seating pattern
    const arrangement = [];
    const rows = Math.ceil(roomStudents.length / 5); // 5 students per row
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
      capacity: studentsPerRoom,
      arrangement,
    });
  });

  return seatingArrangement;
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

  // Group data by period (day/week/month)
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

    // Calculate percentage for the period
    const total = periodStats.present + periodStats.absent + periodStats.late;
    const percentage = total ? (periodStats.present / total) * 100 : 0;

    statistics.trendByPeriod.push({
      period: period[0].date,
      percentage,
    });
  });

  // Calculate overall percentage
  const total = statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
  statistics.percentagePresent = total ? (statistics.totalPresent / total) * 100 : 0;

  return statistics;
};

const generateDetailedAttendanceReport = (attendanceData, reportType) => {
  const report = {
    byClass: new Map(),
    byTeacher: new Map(),
    byDate: new Map(),
  };

  attendanceData.forEach(record => {
    // Class-wise analysis
    if (!report.byClass.has(record.class._id)) {
      report.byClass.set(record.class._id, {
        className: `${record.class.name}-${record.class.division}`,
        present: 0,
        absent: 0,
        late: 0,
      });
    }
    const classStats = report.byClass.get(record.class._id);
    classStats[record.status]++;

    // Teacher-wise analysis
    if (record.markedBy) {
      if (!report.byTeacher.has(record.markedBy)) {
        report.byTeacher.set(record.markedBy, {
          recordsMarked: 0,
          classes: new Set(),
        });
      }
      const teacherStats = report.byTeacher.get(record.markedBy);
      teacherStats.recordsMarked++;
      teacherStats.classes.add(record.class._id);
    }

    // Date-wise analysis
    const dateKey = record.date.toISOString().split('T')[0];
    if (!report.byDate.has(dateKey)) {
      report.byDate.set(dateKey, {
        present: 0,
        absent: 0,
        late: 0,
      });
    }
    const dateStats = report.byDate.get(dateKey);
    dateStats[record.status]++;
  });

  return {
    classWise: Array.from(report.byClass.entries()),
    teacherWise: Array.from(report.byTeacher.entries()),
    dateWise: Array.from(report.byDate.entries()),
  };
};

const generateAttendanceCharts = (attendanceData) => {
  // Prepare data for various charts
  const charts = {
    trendsOverTime: prepareTrendData(attendanceData),
    classComparison: prepareClassComparisonData(attendanceData),
    dayWisePatterns: prepareDayWisePatternData(attendanceData),
  };

  return charts;
};

const calculateGrade = (marks, totalMarks) => {
  let percentage;
  if (typeof marks === 'number') {
    percentage = (marks / totalMarks) * 100; // For single subject
  } else {
    percentage = calculatePercentage(marks); // For multiple subjects
  }

  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  return 'F';
};

// Utility functions
const shuffleArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const groupAttendanceByPeriod = (attendanceData, reportType) => {
  const grouped = new Map();

  attendanceData.forEach(record => {
    const periodKey = getPeriodKey(record.date, reportType);
    if (!grouped.has(periodKey)) {
      grouped.set(periodKey, []);
    }
    grouped.get(periodKey).push(record);
  });

  return Array.from(grouped.values());
};

const getPeriodKey = (date, reportType) => {
  const d = new Date(date);
  switch (reportType) {
    case 'daily':
      return d.toISOString().split('T')[0];
    case 'weekly':
      const week = getWeekNumber(d);
      return `${d.getFullYear()}-W${week}`;
    case 'monthly':
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    case 'yearly':
      return d.getFullYear().toString();
    default:
      return d.toISOString().split('T')[0];
  }
};



const getWeekNumber = (date) => {
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

  // Assuming academic year starts in July
  if (month < 6) { // Before July
    return `${year-1}-${year}`;
  } else { // July onwards
    return `${year}-${year+1}`;
  }
};

module.exports = adminController;








