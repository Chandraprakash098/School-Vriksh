
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Admission Documents Upload (specific fields)
const admissionStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id.toString() || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `${file.fieldname}_${Date.now()}${fileExt}`;
    const fileKey = `admissions/${schoolId}/${fileName}`;
    cb(null, fileKey);
  },
});

const uploadDocuments = multer({
  storage: admissionStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
    }
  },
}).fields([
  { name: 'studentPhoto', maxCount: 1 },
  { name: 'aadharCard', maxCount: 1 },
  { name: 'birthCertificate', maxCount: 1 },
  { name: 'schoolLeavingCertificate', maxCount: 1 },
  { name: 'rteCertificate', maxCount: 1 },
]);

// Certificate Upload (single PDF file)
const certificateStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  metadata: (req, file, cb) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id.toString() || 'unknown';
    const certificateId = req.params.certificateId || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `${certificateId}_signed_${Date.now()}${fileExt}`;
    const fileKey = `certificates/${schoolId}/${fileName}`;
    cb(null, fileKey);
  },
});

const certificateUpload = multer({
  storage: certificateStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for certificates
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type: Only PDFs are allowed for certificates'), false);
    }
  },
}).single('certificate');



const studyMaterialStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  acl: 'private',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user?._id?.toString() || 'unknown',
    });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id?.toString() || 'unknown';
    const classId = req.params.classId || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `${file.fieldname}_${Date.now()}${fileExt}`;
    const fileKey = `study-materials/${schoolId}/${classId}/${fileName}`;
    console.log('Uploading to S3 with key:', fileKey);
    cb(null, fileKey);
  },
});

const uploadStudyMaterial = multer({
  storage: studyMaterialStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    console.log('Multer fileFilter running...');
    console.log('File details:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
        ),
        false
      );
    }
  },
}).single('file');


// General-purpose buffer upload to S3
// const uploadToS3 = async (buffer, key) => {
//   const upload = new Upload({
//     client: s3Client,
//     params: {
//       Bucket: BUCKET_NAME,
//       Key: key,
//       Body: buffer,
//       ContentType: 'application/pdf', // Default to PDF, adjust if needed
//     },
//   });
//   return upload.done();
// };

const uploadToS3 = async (buffer, key, mimetype) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    },
  });
  return upload.done();
};



// Delete object from S3
const deleteFromS3 = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return s3Client.send(command);
};

// Fetch and stream S3 object
const streamS3Object = async (key, res) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  try {
    const { Body, ContentType, ContentLength } = await s3Client.send(command);
    res.set('Content-Type', ContentType);
    res.set('Content-Length', ContentLength);
    res.set('Content-Disposition', `inline; filename="${path.basename(key)}"`);
    Body.pipe(res);
  } catch (error) {
    throw new Error(`Failed to stream file from S3: ${error.message}`);
  }
};

module.exports = { uploadDocuments, certificateUpload, uploadToS3, deleteFromS3, streamS3Object, s3: s3Client,uploadStudyMaterial};



// const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
// const { Upload } = require('@aws-sdk/lib-storage');
// const multer = require('multer');
// const path = require('path');

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// // Multer memory storage for study materials
// const memoryStorage = multer.memoryStorage();

// const uploadStudyMaterial = multer({
//   storage: memoryStorage,
//   limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
//   fileFilter: (req, file, cb) => {
//     console.log('Multer fileFilter running...');
//     console.log('File details:', {
//       fieldname: file.fieldname,
//       originalname: file.originalname,
//       mimetype: file.mimetype,
//     });

//     const allowedTypes = [
//       'application/pdf',
//       'image/jpeg',
//       'image/png',
//       'image/jpg',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//     ];

//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
//         ),
//         false
//       );
//     }
//   },
// }).single('file');

// // // General-purpose buffer upload to S3
// // const uploadToS3 = async (buffer, key) => {
// //   const upload = new Upload({
// //     client: s3Client,
// //     params: {
// //       Bucket: BUCKET_NAME,
// //       Key: key,
// //       Body: buffer,
// //       ContentType: 'application/pdf', // Default to PDF, adjust if needed
// //     },
// //   });
// //   return upload.done();
// // };


// // General-purpose buffer upload to S3 (used by assignHomework and uploadStudyMaterial)
// const uploadToS3 = async (buffer, key, mimetype) => {
//   const upload = new Upload({
//     client: s3Client,
//     params: {
//       Bucket: BUCKET_NAME,
//       Key: key,
//       Body: buffer,
//       ContentType: mimetype, // Use the file’s mimetype
//     },
//   });
//   return upload.done();
// };

// // Delete object from S3
// const deleteFromS3 = async (key) => {
//   const command = new DeleteObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });
//   return s3Client.send(command);
// };

// // Fetch and stream S3 object
// const streamS3Object = async (key, res) => {
//   const command = new GetObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });

//   try {
//     const { Body, ContentType, ContentLength } = await s3Client.send(command);
//     res.set('Content-Type', ContentType);
//     res.set('Content-Length', ContentLength);
//     res.set('Content-Disposition', `inline; filename="${path.basename(key)}"`);
//     Body.pipe(res);
//   } catch (error) {
//     throw new Error(`Failed to stream file from S3: ${error.message}`);
//   }
// };

// // Keep existing uploadDocuments and certificateUpload for compatibility
// const multerS3 = require('multer-s3');

// const admissionStorage = multerS3({
//   s3: s3Client,
//   bucket: BUCKET_NAME,
//   metadata: (req, file, cb) => {
//     cb(null, { fieldName: file.fieldname });
//   },
//   key: (req, file, cb) => {
//     const schoolId = req.school?._id.toString() || 'unknown';
//     const fileExt = path.extname(file.originalname);
//     const fileName = `${file.fieldname}_${Date.now()}${fileExt}`;
//     const fileKey = `admissions/${schoolId}/${fileName}`;
//     cb(null, fileKey);
//   },
// });

// const uploadDocuments = multer({
//   storage: admissionStorage,
//   limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(
//         new Error(
//           `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
//         ),
//         false
//       );
//     }
//   },
// }).fields([
//   { name: 'studentPhoto', maxCount: 1 },
//   { name: 'aadharCard', maxCount: 1 },
//   { name: 'birthCertificate', maxCount: 1 },
//   { name: 'schoolLeavingCertificate', maxCount: 1 },
//   { name: 'rteCertificate', maxCount: 1 },
// ]);

// const certificateStorage = multerS3({
//   s3: s3Client,
//   bucket: BUCKET_NAME,
//   metadata: (req, file, cb) => {
//     cb(null, { fieldName: file.fieldname });
//   },
//   key: (req, file, cb) => {
//     const schoolId = req.school?._id.toString() || 'unknown';
//     const certificateId = req.params.certificateId || 'unknown';
//     const fileExt = path.extname(file.originalname);
//     const fileName = `${certificateId}_signed_${Date.now()}${fileExt}`;
//     const fileKey = `certificates/${schoolId}/${fileName}`;
//     cb(null, fileKey);
//   },
// });

// const certificateUpload = multer({
//   storage: certificateStorage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for certificates
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === 'application/pdf') {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type: Only PDFs are allowed for certificates'), false);
//     }
//   },
// }).single('certificate');

// module.exports = {
//   uploadStudyMaterial,
//   uploadToS3,
//   deleteFromS3,
//   streamS3Object,
//   uploadDocuments,
//   certificateUpload,
//   s3: s3Client,
// };