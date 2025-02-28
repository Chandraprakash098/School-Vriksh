


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
        // resource_type: 'raw',
        resource_type: 'auto',

        public_id: (req, file) => {
          // Sanitize the filename
          const originalName = file.originalname;
          const extension = originalName.split('.').pop().toLowerCase();
          
          // Remove the extension and special characters, replace spaces with underscores
          const sanitizedName = originalName
              .replace(/\.[^/.]+$/, '') // Remove extension
              .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars with underscore
              .replace(/_+/g, '_') // Replace multiple underscores with single
              .toLowerCase();
          
          // Create a unique filename
          const uniqueName = `${Date.now()}_${sanitizedName}`;
          
          return `syllabuses/${uniqueName}`;
      }
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB limit

    },
    fileFilter: (req, file, cb) => {
        console.log('Uploading file type:', file.mimetype);
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

const announcementStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'announcements',
        allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'xls', 'xlsx'],
        resource_type: 'auto', // This allows for different file types
        public_id: (req, file) => {
            const originalName = file.originalname;
            const sanitizedName = originalName
                .replace(/\.[^/.]+$/, '')
                .replace(/[^a-zA-Z0-9]/g, '_')
                .replace(/_+/g, '_')
                .toLowerCase();
            
            return `announcements/${Date.now()}_${sanitizedName}`;
        }
    }
});

const announcementUpload = multer({
    storage: announcementStorage,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB limit
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
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, PNG, PPT, PPTX, XLS, and XLSX are allowed'), false);
        }
    }
});


module.exports = { upload, cloudinary ,announcementUpload};