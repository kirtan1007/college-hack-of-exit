const PCAssignment = require('../models/PCAssignment');
const SystemSettings = require('../models/SystemSettings');
const GameSession = require('../models/GameSession');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Question = require('../models/Question');
const Trap = require('../models/Trap');

// Get all PC Assignments
const getPCAssignments = async (req, res) => {
  try {
    const assignments = await PCAssignment.find().sort({ pcId: 1 });
    return res.json({ success: true, assignments });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to get PC assignments' });
  }
};

// Save or Update PC Assignment
const savePCAssignment = async (req, res) => {
  const { pcId, assignedSet } = req.body;
  if (!pcId || !assignedSet) {
    return res.status(400).json({ success: false, message: 'pcId and assignedSet are required' });
  }

  try {
    const sanitizedPcId = pcId.trim().toUpperCase();
    
    // Check if there is an active session on this PC
    const activeSession = await GameSession.findOne({ pcId: sanitizedPcId, status: 'ACTIVE' });
    if (activeSession) {
      return res.status(400).json({
        success: false,
        message: `Cannot change assignment. PC ${sanitizedPcId} currently has an active game session.`
      });
    }

    let assignment = await PCAssignment.findOne({ pcId: sanitizedPcId });
    if (assignment) {
      assignment.assignedSet = assignedSet;
      await assignment.save();
    } else {
      assignment = new PCAssignment({ pcId: sanitizedPcId, assignedSet });
      await assignment.save();
    }

    return res.json({ success: true, message: 'PC assignment saved successfully', assignment });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to save PC assignment' });
  }
};

// Delete a PC Assignment
const deletePCAssignment = async (req, res) => {
  try {
    await PCAssignment.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'PC assignment deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete PC assignment' });
  }
};

// Generate 20 PCs (PC-01 to PC-20 alternating A and B)
const generate20PCs = async (req, res) => {
  try {
    const activeSessions = await GameSession.find({ status: 'ACTIVE' });
    if (activeSessions && activeSessions.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot regenerate PCs while there are active game sessions.'
      });
    }

    await PCAssignment.deleteMany({});
    const pcSeeds = [];
    for (let i = 1; i <= 20; i++) {
      const pad = i < 10 ? '0' + i : '' + i;
      pcSeeds.push({
        pcId: `PC-${pad}`,
        assignedSet: i % 2 === 1 ? 'A' : 'B'
      });
    }
    await PCAssignment.insertMany(pcSeeds);
    const assignments = await PCAssignment.find().sort({ pcId: 1 });
    return res.json({
      success: true,
      message: 'Successfully generated 20 PC terminals (PC-01 to PC-20 with alternating Set A & Set B)',
      assignments
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to generate 20 PCs' });
  }
};

// Get Timer settings
const getTimerSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    return res.json({ success: true, defaultTimerMinutes: settings.defaultTimerMinutes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to get timer settings' });
  }
};

// Save Timer settings
const saveTimerSettings = async (req, res) => {
  const { minutes } = req.body;
  if (minutes === undefined || minutes <= 0) {
    return res.status(400).json({ success: false, message: 'Valid minutes required' });
  }

  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }
    settings.defaultTimerMinutes = minutes;
    await settings.save();
    return res.json({ success: true, message: 'Timer saved successfully', defaultTimerMinutes: settings.defaultTimerMinutes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to save timer settings' });
  }
};

// Get all system settings
const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }
    return res.json({ success: true, settings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to get system settings' });
  }
};

// Update system settings
const saveSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }
    
    const { eventName, eventDescription, defaultTimerMinutes, maxPasswordAttempts, enableHints, departments, semesters } = req.body;
    
    if (eventName !== undefined) settings.eventName = eventName;
    if (eventDescription !== undefined) settings.eventDescription = eventDescription;
    if (defaultTimerMinutes !== undefined) settings.defaultTimerMinutes = defaultTimerMinutes;
    if (maxPasswordAttempts !== undefined) settings.maxPasswordAttempts = maxPasswordAttempts;
    if (enableHints !== undefined) settings.enableHints = enableHints;
    if (departments !== undefined) settings.departments = departments;
    if (semesters !== undefined) settings.semesters = semesters;

    await settings.save();
    return res.json({ success: true, message: 'System settings updated successfully', settings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to save system settings' });
  }
};

