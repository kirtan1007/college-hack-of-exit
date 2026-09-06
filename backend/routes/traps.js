const express = require('express');
const router = express.Router();
const {
  getTraps,
  createTrap,
  updateTrap,
  deleteTrap,
  deleteAllTraps
} = require('../controllers/questionController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.use(protectAdmin);

router.get('/', getTraps);
router.post('/', createTrap);
router.put('/:id', updateTrap);
router.delete('/all', deleteAllTraps);
router.delete('/:id', deleteTrap);

module.exports = router;
