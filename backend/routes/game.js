const express = require('express');
const router = express.Router();
const {
  getGameSession,
  unlockEntryChallenge,
  recordClueView,
  submitClueSelection,
  submitAnswer,
  submitPasskey,
  completeGame
} = require('../controllers/gameController');

// Support parameter-based and body/query based routes
router.get('/current-question', getGameSession);
router.get('/:sessionId', getGameSession);

router.post('/:sessionId/unlock', unlockEntryChallenge);

// Clue Selection (Exactly 6 of 12)
router.post('/questions/:questionId/clues', submitClueSelection);
router.post('/:sessionId/clues', submitClueSelection);
router.post('/submit-clues', submitClueSelection);

router.post('/submit-answer', submitAnswer);
router.post('/:sessionId/answer', submitAnswer);

router.post('/submit-passkey', submitPasskey);
router.post('/:sessionId/passkey', submitPasskey);

router.post('/clue-view', recordClueView);
router.post('/:sessionId/clue-view', recordClueView);

router.post('/:sessionId/complete', completeGame);

module.exports = router;
