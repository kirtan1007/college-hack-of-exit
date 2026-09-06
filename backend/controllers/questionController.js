const Question = require('../models/Question');
const QuestionSet = require('../models/QuestionSet');
const Trap = require('../models/Trap');

// ==========================================
// QUESTION SETS CRUD
// ==========================================
const getQuestionSets = async (req, res) => {
  try {
    const sets = await QuestionSet.find().sort({ name: 1 });
    return res.json({ success: true, sets });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve question sets' });
  }
};

const createQuestionSet = async (req, res) => {
  try {
    const { name, entryOctal, entryBinaryPassword, startQuestionId, finalQuestionId, difficulty, active } = req.body;
    
    const existing = await QuestionSet.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: `Question set ${name} already exists` });
    }

    const set = new QuestionSet({
      name,
      entryOctal,
      entryBinaryPassword,
      startQuestionId,
      finalQuestionId,
      difficulty,
      active
    });
    await set.save();
    return res.json({ success: true, message: 'Question set created successfully', set });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to create question set' });
  }
};

const updateQuestionSet = async (req, res) => {
  try {
    const { entryOctal, entryBinaryPassword, startQuestionId, finalQuestionId, difficulty, active } = req.body;
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      return res.status(404).json({ success: false, message: 'Question set not found' });
    }

    if (entryOctal !== undefined) set.entryOctal = entryOctal;
    if (entryBinaryPassword !== undefined) set.entryBinaryPassword = entryBinaryPassword;
    if (startQuestionId !== undefined) set.startQuestionId = startQuestionId;
    if (finalQuestionId !== undefined) set.finalQuestionId = finalQuestionId;
    if (difficulty !== undefined) set.difficulty = difficulty;
    if (active !== undefined) set.active = active;

    await set.save();
    return res.json({ success: true, message: 'Question set updated successfully', set });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to update question set' });
  }
};

const deleteQuestionSet = async (req, res) => {
  try {
    const set = await QuestionSet.findById(req.params.id);
    if (!set) {
      return res.status(404).json({ success: false, message: 'Question set not found' });
    }
    await QuestionSet.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Question set deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete question set' });
  }
};

const deleteAllQuestionSets = async (req, res) => {
  try {
    await QuestionSet.deleteMany({});
    return res.json({ success: true, message: 'All question sets deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete all question sets' });
  }
};

// ==========================================
// QUESTIONS CRUD (12 MIXED CLUES + PASSKEY)
// ==========================================

// Upload clue image helper
const uploadClueImage = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  const imageUrl = `/uploads/clues/${req.file.filename}`;
  return res.json({ success: true, imageUrl });
};

// Get list of questions with summary counts
const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find().sort({ set: 1, questionId: 1 });
    const formatted = questions.map(q => {
      const goodCount = (q.goodClues || []).filter(c => c && c.text && c.text.trim()).length;
      const badCount = (q.badClues || []).filter(c => c && c.text && c.text.trim()).length;
      return {
        _id: q._id,
        questionId: q.questionId,
        set: q.set || q.setName,
        category: q.category || 'General',
        code: q.code || '',
        title: q.title || `Question ${q.questionId}`,
        promptText: q.promptText || q.questionText,
        goodCluesCount: goodCount,
        badCluesCount: badCount,
        hasPasskey: !!(q.directPasskey && q.directPasskey.trim()),
        hasAnswerKey: !!((q.answerKey || q.answer) && (q.answerKey || q.answer).trim()),
        isFinalVault: !!q.isFinalVault,
        nextQuestionIdOnCorrect: q.nextQuestionIdOnCorrect || q.goodNextId || '',
        nextQuestionIdOnPasskey: q.nextQuestionIdOnPasskey || '',
        nextQuestionIdOnWrong: q.nextQuestionIdOnWrong || q.badNextId || '',
        wrongAnswerAction: q.wrongAnswerAction || 'retry',
        wrongPasskeyAction: q.wrongPasskeyAction || 'penalty',
        trapId: q.trapId || '',
        active: q.active
      };
    });
    return res.json({ success: true, questions: formatted });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve questions' });
  }
};

// Get full question by ID
const getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    return res.json({ success: true, question });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Error retrieving question' });
  }
};

