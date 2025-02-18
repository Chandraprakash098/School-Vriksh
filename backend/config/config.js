module.exports = {
    mongoURI: process.env.MONGO_URI || 'mongodb://localhost:27017/school-management',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtExpiration: '24h',
    passwordSaltRounds: 10,
    allowedOrigins: ['http://localhost:3000'],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    supportedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    rteQuotaPercentage: 25
  };