// Get dashboard stats with questions and passkey telemetry
const getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await Student.countDocuments();
    const activeGames = await GameSession.countDocuments({ status: 'ACTIVE' });
    const completedGames = await GameSession.countDocuments({ status: 'COMPLETED' });
    const gameOverGames = await GameSession.countDocuments({ status: 'GAME_OVER' });

    // Questions telemetry
    const totalQuestions = await Question.countDocuments();
    const publishedQuestions = await Question.countDocuments({ active: true });

    // Sessions metrics
    const sessions = await GameSession.find({});
    let totalQuestionsSolved = 0;
    let totalPasskeysUsed = 0;
    let totalAnswerAttempts = 0;

    sessions.forEach(s => {
      totalQuestionsSolved += (s.questionsSolved || 0);
      totalPasskeysUsed += (s.passkeysUsed || 0);
      totalAnswerAttempts += (s.totalAnswerAttempts || 0);
    });

    const avgAttemptsPerPlayer = sessions.length > 0 ? (totalAnswerAttempts / sessions.length).toFixed(1) : '0';

    // Find the fastest completion time from Results collection
    const fastestResult = await Result.findOne({ result: 'WIN' }).sort({ completionTime: 1, trapCount: 1, wrongChoices: 1 });
    
    let fastestTimeStr = 'N/A';
    let currentLeader = 'N/A';
    
    if (fastestResult) {
      const minutes = Math.floor(fastestResult.completionTime / 60);
      const seconds = fastestResult.completionTime % 60;
      fastestTimeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      currentLeader = fastestResult.studentName;
    }

    const pcAssignmentsCount = await PCAssignment.countDocuments();

    return res.json({
      success: true,
      stats: {
        totalStudents,
        activeGames,
        completedGames,
        gameOverGames,
        fastestCompletionTime: fastestTimeStr,
        currentLeader,
        pcAssignmentsCount,
        totalQuestions,
        publishedQuestions,
        totalQuestionsSolved,
        totalPasskeysUsed,
        avgAttemptsPerPlayer
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to load stats' });
  }
};

// Get live active operator sessions with full question, good clues, and passkey telemetry
const getLiveSessions = async (req, res) => {
  try {
    const [sessions, allQuestions, allTraps] = await Promise.all([
      GameSession.find({}).populate('studentId').sort({ updatedAt: -1 }),
      Question.find({}),
      Trap.find({})
    ]);

    const questionMap = {};
    allQuestions.forEach(q => {
      if (q.questionId) questionMap[q.questionId] = q;
    });

    const trapMap = {};
    allTraps.forEach(t => {
      if (t.trapId) trapMap[t.trapId] = t;
    });

    const liveData = sessions.map(s => {
      const student = s.studentId || {};
      const now = new Date();
      let remaining = s.allowedDuration;
      if (s.startTime) {
        const elapsed = Math.floor((now - new Date(s.startTime)) / 1000);
        remaining = Math.max(0, s.allowedDuration - elapsed);
      }

      // Match question or trap
      const qDoc = questionMap[s.currentQuestion] || null;
      const trapDoc = s.currentTrap ? (trapMap[s.currentTrap] || null) : null;

      let activeQuestionInfo = null;
      if (qDoc) {
        // Find or initialize questionProgress for this stage
        if (!s.questionProgress) s.questionProgress = [];
        let progress = s.questionProgress.find(p => p.questionId === qDoc.questionId);
        if (!progress) {
          progress = {
            questionId: qDoc.questionId,
            cluesViewed: [],
            selectedClueIds: [],
            shuffledClueIds: [],
            cluesSubmitted: false
          };
          s.questionProgress.push(progress);
        }

        const goodClueIds = (qDoc.goodClues || []).map((c, i) => c.clueId || `G${i + 1}`);
        const badClueIds = (qDoc.badClues || []).map((c, i) => c.clueId || `B${i + 1}`);
        const totalExpected = goodClueIds.length + badClueIds.length;

        // Ensure stable 1-12 shuffle order matching student screen
        if (!progress.shuffledClueIds || progress.shuffledClueIds.length !== totalExpected) {
          const pool = [...goodClueIds, ...badClueIds];
          for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
          }
          progress.shuffledClueIds = pool;
          if (typeof s.save === 'function') {
            s.save().catch(e => console.error('Save error:', e));
          }
        }

        const shuffledList = progress.shuffledClueIds || [];

        // Exact clue screen numbers (1 to 12) as shown on student's terminal
        const goodCluesWithNumbers = (qDoc.goodClues || []).map(g => {
          const clueId = g.clueId;
          const idx = shuffledList.indexOf(clueId);
          const screenNumber = idx !== -1 ? (idx + 1) : null;
          return {
            clueId,
            text: g.text,
            screenNumber
          };
        }).sort((a, b) => (a.screenNumber || 0) - (b.screenNumber || 0));

        const badCluesWithNumbers = (qDoc.badClues || []).map(b => {
          const clueId = b.clueId;
          const idx = shuffledList.indexOf(clueId);
          const screenNumber = idx !== -1 ? (idx + 1) : null;
          return {
            clueId,
            text: b.text,
            screenNumber
          };
        }).sort((a, b) => (a.screenNumber || 0) - (b.screenNumber || 0));

        const trueScreenNumbers = goodCluesWithNumbers
          .map(g => g.screenNumber)
          .filter(Boolean)
          .sort((a, b) => a - b);

        const falseScreenNumbers = badCluesWithNumbers
          .map(b => b.screenNumber)
          .filter(Boolean)
          .sort((a, b) => a - b);

        activeQuestionInfo = {
          questionId: qDoc.questionId,
          title: qDoc.title || `Question ${qDoc.questionId}`,
          promptText: qDoc.promptText || qDoc.questionText || '',
          category: qDoc.category || 'General',
          code: qDoc.code || '',
          answerKey: qDoc.answerKey || '',
          directPasskey: qDoc.directPasskey || qDoc.answerKey || '',
          goodClues: goodCluesWithNumbers,
          badClues: badCluesWithNumbers,
          trueScreenNumbers,
          falseScreenNumbers
        };
      }

      let activeTrapInfo = null;
      if (trapDoc) {
        activeTrapInfo = {
          trapId: trapDoc.trapId,
          name: trapDoc.name,
          description: trapDoc.description,
          question: trapDoc.question,
          answer: trapDoc.answer
        };
      }

      // Only provide latestClueAttempt if it belongs to current active question
      const validClueAttempt = (s.latestClueAttempt && s.latestClueAttempt.questionId === s.currentQuestion)
        ? s.latestClueAttempt
        : null;

      const seq = Array.isArray(s.questionSequence) ? s.questionSequence : [];
      const stageIdx = seq.indexOf(s.currentQuestion);
      const currentStage = stageIdx !== -1 ? stageIdx + 1 : (s.questionsSolved ? s.questionsSolved + 1 : 1);
      const totalStages = seq.length > 0 ? seq.length : 10;

      return {
        sessionId: s.sessionId,
        pcId: s.pcId || student.pcId || 'N/A',
        studentName: student.name || 'Operator',
        enrollmentNumber: student.enrollmentNumber || 'N/A',
        department: student.department || '',
        questionSet: s.questionSet || 'A',
        currentQuestion: s.currentQuestion || 'N/A',
        currentTrap: s.currentTrap || '',
        questionSequence: seq,
        currentStage,
        totalStages,
        stageProgress: `${currentStage}/${totalStages}`,
        activeQuestionInfo,
        activeTrapInfo,
        status: s.status,
        unlocked: s.unlocked,
        questionsSolved: s.questionsSolved || 0,
        remainingSeconds: remaining,
        wrongChoices: s.wrongChoices || 0,
        passkeysUsed: s.passkeysUsed || 0,
        totalAnswerAttempts: s.totalAnswerAttempts || 0,
        latestClueAttempt: validClueAttempt,
        updatedAt: s.updatedAt
      };
    });

    return res.json({ success: true, sessions: liveData });
  } catch (error) {
    console.error('getLiveSessions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve live sessions' });
  }
};

