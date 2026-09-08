const express = require('express');
const router = express.Router();
const {
  getPCAssignments,
  savePCAssignment,
  deletePCAssignment,
  generate20PCs,
  getTimerSettings,
  saveTimerSettings,
  getSystemSettings,
  saveSystemSettings,
  getDashboardStats,
  getLiveSessions,
  getActiveQuestionsConfig,
  saveActiveQuestionsConfig
} = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');

// All admin routes are protected
router.use(protectAdmin);

router.get('/stats', getDashboardStats);
router.get('/live-sessions', getLiveSessions);

router.get('/active-questions', getActiveQuestionsConfig);
router.post('/active-questions', saveActiveQuestionsConfig);

router.get('/pc-assignment', getPCAssignments);
router.post('/pc-assignment', savePCAssignment);
router.post('/pc-assignment/generate-20', generate20PCs);
router.delete('/pc-assignment/:id', deletePCAssignment);

router.get('/timer', getTimerSettings);
router.post('/timer', saveTimerSettings);

router.get('/settings', getSystemSettings);
router.post('/settings', saveSystemSettings);

module.exports = router;
