require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const ownerRoutes = require('./routes/ownerRoutes')
const adminRoutes = require('./routes/adminRoutes')
const trustyRoutes = require('./routes/trustyRoutes')
const teacherRoutes = require('./routes/teacherRoutes')
const studentRoutes = require('./routes/studentRoutes') 
const parentRoutes = require('./routes/parentRoutes')
const clerkRoutes = require('./routes/clerkRoutes')
const libraryRoutes = require('./routes/libraryRoutes')
const feeRoutes = require('./routes/feeRoutes')
const inventoryRoutes = require('./routes/inventoryRoutes')
const authRoutes = require('./routes/authRoutes')
const admissionRoutes = require('./routes/admissionRoutes')
const { multerErrorHandler } = require('./middleware/errorHandler');
const { getOwnerConnection } = require('./config/database');

// const config = require('./src/config/config');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(multerErrorHandler);

// Routes
app.use('/api/owner', ownerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/trusty', trustyRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
// app.use('/api/parent', parentRoutes);
app.use('/api/clerk', clerkRoutes);
app.use('/api/library', libraryRoutes);
// app.use('/api/fee', feeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admission', admissionRoutes);

// Database connection
// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('Connected to MongoDB'))
//   .catch(err => console.error('MongoDB connection error:', err));

// Test owner_db connection at startup
const testDatabaseConnection = async () => {
  try {
    const ownerConnection = await getOwnerConnection();
    console.log('Successfully connected to owner_db at startup');
  } catch (error) {
    console.error('Failed to connect to owner_db at startup:', error.message);
  }
};

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await testDatabaseConnection(); // Test connection after server starts
});












// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const { getOwnerConnection } = require('./db');
// const ownerRoutes = require('./routes/ownerRoutes');
// // ... other route imports ...

// const app = express();

// // Middleware
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(multerErrorHandler);

// // Routes
// app.use('/api/owner', ownerRoutes);
// app.use('/api/admin', adminRoutes);
// // ... other routes ...

// // Initialize owner database connection
// getOwnerConnection()
//   .then(() => console.log('Connected to owner database'))
//   .catch(err => console.error('Owner DB connection error:', err));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));