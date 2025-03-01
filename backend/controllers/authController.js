// // authController.js
// const User = require('../models/User');
// const School = require('../models/School');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');

// const authController = {
//   // Owner Registration
//   registerOwner: async (req, res) => {
//     try {
//       const { name, email, password, profile } = req.body;

//       // Check if owner already exists
//       const existingOwner = await User.findOne({ email, role: 'owner' });
//       if (existingOwner) {
//         return res.status(400).json({ message: 'Owner already exists with this email' });
//       }

//       // Hash password
//       const hashedPassword = await bcrypt.hash(password, 10);

//       // Create owner
//       const owner = new User({
//         name,
//         email,
//         password: hashedPassword,
//         role: 'owner',
//         profile
//       });

//       await owner.save();

//       // Generate JWT token
//       const token = jwt.sign(
//         { userId: owner._id, role: owner.role },
//         process.env.JWT_SECRET,
//         { expiresIn: '24h' }
//       );

//       res.status(201).json({
//         message: 'Owner registered successfully',
//         owner: {
//           _id: owner._id,
//           name: owner.name,
//           email: owner.email,
//           role: owner.role
//         },
//         token
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Login for both Owner and Admin
//   login: async (req, res) => {
//     try {
//       const { email, password } = req.body;

//       // Find user
//       const user = await User.findOne({ email });
//       if (!user) {
//         return res.status(401).json({ message: 'Invalid credentials' });
//       }

//       // Verify password
//       const isPasswordValid = await bcrypt.compare(password, user.password);
//       if (!isPasswordValid) {
//         return res.status(401).json({ message: 'Invalid credentials' });
//       }

//       // Check if user is active
//       if (user.status !== 'active') {
//         return res.status(401).json({ message: 'Account is inactive' });
//       }

//       // Generate JWT token
//       const token = jwt.sign(
//         { userId: user._id, role: user.role },
//         process.env.JWT_SECRET,
//         { expiresIn: '24h' }
//       );

//       // If user is admin, fetch school details
//       let schoolDetails = null;
//       if (user.role === 'admin' && user.school) {
//         schoolDetails = await School.findById(user.school).select('name');
//       }

//       res.json({
//         user: {
//           _id: user._id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           school: schoolDetails
//         },
//         token
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };

// module.exports = authController;


const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getOwnerConnection, getSchoolConnection } = require('../config/database');
const getModel = require('../models/index')

const authController = {
  // Owner Registration
  registerOwner: async (req, res) => {
    try {
      const { name, email, password, profile } = req.body;

      // Use owner_db connection
      const ownerConnection = await getOwnerConnection();
      const User = require('../models/User')(ownerConnection);

      // Check if owner already exists
      const existingOwner = await User.findOne({ email, role: 'owner' });
      if (existingOwner) {
        return res.status(400).json({ message: 'Owner already exists with this email' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create owner
      const owner = new User({
        name,
        email,
        password: hashedPassword,
        role: 'owner',
        profile,
      });

      await owner.save();

      // Generate JWT token
      const token = jwt.sign(
        { userId: owner._id, role: owner.role }, // No schoolId for owner
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.status(201).json({
        message: 'Owner registered successfully',
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

  // Login for both Owner and Admin
//   login: async (req, res) => {
//     try {
//       const { email, password } = req.body;

//       // First, check if the user is an owner (in owner_db)
//       const ownerConnection = await getOwnerConnection();
//       const OwnerUser = require('../models/User')(ownerConnection);
//       let user = await OwnerUser.findOne({ email });

//       let schoolDetails = null;
//       let tokenPayload = {};

//       if (user) {
//         // Owner login
//         if (user.role !== 'owner') {
//           return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         // Verify password
//         const isPasswordValid = await bcrypt.compare(password, user.password);
//         if (!isPasswordValid) {
//           return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         // Check if user is active
//         if (user.status !== 'active') {
//           return res.status(401).json({ message: 'Account is inactive' });
//         }

//         tokenPayload = { userId: user._id, role: user.role }; // No schoolId for owner
//       } else {
//         // Not an owner, check school-specific databases
//         const ownerSchoolModel = ownerConnection.model('School', require('../models/School').schema);
//         const schools = await ownerSchoolModel.find({}); // Fetch all schools to find the user

//         for (const school of schools) {
//           const schoolConnection = await getSchoolConnection(school._id);
//           const SchoolUser = require('../models/User')(schoolConnection);

//           user = await SchoolUser.findOne({ email });
//           if (user) {
//             // Verify password
//             const isPasswordValid = await bcrypt.compare(password, user.password);
//             if (!isPasswordValid) {
//               return res.status(401).json({ message: 'Invalid credentials' });
//             }

//             // Check if user is active
//             if (user.status !== 'active') {
//               return res.status(401).json({ message: 'Account is inactive' });
//             }

//             // Fetch school details from owner_db
//             schoolDetails = await ownerSchoolModel.findById(user.school).select('name');
//             tokenPayload = { userId: user._id, role: user.role, schoolId: user.school };
//             break; // Found the user, exit loop
//           }
//         }

//         if (!user) {
//           return res.status(401).json({ message: 'Invalid credentials' });
//         }
//       }

//       // Generate JWT token
//       const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

//       res.json({
//         user: {
//           _id: user._id,
//           name: user.name,
//           email: user.email,
//           role: user.role,
//           school: schoolDetails,
//         },
//         token,
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },
// };

login: async (req, res) => {
  try {
    const { email, password } = req.body;

    const ownerConnection = await getOwnerConnection();
    const OwnerUser = getModel('User', ownerConnection); // Use getModel
    let user = await OwnerUser.findOne({ email });

    let schoolDetails = null;
    let tokenPayload = {};

    if (user) {
      if (user.role !== 'owner') {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.status !== 'active') {
        return res.status(401).json({ message: 'Account is inactive' });
      }

      tokenPayload = { userId: user._id, role: user.role };
    } else {
      // Use getModel for School
      const SchoolModel = getModel('School', ownerConnection);
      const schools = await SchoolModel.find({});

      for (const school of schools) {
        const schoolConnection = await getSchoolConnection(school._id);
        const SchoolUser = getModel('User', schoolConnection); // Use getModel

        user = await SchoolUser.findOne({ email });
        if (user) {
          const isPasswordValid = await bcrypt.compare(password, user.password);
          if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
          }

          if (user.status !== 'active') {
            return res.status(401).json({ message: 'Account is inactive' });
          }

          schoolDetails = await SchoolModel.findById(user.school).select('name');
          tokenPayload = { userId: user._id, role: user.role, schoolId: user.school };
          break;
        }
      }

      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

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
    res.status(500).json({ error: error.message });
  }
},
};

module.exports = authController;