const mongoose = require('../config/dbLoader');

const clueItemSchema = new mongoose.Schema({
  clueId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: ''
  },
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  set: {
    type: String,
    default: 'ALL',
    trim: true
  },
  setName: {
    type: String,
    default: 'ALL',
    trim: true
  },
  title: {
    type: String,
    default: ''
  },
  promptText: {
    type: String,
    required: true
  },
  // Legacy / convenience alias
  questionText: {
    type: String
  },
  image: {
    type: String,
    default: ''
  },
  code: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'General'
  },
  // Exactly 6 useful clues
  goodClues: {
    type: [clueItemSchema],
    default: []
  },
  // Exactly 6 misleading clues
  badClues: {
    type: [clueItemSchema],
    default: []
  },
  // Primary puzzle answer
  answerKey: {
    type: String,
    default: ''
  },
  // Direct bypass passkey
  directPasskey: {
    type: String,
    default: ''
  },
  directPasskeyHash: {
    type: String,
    default: ''
  },
  isFinalVault: {
    type: Boolean,
    default: false
  },
  nextQuestionIdOnCorrect: {
    type: String,
    default: ''
  },
  nextQuestionIdOnPasskey: {
    type: String,
    default: ''
  },
  nextQuestionIdOnWrong: {
    type: String,
    default: ''
  },
  wrongAnswerAction: {
    type: String,
    enum: ['retry', 'penalty', 'trap', 'alternate'],
    default: 'retry'
  },
  wrongPasskeyAction: {
    type: String,
    enum: ['retry', 'penalty', 'lockout', 'alternate'],
    default: 'penalty'
  },
  timeLimit: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    default: 100
  },
  penalty: {
    type: Number,
    default: 20
  },
  isPublished: {
    type: Boolean,
    default: true
  },
  trapId: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Pre-save hook to keep setName & set synchronized
questionSchema.pre('save', function(next) {
  if (this.set && !this.setName) {
    this.setName = this.set;
  } else if (this.setName && !this.set) {
    this.set = this.setName;
  }
  if (!this.questionText && this.promptText) {
    this.questionText = this.promptText;
  } else if (!this.promptText && this.questionText) {
    this.promptText = this.questionText;
  }
  if (!this.title) {
    this.title = `Challenge ${this.questionId}`;
  }
  if (next) next();
});

module.exports = mongoose.model('Question', questionSchema);
