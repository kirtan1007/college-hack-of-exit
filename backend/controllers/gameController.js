const GameSession = require('../models/GameSession');
const Question = require('../models/Question');
const Trap = require('../models/Trap');
const QuestionSet = require('../models/QuestionSet');
const Student = require('../models/Student');
const Result = require('../models/Result');
const SystemSettings = require('../models/SystemSettings');

// Helper: Fisher-Yates array shuffle
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// Calculate hacker score
const calculateScore = (elapsedSeconds, allowedDuration, questionsSolved, passkeysUsed, trapCount, wrongChoices) => {
  const timeBonus = Math.max(0, Math.floor(allowedDuration - elapsedSeconds)) * 2;
  const puzzleBonus = questionsSolved * 150;
  const passkeyBonus = passkeysUsed * 50;
  const penalty = (trapCount * 100) + (wrongChoices * 20);
  const total = 1000 + timeBonus + puzzleBonus + passkeyBonus - penalty;
  return Math.max(100, total);
};

// Sequence-based navigation helpers for dynamic per-PC rounds
const checkIsFinalChallenge = (session, currentQuestionDoc) => {
  if (!currentQuestionDoc) return false;
  const seq = (Array.isArray(session.questionSequence) && session.questionSequence.length > 0)
    ? session.questionSequence
    : null;

  if (seq) {
    const currIdx = seq.indexOf(currentQuestionDoc.questionId);
    return currIdx === seq.length - 1;
  }
  return !!currentQuestionDoc.isFinalVault || currentQuestionDoc.nextQuestionIdOnCorrect === 'WIN' || currentQuestionDoc.nextQuestionIdOnCorrect === 'EXIT';
};

const advanceToNextChallenge = (session, currentQuestionDoc) => {
  if (!currentQuestionDoc) return 'WIN';
  const seq = (Array.isArray(session.questionSequence) && session.questionSequence.length > 0)
    ? session.questionSequence
    : null;

  if (seq) {
    const currIdx = seq.indexOf(currentQuestionDoc.questionId);
    if (currIdx !== -1 && currIdx + 1 < seq.length) {
      session.currentQuestionIndex = currIdx + 1;
      return seq[currIdx + 1];
    }
    return 'WIN';
  }
  return currentQuestionDoc.nextQuestionIdOnCorrect || currentQuestionDoc.goodNextId || 'WIN';
};

