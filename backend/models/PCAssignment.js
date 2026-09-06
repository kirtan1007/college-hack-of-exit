const mongoose = require('../config/dbLoader');

const pcAssignmentSchema = new mongoose.Schema({
  pcId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  assignedSet: {
    type: String,
    enum: ['A', 'B', 'C'],
    default: 'A'
  }
}, { timestamps: true });

module.exports = mongoose.model('PCAssignment', pcAssignmentSchema);
