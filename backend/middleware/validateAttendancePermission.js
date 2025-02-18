const User = require('../models/User');

const validateAttendancePermission = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user._id;
    
    // Check if teacher has permission to take attendance for this class
    const teacher = await User.findById(teacherId);
    
    if (!teacher || !teacher.permissions.canTakeAttendance.includes(classId)) {
      return res.status(403).json({
        message: 'You do not have permission to mark attendance for this class. Only assigned class teachers can mark attendance.'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = validateAttendancePermission;