// Get active game session status & randomized current question
const getGameSession = async (req, res) => {
  const sessionId = req.params.sessionId || req.query.sessionId || req.body.sessionId;

  try {
    const session = await GameSession.findOne({ sessionId }).populate('studentId');
    if (!session) {
      return res.status(404).json({ success: false, message: 'Game session not found.' });
    }

    // Check timer expiration
    const currentTime = new Date();
    const startTime = new Date(session.startTime || Date.now());
    const elapsedSeconds = Math.max(0, Math.floor((currentTime - startTime) / 1000));
    const remainingSeconds = Math.max(0, (session.allowedDuration || 1800) - elapsedSeconds);
    session.timerRemainingSeconds = remainingSeconds;

    if (remainingSeconds <= 0 && session.status === 'ACTIVE') {
      session.status = 'GAME_OVER';
      session.endTime = currentTime;
      session.completionTime = session.allowedDuration;
      await session.save();

      // Create Result
      let resultObj = await Result.findOne({ sessionId: session.sessionId });
      if (!resultObj) {
        resultObj = new Result({
          studentId: session.studentId._id,
          sessionId: session.sessionId,
          studentName: session.studentId.name,
          enrollmentNumber: session.studentId.enrollmentNumber,
          department: session.studentId.department || '',
          pcId: session.pcId,
          set: session.questionSet,
          completionTime: session.allowedDuration,
          trapCount: session.trapCount,
          wrongChoices: session.wrongChoices,
          questionsSolved: session.questionsSolved,
          passkeysUsed: session.passkeysUsed,
          totalAnswerAttempts: session.totalAnswerAttempts,
          score: 100,
          result: 'GAME_OVER'
        });
        await resultObj.save();
      }
    }

    // If game already finished
    if (session.status !== 'ACTIVE' && session.status !== 'NOT_STARTED') {
      return res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          status: session.status,
          remainingSeconds: 0,
          wrongChoices: session.wrongChoices,
          trapCount: session.trapCount,
          questionsSolved: session.questionsSolved,
          passkeysUsed: session.passkeysUsed,
          totalAnswerAttempts: session.totalAnswerAttempts,
          completionTime: session.completionTime,
          student: session.studentId
        }
      });
    }

    // Get assigned set info
    const qSet = await QuestionSet.findOne({ name: session.questionSet });

    let currentQuestionData = null;
    let currentTrapData = null;

    if (!session.unlocked) {
      // Return Octal Entry Challenge metadata
      currentQuestionData = {
        isEntryChallenge: true,
        entryOctal: qSet ? qSet.entryOctal : '11'
      };
    } else if (session.currentTrap) {
      // Active Trap Mode
      const trap = await Trap.findOne({ trapId: session.currentTrap });
      if (trap) {
        currentTrapData = {
          trapId: trap.trapId,
          name: trap.name,
          description: trap.description,
          question: trap.question
          // SECURITY: Do not expose trap answer
        };
      }
    } else if (session.currentQuestion) {
      // Normal Question Mode
      if (session.currentQuestion === 'WIN' || session.currentQuestion === 'EXIT') {
        currentQuestionData = {
          questionId: 'FINAL_EXIT',
          title: 'MASTER VAULT EXIT',
          promptText: 'Escaping terminal... Final security protocols successfully bypassed. System clear.',
          isFinalVault: true,
          clues: []
        };
      } else {
        const question = await Question.findOne({ questionId: session.currentQuestion });
        if (question) {
          // Initialize question progress tracking if not already present
          if (!session.questionProgress) session.questionProgress = [];
          let progress = session.questionProgress.find(p => p.questionId === question.questionId);
          if (!progress) {
            progress = {
              questionId: question.questionId,
              cluesViewed: [],
              selectedClueIds: [],
              shuffledClueIds: [],
              cluesSubmitted: false,
              answerAttempts: 0,
              passkeyUsed: false,
              passkeyAttempts: 0,
              wrongAnswerCount: 0,
              wrongPasskeyCount: 0,
              startedAt: new Date()
            };
            session.questionProgress.push(progress);
          }

          // Build 12 mixed clues: 6 good + 6 bad (with fallback to legacy single goodClue/badClue)
          let sanitizedGood = (question.goodClues || []).map((c, i) => ({
            clueId: c.clueId || `G${i + 1}`,
            text: c.text,
            imageUrl: c.imageUrl || ''
          }));
          if (sanitizedGood.length === 0 && question.goodClue) {
            sanitizedGood = [{ clueId: 'G1', text: question.goodClue, imageUrl: '' }];
          }

          let sanitizedBad = (question.badClues || []).map((c, i) => ({
            clueId: c.clueId || `B${i + 1}`,
            text: c.text,
            imageUrl: c.imageUrl || ''
          }));
          if (sanitizedBad.length === 0 && question.badClue) {
            sanitizedBad = [{ clueId: 'B1', text: question.badClue, imageUrl: '' }];
          }

          const allPool = [...sanitizedGood, ...sanitizedBad];
          const poolMap = {};
          allPool.forEach(c => { poolMap[c.clueId] = c; });

          // Stable shuffle: reuse existing shuffled order so clue numbering 1-12 is 100% stable
          let allClues;
          if (progress.shuffledClueIds && progress.shuffledClueIds.length === allPool.length) {
            allClues = progress.shuffledClueIds.map(id => poolMap[id]).filter(Boolean);
            if (allClues.length !== allPool.length) {
              allClues = shuffleArray(allPool);
              progress.shuffledClueIds = allClues.map(c => c.clueId);
              await session.save();
            }
          } else {
            allClues = shuffleArray(allPool);
            progress.shuffledClueIds = allClues.map(c => c.clueId);
            await session.save();
          }

          const isFinal = checkIsFinalChallenge(session, question);
          const seq = Array.isArray(session.questionSequence) ? session.questionSequence : [];
          const stageIdx = seq.indexOf(question.questionId);
          const stageNumber = stageIdx !== -1 ? stageIdx + 1 : ((session.questionsSolved || 0) + 1);
          const totalStages = seq.length > 0 ? seq.length : 10;

          currentQuestionData = {
            questionId: question.questionId,
            title: question.title || `CHALLENGE ${question.questionId}`,
            promptText: question.promptText || question.questionText,
            code: question.code || '',
            category: question.category || 'General',
            image: question.image || '',
            clues: allClues,
            selectionLimit: 6,
            selectedClueIds: progress ? (progress.selectedClueIds || []) : [],
            cluesSubmitted: progress ? !!progress.cluesSubmitted : false,
            isFinalVault: isFinal,
            stageNumber,
            totalStages,
            difficulty: question.difficulty || 'medium',
            timeLimit: question.timeLimit || 0,
            score: question.score || 100,
            setName: session.questionSet
            // SECURITY: answerKey and directPasskey are strictly NEVER returned to client
          };
        }
      }
    }

    return res.json({
      success: true,
      session: {
        sessionId: session.sessionId,
        status: session.status,
        remainingSeconds,
        unlocked: session.unlocked,
        wrongChoices: session.wrongChoices,
        trapCount: session.trapCount,
        questionsSolved: session.questionsSolved,
        passkeysUsed: session.passkeysUsed || 0,
        totalAnswerAttempts: session.totalAnswerAttempts || 0,
        currentQuestion: currentQuestionData,
        currentTrap: currentTrapData,
        student: session.studentId,
        questionSet: session.questionSet,
        pcId: session.pcId
      }
    });
  } catch (error) {
    console.error('getGameSession error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving session.' });
  }
};

