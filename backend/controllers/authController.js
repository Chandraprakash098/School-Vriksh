const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const {
  getOwnerConnection,
  getSchoolConnection,
} = require("../config/database");
const getModel = require("../models/index");

const authController = {
  registerOwner: async (req, res) => {
    try {
      const { name, email, password, profile } = req.body;

      const ownerConnection = await getOwnerConnection();
      const User = require("../models/User")(ownerConnection);

      const existingOwner = await User.findOne({ email, role: "owner" });
      if (existingOwner) {
        return res
          .status(400)
          .json({ message: "Owner already exists with this email" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const owner = new User({
        name,
        email,
        password: hashedPassword,
        role: "owner",
        profile,
      });

      await owner.save();

      const token = jwt.sign(
        { userId: owner._id, role: owner.role },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.status(201).json({
        message: "Owner registered successfully",
        owner: {
          _id: owner._id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
        },
        token,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      const ownerConnection = await getOwnerConnection();
      const OwnerUser = require("../models/User")(ownerConnection);
      let user = await OwnerUser.findOne({ email });

      let schoolDetails = null;
      let tokenPayload = {};

      if (user) {
        if (user.role !== "owner") {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        if (user.status !== "active") {
          return res.status(401).json({ message: "Account is inactive" });
        }

        tokenPayload = { userId: user._id, role: user.role };
      } else {
        const School = require("../models/School");
        const ownerSchoolModel = ownerConnection.model(
          "School",
          School.schema || School(ownerConnection).schema
        );

        const schools = await ownerSchoolModel.find({});

        for (const school of schools) {
          const schoolConnection = await getSchoolConnection(school._id);
          const SchoolUser = require("../models/User")(schoolConnection);

          user = await SchoolUser.findOne({ email });
          if (user) {
            const isPasswordValid = await bcrypt.compare(
              password,
              user.password
            );
            if (!isPasswordValid) {
              return res.status(401).json({ message: "Invalid credentials" });
            }

            if (user.status !== "active") {
              return res.status(401).json({ message: "Account is inactive" });
            }

            schoolDetails = await ownerSchoolModel
              .findById(user.school)
              .select("name");
            tokenPayload = {
              userId: user._id,
              role: user.role,
              schoolId: user.school,
            };
            break;
          }
        }

        if (!user) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }

      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
        expiresIn: "24h",
      });

      res.json({
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          school: schoolDetails,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = authController;
