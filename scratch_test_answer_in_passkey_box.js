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
  console.log('Testing Answer "112" entered into Passkey Box...');

  const roll = 'PK_' + Date.now().toString().slice(-4);
  const regRes = await request('/api/students/register', 'POST', {
    name: 'Answer In Passkey Test',
    enrollmentNumber: roll,
    department: 'CSE',
    semester: '4',
    whatsapp: '9988776655',
    email: 'pk@cyber.test',
    pcId: 'PC-01'
  });

  const sid = regRes.data.sessionId || regRes.data.session.sessionId;
  await request(`/api/game/${sid}/unlock`, 'POST', { binaryPassword: '1001' });

  // Move to QA-2 via passkey VPTR_VTBL on QA-1
  await request(`/api/game/${sid}/passkey`, 'POST', { passkey: 'VPTR_VTBL' });

  const q2Check = await request(`/api/game/${sid}`);
  console.log('Current question:', q2Check.data.session.currentQuestion.questionId);

  // Now in QA-2, enter "112" (which is the answer!) into the passkey endpoint!
  const passkeyRes = await request(`/api/game/${sid}/passkey`, 'POST', { passkey: '112' });
  console.log('Result when submitting "112" into passkey box:', passkeyRes.data);

  if (passkeyRes.status !== 200 || !passkeyRes.data.success) {
    throw new Error('Failed to accept "112" in passkey endpoint: ' + JSON.stringify(passkeyRes));
  }

  const nextCheck = await request(`/api/game/${sid}`);
  console.log('Advanced to:', nextCheck.data.session.currentQuestion.questionId);

  if (nextCheck.data.session.currentQuestion.questionId !== 'QA-FINAL') {
    throw new Error('Did not advance to QA-FINAL!');
  }

  console.log('\n✅ SUCCESS: Typing the answer "112" into the passkey box works and advances to the next stage!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
