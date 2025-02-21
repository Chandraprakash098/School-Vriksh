// // config/cloudinary.js
// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// // Configure Cloudinary
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// // Configure Cloudinary storage for Multer
// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'syllabuses',
//     allowed_formats: ['pdf', 'jpg', 'jpeg'],
//     resource_type: 'auto' // auto-detect whether it's an image or raw file
//   }
// });

// // Create the Multer instance with Cloudinary storage
// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10 MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     // Accept only pdf and jpg/jpeg files
//     if (file.mimetype === 'application/pdf' || 
//         file.mimetype === 'image/jpeg' || 
//         file.mimetype === 'image/jpg') {
//       cb(null, true);
//     } else {
//       cb(new Error('Only PDF and JPG formats are allowed'), false);
//     }
//   }
// });

// module.exports = { upload, cloudinary };

// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'syllabuses',
//     allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg'],
//     resource_type: 'auto',
//     public_id: (req, file) => `${Date.now()}-${file.originalname}` // Add unique identifier
//   }
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10 MB limit
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedTypes = [
//       'application/pdf',
//       'application/msword',
//       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
//       'image/jpeg',
//       'image/jpg'
//     ];
//     if (allowedTypes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and JPG formats are allowed'), false);
//     }
//   }
// });

// module.exports = { upload, cloudinary };

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
//         allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg'],
//         resource_type: 'raw', // Changed to raw for proper document handling
//         // public_id: (req, file) => `${Date.now()}-${file.originalname}`
//         public_id: (req, file) => `${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, '')}`
    
//     }
// });

// const upload = multer({
//     storage: storage,
//     limits: {
//         fileSize: 10 * 1024 * 1024, // 10 MB limit
//     },
//     fileFilter: (req, file, cb) => {
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

// module.exports = { upload, cloudinary };


const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'syllabuses',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg'],
        resource_type: 'raw',
        public_id: (req, file) => {
            // Ensure we keep the file extension in the public_id
            const originalName = file.originalname;
            const extension = originalName.split('.').pop().toLowerCase();
            const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, '');
            return `syllabuses/${Date.now()}-${nameWithoutExtension}.${extension}`;
        }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and JPG are allowed'), false);
        }
    }
});

module.exports = { upload, cloudinary };