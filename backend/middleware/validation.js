const SystemSettings = require('../models/SystemSettings');

const validateStudentRegistration = async (req, res, next) => {
  const { name, department, enrollmentNumber, semester, whatsapp, email } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Student Name is required' });
  }

  if (!department || !department.trim()) {
    return res.status(400).json({ success: false, message: 'Department is required' });
  }

  if (!enrollmentNumber || !enrollmentNumber.trim()) {
    return res.status(400).json({ success: false, message: 'Enrollment Number is required' });
  }

  const semStr = semester !== undefined && semester !== null ? String(semester).trim() : '';
  if (!semStr) {
    return res.status(400).json({ success: false, message: 'Semester is required' });
  }

  const waStr = whatsapp !== undefined && whatsapp !== null ? String(whatsapp).trim() : '';
  if (!waStr || waStr.length < 8) {
    return res.status(400).json({ success: false, message: 'A valid WhatsApp Number is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !email.trim() || !emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'A valid Email address is required' });
  }

  next();
};

module.exports = { validateStudentRegistration };
