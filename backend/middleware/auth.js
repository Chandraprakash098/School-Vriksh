


// const jwt = require('jsonwebtoken');
// const User = require('../models/User');

// const auth = async (req, res, next) => {
//   try {
//     const authHeader = req.header('Authorization');
//     if (!authHeader) {
//       return res.status(401).json({ error: 'No Authorization header provided' });
//     }

//     const token = authHeader.replace('Bearer ', '');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
//     const user = await User.findOne({ _id: decoded.userId }).populate('school');

//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     if (!user.school) {
//       return res.status(400).json({ error: 'User is not associated with any school' });
//     }

//     req.user = user;
//     req.school = user.school;
//     req.token = token;
    
//     next();
//   } catch (error) {
//     console.error('Authentication Error:', error.message);
//     res.status(401).json({ error: 'Please authenticate', details: error.message });
//   }
// };

// module.exports = auth;




// const jwt = require('jsonwebtoken');
// const { connectToDatabase, getOwnerConnection } = require('../db');
// const SchoolModel = require('../models/School');

// const auth = async (req, res, next) => {
//   try {
//     const authHeader = req.header('Authorization');
//     if (!authHeader) {
//       return res.status(401).json({ error: 'No Authorization header provided' });
//     }

//     const token = authHeader.replace('Bearer ', '');
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     let connection, UserModel;

//     if (decoded.role === 'owner') {
//       // Owner uses the central database
//       connection = await getOwnerConnection();
//       UserModel = require('../models/User')(connection);
//     } else {
//       // Fetch school details from owner_db to get dbName
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);
//       const userSchool = await School.findById(decoded.schoolId);

//       if (!userSchool || !userSchool.dbName) {
//         return res.status(400).json({ error: 'User is not associated with any school' });
//       }

//       // Connect to the school's database
//       connection = await connectToDatabase(userSchool.dbName);
//       UserModel = require('../models/User')(connection);
//     }

//     const user = await UserModel.findOne({ _id: decoded.userId });
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     req.user = user;
//     req.connection = connection; // Pass connection to controllers
//     req.token = token;

//     if (user.role !== 'owner') {
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);
//       req.school = await School.findById(user.school);
//     } else {
//       req.school = null;
//     }

//     next();
//   } catch (error) {
//     console.error('Authentication Error:', error.message);
//     res.status(401).json({ error: 'Please authenticate', details: error.message });
//   }
// };

// module.exports = auth;



// const jwt = require('jsonwebtoken');
// const { connectToDatabase, getOwnerConnection, getSchoolConnection } = require('../config/database');



// const auth = async (req, res, next) => {
//   try {
//     const token = req.header('Authorization')?.replace('Bearer ', '');
//     if (!token) {
//       return res.status(401).json({ error: 'No Authorization header provided' });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     console.log('Decoded JWT:', decoded); // Log the decoded token

//     let connection, UserModel;
//     if (decoded.role === 'owner') {
//       connection = await getOwnerConnection();
//       UserModel = require('../models/User')(connection);
//     } else {
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);
//       const userSchool = await School.findById(decoded.schoolId);
//       console.log('User School:', userSchool); // Log the school lookup result

//       if (!userSchool || !userSchool.dbName) {
//         return res.status(400).json({ error: 'User is not associated with any school' });
//       }

//       connection = await connectToDatabase(userSchool.dbName);
//       UserModel = require('../models/User')(connection);
//     }

//     const user = await UserModel.findOne({ _id: decoded.userId });
//     console.log('User:', user); // Log the user
//     if (!user) {
//       return res.status(404).json({ error: 'User not found' });
//     }

//     req.user = user;
//     req.connection = connection;
//     req.token = token;

//     if (user.role !== 'owner') {
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);
//       req.school = await School.findById(user.schoolId);
//       console.log('req.school:', req.school); // Log req.school
//     } else {
//       req.school = null;
//     }

//     next();
//   } catch (error) {
//     console.error('Authentication Error:', error.message);
//     res.status(401).json({ error: 'Please authenticate', details: error.message });
//   }
// };


// module.exports = auth;



const jwt = require('jsonwebtoken');
const { connectToDatabase, getOwnerConnection } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({ error: 'No Authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded JWT:', decoded);

    let connection, UserModel;

    if (decoded.role === 'owner') {
      connection = await getOwnerConnection();
      UserModel = require('../models/User')(connection);
    } else {
      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);
      const userSchool = await School.findById(decoded.schoolId);
      console.log('User School from decoded.schoolId:', userSchool);

      if (!userSchool || !userSchool.dbName) {
        return res.status(400).json({ error: 'User is not associated with any school' });
      }

      connection = await connectToDatabase(userSchool.dbName);
      UserModel = require('../models/User')(connection);
    }

    const user = await UserModel.findOne({ _id: decoded.userId });
    console.log('User:', user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.user = user;
    req.connection = connection;
    req.token = token;

    // Set req.school only if not owner
    if (user.role !== 'owner') {
      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);
      req.school = await School.findById(user.school); // Use user.school instead of decoded.schoolId
      console.log('req.school after assignment:', req.school);
      if (!req.school) {
        return res.status(400).json({ error: 'School not found for user' });
      }
    } else {
      req.school = null;
    }

    next();
  } catch (error) {
    console.error('Authentication Error:', error.message);
    res.status(401).json({ error: 'Please authenticate', details: error.message });
  }
};

module.exports = auth;