// Validate question payload helper
const validateQuestionPayload = (body) => {
  const errors = [];
  if (!body.questionId || !body.questionId.trim()) errors.push('Question ID is required');
  if (!body.set && !body.setName) errors.push('Question Set (A, B, or C) is required');
  if (!body.promptText && !body.questionText) errors.push('Question Prompt / Narrative is required');
  if (!body.answerKey && !body.answer) errors.push('Correct Answer is required');
  if (!body.directPasskey) errors.push('Direct Passkey is required');

  const goodClues = Array.isArray(body.goodClues) ? body.goodClues : (typeof body.goodClues === 'string' ? JSON.parse(body.goodClues || '[]') : []);
  const badClues = Array.isArray(body.badClues) ? body.badClues : (typeof body.badClues === 'string' ? JSON.parse(body.badClues || '[]') : []);

  const validGood = goodClues.filter(c => c && c.text && c.text.trim());
  const validBad = badClues.filter(c => c && c.text && c.text.trim());

  if (validGood.length < 6) {
    errors.push(`Requires exactly 6 Good Clues (currently has ${validGood.length})`);
  }
  if (validBad.length < 6) {
    errors.push(`Requires exactly 6 Bad Clues (currently has ${validBad.length})`);
  }

  const isFinal = body.isFinalVault === true || body.isFinalVault === 'true';
  if (!isFinal && !body.nextQuestionIdOnCorrect && !body.goodNextId) {
    errors.push('Next Question ID on Correct Answer is required unless marked as Final Vault');
  }

  return { errors, goodClues: validGood, badClues: validBad };
};

// Create new 12-clue question
const createQuestion = async (req, res) => {
  try {
    let payload = req.body;

    // Handle form-data JSON string parse if sent as multipart
    if (typeof payload.goodClues === 'string') {
      try { payload.goodClues = JSON.parse(payload.goodClues); } catch(e) {}
    }
    if (typeof payload.badClues === 'string') {
      try { payload.badClues = JSON.parse(payload.badClues); } catch(e) {}
    }

    const { errors, goodClues, badClues } = validateQuestionPayload(payload);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: '⚠️ QUESTION CANNOT BE PUBLISHED:\n- ' + errors.join('\n- ')
      });
    }

    const existing = await Question.findOne({ questionId: payload.questionId.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: `Question ID ${payload.questionId} already exists` });
    }

    const image = req.file ? `/uploads/${req.file.filename}` : (payload.image || '');

    const question = new Question({
      questionId: payload.questionId.trim(),
      set: payload.set || payload.setName,
      setName: payload.set || payload.setName,
      title: payload.title || `Challenge ${payload.questionId.trim()}`,
      category: payload.category || 'General',
      code: payload.code || '',
      promptText: payload.promptText || payload.questionText,
      questionText: payload.promptText || payload.questionText,
      image,
      goodClues: goodClues.slice(0, 6).map((c, i) => ({
        clueId: c.clueId || `G${i + 1}`,
        text: c.text.trim(),
        imageUrl: c.imageUrl || '',
        order: i + 1
      })),
      badClues: badClues.slice(0, 6).map((c, i) => ({
        clueId: c.clueId || `B${i + 1}`,
        text: c.text.trim(),
        imageUrl: c.imageUrl || '',
        order: i + 1
      })),
      answerKey: (payload.answerKey || payload.answer || '').trim(),
      answer: (payload.answerKey || payload.answer || '').trim(),
      directPasskey: (payload.directPasskey || '').trim(),
      isFinalVault: payload.isFinalVault === true || payload.isFinalVault === 'true',
      nextQuestionIdOnCorrect: payload.nextQuestionIdOnCorrect || payload.goodNextId || '',
      nextQuestionIdOnPasskey: payload.nextQuestionIdOnPasskey || payload.nextQuestionIdOnCorrect || payload.goodNextId || '',
      nextQuestionIdOnWrong: payload.nextQuestionIdOnWrong || payload.badNextId || '',
      wrongAnswerAction: payload.wrongAnswerAction || 'retry',
      wrongPasskeyAction: payload.wrongPasskeyAction || 'penalty',
      timeLimit: payload.timeLimit ? Number(payload.timeLimit) : 0,
      score: payload.score ? Number(payload.score) : 100,
      penalty: payload.penalty ? Number(payload.penalty) : 20,
      trapId: payload.trapId || '',
      difficulty: payload.difficulty || 'medium',
      active: payload.active !== undefined ? payload.active : true
    });

    await question.save();
    return res.json({ success: true, message: 'Question published successfully', question });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to create question' });
  }
};

