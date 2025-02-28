// const School = require('../models/School');
// const User = require('../models/User');
// const Inventory = require('../models/Inventory');
// // const Library = require('../models/Library');
// const { Library, BookIssue } = require('../models/Library'); // Adjust the path as needed
// const Fee = require('../models/Fee');
// // const BookIssue = require('../models/Library').BookIssue;
// const bcrypt = require('bcryptjs');

// const ownerController = {
//   // Register new school with admin credentials
//   registerSchool: async (req, res) => {
//     try {
//       const { 
//         name, 
//         address, 
//         contact, 
//         email, 
//         adminDetails, 
//         subscriptionDetails, 
//         rteQuota,
//         customFormFields 
//       } = req.body;

//       // Create new school
//       const school = new School({
//         name,
//         address,
//         contact,
//         email,
//         subscriptionStatus: 'active',
//         subscriptionDetails: {
//           plan: subscriptionDetails.plan,
//           startDate: new Date(),
//           endDate: subscriptionDetails.endDate,
//           paymentStatus: subscriptionDetails.paymentStatus,
//           amount: subscriptionDetails.amount
//         },
//         rteQuota,
//         customFormFields
//       });
//       await school.save();

//       // Create admin account with hashed password
//       const admin = new User({
//         school: school._id,
//         name: adminDetails.name,
//         email: adminDetails.email,
//         password: await bcrypt.hash(adminDetails.password, 10),
//         role: 'admin',
//         status: 'active',
//         profile: {
//           phone: adminDetails.phone,
//           address: adminDetails.address
//         }
//       });
//       await admin.save();

//       res.status(201).json({ 
//         message: 'School registered successfully',
//         school,
//         admin: { ...admin.toObject(), password: undefined }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all schools with subscription status
//   getAllSchools: async (req, res) => {
//     try {
//       const schools = await School.find()
//         .select('name address contact email subscriptionStatus subscriptionDetails rteQuota customFormFields')
//         .lean();
      
//       // Add basic statistics for each school
//       const enrichedSchools = await Promise.all(schools.map(async (school) => {
//         const counts = await User.aggregate([
//           { $match: { school: school._id } },
//           { $group: { 
//             _id: '$role',
//             count: { $sum: 1 }
//           }}
//         ]);

//         const stats = {
//           students: counts.find(c => c._id === 'student')?.count || 0,
//           teachers: counts.find(c => c._id === 'teacher')?.count || 0,
//           staff: counts.filter(c => !['student', 'teacher', 'admin'].includes(c._id))
//             .reduce((acc, curr) => acc + curr.count, 0)
//         };

//         return { ...school, statistics: stats };
//       }));

//       res.json(enrichedSchools);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get consolidated reports across all schools
//   getConsolidatedReports: async (req, res) => {
//     try {
//       const schools = await School.find().lean();
      
//       // Subscription statistics
//       const subscriptionStats = {
//         total: schools.length,
//         active: schools.filter(s => s.subscriptionStatus === 'active').length,
//         inactive: schools.filter(s => s.subscriptionStatus === 'inactive').length,
//         pending: schools.filter(s => s.subscriptionStatus === 'pending').length,
//         revenue: schools.reduce((acc, school) => 
//           acc + (school.subscriptionDetails?.amount || 0), 0)
//       };

//       // RTE compliance statistics
//       const rteStats = {
//         totalSeats: schools.reduce((acc, school) => 
//           acc + (school.rteQuota?.totalSeats || 0), 0),
//         occupiedSeats: schools.reduce((acc, school) => 
//           acc + (school.rteQuota?.occupied || 0), 0),
//         averageCompliance: schools.reduce((acc, school) => {
//           const compliance = school.rteQuota?.totalSeats ? 
//             (school.rteQuota.occupied / school.rteQuota.totalSeats) * 100 : 0;
//           return acc + compliance;
//         }, 0) / schools.length
//       };

//       // User statistics
//       const userStats = await User.aggregate([
//         { $group: { 
//           _id: '$role',
//           total: { $sum: 1 },
//           active: { 
//             $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
//           }
//         }}
//       ]);

//       // Library statistics
//       const libraryStats = await Library.aggregate([
//         { $group: {
//           _id: null,
//           totalBooks: { $sum: '$quantity' },
//           availableBooks: { $sum: '$availableQuantity' }
//         }}
//       ]);

