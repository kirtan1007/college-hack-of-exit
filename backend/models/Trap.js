const mongoose = require('../config/dbLoader');

const trapSchema = new mongoose.Schema({
  trapId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  set: {
    type: String,
    enum: ['A', 'B', 'C', 'ALL'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  successNextId: {
    type: String,
    required: true
  },
  failureNextId: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Trap', trapSchema);
