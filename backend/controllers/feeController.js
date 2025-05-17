const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const cloudinary = require("cloudinary").v2;
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Fee = require("../models/Fee");
const Class = require("../models/Class");
const User = require("../models/User");
const Payment = require("../models/Payment");
const { checkRTEExemption } = require("../utils/rteUtils");
const logger = require("../utils/logger");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { generateFeeSlip } = require("../utils/generateFeeSlip");
// const { generateFeeSlip } = require("../utils/helpers");
const { sendPaymentConfirmation } = require("../utils/notifications");
const { deleteFromS3 } = require("../config/s3Upload");
const s3Upload = require("../config/s3Upload");
const AuditLog = require("../models/AuditLog");
const {getOwnerConnection}= require("../config/database");

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const logFeeAction = async (
  connection,
  schoolId,
  userId,
  action,
  description,
  metadata = {}
) => {
  try {
    const AuditLogModel = AuditLog(connection);
    const auditLog = new AuditLogModel({
      school: schoolId,
      user: userId || null,
      action,
      description,
      metadata,
      timestamp: new Date(),
    });
    await auditLog.save();
    logger.info(`Audit log created: ${action} - ${description}`);
  } catch (error) {
    logger.error(`Error logging audit action: ${error.message}`, { error });
  }
};

