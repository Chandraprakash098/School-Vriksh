// const jwt = require('jsonwebtoken');
// const User = require('../models/User'); // Make sure to import User model

// const auth = async (req, res, next) => {
//   try {
//     // Check if Authorization header exists
//     if (!req.header('Authorization')) {
//       throw new Error('No Authorization header');
//     }

//     const token = req.header('Authorization').replace('Bearer ', '');
    
//     // Use the same JWT_SECRET as used in authController
//     const decoded = jwt.verify(token, process.env.JWT_SECRET); // Changed from config.jwtSecret
    
//     // Remove the tokens field check since we're not storing tokens in user document
//     const user = await User.findOne({ 
//       _id: decoded.userId
//     });

//     if (!user) {
//       throw new Error('User not found');
//     }

//     req.token = token;
//     req.user = user;
//     next();
//   } catch (error) {
//     res.status(401).json({ 
//       error: 'Please authenticate',
//       details: error.message // Adding error details for debugging
//     });
//   }
// };

// module.exports = auth;


// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const auth = async (req, res, next) => {
//   try {
//     if (!req.header('Authorization')) {
//       throw new Error('No Authorization header');
//     }

//     const token = req.header('Authorization').replace('Bearer ', '');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     const user = await User.findOne({ 
//       _id: decoded.userId
//     });

//     if (!user) {
//       throw new Error('User not found');
//     }

//     // Add school ID to the request object
//     if (!user.school && user.role === 'admin') {
//       throw new Error('Admin user not associated with any school');
//     }

//     // Attach both user and school to the request object
//     req.user = user;
//     req.school = user.school;
//     req.token = token;
    
//     next();
//   } catch (error) {
//     res.status(401).json({ 
//       error: 'Please authenticate',
//       details: error.message
//     });
//   }
// };

// module.exports = auth;


const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No Authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findOne({ _id: decoded.userId }).populate('school');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.school) {
      return res.status(400).json({ error: 'User is not associated with any school' });
    }

    req.user = user;
    req.school = user.school;
    req.token = token;
    
    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    res.status(401).json({ error: 'Please authenticate', details: error.message });
  }
};

module.exports = auth;
