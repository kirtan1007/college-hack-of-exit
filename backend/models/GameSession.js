const mongoose = require('../config/dbLoader');

const questionProgressSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true
  },
  cluesViewed: {
    type: [String],
    default: []
  },
  selectedClueIds: {
    type: [String],
    default: []
  },
  shuffledClueIds: {
    type: [String],
    default: []
  },
  cluesSubmitted: {
    type: Boolean,
    default: false
  },
  answerAttempts: {
    type: Number,
    default: 0
  },
  passkeyUsed: {
    type: Boolean,
    default: false
  },
  passkeyAttempts: {
    type: Number,
    default: 0
  },
  completedBy: {
    type: String, // 'answer' | 'passkey' | 'trap'
    default: ''
  },
  wrongAnswerCount: {
    type: Number,
    default: 0
  },
  wrongPasskeyCount: {
    type: Number,
    default: 0
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  solvedAt: {
    type: Date
  }
}, { _id: false });

const gameSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  pcId: {
    type: String,
    required: true
  },
  questionSet: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date
  },
  currentQuestion: {
    type: String
  },
  currentQuestionIndex: {
    type: Number,
    default: 0
  },
  questionSequence: {
    type: [String],
    default: []
  },
  currentTrap: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'GAME_OVER'],
    default: 'NOT_STARTED'
  },
  wrongChoices: {
    type: Number,
    default: 0
  },
  trapCount: {
    type: Number,
    default: 0
  },
  questionsSolved: {
    type: Number,
    default: 0
  },
  passkeysUsed: {
    type: Number,
    default: 0
  },
  totalAnswerAttempts: {
    type: Number,
    default: 0
  },
  completionTime: {
    type: Number, // in seconds
    default: 0
  },
  allowedDuration: {
    type: Number, // in seconds
    required: true
  },
  timerRemainingSeconds: {
    type: Number,
    default: 0
  },
  passwordAttempts: {
    type: Number,
    default: 0
  },
  unlocked: {
    type: Boolean,
    default: false
  },
  questionProgress: {
    type: [questionProgressSchema],
    default: []
  },
  latestClueAttempt: {
    questionId: { type: String, default: '' },
    correctCount: { type: Number, default: 0 },
    incorrectCount: { type: Number, default: 0 },
    correctNumbers: { type: [Number], default: [] },
    incorrectNumbers: { type: [Number], default: [] },
    allCorrect: { type: Boolean, default: false },
    submittedAt: { type: Date }
  }
}, { timestamps: true });

module.exports = mongoose.model('GameSession', gameSessionSchema);
