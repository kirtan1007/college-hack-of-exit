const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/authMiddleware');

router.use(protectAdmin);

// In the new system, 6 Good + 6 Bad clues are embedded directly inside each Question
router.get('/', (req, res) => {
  return res.json({ success: true, clues: [] });
});

router.post('/', (req, res) => {
  return res.json({ success: true, message: 'Clues are configured directly inside each Question.' });
});

router.put('/:id', (req, res) => {
  return res.json({ success: true });
});

router.delete('/all', (req, res) => {
  return res.json({ success: true });
});

router.delete('/:id', (req, res) => {
  return res.json({ success: true });
});

module.exports = router;
