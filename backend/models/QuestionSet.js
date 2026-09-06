const mongoose = require('../config/dbLoader');

const questionSetSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true,
    unique: true
  },
  entryOctal: {
    type: String,
    required: true
  },
  entryBinaryPassword: {
    type: String,
    required: true
  },
  startQuestionId: {
    type: String,
    required: true
  },
  finalQuestionId: {
    type: String,
    required: true
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

module.exports = mongoose.model('QuestionSet', questionSetSchema);