// Update question
const updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    let payload = req.body;
    if (typeof payload.goodClues === 'string') {
      try { payload.goodClues = JSON.parse(payload.goodClues); } catch(e) {}
    }
    if (typeof payload.badClues === 'string') {
      try { payload.badClues = JSON.parse(payload.badClues); } catch(e) {}
    }

    if (payload.questionId !== undefined && payload.questionId !== question.questionId) {
      const existing = await Question.findOne({ questionId: payload.questionId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `Question ID ${payload.questionId} already exists` });
      }
      question.questionId = payload.questionId.trim();
    }

    if (payload.set !== undefined) {
      question.set = payload.set;
      question.setName = payload.set;
    }
    if (payload.title !== undefined) question.title = payload.title;
    if (payload.category !== undefined) question.category = payload.category;
    if (payload.code !== undefined) question.code = payload.code;
    if (payload.promptText !== undefined) {
      question.promptText = payload.promptText;
      question.questionText = payload.promptText;
    }
    if (payload.goodClues !== undefined) {
      question.goodClues = payload.goodClues.slice(0, 6).map((c, i) => ({
        clueId: c.clueId || `G${i + 1}`,
        text: (c.text || '').trim(),
        imageUrl: c.imageUrl || '',
        order: i + 1
      }));
    }
    if (payload.badClues !== undefined) {
      question.badClues = payload.badClues.slice(0, 6).map((c, i) => ({
        clueId: c.clueId || `B${i + 1}`,
        text: (c.text || '').trim(),
        imageUrl: c.imageUrl || '',
        order: i + 1
      }));
    }
    if (payload.answerKey !== undefined) {
      question.answerKey = payload.answerKey.trim();
      question.answer = payload.answerKey.trim();
    }
    if (payload.directPasskey !== undefined) question.directPasskey = payload.directPasskey.trim();
    if (payload.isFinalVault !== undefined) question.isFinalVault = payload.isFinalVault === true || payload.isFinalVault === 'true';
    if (payload.nextQuestionIdOnCorrect !== undefined) question.nextQuestionIdOnCorrect = payload.nextQuestionIdOnCorrect;
    if (payload.nextQuestionIdOnPasskey !== undefined) question.nextQuestionIdOnPasskey = payload.nextQuestionIdOnPasskey;
    if (payload.nextQuestionIdOnWrong !== undefined) question.nextQuestionIdOnWrong = payload.nextQuestionIdOnWrong;
    if (payload.wrongAnswerAction !== undefined) question.wrongAnswerAction = payload.wrongAnswerAction;
    if (payload.wrongPasskeyAction !== undefined) question.wrongPasskeyAction = payload.wrongPasskeyAction;
    if (payload.timeLimit !== undefined) question.timeLimit = Number(payload.timeLimit);
    if (payload.score !== undefined) question.score = Number(payload.score);
    if (payload.penalty !== undefined) question.penalty = Number(payload.penalty);
    if (payload.trapId !== undefined) question.trapId = payload.trapId;
    if (payload.difficulty !== undefined) question.difficulty = payload.difficulty;
    if (payload.active !== undefined) question.active = payload.active;

    if (req.file) {
      question.image = `/uploads/${req.file.filename}`;
    } else if (payload.image !== undefined) {
      question.image = payload.image;
    }

    await question.save();
    return res.json({ success: true, message: 'Question updated successfully', question });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to update question' });
  }
};

