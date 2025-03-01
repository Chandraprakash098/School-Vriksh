// const multerErrorHandler = (err, req, res, next) => {
//     if (err.code === 'LIMIT_FILE_SIZE') {
//       return res.status(400).json({
//         message: 'File size too large. Maximum size is 10MB.'
//       });
//     }
    
//     if (err.message === 'Only PDF and JPG formats are allowed') {
//       return res.status(400).json({
//         message: err.message
//       });
//     }
    
//     if (err) {
//       return res.status(400).json({
//         message: 'Error uploading file',
//         error: err.message
//       });
//     }
    
//     next();
//   };
  
//   module.exports = { multerErrorHandler };


// middleware/errorHandler.js
const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', err.message, err.stack);
    return res.status(400).json({ error: 'File upload error', details: err.message });
  }
  if (err.message?.includes('Invalid file type')) {
    console.error('File type error:', err.message);
    return res.status(400).json({ error: 'Invalid file type', details: err.message });
  }
  if (err) {
    console.error('Unexpected error:', err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
  next();
};

module.exports = { multerErrorHandler };