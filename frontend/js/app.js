// Global Application Utility
const App = {
  // Normalize any PC string (e.g. "2", "02", "PC-2", "pc-02", "pc02") to standard "PC-XX"
  normalizePCId: (raw) => {
    if (!raw) return null;
    const str = String(raw).trim();
    const numMatch = str.match(/\b(?:pc[-_]?)?([0-9]{1,3})\b/i) || str.match(/([0-9]{1,3})/);
    if (numMatch) {
      const num = parseInt(numMatch[1], 10);
      return `PC-${String(num).padStart(2, '0')}`;
    }
    if (/^pc/i.test(str)) {
      return str.toUpperCase();
    }
    return null;
  },

  // Retrieve PC ID from URL path (e.g. /PC-02, /PC=13, /pc-13, /pc13), parameters, or sessionStorage/localStorage
  getPCId: () => {
    let pcId = null;

    // 1. Direct path / search / hash check: handles /PC=13, /PC-13, /pc=13, /PC13, /13, etc.
    try {
      const full = decodeURIComponent(window.location.pathname + window.location.search + window.location.hash);

      // Matches /pcid=pc-13 or /pc=pc-13
      let m = full.match(/(?:^|\/|[?&#])pc(?:id)?[-_=\s]*pc[-_=\s]*([0-9]{1,3})\b/i);
      if (!m) {
        // Matches /PC=13, /PC-13, /pc13, /pc_13, /pcid=13, ?pc=13, ?pcId=13
        m = full.match(/(?:^|\/|[?&#])pc(?:id)?[-_=\s]*([0-9]{1,3})\b/i);
      }
      if (!m) {
        // Matches just /13 or /08 in pathname
        m = window.location.pathname.match(/^\/([0-9]{1,3})\/?$/);
      }

      if (m && m[1]) {
        const num = parseInt(m[1], 10);
        pcId = `PC-${String(num).padStart(2, '0')}`;
      }
    } catch (e) {
      console.error('getPCId parse error:', e);
    }

    // 2. Check query parameters explicitly: ?pcId=13, ?pc=13, ?terminal=13
    if (!pcId) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams.entries()) {
          const k = key.toLowerCase();
          if (k === 'pcid' || k === 'pc' || k === 'terminal') {
            const norm = App.normalizePCId(value);
            if (norm) {
              pcId = norm;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // If detected from URL, save to BOTH per-tab sessionStorage and localStorage
    if (pcId) {
      try { sessionStorage.setItem('pcId', pcId); } catch (e) {}
      localStorage.setItem('pcId', pcId);
      return pcId;
    }

    // 3. Check per-tab sessionStorage FIRST so multiple tabs on same browser never clash!
    try {
      const tabPc = sessionStorage.getItem('pcId');
      if (tabPc) return tabPc;
    } catch (e) {}

    // 4. Fallback to localStorage from previous visit/navigation
    pcId = localStorage.getItem('pcId');
    if (!pcId) {
      pcId = 'PC-01'; // Default fallback
      localStorage.setItem('pcId', pcId);
      try { sessionStorage.setItem('pcId', pcId); } catch (e) {}
    }
    return pcId;
  },

  // Save current active game session ID
  saveSessionId: (id) => {
    localStorage.setItem('sessionId', id);
  },

  // Get current active game session ID
  getSessionId: () => {
    return localStorage.getItem('sessionId');
  },

  // Clear current active session
  clearSession: () => {
    localStorage.removeItem('sessionId');
  },

  // Show Alert Notification Box
  showAlert: (elemId, message, type = 'danger') => {
    const alertBox = document.getElementById(elemId);
    if (!alertBox) return;

    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
  },

  // Hide Alert Notification Box
  hideAlert: (elemId) => {
    const alertBox = document.getElementById(elemId);
    if (alertBox) {
      alertBox.style.display = 'none';
    }
  },

  // Formatting utility: seconds to MM:SS
  formatTime: (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

// Global listener for Admin Keyboard Shortcut: CTRL + SHIFT + A
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    window.location.href = '/admin/login.html';
  }
});