// Get all available questions and which ones are currently active in contest
const getActiveQuestionsConfig = async (req, res) => {
  try {
    const allQuestions = await Question.find({}).sort({ questionId: 1 });
    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
      await settings.save();
    }

    let activeIds = (settings.activeQuestionIds && settings.activeQuestionIds.length > 0)
      ? settings.activeQuestionIds
      : allQuestions.map(q => q.questionId);

    const questionsList = allQuestions.map(q => ({
      questionId: q.questionId,
      title: q.title || `STAGE ${q.questionId}`,
      promptText: (q.promptText || q.questionText || '').substring(0, 100),
      answerKey: q.answerKey || '',
      directPasskey: q.directPasskey || '',
      selected: activeIds.includes(q.questionId)
    }));

    return res.json({
      success: true,
      questions: questionsList,
      activeQuestionIds: activeIds
    });
  } catch (error) {
    console.error('getActiveQuestionsConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve active questions.' });
  }
};

// Save active questions selection
const saveActiveQuestionsConfig = async (req, res) => {
  try {
    const { activeQuestionIds } = req.body;
    if (!Array.isArray(activeQuestionIds) || activeQuestionIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one question must be selected.' });
    }

    let settings = await SystemSettings.findOne();
    if (!settings) {
      settings = new SystemSettings();
    }
    settings.activeQuestionIds = activeQuestionIds;
    await settings.save();

    return res.json({
      success: true,
      message: `Active contest questions updated! (${activeQuestionIds.length} questions selected)`,
      activeQuestionIds
    });
  } catch (error) {
    console.error('saveActiveQuestionsConfig error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save active questions.' });
  }
};

module.exports = {
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
};