const feesController = {
  defineFeesForYear: async (req, res) => {
    try {
      const { year, month, classIds, feeTypes } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = require("../models/Fee")(connection);
      const ClassModel = require("../models/Class")(connection);
      const UserModel = require("../models/User")(connection);
      const mongoose = require("mongoose");

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can define fees",
        });
      }

      const classes = await ClassModel.find({
        _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
        school: schoolId,
      });

      if (classes.length !== classIds.length) {
        const foundClassIds = classes.map((c) => c._id.toString());
        const invalidClassIds = classIds.filter(
          (id) => !foundClassIds.includes(id)
        );
        return res.status(404).json({
          message: "One or more classes not found",
          invalidClassIds,
        });
      }

      const months = month
        ? [parseInt(month)]
        : Array.from({ length: 12 }, (_, i) => i + 1);

      const transportationFeeTypes = feeTypes.filter(
        (fee) => fee.type === "transportation"
      );
      const slabs = transportationFeeTypes.map(
        (fee) => fee.transportationDetails?.distanceSlab
      );
      const uniqueSlabs = new Set(slabs);

      if (slabs.length !== uniqueSlabs.size) {
        return res.status(400).json({
          message: "Duplicate transportation distance slabs are not allowed",
          duplicateSlabs: slabs.filter(
            (slab, index) => slabs.indexOf(slab) !== index
          ),
        });
      }

      const feesToCreate = [];
      const studentSpecificFees = [];

      const students = await UserModel.find({
        "studentDetails.class": { $in: classIds },
        role: "student",
        school: schoolId,
        "studentDetails.transportDetails.isApplicable": true,
      }).select(
        "_id studentDetails.transportDetails studentDetails.grNumber studentDetails.class"
      );

      for (const cls of classes) {
        for (const feeType of feeTypes) {
          for (const m of months) {
            if (feeType.type !== "transportation") {
              const existingFee = await FeeModel.findOne({
                school: schoolId,
                student: null,
                type: feeType.type,
                month: m,
                year: parseInt(year),
                classes: cls._id,
              });

              if (existingFee) continue;

              feesToCreate.push({
                school: schoolId,
                classes: [cls._id],
                type: feeType.type,
                amount: feeType.amount,
                remainingAmount: feeType.amount,
                year: parseInt(year),
                month: m,
                description:
                  feeType.description ||
                  `${feeType.type} fee for ${cls.name} ${cls.division}`,
                status: "pending",
                dueDate: feeType.dueDate
                  ? new Date(new Date(feeType.dueDate).setMonth(m - 1))
                  : new Date(year, m - 1, 28),
              });
            } else {
              const slab = feeType.transportationDetails?.distanceSlab;

              const existingTransportFee = await FeeModel.findOne({
                school: schoolId,
                student: null,
                type: "transportation",
                month: m,
                year: parseInt(year),
                classes: cls._id,
                "transportationDetails.distanceSlab": slab,
              });

              if (existingTransportFee) continue;

              feesToCreate.push({
                school: schoolId,
                classes: [cls._id],
                type: "transportation",
                amount: feeType.amount,
                remainingAmount: feeType.amount,
                year: parseInt(year),
                month: m,
                description:
                  feeType.description ||
                  `Transportation fee (${slab}) for ${cls.name} ${cls.division}`,
                status: "pending",
                dueDate: feeType.dueDate
                  ? new Date(new Date(feeType.dueDate).setMonth(m - 1))
                  : new Date(year, m - 1, 28),
                transportationDetails: {
                  distanceSlab: slab,
                  isApplicable: true,
                },
              });

              const relevantStudents = students.filter(
                (student) =>
                  student.studentDetails.class.toString() ===
                    cls._id.toString() &&
                  student.studentDetails.transportDetails?.distanceSlab === slab
              );

              for (const student of relevantStudents) {
                const existingStudentFee = await FeeModel.findOne({
                  school: schoolId,
                  student: student._id,
                  type: "transportation",
                  month: m,
                  year: parseInt(year),
                  "transportationDetails.distanceSlab": slab,
                });

                if (existingStudentFee) continue;

                studentSpecificFees.push({
                  school: schoolId,
                  student: student._id,
                  grNumber: student.studentDetails.grNumber,
                  classes: [cls._id],
                  type: "transportation",
                  amount: feeType.amount,
                  remainingAmount: feeType.amount,
                  year: parseInt(year),
                  month: m,
                  description:
                    feeType.description ||
                    `Transportation fee (${slab}) for ${cls.name} ${cls.division}`,
                  status: "pending",
                  dueDate: feeType.dueDate
                    ? new Date(new Date(feeType.dueDate).setMonth(m - 1))
                    : new Date(year, m - 1, 28),
                  transportationDetails: {
                    distanceSlab: slab,
                    isApplicable: true,
                  },
                });
              }
            }
          }
        }
      }

      if (feesToCreate.length === 0 && studentSpecificFees.length === 0) {
        return res.status(409).json({
          message:
            "All specified fees already exist for the selected classes and year",
        });
      }

      const allFeesToCreate = [...feesToCreate, ...studentSpecificFees];
      await FeeModel.insertMany(allFeesToCreate);

      await logFeeAction(
        connection,
        schoolId,
        req.user._id,
        "DEFINE_FEES",
        `Defined fees for year ${year} for classes ${classes.map(
          (c) => c._id
        )}`,
        {
          year,
          classIds,
          feeTypes,
          insertedCount: allFeesToCreate.length,
        }
      );

      logger.info(
        `Fees defined for year ${year}, classes ${classes.map((c) => c._id)}`
      );
      res.status(201).json({
        message: "Fees defined successfully",
        count: allFeesToCreate.length,
      });
    } catch (error) {
      logger.error(`Error defining fees: ${error.message}`, { error });

      if (error.code === 11000) {
        return res.status(409).json({
          message: "Duplicate fee definitions detected",
          error: error.message,
          suggestion:
            "Some fees may already exist. Try with different parameters or delete existing fees first.",
        });
      }

      res.status(500).json({ error: error.message });
    }
  },

  getFeeDefinitionsByYear: async (req, res) => {
    try {
      const { year } = req.params;
      const { classId } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = require("../models/Fee")(connection);
      const ClassModel = require("../models/Class")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view fee definitions",
        });
      }

      if (!Number.isInteger(Number(year))) {
        return res
          .status(400)
          .json({ message: "Year must be a valid integer" });
      }

      const query = {
        school: schoolId,
        student: null,
        year: parseInt(year),
      };

      let classes = [];
      if (classId) {
        const validClass = await ClassModel.findById(classId);
        if (!validClass) {
          return res.status(400).json({ message: "Invalid class ID" });
        }
        query.classes = classId;
        classes = [validClass];
      } else {
        classes = await ClassModel.find({ school: schoolId });
        query.classes = { $in: classes.map((c) => c._id) };
      }

      const feeDefinitions = await FeeModel.find(query)
        .populate("classes", "name division")
        .sort({ type: 1, month: 1 });

      if (!feeDefinitions.length) {
        return res.status(404).json({
          message: `No fee definitions found for ${year}${
            classId ? " and specified class" : ""
          }`,
        });
      }

      const feeSummary = {};
      feeDefinitions.forEach((fee) => {
        const classKey = fee.classes
          .map((c) => `${c.name}-${c.division}`)
          .join(", ");
        const summaryKey = `${fee.type}_${classKey}_${fee.month}`;

        if (!feeSummary[summaryKey]) {
          feeSummary[summaryKey] = {
            type: fee.type,
            classes: fee.classes,
            amount: fee.amount,
            description: fee.description,
            isConsistent: true,
            monthlyDetails: {},
            transportationSlab: fee.transportationDetails?.distanceSlab,
          };
        }

        feeSummary[summaryKey].monthlyDetails[fee.month] = {
          amount: fee.amount,
          dueDate: fee.dueDate,
          description: fee.description,
          status: fee.status,
          id: fee._id,
        };

        if (fee.amount !== feeSummary[summaryKey].amount) {
          feeSummary[summaryKey].isConsistent = false;
        }
      });

      const responseData = {
        year: parseInt(year),
        fees: {},
      };

      for (const [key, data] of Object.entries(feeSummary)) {
        const type = data.type;
        if (!responseData.fees[type]) {
          responseData.fees[type] = [];
        }

        const feeData = {
          classes: data.classes.map((c) => ({
            _id: c._id,
            name: c.name,
            division: c.division,
          })),
          description: data.description,
          ...(data.transportationSlab && {
            transportationSlab: data.transportationSlab,
          }),
        };

        if (data.isConsistent) {
          feeData.annualAmount = data.amount * 12;
          feeData.monthlyAmount = data.amount;
          feeData.status = Object.values(data.monthlyDetails).every(
            (d) => d.status === "pending"
          )
            ? "pending"
            : "mixed";
        } else {
          feeData.annualAmount = Object.values(data.monthlyDetails).reduce(
            (sum, d) => sum + d.amount,
            0
          );
          feeData.monthlyBreakdown = data.monthlyDetails;
        }

        responseData.fees[type].push(feeData);
      }

      res.json(responseData);
    } catch (error) {
      logger.error(`Error fetching fee definitions: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // editFeesForYear: async (req, res) => {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();
  //   try {
  //     const { year, feeUpdates, classIds, applyToAllMonths = true } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = require("../models/Fee")(connection);
  //     const ClassModel = require("../models/Class")(connection);

  //     if (!req.user.permissions.canManageFees) {
  //       return res.status(403).json({
  //         message: "Unauthorized: Only fee managers can edit fees",
  //       });
  //     }

  //     // Fetch classes based on classIds
  //     const classes = await ClassModel.find({
  //       _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
  //       school: schoolId,
  //     }).session(session);
  //     if (classes.length !== classIds.length) {
  //       return res
  //         .status(400)
  //         .json({ message: "One or more class IDs are invalid" });
  //     }

  //     const validFeeTypes = [
  //       "school",
  //       "computer",
  //       "transportation",
  //       "examination",
  //       "classroom",
  //       "educational",
  //       "library",
  //     ];

  //     const validationErrors = [];
  //     feeUpdates.forEach((update, index) => {
  //       const { type, amount, description, months, transportationSlab } =
  //         update;

  //       if (!validFeeTypes.includes(type)) {
  //         validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
  //       }
  //       if (
  //         typeof amount !== "number" ||
  //         amount <= 0 ||
  //         !Number.isFinite(amount)
  //       ) {
  //         validationErrors.push(
  //           `Invalid amount for ${type} at index ${index}: ${amount}`
  //         );
  //       }
  //       if (description && typeof description !== "string") {
  //         validationErrors.push(
  //           `Description must be a string for ${type} at index ${index}`
  //         );
  //       }
  //       if (
  //         !applyToAllMonths &&
  //         (!months ||
  //           !Array.isArray(months) ||
  //           months.some((m) => !Number.isInteger(m) || m < 1 || m > 12))
  //       ) {
  //         validationErrors.push(
  //           `Invalid months array for ${type} at index ${index}`
  //         );
  //       }
  //       if (
  //         type === "transportation" &&
  //         transportationSlab &&
  //         !["0-10km", "10-20km", "20-30km", "30+km"].includes(
  //           transportationSlab
  //         )
  //       ) {
  //         validationErrors.push(
  //           `Invalid transportation slab for ${type} at index ${index}: ${transportationSlab}`
  //         );
  //       }
  //     });

  //     if (validationErrors.length > 0) {
  //       return res
  //         .status(400)
  //         .json({ message: "Validation failed", errors: validationErrors });
  //     }

  //     const existingFees = await FeeModel.find({
  //       school: schoolId,
  //       student: { $exists: false },
  //       year: parseInt(year),
  //       classes: { $in: classes.map((c) => c._id) },
  //     }).session(session);

  //     if (!existingFees.length) {
  //       return res.status(404).json({
  //         message: `No fee definitions found for ${year} and specified classes to edit`,
  //       });
  //     }

  //     const operations = [];
  //     for (const update of feeUpdates) {
  //       const { type, amount, description, months, transportationSlab } =
  //         update;
  //       const targetMonths = applyToAllMonths
  //         ? Array.from({ length: 12 }, (_, i) => i + 1)
  //         : months;

  //       for (const month of targetMonths) {
  //         for (const cls of classes) {
  //           const existingFee = existingFees.find(
  //             (f) =>
  //               f.type === type &&
  //               f.month === month &&
  //               f.classes.includes(cls._id)
  //           );

  //           const feeData = {
  //             amount,
  //             remainingAmount: amount,
  //             description:
  //               description ||
  //               existingFee?.description ||
  //               `${type} fee for ${month}/${year}`,
  //             dueDate: new Date(year, month - 1, 28),
  //             updatedAt: new Date(),
  //             ...(type === "transportation" &&
  //               transportationSlab && {
  //                 transportationDetails: {
  //                   distanceSlab: transportationSlab,
  //                   isApplicable: true,
  //                 },
  //               }),
  //           };

  //           if (existingFee) {
  //             operations.push({
  //               updateOne: {
  //                 filter: { _id: existingFee._id },
  //                 update: { $set: feeData },
  //               },
  //             });
  //           } else {
  //             operations.push({
  //               insertOne: {
  //                 document: {
  //                   school: schoolId,
  //                   classes: [cls._id],
  //                   type,
  //                   amount,
  //                   remainingAmount: amount,
  //                   dueDate: new Date(year, month - 1, 28),
  //                   month,
  //                   year: parseInt(year),
  //                   description:
  //                     description || `${type} fee for ${month}/${year}`,
  //                   status: "pending",
  //                   createdAt: new Date(),
  //                   updatedAt: new Date(),
  //                   ...(type === "transportation" &&
  //                     transportationSlab && {
  //                       transportationDetails: {
  //                         distanceSlab: transportationSlab,
  //                         isApplicable: true,
  //                       },
  //                     }),
  //                 },
  //               },
  //             });
  //           }
  //         }
  //       }
  //     }

  //     const result = await FeeModel.bulkWrite(operations, { session });

  //     await logFeeAction(
  //       connection,
  //       schoolId,
  //       req.user._id,
  //       "EDIT_FEES",
  //       `Edited fees for year ${year} for classes ${classes
  //         .map((c) => c.name)
  //         .join(", ")}`,
  //       {
  //         year,
  //         classIds,
  //         feeUpdates,
  //         updatedCount: result.modifiedCount,
  //         createdCount: result.insertedCount,
  //       }
  //     );

  //     await session.commitTransaction();
  //     logger.info(
  //       `Fees edited for year ${year}, classes ${classes.map((c) => c._id)}: ${
  //         result.modifiedCount
  //       } updated, ${result.insertedCount} created`
  //     );

  //     res.status(200).json({
  //       message: `Fees for ${year} updated successfully`,
  //       updatedCount: result.modifiedCount,
  //       createdCount: result.insertedCount,
  //       totalAffected: result.modifiedCount + result.insertedCount,
  //     });
  //   } catch (error) {
  //     await session.abortTransaction();
  //     logger.error(`Error editing fees: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   } finally {
  //     session.endSession();
  //   }
  // },



 editFeesForYear: async (req, res) => {
  try {
    const { year, feeUpdates, classIds, applyToAllMonths = true } = req.body;
    const schoolId = req.school._id; // Keep as ObjectId
    const connection = req.connection;
    const FeeModel = require("../models/Fee")(connection);
    const ClassModel = require("../models/Class")(connection);

    if (!req.user.permissions.canManageFees) {
      return res.status(403).json({
        message: "Unauthorized: Only fee managers can edit fees",
      });
    }

    // Validate connection state
    if (connection.readyState !== 1) {
      logger.error("MongoDB connection not ready", { readyState: connection.readyState });
      return res.status(503).json({ message: "Database connection not ready" });
    }

    // Fetch classes based on classIds
    const classes = await ClassModel.find({
      _id: { $in: classIds.map((id) => new mongoose.Types.ObjectId(id)) },
      school: schoolId,
    });
    if (classes.length !== classIds.length) {
      return res.status(400).json({ message: "One or more class IDs are invalid" });
    }

    const validFeeTypes = [
      "school",
      "computer",
      "transportation",
      "examination",
      "classroom",
      "educational",
      "library",
      "sport",
    ];

    // Validate fee updates
    const validationErrors = [];
    feeUpdates.forEach((update, index) => {
      const { type, amount, description, months, transportationSlab } = update;
      if (!validFeeTypes.includes(type)) {
        validationErrors.push(`Invalid fee type at index ${index}: ${type}`);
      }
      if (typeof amount !== "number" || amount <= 0 || !Number.isFinite(amount)) {
        validationErrors.push(
          `Invalid amount for ${type} at index ${index}: ${amount}`
        );
      }
      if (description && typeof description !== "string") {
        validationErrors.push(
          `Description must be a string for ${type} at index ${index}`
        );
      }
      if (
        !applyToAllMonths &&
        (!months ||
          !Array.isArray(months) ||
          months.some((m) => !Number.isInteger(m) || m < 1 || m > 12))
      ) {
        validationErrors.push(
          `Invalid months array for ${type} at index ${index}`
        );
      }
      if (
        type === "transportation" &&
        transportationSlab &&
        !["0-10km", "10-20km", "20-30km", "30+km"].includes(transportationSlab)
      ) {
        validationErrors.push(
          `Invalid transportation slab for ${type} at index ${index}: ${transportationSlab}`
        );
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Query existing fees with precise matching
    const existingFees = await FeeModel.find({
      school: schoolId,
      student: null, // Only general fees
      year: parseInt(year),
      classes: { $in: classes.map((c) => c._id) },
    });

    logger.info("Existing fees found", {
      count: existingFees.length,
      fees: existingFees.map((f) => ({
        _id: f._id.toString(),
        type: f.type,
        month: f.month,
        year: f.year,
        classes: f.classes.map((c) => c.toString()),
        transportationSlab: f.transportationDetails?.distanceSlab,
      })),
    });

    const operations = [];
    for (const update of feeUpdates) {
      const { type, amount, description, months, transportationSlab } = update;
      const targetMonths = applyToAllMonths
        ? Array.from({ length: 12 }, (_, i) => i + 1)
        : months;

      for (const month of targetMonths) {
        for (const cls of classes) {
          // Find matching existing fee
          const existingFee = existingFees.find((f) => {
            const matchesType = f.type === type;
            const matchesMonth = f.month === month;
            const matchesYear = f.year === parseInt(year);
            const matchesClass = f.classes.some((c) => c.equals(cls._id));
            const matchesSlab =
              type !== "transportation" ||
              f.transportationDetails?.distanceSlab === transportationSlab ||
              (!f.transportationDetails?.distanceSlab && !transportationSlab);
            return (
              matchesType && matchesMonth && matchesYear && matchesClass && matchesSlab
            );
          });

          const feeData = {
            amount,
            remainingAmount: amount,
            description: description || `${type} fee for ${month}/${year}`,
            dueDate: new Date(year, month - 1, 28),
            updatedAt: new Date(),
            ...(type === "transportation" &&
              transportationSlab && {
                transportationDetails: {
                  distanceSlab: transportationSlab,
                  isApplicable: true,
                },
              }),
          };

          if (existingFee) {
            logger.debug(`Updating existing fee`, {
              feeId: existingFee._id.toString(),
              type,
              month,
              year,
              classId: cls._id.toString(),
            });
            operations.push({
              updateOne: {
                filter: { _id: existingFee._id },
                update: { $set: feeData },
              },
            });
          } else {
            logger.debug(`Creating new fee`, {
              type,
              month,
              year,
              classId: cls._id.toString(),
            });
            operations.push({
              insertOne: {
                document: {
                  school: schoolId,
                  classes: [cls._id],
                  type,
                  amount,
                  remainingAmount: amount,
                  dueDate: new Date(year, month - 1, 28),
                  month,
                  year: parseInt(year),
                  description: description || `${type} fee for ${month}/${year}`,
                  status: "pending",
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  ...(type === "transportation" &&
                    transportationSlab && {
                      transportationDetails: {
                        distanceSlab: transportationSlab,
                        isApplicable: true,
                      },
                    }),
                },
              },
            });
          }
        }
      }
    }

    // Perform bulk write in chunks
    const chunkSize = 100;
    const result = {
      modifiedCount: 0,
      insertedCount: 0,
    };

    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      const chunkResult = await FeeModel.bulkWrite(chunk);
      result.modifiedCount += chunkResult.modifiedCount;
      result.insertedCount += chunkResult.insertedCount;
    }

    await logFeeAction(
      connection,
      schoolId,
      req.user._id,
      "EDIT_FEES",
      `Edited fees for year ${year} for classes ${classes
        .map((c) => c.name)
        .join(", ")}`,
      {
        year,
        classIds,
        feeUpdates,
        updatedCount: result.modifiedCount,
        createdCount: result.insertedCount,
      }
    );

    logger.info(
      `Fees edited for year ${year}, classes ${classes.map((c) => c._id)}: ${
        result.modifiedCount
      } updated, ${result.insertedCount} created`
    );

    res.status(200).json({
      message: `Fees for ${year} updated successfully`,
      updatedCount: result.modifiedCount,
      createdCount: result.insertedCount,
      totalAffected: result.modifiedCount + result.insertedCount,
    });
  } catch (error) {
    logger.error(`Error editing fees: ${error.message}`, { error });
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Duplicate fee definition detected",
        error: error.message,
      });
    }
    res.status(500).json({ error: error.message });
  }
},


  getAvailableClasses: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { academicYear, name, division } = req.query;
      const connection = req.connection;
      const ClassModel = require("../models/Class")(connection);
      const UserModel = require("../models/User")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view classes",
        });
      }

      const query = { school: schoolId };
      if (academicYear) query.academicYear = academicYear.trim();
      if (name) query.name = { $regex: `^${name.trim()}$`, $options: "i" }; // Exact match, case-insensitive
      if (division) query.division = division.trim(); // Exact match

      logger.info(`Fetching classes with query: ${JSON.stringify(query)}`);

      const classes = await ClassModel.find(query)
        .select("name division academicYear")
        .populate("classTeacher", "name", UserModel)
        .sort({ name: 1, division: 1 })
        .lean();

      if (classes.length === 0) {
        return res.status(404).json({
          message: "No classes found for the specified filters",
          filters: { academicYear, name, division },
        });
      }

      res.json({
        classes: classes.map((cls) => ({
          _id: cls._id,
          name: cls.name,
          division: cls.division,
          academicYear: cls.academicYear,
          teacher: cls.classTeacher ? cls.classTeacher.name : null,
        })),
      });
    } catch (error) {
      logger.error(`Error fetching classes: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getFeesByClassAndMonth: async (req, res) => {
    try {
      const { classId, month, year } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = require("../models/Fee")(connection);
      const UserModel = require("../models/User")(connection);
      const PaymentModel = require("../models/Payment")(connection);
      const ClassModel = require("../models/Class")(connection);
      const mongoose = require("mongoose");

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view fees",
        });
      }

      let objectIdClassId;
      try {
        objectIdClassId = new mongoose.Types.ObjectId(classId);
      } catch (error) {
        return res.status(400).json({ message: "Invalid class ID format" });
      }

      const classDoc = await ClassModel.findById(objectIdClassId);
      if (!classDoc) {
        return res.status(404).json({ message: "Class not found" });
      }

      const parsedMonth = parseInt(month);
      const parsedYear = parseInt(year);

      const students = await UserModel.find({
        "studentDetails.class": objectIdClassId,
        school: schoolId,
        role: "student",
      })
        .select(
          "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
        )
        .populate("studentDetails.class", "name division");

      const generalFeeDefinitions = await FeeModel.find({
        school: schoolId,
        student: null,
        classes: objectIdClassId,
        month: parsedMonth,
        year: parsedYear,
      });

      const studentFees = await FeeModel.find({
        school: schoolId,
        student: { $in: students.map((s) => s._id) },
        month: parsedMonth,
        year: parsedYear,
      });

      const payments = await PaymentModel.find({
        school: schoolId,
        student: { $in: students.map((s) => s._id) },
        status: "completed",
        "feesPaid.month": parsedMonth,
        "feesPaid.year": parsedYear,
      });

      // Modified: Use a Map with composite keys for fee types and slabs
      const feeTypesMap = new Map();
      generalFeeDefinitions.forEach((fee) => {
        const key =
          fee.type === "transportation" &&
          fee.transportationDetails?.distanceSlab
            ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
            : fee.type;
        feeTypesMap.set(key, {
          type: fee.type,
          defaultAmount: fee.amount,
          transportationDetails: fee.transportationDetails || null,
          dueDate: fee.dueDate,
        });
      });

      const studentFeeMap = new Map();
      studentFees.forEach((fee) => {
        const studentId = fee.student.toString();
        const key =
          fee.type === "transportation" &&
          fee.transportationDetails?.distanceSlab
            ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
            : fee.type;
        if (!studentFeeMap.has(studentId)) {
          studentFeeMap.set(studentId, new Map());
        }
        studentFeeMap.get(studentId).set(key, fee);
      });

      const paymentMap = new Map();
      payments.forEach((payment) => {
        payment.feesPaid.forEach((feePaid) => {
          if (feePaid.month === parsedMonth && feePaid.year === parsedYear) {
            const key = `${payment.student.toString()}_${feePaid.type}_${
              feePaid.transportationSlab || ""
            }`;
            const existingPayment = paymentMap.get(key) || {
              amount: 0,
              date: null,
            };
            paymentMap.set(key, {
              amount: existingPayment.amount + feePaid.amount,
              date:
                payment.paymentDate > existingPayment.date
                  ? payment.paymentDate
                  : existingPayment.date,
            });
          }
        });
      });

      const feeData = students.map((student) => {
        const studentId = student._id.toString();
        const studentSpecificFees = studentFeeMap.get(studentId) || new Map();

        const feeSummary = {
          studentId: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
          isRTE: student.studentDetails.isRTE || false,
          fees: {},
          total: 0,
          totalPaid: 0,
          totalPending: 0,
          allPaid: true,
        };

        if (feeSummary.isRTE) {
          return feeSummary;
        }

        for (const [feeKey, feeInfo] of feeTypesMap.entries()) {
          const feeType = feeInfo.type;
          // Modified: Check transportation applicability based on slab
          if (
            feeType === "transportation" &&
            (!student.studentDetails.transportDetails?.isApplicable ||
              (feeInfo.transportationDetails?.distanceSlab &&
                student.studentDetails.transportDetails?.distanceSlab !==
                  feeInfo.transportationDetails.distanceSlab))
          ) {
            continue;
          }

          const studentFee = studentSpecificFees.get(feeKey);
          let feeAmount = feeInfo.defaultAmount;

          if (studentFee && typeof studentFee.amount === "number") {
            feeAmount = studentFee.amount;
          }

          const paymentKey = `${studentId}_${feeType}_${
            feeInfo.transportationDetails?.distanceSlab || ""
          }`;
          const paymentInfo = paymentMap.get(paymentKey);
          const paidAmount = paymentInfo?.amount || 0;
          const remainingAmount = Math.max(0, feeAmount - paidAmount);

          let status = "pending";
          if (paidAmount >= feeAmount) {
            status = "paid";
          } else if (paidAmount > 0) {
            status = "partially_paid";
          }

          feeSummary.fees[feeType] = {
            amount: feeAmount,
            paidAmount: paidAmount,
            remainingAmount: remainingAmount,
            status: status,
            paidDate: paymentInfo?.date || null,
            dueDate: feeInfo.dueDate,
            ...(feeInfo.transportationDetails && {
              transportationSlab: feeInfo.transportationDetails.distanceSlab,
            }),
          };

          feeSummary.total += feeAmount;
          feeSummary.totalPaid += paidAmount;
          feeSummary.totalPending += remainingAmount;

          if (status !== "paid") {
            feeSummary.allPaid = false;
          }
        }

        return feeSummary;
      });

      await logFeeAction(
        connection,
        schoolId,
        req.user._id,
        "VIEW_FEES_BY_CLASS",
        `Viewed fees for class ${classId}, month ${month}, year ${year}`,
        { classId, month, year }
      );

      res.json(feeData);
    } catch (error) {
      logger.error(`Error fetching fees by class and month: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  // getStudentByGrNumber: async (req, res) => {
  //   try {
  //     const { grNumber } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const FeeModel = require("../models/Fee")(connection);
  //     const PaymentModel = require("../models/Payment")(connection);
  //     const UserModel = require("../models/User")(connection);
  //     const ClassModel = require("../models/Class")(connection);

  //     const student = await UserModel.findOne({
  //       "studentDetails.grNumber": grNumber,
  //       school: schoolId,
  //     })
  //       .select(
  //         "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
  //       )
  //       .populate("studentDetails.class", "name division");

  //     if (!student) {
  //       return res.status(404).json({ message: "Student not found" });
  //     }

  //     const currentYear = new Date().getFullYear();
  //     const studentFees = await FeeModel.find({
  //       school: schoolId,
  //       student: student._id,
  //       year: { $gte: currentYear, $lte: currentYear + 1 },
  //     });

  //     const payments = await PaymentModel.find({
  //       school: schoolId,
  //       student: student._id,
  //       status: "completed",
  //       year: { $gte: currentYear, $lte: currentYear + 1 },
  //     });

  //     const generalFeeDefinitions = await FeeModel.find({
  //       school: schoolId,
  //       student: null,
  //       classes: student.studentDetails.class._id,
  //       year: { $gte: currentYear, $lte: currentYear + 1 },
  //     });

  //     // Process general fee definitions
  //     const feeTypesMap = new Map();
  //     generalFeeDefinitions.forEach((fee) => {
  //       const key =
  //         fee.type === "transportation" &&
  //         fee.transportationDetails?.distanceSlab
  //           ? `${fee.type}_${fee.transportationDetails.distanceSlab}_${fee.month}_${fee.year}`
  //           : `${fee.type}_${fee.month}_${fee.year}`;
  //       feeTypesMap.set(key, {
  //         type: fee.type,
  //         amount: fee.amount,
  //         description: fee.description,
  //         dueDate: fee.dueDate,
  //         transportationDetails: fee.transportationDetails || null,
  //         month: fee.month,
  //         year: fee.year,
  //       });
  //     });

  //     // Process student-specific fees
  //     const studentFeeMap = new Map();
  //     studentFees.forEach((fee) => {
  //       const key =
  //         fee.type === "transportation" &&
  //         fee.transportationDetails?.distanceSlab
  //           ? `${fee.type}_${fee.transportationDetails.distanceSlab}_${fee.month}_${fee.year}`
  //           : `${fee.type}_${fee.month}_${fee.year}`;
  //       studentFeeMap.set(key, fee);
  //     });

  //     // Process payments
  //     const paymentMap = new Map();
  //     payments.forEach((payment) => {
  //       payment.feesPaid.forEach((feePaid) => {
  //         const key =
  //           feePaid.type === "transportation" && feePaid.transportationSlab
  //             ? `${feePaid.type}_${feePaid.transportationSlab}_${feePaid.month}_${feePaid.year}`
  //             : `${feePaid.type}_${feePaid.month}_${feePaid.year}`;
  //         const existing = paymentMap.get(key) || {
  //           amount: 0,
  //           date: null,
  //           details: [],
  //         };
  //         paymentMap.set(key, {
  //           amount: existing.amount + feePaid.amount,
  //           date:
  //             payment.paymentDate > existing.date
  //               ? payment.paymentDate
  //               : existing.date,
  //           details: [
  //             ...existing.details,
  //             {
  //               transactionId: payment.receiptNumber,
  //               paymentDate: payment.paymentDate,
  //               paymentMethod: payment.paymentMethod,
  //               receiptNumber: payment.receiptNumber,
  //               amount: feePaid.amount,
  //             },
  //           ],
  //         });
  //       });
  //     });

  //     // Construct fee data
  //     const feeData = {};
  //     const months = Array.from({ length: 12 }, (_, i) => i + 1);
  //     const years = [currentYear, currentYear + 1];

  //     years.forEach((year) => {
  //       months.forEach((month) => {
  //         const key = `${year}-${month}`;
  //         feeData[key] = {
  //           total: 0,
  //           totalPaid: 0,
  //           totalPending: 0,
  //           fees: {},
  //         };

  //         // Process fee types
  //         const feeTypes = ["school", "transportation"];
  //         feeTypes.forEach((feeType) => {
  //           const slabKey =
  //             feeType === "transportation" &&
  //             student.studentDetails.transportDetails?.distanceSlab
  //               ? `${feeType}_${student.studentDetails.transportDetails.distanceSlab}_${month}_${year}`
  //               : `${feeType}_${month}_${year}`;

  //           if (
  //             feeType === "transportation" &&
  //             (!student.studentDetails.transportDetails?.isApplicable ||
  //               student.studentDetails.transportDetails.distanceSlab !==
  //                 student.studentDetails.transportDetails?.distanceSlab)
  //           ) {
  //             return;
  //           }

  //           const studentFee = studentFeeMap.get(slabKey);
  //           const generalFee = feeTypesMap.get(slabKey);

  //           if (!studentFee && !generalFee) {
  //             return;
  //           }

  //           const feeAmount = studentFee
  //             ? studentFee.amount
  //             : generalFee
  //             ? generalFee.amount
  //             : 0;
  //           const paidAmount = studentFee ? studentFee.paidAmount : 0;
  //           const remainingAmount = studentFee
  //             ? studentFee.remainingAmount
  //             : feeAmount;
  //           const status = studentFee
  //             ? studentFee.status
  //             : remainingAmount === 0
  //             ? "paid"
  //             : "pending";

  //           const paymentInfo = paymentMap.get(slabKey) || {
  //             amount: 0,
  //             date: null,
  //             details: [],
  //           };
  //           const paymentDetails =
  //             paymentInfo.details.length > 0 ? paymentInfo.details[0] : {};

  //           feeData[key].fees[feeType] = {
  //             amount: feeAmount,
  //             paidAmount: paidAmount,
  //             remainingAmount: remainingAmount,
  //             dueDate: studentFee
  //               ? studentFee.dueDate
  //               : generalFee
  //               ? generalFee.dueDate
  //               : null,
  //             description: studentFee
  //               ? studentFee.description
  //               : generalFee
  //               ? generalFee.description
  //               : "",
  //             status,
  //             paymentDetails: paymentDetails,
  //             ...(feeType === "transportation" &&
  //               (studentFee?.transportationDetails?.distanceSlab ||
  //                 generalFee?.transportationDetails?.distanceSlab) && {
  //                 transportationSlab:
  //                   studentFee?.transportationDetails?.distanceSlab ||
  //                   generalFee?.transportationDetails?.distanceSlab,
  //               }),
  //           };

  //           feeData[key].total += feeAmount;
  //           feeData[key].totalPaid += paidAmount;
  //           feeData[key].totalPending += remainingAmount;
  //         });
  //       });
  //     });

  //     // Clean up empty months
  //     Object.keys(feeData).forEach((key) => {
  //       if (Object.keys(feeData[key].fees).length === 0) {
  //         delete feeData[key];
  //       }
  //     });

  //     res.json({
  //       student: {
  //         _id: student._id,
  //         name: student.name,
  //         grNumber: student.studentDetails.grNumber,
  //         class: student.studentDetails.class
  //           ? {
  //               _id: student.studentDetails.class._id,
  //               name: student.studentDetails.class.name,
  //               division: student.studentDetails.class.division,
  //             }
  //           : null,
  //         transportDetails: student.studentDetails.transportDetails || null,
  //         isRTE: student.studentDetails.isRTE || false,
  //       },
  //       feeData,
  //     });
  //   } catch (error) {
  //     logger.error(`Error fetching student fees: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },

  getStudentByGrNumber: async (req, res) => {
  try {
    const { grNumber } = req.params;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const FeeModel = require("../models/Fee")(connection);
    const PaymentModel = require("../models/Payment")(connection);
    const UserModel = require("../models/User")(connection);
    const ClassModel = require("../models/Class")(connection);

    const student = await UserModel.findOne({
      "studentDetails.grNumber": grNumber,
      school: schoolId,
    })
      .select(
        "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
      )
      .populate("studentDetails.class", "name division");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const currentYear = new Date().getFullYear();
    const studentFees = await FeeModel.find({
      school: schoolId,
      student: student._id,
      year: { $gte: currentYear, $lte: currentYear + 1 },
    });

    const payments = await PaymentModel.find({
      school: schoolId,
      student: student._id,
      status: "completed",
      year: { $gte: currentYear, $lte: currentYear + 1 },
    });

    const generalFeeDefinitions = await FeeModel.find({
      school: schoolId,
      student: null,
      classes: student.studentDetails.class._id,
      year: { $gte: currentYear, $lte: currentYear + 1 },
    });

    // Get all distinct fee types for the student's class
    const feeTypes = [
      ...new Set(generalFeeDefinitions.map((fee) => fee.type)),
      ...new Set(studentFees.map((fee) => fee.type)),
    ];

    // Process general fee definitions
    const feeTypesMap = new Map();
    generalFeeDefinitions.forEach((fee) => {
      const key =
        fee.type === "transportation" &&
        fee.transportationDetails?.distanceSlab
          ? `${fee.type}_${fee.transportationDetails.distanceSlab}_${fee.month}_${fee.year}`
          : `${fee.type}_${fee.month}_${fee.year}`;
      feeTypesMap.set(key, {
        type: fee.type,
        amount: fee.amount,
        description: fee.description,
        dueDate: fee.dueDate,
        transportationDetails: fee.transportationDetails || null,
        month: fee.month,
        year: fee.year,
      });
    });

    // Process student-specific fees
    const studentFeeMap = new Map();
    studentFees.forEach((fee) => {
      const key =
        fee.type === "transportation" &&
        fee.transportationDetails?.distanceSlab
          ? `${fee.type}_${fee.transportationDetails.distanceSlab}_${fee.month}_${fee.year}`
          : `${fee.type}_${fee.month}_${fee.year}`;
      studentFeeMap.set(key, fee);
    });

    // Process payments
    const paymentMap = new Map();
    payments.forEach((payment) => {
      payment.feesPaid.forEach((feePaid) => {
        const key =
          feePaid.type === "transportation" && feePaid.transportationSlab
            ? `${feePaid.type}_${feePaid.transportationSlab}_${feePaid.month}_${feePaid.year}`
            : `${feePaid.type}_${feePaid.month}_${feePaid.year}`;
        const existing = paymentMap.get(key) || {
          amount: 0,
          date: null,
          details: [],
        };
        paymentMap.set(key, {
          amount: existing.amount + feePaid.amount,
          date:
            payment.paymentDate > existing.date
              ? payment.paymentDate
              : existing.date,
          details: [
            ...existing.details,
            {
              transactionId: payment.receiptNumber,
              paymentDate: payment.paymentDate,
              paymentMethod: payment.paymentMethod,
              receiptNumber: payment.receiptNumber,
              amount: feePaid.amount,
            },
          ],
        });
      });
    });

    // Construct fee data
    const feeData = {};
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const years = [currentYear, currentYear + 1];

    years.forEach((year) => {
      months.forEach((month) => {
        const key = `${year}-${month}`;
        feeData[key] = {
          total: 0,
          totalPaid: 0,
          totalPending: 0,
          fees: {},
        };

        // Process all fee types
        feeTypes.forEach((feeType) => {
          const slabKey =
            feeType === "transportation" &&
            student.studentDetails.transportDetails?.distanceSlab
              ? `${feeType}_${student.studentDetails.transportDetails.distanceSlab}_${month}_${year}`
              : `${feeType}_${month}_${year}`;

          if (
            feeType === "transportation" &&
            (!student.studentDetails.transportDetails?.isApplicable ||
              (student.studentDetails.transportDetails?.distanceSlab &&
                student.studentDetails.transportDetails.distanceSlab !==
                  student.studentDetails.transportDetails?.distanceSlab))
          ) {
            return;
          }

          const studentFee = studentFeeMap.get(slabKey);
          const generalFee = feeTypesMap.get(slabKey);

          if (!studentFee && !generalFee) {
            return;
          }

          const feeAmount = studentFee
            ? studentFee.amount
            : generalFee
            ? generalFee.amount
            : 0;
          const paidAmount = studentFee ? studentFee.paidAmount : 0;
          const remainingAmount = studentFee
            ? studentFee.remainingAmount
            : feeAmount;
          const status = studentFee
            ? studentFee.status
            : remainingAmount === 0
            ? "paid"
            : "pending";

          const paymentInfo = paymentMap.get(slabKey) || {
            amount: 0,
            date: null,
            details: [],
          };
          const paymentDetails =
            paymentInfo.details.length > 0 ? paymentInfo.details[0] : {};

          feeData[key].fees[feeType] = {
            amount: feeAmount,
            paidAmount: paidAmount,
            remainingAmount: remainingAmount,
            dueDate: studentFee
              ? studentFee.dueDate
              : generalFee
              ? generalFee.dueDate
              : null,
            description: studentFee
              ? studentFee.description
              : generalFee
              ? generalFee.description
              : "",
            status,
            paymentDetails: paymentDetails,
            ...(feeType === "transportation" &&
              (studentFee?.transportationDetails?.distanceSlab ||
                generalFee?.transportationDetails?.distanceSlab) && {
                transportationSlab:
                  studentFee?.transportationDetails?.distanceSlab ||
                  generalFee?.transportationDetails?.distanceSlab,
              }),
          };

          feeData[key].total += feeAmount;
          feeData[key].totalPaid += paidAmount;
          feeData[key].totalPending += remainingAmount;
        });
      });
    });

    // Clean up empty months
    Object.keys(feeData).forEach((key) => {
      if (Object.keys(feeData[key].fees).length === 0) {
        delete feeData[key];
      }
    });

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        grNumber: student.studentDetails.grNumber,
        class: student.studentDetails.class
          ? {
              _id: student.studentDetails.class._id,
              name: student.studentDetails.class.name,
              division: student.studentDetails.class.division,
            }
          : null,
        transportDetails: student.studentDetails.transportDetails || null,
        isRTE: student.studentDetails.isRTE || false,
      },
      feeData,
    });
  } catch (error) {
    logger.error(`Error fetching student fees: ${error.message}`, { error });
    res.status(500).json({ error: error.message });
  }
},

  payFeesForStudent: async (req, res) => {
    try {
      const {
        grNumber,
        selectedFees,
        totalAmount,
        paymentMethod = "cash",
      } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const FeeModel = require("../models/Fee")(connection);
      const PaymentModel = require("../models/Payment")(connection);
      const UserModel = require("../models/User")(connection);
      const ClassModel = require("../models/Class")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can process payments",
        });
      }

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      })
        .select(
          "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email"
        )
        .populate("studentDetails.class", "name division");

      if (!student)
        return res.status(404).json({ message: "Student not found" });
      if (student.studentDetails.isRTE)
        return res
          .status(400)
          .json({ message: "RTE students are exempted from fees" });

      const feesToPay = [];
      let calculatedTotal = 0;

      for (const fee of selectedFees) {
        const { year, month, types, amounts, transportationSlab } = fee;

        const nonTransportTypes = types.filter((t) => t !== "transportation");
        const transportTypes = types.includes("transportation")
          ? ["transportation"]
          : [];

        let feeDefinitions = [];

        if (nonTransportTypes.length > 0) {
          const nonTransportFees = await FeeModel.find({
            school: schoolId,
            student: null,
            year: parseInt(year),
            month: parseInt(month),
            type: { $in: nonTransportTypes },
            classes: student.studentDetails.class._id,
          });
          logger.debug(`Non-transport fees found: ${nonTransportFees.length}`, {
            nonTransportFees,
          });
          feeDefinitions.push(...nonTransportFees);
        }

        if (transportTypes.length > 0 && transportationSlab) {
          const transportFees = await FeeModel.find({
            school: schoolId,
            student: null,
            year: parseInt(year),
            month: parseInt(month),
            type: "transportation",
            classes: student.studentDetails.class._id,
            "transportationDetails.distanceSlab": transportationSlab,
          });
          logger.debug(`Transport fees found: ${transportFees.length}`, {
            transportFees,
          });
          feeDefinitions.push(...transportFees);
        }

        if (feeDefinitions.length === 0) {
          return res.status(404).json({
            message: `No fee definitions found for class ${student.studentDetails.class.name} ${student.studentDetails.class.division} for ${month}/${year}`,
          });
        }

        const existingStudentFees = await FeeModel.find({
          student: student._id,
          school: schoolId,
          year: parseInt(year),
          month: parseInt(month),
          type: { $in: types },
          ...(transportationSlab
            ? { "transportationDetails.distanceSlab": transportationSlab }
            : {}),
        });

        const existingFeesByType = new Map();
        existingStudentFees.forEach((fee) => {
          const key =
            fee.type === "transportation" &&
            fee.transportationDetails?.distanceSlab
              ? `${fee.type}_${fee.transportationDetails.distanceSlab}`
              : fee.type;
          existingFeesByType.set(key, fee);
        });

        for (let i = 0; i < types.length; i++) {
          const feeType = types[i];
          const amountToPay = amounts ? amounts[i] : null;
          const feeKey =
            feeType === "transportation" && transportationSlab
              ? `${feeType}_${transportationSlab}`
              : feeType;

          const definition = feeDefinitions.find(
            (def) =>
              def.type === feeType &&
              (feeType !== "transportation" ||
                def.transportationDetails?.distanceSlab === transportationSlab)
          );

          if (!definition) {
            return res.status(404).json({
              message: `No fee definition found for ${feeType}${
                feeType === "transportation" && transportationSlab
                  ? ` (${transportationSlab})`
                  : ""
              } for ${month}/${year}`,
            });
          }

          if (
            feeType === "transportation" &&
            (!student.studentDetails.transportDetails?.isApplicable ||
              (transportationSlab &&
                student.studentDetails.transportDetails?.distanceSlab !==
                  transportationSlab))
          ) {
            return res.status(400).json({
              message: `Transportation fee slab ${transportationSlab} does not match student's configured slab ${student.studentDetails.transportDetails?.distanceSlab}`,
            });
          }

          const existingFee = existingFeesByType.get(feeKey);

          if (existingFee) {
            if (existingFee.status === "paid") {
              return res.status(400).json({
                message: `Fee type '${feeType}${
                  transportationSlab && feeType === "transportation"
                    ? ` (${transportationSlab})`
                    : ""
                }' for ${month}/${year} is already paid`,
              });
            }

            const feeAmount =
              amountToPay || definition.amount - existingFee.paidAmount;

            existingFee.paidAmount += feeAmount;
            existingFee.remainingAmount =
              existingFee.amount - existingFee.paidAmount;
            existingFee.status =
              existingFee.paidAmount >= existingFee.amount
                ? "paid"
                : "partially_paid";

            existingFee.paymentDetails.push({
              transactionId: `CASH-${Date.now()}`,
              paymentDate: new Date(),
              paymentMethod,
              receiptNumber: `REC-${Date.now()}`,
              amount: feeAmount,
            });

            feesToPay.push(existingFee);
            calculatedTotal += feeAmount;
          } else {
            const feeAmount = amountToPay || definition.amount;

            const newFee = new FeeModel({
              school: schoolId,
              student: student._id,
              grNumber: student.studentDetails.grNumber,
              classes: [student.studentDetails.class._id],
              type: feeType,
              amount: definition.amount,
              remainingAmount: definition.amount - feeAmount,
              paidAmount: feeAmount,
              dueDate: definition.dueDate,
              month: parseInt(month),
              year: parseInt(year),
              status:
                feeAmount >= definition.amount ? "paid" : "partially_paid",
              description: definition.description,
              transportationDetails: definition.transportationDetails || null,
              paymentDetails: [
                {
                  transactionId: `CASH-${Date.now()}`,
                  paymentDate: new Date(),
                  paymentMethod,
                  receiptNumber: `REC-${Date.now()}`,
                  amount: feeAmount,
                },
              ],
            });

            feesToPay.push(newFee);
            calculatedTotal += feeAmount;
          }
        }
      }

      if (feesToPay.length === 0) {
        return res
          .status(400)
          .json({ message: "No pending fees to pay for the selected types" });
      }

      if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
        return res.status(400).json({
          message: "Payment amount mismatch",
          calculatedAmount: calculatedTotal,
          providedAmount: totalAmount,
        });
      }

      const receiptNumber = `REC-${paymentMethod.toUpperCase()}-${Date.now()}`;
      const payment = new PaymentModel({
        school: schoolId,
        student: student._id,
        grNumber,
        amount: totalAmount,
        paymentMethod,
        status: "completed",
        paymentDate: new Date(),
        receiptNumber,
        feesPaid: feesToPay.map((fee) => ({
          feeId: fee._id || null,
          type: fee.type,
          month: fee.month,
          year: fee.year,
          amount: fee.paymentDetails[fee.paymentDetails.length - 1].amount,
          transportationSlab: fee.transportationDetails?.distanceSlab,
        })),
      });

      const feesByMonthYear = feesToPay.reduce((acc, fee) => {
        const key = `${fee.month}-${fee.year}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(fee);
        return acc;
      }, {});

      const receiptUrls = {};
      for (const [key, fees] of Object.entries(feesByMonthYear)) {
        let attempts = 3;
        let feeSlip;
        while (attempts > 0) {
          try {
            feeSlip = await generateFeeSlip(
              student,
              payment,
              fees,
              schoolId,
              key
            );
            break;
          } catch (uploadError) {
            logger.warn(
              `Failed to generate fee slip for ${key}, attempt ${
                4 - attempts
              }: ${uploadError.message}`
            );
            attempts--;
            if (attempts === 0) throw uploadError;
          }
        }
        receiptUrls[key] = feeSlip.pdfUrl;
      }

      payment.receiptUrl =
        receiptUrls[`${feesToPay[0].month}-${feesToPay[0].year}`];
      payment.receiptUrls = receiptUrls;

      await Promise.all([
        payment.save(),
        ...feesToPay.map((fee) => fee.save()),
      ]);

      await logFeeAction(
        connection,
        schoolId,
        req.user._id,
        "PAY_FEES",
        `Processed payment for student whose grNumber is ${grNumber} of amount ₹${totalAmount} via ${paymentMethod}`,
        {
          grNumber,
          totalAmount,
          paymentMethod,
          receiptNumber,
          feesPaid: feesToPay.map((fee) => ({
            type: fee.type,
            month: fee.month,
            year: fee.year,
            amount: fee.paymentDetails[fee.paymentDetails.length - 1].amount,
            transportationSlab: fee.transportationDetails?.distanceSlab,
          })),
        }
      );

      await sendPaymentConfirmation(student, payment, payment.receiptUrl);

      logger.info(
        `Payment processed for student ${grNumber}: ${totalAmount} via ${paymentMethod}`
      );

      res.json({
        message: "Payment processed successfully",
        payment,
        paidFees: feesToPay.map((fee) => ({
          type: fee.type,
          amount: fee.amount,
          paidAmount: fee.paidAmount,
          remainingAmount: fee.remainingAmount,
          month: fee.month,
          year: fee.year,
          ...(fee.transportationDetails?.distanceSlab && {
            transportationSlab: fee.transportationDetails.distanceSlab,
          }),
        })),
        receiptUrls,
      });
    } catch (error) {
      logger.error(`Payment processing error: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },



  // verifyPayment: async (req, res) => {
  //   try {
  //     const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
  //       req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = require("../models/Payment")(connection);
  //     const FeeModel = require("../models/Fee")(connection);
  //     const UserModel = require("../models/User")(connection);
  //     const ClassModel = require("../models/Class")(connection);

  //     // Verify signature (uncomment if using)
  //     // const generatedSignature = crypto
  //     //   .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  //     //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  //     //   .digest("hex");

  //     // if (generatedSignature !== razorpay_signature) {
  //     //   return res.status(400).json({ message: "Invalid payment signature" });
  //     // }

  //     const payment = await PaymentModel.findOne({
  //       orderId: razorpay_order_id,
  //       school: schoolId,
  //     });

  //     if (!payment) {
  //       return res.status(404).json({ message: "Payment not found" });
  //     }

  //     if (payment.status === "completed") {
  //       return res.status(400).json({ message: "Payment already verified" });
  //     }

  //     payment.status = "completed";
  //     payment.transactionId = razorpay_payment_id;
  //     payment.paymentDate = new Date();
  //     payment.receiptNumber = `REC-ONLINE-${Date.now()}`;
  //     await payment.save();

  //     const uniqueFeeKeys = new Set();
  //     const feesPaid = payment.feesPaid.filter((feePaid) => {
  //       const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
  //       if (uniqueFeeKeys.has(key)) return false;
  //       uniqueFeeKeys.add(key);
  //       return true;
  //     });

  //     const feeUpdates = feesPaid.map(async (feePaid) => {
  //       const fee = await FeeModel.findOne({
  //         student: payment.student,
  //         school: schoolId,
  //         type: feePaid.type,
  //         month: feePaid.month,
  //         year: feePaid.year,
  //       });

  //       if (fee) {
  //         fee.paidAmount += feePaid.amount;
  //         fee.remainingAmount = fee.amount - fee.paidAmount;
  //         fee.status = fee.paidAmount >= fee.amount ? "paid" : "partially_paid";
  //         fee.paymentDetails.push({
  //           transactionId: razorpay_payment_id,
  //           paymentDate: payment.paymentDate,
  //           paymentMethod: payment.paymentMethod,
  //           receiptNumber: payment.receiptNumber,
  //           amount: feePaid.amount,
  //         });
  //         await fee.save();
  //       }
  //     });

  //     await Promise.all(feeUpdates);

  //     const student = await UserModel.findById(payment.student)
  //       .select(
  //         "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email"
  //       )
  //       .populate("studentDetails.class", "name division");

  //     const feesByMonthYear = feesPaid.reduce((acc, fee) => {
  //       const key = `${fee.month}-${fee.year}`;
  //       if (!acc[key]) acc[key] = [];
  //       acc[key].push(fee);
  //       return acc;
  //     }, {});

  //     const receiptUrls = {};
  //     for (const [key, fees] of Object.entries(feesByMonthYear)) {
  //       let attempts = 3;
  //       let feeSlip;
  //       while (attempts > 0) {
  //         try {
  //           feeSlip = await generateFeeSlip(
  //             student,
  //             payment,
  //             fees.map((f) => ({
  //               _id: f.feeId,
  //               type: f.type,
  //               month: f.month,
  //               year: f.year,
  //               amount: f.amount,
  //             })),
  //             schoolId,
  //             key
  //           );
  //           break;
  //         } catch (uploadError) {
  //           logger.warn(
  //             `Failed to generate fee slip for ${key}, attempt ${
  //               4 - attempts
  //             }: ${uploadError.message}`
  //           );
  //           attempts--;
  //           if (attempts === 0) throw uploadError;
  //         }
  //       }
  //       receiptUrls[key] = feeSlip.pdfUrl;
  //     }

  //     payment.receiptUrl =
  //       receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
  //     payment.receiptUrls = receiptUrls;
  //     await payment.save();

  //     // Log the action
  //     await logFeeAction(
  //       connection,
  //       schoolId,
  //       req.user._id,
  //       "VERIFY_PAYMENT",
  //       `Verified payment for order ${razorpay_order_id} with payment ID ${razorpay_payment_id}`,
  //       {
  //         razorpay_order_id,
  //         razorpay_payment_id,
  //         amount: payment.amount,
  //         studentId: payment.student.toString(),
  //       }
  //     );

  //     await sendPaymentConfirmation(student, payment, payment.receiptUrl);

  //     logger.info(
  //       `Payment verified for order ${razorpay_order_id}: ${payment.amount}`
  //     );

  //     res.json({
  //       message: "Payment verified successfully",
  //       payment,
  //       receiptUrls,
  //     });
  //   } catch (error) {
  //     logger.error(`Error verifying payment: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


getPendingPaymentsFor : async (req, res) => {
  try {
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const PaymentModel = require('../models/Payment')(connection);
    const UserModel = require('../models/User')(connection);
    const FeeModel = require('../models/Fee')(connection);
    const ClassModel= require('../models/Class')(connection)

    // Validate fee manager role
    // if (!req.user || !['FEE_MANAGER', 'ADMIN'].includes(req.user.role)) {
    //   logger.error('Unauthorized access to pending payments', { userId: req.user?._id });
    //   return res.status(403).json({ message: 'Only fee managers or admins can view pending payments' });
    // }

    // Optional filter by payment method
    const { paymentMethod } = req.query;
    const query = {
      school: schoolId,
      status: { $in: ['pending', 'awaiting_verification'] },
    };
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Fetch pending payments
    const payments = await PaymentModel.find(query)
      .populate({
        path: 'student',
        select: 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails.email',
        populate: {
          path: 'studentDetails.class',
          select: 'name division',
        },
      })
      .lean();

    // Enrich payments with fee details
    const enrichedPayments = await Promise.all(
      payments.map(async (payment) => {
        const fees = await FeeModel.find({
          _id: { $in: payment.feesPaid.map((f) => f.feeId) },
        }).lean();

        return {
          paymentId: payment._id,
          orderId: payment.orderId,
          student: {
            id: payment.student._id,
            name: payment.student.name,
            grNumber: payment.student.studentDetails.grNumber,
            class: payment.student.studentDetails.class
              ? `${payment.student.studentDetails.class.name} ${payment.student.studentDetails.class.division}`
              : 'N/A',
            email: payment.student.studentDetails.parentDetails?.email || payment.student.email,
          },
          paymentMethod: payment.paymentMethod,
          totalAmount: payment.totalAmount,
          status: payment.status,
          transactionId: payment.transactionId || null,
          proofOfPayment: payment.proofOfPayment
            ? {
                url: payment.proofOfPayment.url,
                transactionId: payment.proofOfPayment.transactionId,
                mimeType: payment.proofOfPayment.mimeType,
                size: payment.proofOfPayment.size,
                amount: payment.proofOfPayment.amount,
                uploadedAt: payment.proofOfPayment.uploadedAt,
              }
            : null,
          feesPaid: payment.feesPaid.map((feePaid) => {
            const fee = fees.find((f) => f._id.toString() === feePaid.feeId.toString());
            return {
              feeId: feePaid.feeId,
              type: feePaid.type,
              month: feePaid.month,
              year: feePaid.year,
              amount: feePaid.amount,
              feeStatus: fee ? fee.status : 'N/A',
            };
          }),
          createdAt: payment.createdAt,
        };
      })
    );

    logger.info('Retrieved pending payments', { schoolId, count: enrichedPayments.length });

    res.status(200).json({
      message: 'Pending payments retrieved successfully',
      payments: enrichedPayments,
    });
  } catch (error) {
    logger.error('Error retrieving pending payments', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error retrieving pending payments', error: error.message });
  }
},

  // verifyPayment: async (req, res) => {
  //   try {
  //     const { paymentId, paymentMethod, razorpay_payment_id, razorpay_order_id, razorpay_signature, stripe_payment_intent_id, proofOfPayment } = req.body;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = require("../models/Payment")(connection);
  //     const FeeModel = require("../models/Fee")(connection);
  //     const UserModel = require("../models/User")(connection);
  //     const classModel= require("../models/Class")(connection)

  //     const payment = await PaymentModel.findById(paymentId) || await PaymentModel.findOne({ orderId: razorpay_order_id, school: schoolId });
  //     if (!payment) {
  //       return res.status(404).json({ message: "Payment not found" });
  //     }

  //     if (payment.status === "completed") {
  //       return res.status(400).json({ message: "Payment already verified" });
  //     }

  //     // Fetch school payment configuration
  //     const ownerConnection = await getOwnerConnection();
  //     const School = require("../models/School")(ownerConnection);
  //     const school = await School.findById(schoolId).lean();
  //     const paymentConfig = school.paymentConfig.find(config => config.paymentType === payment.paymentMethod);

  //     if (!paymentConfig) {
  //       return res.status(400).json({ message: `Payment method ${payment.paymentMethod} not configured` });
  //     }

  //     let isVerified = false;
  //     if (payment.paymentMethod === 'razorpay') {
  //       const razorpay = new Razorpay({
  //         key_id: decrypt(paymentConfig.details.razorpayKeyId),
  //         key_secret: decrypt(paymentConfig.details.razorpayKeySecret),
  //       });
  //       // Verify signature (uncomment if using)
  //       // const generatedSignature = crypto
  //       //   .createHmac("sha256", decrypt(paymentConfig.details.razorpayKeySecret))
  //       //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  //       //   .digest("hex");
  //       // if (generatedSignature !== razorpay_signature) {
  //       //   return res.status(400).json({ message: "Invalid payment signature" });
  //       // }
  //       isVerified = true;
  //       payment.transactionId = razorpay_payment_id;
  //     } else if (payment.paymentMethod === 'stripe') {
  //       const stripe = new Stripe(decrypt(paymentConfig.details.stripeSecretKey));
  //       const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
  //       if (paymentIntent.status === 'succeeded') {
  //         isVerified = true;
  //         payment.transactionId = stripe_payment_intent_id;
  //       }
  //     } else if (['bank_account', 'upi'].includes(payment.paymentMethod)) {
  //       if (!proofOfPayment?.url) {
  //         return res.status(400).json({ message: "Proof of payment required for manual verification" });
  //       }
  //       payment.proofOfPayment = {
  //         url: proofOfPayment.url,
  //         uploadedAt: new Date(),
  //         verified: true,
  //         verifiedBy: req.user._id,
  //         verifiedAt: new Date()
  //       };
  //       isVerified = true;
  //       payment.transactionId = `MANUAL-${payment.receiptNumber}`;
  //     }

  //     if (!isVerified) {
  //       payment.status = "failed";
  //       await payment.save();
  //       return res.status(400).json({ message: "Payment verification failed" });
  //     }

  //     payment.status = "completed";
  //     payment.paymentDate = new Date();
  //     payment.receiptNumber = payment.receiptNumber || `REC-${payment.paymentMethod.toUpperCase()}-${Date.now()}`;
  //     await payment.save();

  //     const uniqueFeeKeys = new Set();
  //     const feesPaid = payment.feesPaid.filter((feePaid) => {
  //       const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
  //       if (uniqueFeeKeys.has(key)) return false;
  //       uniqueFeeKeys.add(key);
  //       return true;
  //     });

  //     const feeUpdates = feesPaid.map(async (feePaid) => {
  //       const fee = await FeeModel.findOne({
  //         student: payment.student,
  //         school: schoolId,
  //         type: feePaid.type,
  //         month: feePaid.month,
  //         year: feePaid.year,
  //       });

  //       if (fee) {
  //         fee.paidAmount += feePaid.amount;
  //         fee.remainingAmount = fee.amount - fee.paidAmount;
  //         fee.status = fee.paidAmount >= fee.amount ? "paid" : "partially_paid";
  //         fee.paymentDetails.push({
  //           transactionId: payment.transactionId,
  //           paymentDate: payment.paymentDate,
  //           paymentMethod: payment.paymentMethod,
  //           receiptNumber: payment.receiptNumber,
  //           amount: feePaid.amount,
  //         });
  //         await fee.save();
  //       }
  //     });

  //     await Promise.all(feeUpdates);

  //     const student = await UserModel.findById(payment.student)
  //       .select(
  //         "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email"
  //       )
  //       .populate("studentDetails.class", "name division");

  //     const feesByMonthYear = feesPaid.reduce((acc, fee) => {
  //       const key = `${fee.month}-${fee.year}`;
  //       if (!acc[key]) acc[key] = [];
  //       acc[key].push(fee);
  //       return acc;
  //     }, {});

  //     const receiptUrls = {};
  //     for (const [key, fees] of Object.entries(feesByMonthYear)) {
  //       let attempts = 3;
  //       let feeSlip;
  //       while (attempts > 0) {
  //         try {
  //           feeSlip = await generateFeeSlip(
  //             student,
  //             payment,
  //             fees.map((f) => ({
  //               _id: f.feeId,
  //               type: f.type,
  //               month: f.month,
  //               year: f.year,
  //               amount: f.amount,
  //             })),
  //             schoolId,
  //             key
  //           );
  //           break;
  //         } catch (uploadError) {
  //           logger.warn(
  //             `Failed to generate fee slip for ${key}, attempt ${4 - attempts}: ${uploadError.message}`
  //           );
  //           attempts--;
  //           if (attempts === 0) throw uploadError;
  //         }
  //       }
  //       receiptUrls[key] = feeSlip.pdfUrl;
  //     }

  //     payment.receiptUrl = receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
  //     payment.receiptUrls = receiptUrls;
  //     await payment.save();

  //     await sendPaymentConfirmation(student, payment, payment.receiptUrl);

  //     logger.info(`Payment verified for ${payment.paymentMethod} with ID ${payment.transactionId}: ${payment.amount}`);

  //     res.json({
  //       message: "Payment verified successfully",
  //       payment,
  //       receiptUrls,
  //     });
  //   } catch (error) {
  //     logger.error(`Error verifying payment: ${error.message}`, { error });
  //     res.status(500).json({ error: error.message });
  //   }
  // },


//  verifyPayment : async (req, res) => {
//   try {
//     const {
//       paymentId,
//       paymentMethod,
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//       stripe_payment_intent_id,
//       proofOfPayment,
//     } = req.body;
//     const schoolId = req.school._id.toString();
//     const connection = req.connection;
//     const PaymentModel = require('../models/Payment')(connection);
//     const FeeModel = require('../models/Fee')(connection);
//     const UserModel = require('../models/User')(connection);
//     const ClassModel= require("../models/Class")(connection)

    
//     // Find payment
//     const payment = await PaymentModel.findById(paymentId) || 
//                    await PaymentModel.findOne({ orderId: razorpay_order_id, school: schoolId });
//     if (!payment) {
//       logger.error('Payment not found', { paymentId, razorpay_order_id });
//       return res.status(404).json({ message: 'Payment not found' });
//     }

//     if (payment.status === 'completed') {
//       logger.warn('Payment already verified', { paymentId });
//       return res.status(400).json({ message: 'Payment already verified' });
//     }

//     // Fetch school payment configuration
//     const ownerConnection = await getOwnerConnection();
//     const School = require('../models/School')(ownerConnection);
//     const school = await School.findById(schoolId).lean();
//     const paymentConfig = school.paymentConfig.find(config => config.paymentType === payment.paymentMethod);

//     if (!paymentConfig) {
//       logger.error(`Payment method ${payment.paymentMethod} not configured`, { schoolId });
//       return res.status(400).json({ message: `Payment method ${payment.paymentMethod} not configured` });
//     }

//     let isVerified = false;
//     let transactionId = payment.transactionId;

//     // Verify payment based on method
//     if (payment.paymentMethod === 'razorpay') {
//       if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
//         logger.error('Missing Razorpay verification parameters', { paymentId });
//         return res.status(400).json({ message: 'Missing Razorpay verification parameters' });
//       }
//       const razorpaySecret = decrypt(paymentConfig.details.razorpayKeySecret);
//       const generatedSignature = crypto
//         .createHmac('sha256', razorpaySecret)
//         .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//         .digest('hex');
//       if (generatedSignature === razorpay_signature) {
//         isVerified = true;
//         transactionId = razorpay_payment_id;
//       } else {
//         logger.error('Invalid Razorpay signature', { paymentId, razorpay_payment_id });
//         return res.status(400).json({ message: 'Invalid Razorpay signature' });
//       }
//     } else if (payment.paymentMethod === 'stripe') {
//       if (!stripe_payment_intent_id) {
//         logger.error('Missing Stripe payment intent ID', { paymentId });
//         return res.status(400).json({ message: 'Missing Stripe payment intent ID' });
//       }
//       const stripe = new Stripe(decrypt(paymentConfig.details.stripeSecretKey));
//       const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
//       if (paymentIntent.status === 'succeeded') {
//         isVerified = true;
//         transactionId = stripe_payment_intent_id;
//       } else {
//         logger.error('Stripe payment not succeeded', { paymentId, stripe_payment_intent_id });
//         return res.status(400).json({ message: 'Stripe payment not succeeded' });
//       }
//     } else if (['bank_account', 'upi'].includes(payment.paymentMethod)) {
//       if (!proofOfPayment?.url ) {
//         logger.error('Missing proof of payment details', { paymentId });
//         return res.status(400).json({ message: 'Proof of payment URL, transaction ID, amount, and MIME type required' });
//       }
//       const validFileTypes = ['application/pdf', 'image/jpeg', 'image/png'];
//       const maxFileSize = 5 * 1024 * 1024; // 5MB
//       // if (!validFileTypes.includes(proofOfPayment.mimeType)) {
//       //   logger.error('Invalid proof file type', { paymentId, mimeType: proofOfPayment.mimeType });
//       //   return res.status(400).json({ message: 'Invalid file type. Only PDF, JPEG, or PNG allowed' });
//       // }
//       // if (proofOfPayment.size > maxFileSize) {
//       //   logger.error('Proof file size exceeds limit', { paymentId, size: proofOfPayment.size });
//       //   return res.status(400).json({ message: 'File size exceeds 5MB limit' });
//       // }
//       if (proofOfPayment.amount !== payment.totalAmount) {
//         logger.error('Proof amount does not match payment amount', {
//           paymentId,
//           proofAmount: proofOfPayment.amount,
//           paymentAmount: payment.totalAmount,
//         });
//         return res.status(400).json({ message: 'Proof amount does not match payment amount' });
//       }
//       payment.proofOfPayment = {
//         url: proofOfPayment.url,
//         transactionId: proofOfPayment.transactionId,
//         // mimeType: proofOfPayment.mimeType,
//         // size: proofOfPayment.size,
//         uploadedAt: new Date(),
//         verified: true,
//         verifiedBy: req.user._id,
//         verifiedAt: new Date(),
//       };
//       isVerified = true;
//       transactionId = proofOfPayment.transactionId;
//     } else {
//       logger.error('Unsupported payment method', { paymentId, paymentMethod: payment.paymentMethod });
//       return res.status(400).json({ message: 'Unsupported payment method' });
//     }

//     if (!isVerified) {
//       payment.status = 'failed';
//       await payment.save();
//       logger.error('Payment verification failed', { paymentId });
//       return res.status(400).json({ message: 'Payment verification failed' });
//     }

//     // Update payment and fees within a transaction
//     const session = await connection.startSession();
//     let receiptUrls = {};
//     try {
//       await session.withTransaction(async () => {
//         payment.status = 'completed';
//         payment.transactionId = transactionId;
//         payment.paymentDate = new Date();
//         payment.receiptNumber = payment.receiptNumber || `REC-${payment.paymentMethod.toUpperCase()}-${Date.now()}`;
//         await payment.save({ session });

//         const uniqueFeeKeys = new Set();
//         const feesPaid = payment.feesPaid.filter((feePaid) => {
//           const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
//           if (uniqueFeeKeys.has(key)) return false;
//           uniqueFeeKeys.add(key);
//           return true;
//         });

//         const feeUpdates = feesPaid.map(async (feePaid) => {
//           const fee = await FeeModel.findOne({
//             student: payment.student,
//             school: schoolId,
//             type: feePaid.type,
//             month: feePaid.month,
//             year: feePaid.year,
//           }).session(session);

//           if (fee) {
//             fee.paidAmount += feePaid.amount;
//             fee.remainingAmount = fee.amount - fee.paidAmount;
//             fee.status = fee.paidAmount >= fee.amount ? 'paid' : 'partially_paid';
//             fee.paymentDetails.push({
//               transactionId: payment.transactionId,
//               paymentDate: payment.paymentDate,
//               paymentMethod: payment.paymentMethod,
//               receiptNumber: payment.receiptNumber,
//               amount: feePaid.amount,
//             });
//             await fee.save({ session });
//           }
//         });

//         await Promise.all(feeUpdates);

//         const student = await UserModel.findById(payment.student)
//           .select(
//             '_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email'
//           )
//           .populate('studentDetails.class', 'name division')
//           .session(session);

//         const feesByMonthYear = feesPaid.reduce((acc, fee) => {
//           const key = `${fee.month}-${fee.year}`;
//           if (!acc[key]) acc[key] = [];
//           acc[key].push(fee);
//           return acc;
//         }, {});

//         // const receiptUrls = {};
//         for (const [key, fees] of Object.entries(feesByMonthYear)) {
//           let attempts = 3;
//           let feeSlip;
//           while (attempts > 0) {
//             try {
//               feeSlip = await generateFeeSlip(
//                 student,
//                 payment,
//                 fees.map((f) => ({
//                   _id: f.feeId,
//                   type: f.type,
//                   month: f.month,
//                   year: f.year,
//                   amount: f.amount,
//                 })),
//                 schoolId,
//                 key
//               );
//               break;
//             } catch (uploadError) {
//               logger.warn(
//                 `Failed to generate fee slip for ${key}, attempt ${4 - attempts}: ${uploadError.message}`
//               );
//               attempts--;
//               if (attempts === 0) throw uploadError;
//             }
//           }
//           receiptUrls[key] = feeSlip.pdfUrl;
//         }

//         payment.receiptUrl = receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
//         payment.receiptUrls = receiptUrls;
//         await payment.save({ session });

//         await sendPaymentConfirmation(student, payment, payment.receiptUrl);

//         // Log verification action
//         await logFeeAction(
//           connection,
//           schoolId,
//           req.user._id,
//           'PAYMENT_VERIFICATION',
//           `Verified ${payment.paymentMethod} payment for paymentId ${paymentId}`,
//           { paymentId, transactionId, paymentMethod: payment.paymentMethod }
//         );
//       });

//       logger.info(`Payment verified for ${payment.paymentMethod} with ID ${transactionId}: ${payment.totalAmount}`);

//       res.status(200).json({
//         success: true,
//         message: 'Payment verified successfully',
//         payment,
//         receiptUrls,
//       });
//     } finally {
//       await session.endSession();
//     }
//   } catch (error) {
//     logger.error('Error verifying payment', { error: error.message, stack: error.stack });
//     res.status(500).json({ success: false, error: error.message });
//   }
// },
  

verifyPayment : async (req, res) => {
  try {
    const {
      paymentId,
      paymentMethod,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      stripe_payment_intent_id,
      proofOfPayment,
    } = req.body;
    const schoolId = req.school._id.toString();
    const connection = req.connection;
    const PaymentModel = require('../models/Payment')(connection);
    const FeeModel = require('../models/Fee')(connection);
    const UserModel = require('../models/User')(connection);
    const ClassModel = require('../models/Class')(connection);

    

    // Find payment
    const payment = await PaymentModel.findById(paymentId) ||
                   await PaymentModel.findOne({ orderId: razorpay_order_id, school: schoolId });
    if (!payment) {
      logger.error('Payment not found', { paymentId, razorpay_order_id });
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.status === 'completed') {
      logger.warn('Payment already verified', { paymentId });
      return res.status(400).json({ message: 'Payment already verified' });
    }

    // Fetch school payment configuration
    const ownerConnection = await getOwnerConnection();
    const School = require('../models/School')(ownerConnection);
    const school = await School.findById(schoolId).lean();
    const paymentConfig = school.paymentConfig.find(config => config.paymentType === payment.paymentMethod);

    if (!paymentConfig) {
      logger.error(`Payment method ${payment.paymentMethod} not configured`, { schoolId });
      return res.status(400).json({ message: `Payment method ${payment.paymentMethod} not configured` });
    }

    let isVerified = false;
    let transactionId = payment.transactionId;

    // Verify payment based on method
    if (payment.paymentMethod === 'razorpay') {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        logger.error('Missing Razorpay verification parameters', { paymentId });
        return res.status(400).json({ message: 'Missing Razorpay verification parameters' });
      }
      const razorpaySecret = decrypt(paymentConfig.details.razorpayKeySecret);
      const generatedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (generatedSignature === razorpay_signature) {
        isVerified = true;
        transactionId = razorpay_payment_id;
      } else {
        logger.error('Invalid Razorpay signature', { paymentId, razorpay_payment_id });
        return res.status(400).json({ message: 'Invalid Razorpay signature' });
      }
      // isVerified = true;
      // transactionId = 'mock_razorpay_txn_' + Date.now();
    } else if (payment.paymentMethod === 'stripe') {
      if (!stripe_payment_intent_id) {
        logger.error('Missing Stripe payment intent ID', { paymentId });
        return res.status(400).json({ message: 'Missing Stripe payment intent ID' });
      }
      const stripe = new Stripe(decrypt(paymentConfig.details.stripeSecretKey));
      const paymentIntent = await stripe.paymentIntents.retrieve(stripe_payment_intent_id);
      if (paymentIntent.status === 'succeeded') {
        isVerified = true;
        transactionId = stripe_payment_intent_id;
      } else {
        logger.error('Stripe payment not succeeded', { paymentId, stripe_payment_intent_id });
        return res.status(400).json({ message: 'Stripe payment not succeeded' });
      }
    } else if (['bank_account', 'upi'].includes(payment.paymentMethod)) {
      if (!proofOfPayment?.url) {
        logger.error('Missing proof of payment details', { paymentId, proofOfPayment });
        return res.status(400).json({ message: 'Proof of payment URL, transaction ID, and amount required' });
      }
      const validFileTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const maxFileSize = 5 * 1024 * 1024; // 5MB
      const mimeType = proofOfPayment.mimeType || (proofOfPayment.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      if (!validFileTypes.includes(mimeType)) {
        logger.error('Invalid proof file type', { paymentId, mimeType });
        return res.status(400).json({ message: 'Invalid file type. Only PDF, JPEG, or PNG allowed' });
      }
      if (proofOfPayment.size && proofOfPayment.size > maxFileSize) {
        logger.error('Proof file size exceeds limit', { paymentId, size: proofOfPayment.size });
        return res.status(400).json({ message: 'File size exceeds 5MB limit' });
      }
      if (proofOfPayment.amount !== payment.amount) {
        logger.error('Proof amount does not match payment amount', {
          paymentId,
          proofAmount: proofOfPayment.amount,
          paymentAmount: payment.amount,
        });
        return res.status(400).json({ message: 'Proof amount does not match payment amount' });
      }
      payment.proofOfPayment = {
        url: proofOfPayment.url,
        transactionId: proofOfPayment.transactionId,
        mimeType: mimeType,
        size: proofOfPayment.size || null,
        amount: proofOfPayment.amount,
        uploadedAt: proofOfPayment.uploadedAt || new Date(),
        verified: true,
        verifiedBy: req.user._id,
        verifiedAt: new Date(),
      };
      isVerified = true;
      transactionId = proofOfPayment.transactionId;
    } else {
      logger.error('Unsupported payment method', { paymentId, paymentMethod: payment.paymentMethod });
      return res.status(400).json({ message: 'Unsupported payment method' });
    }

    if (!isVerified) {
      payment.status = 'failed';
      await payment.save();
      logger.error('Payment verification failed', { paymentId });
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Update payment and fees within a transaction
    const session = await connection.startSession();
    let receiptUrls = {};
    try {
      await session.withTransaction(async () => {
        payment.status = 'completed';
        payment.transactionId = transactionId; // Ensure transactionId is set
        payment.paymentDate = new Date();
        payment.receiptNumber = payment.receiptNumber || `REC-${payment.paymentMethod.toUpperCase()}-${Date.now()}`;
        await payment.save({ session });

        const uniqueFeeKeys = new Set();
        const feesPaid = payment.feesPaid.filter((feePaid) => {
          const key = `${feePaid.type}-${feePaid.month}-${feePaid.year}`;
          if (uniqueFeeKeys.has(key)) return false;
          uniqueFeeKeys.add(key);
          return true;
        });

        const feeUpdates = feesPaid.map(async (feePaid) => {
          const fee = await FeeModel.findOne({
            student: payment.student,
            school: schoolId,
            type: feePaid.type,
            month: feePaid.month,
            year: feePaid.year,
          }).session(session);

          if (fee) {
            fee.paidAmount += feePaid.amount;
            fee.remainingAmount = fee.amount - fee.paidAmount;
            fee.status = fee.paidAmount >= fee.amount ? 'paid' : 'partially_paid';
            fee.paymentDetails.push({
              transactionId: payment.transactionId,
              paymentDate: payment.paymentDate,
              paymentMethod: payment.paymentMethod,
              receiptNumber: payment.receiptNumber,
              amount: feePaid.amount,
            });
            await fee.save({ session });
          }
        });

        await Promise.all(feeUpdates);

        const student = await UserModel.findById(payment.student)
          .select(
            '_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE studentDetails.parentDetails email'
          )
          .populate('studentDetails.class', 'name division')
          .session(session);

        const feesByMonthYear = feesPaid.reduce((acc, fee) => {
          const key = `${fee.month}-${fee.year}`;
          if (!acc[key]) acc[key] = [];
          acc[key].push(fee);
          return acc;
        }, {});

        for (const [key, fees] of Object.entries(feesByMonthYear)) {
          let attempts = 3;
          let feeSlip;
          while (attempts > 0) {
            try {
              feeSlip = await generateFeeSlip(
                student,
                payment,
                fees.map((f) => ({
                  _id: f.feeId,
                  type: f.type,
                  month: f.month,
                  year: f.year,
                  amount: f.amount,
                })),
                schoolId,
                key
              );
              break;
            } catch (uploadError) {
              logger.warn(
                `Failed to generate fee slip for ${key}, attempt ${4 - attempts}: ${uploadError.message}`
              );
              attempts--;
              if (attempts === 0) throw uploadError;
            }
          }
          receiptUrls[key] = feeSlip.pdfUrl;
        }

        payment.receiptUrl = receiptUrls[`${feesPaid[0].month}-${feesPaid[0].year}`];
        payment.receiptUrls = receiptUrls;
        await payment.save({ session });

        await sendPaymentConfirmation(student, payment, payment.receiptUrl);

        // Log verification action
        await logFeeAction(
          connection,
          schoolId,
          req.user._id,
          'PAYMENT_VERIFICATION',
          `Verified ${payment.paymentMethod} payment for paymentId ${paymentId}`,
          { paymentId, transactionId, paymentMethod: payment.paymentMethod }
        );
      });

      logger.info(`Payment verified for ${payment.paymentMethod} with ID ${transactionId}: ${payment.amount}`);

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        payment,
        receiptUrls,
      });
    } finally {
      await session.endSession();
    }
  } catch (error) {
    logger.error('Error verifying payment', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, error: error.message });
  }
},

  // downloadReceipt: async (req, res) => {
  //   try {
  //     const { paymentId } = req.params;
  //     const schoolId = req.school._id.toString();
  //     const connection = req.connection;
  //     const PaymentModel = require("../models/Payment")(connection);
  //     const {
  //       getPublicFileUrl,
  //       streamS3Object,
  //     } = require("../config/s3Upload");

  //     if (!req.user.permissions.canManageFees) {
  //       return res.status(403).json({
  //         message: "Unauthorized: Only fee managers can download receipts",
  //       });
  //     }

  //     const payment = await PaymentModel.findOne({
  //       _id: paymentId,
  //       school: schoolId,
  //       status: "completed",
  //     }).populate(
  //       "student",
  //       "name studentDetails.grNumber studentDetails.class studentDetails.parentDetails email"
  //     );

  //     if (!payment) {
  //       return res.status(404).json({
  //         message: "Payment not found or not completed",
  //       });
  //     }

  //     let receiptUrl = payment.receiptUrl;

  //     if (!receiptUrl) {
  //       const feeSlip = await generateFeeSlip(
  //         payment.student,
  //         payment,
  //         payment.feesPaid,
  //         schoolId,
  //         `${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`
  //       );
  //       payment.receiptUrl = feeSlip.pdfUrl;
  //       payment.receiptUrls = {
  //         ...payment.receiptUrls,
  //         [`${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`]:
  //           feeSlip.pdfUrl,
  //       };
  //       await payment.save();
  //       receiptUrl = feeSlip.pdfUrl;
  //     }

  //     // Extract S3 key from receiptUrl
  //     const url = new URL(receiptUrl);
  //     const s3Key = decodeURIComponent(url.pathname.slice(1)); // Remove leading '/' from pathname

  //     // Option 1: Stream directly from S3 to the client
  //     try {
  //       return streamS3Object(s3Key, res);
  //     } catch (error) {
  //       // If streaming fails, fall back to redirecting to a direct URL
  //       const directUrl = getPublicFileUrl(s3Key);

  //       await logFeeAction(
  //         connection,
  //         schoolId,
  //         req.user._id,
  //         "DOWNLOAD_RECEIPT",
  //         `Downloaded receipt for payment ${paymentId}`,
  //         {
  //           paymentId,
  //           receiptNumber: payment.receiptNumber,
  //           studentId: payment.student.toString(),
  //         }
  //       );

  //       res.json({
  //         message: "Receipt ready for download",
  //         receiptUrl: directUrl,
  //       });
  //     }
  //   } catch (error) {
  //     logger.error(`Error generating URL for receipt: ${error.message}`, {
  //       error,
  //     });
  //     if (error.name === "NoSuchKey") {
  //       return res.status(404).json({
  //         error: `Receipt not found in S3: ${error.message}`,
  //       });
  //     }
  //     res.status(500).json({ error: error.message });
  //   }
  // },



