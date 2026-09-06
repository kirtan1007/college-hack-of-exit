const mongoose = require('../config/dbLoader');

const systemSettingsSchema = new mongoose.Schema({
  eventName: {
    type: String,
    default: 'Hack The Exit'
  },
  eventDescription: {
    type: String,
    default: 'Escape Room Challenge'
  },
  defaultTimerMinutes: {
    type: Number,
    default: 30
  },
  maxPasswordAttempts: {
    type: Number,
    default: 3
  },
  enableHints: {
    type: Boolean,
    default: true
  },
  departments: {
    type: [String],
    default: ['BCA', 'B.Sc IT', 'B.Tech', 'MCA', 'Other']
  },
  semesters: {
    type: [String],
    default: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6']
  },
  activeQuestionIds: {
    type: [String],
    default: ['Q01', 'Q02', 'Q03']
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
