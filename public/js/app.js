function showView(viewId) {
  const views = ['auth-view', 'student-view', 'quiz-view', 'results-view', 'counselor-view', 'resources-view'];
  views.forEach(v => {
    document.getElementById(v).classList.add('hidden');
  });
  
  const targetView = document.getElementById(viewId);
  targetView.classList.remove('hidden');
  
  // Re-trigger fade-in animation
  targetView.classList.remove('fade-in');
  void targetView.offsetWidth; // trigger reflow
  targetView.classList.add('fade-in');
}

function toggleAuth() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  
  if (loginForm.classList.contains('hidden')) {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
  }
}

function showMessage(elementId, msg, type) {
  const el = document.getElementById(elementId);
  el.textContent = msg;
  el.className = 'message ' + type;
  setTimeout(() => {
    el.className = 'message';
    el.textContent = '';
  }, 3000);
}

async function login() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    
    if (res.ok) {
      handleLoginSuccess(data.user);
    } else {
      showMessage('auth-message', data.error, 'error');
    }
  } catch (err) {
    showMessage('auth-message', 'Server error', 'error');
  }
}

async function signup() {
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const role = document.getElementById('signup-role').value;

  try {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();
    
    if (res.ok) {
      handleLoginSuccess(data.user);
    } else {
      showMessage('auth-message', data.error, 'error');
    }
  } catch (err) {
    showMessage('auth-message', 'Server error', 'error');
  }
}

function handleLoginSuccess(user) {
  if (user.role === 'student') {
    document.getElementById('student-name').textContent = user.name;
    showView('student-view');
  } else if (user.role === 'counselor') {
    showView('counselor-view');
    loadCounselorData();
  }
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  showView('auth-view');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

function updateProgress(percent) {
  const bar = document.querySelector('.progress-bar');
  if (bar) {
    bar.style.width = percent + '%';
  }
}

async function submitQuiz(e) {
  e.preventDefault();
  
  const q1Node = document.querySelector('input[name="q1"]:checked');
  const q2Node = document.querySelector('input[name="q2"]:checked');
  const q3Node = document.querySelector('input[name="q3"]:checked');
  
  if (!q1Node || !q2Node || !q3Node) {
    alert("Please answer all multiple-choice questions.");
    return;
  }
  
  const q1 = parseInt(q1Node.value);
  const q2 = parseInt(q2Node.value);
  const q3 = parseInt(q3Node.value);
  const openText = document.getElementById('open-text').value;
  
  const mcqScore = q1 + q2 + q3; 
  
  try {
    const res = await fetch('/api/submit-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcq_score: mcqScore, text_response: openText })
    });
    
    const data = await res.json();
    if (res.ok) {
      showResults(data.risk_level);
    } else {
      alert(data.error);
    }
  } catch (err) {
    alert('Failed to submit quiz.');
  }
}

function showResults(riskLevel) {
  const badgeContainer = document.getElementById('results-badge-container');
  const resultsContainer = document.getElementById('results-message');
  let msgHTML = '';
  let badgeHTML = '';
  
  if (riskLevel === 'Low Risk') {
    badgeHTML = '<span class="badge badge-low">Low Risk</span>';
    msgHTML = '<h2>You are doing great! 🌟</h2><p>Keep up the good habits. Check out our wellness tips if you want to maintain your well-being.</p>';
  } else if (riskLevel === 'Moderate Risk') {
    badgeHTML = '<span class="badge badge-mod">Moderate Risk</span>';
    msgHTML = '<h2>Things might be a bit stressful lately. 🌤️</h2><p>It happens! We recommend checking out our stress management resources and taking some time for yourself.</p>';
  } else {
    badgeHTML = '<span class="badge badge-high">High Risk</span>';
    msgHTML = '<h2>It sounds like you could use some support. 💙</h2><p>We care about your well-being. Please consider reaching out to the counseling center. They are here to help!</p>';
  }
  
  if (badgeContainer) badgeContainer.innerHTML = badgeHTML;
  resultsContainer.innerHTML = msgHTML;
  showView('results-view');
  document.getElementById('quiz-form').reset();
  updateProgress(0);
}

async function loadCounselorData() {
  try {
    const res = await fetch('/api/counselor-data');
    const data = await res.json();
    
    if (res.ok) {
      const list = document.getElementById('student-list');
      list.innerHTML = '';
      
      if (data.students.length === 0) {
        list.innerHTML = '<p class="text-center" style="color: var(--text-light); margin-top: 20px;">No students currently flagged for support. 🎉</p>';
        return;
      }
      
      data.students.forEach(student => {
        const div = document.createElement('div');
        div.className = 'info-card counselor-student';
        
        // Define badge style based on risk level
        const badgeClass = student.risk_level === 'High Risk' ? 'badge-high' : 'badge-mod';
        
        div.innerHTML = `
          <div>
            <h3>${student.name}</h3>
            <p style="color: var(--text-light); font-size: 13px;">Status: Needs Support</p>
          </div>
          <div>
            <span class="badge ${badgeClass}" style="margin-bottom: 0;">${student.risk_level}</span>
          </div>
        `;
        list.appendChild(div);
      });
    }
  } catch (err) {
    console.error('Failed to load counselor data', err);
  }
}

// Check session on load
window.onload = async () => {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      handleLoginSuccess(data.user);
    }
  } catch (err) {
    // Ignore, just stay on login
  }
};
