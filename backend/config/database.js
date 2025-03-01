// const mongoose = require('mongoose');

// const connections = {}; // Cache connections to avoid reconnecting

// const connectToDatabase = async (dbName) => {
//   if (connections[dbName]) {
//     return connections[dbName];
//   }

//   const uri = `${process.env.MONGODB_BASE_URI}${dbName}?retryWrites=true&w=majority&appName=Codeniche`;
//   const connection = await mongoose.createConnection(uri, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//   });

//   connections[dbName] = connection;
//   console.log(`Connected to database: ${dbName}`);
//   return connection;
// };

// const getOwnerConnection = async () => {
//   return connectToDatabase('owner_db');
// };

// module.exports = { connectToDatabase, getOwnerConnection };



// require('dotenv').config();
// const mongoose = require('mongoose');

// const connections = {}; // Cache connections to avoid reconnecting

// // Connect to a specific database
// const connectToDatabase = async (dbName) => {
//   if (connections[dbName]) {
//     console.log(`Reusing cached connection for: ${dbName}`);
//     return connections[dbName];
//   }

//   const uri = `${process.env.MONGODB_BASE_URI}${dbName}?retryWrites=true&w=majority&appName=Codeniche`;
//   const connection = await mongoose.createConnection(uri, {
//     connectTimeoutMS: 20000, // 20 seconds
//     serverSelectionTimeoutMS: 20000, // 20 seconds
//     socketTimeoutMS: 45000,
//   });

//   connections[dbName] = connection;
//   console.log(`Connected to database: ${dbName}`);
//   return connection;
// };

// // Get the owner database connection
// // const getOwnerConnection = async () => {
// //   return connectToDatabase('owner_db');
// // };

// const getOwnerConnection = async () => {
//     if (connections['owner_db']) {
//       return connections['owner_db'];
//     }
//     const uri = process.env.MONGODB_OWNER_URI;
//     const connection = await mongoose.createConnection(uri, {});
//     connections['owner_db'] = connection;
//     console.log('Connected to owner_db');
//     return connection;
//   };

// // Get a school's database connection based on schoolId
// const getSchoolConnection = async (schoolId) => {
//   const ownerConnection = await getOwnerConnection();
// //   const School = ownerConnection.model('School', require('../models/School').schema);
//   const School = require('../models/School').model(ownerConnection);
//   const school = await School.findById(schoolId);

//   if (!school || !school.dbName) {
//     throw new Error(`School not found or database name not configured for schoolId: ${schoolId}`);
//   }

//   return connectToDatabase(school.dbName);
// };

// module.exports = { connectToDatabase, getOwnerConnection, getSchoolConnection };



// require('dotenv').config();
// const mongoose = require('mongoose');

// const connections = {}; // Cache connections to avoid reconnecting

// const connectToDatabase = async (dbName) => {
//   if (connections[dbName]) {
//     console.log(`Reusing cached connection for: ${dbName}`);
//     return connections[dbName];
//   }

//   const uri = `${process.env.MONGODB_BASE_URI}${dbName}?retryWrites=true&w=majority&appName=Codeniche`;
//   console.log(`Attempting to connect to: ${uri}`);

//   try {
//     const connection = await mongoose.createConnection(uri, {
//       connectTimeoutMS: 30000, // Increase to 30 seconds
//       serverSelectionTimeoutMS: 30000, // Increase to 30 seconds
//       socketTimeoutMS: 60000, // Increase to 60 seconds
//       maxPoolSize: 50 // Allow more concurrent connections
      
//     });

//     connection.on('connected', () => console.log(`Mongoose connected to ${dbName}`));
//     connection.on('error', (err) => console.error(`Mongoose connection error for ${dbName}:`, err));

//     connections[dbName] = connection;
//     console.log(`Connected to database: ${dbName}`);
//     return connection;
//   } catch (error) {
//     console.error(`Failed to connect to ${dbName}:`, error.message);
//     throw error;
//   }
// };

