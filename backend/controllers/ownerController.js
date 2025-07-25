const {
  getOwnerConnection,
  getSchoolConnection,
} = require("../config/database");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { encrypt, decrypt } = require("../utils/encryption");
const {uploadToS3,getPublicFileUrl} = require('../config/s3Upload');

const ownerController = {
  // registerSchool: async (req, res) => {
  //   try {
  //     const {
  //       name,
  //       address,
  //       contact,
  //       email,
  //       adminDetails,
  //       subscriptionDetails,
  //       rteQuota,
  //       customFormFields,
  //       // razorpayKeyId,    // New field
  //       // razorpayKeySecret  // New field
  //     } = req.body;

  //     const ownerConnection = await getOwnerConnection();
  //     // const School = ownerConnection.model('School', require('../models/School').schema);
  //     // const School = require('../models/School').model(ownerConnection);
  //     const School = require("../models/School")(ownerConnection);

  //     // Generate unique dbName for the school

  //     // Generate dbName from school name (sanitized)
  //     const sanitizedName = name
  //       .toLowerCase()
  //       .replace(/\s+/g, "_") // Replace spaces with underscores
  //       .replace(/[^a-z0-9_]/g, "") // Remove special characters
  //       .substring(0, 16); // Limit length

  //     // Add a timestamp to make it unique in case of schools with the same name
  //     const timestamp = Date.now().toString().slice(-6);
  //     const dbName = `school_${sanitizedName}_${timestamp}`;
  //     // const dbName = `school_db_${new mongoose.Types.ObjectId()}`;

  //     // if (!razorpayKeyId || !razorpayKeySecret) {
  //     //   return res.status(400).json({ error: 'Razorpay credentials are required' });
  //     // }

  //     // const encryptedKeyId = encrypt(razorpayKeyId);
  //     // const encryptedKeySecret = encrypt(razorpayKeySecret);

  //     // Create new school in owner_db
  //     const school = new School({
  //       name,
  //       address,
  //       contact,
  //       email,
  //       dbName, // Assign unique database name
  //       subscriptionStatus: "active",
  //       subscriptionDetails: {
  //         plan: subscriptionDetails.plan,
  //         startDate: new Date(),
  //         endDate: subscriptionDetails.endDate,
  //         paymentStatus: subscriptionDetails.paymentStatus,
  //         amount: subscriptionDetails.amount,
  //       },
  //       rteQuota,
  //       customFormFields,

  //       // paymentConfig: {
  //       //   razorpayKeyId: encryptedKeyId,
  //       //   razorpayKeySecret: encryptedKeySecret,
  //       //   isPaymentConfigured: true
  //       // },
  //     });
  //     await school.save();

  //     // Connect to the new school's database
  //     const schoolConnection = await getSchoolConnection(school._id);
  //     const User = require("../models/User")(schoolConnection);

  //     // Create admin account in the school's database
  //     const admin = new User({
  //       school: school._id,
  //       name: adminDetails.name,
  //       email: adminDetails.email,
  //       password: await bcrypt.hash(adminDetails.password, 10),
  //       role: "admin",
  //       status: "active",
  //       profile: {
  //         phone: adminDetails.phone,
  //         address: adminDetails.address,
  //       },
  //     });
  //     await admin.save();

  //     res.status(201).json({
  //       message: "School registered successfully",
  //       school: {
  //         ...school.toObject(),
  //         paymentConfig: {
  //           ...school.paymentConfig,
  //           razorpayKeySecret: undefined, // Don't expose secret
  //         },
  //       },
  //       admin: { ...admin.toObject(), password: undefined },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  // registerSchool: async (req, res) => {
  //   try {
  //     const {
  //       name,
  //       address,
  //       contact,
  //       email,
  //       adminDetails,
  //       subscriptionDetails,
  //       rteQuota,
  //       customFormFields,
  //       paymentConfigs // Array of payment configurations
  //     } = req.body;


  //     let logo = null;
  //     if (req.file) {
  //       const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  //       const maxSize = 5 * 1024 * 1024; // 5MB
  //       if (!allowedTypes.includes(req.file.mimetype)) {
  //         return res.status(400).json({ error: 'Logo must be a PNG or JPEG image' });
  //       }
  //       if (req.file.size > maxSize) {
  //         return res.status(400).json({ error: 'Logo size must not exceed 5MB' });
  //       }

  //       // Upload logo to S3
  //       const logoKey = `school_logos/${Date.now()}_${req.file.originalname}`;
  //       await uploadToS3(req.file.buffer, logoKey, req.file.mimetype);
  //       logo = {
  //         key: logoKey,
  //         url: getPublicFileUrl(logoKey)
  //       };
  //     }

  //     const ownerConnection = await getOwnerConnection();
  //     const School = require("../models/School")(ownerConnection);

  //     // Generate unique dbName
  //     const sanitizedName = name
  //       .toLowerCase()
  //       .replace(/\s+/g, "_")
  //       .replace(/[^a-z0-9_]/g, "")
  //       .substring(0, 16);
  //     const timestamp = Date.now().toString().slice(-6);
  //     const dbName = `school_${sanitizedName}_${timestamp}`;

  //     // Validate and encrypt payment configurations
  //     const encryptedPaymentConfigs = paymentConfigs?.map(config => {
  //       const details = { ...config.details };
  //       if (config.paymentType === 'razorpay') {
  //         details.razorpayKeyId = encrypt(details.razorpayKeyId);
  //         details.razorpayKeySecret = encrypt(details.razorpayKeySecret);
  //       } else if (config.paymentType === 'stripe') {
  //         details.stripePublishableKey = encrypt(details.stripePublishableKey);
  //         details.stripeSecretKey = encrypt(details.stripeSecretKey);
  //       } else if (config.paymentType === 'paytm') {
  //         details.paytmMid = encrypt(details.paytmMid);
  //         details.paytmMerchantKey = encrypt(details.paytmMerchantKey);
  //       }
  //       return {
  //         paymentType: config.paymentType,
  //         isActive: config.isActive ?? true,
  //         details
  //       };
  //     }) || [];

  //     const school = new School({
  //       name,
  //       address,
  //       contact,
  //       email,
  //       dbName,
  //       subscriptionStatus: "active",
  //       subscriptionDetails: {
  //         plan: subscriptionDetails.plan,
  //         startDate: new Date(),
  //         endDate: subscriptionDetails.endDate,
  //         paymentStatus: subscriptionDetails.paymentStatus,
  //         amount: subscriptionDetails.amount,
  //       },
  //       rteQuota,
  //       customFormFields,
  //        paymentConfig: encryptedPaymentConfigs,
  //        logo
  //     });
  //     await school.save();

  //     const schoolConnection = await getSchoolConnection(school._id);
  //     const User = require("../models/User")(schoolConnection);

  //     const admin = new User({
  //       school: school._id,
  //       name: adminDetails.name,
  //       email: adminDetails.email,
  //       password: await bcrypt.hash(adminDetails.password, 10),
  //       role: "admin",
  //       status: "active",
  //       profile: {
  //         phone: adminDetails.phone,
  //         address: adminDetails.address,
  //       },
  //     });
  //     await admin.save();

  //     res.status(201).json({
  //       message: "School registered successfully",
  //       school: {
  //         ...school.toObject(),
  //         paymentConfig: school.paymentConfig.map(config => ({
  //           ...config,
  //           details: {
  //             ...config.details,
  //             razorpayKeySecret: undefined,
  //             stripeSecretKey: undefined,
  //             paytmMerchantKey: undefined
  //           }
  //         })),
  //         logo
  //       },
  //       admin: { ...admin.toObject(), password: undefined },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  registerSchool: async (req, res) => {
    try {
      // Parse JSON string fields
      let {
        name,
        address,
        contact,
        email,
        adminDetails,
        subscriptionDetails,
        rteQuota,
        customFormFields,
        paymentConfigs
      } = req.body;

      // Parse JSON fields if they are strings
      try {
        if (typeof adminDetails === 'string') {
          adminDetails = JSON.parse(adminDetails);
        }
        if (typeof subscriptionDetails === 'string') {
          subscriptionDetails = JSON.parse(subscriptionDetails);
        }
        if (typeof rteQuota === 'string') {
          rteQuota = JSON.parse(rteQuota);
        }
        if (typeof customFormFields === 'string') {
          customFormFields = JSON.parse(customFormFields);
        }
        if (typeof paymentConfigs === 'string') {
          paymentConfigs = JSON.parse(paymentConfigs);
        }
      } catch (jsonError) {
        return res.status(400).json({ error: `Invalid JSON format in one of the fields: ${jsonError.message}` });
      }

      // Validate required fields
      if (!name || !address || !contact || !email || !adminDetails || !subscriptionDetails) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate logo file
      let logo = null;
      if (req.file) {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ error: 'Logo must be a PNG or JPEG image' });
        }
        if (req.file.size > maxSize) {
          return res.status(400).json({ error: 'Logo size must not exceed 5MB' });
        }

        // Upload logo to S3
        const logoKey = `school_logos/${Date.now()}_${req.file.originalname}`;
        await uploadToS3(req.file.buffer, logoKey, req.file.mimetype);
        logo = {
          key: logoKey,
          url: getPublicFileUrl(logoKey)
        };
      }

      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);

      // Generate unique dbName
      const sanitizedName = name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .substring(0, 16);
      const timestamp = Date.now().toString().slice(-6);
      const dbName = `school_${sanitizedName}_${timestamp}`;

      // Validate and encrypt payment configurations
      const encryptedPaymentConfigs = paymentConfigs?.map(config => {
        const details = { ...config.details };
        if (config.paymentType === 'razorpay') {
          details.razorpayKeyId = encrypt(details.razorpayKeyId);
          details.razorpayKeySecret = encrypt(details.razorpayKeySecret);
        } else if (config.paymentType === 'stripe') {
          details.stripePublishableKey = encrypt(details.stripePublishableKey);
          details.stripeSecretKey = encrypt(details.stripeSecretKey);
        } else if (config.paymentType === 'paytm') {
          details.paytmMid = encrypt(details.paytmMid);
          details.paytmMerchantKey = encrypt(details.paytmMerchantKey);
        }
        return {
          paymentType: config.paymentType,
          isActive: config.isActive ?? true,
          details
        };
      }) || [];

      const school = new School({
        name,
        address,
        contact,
        email,
        dbName,
        subscriptionStatus: "active",
        subscriptionDetails: {
          plan: subscriptionDetails.plan,
          startDate: new Date(),
          endDate: subscriptionDetails.endDate,
          paymentStatus: subscriptionDetails.paymentStatus,
          amount: subscriptionDetails.amount,
        },
        rteQuota,
        customFormFields,
        paymentConfig: encryptedPaymentConfigs,
        logo // Add logo to the school document
      });
      await school.save();

      const schoolConnection = await getSchoolConnection(school._id);
      const User = require("../models/User")(schoolConnection);

      const admin = new User({
        school: school._id,
        name: adminDetails.name,
        email: adminDetails.email,
        password: await bcrypt.hash(adminDetails.password, 10),
        role: "admin",
        status: "active",
        profile: {
          phone: adminDetails.phone,
          address: adminDetails.address,
        },
      });
      await admin.save();

      res.status(201).json({
        message: "School registered successfully",
        school: {
          ...school.toObject(),
          paymentConfig: school.paymentConfig.map(config => ({
            ...config,
            details: {
              ...config.details,
              razorpayKeySecret: undefined,
              stripeSecretKey: undefined,
              paytmMerchantKey: undefined
            }
          })),
          logo // Include logo in response
        },
        admin: { ...admin.toObject(), password: undefined },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSchoolAdmins: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);

      // Get all schools with basic info
      const schools = await School.find().select("name dbName").lean();

      // Collect admin data for each school
      const adminData = await Promise.all(
        schools.map(async (school) => {
          const schoolConnection = await getSchoolConnection(school._id);
          const User = require("../models/User")(schoolConnection);

          const admin = await User.findOne({
            school: school._id,
            role: "admin",
          })
            .select("name email profile status")
            .lean();

          return {
            schoolId: school._id,
            schoolName: school.name,
            admin: admin
              ? {
                  id: admin._id,
                  name: admin.name,
                  email: admin.email,
                  phone: admin.profile?.phone,
                  address: admin.profile?.address,
                  status: admin.status,
                }
              : null,
          };
        })
      );

      res.json(adminData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // updatePaymentConfig: async (req, res) => {
  //   try {
  //     const { schoolId } = req.params;
  //     const { razorpayKeyId, razorpayKeySecret } = req.body;

  //     const ownerConnection = await getOwnerConnection();
  //     const School = require("../models/School").model(ownerConnection);

  //     const school = await School.findById(schoolId);
  //     if (!school) {
  //       return res.status(404).json({ message: "School not found" });
  //     }

  //     // Encrypt new credentials
  //     const encryptedKeyId = encrypt(razorpayKeyId);
  //     const encryptedKeySecret = encrypt(razorpayKeySecret);

  //     school.paymentConfig = {
  //       razorpayKeyId: encryptedKeyId,
  //       razorpayKeySecret: encryptedKeySecret,
  //       isPaymentConfigured: true,
  //     };

  //     await school.save();

  //     res.json({
  //       message: "Payment configuration updated successfully",
  //       paymentConfig: {
  //         razorpayKeyId: razorpayKeyId, // Return plain keyId for confirmation
  //         isPaymentConfigured: true,
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  updatePaymentConfig: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { paymentConfigs } = req.body;

      const ownerConnection = await getOwnerConnection();
      const School = require("../models/School")(ownerConnection);

      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      const encryptedPaymentConfigs = paymentConfigs.map(config => {
        const details = { ...config.details };
        if (config.paymentType === 'razorpay') {
          details.razorpayKeyId = encrypt(details.razorpayKeyId);
          details.razorpayKeySecret = encrypt(details.razorpayKeySecret);
        } else if (config.paymentType === 'stripe') {
          details.stripePublishableKey = encrypt(details.stripePublishableKey);
          details.stripeSecretKey = encrypt(details.stripeSecretKey);
        } else if (config.paymentType === 'paytm') {
          details.paytmMid = encrypt(details.paytmMid);
          details.paytmMerchantKey = encrypt(details.paytmMerchantKey);
        }
        return {
          paymentType: config.paymentType,
          isActive: config.isActive ?? true,
          details
        };
      });

      school.paymentConfig = encryptedPaymentConfigs;
      await school.save();

      res.json({
        message: "Payment configuration updated successfully",
        paymentConfig: school.paymentConfig.map(config => ({
          ...config,
          details: {
            ...config.details,
            razorpayKeySecret: undefined,
            stripeSecretKey: undefined,
            paytmMerchantKey: undefined
          }
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getAllSchools: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model(
        "School",
        require("../models/School").schema
      );
      const schools = await School.find()
        .select(
          "name address contact email dbName subscriptionStatus subscriptionDetails rteQuota customFormFields"
        )
        .lean();

      const enrichedSchools = await Promise.all(
        schools.map(async (school) => {
          const schoolConnection = await getSchoolConnection(school._id);
          const User = require("../models/User")(schoolConnection);

          const counts = await User.aggregate([
            { $match: { school: school._id } },
            {
              $group: {
                _id: "$role",
                count: { $sum: 1 },
              },
            },
          ]);

          const stats = {
            students: counts.find((c) => c._id === "student")?.count || 0,
            teachers: counts.find((c) => c._id === "teacher")?.count || 0,
            staff: counts
              .filter((c) => !["student", "teacher", "admin"].includes(c._id))
              .reduce((acc, curr) => acc + curr.count, 0),
          };

          return { ...school, statistics: stats };
        })
      );

      res.json(enrichedSchools);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getConsolidatedReports: async (req, res) => {
    try {
      const ownerConnection = await getOwnerConnection();
      // const School = ownerConnection.model('School', require('../models/School').schema);
      const getModel = require("../models/index");
      const School = getModel("School", ownerConnection);
      const schools = await School.find().lean();

      const subscriptionStats = {
        total: schools.length,
        active: schools.filter((s) => s.subscriptionStatus === "active").length,
        inactive: schools.filter((s) => s.subscriptionStatus === "inactive")
          .length,
        pending: schools.filter((s) => s.subscriptionStatus === "pending")
          .length,
        revenue: schools.reduce(
          (acc, school) => acc + (school.subscriptionDetails?.amount || 0),
          0
        ),
      };

      const rteStats = {
        totalSeats: schools.reduce(
          (acc, school) => acc + (school.rteQuota?.totalSeats || 0),
          0
        ),
        occupiedSeats: schools.reduce(
          (acc, school) => acc + (school.rteQuota?.occupied || 0),
          0
        ),
        averageCompliance:
          schools.reduce((acc, school) => {
            const compliance = school.rteQuota?.totalSeats
              ? (school.rteQuota.occupied / school.rteQuota.totalSeats) * 100
              : 0;
            return acc + compliance;
          }, 0) / schools.length || 0,
      };

      let userStats = { total: 0, active: 0 };
      let libraryStats = { totalBooks: 0, availableBooks: 0 };
      let feeStats = { totalCollected: 0, totalPending: 0, rteFeesWaived: 0 };

      await Promise.all(
        schools.map(async (school) => {
          const schoolConnection = await getSchoolConnection(school._id);
          const User = require("../models/User")(schoolConnection);
          const Library = require("../models/Library")(schoolConnection);
          const Fee = require("../models/Fee")(schoolConnection);

          const userData = await User.aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: {
                  $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                },
              },
            },
          ]);
          userStats.total += userData[0]?.total || 0;
          userStats.active += userData[0]?.active || 0;

          const libData = await Library.aggregate([
            {
              $group: {
                _id: null,
                totalBooks: { $sum: "$quantity" },
                availableBooks: { $sum: "$availableQuantity" },
              },
            },
          ]);
          libraryStats.totalBooks += libData[0]?.totalBooks || 0;
          libraryStats.availableBooks += libData[0]?.availableBooks || 0;

          const feeData = await Fee.aggregate([
            {
              $group: {
                _id: null,
                totalCollected: {
                  $sum: { $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0] },
                },
                totalPending: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0],
                  },
                },
                rteFeesWaived: {
                  $sum: { $cond: [{ $eq: ["$isRTE", true] }, "$amount", 0] },
                },
              },
            },
          ]);
          feeStats.totalCollected += feeData[0]?.totalCollected || 0;
          feeStats.totalPending += feeData[0]?.totalPending || 0;
          feeStats.rteFeesWaived += feeData[0]?.rteFeesWaived || 0;
        })
      );

      res.json({
        subscriptionStats,
        rteStats,
        userStats,
        libraryStats,
        feeStats,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getSchoolData: async (req, res) => {
    try {
      const { schoolId } = req.params;
      console.log("SchoolId:", schoolId);

      console.log("Getting owner connection...");
      const ownerConnection = await getOwnerConnection();
      console.log("Owner connection successful:", !!ownerConnection);

      console.log("Getting School model...");
      const getModel = require("../models/index");
      const School = getModel("School", ownerConnection);
      console.log("School model retrieved:", !!School);

      console.log("Fetching school data...");
      const schoolData = await School.findById(schoolId).lean();
      if (!schoolData) {
        return res.status(404).json({ error: "School not found" });
      }
      console.log("School data retrieved:", !!schoolData);

      const schoolConnection = await getSchoolConnection(schoolId);
      const User = getModel("User", schoolConnection);

      // Fetch detailed user data for students
      const students = await User.find({
        school: new mongoose.Types.ObjectId(schoolId),
        role: "student",
      })
        .select("name email status profile studentDetails")
        .lean();

      // Fetch detailed user data for staff (excluding students and owners)
      const staff = await User.find({
        school: new mongoose.Types.ObjectId(schoolId),
        role: { $nin: ["student", "owner"] }, // Exclude students and owners
      })
        .select("name email role status profile")
        .lean();

      // Aggregate user counts by role for statistics
      const userCounts = await User.aggregate([
        { $match: { school: new mongoose.Types.ObjectId(schoolId) } },
        {
          $group: {
            _id: "$role",
            activeCount: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            totalCount: { $sum: 1 },
          },
        },
      ]);

      // Optionally, add more detailed statistics (e.g., RTE students)
      const rteStudents = students.filter(
        (student) => student.studentDetails?.admissionType === "RTE"
      ).length;

      res.json({
        school: {
          ...schoolData,
          paymentConfig: {
            ...schoolData.paymentConfig,
            razorpayKeySecret: undefined, // Hide sensitive data
          },
        },
        statistics: {
          users: {
            byRole: userCounts.reduce(
              (acc, role) => ({
                ...acc,
                [role._id]: {
                  active: role.activeCount,
                  total: role.totalCount,
                },
              }),
              {}
            ),
            rteStudents: {
              total: rteStudents,
              percentage: schoolData.rteQuota?.totalSeats
                ? (
                    (rteStudents / schoolData.rteQuota.totalSeats) *
                    100
                  ).toFixed(2)
                : 0,
            },
          },
          students: students.map((student) => ({
            id: student._id,
            name: student.name,
            email: student.email,
            status: student.status,
            phone: student.profile?.phone,
            address: student.profile?.address,
            grNumber: student.studentDetails?.grNumber,
            classId: student.studentDetails?.class,
            admissionType: student.studentDetails?.admissionType,
            dob: student.studentDetails?.dob,
            gender: student.studentDetails?.gender,
            parentDetails: student.studentDetails?.parentDetails,
          })),
          staff: staff.map((staffMember) => ({
            id: staffMember._id,
            name: staffMember.name,
            email: staffMember.email,
            role: staffMember.role,
            status: staffMember.status,
            phone: staffMember.profile?.phone,
            address: staffMember.profile?.address,
          })),
        },
      });
    } catch (error) {
      console.error("Error in getSchoolData:", error);
      res.status(500).json({ error: error.message });
    }
  },

  updateSubscription: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { status, details } = req.body;

      const ownerConnection = await getOwnerConnection();
      const School = ownerConnection.model(
        "School",
        require("../models/School").schema
      );

      const school = await School.findByIdAndUpdate(
        schoolId,
        {
          subscriptionStatus: status,
          subscriptionDetails: { ...details, updatedAt: new Date() },
        },
        { new: true }
      );

      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      if (status === "inactive") {
        const schoolConnection = await getSchoolConnection(schoolId);
        const User = require("../models/User")(schoolConnection);
        await User.updateMany({ school: schoolId }, { status: "inactive" });
      }

      res.json({ message: "Subscription updated successfully", school });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  updateAdminCredentials: async (req, res) => {
    try {
      const { schoolId } = req.params;
      const { adminDetails } = req.body;

      const schoolConnection = await getSchoolConnection(schoolId);
      const User = require("../models/User")(schoolConnection);

      const updateData = {
        name: adminDetails.name,
        email: adminDetails.email,
        profile: {
          phone: adminDetails.phone,
          address: adminDetails.address,
        },
      };

      // Only hash password if it's provided
      if (adminDetails.password) {
        updateData.password = await bcrypt.hash(adminDetails.password, 10);
      }

      const admin = await User.findOneAndUpdate(
        { school: schoolId, role: "admin" },
        updateData,
        { new: true }
      ).select("-password");

      if (!admin) {
        return res.status(404).json({ message: "Admin not found" });
      }

      res.json({
        message: "Admin credentials updated successfully",
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.profile?.phone,
          address: admin.profile?.address,
          status: admin.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = ownerController;