//       // Fee collection statistics
//       const feeStats = await Fee.aggregate([
//         { $group: {
//           _id: null,
//           totalCollected: { 
//             $sum: { 
//               $cond: [
//                 { $eq: ['$status', 'paid'] },
//                 '$amount',
//                 0
//               ]
//             }
//           },
//           totalPending: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$status', 'pending'] },
//                 '$amount',
//                 0
//               ]
//             }
//           },
//           rteFeesWaived: {
//             $sum: {
//               $cond: [
//                 { $eq: ['$isRTE', true] },
//                 '$amount',
//                 0
//               ]
//             }
//           }
//         }}
//       ]);

//       res.json({
//         subscriptionStats,
//         rteStats,
//         userStats: userStats.reduce((acc, stat) => ({
//           ...acc,
//           [stat._id]: {
//             total: stat.total,
//             active: stat.active
//           }
//         }), {}),
//         libraryStats: libraryStats[0] || { totalBooks: 0, availableBooks: 0 },
//         feeStats: feeStats[0] || { 
//           totalCollected: 0, 
//           totalPending: 0, 
//           rteFeesWaived: 0 
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get detailed school data
//   getSchoolData: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
      
//       const schoolData = await School.findById(schoolId);
//       if (!schoolData) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       // Get all users with their roles
//       const users = await User.aggregate([
//         { $match: { school: schoolId } },
//         { $group: {
//           _id: '$role',
//           users: { 
//             $push: {
//               _id: '$_id',
//               name: '$name',
//               email: '$email',
//               status: '$status',
//               profile: '$profile'
//             }
//           },
//           activeCount: {
//             $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
//           },
//           totalCount: { $sum: 1 }
//         }}
//       ]);

//       // Get inventory statistics
//       const inventoryStats = await Inventory.aggregate([
//         { $match: { school: schoolId } },
//         { $group: {
//           _id: null,
//           totalItems: { $sum: 1 },
//           totalValue: { $sum: '$value' },
//           lowStock: {
//             $sum: { $cond: [{ $lt: ['$quantity', '$minimumQuantity'] }, 1, 0] }
//           }
//         }}
//       ]);

//       // Get library statistics
//       const libraryStats = await Promise.all([
//         Library.aggregate([
//           { $match: { school: schoolId } },
//           { $group: {
//             _id: null,
//             totalBooks: { $sum: '$quantity' },
//             availableBooks: { $sum: '$availableQuantity' },
//             categories: { $addToSet: '$category' }
//           }}
//         ]),
//         BookIssue.aggregate([
//           { $match: { 
//             school: schoolId,
//             status: { $in: ['issued', 'overdue'] }
//           }},
//           { $group: {
//             _id: '$status',
//             count: { $sum: 1 }
//           }}
//         ])
//       ]);

//       // Get fee statistics
//       const feeStats = await Fee.aggregate([
//         { $match: { school: schoolId } },
//         { $group: {
//           _id: '$type',
//           collected: {
//             $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
//           },
//           pending: {
//             $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
//           },
//           overdue: {
//             $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] }
//           }
//         }}
//       ]);

//       // Calculate RTE compliance
//       const rteCompliance = {
//         ...schoolData.rteQuota,
//         compliancePercentage: ((schoolData.rteQuota.occupied / schoolData.rteQuota.totalSeats) * 100).toFixed(2),
//         feeWaiver: await Fee.aggregate([
//           { $match: { 
//             school: schoolId,
//             isRTE: true
//           }},
//           { $group: {
//             _id: null,
//             totalWaiver: { $sum: '$amount' }
//           }}
//         ])
//       };

//       res.json({
//         school: schoolData,
//         statistics: {
//           users: {
//             byRole: users.reduce((acc, role) => ({
//               ...acc,
//               [role._id]: {
//                 active: role.activeCount,
//                 total: role.totalCount,
//                 users: role.users
//               }
//             }), {})
//           },
//           inventory: inventoryStats[0] || {
//             totalItems: 0,
//             totalValue: 0,
//             lowStock: 0
//           },
//           library: {
//             ...libraryStats[0][0],
//             issues: libraryStats[1].reduce((acc, status) => ({
//               ...acc,
//               [status._id]: status.count
//             }), {})
//           },
//           fees: feeStats.reduce((acc, fee) => ({
//             ...acc,
//             [fee._id]: {
//               collected: fee.collected,
//               pending: fee.pending,
//               overdue: fee.overdue
//             }
//           }), {}),
//           rte: rteCompliance
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Update school subscription
//   updateSubscription: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { status, details } = req.body;