downloadReceipt: async (req, res) => {
    try {
      const { paymentId } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = require('../models/Payment')(connection);
      const ClassModel= require("../models/Class")(connection)

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: 'Unauthorized: Only fee managers can download receipts',
        });
      }

      // Populate student and nested class field
      const payment = await PaymentModel.findOne({
        _id: paymentId,
        school: schoolId,
        status: 'completed',
      }).populate({
        path: 'student',
        select: 'name studentDetails.grNumber studentDetails.class studentDetails.parentDetails email',
        populate: {
          path: 'studentDetails.class',
          select: 'name division',
        },
      });

      if (!payment) {
        return res.status(404).json({
          message: 'Payment not found or not completed',
        });
      }

      const feeSlipData = await generateFeeSlip(
        payment.student,
        payment,
        payment.feesPaid,
        schoolId,
        `${payment.feesPaid[0].month}-${payment.feesPaid[0].year}`
      );

      await logFeeAction(
        connection,
        schoolId,
        req.user._id,
        'DOWNLOAD_RECEIPT',
        `Requested receipt data for payment ${paymentId}`,
        {
          paymentId,
          receiptNumber: payment.receiptNumber,
          studentId: payment.student.toString(),
        }
      );

      res.json({
        message: 'Fee slip data retrieved successfully',
        data: feeSlipData,
      });
    } catch (error) {
      logger.error(`Error fetching fee slip data: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },


  // New endpoint to get audit logs
  getAuditLogs: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const userId = req.user._id;
      const { startDate, endDate, action } = req.query;
      const connection = req.connection;
      const AuditLogModel = AuditLog(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view audit logs",
        });
      }

      const query = {
        school: schoolId,
        user: userId,
      };

      if (startDate) {
        query.timestamp = { $gte: new Date(startDate) };
      }
      if (endDate) {
        query.timestamp = { ...query.timestamp, $lte: new Date(endDate) };
      }
      if (action) {
        query.action = action;
      }

      const logs = await AuditLogModel.find(query)
        .sort({ timestamp: -1 })
        .lean();

      res.json({
        message: "Audit logs retrieved successfully",
        logs: logs.map((log) => ({
          id: log._id,
          action: log.action,
          description: log.description,
          metadata: log.metadata,
          timestamp: log.timestamp,
        })),
      });
    } catch (error) {
      logger.error(`Error fetching audit logs: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getStudentFeeHistory: async (req, res) => {
    try {
      const { grNumber } = req.params;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const UserModel = require("../models/User")(connection);
      const FeeModel = require("../models/Fee")(connection);
      const PaymentModel = require("../models/Payment")(connection);
      const ClassModel = require("../models/Class")(connection);

      const student = await UserModel.findOne({
        "studentDetails.grNumber": grNumber,
        school: schoolId,
      })
        .select(
          "_id name studentDetails.grNumber studentDetails.class studentDetails.transportDetails studentDetails.isRTE"
        )
        .populate("studentDetails.class", "name division");

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const feeDefinitions = await FeeModel.find({
        school: schoolId,
        classes: student.studentDetails.class._id,
        $or: [{ student: null }, { student: student._id }],
      }).lean();

      const payments = await PaymentModel.find({
        school: schoolId,
        student: student._id,
        status: "completed",
      }).lean();

      // Create a map to store fees by month-year, ensuring no duplicate fee types per month
      const feeMap = new Map();
      const feeTypesByMonth = new Map();

      feeDefinitions.forEach((fee) => {
        // Skip fees for other students
        if (fee.student && fee.student.toString() !== student._id.toString())
          return;

        // Skip transportation fees that don't apply to this student
        if (
          fee.type === "transportation" &&
          (!student.studentDetails.transportDetails?.isApplicable ||
            (fee.transportationDetails?.distanceSlab &&
              fee.transportationDetails.distanceSlab !==
                student.studentDetails.transportDetails?.distanceSlab))
        ) {
          return;
        }

        const key = `${fee.month}-${fee.year}`;
        const typeKey = `${key}_${fee.type}_${
          fee.transportationDetails?.distanceSlab || ""
        }`;

        // Check if we already have this fee type for this month
        if (feeTypesByMonth.has(typeKey)) {
          const existingFee = feeTypesByMonth.get(typeKey);

          // Prioritize student-specific fees over general class fees
          if (!fee.student && existingFee.student) {
            // Skip this fee - keep existing student-specific fee
            return;
          }

          // If current fee is student-specific and existing is general, replace it
          if (fee.student && !existingFee.student) {
            // Remove existing fee from the month's array
            const monthFees = feeMap.get(key);
            const updatedFees = monthFees.filter((f) => f !== existingFee);
            feeMap.set(key, updatedFees);
          } else {
            // Both fees are the same type (both general or both specific) - skip duplicate
            return;
          }
        }

        // Initialize the month's fee array if needed
        if (!feeMap.has(key)) feeMap.set(key, []);

        // Add this fee to the month and record it in our type tracker
        feeMap.get(key).push(fee);
        feeTypesByMonth.set(typeKey, fee);
      });

      // Create a map to store payment information by fee type, month, and year
      const paymentMap = new Map();
      payments.forEach((payment) => {
        payment.feesPaid.forEach((feePaid) => {
          const key = `${feePaid.type}_${feePaid.month}_${feePaid.year}_${
            feePaid.transportationSlab || ""
          }`;
          // Ensure no duplicate counting by overwriting with the latest payment
          paymentMap.set(key, {
            amount: feePaid.amount,
            date: payment.paymentDate,
            transactionId:
              payment.transactionId || `CASH-${payment.receiptNumber}`,
            paymentMethod: payment.paymentMethod,
            receiptNumber: payment.receiptNumber,
          });
        });
      });

      // Process fees and generate the response structure
      const feeData = {};
      for (const [monthYear, fees] of feeMap.entries()) {
        const [month, year] = monthYear.split("-").map(Number);

        // Initialize the month's total counters
        feeData[monthYear] = {
          total: 0,
          totalPaid: 0,
          totalPending: 0,
          fees: {},
        };

        // Process each fee for this month
        fees.forEach((fee) => {
          const paymentKey = `${fee.type}_${fee.month}_${fee.year}_${
            fee.transportationDetails?.distanceSlab || ""
          }`;
          const paymentInfo = paymentMap.get(paymentKey) || {
            amount: 0,
            date: null,
            transactionId: null,
            paymentMethod: null,
            receiptNumber: null,
          };

          const paidAmount = paymentInfo.amount;
          const remainingAmount = Math.max(0, fee.amount - paidAmount);
          let status = "pending";

          // Determine payment status
          if (paidAmount >= fee.amount) {
            status = "paid";
          } else if (paidAmount > 0) {
            status = "partially_paid";
          }

          // Add this fee to the month's data
          feeData[monthYear].fees[fee.type] = {
            amount: fee.amount,
            paidAmount: paidAmount,
            remainingAmount: remainingAmount,
            dueDate: fee.dueDate,
            description: fee.description,
            status: status,
            ...(paymentInfo.amount > 0 && {
              paymentDetails: {
                transactionId: paymentInfo.transactionId,
                paymentDate: paymentInfo.date,
                paymentMethod: paymentInfo.paymentMethod,
                receiptNumber: paymentInfo.receiptNumber,
                amount: paymentInfo.amount,
              },
            }),
            ...(fee.transportationDetails?.distanceSlab && {
              transportationSlab: fee.transportationDetails.distanceSlab,
            }),
          };

          // Update the month's totals
          feeData[monthYear].total += fee.amount;
          feeData[monthYear].totalPaid += paidAmount;
          feeData[monthYear].totalPending += remainingAmount;
        });
      }

      // Prepare the final response object
      const response = {
        student: {
          _id: student._id,
          name: student.name,
          grNumber: student.studentDetails.grNumber,
          class: student.studentDetails.class
            ? {
                _id: student.studentDetails.class._id,
                name: student.studentDetails.class.name,
                division: student.studentDetails.class.division,
              }
            : null,
          transportDetails: student.studentDetails.transportDetails || null,
          isRTE: student.studentDetails.isRTE || false,
        },
        feeData,
      };

      // Log this action
      await logFeeAction(
        connection,
        schoolId,
        req.user._id,
        "VIEW_STUDENT_FEE_HISTORY",
        `Viewed fee history for student with grNumber ${grNumber}`,
        { grNumber }
      );

      res.json(response);
    } catch (error) {
      logger.error(`Error fetching student fee history: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  refundPayment: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { paymentId, reason } = req.body;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = require("../models/Payment")(connection);
      const FeeModel = require("../models/Fee")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can process refunds",
        });
      }

      const payment = await PaymentModel.findOne({
        _id: paymentId,
        school: schoolId,
        status: "completed",
      }).session(session);

      if (!payment) {
        return res.status(404).json({
          message: "Payment not found or not completed",
        });
      }

      payment.status = "failed";
      payment.reason = reason;
      payment.updatedAt = new Date();
      await payment.save({ session });

      const feeUpdates = payment.feesPaid.map(async (feePaid) => {
        const fee = await FeeModel.findOne({
          student: payment.student,
          school: schoolId,
          type: feePaid.type,
          month: feePaid.month,
          year: feePaid.year,
        }).session(session);

        if (fee) {
          fee.paidAmount -= feePaid.amount;
          fee.remainingAmount = fee.amount - fee.paidAmount;
          fee.status = fee.paidAmount === 0 ? "pending" : "partially_paid";
          fee.paymentDetails = fee.paymentDetails.filter(
            (pd) =>
              pd.transactionId !== payment.transactionId &&
              pd.receiptNumber !== payment.receiptNumber
          );
          await fee.save({ session });
        }
      });

      await Promise.all(feeUpdates);

      if (payment.receiptUrl) {
        const key = payment.receiptUrl.match(
          /fee_receipts\/receipt_FS-[^\/]+\.pdf/
        )[0];
        try {
          await deleteFromS3(key);
        } catch (s3Error) {
          logger.warn(`Failed to delete receipt from S3: ${s3Error.message}`);
        }
      }

      if (payment.receiptUrls) {
        for (const key of Object.keys(payment.receiptUrls)) {
          const url = payment.receiptUrls[key];
          if (url) {
            const s3Key = url.match(/fee_receipts\/receipt_FS-[^\/]+\.pdf/)[0];
            try {
              await deleteFromS3(s3Key);
            } catch (s3Error) {
              logger.warn(
                `Failed to delete receipt from S3 for ${key}: ${s3Error.message}`
              );
            }
          }
        }
      }

      await session.commitTransaction();
      logger.info(`Refund processed for payment ${paymentId}: ${reason}`);

      res.json({
        message: "Refund processed successfully",
        payment,
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error processing refund: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    } finally {
      session.endSession();
    }
  },

  getTotalEarningsByYear: async (req, res) => {
    try {
      const { year } = req.query;
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = Payment(connection);
      const FeeModel = Fee(connection);

      if (!year) {
        return res.status(400).json({ message: "Year is required" });
      }

      const totalEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
            $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year)] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const totalReceived =
        totalEarnings.length > 0 ? totalEarnings[0].totalAmount : 0;

      const totalFees = await FeeModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            student: { $exists: false },
            year: parseInt(year),
          },
        },
        {
          $group: {
            _id: "$type",
            totalAmount: { $sum: "$amount" },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$totalAmount" },
          },
        },
      ]);

      const totalDefined = totalFees.length > 0 ? totalFees[0].totalAmount : 0;
      const totalPending = totalDefined - totalReceived;

      const prevYearEarnings = await PaymentModel.aggregate([
        {
          $match: {
            school: new mongoose.Types.ObjectId(schoolId),
            status: "completed",
            $expr: { $eq: [{ $year: "$paymentDate" }, parseInt(year) - 1] },
          },
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: "$amount" },
          },
        },
      ]);

      const prevTotal =
        prevYearEarnings.length > 0 ? prevYearEarnings[0].totalAmount : 0;
      const growth = totalReceived - prevTotal;

      res.json({
        totalEarning: totalReceived,
        totalReceived,
        totalPending: totalPending >= 0 ? totalPending : 0,
        growth: growth >= 0 ? growth : 0,
      });
    } catch (error) {
      logger.error(`Error calculating total earnings: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  getSchoolDetails: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const SchoolModel = require("../models/School")(connection);

      const school = await SchoolModel.findById(schoolId).select(
        "name address logoKey"
      );
      if (!school) {
        return res.status(404).json({ message: "School not found" });
      }

      res.json({
        name: school.name,
        address: school.address,
        logoKey: school.logoKey || null,
      });
    } catch (error) {
      logger.error(`Error fetching school details: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },

  requestLeave: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const { reason, startDate, endDate, type } = req.body;
      const clerkId = req.user._id;
      const connection = req.connection;
      const Leave = require("../models/Leave")(connection);

      const leave = new Leave({
        school: schoolId,
        user: clerkId,
        reason,
        startDate,
        endDate,
        type,
        status: "pending",
        appliedOn: new Date(),
      });

      await leave.save();
      logger.info(`Leave requested by user ${clerkId}: ${type}`);
      res.status(201).json(leave);
    } catch (error) {
      logger.error(`Error requesting leave: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  getLeaveStatus: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const clerkId = req.user._id;
      const connection = req.connection;
      const Leave = require("../models/Leave")(connection);

      const leaves = await Leave.find({ school: schoolId, user: clerkId })
        .sort({ appliedOn: -1 })
        .lean();

      res.json({
        status: "success",
        count: leaves.length,
        leaves: leaves.map((leave) => ({
          id: leave._id,
          reason: leave.reason,
          startDate: leave.startDate,
          endDate: leave.endDate,
          type: leave.type,
          status: leave.status,
          appliedOn: leave.appliedOn,
          reviewedBy: leave.reviewedBy,
          reviewedAt: leave.reviewedAt,
          comments: leave.comments,
        })),
      });
    } catch (error) {
      logger.error(`Error fetching leave status: ${error.message}`, { error });
      res.status(500).json({ error: error.message });
    }
  },

  // In feesController.js
  getPendingPayments: async (req, res) => {
    try {
      const schoolId = req.school._id.toString();
      const connection = req.connection;
      const PaymentModel = require("../models/Payment")(connection);
      const UserModel = require("../models/User")(connection);

      if (!req.user.permissions.canManageFees) {
        return res.status(403).json({
          message: "Unauthorized: Only fee managers can view pending payments",
        });
      }

      const pendingPayments = await PaymentModel.find({
        school: schoolId,
        status: "pending",
      })
        .populate("student", "name studentDetails.grNumber")
        .lean();

      res.json({
        message: "Pending payments retrieved successfully",
        payments: pendingPayments.map((payment) => ({
          paymentId: payment._id,
          orderId: payment.orderId,
          student: {
            id: payment.student._id,
            name: payment.student.name,
            grNumber: payment.student.studentDetails.grNumber,
          },
          amount: payment.amount,
          feesPaid: payment.feesPaid,
          createdAt: payment.createdAt,
        })),
      });
    } catch (error) {
      logger.error(`Error fetching pending payments: ${error.message}`, {
        error,
      });
      res.status(500).json({ error: error.message });
    }
  },
};

module.exports = feesController;
