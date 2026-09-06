const Result = require('../models/Result');
const GameSession = require('../models/GameSession');
const Student = require('../models/Student');

// Get leaderboard rankings (sorted)
const getRankings = async (req, res) => {
  try {
    const rankings = await Result.find({ result: 'WIN' })
      .populate('studentId')
      .sort({ completionTime: 1, trapCount: 1, totalAnswerAttempts: 1, wrongChoices: 1 });

    const failed = await Result.find({ result: 'GAME_OVER' })
      .populate('studentId')
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      rankings,
      failed
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve rankings' });
  }
};

// Get all results (for admin dashboard table, combined wins + fails)
const getAllResults = async (req, res) => {
  try {
    const results = await Result.find()
      .populate('studentId')
      .sort({ result: -1, completionTime: 1, trapCount: 1, totalAnswerAttempts: 1, wrongChoices: 1 });

    const sessions = await GameSession.find().select('sessionId pcId');
    const pcMap = {};
    sessions.forEach(s => {
      pcMap[s.sessionId] = s.pcId;
    });

    const detailedResults = results.map((r) => {
      const doc = r.toObject ? r.toObject() : { ...r };
      doc.pcId = r.pcId || pcMap[r.sessionId] || 'N/A';
      return doc;
    });

    return res.json({ success: true, results: detailedResults });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve results' });
  }
};

// Export results as CSV
const exportResultsCSV = async (req, res) => {
  try {
    const sessions = await GameSession.find().select('sessionId pcId');
    const pcMap = {};
    sessions.forEach(s => {
      pcMap[s.sessionId] = s.pcId;
    });

    const populatedResults = await Result.find()
      .populate('studentId')
      .sort({ result: -1, completionTime: 1, totalAnswerAttempts: 1, wrongChoices: 1 });

    let csvContent = 'Rank,Student Name,Enrollment Number,Department,Semester,PC ID,Question Set,Completion Time (Seconds),Formatted Time,Questions Solved,Passkeys Used,Total Attempts,Score,Status\n';

    populatedResults.forEach((r, index) => {
      const pcId = r.pcId || pcMap[r.sessionId] || 'N/A';
      const rank = r.result === 'WIN' ? index + 1 : 'N/A';
      const dept = (r.studentId && r.studentId.department) || r.department || 'N/A';
      const sem = (r.studentId && r.studentId.semester) || 'N/A';
      
      const minutes = Math.floor(r.completionTime / 60);
      const seconds = r.completionTime % 60;
      const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      const name = `"${(r.studentName || '').replace(/"/g, '""')}"`;
      const rawEnroll = (r.enrollmentNumber || '').toString().trim();
      // Prefix with ="..." so Microsoft Excel formats strictly as text, avoiding scientific notation (e.g. 2.40841E+13)
      const enrollment = `="${rawEnroll}"`;
      const qSolved = r.questionsSolved || 0;
      const pUsed = r.passkeysUsed || 0;
      const attempts = r.totalAnswerAttempts || r.wrongChoices || 0;
      const score = r.score || 0;

      csvContent += `${rank},${name},${enrollment},"${dept}","${sem}",${pcId},${r.set},${r.completionTime},${formattedTime},${qSolved},${pUsed},${attempts},${score},${r.result}\n`;
    });

    const bom = '\uFEFF';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hack-the-exit-leaderboard.csv"');
    return res.status(200).send(bom + csvContent);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to generate results CSV' });
  }
};

// Delete single result
const deleteResult = async (req, res) => {
  try {
    const resultDoc = await Result.findById(req.params.id);
    if (resultDoc && resultDoc.sessionId) {
      await GameSession.deleteMany({ sessionId: resultDoc.sessionId });
    }
    await Result.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Result record deleted' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to delete result' });
  }
};

// Delete all results (Reset leaderboard & all game activity telemetry)
const clearAllResults = async (req, res) => {
  try {
    await Result.deleteMany({});
    await GameSession.deleteMany({});
    await Student.deleteMany({});
    return res.json({
      success: true,
      message: 'All results, active sessions, and player telemetry cleared successfully.'
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to clear results' });
  }
};

module.exports = {
  getRankings,
  getAllResults,
  exportResultsCSV,
  deleteResult,
  clearAllResults
};

