// Add to middleware folder (e.g., checkTeacherPermissions.js)
const checkTeacherPermissions = async (req, res, next) => {
    const { classId } = req.params;
    const teacherId = req.user._id;
  
    const teacher = await User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
  
    const hasPermission = teacher.permissions.canTakeAttendance.includes(classId);
    if (!hasPermission) {
      return res.status(403).json({ message: 'You do not have permission to perform this action' });
    }
  
    next();
  };
  
  module.exports = checkTeacherPermissions;