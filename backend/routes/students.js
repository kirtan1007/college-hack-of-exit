const express = require('express');
const router = express.Router();
const { registerStudent, getAllStudents, deleteStudent, exportStudentsCSV } = require('../controllers/studentController');
const { validateStudentRegistration } = require('../middleware/validation');
const { protectAdmin } = require('../middleware/authMiddleware');
const SystemSettings = require('../models/SystemSettings');

// Get public configuration (departments, event settings)
router.get('/config', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    return res.json({
      success: true,
      eventName: settings.eventName,
      eventDescription: settings.eventDescription,
      departments: settings.departments || [],
      semesters: settings.semesters || []
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve configuration' });
  }
});

// Student registration (support both '/' and '/register')
router.post('/', validateStudentRegistration, registerStudent);
router.post('/register', validateStudentRegistration, registerStudent);

// Admin-only operations
router.get('/export', protectAdmin, exportStudentsCSV);
router.get('/export/csv', protectAdmin, exportStudentsCSV);
router.get('/', protectAdmin, getAllStudents);
router.delete('/:id', protectAdmin, deleteStudent);

module.exports = router;
