
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { setTimeout } = require('timers/promises');
const logger = require("../utils/logger");


const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
    }
  },
});



const uploadBookCover = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and JPG files are allowed for book covers"), false);
    }
  },
}).single('cover');


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
  limits: { fileSize: 15 * 1024 * 1024 }, 
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
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type: Only PDFs are allowed for certificates'), false);
    }
  },
}).single('certificate');





// Study material upload configuration
const studyMaterialStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    logger.info('Setting S3 metadata for study material', {
      originalName: file.originalname,
      uploadedBy: req.user?._id?.toString() || 'unknown',
    });
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user?._id?.toString() || 'unknown',
    });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id.toString() || 'unknown';
    const classId = req.params.classId || req.body.classId || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `${file.fieldname}_${Date.now()}${fileExt}`;
    const fileKey = `study-materials/${schoolId}/${classId}/${fileName}`;
    logger.info(`Uploading study material to S3 with key: ${fileKey}`);
    cb(null, fileKey);
  },
});

const uploadStudyMaterial = multer({
  storage: studyMaterialStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    logger.info('Multer fileFilter for study material running...', {
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
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
    }
  },
}).single('file');

// Syllabus upload configuration
const syllabusStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  acl: 'public-read', // Make files publicly accessible
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user?._id?.toString() || 'unknown',
    });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id.toString() || 'unknown';
    const classId = req.params.classId || req.body.classId || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `syllabus_${Date.now()}${fileExt}`;
    const fileKey = `syllabus/${schoolId}/${classId}/${fileName}`;
    logger.info(`Uploading syllabus to S3 with key: ${fileKey}`);
    cb(null, fileKey);
  },
});

const uploadSyllabus = multer({
  storage: syllabusStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    logger.info('Multer fileFilter for syllabus running...');
    logger.info('File details:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    const allowedTypes = ['application/pdf'];

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

// Excel results upload configuration
const excelResultsStorage = multerS3({
  s3: s3Client,
  bucket: BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req, file, cb) => {
    logger.info("Processing file metadata", { originalName: file.originalname });
    cb(null, {
      originalName: file.originalname,
      uploadedBy: req.user?._id?.toString() || 'unknown',
    });
  },
  key: (req, file, cb) => {
    const schoolId = req.school?._id.toString() || 'unknown';
    const classId = req.params.classId || 'unknown';
    const examType = req.params.examType || 'unknown';
    const fileExt = path.extname(file.originalname);
    const fileName = `results_${classId}_${examType}_${Date.now()}${fileExt}`;
    const fileKey = `results/${schoolId}/${classId}/${fileName}`;
    logger.info(`Uploading results Excel to S3 with key: ${fileKey}`);
    cb(null, fileKey);
  },
});

const uploadExcelResults = multer({
  storage: excelResultsStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      logger.info("File type accepted", { mimetype: file.mimetype });
      cb(null, true);
    } else {
      logger.error("Invalid file type", { mimetype: file.mimetype });
      cb(
        new Error(
          `Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`
        ),
        false
      );
    }
  },
}).single("file", (err, req, res, next) => {
  if (err) {
    logger.error("Multer error", { error: err.message });
    return res.status(400).json({ success: false, error: err.message });
  }
  next();
});


const getPublicFileUrl = (key) => {
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
};


const uploadToS3 = async (buffer, key, mimetype, retries = 3, delay = 1000) => {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          ACL: 'public-read',
        },
      });
      await upload.done();
      return getPublicFileUrl(key);
    } catch (error) {
      lastError = error;
      logger.warn(`S3 upload attempt ${attempt} failed for ${key}: ${error.message}`);
      if (attempt < retries) {
        await setTimeout(delay * attempt); // Exponential backoff
      }
    }
  }
  throw new Error(`Failed to upload to S3 after ${retries} attempts: ${lastError.message}`);
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

module.exports = { upload,uploadBookCover,uploadDocuments, certificateUpload, uploadToS3, deleteFromS3, streamS3Object, s3: s3Client,uploadStudyMaterial,getPublicFileUrl,uploadSyllabus,uploadExcelResults};


