const http = require('http');

const request = (path, method = 'GET', body = null) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

async function run() {
  console.log('Testing Clue-Only & Passkey-Only flow...');

  const roll = 'TEST_' + Date.now().toString().slice(-4);
  const regRes = await request('/api/students/register', 'POST', {
    name: 'Removed Solution Test Agent',
    enrollmentNumber: roll,
    department: 'CSE',
    semester: '4',
    whatsapp: '9998887776',
    email: 'test@agent.cyber',
    pcId: 'PC-01'
  });

  const sessionId = regRes.data.sessionId || (regRes.data.session && regRes.data.session.sessionId);
  console.log('[1] Registered session:', sessionId);

  const unlockRes = await request(`/api/game/${sessionId}/unlock`, 'POST', { binaryPassword: '1001' });
  console.log('[2] Entry unlocked:', unlockRes.data.success);

  const q1Res = await request(`/api/game/${sessionId}`);
  const q1 = q1Res.data.session.currentQuestion;
  console.log('[3] Loaded Q1:', q1.questionId, 'Clues count:', q1.clues.length);

  // Submit 6 clues on QA-1
  const selected6 = q1.clues.slice(0, 6).map(c => c.clueId);
  const clueRes = await request(`/api/game/${sessionId}/clues`, 'POST', { selectedClueIds: selected6 });
  console.log('[4] Submit 6 clues on Q1 result:', clueRes.data);
  if (!clueRes.data.success || clueRes.data.nextQuestionId !== 'QA-2') {
    throw new Error('Did not advance to QA-2 after submitting 6 clues!');
  }

  // Check state is QA-2
  const q2Res = await request(`/api/game/${sessionId}`);
  console.log('[5] Loaded Q2:', q2Res.data.session.currentQuestion.questionId);

  // Test Direct Passkey Route on QA-2
  const passkeyRes = await request(`/api/game/${sessionId}/passkey`, 'POST', { passkey: 'MUTABLE_DEFAULT' });
  console.log('[6] Passkey on Q2 result:', passkeyRes.data);
  if (!passkeyRes.data.bypassed || passkeyRes.data.nextQuestionId !== 'QA-FINAL') {
    throw new Error('Did not advance to QA-FINAL on passkey!');
  }

  // Check state is QA-FINAL
  const qfRes = await request(`/api/game/${sessionId}`);
  const qf = qfRes.data.session.currentQuestion;
  console.log('[7] Loaded QA-FINAL:', qf.questionId, 'isFinalVault:', qf.isFinalVault);

  // Submit 6 clues on QA-FINAL to clear vault
  const final6 = qf.clues.slice(0, 6).map(c => c.clueId);
  const finalClueRes = await request(`/api/game/${sessionId}/clues`, 'POST', { selectedClueIds: final6 });
  console.log('[8] Submit 6 clues on QA-FINAL result:', finalClueRes.data);
  if (!finalClueRes.data.completed || !finalClueRes.data.escaped) {
    throw new Error('Did not complete final vault on 6 clues!');
  }

  // Check final status
  const finalSession = await request(`/api/game/${sessionId}`);
  console.log('[9] Final session status:', finalSession.data.session.status);

  console.log('\n✅ ALL CHECKS PASSED: Solution box removed, Route A (Submit 6 clues) and Route B (Passkey) function flawlessly!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
