const logger = require("../utils/logger");

const checkRTEExemption = async (student, connection) => {
  try {
    const UserModel = require("../models/User")(connection);
    const studentData = await UserModel.findById(student._id).select(
      "studentDetails.isRTE"
    );
    const isRTE = studentData?.studentDetails?.isRTE || false;
    logger.info(`RTE check for student ${student._id}: ${isRTE}`);
    return isRTE;
  } catch (error) {
    logger.error(`Error checking RTE exemption: ${error.message}`, { error });
    throw error;
  }
};

module.exports = { checkRTEExemption };