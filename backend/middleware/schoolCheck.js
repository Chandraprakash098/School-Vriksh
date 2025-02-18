const School = require('../models/School');

const schoolCheck = async (req, res, next) => {
  try {
    const { schoolId } = req.params;
    
    // Skip check for owner role
    if (req.user.role === 'owner') {
      return next();
    }

    // For other roles, verify school access
    if (req.user.school.toString() !== schoolId) {
      return res.status(403).json({
        error: 'Access denied: You do not have permission to access this school'
      });
    }

    // Verify school exists and is active
    const school = await School.findById(schoolId);
    if (!school || school.subscriptionStatus !== 'active') {
      return res.status(404).json({
        error: 'School not found or inactive'
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = schoolCheck;