//       const school = await School.findByIdAndUpdate(
//         schoolId,
//         {
//           subscriptionStatus: status,
//           subscriptionDetails: {
//             ...details,
//             updatedAt: new Date()
//           }
//         },
//         { new: true }
//       );

//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       // If subscription becomes inactive, update all users' status
//       if (status === 'inactive') {
//         await User.updateMany(
//           { school: schoolId },
//           { status: 'inactive' }
//         );
//       }

//       res.json({ 
//         message: 'Subscription updated successfully', 
//         school 
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Manage admin credentials
//   updateAdminCredentials: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { adminDetails } = req.body;

//       const admin = await User.findOneAndUpdate(
//         { 
//           school: schoolId,
//           role: 'admin'
//         },
//         {
//           name: adminDetails.name,
//           email: adminDetails.email,
//           ...(adminDetails.password && {
//             password: await bcrypt.hash(adminDetails.password, 10)
//           }),
//           profile: {
//             phone: adminDetails.phone,
//             address: adminDetails.address
//           }
//         },
//         { new: true }
//       ).select('-password');

//       if (!admin) {
//         return res.status(404).json({ message: 'Admin not found' });
//       }

//       res.json({ 
//         message: 'Admin credentials updated successfully',
//         admin
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };

// module.exports = ownerController;



















// const { connectToDatabase, getOwnerConnection } = require('../db');
// const bcrypt = require('bcryptjs');
// const mongoose = require('mongoose');

// const ownerController = {
//   // Register new school with admin credentials and create separate database
//   registerSchool: async (req, res) => {
//     try {
//       const { 
//         name, 
//         address, 
//         contact, 
//         email, 
//         adminDetails, 
//         subscriptionDetails, 
//         rteQuota,
//         customFormFields 
//       } = req.body;

//       // Use owner connection to create school entry in owner_db
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       // Generate unique database name for the school
//       const dbName = `school_${new mongoose.Types.ObjectId().toString()}`;

//       const school = new School({
//         name,
//         address,
//         contact,
//         email,
//         subscriptionStatus: 'active',
//         subscriptionDetails: {
//           plan: subscriptionDetails.plan,
//           startDate: new Date(),
//           endDate: subscriptionDetails.endDate,
//           paymentStatus: subscriptionDetails.paymentStatus,
//           amount: subscriptionDetails.amount
//         },
//         rteQuota,
//         customFormFields,
//         dbName
//       });
//       await school.save();

//       // Connect to the new school's database
//       const schoolConnection = await connectToDatabase(dbName);
//       const User = require('../models/User')(schoolConnection);

//       // Create admin account for the school
//       const admin = new User({
//         school: school._id, // Reference to school in owner_db
//         name: adminDetails.name,
//         email: adminDetails.email,
//         password: await bcrypt.hash(adminDetails.password, 10),
//         role: 'admin',
//         status: 'active',
//         profile: {
//           phone: adminDetails.phone,
//           address: adminDetails.address
//         }
//       });
//       await admin.save();

//       res.status(201).json({ 
//         message: 'School registered successfully',
//         school: {
//           _id: school._id,
//           name: school.name,
//           email: school.email,
//           dbName: school.dbName
//         },
//         admin: { ...admin.toObject(), password: undefined }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get all schools with subscription status and basic statistics
//   getAllSchools: async (req, res) => {
//     try {
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       const schools = await School.find()
//         .select('name address contact email subscriptionStatus subscriptionDetails rteQuota customFormFields dbName')
//         .lean();

//       // Enrich schools with basic statistics from their databases
//       const enrichedSchools = await Promise.all(schools.map(async (school) => {
//         const schoolConnection = await connectToDatabase(school.dbName);
//         const User = require('../models/User')(schoolConnection);

//         const counts = await User.aggregate([
//           { $group: { 
//             _id: '$role',
//             count: { $sum: 1 }
//           }}
//         ]);

