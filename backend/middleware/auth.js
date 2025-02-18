// const jwt = require('jsonwebtoken');
// const config = require('../config/config');

// const auth = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization').replace('Bearer ', '');
//     const decoded = jwt.verify(token, config.jwtSecret);
    
//     const user = await User.findOne({ 
//       _id: decoded.userId,
//       'tokens.token': token 
//     });

//     if (!user) {
//       throw new Error();
//     }

//     req.token = token;
//     req.user = user;
//     next();
//   } catch (error) {
//     res.status(401).json({ error: 'Please authenticate' });
//   }
// };

// module.exports = auth;


const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Make sure to import User model

const auth = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    if (!req.header('Authorization')) {
      throw new Error('No Authorization header');
    }

    const token = req.header('Authorization').replace('Bearer ', '');
    
    // Use the same JWT_SECRET as used in authController
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Changed from config.jwtSecret
    
    // Remove the tokens field check since we're not storing tokens in user document
    const user = await User.findOne({ 
      _id: decoded.userId
    });

    if (!user) {
      throw new Error('User not found');
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ 
      error: 'Please authenticate',
      details: error.message // Adding error details for debugging
    });
  }
};

module.exports = auth;