const restoreConnection = (req, res, next) => {
    if (req.path.includes('/study-materials') || req.path.includes('/syllabus')) {
      logger.info('Skipping connection restoration for study-materials or syllabus route', {
        path: req.path,
      });
      return next();
    }
    if (req._preservedDbConnection) {
      logger.info('Restoring preserved connection', {
        connectionName: req._preservedDbConnection.name,
      });
      req.connection = req._preservedDbConnection;
    }
    next();
  };