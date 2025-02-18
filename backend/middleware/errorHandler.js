const multerErrorHandler = (err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
    
    if (err.message === 'Only PDF and JPG formats are allowed') {
      return res.status(400).json({
        message: err.message
      });
    }
    
    if (err) {
      return res.status(400).json({
        message: 'Error uploading file',
        error: err.message
      });
    }
    
    next();
  };
  
  module.exports = { multerErrorHandler };