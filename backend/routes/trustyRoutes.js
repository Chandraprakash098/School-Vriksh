const express = require('express');
const router = express.Router();

// Example route (Add at least one route to avoid an empty router issue)
router.get('/', (req, res) => {
  res.send('Trusty API is working');
});

module.exports = router;
