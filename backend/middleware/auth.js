const jwt = require("jsonwebtoken");
const { getOwnerConnection, connectToDatabase } = require("../config/database");
const getModel = require("../models/index");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const ownerConnection = getOwnerConnection();

    if (!ownerConnection) {
      throw new Error("Owner database connection is not initialized");
    }

    let user, school;

    if (decoded.role === "owner") {
      user = await getModel("User", ownerConnection)
        .findOne({ _id: decoded.userId })
        .lean();
    } else {
      school = await getModel("School", ownerConnection)
        .findById(decoded.schoolId)
        .lean();
      if (!school || !school.dbName) {
        throw new Error("School not found for this user");
      }
      const schoolConnection = await connectToDatabase(school.dbName);
      user = await getModel("User", schoolConnection)
        .findOne({ _id: decoded.userId })
        .lean();
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (decoded.role === "owner" && decoded.schoolId) {
      school = await getModel("School", ownerConnection)
        .findById(decoded.schoolId)
        .lean();
    }

    if (!school && decoded.schoolId) {
      school = await getModel("School", ownerConnection)
        .findById(decoded.schoolId)
        .lean();
      if (!school) {
        throw new Error("School not found for the provided schoolId");
      }
    }

    req.user = user;
    req.school = school;
    req.token = token;

    const connection =
      decoded.role === "owner" && !school
        ? ownerConnection
        : await connectToDatabase(school.dbName);
    // Use req.dbConnection for study-materials route, req.connection for others
    if (req.path.includes("/study-material") || req.path.includes("/syllabus") || req.path.includes("/cover")) {
      req.dbConnection = connection;
    } else {
      req.connection = connection;
    }

    next();
  } catch (error) {
    console.error("Authentication Error:", error.message);
    res
      .status(401)
      .json({ error: "Authentication failed", details: error.message });
  }
};

module.exports = auth;