// Unlock entry challenge using Binary Password
const unlockEntryChallenge = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const { binaryPassword } = req.body;

  if (!binaryPassword) {
    return res.status(400).json({ success: false, message: 'Binary password is required.' });
  }

  try {
    const session = await GameSession.findOne({ sessionId });
    if (!session || session.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive session.' });
    }

    if (session.unlocked) {
      return res.json({ success: true, message: 'Already unlocked.' });
    }

    // Get assigned set binary password
    const qSet = await QuestionSet.findOne({ name: session.questionSet });
    const correctPassword = qSet ? qSet.entryBinaryPassword.trim() : '1001';

    if (binaryPassword.trim() === correctPassword) {
      session.unlocked = true;
      await session.save();
      return res.json({ success: true, message: 'Access granted!' });
    } else {
      session.passwordAttempts = (session.passwordAttempts || 0) + 1;
      session.wrongChoices = (session.wrongChoices || 0) + 1;

      // Check max attempts
      const settings = await SystemSettings.findOne();
      const maxAttempts = settings ? settings.maxPasswordAttempts : 3;

      let triggerTrap = false;
      if (session.passwordAttempts >= maxAttempts) {
        const entryTrap = await Trap.findOne({ set: session.questionSet, trapId: /TRAP/i });
        if (entryTrap) {
          session.currentTrap = entryTrap.trapId;
          session.unlocked = true; // Skip Octal door, they are now trapped
          session.trapCount = (session.trapCount || 0) + 1;
          triggerTrap = true;
        }
      }

      await session.save();

      if (triggerTrap) {
        return res.json({ 
          success: false, 
          message: 'Too many incorrect attempts! Security countermeasures triggered a trap!',
          trapTriggered: true 
        });
      }

      return res.status(400).json({ 
        success: false, 
        message: 'Incorrect binary password. Access Denied.',
        attemptsLeft: Math.max(0, maxAttempts - session.passwordAttempts)
      });
    }
  } catch (error) {
    console.error('unlockEntryChallenge error:', error);
    return res.status(500).json({ success: false, message: 'Server error during unlocking.' });
  }
};

// Record clue interaction / telemetry
const recordClueView = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const { clueId, questionId } = req.body;

  if (!clueId) {
    return res.status(400).json({ success: false, message: 'Clue ID required' });
  }

  try {
    const session = await GameSession.findOne({ sessionId });
    if (!session || session.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid session' });
    }

    if (!session.questionProgress) session.questionProgress = [];
    const activeQId = questionId || session.currentQuestion;
    let progress = session.questionProgress.find(p => p.questionId === activeQId);
    if (!progress) {
      progress = {
        questionId: activeQId,
        cluesViewed: [],
        answerAttempts: 0,
        passkeyUsed: false,
        startedAt: new Date()
      };
      session.questionProgress.push(progress);
    }

    if (!progress.cluesViewed) progress.cluesViewed = [];
    if (!progress.cluesViewed.includes(clueId)) {
      progress.cluesViewed.push(clueId);
      await session.save();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('recordClueView error:', error);
    return res.status(500).json({ success: false, message: 'Server error logging clue interaction.' });
  }
};

