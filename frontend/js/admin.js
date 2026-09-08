document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }

  // Common Headers
  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  });

  // Global modals helper
  window.openModal = (modalId) => {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  };

  window.closeModal = (modalId) => {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  };

  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    }
  });

  // ==========================================
  // VIEW ROUTING / TAB SWAPPING
  // ==========================================
  const sidebarItems = document.querySelectorAll('.sidebar-item');
  const sections = document.querySelectorAll('.dashboard-section');

  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSectionId = item.getAttribute('data-target');

      sidebarItems.forEach(i => i.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));

      item.classList.add('active');
      const targetEl = document.getElementById(targetSectionId);
      if (targetEl) targetEl.classList.add('active');

      loadSectionData(targetSectionId);
    });
  });

  const loadSectionData = (sectionId) => {
    App.hideAlert('dashboard-alert');
    switch (sectionId) {
      case 'section-dashboard':
        loadDashboardStats();
        break;
      case 'section-active-questions':
        loadActiveQuestionsConfig();
        break;
      case 'section-pc':
        loadPCAssignments();
        break;
      case 'section-timer':
        loadTimerSettings();
        break;
      case 'section-sets':
        loadQuestionSets();
        break;
      case 'section-questions':
        loadQuestions();
        break;
      case 'section-students':
        loadStudents();
        break;
      case 'section-results':
        loadWinnerRankings();
        break;
      case 'section-settings':
        loadSystemSettings();
        break;
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================
  document.getElementById('btn-admin-logout').addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
  });

  // ==========================================
  // SECTION: DASHBOARD STATS & LIVE OPERATORS (1s REAL-TIME AUTO-SYNC)
  // ==========================================
  let isSyncingLive = false;
  let statsSyncCounter = 0;

  const loadDashboardStats = async () => {
    // Only proceed if dashboard section is active or modal is open
    const isDashboardActive = document.getElementById('section-dashboard')?.classList.contains('active');
    const isModalOpen = document.getElementById('modal-pc-intel')?.classList.contains('active');
    if (!isDashboardActive && !isModalOpen) return;

    if (isSyncingLive) return;
    isSyncingLive = true;

    try {
      // Sync top stat counters every 3 seconds to save bandwidth
      statsSyncCounter++;
      if (statsSyncCounter % 3 === 1) {
        fetch('/api/admin/stats', { headers: getHeaders() })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.stats) {
              const { stats } = data;
              if (document.getElementById('stat-total-students')) document.getElementById('stat-total-students').textContent = stats.totalStudents || 0;
              if (document.getElementById('stat-active-games')) document.getElementById('stat-active-games').textContent = stats.activeGames || 0;
              if (document.getElementById('stat-completed-games')) document.getElementById('stat-completed-games').textContent = stats.completedGames || 0;
              if (document.getElementById('stat-gameover-games')) document.getElementById('stat-gameover-games').textContent = stats.gameOverGames || 0;
              if (document.getElementById('stat-fastest-time')) document.getElementById('stat-fastest-time').textContent = stats.fastestCompletionTime || '--:--';
              if (document.getElementById('stat-total-questions')) document.getElementById('stat-total-questions').textContent = stats.totalQuestions || 0;
              if (document.getElementById('stat-questions-solved')) document.getElementById('stat-questions-solved').textContent = stats.totalQuestionsSolved || 0;
              if (document.getElementById('stat-passkey-bypasses')) document.getElementById('stat-passkey-bypasses').textContent = stats.totalPasskeysUsed || 0;
            }
          }).catch(e => console.error(e));
      }

      // Load live active operator sessions table EVERY SECOND (Tej Second Real-Time)
      const resSessions = await fetch('/api/admin/live-sessions', { headers: getHeaders() });
      const dataSessions = await resSessions.json();
      if (dataSessions.success) {
        window._liveSessionsData = dataSessions.sessions || [];
        const tbody = document.getElementById('live-sessions-body');
        tbody.innerHTML = '';

        if (!dataSessions.sessions || dataSessions.sessions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: var(--text-dark);">No active operator sessions found.</td></tr>';
          return;
        }

        dataSessions.sessions.forEach(s => {
          const row = document.createElement('tr');
          const isWin = s.status === 'COMPLETED';
          const isOver = s.status === 'GAME_OVER';
          const q = s.activeQuestionInfo;
          const t = s.activeTrapInfo;

          // Format remaining timer mm:ss
          const remSec = Math.max(0, s.remainingSeconds || 0);
          const m = Math.floor(remSec / 60);
          const sec = remSec % 60;
          const timerStr = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

          // Active Challenge / Question Column
          let challengeHtml = '';
          if (t) {
            challengeHtml = `
              <div style="font-size: 0.85rem;">
                <span class="badge badge-red" style="font-size: 0.72rem; padding: 0.15rem 0.4rem;">⚠️ TRAP</span>
                <div style="color: #fbbf24; font-weight: 700; font-family: var(--font-mono); margin-top: 0.2rem;">${escapeHtml(t.name)}</div>
              </div>
            `;
          } else if (q) {
            challengeHtml = `
              <div style="font-size: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.2rem;">
                  ${s.stageProgress ? `<span style="background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.35); border-radius: 4px; padding: 0.1rem 0.35rem; font-size: 0.72rem; font-family: var(--font-mono); font-weight: 800;">STAGE ${escapeHtml(s.stageProgress)}</span>` : ''}
                  <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 0.1rem 0.35rem; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 0.78rem; font-family: var(--font-mono); font-weight: 800;">${escapeHtml(q.questionId)}</span>
                  <span style="color: #f8fafc; font-weight: 700;">${escapeHtml(q.title || '')}</span>
                </div>
                <div style="color: #94a3b8; font-size: 0.75rem; margin-top: 0.2rem; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(q.promptText || '')}">
                  ${escapeHtml(q.promptText || '')}
                </div>
              </div>
            `;
          } else if (s.currentQuestion === 'WIN' || s.currentQuestion === 'EXIT') {
            challengeHtml = `<span style="color: #00ff88; font-weight: 800; font-family: var(--font-mono); font-size: 0.85rem;">🏆 VAULT CLEARED</span>`;
          } else {
            challengeHtml = `<span style="font-family: var(--font-mono); color: #fbbf24; font-weight: 800;">${escapeHtml(s.currentQuestion || 'N/A')}</span>`;
          }

          // Direct Passkey Column
          let passkeyHtml = '';
          if (q && (q.directPasskey || q.answerKey)) {
            const pKey = q.directPasskey || q.answerKey;
            passkeyHtml = `
              <div style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(0, 240, 255, 0.1); border: 1px solid rgba(0, 240, 255, 0.35); padding: 0.25rem 0.55rem; border-radius: 6px;">
                <span style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 900; color: #00f0ff;">${escapeHtml(pKey)}</span>
                <button type="button" class="btn-copy-inline" data-copy="${escapeHtml(pKey)}" title="Click to copy passkey" style="background: none; border: none; color: #38bdf8; cursor: pointer; padding: 0; font-size: 0.85rem;">📋</button>
              </div>
            `;
          } else if (t && t.answer) {
            passkeyHtml = `
              <div style="display: inline-flex; align-items: center; gap: 0.35rem; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); padding: 0.25rem 0.55rem; border-radius: 6px;">
                <span style="font-family: var(--font-mono); font-size: 0.82rem; font-weight: 800; color: #fbbf24;">${escapeHtml(t.answer)}</span>
                <button type="button" class="btn-copy-inline" data-copy="${escapeHtml(t.answer)}" title="Click to copy answer" style="background: none; border: none; color: #fbbf24; cursor: pointer; padding: 0; font-size: 0.85rem;">📋</button>
              </div>
            `;
          } else {
            passkeyHtml = `<span style="color: var(--text-dark); font-size: 0.8rem;">--</span>`;
          }

          // Live Clue Status & Sir Hint Helper Column
          let clueHintHtml = '';
          if (isWin) {
            passkeyHtml = `<span class="badge badge-green" style="font-size: 0.76rem;">VAULT CLEARED</span>`;
            clueHintHtml = `
              <div style="font-size: 0.82rem; color: #34d399; font-weight: 700;">
                🏆 ALL CHALLENGES COMPLETED
              </div>
            `;
          } else {
            const trueNumsStr = (q && q.trueScreenNumbers && q.trueScreenNumbers.length > 0)
              ? q.trueScreenNumbers.map(n => String(n).padStart(2, '0')).join(', ')
              : null;
            
            if (s.latestClueAttempt && s.latestClueAttempt.questionId === s.currentQuestion) {
              const c = s.latestClueAttempt;
              const correctStr = (c.correctNumbers && c.correctNumbers.length > 0)
                ? c.correctNumbers.map(n => String(n).padStart(2, '0')).join(', ')
                : 'None';
              const wrongStr = (c.incorrectNumbers && c.incorrectNumbers.length > 0)
                ? c.incorrectNumbers.map(n => String(n).padStart(2, '0')).join(', ')
                : 'None';

              clueHintHtml = `
                <div style="font-size: 0.82rem; line-height: 1.35;">
                  ${trueNumsStr ? `
                    <div style="margin-bottom: 0.35rem; padding: 0.25rem 0.55rem; background: rgba(0, 255, 136, 0.12); border: 1px solid rgba(0, 255, 136, 0.4); border-radius: 5px;">
                      <span style="font-family: var(--font-heading); font-size: 0.72rem; color: #a7f3d0; font-weight: 700;">🎯 6 TRUE CLUES: </span>
                      <strong style="font-family: var(--font-mono); color: #00ff88; font-size: 0.92rem; letter-spacing: 0.05em;">[${trueNumsStr}]</strong>
                    </div>
                  ` : ''}
                  <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.25rem; flex-wrap: wrap;">
                    <span style="color: #00ff88; font-weight: 800; font-family: var(--font-mono); background: rgba(0, 255, 136, 0.12); padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(0, 255, 136, 0.3);">
                      🟢 ${c.correctCount || 0} / 6 Correct
                    </span>
                    <span style="color: #ff0055; font-weight: 800; font-family: var(--font-mono); background: rgba(255, 0, 85, 0.12); padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(255, 0, 85, 0.3);">
                      🔴 ${c.incorrectCount || 0} / 6 Wrong
                    </span>
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.76rem; color: #cbd5e1;">
                    <span style="color: #6ee7b7;">Chosen True: [${correctStr}]</span> | <span style="color: #fda4af;">Chosen False: [${wrongStr}]</span>
                  </div>
                  <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 5px; padding: 0.25rem 0.5rem; margin-top: 0.25rem; color: #fbbf24; font-size: 0.76rem;">
                    💡 <strong>Sir Hint:</strong> ${c.incorrectCount > 0 ? `Clue <strong>#${wrongStr}</strong> is false! Tell student to re-check.` : `<strong style="color: #34d399;">All 6 clues are TRUE!</strong>`}
                  </div>
                </div>
              `;
            } else {
              clueHintHtml = `
                <div style="font-size: 0.82rem;">
                  ${trueNumsStr ? `
                    <div style="margin-bottom: 0.3rem; padding: 0.3rem 0.6rem; background: rgba(0, 255, 136, 0.12); border: 1px solid rgba(0, 255, 136, 0.4); border-radius: 5px;">
                      <span style="font-family: var(--font-heading); font-size: 0.72rem; color: #a7f3d0; font-weight: 700;">🎯 6 TRUE CLUES: </span>
                      <strong style="font-family: var(--font-mono); color: #00ff88; font-size: 0.95rem; letter-spacing: 0.05em;">[${trueNumsStr}]</strong>
                    </div>
                  ` : ''}
                  <span style="color: var(--text-dark); font-style: italic; font-size: 0.76rem;">No clues submitted yet</span>
                </div>
              `;
            }
          }

          let statusBadge = '<span class="badge badge-green">ACTIVE</span>';
          if (isWin) statusBadge = '<span class="badge" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #3b82f6;">SOLVED</span>';
          else if (isOver) statusBadge = '<span class="badge badge-red">GAME OVER</span>';

          row.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: 800; font-size: 1.05rem;">
              <span class="badge badge-cyan" style="font-size: 0.95rem; font-weight: 800; padding: 0.25rem 0.6rem;">${escapeHtml(s.pcId || 'N/A')}</span>
            </td>
            <td>
              <div style="font-weight: 700; color: #f8fafc;">${escapeHtml(s.studentName)}</div>
              <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dark);">${escapeHtml(s.enrollmentNumber)}</div>
              ${s.department ? `<div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(s.department)}</div>` : ''}
            </td>
            <td style="font-family: var(--font-mono); font-weight: 700; text-align: center;">Set ${escapeHtml(s.questionSet)}</td>
            <td>${challengeHtml}</td>
            <td>${passkeyHtml}</td>
            <td>${clueHintHtml}</td>
            <td style="font-family: var(--font-mono); color: var(--accent-green); font-weight: 800; text-align: center;">${s.questionsSolved || 0}</td>
            <td style="font-family: var(--font-mono); color: ${remSec < 300 ? '#ff0055' : 'var(--text-primary)'}; font-weight: 800;">${timerStr}</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center;">
              <button type="button" class="btn-cyber btn-cyber-cyan btn-open-intel" data-session-id="${s.sessionId}" style="font-size: 0.74rem; padding: 0.35rem 0.65rem; white-space: nowrap; font-weight: 800; cursor: pointer;">
                🔍 SIR INTEL
              </button>
            </td>
          `;
          tbody.appendChild(row);
        });

        // Re-sync open modal if active
        const openModalEl = document.getElementById('modal-pc-intel');
        if (openModalEl && openModalEl.classList.contains('active') && window._activeIntelSessionId) {
          const activeS = dataSessions.sessions.find(x => x.sessionId === window._activeIntelSessionId);
          if (activeS) {
            renderPcIntelModal(activeS);
          }
        }
      }
    } catch (err) {
      console.error('loadDashboardStats error:', err);
    } finally {
      isSyncingLive = false;
    }
  };

  // Render comprehensive PC Intel & Sir's Hint Guide Modal
  const renderPcIntelModal = (s) => {
    if (!s) return;
    window._activeIntelSessionId = s.sessionId;
    const q = s.activeQuestionInfo;
    const t = s.activeTrapInfo;
    const c = s.latestClueAttempt;

    document.getElementById('intel-pc-badge').textContent = s.pcId || 'PC-??';
    document.getElementById('intel-operator-meta').innerHTML = `
      <strong>Operator:</strong> <span style="color: #f8fafc;">${escapeHtml(s.studentName)}</span> | 
      <strong>Enrollment:</strong> ${escapeHtml(s.enrollmentNumber)} | 
      <strong>Dept:</strong> ${escapeHtml(s.department || 'N/A')} | 
      <strong>Assigned Set:</strong> Set ${escapeHtml(s.questionSet || 'A')}
    `;

    // Status and Timer
    const remSec = Math.max(0, s.remainingSeconds || 0);
    const m = Math.floor(remSec / 60);
    const sec = remSec % 60;
    const timerStr = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    
    document.getElementById('intel-status-container').innerHTML = `
      <span class="badge ${s.status === 'ACTIVE' ? 'badge-green' : (s.status === 'COMPLETED' ? 'badge-cyan' : 'badge-red')}" style="font-size: 0.85rem; padding: 0.3rem 0.7rem;">
        ${s.status}
      </span>
      <span style="font-family: var(--font-mono); font-weight: 800; color: ${remSec < 300 ? '#ff0055' : '#00ff88'}; font-size: 1rem; background: rgba(0,0,0,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; border: 1px solid #334155;">
        ⏱️ ${timerStr}
      </span>
    `;

    // Live Clue Attempt Banner (Only for active question)
    const attemptBanner = document.getElementById('intel-attempt-banner');
    if (c && c.questionId === s.currentQuestion) {
      const correctStr = (c.correctNumbers && c.correctNumbers.length > 0)
        ? c.correctNumbers.map(n => String(n).padStart(2, '0')).join(', ')
        : 'None';
      const wrongStr = (c.incorrectNumbers && c.incorrectNumbers.length > 0)
        ? c.incorrectNumbers.map(n => String(n).padStart(2, '0')).join(', ')
        : 'None';
      
      attemptBanner.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.8rem; margin-bottom: 0.5rem;">
          <span style="font-family: var(--font-heading); font-size: 0.9rem; color: #f8fafc; font-weight: 800;">
            📊 OPERATOR'S RECENT CLUE SUBMISSION TELEMETRY:
          </span>
          <div style="display: flex; gap: 0.6rem;">
            <span style="background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.4); border-radius: 4px; padding: 0.2rem 0.6rem; font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem;">
              🟢 ${c.correctCount || 0} / 6 TRUE CLUES
            </span>
            <span style="background: rgba(255, 0, 85, 0.15); color: #ff0055; border: 1px solid rgba(255, 0, 85, 0.4); border-radius: 4px; padding: 0.2rem 0.6rem; font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem;">
              🔴 ${c.incorrectCount || 0} / 6 FALSE CLUES
            </span>
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.82rem; color: #cbd5e1; margin-bottom: 0.5rem;">
          <span style="color: #6ee7b7;">Correct Clue Numbers: [${correctStr}]</span> &nbsp;|&nbsp; 
          <span style="color: #fda4af;">Misleading Clue Numbers: [${wrongStr}]</span>
        </div>
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 6px; padding: 0.45rem 0.8rem; color: #fbbf24; font-size: 0.82rem;">
          💡 <strong>Sir's Real-time Guidance:</strong> ${c.incorrectCount > 0 ? `Operator selected misleading clue(s) <strong>#${wrongStr}</strong>. Guide the operator to uncheck them and focus on the TRUE clues below.` : `<strong style="color: #34d399;">Operator correctly chose all 6 TRUE clues! Stage advancing.</strong>`}
        </div>
      `;
      attemptBanner.style.display = 'block';
    } else {
      attemptBanner.innerHTML = `
        <div style="color: #94a3b8; font-style: italic; font-size: 0.85rem;">
          ⚡ Operator has not submitted any clue selection on this stage yet. All 6 good clues & passkeys are displayed below for your reference.
        </div>
      `;
      attemptBanner.style.display = 'block';
    }

    // Render PC Roadmap Sequence
    const seq = Array.isArray(s.questionSequence) ? s.questionSequence : [];
    const seqPillsEl = document.getElementById('intel-sequence-pills');
    const seqProgEl = document.getElementById('intel-sequence-progress');
    if (seqPillsEl) {
      if (seq.length > 0) {
        if (seqProgEl) seqProgEl.textContent = `Stage ${s.currentStage || 1} / ${seq.length}`;
        seqPillsEl.innerHTML = seq.map((qId, idx) => {
          const isCurrent = qId === s.currentQuestion;
          const isPassed = (s.currentStage || 1) > (idx + 1) || (s.status === 'COMPLETED');
          let pillStyle = 'padding: 0.25rem 0.65rem; border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;';
          if (isCurrent) {
            pillStyle += ' background: rgba(0, 240, 255, 0.25); color: #00f0ff; border: 1.5px solid #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);';
          } else if (isPassed) {
            pillStyle += ' background: rgba(0, 255, 136, 0.15); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.4);';
          } else {
            pillStyle += ' background: rgba(51, 65, 85, 0.5); color: #94a3b8; border: 1px solid #334155;';
          }
          const icon = isCurrent ? '▶ ACTIVE:' : (isPassed ? '✓' : `${idx + 1}.`);
          return `<span style="${pillStyle}">${icon} ${escapeHtml(qId)}</span>`;
        }).join('<span style="color: #64748b; font-size: 0.8rem;">➔</span>');
      } else {
        if (seqProgEl) seqProgEl.textContent = 'All 10 Stages';
        seqPillsEl.innerHTML = '<span style="color: #64748b; font-style: italic; font-size: 0.82rem;">Standard 10-Vault Linear Progression</span>';
      }
    }

    // If active Trap
    if (t) {
      document.getElementById('intel-q-id').textContent = `⚠️ TRAP NODE: ${t.trapId}`;
      document.getElementById('intel-q-category').textContent = 'TRAP LOCKOUT';
      document.getElementById('intel-q-title').textContent = t.name;
      document.getElementById('intel-q-prompt').textContent = t.question || t.description;
      document.getElementById('intel-q-code').style.display = 'none';

      document.getElementById('intel-passkey-val').textContent = t.answer;
      document.getElementById('intel-answer-val').textContent = t.answer;

      document.getElementById('intel-good-clues-list').innerHTML = `
        <div style="padding: 1rem; background: rgba(245, 158, 11, 0.1); border: 1px solid #f59e0b; border-radius: 6px; color: #fbbf24;">
          This terminal fell into a trap! Escape Answer: <strong>${escapeHtml(t.answer)}</strong>
        </div>
      `;
      document.getElementById('intel-bad-clues-list').innerHTML = `<div style="color: #64748b; font-style: italic;">No clue choices in trap mode.</div>`;
      return;
    }

    // Normal Question
    if (q) {
      document.getElementById('intel-q-id').textContent = `CHALLENGE: ${q.questionId} [SET ${s.questionSet}]`;
      document.getElementById('intel-q-category').textContent = q.category || 'General';
      document.getElementById('intel-q-title').textContent = q.title || `STAGE ${q.questionId}`;
      document.getElementById('intel-q-prompt').textContent = q.promptText || '';

      const codeEl = document.getElementById('intel-q-code');
      if (q.code && q.code.trim()) {
        codeEl.textContent = q.code;
        codeEl.style.display = 'block';
      } else {
        codeEl.style.display = 'none';
      }

      // Passkey & Answer Key
      document.getElementById('intel-passkey-val').textContent = q.directPasskey || q.answerKey || 'N/A';
      document.getElementById('intel-answer-val').textContent = q.answerKey || q.directPasskey || 'N/A';

      // Hook up copy buttons
      document.getElementById('btn-copy-passkey').onclick = () => {
        navigator.clipboard.writeText(q.directPasskey || q.answerKey || '');
        const btn = document.getElementById('btn-copy-passkey');
        btn.textContent = '✓ COPIED!';
        setTimeout(() => { btn.textContent = '📋 COPY PASSKEY'; }, 1500);
      };

      document.getElementById('btn-copy-answer').onclick = () => {
        navigator.clipboard.writeText(q.answerKey || q.directPasskey || '');
        const btn = document.getElementById('btn-copy-answer');
        btn.textContent = '✓ COPIED!';
        setTimeout(() => { btn.textContent = '📋 COPY ANSWER'; }, 1500);
      };

      // Render 6 Good Clues (True Clues) with EXACT operator screen numbers (1 to 12)
      const goodList = document.getElementById('intel-good-clues-list');
      goodList.innerHTML = '';
      if (q.goodClues && q.goodClues.length > 0) {
        // Summary banner showing all 6 True numbers on student terminal
        const trueNums = q.trueScreenNumbers && q.trueScreenNumbers.length > 0
          ? q.trueScreenNumbers.map(n => String(n).padStart(2, '0')).join(', ')
          : q.goodClues.map(g => String(g.screenNumber || '').padStart(2, '0')).filter(Boolean).join(', ');

        const banner = document.createElement('div');
        banner.style.cssText = 'background: rgba(0, 255, 136, 0.15); border: 1.5px solid #00ff88; border-radius: 8px; padding: 0.8rem 1.2rem; margin-bottom: 0.8rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem;';
        banner.innerHTML = `
          <div>
            <div style="font-family: var(--font-heading); font-size: 0.82rem; color: #6ee7b7; font-weight: 800; letter-spacing: 0.05em;">
              🎯 OPERATOR SCREEN TRUE CLUE NUMBERS:
            </div>
            <div style="font-family: var(--font-mono); font-size: 1.45rem; font-weight: 900; color: #00ff88; margin-top: 0.2rem; letter-spacing: 0.08em;">
              [ ${trueNums || 'None'} ]
            </div>
          </div>
          <button type="button" class="btn-cyber btn-cyber-green" id="btn-copy-true-numbers" style="font-size: 0.76rem; padding: 0.4rem 0.85rem; font-weight: 800;">
            📋 COPY TRUE NUMBERS
          </button>
        `;
        goodList.appendChild(banner);

        setTimeout(() => {
          const btnCopy = document.getElementById('btn-copy-true-numbers');
          if (btnCopy) {
            btnCopy.onclick = () => {
              navigator.clipboard.writeText(trueNums);
              btnCopy.textContent = '✓ COPIED!';
              setTimeout(() => { btnCopy.textContent = '📋 COPY TRUE NUMBERS'; }, 1500);
            };
          }
        }, 100);

        q.goodClues.forEach((gc, idx) => {
          const numDisplay = gc.screenNumber ? String(gc.screenNumber).padStart(2, '0') : String(idx + 1).padStart(2, '0');
          const item = document.createElement('div');
          item.style.cssText = 'background: rgba(0, 255, 136, 0.08); border: 1.5px solid rgba(0, 255, 136, 0.35); border-radius: 6px; padding: 0.75rem 1rem; display: flex; align-items: flex-start; gap: 0.8rem;';
          item.innerHTML = `
            <span style="background: #00ff88; color: #020617; font-weight: 900; font-family: var(--font-mono); font-size: 0.88rem; padding: 0.25rem 0.65rem; border-radius: 5px; flex-shrink: 0; box-shadow: 0 0 10px rgba(0, 255, 136, 0.35);">
              CLUE #${numDisplay} (TRUE)
            </span>
            <div style="flex: 1;">
              <div style="color: #f1f5f9; font-size: 0.92rem; line-height: 1.45; font-weight: 600;">
                ${escapeHtml(gc.text)}
              </div>
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #6ee7b7;">ID: ${escapeHtml(gc.clueId || '')}</span>
            </div>
          `;
          goodList.appendChild(item);
        });
      } else {
        goodList.innerHTML = '<div style="color: #94a3b8; font-style: italic;">No good clues defined for this stage.</div>';
      }

      // Render 6 Misleading Clues (Traps) with EXACT operator screen numbers
      const badList = document.getElementById('intel-bad-clues-list');
      badList.innerHTML = '';
      if (q.badClues && q.badClues.length > 0) {
        const falseNums = q.falseScreenNumbers && q.falseScreenNumbers.length > 0
          ? q.falseScreenNumbers.map(n => String(n).padStart(2, '0')).join(', ')
          : q.badClues.map(b => String(b.screenNumber || '').padStart(2, '0')).filter(Boolean).join(', ');

        const falseBanner = document.createElement('div');
        falseBanner.style.cssText = 'background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 6px; padding: 0.5rem 1rem; margin-bottom: 0.8rem; font-family: var(--font-mono); font-size: 0.85rem; color: #fda4af;';
        falseBanner.innerHTML = `❌ OPERATOR SCREEN FALSE NUMBERS: [ <strong>${falseNums || 'None'}</strong> ]`;
        badList.appendChild(falseBanner);

        q.badClues.forEach((bc, idx) => {
          const numDisplay = bc.screenNumber ? String(bc.screenNumber).padStart(2, '0') : String(idx + 1).padStart(2, '0');
          const item = document.createElement('div');
          item.style.cssText = 'background: rgba(244, 63, 94, 0.06); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 6px; padding: 0.65rem 1rem; display: flex; align-items: flex-start; gap: 0.8rem;';
          item.innerHTML = `
            <span style="background: #f43f5e; color: #ffffff; font-weight: 800; font-family: var(--font-mono); font-size: 0.82rem; padding: 0.22rem 0.55rem; border-radius: 4px; flex-shrink: 0;">
              CLUE #${numDisplay} (FALSE)
            </span>
            <div style="flex: 1;">
              <div style="color: #cbd5e1; font-size: 0.86rem; line-height: 1.4;">
                ${escapeHtml(bc.text)}
              </div>
              <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #fda4af;">ID: ${escapeHtml(bc.clueId || '')}</span>
            </div>
          `;
          badList.appendChild(item);
        });
      } else {
        badList.innerHTML = '<div style="color: #94a3b8; font-style: italic;">No misleading clues defined.</div>';
      }
    } else if (s.currentQuestion === 'WIN' || s.currentQuestion === 'EXIT') {
      document.getElementById('intel-q-id').textContent = 'MASTER VAULT ESCAPE';
      document.getElementById('intel-q-category').textContent = 'VICTORY';
      document.getElementById('intel-q-title').textContent = 'OPERATOR ESCAPED';
      document.getElementById('intel-q-prompt').textContent = 'This operator has successfully completed all stages and bypassed the final security perimeter!';
      document.getElementById('intel-q-code').style.display = 'none';
      document.getElementById('intel-passkey-val').textContent = 'ESCAPE COMPLETED';
      document.getElementById('intel-answer-val').textContent = 'VICTORY';
      document.getElementById('intel-good-clues-list').innerHTML = '<div style="color: #34d399; font-weight: 700;">All stages cleared!</div>';
      document.getElementById('intel-bad-clues-list').innerHTML = '<div style="color: #94a3b8;">None</div>';
    } else {
      document.getElementById('intel-q-id').textContent = s.currentQuestion || 'N/A';
      document.getElementById('intel-q-category').textContent = 'UNKNOWN';
      document.getElementById('intel-q-title').textContent = `Question ${s.currentQuestion || 'N/A'}`;
      document.getElementById('intel-q-prompt').textContent = 'No question data found for this stage identifier.';
      document.getElementById('intel-q-code').style.display = 'none';
      document.getElementById('intel-passkey-val').textContent = '--';
      document.getElementById('intel-answer-val').textContent = '--';
      document.getElementById('intel-good-clues-list').innerHTML = '<div style="color: #94a3b8;">No data</div>';
      document.getElementById('intel-bad-clues-list').innerHTML = '<div style="color: #94a3b8;">No data</div>';
    }
  };

  // Event delegation for live terminal actions (SIR INTEL & inline copy)
  document.getElementById('live-sessions-body').addEventListener('click', (e) => {
    const intelBtn = e.target.closest('.btn-open-intel');
    if (intelBtn) {
      const sessId = intelBtn.getAttribute('data-session-id');
      if (window._liveSessionsData) {
        const s = window._liveSessionsData.find(x => x.sessionId === sessId);
        if (s) {
          renderPcIntelModal(s);
          openModal('modal-pc-intel');
        }
      }
      return;
    }

    const copyBtn = e.target.closest('.btn-copy-inline');
    if (copyBtn) {
      const textToCopy = copyBtn.getAttribute('data-copy');
      if (textToCopy) {
        navigator.clipboard.writeText(textToCopy);
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = originalText; }, 1200);
      }
    }
  });

  // ==========================================
  // SECTION: PC IDENTIFICATION ASSIGNMENTS
  // ==========================================
  const loadPCAssignments = async () => {
    try {
      const response = await fetch('/api/admin/pc-assignment', { headers: getHeaders() });
      const data = await response.json();

      if (data.success) {
        const grid = document.getElementById('pc-assignment-grid');
        grid.innerHTML = '';

        data.assignments.forEach(pc => {
          const card = document.createElement('div');
          card.className = 'pc-card';
          card.innerHTML = `
            <div class="pc-title">${pc.pcId}</div>
            <div style="margin-bottom: 1.2rem;">
              <span style="color: var(--text-dark); font-size: 0.85rem;">ASSIGNED SET: </span>
              <span style="font-family: var(--font-mono); font-size: 1.2rem; font-weight: bold; color: var(--accent-cyan);">Set ${pc.assignedSet}</span>
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: center;">
              <button class="btn-cyber btn-cyber-red" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;" onclick="deletePCAssignment('${pc._id}')">REMOVE</button>
            </div>
          `;
          grid.appendChild(card);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('pc-assignment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('dashboard-alert');

    const pcId = document.getElementById('assign-pc-id').value.trim().toUpperCase();
    const assignedSet = document.getElementById('assign-set').value;

    try {
      const response = await fetch('/api/admin/pc-assignment', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ pcId, assignedSet })
      });

      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', data.message, 'success');
        document.getElementById('assign-pc-id').value = '';
        loadPCAssignments();
      } else {
        App.showAlert('dashboard-alert', data.message);
      }
    } catch (err) {
      console.error(err);
      App.showAlert('dashboard-alert', 'Network error saving terminal assignment.');
    }
  });

  const btnGen20 = document.getElementById('btn-generate-20-pcs');
  if (btnGen20) {
    btnGen20.addEventListener('click', async () => {
      if (!confirm('Generate 20 PC terminals (PC-01 to PC-20) with alternating Set A & Set B?')) return;
      App.hideAlert('dashboard-alert');
      try {
        const response = await fetch('/api/admin/pc-assignment/generate-20', {
          method: 'POST',
          headers: getHeaders()
        });
        const data = await response.json();
        if (data.success) {
          App.showAlert('dashboard-alert', data.message, 'success');
          loadPCAssignments();
        } else {
          App.showAlert('dashboard-alert', data.message);
        }
      } catch (err) {
        console.error(err);
        App.showAlert('dashboard-alert', 'Network error generating 20 PCs.');
      }
    });
  }

  window.deletePCAssignment = async (id) => {
    if (!confirm('Remove this PC terminal mapping?')) return;
    try {
      const response = await fetch(`/api/admin/pc-assignment/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) loadPCAssignments();
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // SECTION: TIMER SETTINGS
  // ==========================================
  const loadTimerSettings = async () => {
    try {
      const response = await fetch('/api/admin/timer', { headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        document.getElementById('timer-minutes').value = data.defaultTimerMinutes;
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('timer-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('dashboard-alert');
    const minutes = parseInt(document.getElementById('timer-minutes').value, 10);

    try {
      const response = await fetch('/api/admin/timer', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ minutes })
      });
      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', data.message, 'success');
      } else {
        App.showAlert('dashboard-alert', data.message);
      }
    } catch (err) {
      console.error(err);
      App.showAlert('dashboard-alert', 'Failed to update timer.');
    }
  });

  // ==========================================
  // SECTION: QUESTION SETS
  // ==========================================
  const loadQuestionSets = async () => {
    try {
      const response = await fetch('/api/question-sets', { headers: getHeaders() });
      const data = await response.json();

      if (data.success) {
        const tbody = document.getElementById('sets-table-body');
        tbody.innerHTML = '';

        data.sets.forEach(set => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--accent-cyan);">Set ${set.name}</td>
            <td style="font-family: var(--font-mono);">${set.entryOctal}</td>
            <td style="font-family: var(--font-mono);">${set.entryBinaryPassword}</td>
            <td style="font-family: var(--font-mono);">${set.startQuestionId}</td>
            <td style="font-family: var(--font-mono);">${set.finalQuestionId}</td>
            <td>${set.difficulty}</td>
            <td><span class="badge ${set.active ? 'badge-green' : 'badge-red'}">${set.active ? 'active' : 'inactive'}</span></td>
            <td>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn-cyber btn-cyber-cyan" style="padding: 0.3rem 0.8rem; font-size: 0.75rem;" onclick="openEditSetModal('${set._id}', '${set.name}', '${set.entryOctal}', '${set.entryBinaryPassword}', '${set.startQuestionId}', '${set.finalQuestionId}', '${set.difficulty}', ${set.active})">EDIT</button>
                <button class="btn-cyber btn-cyber-red" style="padding: 0.3rem 0.8rem; font-size: 0.75rem;" onclick="deleteQuestionSet('${set._id}')">DEL</button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('btn-add-set').addEventListener('click', () => {
    document.getElementById('form-set').reset();
    document.getElementById('set-id').value = '';
    document.getElementById('set-name').disabled = false;
    document.getElementById('set-modal-title').textContent = 'CREATE QUESTION SET';
    openModal('modal-set');
  });

  window.openEditSetModal = (id, name, octal, binary, start, final, diff, active) => {
    document.getElementById('set-id').value = id;
    document.getElementById('set-name').value = name;
    document.getElementById('set-name').disabled = true;
    document.getElementById('set-entry-octal').value = octal;
    document.getElementById('set-entry-binary').value = binary;
    document.getElementById('set-start-id').value = start;
    document.getElementById('set-final-id').value = final;
    document.getElementById('set-difficulty').value = diff;
    document.getElementById('set-active').value = active ? 'true' : 'false';

    document.getElementById('set-modal-title').textContent = `EDIT QUESTION SET: ${name}`;
    openModal('modal-set');
  };

  document.getElementById('form-set').addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('dashboard-alert');

    const id = document.getElementById('set-id').value;
    const name = document.getElementById('set-name').value;
    const entryOctal = document.getElementById('set-entry-octal').value.trim();
    const entryBinaryPassword = document.getElementById('set-entry-binary').value.trim();
    const startQuestionId = document.getElementById('set-start-id').value.trim();
    const finalQuestionId = document.getElementById('set-final-id').value.trim();
    const difficulty = document.getElementById('set-difficulty').value;
    const active = document.getElementById('set-active').value === 'true';

    const url = id ? `/api/question-sets/${id}` : '/api/question-sets';
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify({ name, entryOctal, entryBinaryPassword, startQuestionId, finalQuestionId, difficulty, active })
      });

      const data = await response.json();
      if (data.success) {
        closeModal('modal-set');
        App.showAlert('dashboard-alert', data.message, 'success');
        loadQuestionSets();
      } else {
        App.showAlert('dashboard-alert', data.message);
      }
    } catch (err) {
      console.error(err);
    }
  });

  window.deleteQuestionSet = async (id) => {
    if (!confirm('Warning: Deleting a set might break routing dependencies. Proceed?')) return;
    try {
      const response = await fetch(`/api/question-sets/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) loadQuestionSets();
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // SECTION: QUESTION BUILDER & LIST
  // ==========================================

  // Populate 6 Good and 6 Bad clue input rows
  const buildClueInputRows = () => {
    const goodList = document.getElementById('good-clues-builder-list');
    const badList = document.getElementById('bad-clues-builder-list');

    goodList.innerHTML = '';
    badList.innerHTML = '';

    for (let i = 1; i <= 6; i++) {
      // Good clue row
      const gRow = document.createElement('div');
      gRow.className = 'clue-builder-row';
      gRow.innerHTML = `
        <span class="clue-idx-badge" style="color: var(--accent-green);">G-${i}</span>
        <input type="text" class="form-control good-clue-text" data-index="${i}" placeholder="Enter Good Clue #${i}..." required>
        <div>
          <input type="text" class="form-control good-clue-img" data-index="${i}" placeholder="Image URL (optional)" style="font-size: 0.75rem;">
        </div>
      `;
      goodList.appendChild(gRow);

      // Bad clue row
      const bRow = document.createElement('div');
      bRow.className = 'clue-builder-row';
      bRow.innerHTML = `
        <span class="clue-idx-badge" style="color: var(--accent-magenta);">B-${i}</span>
        <input type="text" class="form-control bad-clue-text" data-index="${i}" placeholder="Enter Bad Clue #${i}..." required>
        <div>
          <input type="text" class="form-control bad-clue-img" data-index="${i}" placeholder="Image URL (optional)" style="font-size: 0.75rem;">
        </div>
      `;
      badList.appendChild(bRow);
    }
  };

  buildClueInputRows();

  // Load Questions Table
  const loadQuestions = async () => {
    try {
      const response = await fetch('/api/questions', { headers: getHeaders() });
      const data = await response.json();

      if (data.success) {
        const tbody = document.getElementById('questions-table-body');
        tbody.innerHTML = '';

        if (!data.questions || data.questions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-dark);">No questions found. Click "+ CREATE QUESTION" to begin.</td></tr>';
          return;
        }

        data.questions.forEach(q => {
          const row = document.createElement('tr');
          const isVault = q.isFinalVault;
          row.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--accent-cyan);">${escapeHtml(q.questionId)}</td>
            <td style="font-family: var(--font-mono); text-align: center;">Set ${escapeHtml(q.set)}</td>
            <td style="font-family: var(--font-mono); color: var(--accent-green);">${q.goodCluesCount} / 6</td>
            <td style="font-family: var(--font-mono); color: var(--accent-magenta);">${q.badCluesCount} / 6</td>
            <td style="text-align: center; font-family: var(--font-mono); color: ${q.hasPasskey ? 'var(--accent-green)' : 'var(--accent-red)'};">${q.hasPasskey ? '✓' : '✗'}</td>
            <td style="font-family: var(--font-mono);">${isVault ? '<span class="badge badge-green">VAULT</span>' : 'No'}</td>
            <td style="font-family: var(--font-mono); font-size: 0.85rem;">${escapeHtml(q.nextQuestionIdOnCorrect || 'WIN')}</td>
            <td>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button class="btn-action-icon" onclick="openEditQuestionModal('${q._id}')">EDIT</button>
                <button class="btn-action-icon btn-preview" onclick="openPreviewQuestionModal('${q._id}')">PREVIEW</button>
                <button class="btn-action-icon btn-duplicate" onclick="duplicateQuestion('${q._id}')">COPY</button>
                <button class="btn-action-icon btn-delete" onclick="deleteQuestion('${q._id}')">DEL</button>
              </div>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Create Question Builder
  document.getElementById('btn-add-question').addEventListener('click', async () => {
    document.getElementById('form-question').reset();
    document.getElementById('question-id-field').value = '';
    document.getElementById('q-question-id').disabled = false;
    document.getElementById('question-modal-title').textContent = 'QUESTION BUILDER: CREATE NEW';
    document.getElementById('q-image-preview').style.display = 'none';

    buildClueInputRows();
    openModal('modal-question');
  });

  // Open Edit Question Builder
  window.openEditQuestionModal = async (dbId) => {
    try {
      const response = await fetch(`/api/questions/${dbId}`, { headers: getHeaders() });
      const data = await response.json();

      if (data.success && data.question) {
        const q = data.question;
        document.getElementById('question-id-field').value = q._id;
        document.getElementById('q-question-id').value = q.questionId;
        const setSelect = document.getElementById('q-set');
        const setVal = q.set || q.setName || 'ALL';
        if (![...setSelect.options].some(opt => opt.value === setVal)) {
          const opt = document.createElement('option');
          opt.value = setVal;
          opt.textContent = `Set ${setVal}`;
          setSelect.appendChild(opt);
        }
        setSelect.value = setVal;
        document.getElementById('q-difficulty').value = q.difficulty || 'medium';
        document.getElementById('q-title').value = q.title || '';
        document.getElementById('q-category').value = q.category || '';
        document.getElementById('q-prompt').value = q.promptText || q.questionText || '';
        document.getElementById('q-code').value = q.code || '';

        // Answer & Passkey
        document.getElementById('q-answer-key').value = q.answerKey || q.answer || '';
        document.getElementById('q-direct-passkey').value = q.directPasskey || '';
        document.getElementById('q-wrong-passkey-action').value = q.wrongPasskeyAction || 'penalty';

        // Branching
        document.getElementById('q-next-correct').value = q.nextQuestionIdOnCorrect || q.goodNextId || '';
        document.getElementById('q-next-passkey').value = q.nextQuestionIdOnPasskey || '';
        document.getElementById('q-wrong-action').value = q.wrongAnswerAction || 'retry';
        if (document.getElementById('q-next-wrong')) {
          document.getElementById('q-next-wrong').value = q.nextQuestionIdOnWrong || q.badNextId || '';
        }
        document.getElementById('q-is-final').checked = !!q.isFinalVault;

        // Populate 6 Good clues
        buildClueInputRows();
        const goodInputs = document.querySelectorAll('.good-clue-text');
        const goodImgInputs = document.querySelectorAll('.good-clue-img');
        (q.goodClues || []).forEach((c, idx) => {
          if (goodInputs[idx]) goodInputs[idx].value = c.text || '';
          if (goodImgInputs[idx]) goodImgInputs[idx].value = c.imageUrl || '';
        });

        // Populate 6 Bad clues
        const badInputs = document.querySelectorAll('.bad-clue-text');
        const badImgInputs = document.querySelectorAll('.bad-clue-img');
        (q.badClues || []).forEach((c, idx) => {
          if (badInputs[idx]) badInputs[idx].value = c.text || '';
          if (badImgInputs[idx]) badImgInputs[idx].value = c.imageUrl || '';
        });

        document.getElementById('question-modal-title').textContent = `EDIT QUESTION: ${q.questionId}`;
        openModal('modal-question');
      }
    } catch (err) {
      console.error(err);
      App.showAlert('dashboard-alert', 'Error fetching question data for editing.');
    }
  };

  // Submit Question Builder Form
  document.getElementById('form-question').addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('dashboard-alert');

    const id = document.getElementById('question-id-field').value;

    // Collect 6 Good Clues
    const goodClues = [];
    document.querySelectorAll('.good-clue-text').forEach((inp, idx) => {
      const text = inp.value.trim();
      const imgInp = document.querySelectorAll('.good-clue-img')[idx];
      const imageUrl = imgInp ? imgInp.value.trim() : '';
      if (text) {
        goodClues.push({
          clueId: `G${idx + 1}`,
          text,
          imageUrl,
          order: idx + 1
        });
      }
    });

    // Collect 6 Bad Clues
    const badClues = [];
    document.querySelectorAll('.bad-clue-text').forEach((inp, idx) => {
      const text = inp.value.trim();
      const imgInp = document.querySelectorAll('.bad-clue-img')[idx];
      const imageUrl = imgInp ? imgInp.value.trim() : '';
      if (text) {
        badClues.push({
          clueId: `B${idx + 1}`,
          text,
          imageUrl,
          order: idx + 1
        });
      }
    });

    // Client-side validation: must have exactly 6 good and 6 bad
    if (goodClues.length < 6) {
      alert(`⚠️ Cannot publish: You have provided ${goodClues.length} Good Clues. Exactly 6 are required.`);
      return;
    }
    if (badClues.length < 6) {
      alert(`⚠️ Cannot publish: You have provided ${badClues.length} Bad Clues. Exactly 6 are required.`);
      return;
    }

    const payload = {
      questionId: document.getElementById('q-question-id').value.trim(),
      set: document.getElementById('q-set').value,
      difficulty: document.getElementById('q-difficulty').value,
      title: document.getElementById('q-title').value.trim(),
      category: document.getElementById('q-category').value.trim(),
      promptText: document.getElementById('q-prompt').value.trim(),
      code: document.getElementById('q-code').value,
      goodClues,
      badClues,
      answerKey: document.getElementById('q-answer-key').value.trim(),
      directPasskey: document.getElementById('q-direct-passkey').value.trim(),
      wrongPasskeyAction: document.getElementById('q-wrong-passkey-action').value,
      nextQuestionIdOnCorrect: document.getElementById('q-next-correct').value.trim(),
      nextQuestionIdOnPasskey: document.getElementById('q-next-passkey').value.trim(),
      wrongAnswerAction: document.getElementById('q-wrong-action').value,
      trapId: '',
      nextQuestionIdOnWrong: document.getElementById('q-next-wrong') ? document.getElementById('q-next-wrong').value.trim() : '',
      isFinalVault: document.getElementById('q-is-final').checked
    };

    const url = id ? `/api/questions/${id}` : '/api/questions';
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        closeModal('modal-question');
        App.showAlert('dashboard-alert', data.message, 'success');
        loadQuestions();
        loadDashboardStats();
      } else {
        alert(data.message || 'Validation error saving question.');
      }
    } catch (err) {
      console.error(err);
      App.showAlert('dashboard-alert', 'Network error publishing question.');
    }
  });

  // Duplicate Question
  window.duplicateQuestion = async (id) => {
    if (!confirm('Duplicate this question and all 12 clues?')) return;
    try {
      const response = await fetch(`/api/questions/${id}/duplicate`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', data.message, 'success');
        loadQuestions();
        loadDashboardStats();
      } else {
        App.showAlert('dashboard-alert', data.message);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Question
  window.deleteQuestion = async (id) => {
    if (!confirm('Are you sure you want to permanently delete this question?')) return;
    try {
      const response = await fetch(`/api/questions/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        loadQuestions();
        loadDashboardStats();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // PREVIEW QUESTION MODAL
  // ==========================================
  let previewShowingLabels = false;

  window.openPreviewQuestionModal = async (dbId) => {
    try {
      const response = await fetch(`/api/questions/${dbId}`, { headers: getHeaders() });
      const data = await response.json();

      if (data.success && data.question) {
        const q = data.question;
        document.getElementById('preview-q-id').textContent = `CHALLENGE: ${q.questionId} [SET ${q.set || q.setName}]`;
        document.getElementById('preview-q-title').textContent = q.title || `QUESTION ${q.questionId}`;
        document.getElementById('preview-q-prompt').textContent = q.promptText || q.questionText || '';

        const codeEl = document.getElementById('preview-q-code');
        if (codeEl) {
          if (q.code && q.code.trim()) {
            codeEl.textContent = q.code;
            codeEl.style.display = 'block';
          } else {
            codeEl.textContent = '';
            codeEl.style.display = 'none';
          }
        }

        // Combine and shuffle clues (with backward compatibility for single goodClue/badClue)
        const goodClueItems = (q.goodClues && q.goodClues.length > 0)
          ? q.goodClues.map(c => ({ ...c, isGood: true }))
          : (q.goodClue ? [{ clueId: 'G1', text: q.goodClue, isGood: true }] : []);

        const badClueItems = (q.badClues && q.badClues.length > 0)
          ? q.badClues.map(c => ({ ...c, isGood: false }))
          : (q.badClue ? [{ clueId: 'B1', text: q.badClue, isGood: false }] : []);

        const combined = [...goodClueItems, ...badClueItems];

        // Shuffle
        for (let i = combined.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        const grid = document.getElementById('preview-clues-grid');
        grid.innerHTML = '';
        previewShowingLabels = false;
        document.getElementById('preview-clues-grid').classList.remove('show-labels');

        if (combined.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; border: 1px dashed #334155; border-radius: 8px; color: #94a3b8; font-family: var(--font-mono); font-size: 0.85rem;">
              ⚠️ No clues configured for this question in the database.
              <div style="margin-top: 0.5rem; color: var(--accent-cyan);">
                Run <strong>npm run seed</strong> in your terminal to populate all 12 mixed clues (6 Good + 6 Bad) per question.
              </div>
            </div>
          `;
        } else {
          combined.forEach((clue, idx) => {
            const card = document.createElement('div');
            card.className = `preview-clue-card ${clue.isGood ? 'clue-good-node' : 'clue-bad-node'}`;
            const num = (idx + 1).toString().padStart(2, '0');
            card.innerHTML = `
              <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--accent-cyan); font-weight: bold;">CLUE ${num}</span>
                <span class="preview-clue-tag ${clue.isGood ? 'tag-good' : 'tag-bad'}">${clue.isGood ? 'GOOD CLUE' : 'BAD CLUE'}</span>
              </div>
              <div style="font-size: 0.9rem; color: #cbd5e1; line-height: 1.4;">${escapeHtml(clue.text)}</div>
            `;
            grid.appendChild(card);
          });
        }

        // Setup interactive solution & passkey testing
        window.activePreviewQuestion = q;
        const feedbackBox = document.getElementById('preview-feedback-box');
        if (feedbackBox) {
          feedbackBox.style.display = 'none';
          feedbackBox.innerHTML = '';
        }
        const solInp = document.getElementById('preview-solution-input');
        if (solInp) solInp.value = '';
        const pkeyInp = document.getElementById('preview-passkey-input');
        if (pkeyInp) pkeyInp.value = '';

        const hintAns = document.getElementById('preview-hint-answer');
        const hintPkey = document.getElementById('preview-hint-passkey');
        const ansKey = (q.answerKey || q.answer || '').trim();
        const pKey = (q.directPasskey || '').trim();

        if (hintAns) {
          hintAns.textContent = ansKey ? `Key: ${ansKey} (Click to auto-fill)` : 'No Answer Key';
          hintAns.onclick = () => {
            if (solInp && ansKey) {
              solInp.value = ansKey;
              solInp.focus();
            }
          };
        }
        if (hintPkey) {
          hintPkey.textContent = pKey ? `Passkey: ${pKey} (Click to auto-fill)` : 'No Direct Passkey';
          hintPkey.onclick = () => {
            if (pkeyInp && pKey) {
              pkeyInp.value = pKey;
              pkeyInp.focus();
            }
          };
        }

        openModal('modal-preview');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showPreviewFeedback = (msg, isSuccess) => {
    const box = document.getElementById('preview-feedback-box');
    if (!box) return;
    box.style.display = 'block';
    box.style.background = isSuccess ? 'rgba(0, 255, 102, 0.15)' : 'rgba(255, 0, 85, 0.15)';
    box.style.border = isSuccess ? '1px solid var(--accent-green)' : '1px solid var(--accent-red)';
    box.style.color = isSuccess ? 'var(--accent-green)' : 'var(--accent-red)';
    box.innerHTML = msg;
  };

  const verifyPreviewAnswer = () => {
    const q = window.activePreviewQuestion;
    if (!q) return;
    const inp = document.getElementById('preview-solution-input');
    const entered = (inp ? inp.value : '').trim();
    if (!entered) {
      showPreviewFeedback('⚠️ Please type an answer into the Solution Key field.', false);
      return;
    }
    const expectedAns = (q.answerKey || q.answer || '').trim().toLowerCase();
    const expectedPkey = (q.directPasskey || '').trim().toLowerCase();
    const clean = entered.toLowerCase();

    if ((expectedAns && clean === expectedAns) || (expectedPkey && clean === expectedPkey)) {
      showPreviewFeedback(`✓ CORRECT ANSWER! Matches verification protocol.<br>Next Destination: <strong>${q.nextQuestionIdOnCorrect || (q.isFinalVault ? 'WIN (ESCAPE VICTORY)' : 'Next Stage')}</strong>`, true);
    } else {
      showPreviewFeedback(`✗ INCORRECT SOLUTION KEY.<br>You entered: "<strong>${escapeHtml(entered)}</strong>"<br>Configured Answer: "<strong>${escapeHtml(q.answerKey || q.answer || 'None')}</strong>"`, false);
    }
  };

  const verifyPreviewPasskey = () => {
    const q = window.activePreviewQuestion;
    if (!q) return;
    const inp = document.getElementById('preview-passkey-input');
    const entered = (inp ? inp.value : '').trim();
    if (!entered) {
      showPreviewFeedback('⚠️ Please type a passkey into the Direct Passkey field.', false);
      return;
    }
    const expectedPkey = (q.directPasskey || '').trim().toLowerCase();
    const clean = entered.toLowerCase();

    if (expectedPkey && clean === expectedPkey) {
      showPreviewFeedback(`✓ DIRECT PASSKEY VERIFIED! Fast bypass unlocked.<br>Next Destination: <strong>${q.nextQuestionIdOnPasskey || q.nextQuestionIdOnCorrect || (q.isFinalVault ? 'WIN (ESCAPE VICTORY)' : 'Next Stage')}</strong>`, true);
    } else {
      showPreviewFeedback(`✗ INVALID PASSKEY.<br>You entered: "<strong>${escapeHtml(entered)}</strong>"<br>Configured Passkey: "<strong>${escapeHtml(q.directPasskey || 'None')}</strong>"`, false);
    }
  };

  const btnVerifyAns = document.getElementById('btn-preview-verify-answer');
  if (btnVerifyAns) btnVerifyAns.addEventListener('click', verifyPreviewAnswer);

  const btnUsePkey = document.getElementById('btn-preview-use-passkey');
  if (btnUsePkey) btnUsePkey.addEventListener('click', verifyPreviewPasskey);

  const solInpEl = document.getElementById('preview-solution-input');
  if (solInpEl) solInpEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyPreviewAnswer(); } });

  const pkeyInpEl = document.getElementById('preview-passkey-input');
  if (pkeyInpEl) pkeyInpEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); verifyPreviewPasskey(); } });

  document.getElementById('btn-toggle-preview-labels').addEventListener('click', () => {
    previewShowingLabels = !previewShowingLabels;
    const grid = document.getElementById('preview-clues-grid');
    if (previewShowingLabels) {
      grid.classList.add('show-labels');
      grid.querySelectorAll('.clue-good-node').forEach(c => c.classList.add('show-good'));
      grid.querySelectorAll('.clue-bad-node').forEach(c => c.classList.add('show-bad'));
    } else {
      grid.classList.remove('show-labels');
      grid.querySelectorAll('.clue-good-node').forEach(c => c.classList.remove('show-good'));
      grid.querySelectorAll('.clue-bad-node').forEach(c => c.classList.remove('show-bad'));
    }
  });

  // ==========================================
  // SECTION: STUDENT REGISTRY
  // ==========================================
  const loadStudents = async () => {
    try {
      const response = await fetch('/api/students', { headers: getHeaders() });
      const data = await response.json();

      if (data.success) {
        const tbody = document.getElementById('students-table-body');
        tbody.innerHTML = '';

        data.students.forEach(s => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${escapeHtml(s.name)}</td>
            <td style="font-family: var(--font-mono);">${escapeHtml(s.enrollmentNumber)}</td>
            <td>${escapeHtml(s.department || 'N/A')}</td>
            <td>${escapeHtml(s.semester || 'N/A')}</td>
            <td>${escapeHtml(s.whatsapp || 'N/A')}</td>
            <td>${escapeHtml(s.email || 'N/A')}</td>
            <td>
              <button class="btn-cyber btn-cyber-red" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;" onclick="deleteStudent('${s._id}')">DEL</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('btn-export-students-csv').addEventListener('click', () => {
    window.location.href = '/api/students/export/csv';
  });

  window.deleteStudent = async (id) => {
    if (!confirm('Are you sure you want to delete this student record?')) return;
    try {
      const response = await fetch(`/api/students/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) loadStudents();
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // SECTION: RESULTS & WINNERS
  // ==========================================
  const loadWinnerRankings = async () => {
    try {
      const response = await fetch('/api/results/all', { headers: getHeaders() });
      const data = await response.json();

      if (data.success) {
        const tbody = document.getElementById('results-table-body');
        tbody.innerHTML = '';

        if (!data.results || data.results.length === 0) {
          tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-dark);">No game records found.</td></tr>';
          return;
        }

        data.results.forEach((r, idx) => {
          const row = document.createElement('tr');
          const isWin = r.result === 'WIN';
          const mins = Math.floor(r.completionTime / 60);
          const secs = r.completionTime % 60;
          const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
          const resultId = r._id || r.id;

          row.innerHTML = `
            <td style="font-family: var(--font-mono); font-weight: bold;">${isWin ? `#${idx + 1}` : '-'}</td>
            <td>${escapeHtml(r.studentName)}</td>
            <td style="font-family: var(--font-mono);">${escapeHtml(r.enrollmentNumber)}</td>
            <td style="font-family: var(--font-mono); color: var(--accent-cyan);">${r.pcId || 'N/A'}</td>
            <td style="font-family: var(--font-mono);">Set ${r.set}</td>
            <td style="font-family: var(--font-mono);">${timeStr}</td>
            <td style="font-family: var(--font-mono); color: var(--accent-green);">${r.questionsSolved || 0}</td>
            <td style="font-family: var(--font-mono); color: var(--accent-magenta);">${r.passkeysUsed || 0}</td>
            <td style="font-family: var(--font-mono);">${r.totalAnswerAttempts || r.wrongChoices || 0}</td>
            <td style="font-family: var(--font-mono); font-weight: bold; color: var(--accent-cyan);">${r.score || 0}</td>
            <td><span class="badge ${isWin ? 'badge-green' : 'badge-red'}">${r.result}</span></td>
            <td>
              <button class="btn-action-icon btn-delete" title="Delete Record" onclick="deleteResultRecord('${resultId}')">DEL</button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  window.deleteResultRecord = async (id) => {
    if (!confirm('Are you sure you want to delete this result record?')) return;
    try {
      const response = await fetch(`/api/results/${id}`, { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', 'Result record deleted successfully.', 'success');
        loadWinnerRankings();
        loadDashboardStats();
      } else {
        App.showAlert('dashboard-alert', data.message || 'Failed to delete result record.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearAllResults = async () => {
    if (!confirm('WARNING: Are you sure you want to CLEAR ALL RESULTS? This will reset all player telemetry, game sessions, and rankings.')) return;
    try {
      const response = await fetch('/api/results/all', { method: 'DELETE', headers: getHeaders() });
      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', 'All results, active sessions, and player telemetry cleared successfully.', 'success');
        
        // Immediately reset Event Dashboard telemetry counters to 0 / N/A
        if (document.getElementById('stat-total-students')) document.getElementById('stat-total-students').textContent = '0';
        if (document.getElementById('stat-active-games')) document.getElementById('stat-active-games').textContent = '0';
        if (document.getElementById('stat-completed-games')) document.getElementById('stat-completed-games').textContent = '0';
        if (document.getElementById('stat-gameover-games')) document.getElementById('stat-gameover-games').textContent = '0';
        if (document.getElementById('stat-questions-solved')) document.getElementById('stat-questions-solved').textContent = '0';
        if (document.getElementById('stat-passkey-bypasses')) document.getElementById('stat-passkey-bypasses').textContent = '0';
        if (document.getElementById('stat-fastest-time')) document.getElementById('stat-fastest-time').textContent = 'N/A';
        
        const liveTbody = document.getElementById('live-sessions-body');
        if (liveTbody) liveTbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--text-dark);">No active sessions found.</td></tr>';

        const resultsTbody = document.getElementById('results-table-body');
        if (resultsTbody) resultsTbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--text-dark);">No game results or rankings recorded yet.</td></tr>';

        loadWinnerRankings();
        loadDashboardStats();
        loadStudents();
      } else {
        App.showAlert('dashboard-alert', data.message || 'Failed to clear results.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearResultsBtn = document.getElementById('btn-clear-results');
  if (clearResultsBtn) {
    clearResultsBtn.addEventListener('click', handleClearAllResults);
  }

  const clearTelemetryBtn = document.getElementById('btn-clear-telemetry');
  if (clearTelemetryBtn) {
    clearTelemetryBtn.addEventListener('click', handleClearAllResults);
  }

  document.getElementById('btn-export-csv').addEventListener('click', () => {
    window.location.href = '/api/results/export/csv';
  });

  // ==========================================
  // SECTION: SYSTEM SETTINGS
  // ==========================================
  const loadSystemSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', { headers: getHeaders() });
      const data = await response.json();
      if (data.success && data.settings) {
        document.getElementById('settings-event-name').value = data.settings.eventName || '';
        document.getElementById('settings-max-attempts').value = data.settings.maxPasswordAttempts || 3;
        document.getElementById('settings-event-desc').value = data.settings.eventDescription || '';
        document.getElementById('settings-departments').value = (data.settings.departments || []).join(', ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  document.getElementById('system-settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('dashboard-alert');

    const eventName = document.getElementById('settings-event-name').value.trim();
    const maxPasswordAttempts = parseInt(document.getElementById('settings-max-attempts').value, 10);
    const eventDescription = document.getElementById('settings-event-desc').value.trim();
    const departments = document.getElementById('settings-departments').value.split(',').map(s => s.trim()).filter(Boolean);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ eventName, maxPasswordAttempts, eventDescription, departments })
      });
      const data = await response.json();
      if (data.success) {
        App.showAlert('dashboard-alert', 'Settings updated successfully.', 'success');
      } else {
        App.showAlert('dashboard-alert', data.message);
      }
    } catch (err) {
      console.error(err);
      App.showAlert('dashboard-alert', 'Failed to save system settings.');
    }
  });

  // ==========================================
  // CONTEST QUESTIONS & STAGES CONFIG
  // ==========================================
  let contestQuestionsCache = [];

  const loadActiveQuestionsConfig = async () => {
    try {
      const res = await fetch('/api/admin/active-questions', {
        headers: getHeaders()
      });
      const data = await res.json();
      if (!data.success) {
        App.showAlert('dashboard-alert', data.message || 'Failed to load contest questions.');
        return;
      }

      contestQuestionsCache = data.questions || [];
      const tbody = document.getElementById('active-questions-table-body');
      const summaryEl = document.getElementById('active-questions-summary');
      if (!tbody) return;

      tbody.innerHTML = '';
      const selectedCount = contestQuestionsCache.filter(q => q.selected).length;
      if (summaryEl) {
        summaryEl.textContent = `${selectedCount} Challenges Selected (${selectedCount} Escape Stages per PC)`;
      }

      contestQuestionsCache.forEach((q) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="text-align: center;">
            <input type="checkbox" class="active-question-toggle" data-qid="${escapeHtml(q.questionId)}" ${q.selected ? 'checked' : ''} style="transform: scale(1.35); cursor: pointer;">
          </td>
          <td style="font-family: var(--font-mono); font-weight: 800; color: #38bdf8;">${escapeHtml(q.questionId)}</td>
          <td style="font-weight: 700; color: #f8fafc;">${escapeHtml(q.title)}</td>
          <td>
            <code style="background: rgba(0, 240, 255, 0.12); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 800; font-family: var(--font-mono);">
              ${escapeHtml(q.directPasskey || 'None')}
            </code>
          </td>
          <td>
            <code style="background: rgba(0, 255, 136, 0.12); color: #00ff88; border: 1px solid rgba(0, 255, 136, 0.3); padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 800; font-family: var(--font-mono);">
              ${escapeHtml(q.answerKey || 'None')}
            </code>
          </td>
          <td style="color: #94a3b8; font-size: 0.78rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(q.promptText)}">
            ${escapeHtml(q.promptText)}
          </td>
        `;
        tbody.appendChild(row);
      });

      tbody.querySelectorAll('.active-question-toggle').forEach(cb => {
        cb.addEventListener('change', updateContestSummary);
      });
      updateContestSummary();
    } catch (err) {
      console.error('loadActiveQuestionsConfig error:', err);
      App.showAlert('dashboard-alert', 'Network error retrieving active questions.');
    }
  };

  const updateContestSummary = () => {
    const checked = Array.from(document.querySelectorAll('.active-question-toggle:checked'));
    const summaryEl = document.getElementById('active-questions-summary');
    const container = document.getElementById('pattern-preview-container');

    if (summaryEl) {
      summaryEl.textContent = `${checked.length} Challenges Selected (${checked.length} Escape Stages per PC)`;
    }

    if (!container) return;

    const qids = checked.map(cb => cb.getAttribute('data-qid'));

    if (qids.length === 0) {
      container.innerHTML = `
        <div style="color: #94a3b8; font-size: 0.85rem; font-family: var(--font-mono);">
          ⚠️ No questions selected. Please select at least 1 question for the contest.
        </div>
      `;
      return;
    }

    if (qids.length === 1) {
      container.innerHTML = `
        <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.75rem;">
          <div style="font-weight: 800; color: #38bdf8; margin-bottom: 0.3rem;">🖥️ ALL LAB PCS (Single Challenge Speed Run)</div>
          <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #e2e8f0;">
            <strong>Stage 1:</strong> <span style="color:#00ff88;">${escapeHtml(qids[0])}</span> ➔ 🏆 ESCAPE WIN
          </div>
        </div>
      `;
      return;
    }

    if (qids.length === 2) {
      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 0.6rem;">
          <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.75rem;">
            <div style="font-weight: 800; color: #38bdf8; margin-bottom: 0.3rem;">🖥️ PATTERN A (Odd PCs: PC-01, PC-03, PC-05...)</div>
            <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #e2e8f0;">
              <strong>Stage 1:</strong> <span style="color:#38bdf8; font-weight: 800;">${escapeHtml(qids[0])}</span> ➔ 
              <strong>Stage 2:</strong> <span style="color:#38bdf8; font-weight: 800;">${escapeHtml(qids[1])}</span> ➔ 🏆 WIN
            </div>
          </div>
          <div style="background: rgba(0, 255, 136, 0.08); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 6px; padding: 0.75rem;">
            <div style="font-weight: 800; color: #00ff88; margin-bottom: 0.3rem;">🖥️ PATTERN B (Even PCs: PC-02, PC-04, PC-06...)</div>
            <div style="font-family: var(--font-mono); font-size: 0.85rem; color: #e2e8f0;">
              <strong>Stage 1:</strong> <span style="color:#00ff88; font-weight: 800;">${escapeHtml(qids[1])}</span> <em>(PC-1's 2nd)</em> ➔ 
              <strong>Stage 2:</strong> <span style="color:#00ff88; font-weight: 800;">${escapeHtml(qids[0])}</span> <em>(PC-1's 1st)</em> ➔ 🏆 WIN
            </div>
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #00ff88; background: rgba(0, 255, 136, 0.05); padding: 0.4rem 0.6rem; border-radius: 4px; border-left: 3px solid #00ff88;">
          🛡️ <strong>ANTI-CHEAT ACTIVE:</strong> Adjacent PCs (e.g. PC-1 & PC-2) play opposite questions. They NEVER see the same puzzle at the same time!
        </div>
      `;
      return;
    }

    if (qids.length === 3) {
      const qA = [qids[0], qids[1], qids[2]];
      const qB = [qids[1], qids[2], qids[0]];
      const qC = [qids[2], qids[0], qids[1]];

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 0.6rem;">
          <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 6px; padding: 0.75rem;">
            <div style="font-weight: 800; color: #38bdf8; margin-bottom: 0.3rem;">🖥️ PATTERN A (PC-01, PC-04, PC-07...)</div>
            <div style="font-family: var(--font-mono); font-size: 0.83rem; color: #e2e8f0;">
              <strong>Stage 1:</strong> <span style="color:#38bdf8; font-weight:800;">${escapeHtml(qA[0])}</span> ➔ 
              <strong>Stage 2:</strong> <span style="color:#38bdf8; font-weight:800;">${escapeHtml(qA[1])}</span> ➔ 
              <strong>Stage 3:</strong> <span style="color:#38bdf8; font-weight:800;">${escapeHtml(qA[2])}</span> ➔ 🏆 WIN
            </div>
          </div>
          <div style="background: rgba(0, 255, 136, 0.08); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 6px; padding: 0.75rem;">
            <div style="font-weight: 800; color: #00ff88; margin-bottom: 0.3rem;">🖥️ PATTERN B (PC-02, PC-05, PC-08...)</div>
            <div style="font-family: var(--font-mono); font-size: 0.83rem; color: #e2e8f0;">
              <strong>Stage 1:</strong> <span style="color:#00ff88; font-weight:800;">${escapeHtml(qB[0])}</span> ➔ 
              <strong>Stage 2:</strong> <span style="color:#00ff88; font-weight:800;">${escapeHtml(qB[1])}</span> ➔ 
              <strong>Stage 3:</strong> <span style="color:#00ff88; font-weight:800;">${escapeHtml(qB[2])}</span> ➔ 🏆 WIN
            </div>
          </div>
          <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 6px; padding: 0.75rem;">
            <div style="font-weight: 800; color: #facc15; margin-bottom: 0.3rem;">🖥️ PATTERN C (PC-03, PC-06, PC-09...)</div>
            <div style="font-family: var(--font-mono); font-size: 0.83rem; color: #e2e8f0;">
              <strong>Stage 1:</strong> <span style="color:#facc15; font-weight:800;">${escapeHtml(qC[0])}</span> ➔ 
              <strong>Stage 2:</strong> <span style="color:#facc15; font-weight:800;">${escapeHtml(qC[1])}</span> ➔ 
              <strong>Stage 3:</strong> <span style="color:#facc15; font-weight:800;">${escapeHtml(qC[2])}</span> ➔ 🏆 WIN
            </div>
          </div>
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #38bdf8; background: rgba(56, 189, 248, 0.05); padding: 0.4rem 0.6rem; border-radius: 4px; border-left: 3px solid #38bdf8;">
          🛡️ <strong>ANTI-CHEAT ROTATION GUARANTEE:</strong> Adjacent PCs (PC 1 & 2, PC 2 & 3, PC 3 & 4...) NEVER have the same question at any stage! (Stage 1: ${escapeHtml(qA[0])} vs ${escapeHtml(qB[0])} vs ${escapeHtml(qC[0])} — completely different!)
        </div>
      `;
      return;
    }

    // For 4+ questions:
    const patternsHtml = [0, 1, 2].map(idx => {
      const rotated = [...qids.slice(idx), ...qids.slice(0, idx)];
      const pcLabels = idx === 0 ? 'PC-01, PC-04...' : (idx === 1 ? 'PC-02, PC-05...' : 'PC-03, PC-06...');
      const colors = ['#38bdf8', '#00ff88', '#facc15'];
      return `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 0.65rem;">
          <div style="font-weight: 800; color: ${colors[idx]}; margin-bottom: 0.25rem;">🖥️ ${pcLabels}</div>
          <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #e2e8f0;">
            ${rotated.map((id, i) => `S${i + 1}: <strong style="color:${colors[idx]}">${escapeHtml(id)}</strong>`).join(' ➔ ')} ➔ 🏆 WIN
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0.8rem; margin-bottom: 0.5rem;">
        ${patternsHtml}
      </div>
      <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #00ff88; background: rgba(0, 255, 136, 0.05); padding: 0.4rem 0.6rem; border-radius: 4px; border-left: 3px solid #00ff88;">
        🛡️ <strong>ANTI-CHEAT ROTATION GUARANTEE:</strong> Every terminal plays in shifted cyclic order. Neighboring lab PCs never have the same challenge simultaneously.
      </div>
    `;
  };

  const setQuestionPreset = (count) => {
    const checkboxes = document.querySelectorAll('.active-question-toggle');
    checkboxes.forEach((cb, idx) => {
      if (count === -1) {
        cb.checked = true;
      } else {
        cb.checked = idx < count;
      }
    });
    updateContestSummary();
  };

  const saveActiveQuestionsConfig = async () => {
    try {
      const checkedBoxes = Array.from(document.querySelectorAll('.active-question-toggle:checked'));
      const activeQuestionIds = checkedBoxes.map(cb => cb.getAttribute('data-qid'));

      if (activeQuestionIds.length === 0) {
        alert('Please select at least 1 question for the contest.');
        return;
      }

      const res = await fetch('/api/admin/active-questions', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ activeQuestionIds })
      });
      const data = await res.json();
      if (data.success) {
        App.showAlert('dashboard-alert', `✓ SUCCESS: Contest updated with ${activeQuestionIds.length} challenges! Odd PCs will play Pattern A and Even PCs will play Pattern B.`, 'success');
        updateContestSummary();
      } else {
        App.showAlert('dashboard-alert', data.message || 'Failed to update contest questions.', 'danger');
      }
    } catch (err) {
      console.error('saveActiveQuestionsConfig error:', err);
      App.showAlert('dashboard-alert', 'Error saving active contest questions.', 'danger');
    }
  };

  // Save Button Listener
  const btnSaveActiveQuestions = document.getElementById('btn-save-active-questions');
  if (btnSaveActiveQuestions) btnSaveActiveQuestions.addEventListener('click', saveActiveQuestionsConfig);

  // HTML Escaper
  const escapeHtml = (str) => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Initialize and auto-sync live operator terminals every 1 second (Tej Second Real-Time)
  loadDashboardStats();
  setInterval(loadDashboardStats, 1000);

  // Instantly sync when switching back to this tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      loadDashboardStats();
    }
  });
});
