const School = require('../models/School');
const User = require('../models/User');
const Inventory = require('../models/Inventory');
// const Library = require('../models/Library');
const { Library, BookIssue } = require('../models/Library'); // Adjust the path as needed
const Fee = require('../models/Fee');
// const BookIssue = require('../models/Library').BookIssue;
const bcrypt = require('bcryptjs');

const ownerController = {
  // Register new school with admin credentials
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
        customFormFields 
      } = req.body;

      // Create new school
      const school = new School({
        name,
        address,
        contact,
        email,
        subscriptionStatus: 'active',
        subscriptionDetails: {
          plan: subscriptionDetails.plan,
          startDate: new Date(),
          endDate: subscriptionDetails.endDate,
          paymentStatus: subscriptionDetails.paymentStatus,
          amount: subscriptionDetails.amount
        },
        rteQuota,
        customFormFields
      });
      await school.save();

      // Create admin account with hashed password
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
        school,
        admin: { ...admin.toObject(), password: undefined }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get all schools with subscription status
  getAllSchools: async (req, res) => {
    try {
      const schools = await School.find()
        .select('name address contact email subscriptionStatus subscriptionDetails rteQuota customFormFields')
        .lean();
      
      // Add basic statistics for each school
      const enrichedSchools = await Promise.all(schools.map(async (school) => {
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

  // Get consolidated reports across all schools
  getConsolidatedReports: async (req, res) => {
    try {
      const schools = await School.find().lean();
      
      // Subscription statistics
      const subscriptionStats = {
        total: schools.length,
        active: schools.filter(s => s.subscriptionStatus === 'active').length,
        inactive: schools.filter(s => s.subscriptionStatus === 'inactive').length,
        pending: schools.filter(s => s.subscriptionStatus === 'pending').length,
        revenue: schools.reduce((acc, school) => 
          acc + (school.subscriptionDetails?.amount || 0), 0)
      };

      // RTE compliance statistics
      const rteStats = {
        totalSeats: schools.reduce((acc, school) => 
          acc + (school.rteQuota?.totalSeats || 0), 0),
        occupiedSeats: schools.reduce((acc, school) => 
          acc + (school.rteQuota?.occupied || 0), 0),
        averageCompliance: schools.reduce((acc, school) => {
          const compliance = school.rteQuota?.totalSeats ? 
            (school.rteQuota.occupied / school.rteQuota.totalSeats) * 100 : 0;
          return acc + compliance;
        }, 0) / schools.length
      };

      // User statistics
      const userStats = await User.aggregate([
        { $group: { 
          _id: '$role',
          total: { $sum: 1 },
          active: { 
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          }
        }}
      ]);

      // Library statistics
      const libraryStats = await Library.aggregate([
        { $group: {
          _id: null,
          totalBooks: { $sum: '$quantity' },
          availableBooks: { $sum: '$availableQuantity' }
        }}
      ]);

      // Fee collection statistics
      const feeStats = await Fee.aggregate([
        { $group: {
          _id: null,
          totalCollected: { 
            $sum: { 
              $cond: [
                { $eq: ['$status', 'paid'] },
                '$amount',
                0
              ]
            }
          },
          totalPending: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'pending'] },
                '$amount',
                0
              ]
            }
          },
          rteFeesWaived: {
            $sum: {
              $cond: [
                { $eq: ['$isRTE', true] },
                '$amount',
                0
              ]
            }
          }
        }}
      ]);

      res.json({
        subscriptionStats,
        rteStats,
        userStats: userStats.reduce((acc, stat) => ({
          ...acc,
          [stat._id]: {
            total: stat.total,
            active: stat.active
          }
        }), {}),
        libraryStats: libraryStats[0] || { totalBooks: 0, availableBooks: 0 },
        feeStats: feeStats[0] || { 
          totalCollected: 0, 
          totalPending: 0, 
          rteFeesWaived: 0 
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Get detailed school data
  getSchoolData: async (req, res) => {
    try {
      const { schoolId } = req.params;
      
      const schoolData = await School.findById(schoolId);
      if (!schoolData) {
        return res.status(404).json({ message: 'School not found' });
      }

      // Get all users with their roles
      const users = await User.aggregate([
        { $match: { school: schoolId } },
        { $group: {
          _id: '$role',
          users: { 
            $push: {
              _id: '$_id',
              name: '$name',
              email: '$email',
              status: '$status',
              profile: '$profile'
            }
          },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalCount: { $sum: 1 }
        }}
      ]);

      // Get inventory statistics
      const inventoryStats = await Inventory.aggregate([
        { $match: { school: schoolId } },
        { $group: {
          _id: null,
          totalItems: { $sum: 1 },
          totalValue: { $sum: '$value' },
          lowStock: {
            $sum: { $cond: [{ $lt: ['$quantity', '$minimumQuantity'] }, 1, 0] }
          }
        }}
      ]);

      // Get library statistics
      const libraryStats = await Promise.all([
        Library.aggregate([
          { $match: { school: schoolId } },
          { $group: {
            _id: null,
            totalBooks: { $sum: '$quantity' },
            availableBooks: { $sum: '$availableQuantity' },
            categories: { $addToSet: '$category' }
          }}
        ]),
        BookIssue.aggregate([
          { $match: { 
            school: schoolId,
            status: { $in: ['issued', 'overdue'] }
          }},
          { $group: {
            _id: '$status',
            count: { $sum: 1 }
          }}
        ])
      ]);

      // Get fee statistics
      const feeStats = await Fee.aggregate([
        { $match: { school: schoolId } },
        { $group: {
          _id: '$type',
          collected: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
          },
          overdue: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] }
          }
        }}
      ]);

      // Calculate RTE compliance
      const rteCompliance = {
        ...schoolData.rteQuota,
        compliancePercentage: ((schoolData.rteQuota.occupied / schoolData.rteQuota.totalSeats) * 100).toFixed(2),
        feeWaiver: await Fee.aggregate([
          { $match: { 
            school: schoolId,
            isRTE: true
          }},
          { $group: {
            _id: null,
            totalWaiver: { $sum: '$amount' }
          }}
        ])
      };

      res.json({
        school: schoolData,
        statistics: {
          users: {
            byRole: users.reduce((acc, role) => ({
              ...acc,
              [role._id]: {
                active: role.activeCount,
                total: role.totalCount,
                users: role.users
              }
            }), {})
          },
          inventory: inventoryStats[0] || {
            totalItems: 0,
            totalValue: 0,
            lowStock: 0
          },
          library: {
            ...libraryStats[0][0],
            issues: libraryStats[1].reduce((acc, status) => ({
              ...acc,
              [status._id]: status.count
            }), {})
          },
          fees: feeStats.reduce((acc, fee) => ({
            ...acc,
            [fee._id]: {
              collected: fee.collected,
              pending: fee.pending,
              overdue: fee.overdue
            }
          }), {}),
          rte: rteCompliance
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update school subscription
  updateSubscription: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { status, details } = req.body;

      const school = await School.findByIdAndUpdate(
        schoolId,
        {
          subscriptionStatus: status,
          subscriptionDetails: {
            ...details,
            updatedAt: new Date()
          }
        },
        { new: true }
      );

      if (!school) {
        return res.status(404).json({ message: 'School not found' });
      }

      // If subscription becomes inactive, update all users' status
      if (status === 'inactive') {
        await User.updateMany(
          { school: schoolId },
          { status: 'inactive' }
        );
      }

      res.json({ 
        message: 'Subscription updated successfully', 
        school 
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Manage admin credentials
  updateAdminCredentials: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { adminDetails } = req.body;

      const admin = await User.findOneAndUpdate(
        { 
          school: schoolId,
          role: 'admin'
        },
        {
          name: adminDetails.name,
          email: adminDetails.email,
          ...(adminDetails.password && {
            password: await bcrypt.hash(adminDetails.password, 10)
          }),
          profile: {
            phone: adminDetails.phone,
            address: adminDetails.address
          }
        },
        { new: true }
      ).select('-password');

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      res.json({ 
        message: 'Admin credentials updated successfully',
        admin
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ownerController;