//         const stats = {
//           students: counts.find(c => c._id === 'student')?.count || 0,
//           teachers: counts.find(c => c._id === 'teacher')?.count || 0,
//           staff: counts.filter(c => !['student', 'teacher', 'admin'].includes(c._id))
//             .reduce((acc, curr) => acc + curr.count, 0)
//         };

//         return { ...school, statistics: stats };
//       }));

//       res.json(enrichedSchools);
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get consolidated reports across all schools
//   getConsolidatedReports: async (req, res) => {
//     try {
//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       const schools = await School.find().lean();

//       // Subscription statistics
//       const subscriptionStats = {
//         total: schools.length,
//         active: schools.filter(s => s.subscriptionStatus === 'active').length,
//         inactive: schools.filter(s => s.subscriptionStatus === 'inactive').length,
//         pending: schools.filter(s => s.subscriptionStatus === 'pending').length,
//         revenue: schools.reduce((acc, school) => 
//           acc + (school.subscriptionDetails?.amount || 0), 0)
//       };

//       // RTE compliance statistics
//       const rteStats = {
//         totalSeats: schools.reduce((acc, school) => 
//           acc + (school.rteQuota?.totalSeats || 0), 0),
//         occupiedSeats: schools.reduce((acc, school) => 
//           acc + (school.rteQuota?.occupied || 0), 0),
//         averageCompliance: schools.reduce((acc, school) => {
//           const compliance = school.rteQuota?.totalSeats ? 
//             (school.rteQuota.occupied / school.rteQuota.totalSeats) * 100 : 0;
//           return acc + compliance;
//         }, 0) / (schools.length || 1)
//       };

//       // User statistics across all schools
//       let userStats = {};
//       let libraryStats = { totalBooks: 0, availableBooks: 0 };
//       let feeStats = { totalCollected: 0, totalPending: 0, rteFeesWaived: 0 };

//       for (const school of schools) {
//         const schoolConnection = await connectToDatabase(school.dbName);
//         const User = require('../models/User')(schoolConnection);
//         const Library = schoolConnection.model('Library', require('../models/Library').schema); // Adjust path
//         const Fee = schoolConnection.model('Fee', require('../models/Fee').schema); // Adjust path

//         // User stats
//         const userAgg = await User.aggregate([
//           { $group: { 
//             _id: '$role',
//             total: { $sum: 1 },
//             active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }
//           }}
//         ]);
//         userAgg.forEach(stat => {
//           userStats[stat._id] = userStats[stat._id] || { total: 0, active: 0 };
//           userStats[stat._id].total += stat.total;
//           userStats[stat._id].active += stat.active;
//         });

//         // Library stats
//         const libAgg = await Library.aggregate([
//           { $group: {
//             _id: null,
//             totalBooks: { $sum: '$quantity' },
//             availableBooks: { $sum: '$availableQuantity' }
//           }}
//         ]);
//         if (libAgg[0]) {
//           libraryStats.totalBooks += libAgg[0].totalBooks || 0;
//           libraryStats.availableBooks += libAgg[0].availableBooks || 0;
//         }

//         // Fee stats
//         const feeAgg = await Fee.aggregate([
//           { $group: {
//             _id: null,
//             totalCollected: { 
//               $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] }
//             },
//             totalPending: { 
//               $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
//             },
//             rteFeesWaived: { 
//               $sum: { $cond: [{ $eq: ['$isRTE', true] }, '$amount', 0] }
//             }
//           }}
//         ]);
//         if (feeAgg[0]) {
//           feeStats.totalCollected += feeAgg[0].totalCollected || 0;
//           feeStats.totalPending += feeAgg[0].totalPending || 0;
//           feeStats.rteFeesWaived += feeAgg[0].rteFeesWaived || 0;
//         }
//       }

//       res.json({
//         subscriptionStats,
//         rteStats,
//         userStats,
//         libraryStats,
//         feeStats
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Get detailed data for a specific school
//   getSchoolData: async (req, res) => {
//     try {
//       const { schoolId } = req.params;

