const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const {
  getOwnerConnection,
  getSchoolConnection,
} = require("../config/database");
const getModel = require("../models/index");

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

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

  // login: async (req, res) => {
  //   try {
  //     const { email, password } = req.body;

  //     const ownerConnection = await getOwnerConnection();
  //     const OwnerUser = require("../models/User")(ownerConnection);
  //     let user = await OwnerUser.findOne({ email });

  //     let schoolDetails = null;
  //     let tokenPayload = {};

  //     if (user) {
  //       if (user.role !== "owner") {
  //         return res.status(401).json({ message: "Invalid credentials" });
  //       }

  //       const isPasswordValid = await bcrypt.compare(password, user.password);
  //       if (!isPasswordValid) {
  //         return res.status(401).json({ message: "Invalid credentials" });
  //       }

  //       if (user.status !== "active") {
  //         return res.status(401).json({ message: "Account is inactive" });
  //       }

  //       tokenPayload = { userId: user._id, role: user.role };
  //     } else {
  //       const School = require("../models/School");
  //       const ownerSchoolModel = ownerConnection.model(
  //         "School",
  //         School.schema || School(ownerConnection).schema
  //       );

  //       const schools = await ownerSchoolModel.find({});

  //       for (const school of schools) {
  //         const schoolConnection = await getSchoolConnection(school._id);
  //         const SchoolUser = require("../models/User")(schoolConnection);

  //         user = await SchoolUser.findOne({ email });
  //         if (user) {
  //           const isPasswordValid = await bcrypt.compare(
  //             password,
  //             user.password
  //           );
  //           if (!isPasswordValid) {
  //             return res.status(401).json({ message: "Invalid credentials" });
  //           }

  //           if (user.status !== "active") {
  //             return res.status(401).json({ message: "Account is inactive" });
  //           }

  //           schoolDetails = await ownerSchoolModel
  //             .findById(user.school)
  //             .select("name");
  //           tokenPayload = {
  //             userId: user._id,
  //             role: user.role,
  //             schoolId: user.school,
  //           };
  //           break;
  //         }
  //       }

  //       if (!user) {
  //         return res.status(401).json({ message: "Invalid credentials" });
  //       }
  //     }

  //     const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
  //       expiresIn: "24h",
  //     });

  //     res.json({
  //       user: {
  //         _id: user._id,
  //         name: user.name,
  //         email: user.email,
  //         role: user.role,
  //         school: schoolDetails,
  //       },
  //       token,
  //     });
  //   } catch (error) {
  //     console.error("Login error:", error);
  //     res.status(500).json({ error: error.message });
  //   }
  // },


 login: async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const ownerConnection = await getOwnerConnection();
    const OwnerUser = require("../models/User")(ownerConnection);
    let user = await OwnerUser.findOne({ email });

    let schoolDetails = null;
    let tokenPayload = {};

    if (user) {
      // Handle owner user
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
      // Handle school-specific users (student, parent, teacher, etc.)
      const School = require("../models/School");
      const ownerSchoolModel = ownerConnection.model(
        "School",
        School.schema || School(ownerConnection).schema
      );

      const schools = await ownerSchoolModel.find({});

      for (const school of schools) {
        const schoolConnection = await getSchoolConnection(school._id);
        const SchoolUser = require("../models/User")(schoolConnection);

        // Include password and children (for parents) in the query
        user = await SchoolUser.findOne({ email })
          .select("name email role school status password studentDetails.children")
          .populate("studentDetails.children", "_id name");

        if (user) {
          const isPasswordValid = await bcrypt.compare(password, user.password);
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
        children: user.role === "parent" ? user.studentDetails?.children || null : null,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message });
  }
},


  forgetPassword: async (req, res) => {
    try {
      const { email } = req.body;

      const ownerConnection = await getOwnerConnection();
      const OwnerUser = require("../models/User")(ownerConnection);
      let user = await OwnerUser.findOne({ email });

      let connection = ownerConnection;
      let schoolId = null;

      if (!user) {
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
            connection = schoolConnection;
            schoolId = school._id;
            break;
          }
        }
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const OTPModel = require("../models/otpModel")(connection);
      const otp = generateOTP();

      await OTPModel.create({ email, otp });

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP for password reset is: ${otp}. It is valid for 5 minutes.`,
      };

      await transporter.sendMail(mailOptions);

      res.json({
        message: "OTP sent to your email",
        schoolId, // Include schoolId for non-owner users to use in resetPassword
      });
    } catch (error) {
      console.error("Forget Password error:", error);
      res.status(500).json({ error: error.message });
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword, schoolId } = req.body;

      let connection;
      if (schoolId) {
        connection = await getSchoolConnection(schoolId);
      } else {
        connection = await getOwnerConnection();
      }

      const OTPModel = require("../models/otpModel")(connection);
      const User = require("../models/User")(connection);

      const otpRecord = await OTPModel.findOne({ email, otp });
      if (!otpRecord) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }

      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      await OTPModel.deleteOne({ email, otp });

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset Password error:", error);
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = authController;
