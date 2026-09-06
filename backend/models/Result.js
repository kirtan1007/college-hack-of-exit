const mongoose = require('../config/dbLoader');

const resultSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  sessionId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  enrollmentNumber: {
    type: String,
    required: true,
    index: true
  },
  department: {
    type: String,
    default: ''
  },
  pcId: {
    type: String,
    default: ''
  },
  set: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  completionTime: {
    type: Number, // in seconds
    required: true
  },
  trapCount: {
    type: Number,
    required: true,
    default: 0
  },
  wrongChoices: {
    type: Number,
    required: true,
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
  score: {
    type: Number,
    default: 0
  },
  result: {
    type: String,
    enum: ['WIN', 'GAME_OVER'],
    required: true
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Result', resultSchema);
