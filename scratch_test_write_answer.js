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

async function testWriteAnswerFlow() {
  console.log('=== TESTING WRITE ANSWER TO NEXT QUESTION FLOW ===\n');

  // 1. Register student
  const roll = 'WRITE_' + Date.now().toString().slice(-4);
  const regRes = await request('/api/students/register', 'POST', {
    name: 'Write Answer Agent',
    enrollmentNumber: roll,
    department: 'CSE',
    semester: '4',
    whatsapp: '9123456780',
    email: 'writeagent@cyber.test',
    pcId: 'PC-01'
  });

  const sessionId = regRes.data.sessionId || (regRes.data.session && regRes.data.session.sessionId);
  console.log(`[PASS] 1. Registered student. Session: ${sessionId}`);

  // 2. Unlock entry challenge
  const unlockRes = await request(`/api/game/${sessionId}/unlock`, 'POST', { binaryPassword: '1001' });
  if (!unlockRes.data.success) throw new Error('Unlock failed: ' + JSON.stringify(unlockRes));
  console.log('[PASS] 2. Entry unlocked.');

  // 3. Check QA-1
  const q1Res = await request(`/api/game/${sessionId}`);
  const q1 = q1Res.data.session.currentQuestion;
  console.log(`[PASS] 3. Loaded stage 1: ${q1.questionId} - ${q1.title}`);

  // 4. Test wrong answer
  const wrongAns = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'WRONG_ANSWER' });
  if (wrongAns.status !== 400) throw new Error('Expected 400 on wrong answer, got: ' + JSON.stringify(wrongAns));
  console.log(`[PASS] 4. Incorrect answer handled properly: "${wrongAns.data.message}"`);

  // 5. Submit correct written answer for QA-1: 'BDP2~D~B'
  const ans1Res = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'BDP2~D~B' });
  if (ans1Res.status !== 200 || ans1Res.data.nextQuestionId !== 'QA-2') {
    throw new Error('QA-1 answer failed or did not advance to QA-2: ' + JSON.stringify(ans1Res));
  }
  console.log(`[PASS] 5. QA-1 written answer verified! Advanced to: ${ans1Res.data.nextQuestionId}`);

  // 6. Check QA-2
  const q2Res = await request(`/api/game/${sessionId}`);
  const q2 = q2Res.data.session.currentQuestion;
  console.log(`[PASS] 6. Loaded stage 2: ${q2.questionId} - ${q2.title}`);

  // 7. Submit correct written answer for QA-2: '112'
  const ans2Res = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: '112' });
  if (ans2Res.status !== 200 || ans2Res.data.nextQuestionId !== 'QA-FINAL') {
    throw new Error('QA-2 answer failed or did not advance to QA-FINAL: ' + JSON.stringify(ans2Res));
  }
  console.log(`[PASS] 7. QA-2 written answer verified! Advanced to: ${ans2Res.data.nextQuestionId}`);

  // 8. Check QA-FINAL
  const qfRes = await request(`/api/game/${sessionId}`);
  const qf = qfRes.data.session.currentQuestion;
  console.log(`[PASS] 8. Loaded final vault: ${qf.questionId} - ${qf.title} (isFinalVault: ${qf.isFinalVault})`);

  // 9. Submit correct written answer for QA-FINAL: 'PREPARED STATEMENT'
  const ansFinalRes = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'PREPARED STATEMENT' });
  if (ansFinalRes.status !== 200 || !ansFinalRes.data.completed) {
    throw new Error('QA-FINAL answer failed to complete: ' + JSON.stringify(ansFinalRes));
  }
  console.log(`[PASS] 9. Final vault written answer verified! Escape completed: "${ansFinalRes.data.message.replace(/\n/g, ' ')}"`);

  // 10. Check session status
  const finalCheck = await request(`/api/game/${sessionId}`);
  if (finalCheck.data.session.status !== 'COMPLETED') {
    throw new Error('Expected session status COMPLETED, got: ' + finalCheck.data.session.status);
  }
  console.log(`[PASS] 10. Terminal state verified: COMPLETED.`);

  console.log('\n======================================================');
  console.log('WRITE ANSWER TO NEXT QUESTION SUITE: 100% SUCCESSFUL');
  console.log('======================================================');
}

testWriteAnswerFlow().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