// Submit selected clues (Exactly 6 of 12)
const submitClueSelection = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const questionIdParam = req.params.questionId || req.body.questionId;
  const { selectedClueIds, selectedCluesWithNumbers } = req.body;

  if (!Array.isArray(selectedClueIds)) {
    return res.status(400).json({ success: false, message: 'selectedClueIds must be an array of clue IDs.' });
  }

  if (selectedClueIds.length !== 6) {
    return res.status(400).json({
      success: false,
      message: `Invalid selection: You must select exactly 6 clues (currently selected: ${selectedClueIds.length}).`
    });
  }

  // Ensure 6 unique IDs
  const uniqueIds = [...new Set(selectedClueIds)];
  if (uniqueIds.length !== 6) {
    return res.status(400).json({
      success: false,
      message: 'Invalid selection: Duplicate clues detected. You must select 6 unique clues.'
    });
  }

  try {
    let session;
    if (sessionId) {
      session = await GameSession.findOne({ sessionId }).populate('studentId');
    } else {
      const studentId = req.student ? req.student._id : (req.body.studentId || req.query.studentId);
      if (studentId) {
        session = await GameSession.findOne({ studentId, status: 'ACTIVE' }).populate('studentId');
      }
    }

    if (!session || session.status !== 'ACTIVE' || !session.unlocked) {
      return res.status(400).json({ success: false, message: 'Invalid, locked, or inactive game session.' });
    }

    const activeQuestionId = questionIdParam || session.currentQuestion;
    const question = await Question.findOne({ questionId: activeQuestionId });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Active question not found.' });
    }

    // Verify all selected clues belong to this question
    const validClueIds = [
      ...(question.goodClues || []).map((c, i) => c.clueId || `G${i + 1}`),
      ...(question.badClues || []).map((c, i) => c.clueId || `B${i + 1}`)
    ];

    const invalid = uniqueIds.filter(id => !validClueIds.includes(id));
    if (invalid.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid clue IDs detected. All clues must belong to the active challenge.'
      });
    }

    // Verify all 6 selected clues are TRUE (Good) clues
    const goodClueIds = (question.goodClues || []).map((c, i) => c.clueId || `G${i + 1}`);
    const correctClueIds = uniqueIds.filter(id => goodClueIds.includes(id));
    const incorrectClueIds = uniqueIds.filter(id => !goodClueIds.includes(id));
    const allCorrect = incorrectClueIds.length === 0 && correctClueIds.length === 6;

    // Determine 1-12 numbers for live Sir Hint monitoring on Admin
    let correctNumbers = [];
    let incorrectNumbers = [];
    if (Array.isArray(selectedCluesWithNumbers)) {
      correctNumbers = selectedCluesWithNumbers
        .filter(c => c && goodClueIds.includes(c.clueId) && c.clueNumber)
        .map(c => Number(c.clueNumber))
        .sort((a, b) => a - b);
      incorrectNumbers = selectedCluesWithNumbers
        .filter(c => c && !goodClueIds.includes(c.clueId) && c.clueNumber)
        .map(c => Number(c.clueNumber))
        .sort((a, b) => a - b);
    }

    // Store live telemetry for Admin site hint assistance
    session.latestClueAttempt = {
      questionId: activeQuestionId,
      correctCount: correctClueIds.length,
      incorrectCount: incorrectClueIds.length,
      correctNumbers,
      incorrectNumbers,
      allCorrect,
      submittedAt: new Date()
    };

    if (!allCorrect) {
      session.wrongChoices = (session.wrongChoices || 0) + 1;
      if (!session.questionProgress) session.questionProgress = [];
      let progress = session.questionProgress.find(p => p.questionId === activeQuestionId);
      if (!progress) {
        progress = {
          questionId: activeQuestionId,
          cluesViewed: [],
          selectedClueIds: [],
          cluesSubmitted: false,
          answerAttempts: 0,
          passkeyUsed: false,
          passkeyAttempts: 0,
          wrongAnswerCount: 0,
          wrongPasskeyCount: 0,
          wrongClueAttempts: 1,
          startedAt: new Date()
        };
        session.questionProgress.push(progress);
      } else {
        progress.selectedClueIds = [];
        progress.wrongClueAttempts = (progress.wrongClueAttempts || 0) + 1;
      }
      await session.save();

      return res.status(400).json({
        success: false,
        isCorrect: false,
        message: '⚠️ INCORRECT CLUES: One or more of your selected clues are misleading or false! You must select all 6 TRUE clues to advance.'
      });
    }

    // Update progress on successful 6 TRUE clues selection
    if (!session.questionProgress) session.questionProgress = [];
    let progress = session.questionProgress.find(p => p.questionId === activeQuestionId);
    if (!progress) {
      progress = {
        questionId: activeQuestionId,
        cluesViewed: [],
        selectedClueIds: uniqueIds,
        cluesSubmitted: true,
        answerAttempts: 0,
        passkeyUsed: false,
        passkeyAttempts: 0,
        wrongAnswerCount: 0,
        wrongPasskeyCount: 0,
        startedAt: new Date()
      };
      session.questionProgress.push(progress);
    } else {
      progress.selectedClueIds = uniqueIds;
      progress.cluesSubmitted = true;
    }

    // Complete stage via 6 TRUE Clue Selection
    progress.solvedAt = new Date();
    progress.completedBy = 'clues';
    session.questionsSolved = (session.questionsSolved || 0) + 1;

    const isFinal = checkIsFinalChallenge(session, question);

    if (isFinal) {
      const endTime = new Date();
      const startTime = new Date(session.startTime || Date.now());
      const elapsedSeconds = Math.max(1, Math.floor((endTime - startTime) / 1000));
      session.status = 'COMPLETED';
      session.endTime = endTime;
      session.completionTime = elapsedSeconds;
      session.currentQuestion = 'WIN';
      await session.save();

      const score = calculateScore(
        elapsedSeconds,
        session.allowedDuration,
        session.questionsSolved,
        session.passkeysUsed || 0,
        session.trapCount || 0,
        session.wrongChoices || 0
      );

      let studentDoc = session.studentId;
      if (!studentDoc || !studentDoc.name) {
        studentDoc = await Student.findById(session.studentId);
      }
      const sId = (studentDoc && studentDoc._id) || session.studentId;
      const sName = (studentDoc && studentDoc.name) || 'Student';
      const sEnroll = (studentDoc && studentDoc.enrollmentNumber) || (session.pcId || 'N/A');
      const sDept = (studentDoc && studentDoc.department) || '';

      let resultObj = await Result.findOne({ sessionId: session.sessionId });
      if (!resultObj) {
        resultObj = new Result({
          studentId: sId,
          sessionId: session.sessionId,
          studentName: sName,
          enrollmentNumber: sEnroll,
          department: sDept,
          pcId: session.pcId,
          set: session.questionSet,
          completionTime: elapsedSeconds,
          trapCount: session.trapCount,
          wrongChoices: session.wrongChoices,
          questionsSolved: session.questionsSolved,
          passkeysUsed: session.passkeysUsed || 0,
          totalAnswerAttempts: session.totalAnswerAttempts || 0,
          score,
          result: 'WIN'
        });
        await resultObj.save();
      }

      return res.json({
        success: true,
        message: '✓ 6 CLUES VERIFIED\n✓ FINAL SECURITY PROTOCOL BYPASS COMPLETE',
        completed: true,
        escaped: true
      });
    }

    // Advance to next question in sequence
    const nextDest = advanceToNextChallenge(session, question);
    const isNextTrap = (nextDest !== 'WIN') ? await Trap.findOne({ trapId: nextDest }) : null;

    if (isNextTrap) {
      session.currentTrap = nextDest;
      session.currentQuestion = '';
      session.trapCount = (session.trapCount || 0) + 1;
    } else {
      session.currentQuestion = nextDest;
    }

    // Reset clue telemetry for new stage
    session.latestClueAttempt = null;
    await session.save();

    return res.json({
      success: true,
      message: '✓ 6 CLUES VERIFIED & SUBMITTED\n✓ ADVANCING TO NEXT CHALLENGE',
      selectedClueIds: uniqueIds,
      nextQuestionId: nextDest,
      completed: nextDest === 'WIN' || nextDest === 'EXIT'
    });
  } catch (error) {
    console.error('submitClueSelection error:', error);
    return res.status(500).json({ success: false, message: 'Server error saving clue selection.' });
  }
};