//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       const schoolData = await School.findById(schoolId);
//       if (!schoolData) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       const schoolConnection = await connectToDatabase(schoolData.dbName);
//       const User = require('../models/User')(schoolConnection);
//       const Inventory = schoolConnection.model('Inventory', require('../models/Inventory').schema); // Adjust path
//       const Library = schoolConnection.model('Library', require('../models/Library').schema);
//       const BookIssue = schoolConnection.model('BookIssue', require('../models/Library').BookIssue.schema);
//       const Fee = schoolConnection.model('Fee', require('../models/Fee').schema);

//       // User statistics
//       const users = await User.aggregate([
//         { $group: {
//           _id: '$role',
//           users: { 
//             $push: {
//               _id: '$_id',
//               name: '$name',
//               email: '$email',
//               status: '$status',
//               profile: '$profile'
//             }
//           },
//           activeCount: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
//           totalCount: { $sum: 1 }
//         }}
//       ]);

//       // Inventory statistics
//       const inventoryStats = await Inventory.aggregate([
//         { $group: {
//           _id: null,
//           totalItems: { $sum: 1 },
//           totalValue: { $sum: '$value' },
//           lowStock: { $sum: { $cond: [{ $lt: ['$quantity', '$minimumQuantity'] }, 1, 0] } }
//         }}
//       ]);

//       // Library statistics
//       const libraryStats = await Promise.all([
//         Library.aggregate([
//           { $group: {
//             _id: null,
//             totalBooks: { $sum: '$quantity' },
//             availableBooks: { $sum: '$availableQuantity' },
//             categories: { $addToSet: '$category' }
//           }}
//         ]),
//         BookIssue.aggregate([
//           { $match: { status: { $in: ['issued', 'overdue'] } } },
//           { $group: {
//             _id: '$status',
//             count: { $sum: 1 }
//           }}
//         ])
//       ]);

//       // Fee statistics
//       const feeStats = await Fee.aggregate([
//         { $group: {
//           _id: '$type',
//           collected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
//           pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
//           overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } }
//         }}
//       ]);

//       // RTE compliance
//       const rteCompliance = {
//         ...schoolData.rteQuota,
//         compliancePercentage: schoolData.rteQuota?.totalSeats ? 
//           ((schoolData.rteQuota.occupied / schoolData.rteQuota.totalSeats) * 100).toFixed(2) : 0,
//         feeWaiver: await Fee.aggregate([
//           { $match: { isRTE: true } },
//           { $group: { _id: null, totalWaiver: { $sum: '$amount' } } }
//         ])
//       };

//       res.json({
//         school: schoolData,
//         statistics: {
//           users: {
//             byRole: users.reduce((acc, role) => ({
//               ...acc,
//               [role._id]: {
//                 active: role.activeCount,
//                 total: role.totalCount,
//                 users: role.users
//               }
//             }), {})
//           },
//           inventory: inventoryStats[0] || { totalItems: 0, totalValue: 0, lowStock: 0 },
//           library: {
//             ...(libraryStats[0][0] || { totalBooks: 0, availableBooks: 0, categories: [] }),
//             issues: libraryStats[1].reduce((acc, status) => ({
//               ...acc,
//               [status._id]: status.count
//             }), {})
//           },
//           fees: feeStats.reduce((acc, fee) => ({
//             ...acc,
//             [fee._id]: {
//               collected: fee.collected,
//               pending: fee.pending,
//               overdue: fee.overdue
//             }
//           }), {}),
//           rte: {
//             ...rteCompliance,
//             feeWaiver: rteCompliance.feeWaiver[0]?.totalWaiver || 0
//           }
//         }
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Update school subscription
//   updateSubscription: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { status, details } = req.body;

//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       const school = await School.findByIdAndUpdate(
//         schoolId,
//         {
//           subscriptionStatus: status,
//           subscriptionDetails: {
//             ...details,
//             updatedAt: new Date()
//           }
//         },
//         { new: true }
//       );

//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       // If subscription becomes inactive, update all users in the school's database
//       if (status === 'inactive') {
//         const schoolConnection = await connectToDatabase(school.dbName);
//         const User = require('../models/User')(schoolConnection);
//         await User.updateMany({}, { status: 'inactive' });
//       }

//       res.json({ 
//         message: 'Subscription updated successfully', 
//         school 
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   },

//   // Manage admin credentials for a school
//   updateAdminCredentials: async (req, res) => {
//     try {
//       const { schoolId } = req.params;
//       const { adminDetails } = req.body;

