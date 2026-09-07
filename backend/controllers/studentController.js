const Student = require('../models/Student');
const GameSession = require('../models/GameSession');
const PCAssignment = require('../models/PCAssignment');
const SystemSettings = require('../models/SystemSettings');
const QuestionSet = require('../models/QuestionSet');
const Question = require('../models/Question');

// Register student and start session
const registerStudent = async (req, res) => {
  const { name, department, enrollmentNumber, semester, whatsapp, email, pcId } = req.body;

  try {
    // Check if enrollment number already exists
    let student = await Student.findOne({ enrollmentNumber });
    if (student) {
      // Check if they have an active or completed session
      const activeSession = await GameSession.findOne({ 
        studentId: student._id, 
        status: { $in: ['ACTIVE', 'COMPLETED', 'GAME_OVER'] } 
      });
      if (activeSession) {
        return res.status(400).json({ 
          success: false, 
          message: 'This enrollment number has already started or completed a game session.' 
        });
      }
    } else {
      // Create student
      student = new Student({
        name,
        department,
        enrollmentNumber,
        semester,
        whatsapp,
        email
      });
      await student.save();
    }

    // Get system settings for timer and active questions
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }

    const defaultTimerMinutes = settings.defaultTimerMinutes || 30;
    const allowedDuration = defaultTimerMinutes * 60; // in seconds

    // Determine active questions pool (configured by Admin)
    let activePool = (settings.activeQuestionIds && settings.activeQuestionIds.length > 0)
      ? settings.activeQuestionIds
      : [];

    if (activePool.length === 0) {
      const allQ = await Question.find({}).sort({ questionId: 1 });
      activePool = allQ.map(q => q.questionId);
    }

    if (activePool.length === 0) {
      activePool = ['Q01', 'Q02'];
    }

    // Identify assigned set for this PC
    const sanitizedPcId = (pcId || 'PC-01').trim().toUpperCase();
    const pcNumMatch = sanitizedPcId.match(/\d+/);
    const pcNum = pcNumMatch ? parseInt(pcNumMatch[0], 10) : 1;

    // Dynamic pattern assignment based on active questions:
    // If 2 questions active: alternate A & B (PC-1=A, PC-2=B, PC-3=A, PC-4=B...)
    // If 3+ questions active: cycle A, B, C (PC-1=A, PC-2=B, PC-3=C, PC-4=A...)
    let dynamicPattern = 'A';
    if (activePool.length === 2) {
      dynamicPattern = (pcNum % 2 === 1) ? 'A' : 'B';
    } else {
      const rem = pcNum % 3;
      if (rem === 1) dynamicPattern = 'A';
      else if (rem === 2) dynamicPattern = 'B';
      else dynamicPattern = 'C';
    }

    let pcAssign = await PCAssignment.findOne({ pcId: sanitizedPcId });
    if (!pcAssign) {
      pcAssign = new PCAssignment({
        pcId: sanitizedPcId,
        assignedSet: dynamicPattern
      });
      await pcAssign.save();
    } else {
      // Keep terminal in sync with active contest pattern rules
      pcAssign.assignedSet = dynamicPattern;
      await pcAssign.save();
    }

    const assignedSet = dynamicPattern;

    // Verify question set configuration exists
    let qSetObj = await QuestionSet.findOne({ name: assignedSet });
    if (!qSetObj) {
      // Fallback to Set A if specific set not seeded
      qSetObj = await QuestionSet.findOne({ name: 'A' }) || { entryBinaryPassword: '1001' };
    }

    // Anti-Cheat Adjacent-PC Disjoint Rotation:
    // Every PC gets offset = (pcNum - 1) % activePool.length
    // For 2 questions: PC 1 gets [Q1, Q2], PC 2 gets [Q2, Q1], PC 3 gets [Q1, Q2]...
    // For 3 questions: PC 1 gets [Q1, Q2, Q3], PC 2 gets [Q2, Q3, Q1], PC 3 gets [Q3, Q1, Q2]...
    // Guarantee: Adjacent PCs (PC 1 & PC 2, PC 2 & PC 3, etc.) NEVER have the same question at any stage!
    const offset = (pcNum - 1) % activePool.length;
    const sequence = [...activePool.slice(offset), ...activePool.slice(0, offset)];

    const startQId = sequence[0] || qSetObj.startQuestionId || 'Q01';

    // Create session ID
    const sessionId = 'SESS-' + Math.random().toString(36).substr(2, 9).toUpperCase();

    // Create Game Session
    const gameSession = new GameSession({
      sessionId,
      studentId: student._id,
      pcId: sanitizedPcId,
      questionSet: assignedSet,
      startTime: new Date(),
      currentQuestion: startQId,
      currentQuestionIndex: 0,
      questionSequence: sequence,
      status: 'ACTIVE',
      allowedDuration,
      unlocked: false
    });

    await gameSession.save();

    return res.json({
      success: true,
      message: 'Student registered and game started.',
      sessionId,
      pcId: sanitizedPcId,
      questionSet: assignedSet
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// Admin only: Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });
    return res.json({ success: true, students });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve students' });
  }
};

// Admin only: Delete student
const deleteStudent = async (req, res) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Student record deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete student' });
  }
};

// Admin only: Export all students as CSV
const exportStudentsCSV = async (req, res) => {
  try {
    const students = await Student.find().sort({ createdAt: -1 });

    let csvContent = 'Student Name,Enrollment Number,Department,Semester,WhatsApp Number,Email Address,Registered At\n';

    students.forEach(s => {
      const name = `"${(s.name || '').replace(/"/g, '""')}"`;
      const rawEnroll = (s.enrollmentNumber || '').toString().trim();
      const enrollment = `="${rawEnroll}"`;
      const dept = `"${(s.department || '').replace(/"/g, '""')}"`;
      const sem = `"${(s.semester || '').replace(/"/g, '""')}"`;
      const rawWhatsapp = (s.whatsapp || '').toString().trim();
      const whatsapp = rawWhatsapp ? `="${rawWhatsapp}"` : '""';
      const email = `"${(s.email || '').replace(/"/g, '""')}"`;
      const date = new Date(s.createdAt).toLocaleString();

      csvContent += `${name},${enrollment},${dept},${sem},${whatsapp},${email},"${date}"\n`;
    });

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=hack_the_exit_students.csv');
    return res.status(200).send(bom + csvContent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to export students CSV' });
  }
};

module.exports = { registerStudent, getAllStudents, deleteStudent, exportStudentsCSV };