// Submit regular puzzle answer (analyzed from clues)
const submitAnswer = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const { answer } = req.body;

  if (answer === undefined || answer === '') {
    return res.status(400).json({ success: false, message: 'Answer is required.' });
  }

  try {
    const session = await GameSession.findOne({ sessionId }).populate('studentId');
    if (!session || session.status !== 'ACTIVE' || !session.unlocked) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive session.' });
    }

    const cleanAnswer = answer.trim().toLowerCase();

    // Check if in Trap mode
    if (session.currentTrap) {
      const trap = await Trap.findOne({ trapId: session.currentTrap });
      if (!trap) {
        return res.status(404).json({ success: false, message: 'Active trap not found.' });
      }

      if (cleanAnswer === trap.answer.trim().toLowerCase()) {
        const nextDest = trap.successNextId;
        const isNextTrap = await Trap.findOne({ trapId: nextDest });

        if (isNextTrap) {
          session.currentTrap = nextDest;
          session.currentQuestion = '';
          session.trapCount = (session.trapCount || 0) + 1;
        } else {
          session.currentQuestion = nextDest;
          session.currentTrap = '';
        }
        session.latestClueAttempt = null;
        await session.save();
        return res.json({ 
          success: true, 
          message: '✓ Trap disarmed! Route cleared.', 
          escaped: true 
        });
      } else {
        session.wrongChoices = (session.wrongChoices || 0) + 1;
        const failDest = trap.failureNextId;
        if (failDest && failDest !== trap.trapId) {
          const isNextTrap = await Trap.findOne({ trapId: failDest });
          if (isNextTrap) {
            session.currentTrap = failDest;
            session.currentQuestion = '';
            session.trapCount = (session.trapCount || 0) + 1;
          } else {
            session.currentQuestion = failDest;
            session.currentTrap = '';
          }
        }
        await session.save();
        return res.status(400).json({ success: false, message: '✗ Incorrect bypass code. Trap lock sustained.' });
      }
    }

    // Normal Question Mode
    const question = await Question.findOne({ questionId: session.currentQuestion });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Active question not found.' });
    }

    // Telemetry tracking
    session.totalAnswerAttempts = (session.totalAnswerAttempts || 0) + 1;
    if (!session.questionProgress) session.questionProgress = [];
    let progress = session.questionProgress.find(p => p.questionId === question.questionId);
    if (!progress) {
      progress = {
        questionId: question.questionId,
        cluesViewed: [],
        selectedClueIds: [],
        cluesSubmitted: false,
        answerAttempts: 1,
        passkeyUsed: false,
        passkeyAttempts: 0,
        wrongAnswerCount: 0,
        wrongPasskeyCount: 0,
        startedAt: new Date()
      };
      session.questionProgress.push(progress);
    } else {
      progress.answerAttempts = (progress.answerAttempts || 0) + 1;
    }

    // Validate Answer
    const expectedAnswer = (question.answerKey || question.answer || '').trim().toLowerCase();
    const expectedPasskey = (question.directPasskey || '').trim().toLowerCase();
    const isCorrect = (expectedAnswer && cleanAnswer === expectedAnswer) || (expectedPasskey && cleanAnswer === expectedPasskey);

    if (isCorrect) {
      progress.solvedAt = new Date();
      progress.completedBy = 'answer';
      session.questionsSolved = (session.questionsSolved || 0) + 1;

      const isFinal = checkIsFinalChallenge(session, question);

      if (isFinal) {
        // Complete escape
        const endTime = new Date();
        const startTime = new Date(session.startTime || Date.now());
        const elapsedSeconds = Math.max(1, Math.floor((endTime - startTime) / 1000));
        session.status = 'COMPLETED';
        session.endTime = endTime;
        session.completionTime = elapsedSeconds;
        session.currentQuestion = 'WIN';
        await session.save();

        const score = calculateScore(
          elapsedSeconds,
          session.allowedDuration,
          session.questionsSolved,
          session.passkeysUsed || 0,
          session.trapCount || 0,
          session.wrongChoices || 0
        );

        let resultObj = await Result.findOne({ sessionId: session.sessionId });
        if (!resultObj) {
          resultObj = new Result({
            studentId: session.studentId._id,
            sessionId: session.sessionId,
            studentName: session.studentId.name,
            enrollmentNumber: session.studentId.enrollmentNumber,
            department: session.studentId.department || '',
            pcId: session.pcId,
            set: session.questionSet,
            completionTime: elapsedSeconds,
            trapCount: session.trapCount,
            wrongChoices: session.wrongChoices,
            questionsSolved: session.questionsSolved,
            passkeysUsed: session.passkeysUsed,
            totalAnswerAttempts: session.totalAnswerAttempts,
            score,
            result: 'WIN'
          });
          await resultObj.save();
        }

        return res.json({
          success: true,
          message: '✓ ACCESS KEY VERIFIED\n✓ FINAL SECURITY PROTOCOL BYPASS COMPLETE',
          completed: true,
          escaped: true
        });
      }

      // Non-final question: move to next in sequence
      const nextDest = advanceToNextChallenge(session, question);
      const isNextTrap = (nextDest !== 'WIN') ? await Trap.findOne({ trapId: nextDest }) : null;

      if (isNextTrap) {
        session.currentTrap = nextDest;
        session.currentQuestion = '';
        session.trapCount = (session.trapCount || 0) + 1;
      } else {
        session.currentQuestion = nextDest;
      }

      session.latestClueAttempt = null;
      await session.save();

      return res.json({
        success: true,
        message: '✓ ACCESS KEY VERIFIED\n✓ PUZZLE SOLVED',
        nextQuestionId: nextDest,
        completed: nextDest === 'WIN' || nextDest === 'EXIT'
      });
    } else {
      // Incorrect Answer
      session.wrongChoices = (session.wrongChoices || 0) + 1;
      const action = question.wrongAnswerAction || 'retry';

      if (action === 'trap') {
        const trapDest = question.trapId || question.nextQuestionIdOnWrong || question.badNextId;
        const isNextTrap = await Trap.findOne({ trapId: trapDest });
        if (isNextTrap) {
          session.currentTrap = trapDest;
          session.currentQuestion = '';
          session.trapCount = (session.trapCount || 0) + 1;
        } else {
          session.currentQuestion = trapDest;
        }
        await session.save();
        return res.status(400).json({
          success: false,
          message: '✗ INVALID SOLUTION. Security countermeasure activated a trap!',
          trapTriggered: true
        });
      } else if (action === 'alternate') {
        const altDest = question.nextQuestionIdOnWrong || question.badNextId;
        if (altDest) {
          session.currentQuestion = altDest;
        }
        await session.save();
        return res.status(400).json({
          success: false,
          message: '✗ INVALID SOLUTION. Rerouting to alternate branch.'
        });
      } else if (action === 'penalty') {
        // Penalty deductions (60s)
        session.allowedDuration = Math.max(60, session.allowedDuration - 60);
        await session.save();
        return res.status(400).json({
          success: false,
          message: '✗ INVALID SOLUTION. -60s time penalty applied.'
        });
      } else {
        // 'retry'
        await session.save();
        return res.status(400).json({
          success: false,
          message: '✗ INVALID SOLUTION'
        });
      }
    }
  } catch (error) {
    console.error('submitAnswer error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing answer.' });
  }
};