// const getOwnerConnection = async () => {
//   if (connections['owner_db']) {
//     console.log('Reusing cached connection for owner_db');
//     return connections['owner_db'];
//   }

//   const uri = process.env.MONGODB_OWNER_URI;
//   console.log(`Attempting to connect to owner_db: ${uri}`);

//   try {
//     const connection = await mongoose.createConnection(uri, {
//       connectTimeoutMS: 30000,
//       serverSelectionTimeoutMS: 30000,
//       socketTimeoutMS: 60000,
//       maxPoolSize: 50
//     });

//     connection.on('connected', () => console.log('Mongoose connected to owner_db'));
//     connection.on('error', (err) => console.error('Mongoose connection error for owner_db:', err));

//     connections['owner_db'] = connection;
//     console.log('Connected to owner_db');
//     return connection;
//   } catch (error) {
//     console.error('Failed to connect to owner_db:', error.message);
//     throw error;
//   }
// };

// const getSchoolConnection = async (schoolId) => {
//   const ownerConnection = await getOwnerConnection();
//   const School = require('../models/School').model(ownerConnection);

//   try {
//     const school = await School.findById(schoolId);
//     if (!school || !school.dbName) {
//       throw new Error(`School not found or database name not configured for schoolId: ${schoolId}`);
//     }
//     return connectToDatabase(school.dbName);
//   } catch (error) {
//     console.error(`Error fetching school for ${schoolId}:`, error.message);
//     throw error;
//   }
// };

// module.exports = { connectToDatabase, getOwnerConnection, getSchoolConnection };


// database.js
require('dotenv').config();
const mongoose = require('mongoose');

const connections = {};

const initializeConnections = async () => {
  try {
    connections['owner_db'] = await mongoose.createConnection(process.env.MONGODB_OWNER_URI, {
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      maxPoolSize: 50,
      minPoolSize: 5,
    });

    connections['owner_db'].on('connected', () => console.log('Mongoose connected to owner_db'));
    connections['owner_db'].on('error', (err) => console.error('Mongoose error for owner_db:', err));

    // Wait for the connection to be fully established
    await new Promise(resolve => {
      connections['owner_db'].once('connected', resolve);
    });

    console.log('Owner DB connection initialized:', connections['owner_db'].name);
  } catch (error) {
    console.error('Failed to initialize connections:', error.message);
    throw error;
  }
};

const connectToDatabase = async (dbName) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  const uri = `${process.env.MONGODB_BASE_URI}${dbName}?retryWrites=true&w=majority&appName=Codeniche`;
  try {
    const connection = await mongoose.createConnection(uri, {
      connectTimeoutMS: 30000,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      maxPoolSize: 50,
      minPoolSize: 5,
    });

    connection.on('connected', () => console.log(`Mongoose connected to ${dbName}`));
    connection.on('error', (err) => console.error(`Mongoose error for ${dbName}:`, err));

    await new Promise(resolve => {
      connection.once('connected', resolve);
    });

    connections[dbName] = connection;
    console.log(`Connected to database ${dbName}:`, connection.name);
    return connection;
  } catch (error) {
    console.error(`Failed to connect to ${dbName}:`, error.message);
    throw error;
  }
};

const getOwnerConnection = () => {
  return connections['owner_db'];
};

const getSchoolConnection = async (schoolId) => {
  const ownerConnection = getOwnerConnection();
  const School = ownerConnection.model('School', require('../models/School')(ownerConnection).schema);

  try {
    const school = await School.findById(schoolId).lean();
    if (!school || !school.dbName) {
      throw new Error(`School not found or database name not configured for schoolId: ${schoolId}`);
    }
    return connectToDatabase(school.dbName);
  } catch (error) {
    console.error(`Error fetching school for ${schoolId}:`, error.message);
    throw error;
  }
};

module.exports = { initializeConnections, connectToDatabase, getOwnerConnection, getSchoolConnection };

