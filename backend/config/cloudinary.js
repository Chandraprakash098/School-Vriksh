

// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');
// const path = require('path');

// // Configure Cloudinary with environment variables
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
//   debug_level: 'all', // Enable verbose logging
// });

// // --- Announcement Upload (disk storage) ---
// // const announcementStorage = multer.diskStorage({
// //   destination: (req, file, cb) => {
// //     cb(null, 'uploads/');
// //   },
// //   filename: (req, file, cb) => {
// //     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
// //     const ext = path.extname(file.originalname);
// //     const baseName = path.basename(file.originalname, ext);
// //     cb(null, `${baseName}-${uniqueSuffix}${ext}`);
// //   },
// // });

// const announcementStorage = multer.memoryStorage();

// const announcementUpload = multer({
//   storage: announcementStorage,
//   limits: {
//     fileSize: 20 * 1024 * 1024, // 15MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'application/pdf',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'image/jpeg',
//       'image/png',
//       'application/vnd.ms-powerpoint',
//       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
//       'application/vnd.ms-excel',
//       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       console.log(`Announcement file type accepted: ${file.mimetype} for ${file.originalname}`);
//       cb(null, true);
//     } else {
//       const error = new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
//       console.error('Announcement file type rejected:', { file: file.originalname, mimetype: file.mimetype });
//       cb(error, false);
//     }
//   },
// });

// // --- Syllabus Upload (Cloudinary storage, from original) ---
// const syllabusStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'syllabuses',
//     allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
//     resource_type: 'auto',
//     public_id: (req, file) => {
//       const originalName = file.originalname;
//       const sanitizedName = originalName
//         .replace(/\.[^/.]+$/, '')
//         .replace(/[^a-zA-Z0-9]/g, '_')
//         .replace(/_+/g, '_')
//         .toLowerCase();
//       return `syllabuses/${Date.now()}_${sanitizedName}`;
//     },
//   },
// });

// const upload = multer({
//   storage: syllabusStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit (from original)
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'application/pdf',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'image/jpeg',
//       'image/png',
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       console.log(`Syllabus file type accepted: ${file.mimetype} for ${file.originalname}`);
//       cb(null, true);
//     } else {
//       const error = new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
//       console.error('Syllabus file type rejected:', { file: file.originalname, mimetype: file.mimetype });
//       cb(error, false);
//     }
//   },
// });


// // Export both upload middlewares
// module.exports = { announcementUpload, upload, cloudinary };


const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Syllabus Upload (Cloudinary Storage) ---
const syllabusStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const originalName = file.originalname;
    const sanitizedName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
    return {
      folder: 'syllabuses',
      resource_type: 'auto',
      public_id: `syllabuses/${Date.now()}_${sanitizedName}`,
      timeout: 120000,
    };
  },
});

const upload = multer({
  storage: syllabusStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
    }
  },
});

// --- Announcement Upload (Memory Storage with Cloudinary Streaming) ---
const announcementStorage = multer.memoryStorage();

const announcementUpload = multer({
  storage: announcementStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`), false);
    }
  },
});

const certificateStorage = multer.memoryStorage();

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
});

// Helper function to upload a PDF buffer to Cloudinary
const uploadCertificateToCloudinary = (buffer, certificateId, certificateType) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'certificates',
        public_id: `certificates/${certificateType}_${certificateId}_${Date.now()}`,
        resource_type: 'raw', // Use 'raw' for PDFs
        timeout: 120000,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

module.exports = { upload, announcementUpload, certificateUpload, cloudinary, uploadCertificateToCloudinary };