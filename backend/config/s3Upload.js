const { S3Client } = require('@aws-sdk/client-s3');
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

const uploadToS3 = async (buffer, key) => {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    },
  });
  return upload.done();
};

const deleteFromS3 = async (key) => {
  const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return s3Client.send(command);
};

module.exports = { uploadDocuments, uploadToS3, deleteFromS3, s3: s3Client };