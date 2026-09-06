document.addEventListener('DOMContentLoaded', () => {
  const pcId = App.getPCId();
  const pcDisplayEl = document.getElementById('pc-display');
  if (pcDisplayEl) pcDisplayEl.textContent = `TERMINAL: ${pcId}`;

  const sessionId = App.getSessionId();
  if (!sessionId) {
    window.location.href = '/registration.html';
    return;
  }

  // DOM Elements
  const studentNameEl = document.getElementById('student-name');
  const timerDisplayEl = document.getElementById('timer-display');
  const gameWindowEl = document.getElementById('game-window');
  const trapBannerEl = document.getElementById('trap-banner');
  const badgeTerminalEl = document.getElementById('badge-terminal');
  const badgeSetEl = document.getElementById('badge-set');
  const badgeVaultEl = document.getElementById('badge-vault');
  const progressTrackerEl = document.getElementById('progress-tracker');
  const alertBoxEl = document.getElementById('alert-box');

  // Normal mode elements
  const normalContainerEl = document.getElementById('normal-game-container');
  const questionHeroCardEl = document.getElementById('question-hero-card');
  const questionStageHeaderEl = document.getElementById('question-stage-header');
  const badgeCategoryEl = document.getElementById('badge-category');
  const questionTitleEl = document.getElementById('question-title');
  const questionPromptEl = document.getElementById('question-prompt');
  const codeContainerEl = document.getElementById('code-container');
  const codeSnippetEl = document.getElementById('code-snippet');
  const codeLangLabelEl = document.getElementById('code-lang-label');
  const imageContainerEl = document.getElementById('image-container');
  const questionImgEl = document.getElementById('question-img');
  const cluesGridEl = document.getElementById('clues-grid');

  // Clue selection toolbar
  const clueSelectedCountEl = document.getElementById('clue-selected-count');
  const btnSubmitCluesEl = document.getElementById('btn-submit-clues');
  const btnSubmitCluesBottomEl = document.getElementById('btn-submit-clues-bottom');

  // Solution Tabs & Direct Passkey Form
  const tabAnswerEl = document.getElementById('tab-answer');
  const tabPasskeyEl = document.getElementById('tab-passkey');
  const solutionInstructionTextEl = document.getElementById('solution-instruction-text');
  const passkeyFormEl = document.getElementById('passkey-form');
  const passkeyInputEl = document.getElementById('passkey-input');
  const btnSubmitPasskey = document.getElementById('btn-submit-passkey');

  // Setup Solution Tab Toggling
  if (tabAnswerEl && tabPasskeyEl) {
    tabAnswerEl.addEventListener('click', () => {
      tabAnswerEl.classList.add('active');
      tabPasskeyEl.classList.remove('active');
      if (passkeyInputEl) passkeyInputEl.placeholder = 'Type your answer here...';
      if (solutionInstructionTextEl) {
        solutionInstructionTextEl.textContent = 'Enter the output string OR use a direct passkey to bypass this challenge.';
      }
    });

    tabPasskeyEl.addEventListener('click', () => {
      tabPasskeyEl.classList.add('active');
      tabAnswerEl.classList.remove('active');
      if (passkeyInputEl) passkeyInputEl.placeholder = 'Enter direct passkey here...';
      if (solutionInstructionTextEl) {
        solutionInstructionTextEl.textContent = 'Enter the secret direct passkey to bypass this challenge.';
      }
    });
  }

  // Trap elements
  const trapContainerEl = document.getElementById('trap-game-container');
  const trapStageHeaderEl = document.getElementById('trap-stage-header');
  const trapTitleEl = document.getElementById('trap-title');
  const trapPromptEl = document.getElementById('trap-prompt');
  const trapFormEl = document.getElementById('trap-form');
  const trapInputEl = document.getElementById('trap-input');
  const btnSubmitTrap = document.getElementById('btn-submit-trap');

  // Modal elements
  const modalClueEl = document.getElementById('modal-clue');
  const modalClueLabelEl = document.getElementById('modal-clue-label');
  const modalClueImgEl = document.getElementById('modal-clue-img');
  const modalClueTextEl = document.getElementById('modal-clue-text');
  const modalClueNotesEl = document.getElementById('modal-clue-notes');
  const modalBtnMarkEl = document.getElementById('modal-btn-mark');

  // Wrong Clues Popup Modal elements
  const modalWrongCluesEl = document.getElementById('modal-wrong-clues');
  const wrongCluesPopupMsgEl = document.getElementById('wrong-clues-popup-msg');
  const btnCloseWrongCluesEl = document.getElementById('btn-close-wrong-clues');
  const wrongModalCorrectCountEl = document.getElementById('wrong-modal-correct-count');
  const wrongModalIncorrectCountEl = document.getElementById('wrong-modal-incorrect-count');
  const wrongCluesBadgesContainerEl = document.getElementById('wrong-clues-badges-container');

  let timerInterval = null;
  let remainingSeconds = 0;
  let currentActiveId = null;
  let currentClues = [];
  let markedClues = new Set();
  let selectedClues = new Set();
  let cluesSubmitted = false;
  let clueNotes = {};
  let activeModalClueIndex = null;

  // Load Game State
  const loadGameState = async () => {
    try {
      const response = await fetch(`/api/game/${sessionId}`);
      const data = await response.json();

      if (!data.success) {
        App.clearSession();
        window.location.href = '/registration.html';
        return;
      }

      const { session } = data;

      // Handle terminal completion
      if (session.status === 'COMPLETED' || session.status === 'GAME_OVER') {
        window.location.href = '/result.html';
        return;
      }

      if (!session.unlocked) {
        window.location.href = '/entry-challenge.html';
        return;
      }

      // Populate Header HUD
      if (studentNameEl) studentNameEl.textContent = (session.student && session.student.name) ? session.student.name.toUpperCase() : 'OPERATOR';
      if (badgeTerminalEl) badgeTerminalEl.textContent = session.pcId || (session.student && session.student.pcId) || pcId || 'PC-01';
      if (badgeSetEl) badgeSetEl.textContent = session.questionSet || (session.student && session.student.questionSet) || 'A';

      // Live Timer Sync
      remainingSeconds = session.remainingSeconds;
      startLocalTimer();

      // Progress Tracker Dots
      renderProgress(session.questionsSolved || 0);

      // Handle Trap Mode vs Normal Question Mode
      if (session.currentTrap) {
        renderTrapMode(session.currentTrap);
      } else if (session.currentQuestion) {
        renderNormalMode(session.currentQuestion);
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Network error synchronizing terminal telemetry.');
    }
  };

  // Render Normal Question with 12 Mixed Clues & Code Block
  const renderNormalMode = (question) => {
    if (normalContainerEl) normalContainerEl.style.display = 'block';
    if (trapContainerEl) trapContainerEl.style.display = 'none';
    if (trapBannerEl) trapBannerEl.style.display = 'none';
    if (gameWindowEl) gameWindowEl.classList.remove('trap-active');

    // Final Vault Check
    if (badgeVaultEl) {
      if (question.isFinalVault) {
        badgeVaultEl.style.display = 'inline-block';
        if (questionHeroCardEl) questionHeroCardEl.classList.add('vault-hero');
      } else {
        badgeVaultEl.style.display = 'none';
        if (questionHeroCardEl) questionHeroCardEl.classList.remove('vault-hero');
      }
    }

    // Category badge
    if (badgeCategoryEl) {
      if (question.category) {
        badgeCategoryEl.textContent = question.category.toUpperCase();
        badgeCategoryEl.style.display = 'inline-block';
      } else {
        badgeCategoryEl.style.display = 'none';
      }
    }

    if (questionStageHeaderEl) questionStageHeaderEl.textContent = question.questionId;
    if (questionTitleEl) questionTitleEl.textContent = question.title || `QUESTION ${question.questionId}`;
    if (questionPromptEl) questionPromptEl.textContent = question.promptText;

    // Hard Code Snippet with line numbers
    if (question.code && question.code.trim()) {
      const lines = question.code.trim().split('\n');
      const codeHtml = lines.map((line, idx) => {
        const lineNum = idx + 1;
        return `<div class="code-line"><span class="line-num">${lineNum}</span><span class="line-code">${escapeHtml(line)}</span></div>`;
      }).join('');
      codeSnippetEl.innerHTML = codeHtml;
      if (codeContainerEl) codeContainerEl.style.display = 'block';
    } else {
      if (codeContainerEl) codeContainerEl.style.display = 'none';
    }

    // Main Question Visual Image
    if (question.image) {
      questionImgEl.src = question.image;
      imageContainerEl.style.display = 'block';
    } else {
      imageContainerEl.style.display = 'none';
    }

    // Reset passkey input
    if (passkeyInputEl) passkeyInputEl.value = '';

    // Clue selection state from server
    cluesSubmitted = !!question.cluesSubmitted;
    selectedClues = new Set(question.selectedClueIds || []);

    // Render 12 Mixed Clues if question changed
    if (currentActiveId !== question.questionId) {
      currentActiveId = question.questionId;
      currentClues = question.clues || [];
      markedClues.clear();
      renderCluesGrid(currentClues);
    } else {
      renderCluesGrid(currentClues);
    }

    updateClueSelectionState();
  };

  // Update Clue Selection Toolbar State
  const updateClueSelectionState = () => {
    const count = selectedClues.size;
    if (clueSelectedCountEl) {
      clueSelectedCountEl.textContent = count;
    }

    if (btnSubmitCluesEl) {
      if (count === 6) {
        btnSubmitCluesEl.classList.add('ready-to-submit');
        btnSubmitCluesEl.innerHTML = 'SELECTED: <span class="counter-num">6 / 6</span> ➔ ADVANCE';
        btnSubmitCluesEl.title = 'Click to advance with 6 selected clues!';
      } else {
        btnSubmitCluesEl.classList.remove('ready-to-submit');
        btnSubmitCluesEl.innerHTML = `SELECTED: <span class="counter-num">${count}</span> / 6`;
        btnSubmitCluesEl.title = `Select ${6 - count} more clues to advance`;
      }
    }
  };

  // Render 12 Clue Cards Grid matching exact reference image
  const renderCluesGrid = (clues) => {
    cluesGridEl.innerHTML = '';

    if (!clues || clues.length === 0) {
      cluesGridEl.innerHTML = '<div style="color: #94a3b8; font-family: var(--font-mono); grid-column: 1 / -1; text-align: center; padding: 1rem;">No clues assigned to this challenge node.</div>';
      return;
    }

    clues.forEach((clue, idx) => {
      const card = document.createElement('div');
      card.className = 'clue-matrix-card';
      const labelNum = (idx + 1).toString().padStart(2, '0');
      const isSelected = selectedClues.has(clue.clueId);

      if (isSelected) card.classList.add('selected');

      card.innerHTML = `
        <div class="clue-custom-checkbox ${isSelected ? 'checked' : ''}">
          ${isSelected ? '✓' : ''}
        </div>
        <span class="clue-code-tag">CLUE ${labelNum}</span>
        <span class="clue-content-text" title="${escapeHtml(clue.text)}">${escapeHtml(clue.text)}</span>
      `;

      card.addEventListener('click', () => {
        if (!cluesSubmitted) {
          handleClueToggle(clue.clueId, card);
        } else {
          openClueModal(idx);
        }
      });

      cluesGridEl.appendChild(card);
    });
  };

  // Toggle Clue Selection (enforcing max 6)
  const handleClueToggle = (clueId, cardEl) => {
    if (cluesSubmitted) return;

    if (cardEl) {
      cardEl.classList.remove('validated-correct', 'validated-incorrect');
    }

    const checkboxEl = cardEl ? cardEl.querySelector('.clue-custom-checkbox') : null;

    if (selectedClues.has(clueId)) {
      selectedClues.delete(clueId);
      if (checkboxEl) {
        checkboxEl.classList.remove('checked');
        checkboxEl.textContent = '';
      }
      if (cardEl) cardEl.classList.remove('selected');
      App.hideAlert('alert-box');
    } else {
      if (selectedClues.size >= 6) {
        App.showAlert('alert-box', 'LIMIT REACHED: Exactly 6 clues can be selected. Deselect one before picking another.', 'alert-danger');
        return;
      }
      selectedClues.add(clueId);
      if (checkboxEl) {
        checkboxEl.classList.add('checked');
        checkboxEl.textContent = '✓';
      }
      if (cardEl) cardEl.classList.add('selected');
      App.hideAlert('alert-box');
    }

    updateClueSelectionState();
  };

  // Submit 6 Clues Action (Primary solve path for Route A)
  const submitCluesHandler = async () => {
    if (selectedClues.size !== 6) {
      App.showAlert('alert-box', `Please select exactly 6 clues (currently selected: ${selectedClues.size}).`, 'alert-danger');
      return;
    }

    if (btnSubmitCluesEl) {
      btnSubmitCluesEl.disabled = true;
      btnSubmitCluesEl.innerHTML = 'ADVANCING TO NEXT STEP...';
    }

    try {
      const selectedCluesWithNumbers = Array.from(selectedClues).map(id => {
        const idx = currentClues.findIndex(c => c.clueId === id);
        return {
          clueId: id,
          clueNumber: idx !== -1 ? (idx + 1) : null
        };
      });

      const response = await fetch(`/api/game/${sessionId}/clues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedClueIds: Array.from(selectedClues),
          selectedCluesWithNumbers
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        App.showAlert('alert-box', data.message || '✓ 6 CLUES VERIFIED! ADVANCING TO NEXT STEP...', 'alert-success');

        if (data.completed || data.escaped) {
          setTimeout(() => {
            window.location.href = '/result.html';
          }, 1200);
        } else {
          setTimeout(() => {
            App.hideAlert('alert-box');
            selectedClues.clear();
            loadGameState();
          }, 1000);
        }
      } else {
        App.showAlert('alert-box', data.message || '⚠️ INCORRECT CLUES: Failed to submit clues.', 'alert-danger');
        openWrongCluesModal(data.message);

        // Reset all selected clues so the player has to select all clues again
        selectedClues.clear();
        if (cluesGridEl) {
          const cardEls = cluesGridEl.querySelectorAll('.clue-matrix-card');
          cardEls.forEach(card => {
            card.classList.remove('selected', 'validated-correct', 'validated-incorrect');
            const checkboxEl = card.querySelector('.clue-custom-checkbox');
            if (checkboxEl) {
              checkboxEl.classList.remove('checked');
              checkboxEl.textContent = '';
            }
          });
        }

        if (btnSubmitCluesEl) {
          btnSubmitCluesEl.disabled = false;
        }
        updateClueSelectionState();
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Network error submitting clues.', 'alert-danger');
      if (btnSubmitCluesEl) {
        btnSubmitCluesEl.disabled = false;
      }
      updateClueSelectionState();
    }
  };

  // Wrong Clues Popup Modal Handlers
  const openWrongCluesModal = (msg) => {
    if (modalWrongCluesEl) {
      if (msg && wrongCluesPopupMsgEl) {
        wrongCluesPopupMsgEl.innerHTML = `
          ${escapeHtml(msg).replace(/\n/g, '<br>')}<br><br>
          <span style="color: #00f0ff; font-weight: 600;">
            You must identify and select all 6 TRUE clues to unlock the next challenge!
          </span>
        `;
      }
      modalWrongCluesEl.classList.add('active');
      modalWrongCluesEl.style.display = 'flex';
    }
  };

  const closeWrongCluesModal = () => {
    if (modalWrongCluesEl) {
      modalWrongCluesEl.classList.remove('active');
      modalWrongCluesEl.style.display = 'none';
    }
  };

  if (btnCloseWrongCluesEl) {
    btnCloseWrongCluesEl.addEventListener('click', closeWrongCluesModal);
  }

  if (modalWrongCluesEl) {
    modalWrongCluesEl.addEventListener('click', (e) => {
      if (e.target === modalWrongCluesEl) {
        closeWrongCluesModal();
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalWrongCluesEl && modalWrongCluesEl.style.display === 'flex') {
        closeWrongCluesModal();
      }
      if (modalClueEl && modalClueEl.style.display === 'flex') {
        closeClueModal();
      }
    }
  });

  if (btnSubmitCluesEl) {
    btnSubmitCluesEl.addEventListener('click', () => {
      if (selectedClues.size === 6) {
        submitCluesHandler();
      } else {
        App.showAlert('alert-box', `Please select 6 clues to advance (currently selected: ${selectedClues.size}).`, 'alert-danger');
      }
    });
  }

  // Bookmark / Unbookmark Clue
  const toggleMarkClue = (clueId, cardEl, starBtnEl) => {
    if (markedClues.has(clueId)) {
      markedClues.delete(clueId);
      if (cardEl) cardEl.classList.remove('marked');
      if (starBtnEl) starBtnEl.textContent = '☆';
      if (modalBtnMarkEl && activeModalClueIndex !== null && currentClues[activeModalClueIndex].clueId === clueId) {
        modalBtnMarkEl.textContent = 'MARK AS KEY';
      }
    } else {
      markedClues.add(clueId);
      if (cardEl) cardEl.classList.add('marked');
      if (starBtnEl) starBtnEl.textContent = '★';
      if (modalBtnMarkEl && activeModalClueIndex !== null && currentClues[activeModalClueIndex].clueId === clueId) {
        modalBtnMarkEl.textContent = 'UNMARK KEY';
      }
    }
  };

  // Open Clue Modal
  const openClueModal = (index) => {
    activeModalClueIndex = index;
    const clue = currentClues[index];
    if (!clue) return;

    const labelNum = (index + 1).toString().padStart(2, '0');
    modalClueLabelEl.textContent = `CLUE ${labelNum}`;
    modalClueTextEl.textContent = clue.text;

    if (clue.imageUrl) {
      modalClueImgEl.src = clue.imageUrl;
      modalClueImgEl.style.display = 'block';
    } else {
      modalClueImgEl.style.display = 'none';
    }

    modalClueNotesEl.value = clueNotes[clue.clueId] || '';

    const isMarked = markedClues.has(clue.clueId);
    modalBtnMarkEl.textContent = isMarked ? 'UNMARK KEY' : 'MARK AS KEY';

    modalClueEl.classList.add('active');

    // Record clue view telemetry on server
    fetch(`/api/game/${sessionId}/clue-view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clueId: clue.clueId })
    }).catch(err => console.warn('Clue telemetry log failed:', err));
  };

  window.closeClueModal = () => {
    if (activeModalClueIndex !== null && currentClues[activeModalClueIndex]) {
      const clue = currentClues[activeModalClueIndex];
      clueNotes[clue.clueId] = modalClueNotesEl.value;
    }
    modalClueEl.classList.remove('active');
    activeModalClueIndex = null;
  };

  // Modal bookmark toggle button
  modalBtnMarkEl.addEventListener('click', () => {
    if (activeModalClueIndex !== null && currentClues[activeModalClueIndex]) {
      const clue = currentClues[activeModalClueIndex];
      toggleMarkClue(clue.clueId, null, null);
      renderCluesGrid(currentClues);
    }
  });

  // Render Trap Mode
  const renderTrapMode = (trap) => {
    normalContainerEl.style.display = 'none';
    trapContainerEl.style.display = 'block';
    trapBannerEl.style.display = 'block';
    gameWindowEl.classList.add('trap-active');

    trapStageHeaderEl.textContent = `TRAP: ${trap.trapId}`;
    trapTitleEl.textContent = trap.name.toUpperCase();
    trapPromptEl.textContent = `${trap.description}\n\nCHALLENGE: ${trap.question}`;
    trapInputEl.value = '';
  };





  // Handle Direct Passkey & Answer Submission
  passkeyFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('alert-box');

    const passkey = passkeyInputEl.value.trim();

    // If input is empty but 6 clues are selected, advance with clues
    if (!passkey && selectedClues.size === 6) {
      submitCluesHandler();
      return;
    }

    if (!passkey) {
      App.showAlert('alert-box', 'Enter code output / passkey below, or select 6 clues above to advance.', 'alert-danger');
      return;
    }

    passkeyInputEl.disabled = true;
    btnSubmitPasskey.disabled = true;
    const prevBtnHtml = btnSubmitPasskey.innerHTML;
    btnSubmitPasskey.innerHTML = '<span class="btn-icon">⏳</span> VERIFYING...';

    try {
      // First attempt passkey bypass endpoint
      const response = await fetch(`/api/game/${sessionId}/passkey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        App.showAlert('alert-box', data.message || '✓ DIRECT ACCESS GRANTED\n\nBYPASSING CLUE ANALYSIS...', 'alert-success');
        passkeyInputEl.disabled = false;
        btnSubmitPasskey.disabled = false;
        btnSubmitPasskey.innerHTML = prevBtnHtml;

        if (data.completed || data.escaped) {
          setTimeout(() => {
            window.location.href = '/result.html';
          }, 1200);
        } else {
          setTimeout(() => {
            App.hideAlert('alert-box');
            loadGameState();
          }, 1000);
        }
      } else {
        // Fallback: check regular answer endpoint
        const ansResp = await fetch(`/api/game/${sessionId}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answer: passkey })
        });
        const ansData = await ansResp.json();

        if (ansResp.ok && ansData.success) {
          App.showAlert('alert-box', ansData.message || '✓ ACCESS KEY VERIFIED\n✓ PUZZLE SOLVED', 'alert-success');
          passkeyInputEl.disabled = false;
          btnSubmitPasskey.disabled = false;
          btnSubmitPasskey.innerHTML = prevBtnHtml;

          if (ansData.completed || ansData.escaped) {
            setTimeout(() => { window.location.href = '/result.html'; }, 1200);
          } else {
            setTimeout(() => { App.hideAlert('alert-box'); loadGameState(); }, 1000);
          }
        } else {
          App.showAlert('alert-box', ansData.message || data.message || '✗ INCORRECT ANSWER OR PASSKEY', 'alert-danger');
          setTimeout(() => {
            passkeyInputEl.disabled = false;
            btnSubmitPasskey.disabled = false;
            btnSubmitPasskey.innerHTML = prevBtnHtml;
          }, 1400);
        }
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Network error submitting direct passkey.', 'alert-danger');
      passkeyInputEl.disabled = false;
      btnSubmitPasskey.disabled = false;
      btnSubmitPasskey.innerHTML = prevBtnHtml;
    }
  });

  // Handle Trap Bypass Submission
  trapFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('alert-box');

    const answer = trapInputEl.value.trim();
    if (!answer) return;

    trapInputEl.disabled = true;
    btnSubmitTrap.disabled = true;

    try {
      const response = await fetch(`/api/game/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });

      const data = await response.json();

      if (response.ok) {
        App.showAlert('alert-box', data.message || '✓ Trap disarmed! Route cleared.', 'alert-success');
        setTimeout(() => {
          trapInputEl.disabled = false;
          btnSubmitTrap.disabled = false;
          App.hideAlert('alert-box');
          loadGameState();
        }, 1200);
      } else {
        App.showAlert('alert-box', data.message || '✗ Incorrect bypass code.', 'alert-danger');
        setTimeout(() => {
          trapInputEl.disabled = false;
          btnSubmitTrap.disabled = false;
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Failed to submit trap disarm code.', 'alert-danger');
      trapInputEl.disabled = false;
      btnSubmitTrap.disabled = false;
    }
  });

  // Render Progress Tracker Dots
  const renderProgress = (solved) => {
    if (!progressTrackerEl) return;
    progressTrackerEl.innerHTML = '';
    const totalStages = 3;
    for (let i = 0; i < totalStages; i++) {
      const node = document.createElement('div');
      node.className = 'tracker-node';
      if (i < solved) {
        node.classList.add('completed');
      } else if (i === solved) {
        node.classList.add('active');
      }
      progressTrackerEl.appendChild(node);
    }
  };

  // Countdown Timer
  const startLocalTimer = () => {
    if (timerInterval) clearInterval(timerInterval);

    timerDisplayEl.textContent = App.formatTime(remainingSeconds);

    timerInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds <= 0) {
        clearInterval(timerInterval);
        timerDisplayEl.textContent = '00:00';
        timerDisplayEl.classList.add('danger');
        loadGameState();
      } else {
        timerDisplayEl.textContent = App.formatTime(remainingSeconds);
        if (remainingSeconds < 120) {
          timerDisplayEl.classList.add('danger');
        } else {
          timerDisplayEl.classList.remove('danger');
        }
      }
    }, 1000);
  };

  // Simple HTML Escaper
  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Initial Load
  loadGameState();
});
