const mongoose = require('../config/dbLoader');

const clueSchema = new mongoose.Schema({
  clueId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  text: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['good', 'bad'],
    required: true
  },
  set: {
    type: String,
    enum: ['A', 'B', 'C'],
    required: true
  },
  active: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Clue', clueSchema);
