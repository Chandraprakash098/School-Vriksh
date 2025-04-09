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

