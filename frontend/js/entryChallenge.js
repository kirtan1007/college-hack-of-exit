document.addEventListener('DOMContentLoaded', async () => {
  const pcId = App.getPCId();
  document.getElementById('pc-display').textContent = `PC-ID: ${pcId}`;

  const sessionId = App.getSessionId();
  if (!sessionId) {
    window.location.href = '/registration.html';
    return;
  }

  const octalValueEl = document.getElementById('octal-value');
  const unlockForm = document.getElementById('unlock-form');

  // Load session information to fetch the Octal number
  try {
    const response = await fetch(`/api/game/${sessionId}`);
    const data = await response.json();

    if (!data.success) {
      App.clearSession();
      window.location.href = '/registration.html';
      return;
    }

    const { session } = data;
    
    // Redirect if they have already finished or bypassed this step
    if (session.status === 'COMPLETED' || session.status === 'GAME_OVER') {
      window.location.href = '/result.html';
      return;
    }
    
    if (session.unlocked) {
      window.location.href = '/game.html';
      return;
    }

    if (session.currentQuestion && session.currentQuestion.isEntryChallenge) {
      octalValueEl.textContent = `${session.currentQuestion.entryOctal}₈`;
    }
  } catch (err) {
    console.error(err);
    App.showAlert('alert-box', 'Failed to initialize security challenge.');
  }

  // Handle Binary Password Submission
  unlockForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('alert-box');

    const binaryPassword = document.getElementById('binaryPassword').value.trim();

    try {
      const response = await fetch(`/api/game/${sessionId}/unlock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ binaryPassword })
      });

      const data = await response.json();

      if (response.ok) {
        window.location.href = '/game.html';
      } else {
        if (data.trapTriggered) {
          App.showAlert('alert-box', data.message, 'danger');
          setTimeout(() => {
            window.location.href = '/game.html';
          }, 2000);
        } else {
          App.showAlert('alert-box', `${data.message} (${data.attemptsLeft} attempts remaining)`);
        }
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Network error verifying bypass code.');
    }
  });
});
