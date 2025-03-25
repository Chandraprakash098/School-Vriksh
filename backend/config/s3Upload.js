

// const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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

// // Admission Documents Upload (specific fields)
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

// // Certificate Upload (single PDF file)
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
// }).single('certificate'); // Single file upload with field name 'certificate'

// // General-purpose buffer upload to S3
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

// // Delete object from S3
// const deleteFromS3 = async (key) => {
//   const command = new DeleteObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });
//   return s3Client.send(command);
// };

// // Generate pre-signed URL
// const getPresignedUrl = async (key, expiresIn = 3600) => {
//   const command = new GetObjectCommand({
//     Bucket: BUCKET_NAME,
//     Key: key,
//   });
//   const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
//   return await getSignedUrl(s3Client, command, { expiresIn });
// };

// module.exports = { uploadDocuments, certificateUpload, uploadToS3, deleteFromS3, getPresignedUrl, s3: s3Client };


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


// const logoStorage = multerS3({
//   s3: s3Client,
//   bucket: BUCKET_NAME,
//   metadata: (req, file, cb) => {
//     cb(null, { fieldName: file.fieldname });
//   },
//   key: (req, file, cb) => {
//     const schoolId = req.school?._id.toString() || 'unknown';
//     const fileExt = path.extname(file.originalname);
//     const fileName = `logo_${schoolId}_${Date.now()}${fileExt}`;
//     const fileKey = `logos/${schoolId}/${fileName}`;
//     cb(null, fileKey);
//   },
// });

// const uploadSchoolLogo = multer({
//   storage: logoStorage,
//   limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for logos
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = ['image/jpeg', 'image/png'];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
//     }
//   }
// }).single('logo');

// const preserveBodyWithLogo = (req, res, next) => {
//   console.log('Request body:', req.body);
//   console.log('Request headers:', req.headers);
//   console.log('Request file:', req.file);

//   if (!req.body || Object.keys(req.body).length === 0) {
//     try {
//       // Try parsing from x-school-data header
//       const schoolData = req.headers['x-school-data'];
//       if (schoolData) {
//         req.body = JSON.parse(schoolData);
//       }
//     } catch (error) {
//       console.error('Error parsing x-school-data:', error);
//     }
//   }
//   next();
// };

const logoStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  metadata: (req, file, cb) => {
      cb(null, { 
          fieldName: file.fieldname,
          uploadedAt: new Date().toISOString()
      });
  },
  key: (req, file, cb) => {
      const sanitizedName = req.body.name 
          ? req.body.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
          : 'unknown';
      const timestamp = Date.now();
      const fileExt = path.extname(file.originalname);
      const fileName = `logo_${sanitizedName}_${timestamp}${fileExt}`;
      const fileKey = `logos/${sanitizedName}/${fileName}`;
      console.log('Generated S3 key:', fileKey); // Log the key
      cb(null, fileKey);
  }
});

const uploadSchoolLogo = multer({
  storage: logoStorage,
  limits: { 
      fileSize: 2 * 1024 * 1024 // 2MB limit
  },
  fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
      } else {
          cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
      }
  }
}).single('logo');

const preserveBodyWithLogo = (req, res, next) => {
  console.log('Raw request body:', req.body);
  console.log('Uploaded file:', req.file);

  try {
      // If body is empty but file exists, Multer has already parsed it
      if (!req.body || Object.keys(req.body).length === 0) {
          return next(); // Skip if no additional processing needed
      }

      const processNestedData = (body) => {
          const result = {};
          Object.keys(body).forEach(key => {
              try {
                  result[key] = typeof body[key] === 'string' && body[key].startsWith('{')
                      ? JSON.parse(body[key])
                      : body[key];
              } catch (parseError) {
                  result[key] = body[key];
              }
          });
          return result;
      };

      req.body = processNestedData(req.body);
      console.log('Processed request body:', req.body);
      next();
  } catch (error) {
      console.error('Body processing error:', error);
      res.status(400).json({ 
          error: 'Invalid request data', 
          message: error.message 
      });
  }
};

const handleMulterErrors = (err, req, res, next) => {
  console.error('Multer error details:', err);
  if (err instanceof multer.MulterError) {
      return res.status(400).json({
          error: 'File upload error',
          message: err.message,
          code: err.code
      });
  } else if (err) {
      return res.status(500).json({
          error: 'Upload failed',
          message: err.message
      });
  }
  next();
};

module.exports = { uploadDocuments, certificateUpload, uploadToS3, deleteFromS3, streamS3Object, s3: s3Client,uploadSchoolLogo,preserveBodyWithLogo,handleMulterErrors };