//       const ownerConnection = await getOwnerConnection();
//       const School = ownerConnection.model('School', require('../models/School').schema);

//       const school = await School.findById(schoolId);
//       if (!school) {
//         return res.status(404).json({ message: 'School not found' });
//       }

//       const schoolConnection = await connectToDatabase(school.dbName);
//       const User = require('../models/User')(schoolConnection);

//       const admin = await User.findOneAndUpdate(
//         { school: schoolId, role: 'admin' },
//         {
//           name: adminDetails.name,
//           email: adminDetails.email,
//           ...(adminDetails.password && {
//             password: await bcrypt.hash(adminDetails.password, 10)
//           }),
//           profile: {
//             phone: adminDetails.phone,
//             address: adminDetails.address
//           }
//         },
//         { new: true }
//       ).select('-password');

//       if (!admin) {
//         return res.status(404).json({ message: 'Admin not found' });
//       }

//       res.json({ 
//         message: 'Admin credentials updated successfully',
//         admin
//       });
//     } catch (error) {
//       res.status(500).json({ error: error.message });
//     }
//   }
// };

// module.exports = ownerController;




const { getOwnerConnection, getSchoolConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

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
        customFormFields 
      } = req.body;

      const ownerConnection = await getOwnerConnection();
      // const School = ownerConnection.model('School', require('../models/School').schema);
      const School = require('../models/School').model(ownerConnection);

      // Generate unique dbName for the school
      const dbName = `school_db_${new mongoose.Types.ObjectId()}`;

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
        customFormFields
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
        school,
        admin: { ...admin.toObject(), password: undefined }
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

      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model('School', require('../models/School').schema);
      const schoolData = await School.findById(schoolId);
      if (!schoolData) {
        return res.status(404).json({ message: 'School not found' });
      }

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

      const inventoryStats = await Inventory.aggregate([
        { $match: { school: schoolId } },
        { $group: { _id: null, totalItems: { $sum: 1 }, totalValue: { $sum: '$value' }, lowStock: { $sum: { $cond: [{ $lt: ['$quantity', '$minimumQuantity'] }, 1, 0] } } }}
      ]);

      const libraryStats = await Library.aggregate([
        { $match: { school: schoolId } },
        { $group: { _id: null, totalBooks: { $sum: '$quantity' }, availableBooks: { $sum: '$availableQuantity' }, categories: { $addToSet: '$category' } }}
      ]);

      const feeStats = await Fee.aggregate([
        { $match: { school: schoolId } },
        { $group: {
          _id: '$type',
          collected: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
          overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } }
        }}
      ]);

      const rteCompliance = {
        ...schoolData.rteQuota,
        compliancePercentage: ((schoolData.rteQuota.occupied / schoolData.rteQuota.totalSeats) * 100).toFixed(2),
        feeWaiver: await Fee.aggregate([
          { $match: { school: schoolId, isRTE: true } },
          { $group: { _id: null, totalWaiver: { $sum: '$amount' } }}
        ])
      };

      res.json({
        school: schoolData,
        statistics: {
          users: { byRole: users.reduce((acc, role) => ({ ...acc, [role._id]: { active: role.activeCount, total: role.totalCount, users: role.users } }), {}) },
          inventory: inventoryStats[0] || { totalItems: 0, totalValue: 0, lowStock: 0 },
          library: libraryStats[0] || { totalBooks: 0, availableBooks: 0, categories: [] },
          fees: feeStats.reduce((acc, fee) => ({ ...acc, [fee._id]: { collected: fee.collected, pending: fee.pending, overdue: fee.overdue } }), {}),
          rte: rteCompliance
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

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

  updateAdminCredentials: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { adminDetails } = req.body;

      const schoolConnection = await getSchoolConnection(schoolId);
      const User = require('../models/User')(schoolConnection);

      const admin = await User.findOneAndUpdate(
        { school: schoolId, role: 'admin' },
        {
          name: adminDetails.name,
          email: adminDetails.email,
          ...(adminDetails.password && { password: await bcrypt.hash(adminDetails.password, 10) }),
          profile: { phone: adminDetails.phone, address: adminDetails.address }
        },
        { new: true }
      ).select('-password');

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      res.json({ message: 'Admin credentials updated successfully', admin });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ownerController;