const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Syllabus = require('../models/Syllabus');
const TeacherAssignment = require('../models/TeacherAssignment');
const Timetable = require('../models/Timetable');
const Attendance = require('../models/Attendance');
const Exam = require('../models/Exam');
const Result = require('../models/Results');
const Announcement = require('../models/Announcement');
const Meeting = require('../models/Meeting');
// const TrusteeActivity = require('../models/TrusteeActivity');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');


const adminController = {
  // ============ User Management ============
  
  createUser: async (req, res) => {
    try {
      const { name, email, password, role, profile } = req.body;
      const schoolId = req.school; // Get school ID from logged-in admin

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
        permissions
      });

      await user.save();
      res.status(201).json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAvailableClasses: async (req, res) => {
    try {
      const schoolId =  req.school;
      
      // Fetch classes that don't have a class teacher assigned
      const availableClasses = await Class.find({
        school: schoolId,
        $or: [
          { classTeacher: null },
          { classTeacher: { $exists: false } }
        ]
      })
      .select('name division academicYear')
      .sort({ name: 1, division: 1 });

      // Also fetch classes that have a class teacher for reference
      const assignedClasses = await Class.find({
        school: schoolId,
        classTeacher: { $exists: true, $ne: null }
      })
      .select('name division academicYear classTeacher')
      .populate('classTeacher', 'name')
      .sort({ name: 1, division: 1 });

      res.json({
        available: availableClasses,
        assigned: assignedClasses
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSubjectsByClass: async (req, res) => {
    try {
      const { classId } = req.params;
      const schoolId =  req.school;
        
      if (!classId || !schoolId) {
        return res.status(400).json({ error: "Invalid classId or schoolId" });
      }

      const subjects = await Subject.find({
        school: schoolId,
        class: classId
      }).select('name');

      if (!subjects) {
        return res.status(404).json({ error: "No subjects found" });
      }

      res.json(subjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },

  createTeacher: async (req, res) => {
    try {
      const { 
        name, 
        email, 
        password, 
        phone, 
        address, 
        photo,
        classTeacherOf, // The class ID the teacher will be class teacher of
        subjectAssignments // Array of {classId, subjectId}
      } = req.body;
      const schoolId =  req.school;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: 'Email already registered' });
        }

        // If class teacher, validate class exists and is available
        if (classTeacherOf) {
          const classExists = await Class.findOne({
            _id: classTeacherOf,
            school: schoolId,
            $or: [
              { classTeacher: null },
              { classTeacher: { $exists: false } }
            ]
          });

          if (!classExists) {
            return res.status(400).json({ 
              message: 'Selected class is not available for assignment as class teacher' 
            });
          }
        }

        // Validate subject assignments
        if (subjectAssignments && subjectAssignments.length > 0) {
          for (const assignment of subjectAssignments) {
            const subject = await Subject.findOne({
              _id: assignment.subjectId,
              class: assignment.classId,
              school: schoolId
            });
            
            if (!subject) {
              return res.status(400).json({
                message: `Invalid subject assignment for class ${assignment.classId}`
              });
            }
          }
        }

        // Generate hashed password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Set up permissions based on role
        const permissions = {
          canTakeAttendance: classTeacherOf ? [classTeacherOf] : [], // Only class teacher can take attendance
          canEnterMarks: subjectAssignments.map(assignment => ({
            class: assignment.classId,
            subject: assignment.subjectId
          })),
          canPublishAnnouncements: true,
          canManageInventory: false,
          canManageFees: false,
          canManageLibrary: false
        };

        const teacher = new User({
          school: schoolId,
          name,
          email,
          password: hashedPassword,
          role: 'teacher',
          profile: {
            phone,
            address,
            photo
          },
          permissions
        });

        await teacher.save({ session });

        // Create teacher assignment
        const assignment = new TeacherAssignment({
          school: schoolId,
          teacher: teacher._id,
          class: classTeacherOf,
          subjects: subjectAssignments,
          assignmentType: classTeacherOf ? 'classTeacher' : 'subjectTeacher',
          academicYear: getCurrentAcademicYear()
        });

        await assignment.save({ session });

        // Update class if class teacher
        if (classTeacherOf) {
          await Class.findByIdAndUpdate(
            classTeacherOf,
            { 
              classTeacher: teacher._id,
              lastUpdated: new Date(),
              updatedBy: req.user._id
            },
            { session }
          );
        }

        // Update subjects with new teacher
        for (const assignment of subjectAssignments) {
          await Subject.findByIdAndUpdate(
            assignment.subjectId,
            {
              $push: {
                teachers: {
                  teacher: teacher._id,
                  assignedAt: new Date()
                }
              }
            },
            { session }
          );
        }

        await session.commitTransaction();

        const populatedTeacher = await User.findById(teacher._id)
          .populate({
            path: 'permissions.canTakeAttendance',
            select: 'name division'
          })
          .populate({
            path: 'permissions.canEnterMarks.subject',
            select: 'name'
          })
          .populate({
            path: 'permissions.canEnterMarks.class',
            select: 'name division'
          });

        res.status(201).json({ 
          teacher: populatedTeacher,
          assignment,
          message: 'Teacher created successfully with appropriate permissions'
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

  updateUserRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role, permissions, classId, subjects } = req.body;
      const schoolId =  req.school;
  
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
        ...permissions
      };
  
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          role,
          permissions: updatedPermissions,
          'profile.lastRoleUpdate': new Date()
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

  //======= Syllabys =======

  uploadSyllabus: async (req, res) => {
    try {
      const { classId, subjectId } = req.body;
      const { content } = req.body;
      const schoolId =  req.school;
      const uploadedBy = req.user._id;

      // Check if class exists
      const classExists = await Class.findOne({
        _id: classId,
        school: schoolId
      });
      
      if (!classExists) {
        // Delete uploaded files if class doesn't exist
        if (req.files && req.files.length > 0) {
          const { cloudinary } = require('../config/cloudinary');
          req.files.forEach(file => {
            cloudinary.uploader.destroy(file.public_id);
          });
        }
        return res.status(404).json({ message: 'Class not found' });
      }

      // Check if subject exists and belongs to the specified class
      const subject = await Subject.findOne({
        _id: subjectId,
        class: classId,
        school: schoolId
      });
      
      if (!subject) {
        // Delete uploaded files if subject doesn't exist
        if (req.files && req.files.length > 0) {
          const { cloudinary } = require('../config/cloudinary');
          req.files.forEach(file => {
            cloudinary.uploader.destroy(file.public_id);
          });
        }
        return res.status(404).json({ message: 'Subject not found in the specified class' });
      }

      // Process uploaded files
      const documents = [];
      if (req.files && req.files.length > 0) {
        req.files.forEach(file => {
          documents.push({
            title: file.originalname,
            url: file.path, // Cloudinary URL
            uploadedBy
          });
        });
      }

      // Create or update syllabus
      let syllabus = await Syllabus.findOne({ subject: subjectId });
      if (!syllabus) {
        syllabus = new Syllabus({
          school: schoolId,
          subject: subjectId,
          class: classId,
          content,
          documents
        });
      } else {
        // If updating, we might want to keep old documents and add new ones
        syllabus.content = content;
        
        // Append new documents to existing ones
        if (documents.length > 0) {
          syllabus.documents = [...syllabus.documents, ...documents];
        }
      }

      await syllabus.save();

      // Link syllabus to subject
      subject.syllabus = syllabus._id;
      await subject.save();

      res.status(201).json(syllabus);
    } catch (error) {
      // If error occurs, we should clean up uploaded files
      if (req.files && req.files.length > 0) {
        const { cloudinary } = require('../config/cloudinary');
        req.files.forEach(file => {
          cloudinary.uploader.destroy(file.public_id);
        });
      }
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Class Management ============
  createClass: async (req, res) => {
    try {
      const {
        name,
        division,
        capacity,
        classTeacher,
        subjects,
        rteSeats,
        academicYear,
        schedule
      } = req.body;
      const schoolId =  req.school;

      // Validate class teacher
      if (classTeacher) {
        const teacher = await User.findById(classTeacher);
        if (!teacher || teacher.role !== 'teacher') {
          return res.status(400).json({ message: 'Invalid class teacher' });
        }
      }

      const newClass = new Class({
        school: schoolId,
        name,
        division,
        capacity,
        classTeacher,
        subjects,
        rteSeats,
        academicYear,
        schedule
      });

      await newClass.save();

      // Update teacher's permissions for the new class if a class teacher is assigned
      if (classTeacher) {
        await User.findByIdAndUpdate(classTeacher, {
          $push: { 'permissions.canTakeAttendance': newClass._id }
        });
      }

      res.status(201).json(newClass);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Subject Management ============
  createSubject: async (req, res) => { 
    try { 
      const { classId, name } = req.body; 
      const schoolId =  req.school;  // School ID extracted from authenticated user
      const adminId = req.user._id;
      
      // Validate if class exists and was created by this admin
      const classExists = await Class.findOne({ 
        _id: classId, 
        school: schoolId,
      }); 

      if (!classExists) { 
        return res.status(400).json({ 
          message: "Invalid class selected. Please select a class you have created."
        }); 
      } 

      // Create subject with default values 
      const subject = new Subject({ 
        school: schoolId, 
        class: classId, 
        name: name || "Untitled Subject", // Use provided name or default
        teachers: [], // No teachers initially
        createdBy: adminId // Track which admin created the subject
      }); 

      await subject.save(); 

      // Add subject to class 
      await Class.findByIdAndUpdate(classId, { 
        $push: { 
          subjects: { 
            name: subject.name, 
            teacher: null, // No assigned teacher 
            syllabus: null 
          } 
        } 
      }); 

      res.status(201).json({
        message: "Subject created successfully",
        subject: subject
      }); 
    } catch (error) { 
      res.status(500).json({ error: error.message }); 
    } 
  },

  assignTeacherRole: async (req, res) => {
    try {
      const { teacherId, classTeacherOf, subjectAssignments, academicYear } = req.body;
      const schoolId =  req.school;
  
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
          academicYear 
        });
  
        const assignmentType = classTeacherOf ? 'classTeacher' : 'subjectTeacher';
        
        if (!assignment) {
          assignment = new TeacherAssignment({
            school: schoolId,
            teacher: teacherId,
            class: assignmentType === 'classTeacher' ? classTeacherOf : null,
            subjects: subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId })),
            assignmentType,
            academicYear
          });
        } else {
          assignment.class = assignmentType === 'classTeacher' ? classTeacherOf : null;
          assignment.subjects = subjectAssignments.map(s => ({ class: s.classId, subject: s.subjectId }));
          assignment.assignmentType = assignmentType;
        }
  
        await assignment.save({ session });
  
        // Update teacher permissions
        let permissionUpdate = {
          ...teacher.permissions
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
          subject: s.subjectId
        }));
        
        // Merge with existing permissions to avoid duplicates
        permissionUpdate.canEnterMarks = [
          ...new Map([
            ...permissionUpdate.canEnterMarks,
            ...markEntryPermissions
          ].map(item => [
            `${item.class.toString()}-${item.subject.toString()}`, item
          ])).values()
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
          message: 'Teacher role and permissions updated successfully'
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

      // Validate teacher availability
      const teacherConflicts = await checkTeacherConflicts(schedule);
      if (teacherConflicts.length > 0) {
        return res.status(400).json({
          error: 'Teacher scheduling conflicts detected',
          conflicts: teacherConflicts
        });
      }

      // Generate optimized timetable
      const optimizedSchedule = optimizeSchedule(schedule, constraints);

      const timetable = new Timetable({
        class: classId,
        type, // 'regular', 'exam', 'substitute'
        schedule: optimizedSchedule
      });

      await timetable.save();

      // Notify affected teachers
      await notifyTeachersAboutTimetable(timetable);

      res.status(201).json(timetable);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Attendance Management ============
  getAttendanceReport: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { startDate, endDate, type, classId, reportType } = req.query;

      const query = {
        school: schoolId,
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      if (type) query.type = type;
      if (classId) query.class = classId;

      const attendanceData = await Attendance.find(query)
        .populate('user', 'name')
        .populate('class', 'name division')
        .lean();

      // Generate comprehensive report
      const report = {
        summary: calculateAttendanceStatistics(attendanceData, reportType),
        details: generateDetailedAttendanceReport(attendanceData, reportType),
        charts: generateAttendanceCharts(attendanceData)
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
        availableRooms
      } = req.body;
      const schoolId  =  req.school;

      // Get total students in the class
      const classDetails = await Class.findById(classId).populate('students');
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
        seatingArrangement
      });

      await exam.save();

      // Notify teachers and create exam schedule
      await createExamSchedule(exam);
      await notifyExamCreation(exam);

      res.status(201).json(exam);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Result Management ============
  publishResults: async (req, res) => {
    try {
      const { examId } = req.params;
      const { results } = req.body;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update exam results
        const exam = await Exam.findByIdAndUpdate(
          examId,
          { results },
          { new: true, session }
        );

        // Generate and save individual result documents
        const resultPromises = results.map(async (studentResult) => {
          const result = new Result({
            school: exam.school,
            student: studentResult.student,
            exam: examId,
            marks: studentResult.marks,
            grade: calculateGrade(studentResult.marks, exam.totalMarks),
            remarks: studentResult.remarks,
            publishedBy: req.user._id
          });
          return result.save({ session });
        });

        await Promise.all(resultPromises);

        // Generate report cards
        await generateReportCards(examId, session);

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

  // ============ Announcement Management ============
  createAnnouncement: async (req, res) => {
    try {
      const {
        title,
        content,
        targetGroups,
        priority,
        validFrom,
        validUntil,
        attachments
      } = req.body;
      const { schoolId } = req.params;

      const announcement = new Announcement({
        school: schoolId,
        title,
        content,
        targetGroups,
        priority,
        validFrom,
        validUntil,
        attachments,
        createdBy: req.user._id
      });

      await announcement.save();

      // Send notifications to target groups
      await notifyAnnouncementTargets(announcement);

      res.status(201).json(announcement);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ============ Trustee Management ============
  manageTrustee: async (req, res) => {
    try {
      const { trusteeId } = req.params;
      const { permissions, role } = req.body;

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
              canAccessHrDocs: role === 'hr_trustee'
            }
          },
          { new: true, session }
        );

        // Log trustee activity
        const activity = new TrusteeActivity({
          trustee: trusteeId,
          activity: 'role_update',
          details: `Role updated to ${role}`,
          timestamp: new Date()
        });

        await activity.save({ session });
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
      const schoolId  =  req.school;

      const meeting = new Meeting({
        school: schoolId,
        title,
        date,
        type,
        agenda: agenda.map(item => ({
          ...item,
          duration: item.duration || 30
        })),
        attendees: attendees.map(attendee => ({
          user: attendee,
          status: 'invited'
        }))
      });

      await meeting.save();

      // Send meeting invitations
      await notifyMeetingAttendees(meeting);

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

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.minutes = minutes;
    meeting.decisions = decisions;
    meeting.actionItems = actionItems;
    meeting.status = 'completed';

    await meeting.save();

    // Notify attendees about meeting minutes
    await notifyMeetingAttendees(meeting, 'minutes_updated');

    res.status(200).json(meeting);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},


//============ seating Arrangemnt===========


// Add to adminController
generateSeatingArrangement: async (req, res) => {
  try {
    const { examId } = req.params;
    const { availableRooms } = req.body;

    const exam = await Exam.findById(examId).populate('class');
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const students = exam.class.students;
    const seatingArrangement = generateSeatingArrangement(students, availableRooms, students.length);

    exam.seatingArrangement = seatingArrangement;
    await exam.save();

    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
},


//===== generate Attendace Report

// Add to adminController
generateAttendanceReport: async (req, res) => {
  try {
    const schoolId  =  req.school;
    const { startDate, endDate, type, classId, reportType } = req.query;

    const query = {
      school: schoolId,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    if (type) query.type = type;
    if (classId) query.class = classId;

    const attendanceData = await Attendance.find(query)
      .populate('user', 'name')
      .populate('class', 'name division')
      .lean();

    const report = {
      summary: calculateAttendanceStatistics(attendanceData, reportType),
      details: generateDetailedAttendanceReport(attendanceData, reportType),
      charts: generateAttendanceCharts(attendanceData)
    };

    res.json(report);
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
    canManageLibrary: false
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
        period: slot.period
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

  // Check lab requirements
  if (labRequirements.includes(slot.subject) && !isLabAvailable(day, period)) {
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
          position: pos + 1
        }))
      });
    }

    seatingArrangement.push({
      classroom: room,
      capacity: studentsPerRoom,
      arrangement
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
    studentWiseAnalysis: new Map()
  };

  // Group data by period (day/week/month)
  const groupedData = groupAttendanceByPeriod(attendanceData, reportType);

  groupedData.forEach(period => {
    const periodStats = {
      present: period.filter(a => a.status === 'present').length,
      absent: period.filter(a => a.status === 'absent').length,
      late: period.filter(a => a.status === 'late').length
    };

    statistics.totalPresent += periodStats.present;
    statistics.totalAbsent += periodStats.absent;
    statistics.totalLate += periodStats.late;

    // Calculate percentage for the period
    const total = periodStats.present + periodStats.absent + periodStats.late;
    const percentage = (periodStats.present / total) * 100;

    statistics.trendByPeriod.push({
      period: period[0].date,
      percentage
    });
  });

  // Calculate overall percentage
  const total = statistics.totalPresent + statistics.totalAbsent + statistics.totalLate;
  statistics.percentagePresent = (statistics.totalPresent / total) * 100;

  return statistics;
};

const generateDetailedAttendanceReport = (attendanceData, reportType) => {
  const report = {
    byClass: new Map(),
    byTeacher: new Map(),
    byDate: new Map()
  };

  attendanceData.forEach(record => {
    // Class-wise analysis
    if (!report.byClass.has(record.class._id)) {
      report.byClass.set(record.class._id, {
        className: `${record.class.name}-${record.class.division}`,
        present: 0,
        absent: 0,
        late: 0
      });
    }
    const classStats = report.byClass.get(record.class._id);
    classStats[record.status]++;

    // Teacher-wise analysis
    if (record.markedBy) {
      if (!report.byTeacher.has(record.markedBy)) {
        report.byTeacher.set(record.markedBy, {
          recordsMarked: 0,
          classes: new Set()
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
        late: 0
      });
    }
    const dateStats = report.byDate.get(dateKey);
    dateStats[record.status]++;
  });

  return {
    classWise: Array.from(report.byClass.entries()),
    teacherWise: Array.from(report.byTeacher.entries()),
    dateWise: Array.from(report.byDate.entries())
  };
};

const generateAttendanceCharts = (attendanceData) => {
  // Prepare data for various charts
  const charts = {
    trendsOverTime: prepareTrendData(attendanceData),
    classComparison: prepareClassComparisonData(attendanceData),
    dayWisePatterns: prepareDayWisePatternData(attendanceData)
  };

  return charts;
};

const calculateGrade = (marks, totalMarks) => {
  const percentage = (marks / totalMarks) * 100;
  
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