// const User = require('../models/User');

// const validateAttendancePermission = async (req, res, next) => {
//   try {
//     const { classId } = req.params;
//     const teacherId = req.user._id;
    
//     // Check if teacher has permission to take attendance for this class
//     const teacher = await User.findById(teacherId);
    
//     if (!teacher || !teacher.permissions.canTakeAttendance.includes(classId)) {
//       return res.status(403).json({
//         message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.'
//       });
//     }
    
//     next();
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// module.exports = validateAttendancePermission;

const mongoose = require('mongoose');

const validateAttendancePermission = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user._id; // From auth middleware
    const schoolId = req.school._id.toString(); // From auth middleware
    const connection = req.connection; // Assuming connection is passed via middleware

    // Dynamically load the Class model with the connection
    const Class = require('../models/Class')(connection);

    // Check if the teacher is the class teacher for this class
    const classInfo = await Class.findOne({
      _id: classId,
      school: schoolId,
      classTeacher: teacherId,
    });

    if (!classInfo) {
      return res.status(403).json({
        message: 'You do not have permission to mark attendance for this class. Only the assigned class teacher can mark attendance.',
      });
    }

    // If validation passes, proceed to the controller
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validateAttendancePermission;