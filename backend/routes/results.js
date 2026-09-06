const express = require('express');
const router = express.Router();
const { getRankings, getAllResults, exportResultsCSV, deleteResult, clearAllResults } = require('../controllers/resultController');
const { protectAdmin } = require('../middleware/authMiddleware');

// Public rankings routes
router.get('/ranking', getRankings);
router.get('/leaderboard', getRankings);

// Results export (public or admin download)
router.get('/export', exportResultsCSV);
router.get('/export/csv', exportResultsCSV);

// Admin-only results routes
router.get('/all', protectAdmin, getAllResults);
router.delete('/all', protectAdmin, clearAllResults);
router.delete('/:id', protectAdmin, deleteResult);

module.exports = router;
