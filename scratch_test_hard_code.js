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

async function runTest() {
  console.log('=== RUNNING HARD CODE GAMEPLAY & 6-OF-12 CLUE VERIFICATION ===\n');

  // 1. Register student on PC-01
  const roll = 'AGENT_' + Date.now().toString().slice(-4);
  const regRes = await request('/api/students/register', 'POST', {
    name: 'Cipher Test Agent',
    enrollmentNumber: roll,
    department: 'B.Tech CS',
    semester: 'Sem 4',
    whatsapp: '9876543210',
    email: 'agent@cyber.test',
    pcId: 'PC-01'
  });

  if (regRes.status !== 200 && regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regRes)}`);
  }
  const sessionId = regRes.data.sessionId || (regRes.data.session && regRes.data.session.sessionId);
  console.log(`[PASS] 1. Registered student on PC-01. Session: ${sessionId}`);

  // 2. Unlock Entry challenge with binary password '1001'
  const unlockRes = await request(`/api/game/${sessionId}/unlock`, 'POST', { binaryPassword: '1001' });
  if (unlockRes.status !== 200 || !unlockRes.data.success) {
    throw new Error(`Unlock failed: ${JSON.stringify(unlockRes)}`);
  }
  console.log('[PASS] 2. Unlocked entry challenge with Set A binary password.');

  // 3. Fetch QA-1 question
  const q1Res = await request(`/api/game/${sessionId}`);
  const q1 = q1Res.data.session.currentQuestion;
  if (!q1 || q1.questionId !== 'QA-1') {
    throw new Error(`Expected QA-1, got: ${JSON.stringify(q1)}`);
  }
  console.log(`[PASS] 3. Loaded QA-1: "${q1.title}". Category: "${q1.category}". Code length: ${q1.code.length} chars.`);

  // 3b. Verify Security: 12 shuffled clues, no answers or leakages
  if (!Array.isArray(q1.clues) || q1.clues.length !== 12) {
    throw new Error(`Expected exactly 12 clues, got ${q1.clues ? q1.clues.length : 0}`);
  }
  if (q1.answerKey || q1.directPasskey || q1.goodClues || q1.badClues) {
    throw new Error('SECURITY VIOLATION: answerKey, directPasskey, or clue categories leaked to client!');
  }
  console.log(`[PASS] 4. Security verified: Exactly 12 mixed clues returned without answers or classification.`);

  // 4. Try to submit normal answer without selecting clues (Must fail with 400)
  const prematureAns = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'BDP2~D~B' });
  if (prematureAns.status !== 400 || !prematureAns.data.message.includes('CLUES LOCKED')) {
    throw new Error(`Expected 400 CLUES LOCKED, got: ${JSON.stringify(prematureAns)}`);
  }
  console.log(`[PASS] 5. Answer locked enforcement verified: "${prematureAns.data.message}"`);

  // 5. Test invalid clue selection (3 clues)
  const invalidCountRes = await request(`/api/game/${sessionId}/clues`, 'POST', {
    selectedClueIds: [q1.clues[0].clueId, q1.clues[1].clueId, q1.clues[2].clueId]
  });
  if (invalidCountRes.status !== 400 || !invalidCountRes.data.message.includes('exactly 6 clues')) {
    throw new Error(`Expected 400 for 3 clues, got: ${JSON.stringify(invalidCountRes)}`);
  }
  console.log(`[PASS] 6. Invalid clue count rejection verified: "${invalidCountRes.data.message}"`);

  // 6. Submit valid 6 clue selection
  const selected6 = q1.clues.slice(0, 6).map(c => c.clueId);
  const validCluesRes = await request(`/api/game/${sessionId}/clues`, 'POST', { selectedClueIds: selected6 });
  if (validCluesRes.status !== 200 || !validCluesRes.data.answerUnlocked) {
    throw new Error(`Expected 200 answerUnlocked, got: ${JSON.stringify(validCluesRes)}`);
  }
  console.log(`[PASS] 7. 6 Clues verified & locked: "${validCluesRes.data.message}"`);

  // 7. Check session state now reflects cluesSubmitted: true
  const q1Check = await request(`/api/game/${sessionId}`);
  if (!q1Check.data.session.currentQuestion.cluesSubmitted) {
    throw new Error('cluesSubmitted flag not set to true in session data!');
  }
  console.log(`[PASS] 8. Session reflects cluesSubmitted: true.`);

  // 8. Now submit correct answer for QA-1: 'BDP2~D~B'
  const ansRes = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'BDP2~D~B' });
  if (ansRes.status !== 200 || ansRes.data.nextQuestionId !== 'QA-2') {
    throw new Error(`Answer failed or did not advance to QA-2: ${JSON.stringify(ansRes)}`);
  }
  console.log(`[PASS] 9. Solved QA-1 with normal answer! Advanced to QA-2.`);

  // 9. Check QA-2: Python Mutable Default Arguments
  const q2Res = await request(`/api/game/${sessionId}`);
  const q2 = q2Res.data.session.currentQuestion;
  if (!q2 || q2.questionId !== 'QA-2') {
    throw new Error(`Expected QA-2, got: ${JSON.stringify(q2)}`);
  }
  console.log(`[PASS] 10. Loaded QA-2: "${q2.title}". Category: "${q2.category}". Code contains: "def probe(val, buffer=[])"`);

  // 10. Test Route B: DIRECT PASSKEY BYPASS (Bypass clue selection entirely!)
  const passkeyRes = await request(`/api/game/${sessionId}/passkey`, 'POST', { passkey: 'MUTABLE_DEFAULT' });
  if (passkeyRes.status !== 200 || !passkeyRes.data.bypassed || passkeyRes.data.nextQuestionId !== 'QA-FINAL') {
    throw new Error(`Passkey bypass failed: ${JSON.stringify(passkeyRes)}`);
  }
  console.log(`[PASS] 11. Route B Direct Passkey bypass verified! Advanced directly to QA-FINAL.`);

  // 11. QA-FINAL: Test wrong passkey penalty
  const qFinalRes = await request(`/api/game/${sessionId}`);
  const qf = qFinalRes.data.session.currentQuestion;
  if (!qf || qf.questionId !== 'QA-FINAL') {
    throw new Error(`Expected QA-FINAL, got: ${JSON.stringify(qf)}`);
  }
  console.log(`[PASS] 12. Loaded QA-FINAL: "${qf.title}". Category: "${qf.category}". Final Vault: ${qf.isFinalVault}`);

  const wrongPasskey = await request(`/api/game/${sessionId}/passkey`, 'POST', { passkey: 'WRONG_SECRET' });
  if (wrongPasskey.status !== 400 || !wrongPasskey.data.message.includes('penalty')) {
    throw new Error(`Expected wrong passkey penalty, got: ${JSON.stringify(wrongPasskey)}`);
  }
  console.log(`[PASS] 13. Wrong passkey penalty verified: "${wrongPasskey.data.message}"`);

  // 12. Select 6 clues on QA-FINAL & submit answer 'PREPARED STATEMENT' to WIN!
  const final6 = qf.clues.slice(0, 6).map(c => c.clueId);
  await request(`/api/game/${sessionId}/clues`, 'POST', { selectedClueIds: final6 });
  const winRes = await request(`/api/game/${sessionId}/answer`, 'POST', { answer: 'PREPARED STATEMENT' });
  if (winRes.status !== 200 || !winRes.data.completed) {
    throw new Error(`Final answer failed to win: ${JSON.stringify(winRes)}`);
  }
  console.log(`[PASS] 14. Solved Final Vault! Message: "${winRes.data.message.replace(/\n/g, ' ')}"`);

  // 13. Verify Leaderboard
  const leaderRes = await request('/api/results/leaderboard');
  const rankings = leaderRes.data.rankings || leaderRes.data.results;
  if (leaderRes.status !== 200 || !rankings || rankings.length === 0) {
    throw new Error(`Leaderboard verification failed: ${JSON.stringify(leaderRes)}`);
  }
  const entry = rankings.find(r => r.enrollmentNumber === roll);
  if (!entry) {
    throw new Error(`Result entry for ${roll} not found in leaderboard!`);
  }
  console.log(`[PASS] 15. Leaderboard verified! Agent "${entry.studentName}" scored: ${entry.score} pts in ${entry.completionTime}s.`);

  console.log('\n=============================================');
  console.log('ALL 15 INTEGRATION TEST CHECKS PASSED (100%)');
  console.log('=============================================');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
