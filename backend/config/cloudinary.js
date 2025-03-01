


// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET
// });

// const storage = new CloudinaryStorage({
//     cloudinary: cloudinary,
//     params: {
//         folder: 'syllabuses',
//         allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg','png'],
//         // resource_type: 'raw',
//         resource_type: 'auto',

//         public_id: (req, file) => {
//           // Sanitize the filename
//           const originalName = file.originalname;
//           const extension = originalName.split('.').pop().toLowerCase();
          
//           // Remove the extension and special characters, replace spaces with underscores
//           const sanitizedName = originalName
//               .replace(/\.[^/.]+$/, '') // Remove extension
//               .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscore
//               .replace(/_+/g, '_') // Replace multiple underscores with single
//               .toLowerCase();
          
//           // Create a unique filename
//           const uniqueName = `${Date.now()}_${sanitizedName}`;
          
//           return `syllabuses/${uniqueName}`;
//       }
//     }
// });

// const upload = multer({
//     storage: storage,
//     limits: {
//         fileSize: 10 * 1024 * 1024, // 10 MB limit

//     },
//     fileFilter: (req, file, cb) => {
//         console.log('Uploading file type:', file.mimetype);
//         const allowedTypes = [
//             'application/pdf',
//             'application/msword',
//             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//             'image/jpeg'
//         ];
//         if (allowedTypes.includes(file.mimetype)) {
//             cb(null, true);
//         } else {
//             cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and JPG are allowed'), false);
//         }
//     }
// });

// const announcementStorage = new CloudinaryStorage({
//     cloudinary: cloudinary,
//     params: {
//         folder: 'announcements',
//         allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'xls', 'xlsx'],
//         resource_type: 'auto', // This allows for different file types
//         public_id: (req, file) => {
//             const originalName = file.originalname;
//             const sanitizedName = originalName
//                 .replace(/\.[^/.]+$/, '')
//                 .replace(/[^a-zA-Z0-9]/g, '_')
//                 .replace(/_+/g, '_')
//                 .toLowerCase();
            
//             return `announcements/${Date.now()}_${sanitizedName}`;
//         }
//     }
// });

// const announcementUpload = multer({
//     storage: announcementStorage,
//     limits: {
//         fileSize: 15 * 1024 * 1024, // 15MB limit
//     },
//     fileFilter: (req, file, cb) => {
//         const allowedTypes = [
//             'application/pdf',
//             'application/msword',
//             'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//             'image/jpeg',
//             'image/png',
//             'application/vnd.ms-powerpoint',
//             'application/vnd.openxmlformats-officedocument.presentationml.presentation',
//             'application/vnd.ms-excel',
//             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
//         ];
//         if (allowedTypes.includes(file.mimetype)) {
//             cb(null, true);
//         } else {
//             cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, PPT, PPTX, XLS, and XLSX are allowed'), false);
//         }
//     }
// });


// module.exports = { upload, cloudinary ,announcementUpload};


// cloudinary.js
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
//   debug_level: 'all',
// });

// const announcementStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'announcements',
//     allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'xls', 'xlsx'],
//     resource_type: 'auto',
//     timeout: 60000, // Set a 30-second timeout for uploads
//     public_id: (req, file) => {
//     console.log('Cloudinary upload timeout set to:', 60000);
//       const originalName = file.originalname;
//       const sanitizedName = originalName
//         .replace(/\.[^/.]+$/, '')
//         .replace(/[^a-zA-Z0-9]/g, '_')
//         .replace(/_+/g, '_')
//         .toLowerCase();
//       return `announcements/${Date.now()}_${sanitizedName}`;
//     },
//   },
// });


// const announcementUpload = multer({
// //   storage: announcementStorage,
// storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 15 * 1024 * 1024, // 15MB limit
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
//       cb(null, true);
//     } else {
//       const error = new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
//       cb(error, false);
//     }
//   },
// });

// // For syllabus uploads (unchanged, included for completeness)
// const storage = new CloudinaryStorage({
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
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit
//   },
// });

// module.exports = { upload, cloudinary, announcementUpload };


const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  debug_level: 'all', // Enable verbose logging
});

// --- Announcement Upload (disk storage) ---
// const announcementStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
//     const ext = path.extname(file.originalname);
//     const baseName = path.basename(file.originalname, ext);
//     cb(null, `${baseName}-${uniqueSuffix}${ext}`);
//   },
// });

const announcementStorage = multer.memoryStorage();

const announcementUpload = multer({
  storage: announcementStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 15MB limit
  },
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
      console.log(`Announcement file type accepted: ${file.mimetype} for ${file.originalname}`);
      cb(null, true);
    } else {
      const error = new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
      console.error('Announcement file type rejected:', { file: file.originalname, mimetype: file.mimetype });
      cb(error, false);
    }
  },
});

// --- Syllabus Upload (Cloudinary storage, from original) ---
const syllabusStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'syllabuses',
    allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    resource_type: 'auto',
    public_id: (req, file) => {
      const originalName = file.originalname;
      const sanitizedName = originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .toLowerCase();
      return `syllabuses/${Date.now()}_${sanitizedName}`;
    },
  },
});

const upload = multer({
  storage: syllabusStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (from original)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      console.log(`Syllabus file type accepted: ${file.mimetype} for ${file.originalname}`);
      cb(null, true);
    } else {
      const error = new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allowedTypes.join(', ')}`);
      console.error('Syllabus file type rejected:', { file: file.originalname, mimetype: file.mimetype });
      cb(error, false);
    }
  },
});

// Export both upload middlewares
module.exports = { announcementUpload, upload, cloudinary };