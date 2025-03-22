// const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
// const { Upload } = require('@aws-sdk/lib-storage');
// const multer = require('multer');
// const multerS3 = require('multer-s3');
// const path = require('path');

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

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
//   limits: { fileSize: 15 * 1024 * 1024 },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
//     }
//   },
// }).fields([
//   { name: 'studentPhoto', maxCount: 1 },
//   { name: 'aadharCard', maxCount: 1 },
//   { name: 'birthCertificate', maxCount: 1 },
//   { name: 'schoolLeavingCertificate', maxCount: 1 },
//   { name: 'rteCertificate', maxCount: 1 },
// ]);

// const uploadToS3 = async (buffer, key) => {
//   const upload = new Upload({
//     client: s3Client,
//     params: {
//       Bucket: BUCKET_NAME,
//       Key: key,
//       Body: buffer,
//       ContentType: 'application/pdf',
//     },
//   });
//   return upload.done();
// };

// const deleteFromS3 = async (key) => {
//   const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
//   const command = new DeleteObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });
//   return s3Client.send(command);
// };

// // New function to generate pre-signed URL
// const getPresignedUrl = async (key, expiresIn = 3600) => { // expiresIn = 1 hour by default
//   const command = new GetObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });
//   const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
//   return await getSignedUrl(s3Client, command, { expiresIn });
// };

// module.exports = { uploadDocuments, uploadToS3, deleteFromS3, getPresignedUrl, s3: s3Client };


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
}).single('certificate'); // Single file upload with field name 'certificate'

// General-purpose buffer upload to S3
const uploadToS3 = async (buffer, key) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf', // Default to PDF, adjust if needed
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

// Generate pre-signed URL
const getPresignedUrl = async (key, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
  return await getSignedUrl(s3Client, command, { expiresIn });
};

module.exports = { uploadDocuments, certificateUpload, uploadToS3, deleteFromS3, getPresignedUrl, s3: s3Client };