// Duplicate an existing question
const duplicateQuestion = async (req, res) => {
  try {
    const original = await Question.findById(req.params.id);
    if (!original) {
      return res.status(404).json({ success: false, message: 'Original question not found' });
    }

    let newQuestionId = `${original.questionId}-COPY`;
    let count = 1;
    while (await Question.findOne({ questionId: newQuestionId })) {
      count++;
      newQuestionId = `${original.questionId}-COPY${count}`;
    }

    const cloned = new Question({
      questionId: newQuestionId,
      set: original.set,
      setName: original.setName || original.set,
      title: `${original.title || original.questionId} (Copy)`,
      category: original.category || 'General',
      code: original.code || '',
      promptText: original.promptText || original.questionText,
      questionText: original.questionText || original.promptText,
      image: original.image,
      goodClues: (original.goodClues || []).map(c => ({
        clueId: c.clueId,
        text: c.text,
        imageUrl: c.imageUrl,
        order: c.order
      })),
      badClues: (original.badClues || []).map(c => ({
        clueId: c.clueId,
        text: c.text,
        imageUrl: c.imageUrl,
        order: c.order
      })),
      answerKey: original.answerKey || original.answer || '',
      answer: original.answer || original.answerKey || '',
      directPasskey: original.directPasskey || '',
      isFinalVault: original.isFinalVault,
      nextQuestionIdOnCorrect: original.nextQuestionIdOnCorrect,
      nextQuestionIdOnPasskey: original.nextQuestionIdOnPasskey,
      nextQuestionIdOnWrong: original.nextQuestionIdOnWrong,
      wrongAnswerAction: original.wrongAnswerAction,
      wrongPasskeyAction: original.wrongPasskeyAction || 'penalty',
      timeLimit: original.timeLimit || 0,
      score: original.score || 100,
      penalty: original.penalty || 20,
      trapId: original.trapId,
      difficulty: original.difficulty,
      active: original.active
    });

    await cloned.save();
    return res.json({ success: true, message: `Duplicated as ${newQuestionId}`, question: cloned });
  } catch (error) {
    console.error('duplicateQuestion error:', error);
    return res.status(500).json({ success: false, message: 'Failed to duplicate question' });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }
    await Question.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Question deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete question' });
  }
};

const deleteAllQuestions = async (req, res) => {
  try {
    await Question.deleteMany({});
    return res.json({ success: true, message: 'All questions deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete all questions' });
  }
};

// ==========================================
// TRAPS CRUD
// ==========================================
const getTraps = async (req, res) => {
  try {
    const traps = await Trap.find().sort({ set: 1, trapId: 1 });
    return res.json({ success: true, traps });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve traps' });
  }
};

const createTrap = async (req, res) => {
  try {
    const { trapId, set, name, description, question, answer, successNextId, failureNextId, active } = req.body;
    
    const existing = await Trap.findOne({ trapId });
    if (existing) {
      return res.status(400).json({ success: false, message: `Trap ID ${trapId} already exists` });
    }

    const trap = new Trap({
      trapId,
      set,
      name,
      description,
      question,
      answer,
      successNextId,
      failureNextId,
      active
    });
    await trap.save();
    return res.json({ success: true, message: 'Trap created successfully', trap });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to create trap' });
  }
};

const updateTrap = async (req, res) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) {
      return res.status(404).json({ success: false, message: 'Trap not found' });
    }

    const { trapId, set, name, description, question, answer, successNextId, failureNextId, active } = req.body;

    if (trapId !== undefined) {
      const existing = await Trap.findOne({ trapId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: `Trap ID ${trapId} already exists` });
      }
      trap.trapId = trapId;
    }

    if (set !== undefined) trap.set = set;
    if (name !== undefined) trap.name = name;
    if (description !== undefined) trap.description = description;
    if (question !== undefined) trap.question = question;
    if (answer !== undefined) trap.answer = answer;
    if (successNextId !== undefined) trap.successNextId = successNextId;
    if (failureNextId !== undefined) trap.failureNextId = failureNextId;
    if (active !== undefined) trap.active = active;

    await trap.save();
    return res.json({ success: true, message: 'Trap updated successfully', trap });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to update trap' });
  }
};

const deleteTrap = async (req, res) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) {
      return res.status(404).json({ success: false, message: 'Trap not found' });
    }
    await Trap.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Trap deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete trap' });
  }
};

const deleteAllTraps = async (req, res) => {
  try {
    await Trap.deleteMany({});
    return res.json({ success: true, message: 'All traps deleted successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete all traps' });
  }
};

module.exports = {
  getQuestionSets,
  createQuestionSet,
  updateQuestionSet,
  deleteQuestionSet,
  deleteAllQuestionSets,
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  duplicateQuestion,
  deleteQuestion,
  deleteAllQuestions,
  uploadClueImage,
  getTraps,
  createTrap,
  updateTrap,
  deleteTrap,
  deleteAllTraps
};
