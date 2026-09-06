document.addEventListener('DOMContentLoaded', () => {
  const pcId = App.getPCId();
  document.getElementById('pc-display').textContent = `PC-ID: ${pcId}`;

  const regForm = document.getElementById('registration-form');
  const alertBox = document.getElementById('alert-box');
  const departmentSelect = document.getElementById('department');

  // Fetch departments from system config and populate dropdown
  const loadConfig = async () => {
    try {
      const response = await fetch('/api/students/config');
      const data = await response.json();
      if (data.success && data.departments) {
        departmentSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
        data.departments.forEach(dept => {
          const opt = document.createElement('option');
          opt.value = dept;
          opt.textContent = dept;
          departmentSelect.appendChild(opt);
        });
      } else {
        departmentSelect.innerHTML = '<option value="" disabled selected>Error loading departments</option>';
      }
    } catch (err) {
      console.error(err);
      departmentSelect.innerHTML = '<option value="" disabled selected>Failed to load departments</option>';
    }
  };

  loadConfig();

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    App.hideAlert('alert-box');

    // Retrieve input values
    const name = document.getElementById('name').value.trim();
    const department = document.getElementById('department').value;
    const semester = document.getElementById('semester').value;
    const enrollmentNumber = document.getElementById('enrollmentNumber').value.trim();
    const whatsapp = document.getElementById('whatsapp').value.trim();
    const email = document.getElementById('email').value.trim();

    // Client-side validation checks
    if (!name || !enrollmentNumber || !whatsapp || !email) {
      App.showAlert('alert-box', 'Please fill in all fields.');
      return;
    }

    if (whatsapp.length < 8) {
      App.showAlert('alert-box', 'WhatsApp number must be at least 8 digits.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      App.showAlert('alert-box', 'Please enter a valid email address.');
      return;
    }

    try {
      const response = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          department,
          enrollmentNumber,
          semester,
          whatsapp,
          email,
          pcId
        })
      });

      const data = await response.json();

      if (data.success) {
        // Save session details
        App.saveSessionId(data.sessionId);
        localStorage.setItem('game_set', data.questionSet);
        
        // Redirect to Octal-to-Binary entry challenge
        window.location.href = '/entry-challenge.html';
      } else {
        App.showAlert('alert-box', data.message || 'Registration failed.');
      }
    } catch (err) {
      console.error(err);
      App.showAlert('alert-box', 'Connection failed. Please contact the administrator.');
    }
  });
});