// Submit Direct Passkey (Immediate bypass)
const submitPasskey = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;
  const { passkey } = req.body;

  if (!passkey || passkey.trim() === '') {
    return res.status(400).json({ success: false, message: 'Passkey is required.' });
  }

  try {
    const session = await GameSession.findOne({ sessionId }).populate('studentId');
    if (!session || session.status !== 'ACTIVE' || !session.unlocked) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive session.' });
    }

    const question = await Question.findOne({ questionId: session.currentQuestion });
    if (!question) {
      return res.status(404).json({ success: false, message: 'Active question not found.' });
    }

    const cleanPasskey = passkey.trim().toLowerCase();
    const expectedPasskey = (question.directPasskey || '').trim().toLowerCase();
    const expectedAnswer = (question.answerKey || question.answer || '').trim().toLowerCase();

    const isMatch = (expectedPasskey && cleanPasskey === expectedPasskey) || (expectedAnswer && cleanPasskey === expectedAnswer);

    if (isMatch) {
      // Answer or passkey matched!
      session.passkeysUsed = (session.passkeysUsed || 0) + 1;
      session.questionsSolved = (session.questionsSolved || 0) + 1;

      // Telemetry
      if (!session.questionProgress) session.questionProgress = [];
      let progress = session.questionProgress.find(p => p.questionId === question.questionId);
      if (!progress) {
        progress = {
          questionId: question.questionId,
          cluesViewed: [],
          answerAttempts: 0,
          passkeyUsed: true,
          startedAt: new Date(),
          solvedAt: new Date()
        };
        session.questionProgress.push(progress);
      } else {
        progress.passkeyUsed = true;
        progress.completedBy = 'passkey';
        progress.solvedAt = new Date();
      }

      const isFinal = checkIsFinalChallenge(session, question);

      if (isFinal) {
        const endTime = new Date();
        const startTime = new Date(session.startTime || Date.now());
        const elapsedSeconds = Math.max(1, Math.floor((endTime - startTime) / 1000));
        session.status = 'COMPLETED';
        session.endTime = endTime;
        session.completionTime = elapsedSeconds;
        session.currentQuestion = 'WIN';
        await session.save();

        const score = calculateScore(
          elapsedSeconds,
          session.allowedDuration,
          session.questionsSolved,
          session.passkeysUsed,
          session.trapCount || 0,
          session.wrongChoices || 0
        );

        let resultObj = await Result.findOne({ sessionId: session.sessionId });
        if (!resultObj) {
          resultObj = new Result({
            studentId: session.studentId._id,
            sessionId: session.sessionId,
            studentName: session.studentId.name,
            enrollmentNumber: session.studentId.enrollmentNumber,
            department: session.studentId.department || '',
            pcId: session.pcId,
            set: session.questionSet,
            completionTime: elapsedSeconds,
            trapCount: session.trapCount,
            wrongChoices: session.wrongChoices,
            questionsSolved: session.questionsSolved,
            passkeysUsed: session.passkeysUsed,
            totalAnswerAttempts: session.totalAnswerAttempts,
            score,
            result: 'WIN'
          });
          await resultObj.save();
        }

        return res.json({
          success: true,
          bypassed: true,
          escaped: true,
          completed: true,
          message: '✓ DIRECT ACCESS GRANTED\n\nBYPASSING CLUE ANALYSIS...'
        });
      }

      // Move to next question on passkey in sequence
      const nextDest = advanceToNextChallenge(session, question);
      session.currentQuestion = nextDest;
      session.latestClueAttempt = null;
      await session.save();

      return res.json({
        success: true,
        bypassed: true,
        message: '✓ DIRECT ACCESS GRANTED\n\nBYPASSING CLUE ANALYSIS...',
        nextQuestionId: nextDest,
        completed: nextDest === 'WIN' || nextDest === 'EXIT'
      });
    } else {
      session.wrongChoices = (session.wrongChoices || 0) + 1;
      if (!session.questionProgress) session.questionProgress = [];
      let progress = session.questionProgress.find(p => p.questionId === question.questionId);
      if (!progress) {
        progress = {
          questionId: question.questionId,
          cluesViewed: [],
          selectedClueIds: [],
          cluesSubmitted: false,
          answerAttempts: 0,
          passkeyUsed: false,
          passkeyAttempts: 1,
          wrongAnswerCount: 0,
          wrongPasskeyCount: 1,
          startedAt: new Date()
        };
        session.questionProgress.push(progress);
      } else {
        progress.passkeyAttempts = (progress.passkeyAttempts || 0) + 1;
        progress.wrongPasskeyCount = (progress.wrongPasskeyCount || 0) + 1;
      }

      const passkeyAction = question.wrongPasskeyAction || 'penalty';
      let penaltyMsg = '';
      if (passkeyAction === 'penalty') {
        const penaltySeconds = question.penalty || 60;
        session.allowedDuration = Math.max(60, session.allowedDuration - penaltySeconds);
        penaltyMsg = ` -${penaltySeconds}s time penalty applied.`;
      }

      await session.save();
      return res.status(400).json({
        success: false,
        message: `✗ INVALID DIRECT PASSKEY.${penaltyMsg}`
      });
    }
  } catch (error) {
    console.error('submitPasskey error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying passkey.' });
  }
};

