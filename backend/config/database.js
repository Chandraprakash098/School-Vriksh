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



require('dotenv').config();
const mongoose = require('mongoose');

const connections = {}; // Cache connections to avoid reconnecting

// Connect to a specific database
const connectToDatabase = async (dbName) => {
  if (connections[dbName]) {
    return connections[dbName];
  }

  const uri = `${process.env.MONGODB_BASE_URI}${dbName}?retryWrites=true&w=majority&appName=Codeniche`;
  const connection = await mongoose.createConnection(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  connections[dbName] = connection;
  console.log(`Connected to database: ${dbName}`);
  return connection;
};

// Get the owner database connection
// const getOwnerConnection = async () => {
//   return connectToDatabase('owner_db');
// };

const getOwnerConnection = async () => {
    if (connections['owner_db']) {
      return connections['owner_db'];
    }
    const uri = process.env.MONGODB_OWNER_URI;
    const connection = await mongoose.createConnection(uri, {});
    connections['owner_db'] = connection;
    console.log('Connected to owner_db');
    return connection;
  };

// Get a school's database connection based on schoolId
const getSchoolConnection = async (schoolId) => {
  const ownerConnection = await getOwnerConnection();
//   const School = ownerConnection.model('School', require('../models/School').schema);
  const School = require('../models/School').model(ownerConnection);
  const school = await School.findById(schoolId);

  if (!school || !school.dbName) {
    throw new Error(`School not found or database name not configured for schoolId: ${schoolId}`);
  }

  return connectToDatabase(school.dbName);
};

module.exports = { connectToDatabase, getOwnerConnection, getSchoolConnection };