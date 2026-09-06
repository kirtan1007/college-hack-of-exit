const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  duplicateQuestion,
  deleteQuestion,
  deleteAllQuestions,
  uploadClueImage
} = require('../controllers/questionController');
const { protectAdmin } = require('../middleware/authMiddleware');

// Ensure uploads & uploads/clues folders exist
const uploadDir = path.join(__dirname, '../../uploads');
const cluesUploadDir = path.join(__dirname, '../../uploads/clues');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(cluesUploadDir)) {
  fs.mkdirSync(cluesUploadDir, { recursive: true });
}

// Multer Config for clue images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, cluesUploadDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif|svg/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only (jpg, jpeg, png, webp, gif, svg)!'));
    }
  }
});

router.use(protectAdmin);

router.get('/', getQuestions);
router.post('/upload-image', upload.single('image'), uploadClueImage);
router.get('/:id', getQuestionById);
router.post('/', upload.single('image'), createQuestion);
router.put('/:id', upload.single('image'), updateQuestion);
router.post('/:id/duplicate', duplicateQuestion);
router.delete('/all', deleteAllQuestions);
router.delete('/:id', deleteQuestion);

module.exports = router;