// Complete game session (reached final exit)
const completeGame = async (req, res) => {
  const sessionId = req.params.sessionId || req.body.sessionId;

  try {
    const session = await GameSession.findOne({ sessionId }).populate('studentId');
    if (!session || session.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Invalid or inactive session.' });
    }

    const qSet = await QuestionSet.findOne({ name: session.questionSet });
    
    // Stop timer
    const endTime = new Date();
    const startTime = new Date(session.startTime || Date.now());
    const elapsedSeconds = Math.max(1, Math.floor((endTime - startTime) / 1000));

    if (elapsedSeconds > session.allowedDuration) {
      session.status = 'GAME_OVER';
      session.endTime = endTime;
      session.completionTime = session.allowedDuration;
      await session.save();

      let resultObj = await Result.findOne({ sessionId: session.sessionId });
      if (!resultObj) {
        resultObj = new Result({
          studentId: session.studentId._id,
          sessionId: session.sessionId,
          studentName: session.studentId.name,
          enrollmentNumber: session.studentId.enrollmentNumber,
          department: session.studentId.department || '',
          pcId: session.pcId,
          set: session.questionSet,
          completionTime: session.allowedDuration,
          trapCount: session.trapCount,
          wrongChoices: session.wrongChoices,
          questionsSolved: session.questionsSolved,
          passkeysUsed: session.passkeysUsed,
          totalAnswerAttempts: session.totalAnswerAttempts,
          score: 100,
          result: 'GAME_OVER'
        });
        await resultObj.save();
      }

      return res.status(400).json({ success: false, message: 'Timer expired! Mission failed.', status: 'GAME_OVER' });
    }

    // Save success
    session.status = 'COMPLETED';
    session.endTime = endTime;
    session.completionTime = elapsedSeconds;
    await session.save();

    const score = calculateScore(
      elapsedSeconds,
      session.allowedDuration,
      session.questionsSolved,
      session.passkeysUsed || 0,
      session.trapCount || 0,
      session.wrongChoices || 0
    );

    let resultObj = await Result.findOne({ sessionId: session.sessionId });
    if (!resultObj) {
      resultObj = new Result({
        studentId: session.studentId._id,
        sessionId: session.sessionId,
        studentName: session.studentId.name,
        enrollmentNumber: session.studentId.enrollmentNumber,
        department: session.studentId.department || '',
        pcId: session.pcId,
        set: session.questionSet,
        completionTime: elapsedSeconds,
        trapCount: session.trapCount,
        wrongChoices: session.wrongChoices,
        questionsSolved: session.questionsSolved,
        passkeysUsed: session.passkeysUsed,
        totalAnswerAttempts: session.totalAnswerAttempts,
        score,
        result: 'WIN'
      });
      await resultObj.save();
    }

    return res.json({
      success: true,
      message: 'Congratulations! You escaped the room!',
      stats: {
        studentName: session.studentId.name,
        completionTime: elapsedSeconds,
        wrongChoices: session.wrongChoices,
        trapCount: session.trapCount,
        questionsSolved: session.questionsSolved,
        passkeysUsed: session.passkeysUsed,
        score
      }
    });
  } catch (error) {
    console.error('completeGame error:', error);
    return res.status(500).json({ success: false, message: 'Server error completing game.' });
  }
};

module.exports = {
  getGameSession,
  unlockEntryChallenge,
  recordClueView,
  submitClueSelection,
  submitAnswer,
  submitPasskey,
  completeGame
};
