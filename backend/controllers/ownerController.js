

const { getOwnerConnection, getSchoolConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const ownerController = {
  registerSchool: async (req, res) => {
    try {
      const { 
        name, 
        address, 
        contact, 
        email, 
        adminDetails, 
        subscriptionDetails, 
        rteQuota,
        customFormFields,
        razorpayKeyId,    // New field
        razorpayKeySecret // New field
      } = req.body;

      const ownerConnection = await getOwnerConnection();
      // const School = ownerConnection.model('School', require('../models/School').schema);
      // const School = require('../models/School').model(ownerConnection);
      const School = require('../models/School')(ownerConnection);

      // Generate unique dbName for the school

      // Generate dbName from school name (sanitized)
      const sanitizedName = name.toLowerCase()
                               .replace(/\s+/g, '_') // Replace spaces with underscores
                               .replace(/[^a-z0-9_]/g, '') // Remove special characters
                               .substring(0, 16); // Limit length
      
      // Add a timestamp to make it unique in case of schools with the same name
      const timestamp = Date.now().toString().slice(-6);
      const dbName = `school_${sanitizedName}_${timestamp}`;
      // const dbName = `school_db_${new mongoose.Types.ObjectId()}`;

      if (!razorpayKeyId || !razorpayKeySecret) {
        return res.status(400).json({ error: 'Razorpay credentials are required' });
      }

      const encryptedKeyId = encrypt(razorpayKeyId);
      const encryptedKeySecret = encrypt(razorpayKeySecret);

      // Create new school in owner_db
      const school = new School({
        name,
        address,
        contact,
        email,
        dbName, // Assign unique database name
        subscriptionStatus: 'active',
        subscriptionDetails: {
          plan: subscriptionDetails.plan,
          startDate: new Date(),
          endDate: subscriptionDetails.endDate,
          paymentStatus: subscriptionDetails.paymentStatus,
          amount: subscriptionDetails.amount
        },
        rteQuota,
        customFormFields,
        // paymentConfig: {
        //   razorpayKeyId,
        //   razorpayKeySecret,
        //   isPaymentConfigured: true
        // }
        paymentConfig: {
          razorpayKeyId: encryptedKeyId,
          razorpayKeySecret: encryptedKeySecret,
          isPaymentConfigured: true
        }
      });
      await school.save();

      // Connect to the new school's database
      const schoolConnection = await getSchoolConnection(school._id);
      const User = require('../models/User')(schoolConnection);

      // Create admin account in the school's database
      const admin = new User({
        school: school._id,
        name: adminDetails.name,
        email: adminDetails.email,
        password: await bcrypt.hash(adminDetails.password, 10),
        role: 'admin',
        status: 'active',
        profile: {
          phone: adminDetails.phone,
          address: adminDetails.address
        }
      });
      await admin.save();

      res.status(201).json({ 
        message: 'School registered successfully',
        school: {
          ...school.toObject(),
          paymentConfig: {
            ...school.paymentConfig,
            razorpayKeySecret: undefined // Don't expose secret
          }
        },
        admin: { ...admin.toObject(), password: undefined }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  getSchoolAdmins: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      const School = require('../models/School')(ownerConnection);
      
      // Get all schools with basic info
      const schools = await School.find()
        .select('name dbName')
        .lean();

      // Collect admin data for each school
      const adminData = await Promise.all(schools.map(async (school) => {
        const schoolConnection = await getSchoolConnection(school._id);
        const User = require('../models/User')(schoolConnection);

        const admin = await User.findOne({ 
          school: school._id, 
          role: 'admin' 
        })
        .select('name email profile status')
        .lean();

        return {
          schoolId: school._id,
          schoolName: school.name,
          admin: admin ? {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            phone: admin.profile?.phone,
            address: admin.profile?.address,
            status: admin.status
          } : null
        };
      }));

      res.json(adminData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  updatePaymentConfig: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { razorpayKeyId, razorpayKeySecret } = req.body;

      const ownerConnection = await getOwnerConnection();
      const School = require('../models/School').model(ownerConnection);

      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }

      // Encrypt new credentials
      const encryptedKeyId = encrypt(razorpayKeyId);
      const encryptedKeySecret = encrypt(razorpayKeySecret);

      school.paymentConfig = {
        razorpayKeyId: encryptedKeyId,
        razorpayKeySecret: encryptedKeySecret,
        isPaymentConfigured: true
      };

      await school.save();

      res.json({
        message: 'Payment configuration updated successfully',
        paymentConfig: {
          razorpayKeyId: razorpayKeyId, // Return plain keyId for confirmation
          isPaymentConfigured: true
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllSchools: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);
      const schools = await School.find()
        .select('name address contact email dbName subscriptionStatus subscriptionDetails rteQuota customFormFields')
        .lean();

      const enrichedSchools = await Promise.all(schools.map(async (school) => {
        const schoolConnection = await getSchoolConnection(school._id);
        const User = require('../models/User')(schoolConnection);

        const counts = await User.aggregate([
          { $match: { school: school._id } },
          { $group: { 
            _id: '$role',
            count: { $sum: 1 }
          }}
        ]);

        const stats = {
          students: counts.find(c => c._id === 'student')?.count || 0,
          teachers: counts.find(c => c._id === 'teacher')?.count || 0,
          staff: counts.filter(c => !['student', 'teacher', 'admin'].includes(c._id))
            .reduce((acc, curr) => acc + curr.count, 0)
        };

        return { ...school, statistics: stats };
      }));

      res.json(enrichedSchools);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getConsolidatedReports: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);
      const schools = await School.find().lean();

      const subscriptionStats = {
        total: schools.length,
        active: schools.filter(s => s.subscriptionStatus === 'active').length,
        inactive: schools.filter(s => s.subscriptionStatus === 'inactive').length,
        pending: schools.filter(s => s.subscriptionStatus === 'pending').length,
        revenue: schools.reduce((acc, school) => 
          acc + (school.subscriptionDetails?.amount || 0), 0)
      };

      const rteStats = {
        totalSeats: schools.reduce((acc, school) => acc + (school.rteQuota?.totalSeats || 0), 0),
        occupiedSeats: schools.reduce((acc, school) => acc + (school.rteQuota?.occupied || 0), 0),
        averageCompliance: schools.reduce((acc, school) => {
          const compliance = school.rteQuota?.totalSeats ? 
            (school.rteQuota.occupied / school.rteQuota.totalSeats) * 100 : 0;
          return acc + compliance;
        }, 0) / schools.length || 0
      };

      let userStats = { total: 0, active: 0 };
      let libraryStats = { totalBooks: 0, availableBooks: 0 };
      let feeStats = { totalCollected: 0, totalPending: 0, rteFeesWaived: 0 };

      await Promise.all(schools.map(async (school) => {
        const schoolConnection = await getSchoolConnection(school._id);
        const User = require('../models/User')(schoolConnection);
        const Library = require('../models/Library')(schoolConnection);
        const Fee = require('../models/Fee')(schoolConnection);

        const userData = await User.aggregate([
          { $group: { 
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
          }}
        ]);
        userStats.total += userData[0]?.total || 0;
        userStats.active += userData[0]?.active || 0;

        const libData = await Library.aggregate([
          { $group: { _id: null, totalBooks: { $sum: '$quantity' }, availableBooks: { $sum: '$availableQuantity' } }}
        ]);
        libraryStats.totalBooks += libData[0]?.totalBooks || 0;
        libraryStats.availableBooks += libData[0]?.availableBooks || 0;

        const feeData = await Fee.aggregate([
          { $group: {
            _id: null,
            totalCollected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
            totalPending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
            rteFeesWaived: { $sum: { $cond: [{ $eq: ['$isRTE', true] }, '$amount', 0] } }
          }}
        ]);
        feeStats.totalCollected += feeData[0]?.totalCollected || 0;
        feeStats.totalPending += feeData[0]?.totalPending || 0;
        feeStats.rteFeesWaived += feeData[0]?.rteFeesWaived || 0;
      }));

      res.json({
        subscriptionStats,
        rteStats,
        userStats,
        libraryStats,
        feeStats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSchoolData: async (req, res) => {

    try {
      const { schoolId } = req.params;
      console.log('SchoolId:', schoolId);
  
      console.log('Getting owner connection...');
      const ownerConnection = await getOwnerConnection();
      console.log('Owner connection successful:', !!ownerConnection);
  
      console.log('Getting School model...');
      const getModel = require('../models/index');
      console.log('getModel type:', typeof getModel);
      // const School = getModel('School', ownerConnection);
      const School = getModel('School', ownerConnection);
      console.log('School type:', typeof School);
      console.log('School has findById:', typeof School.findById === 'function');
      console.log('School model retrieved');
  
      console.log('Fetching school data...');
      const schoolData = await School.findById(schoolId);
      console.log('School data retrieved:', !!schoolData);

 
   

      const schoolConnection = await getSchoolConnection(schoolId);
      const User = require('../models/User')(schoolConnection);
      const Inventory = require('../models/Inventory')(schoolConnection);
      const Library = require('../models/Library')(schoolConnection);
      const Fee = require('../models/Fee')(schoolConnection);

      const users = await User.aggregate([
        { $match: { school: schoolId } },
        { $group: {
          _id: '$role',
          users: { $push: { _id: '$_id', name: '$name', email: '$email', status: '$status', profile: '$profile' } },
          activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalCount: { $sum: 1 }
        }}
      ]);

      // const inventoryStats = await Inventory.aggregate([
      //   { $match: { school: schoolId } },
      //   { $group: { _id: null, totalItems: { $sum: 1 }, totalValue: { $sum: '$value' }, lowStock: { $sum: { $cond: [{ $lt: ['$quantity', '$minimumQuantity'] }, 1, 0] } } }}
      // ]);

      // const libraryStats = await Library.aggregate([
      //   { $match: { school: schoolId } },
      //   { $group: { _id: null, totalBooks: { $sum: '$quantity' }, availableBooks: { $sum: '$availableQuantity' }, categories: { $addToSet: '$category' } }}
      // ]);

      // const feeStats = await Fee.aggregate([
      //   { $match: { school: schoolId } },
      //   { $group: {
      //     _id: '$type',
      //     collected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
      //     pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
      //     overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } }
      //   }}
      // ]);

      // const rteCompliance = {
      //   ...schoolData.rteQuota,
      //   compliancePercentage: ((schoolData.rteQuota.occupied / schoolData.rteQuota.totalSeats) * 100).toFixed(2),
      //   feeWaiver: await Fee.aggregate([
      //     { $match: { school: schoolId, isRTE: true } },
      //     { $group: { _id: null, totalWaiver: { $sum: '$amount' } }}
      //   ])
      // };

      res.json({
        school: schoolData,
        statistics: {
          users: { byRole: users.reduce((acc, role) => ({ ...acc, [role._id]: { active: role.activeCount, total: role.totalCount, users: role.users } }), {}) },
          // inventory: inventoryStats[0] || { totalItems: 0, totalValue: 0, lowStock: 0 },
          // library: libraryStats[0] || { totalBooks: 0, availableBooks: 0, categories: [] },
          // fees: feeStats.reduce((acc, fee) => ({ ...acc, [fee._id]: { collected: fee.collected, pending: fee.pending, overdue: fee.overdue } }), {}),
          // rte: rteCompliance
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Fix for the getSchoolData function in ownerController.js
  

  updateSubscription: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { status, details } = req.body;

      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);

      const school = await School.findByIdAndUpdate(
        schoolId,
        { subscriptionStatus: status, subscriptionDetails: { ...details, updatedAt: new Date() } },
        { new: true }
      );

      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }

      if (status === 'inactive') {
        const schoolConnection = await getSchoolConnection(schoolId);
        const User = require('../models/User')(schoolConnection);
        await User.updateMany({ school: schoolId }, { status: 'inactive' });
      }

      res.json({ message: 'Subscription updated successfully', school });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // updateAdminCredentials: async (req, res) => {
  //   try {
  //     const { schoolId } = req.params;
  //     const { adminDetails } = req.body;

  //     const schoolConnection = await getSchoolConnection(schoolId);
  //     const User = require('../models/User')(schoolConnection);

  //     const admin = await User.findOneAndUpdate(
  //       { school: schoolId, role: 'admin' },
  //       {
  //         name: adminDetails.name,
  //         email: adminDetails.email,
  //         ...(adminDetails.password && { password: await bcrypt.hash(adminDetails.password, 10) }),
  //         profile: { phone: adminDetails.phone, address: adminDetails.address }
  //       },
  //       { new: true }
  //     ).select('-password');

  //     if (!admin) {
  //       return res.status(404).json({ message: 'Admin not found' });
  //     }

  //     res.json({ message: 'Admin credentials updated successfully', admin });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // }

  updateAdminCredentials: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { adminDetails } = req.body;

      const schoolConnection = await getSchoolConnection(schoolId);
      const User = require('../models/User')(schoolConnection);

      const updateData = {
        name: adminDetails.name,
        email: adminDetails.email,
        profile: { 
          phone: adminDetails.phone,
          address: adminDetails.address 
        }
      };

      // Only hash password if it's provided
      if (adminDetails.password) {
        updateData.password = await bcrypt.hash(adminDetails.password, 10);
      }

      const admin = await User.findOneAndUpdate(
        { school: schoolId, role: 'admin' },
        updateData,
        { new: true }
      ).select('-password');

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      res.json({ 
        message: 'Admin credentials updated successfully', 
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.profile?.phone,
          address: admin.profile?.address,
          status: admin.status
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ownerController;

