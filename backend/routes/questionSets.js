const express = require('express');
const router = express.Router();
const {
  getQuestionSets,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  deleteAllQuestionSets
} = require('../controllers/questionController');
const { protectAdmin } = require('../middleware/authMiddleware');

router.use(protectAdmin);

router.get('/', getQuestionSets);
router.post('/', createQuestionSet);
router.put('/:id', updateQuestionSet);
router.delete('/all', deleteAllQuestionSets);
router.delete('/:id', deleteQuestionSet);

module.exports = router;
