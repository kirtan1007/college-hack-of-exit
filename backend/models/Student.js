const mongoose = require('../config/dbLoader');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    enum: ['BCA', 'B.Sc IT', 'B.Tech', 'MCA', 'Other']
  },
  enrollmentNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6']
  },
  whatsapp: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    index: true,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
