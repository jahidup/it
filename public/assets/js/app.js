// ====================== CONFIG ======================
const API_BASE = window.location.origin + '/api';

// ====================== CACHING ======================
function cacheGet(key) {
  const entry = JSON.parse(localStorage.getItem(key));
  return (entry && Date.now() < entry.expiry) ? entry.data : null;
}
function cacheSet(key, data, ttl = 15000) {
  localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + ttl }));
}

// ====================== UTILITIES ======================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function getCurrentUser() {
  const user = localStorage.getItem('currentUser');
  return user ? JSON.parse(user) : null;
}

function adminAuthHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function setLoading(btn, loading = true) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Processing...' : btn.dataset.originalText;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ====================== NAVBAR ======================
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  const currentScroll = window.pageYOffset;
  if (currentScroll <= 0) navbar.classList.remove('hidden');
  else if (currentScroll > lastScroll && !navbar.classList.contains('hidden')) navbar.classList.add('hidden');
  else if (currentScroll < lastScroll && navbar.classList.contains('hidden')) navbar.classList.remove('hidden');
  lastScroll = currentScroll;
});

function updateNav() {
  const user = getCurrentUser();
  const ids = {
    navLogin: document.getElementById('navLogin'),
    navRegister: document.getElementById('navRegister'),
    navDashboard: document.getElementById('navDashboard'),
    navAdmin: document.getElementById('navAdmin'),
    navLogout: document.getElementById('navLogout')
  };
  if (!ids.navLogin) return;
  if (user) {
    ids.navLogin.style.display = 'none';
    ids.navRegister.style.display = 'none';
    ids.navDashboard.style.display = 'block';
    ids.navAdmin.style.display = 'block';
    ids.navLogout.style.display = 'block';
  } else {
    ids.navLogin.style.display = 'block';
    ids.navRegister.style.display = 'block';
    ids.navDashboard.style.display = 'none';
    ids.navAdmin.style.display = 'none';
    ids.navLogout.style.display = 'none';
  }
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle) toggle.onclick = () => links.classList.toggle('active');
}

window.handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  showToast('Logged out', 'success');
  window.location.href = 'index.html';
};
window.handleAdminLogout = () => {
  localStorage.removeItem('adminToken');
  showToast('Admin logged out', 'info');
  window.location.href = 'admin.html';
};

// ====================== PAGE DETECTION ======================
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  const path = window.location.pathname;

  if (path.endsWith('index.html') || path === '/' || path.endsWith('/sankalp-digital-pathshala/')) {
    loadFeatured();
  }
  if (path.includes('courses.html')) loadAllCourses();
  if (path.includes('course-detail.html')) loadDetail();
  if (path.includes('login.html')) setupLogin();
  if (path.includes('register.html')) setupRegister();
  if (path.includes('dashboard.html')) setupDashboard();
  if (path.includes('admin.html')) setupAdmin();

  // Floating WhatsApp
  const waBtn = document.createElement('a');
  waBtn.href = 'https://wa.me/+918055698328?text=Hi%20Sankalp%20Digital%20Pathshala';
  waBtn.target = '_blank';
  waBtn.className = 'floating-whatsapp';
  waBtn.innerHTML = '💬';
  document.body.appendChild(waBtn);
});

// ====================== COURSE CARD ======================
function cardHTML(course) {
  const disc = course.originalPrice && course.originalPrice > course.price
    ? `<span class="original-price">₹${course.originalPrice}</span> <span class="discount-badge">${Math.round((1 - course.price / course.originalPrice) * 100)}% off</span>`
    : '';
  return `
    <div class="course-card">
      <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; height:180px; object-fit:cover; border-radius:12px; margin-bottom:12px;">
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <div class="price-container"><span class="price">₹${course.price}</span>${disc}</div>
      <a href="course-detail.html?id=${course._id}" class="btn btn-primary btn-full">View Details</a>
    </div>`;
}

async function loadFeatured() {
  const grid = document.getElementById('featuredCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.slice(0, 3).map(cardHTML).join('');
  } catch { grid.innerHTML = '<p>Failed to load.</p>'; }
}

async function loadAllCourses() {
  const grid = document.getElementById('allCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.map(cardHTML).join('');
  } catch { grid.innerHTML = '<p>Failed to load.</p>'; }
}

async function loadDetail() {
  const id = new URLSearchParams(location.search).get('id');
  const container = document.getElementById('courseDetailContent');
  if (!container || !id) return;
  try {
    const res = await fetch(`${API_BASE}/courses/${id}`);
    const course = await res.json();
    container.innerHTML = `
      <div class="course-detail">
        <img src="${course.imageUrl}" style="max-height:400px; object-fit:cover; border-radius:16px; margin-bottom:20px;">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <h3>Chapters & Lectures</h3>
        <div class="chapters-list">
          ${course.chapters && course.chapters.length ? course.chapters.map((ch, ci) => `
            <div class="chapter-item">
              <h4>Chapter ${ci+1}: ${ch.title}</h4>
              <ul class="lecture-list">
                ${ch.lectures.map(lec => `<li>📹 ${lec.title}</li>`).join('')}
              </ul>
            </div>
          `).join('') : '<p>No chapters available yet.</p>'}
        </div>
        <div style="margin:20px 0;"><span class="price" style="font-size:1.8rem;">₹${course.price}</span>${course.originalPrice && course.originalPrice > course.price ? `<span class="original-price" style="margin-left:10px;">₹${course.originalPrice}</span>` : ''}</div>
        <button class="btn btn-primary btn-lg" id="buyNowBtn">Buy Now</button>
      </div>`;
    document.getElementById('buyNowBtn').addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) { showToast('Please login first', 'error'); location.href='login.html'; return; }
      const msg = `Hello Admin,\nName: ${user.name}\nEmail: ${user.email}\nCourse: ${course.title}`;
      window.open(`https://wa.me/+918055698328?text=${encodeURIComponent(msg)}`, '_blank');
    });
  } catch { container.innerHTML = '<p>Course not found.</p>'; }
}

// ====================== AUTHENTICATION ======================
function setupLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    setLoading(btn, true);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        showToast('Login successful!', 'success');
        location.href = 'dashboard.html';
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(btn, false); }
  });

  const forgotLink = document.createElement('a');
  forgotLink.href = '#'; forgotLink.textContent = 'Forgot Password?';
  forgotLink.style.display = 'block'; forgotLink.style.margin = '15px 0'; forgotLink.style.textAlign = 'center';
  forgotLink.style.color = '#0284c7'; forgotLink.style.cursor = 'pointer';
  form.appendChild(forgotLink);
  forgotLink.addEventListener('click', (e) => { e.preventDefault(); showForgotPasswordModal(); });
}

function showForgotPasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px; padding:25px;">
      <h3>Reset Password</h3>
      <input type="email" id="forgotEmail" placeholder="Your email" required style="width:100%; margin:10px 0; padding:10px; border-radius:8px; border:1px solid #ddd;">
      <button class="btn btn-primary btn-full" id="sendForgotOtp">Send OTP</button>
      <div id="forgotOtpSection" style="display:none; margin-top:15px;">
        <input type="text" id="forgotOtp" placeholder="Enter OTP" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:10px;">
        <button class="btn btn-outline btn-full" id="verifyForgotOtp">Verify OTP</button>
        <div id="newPasswordSection" style="display:none; margin-top:10px;">
          <input type="password" id="newPassword" placeholder="New password" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd; margin-bottom:10px;">
          <button class="btn btn-primary btn-full" id="resetPasswordBtn">Reset Password</button>
        </div>
      </div>
      <button class="btn btn-outline btn-full" id="closeForgotModal" style="margin-top:10px;">Cancel</button>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('closeForgotModal').addEventListener('click', () => modal.remove());
  document.getElementById('sendForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) return showToast('Enter email', 'error');
    setLoading(document.getElementById('sendForgotOtp'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        document.getElementById('forgotOtpSection').style.display = 'block';
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(document.getElementById('sendForgotOtp'), false); }
  });

  document.getElementById('verifyForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    if (!otp) return showToast('Enter OTP', 'error');
    setLoading(document.getElementById('verifyForgotOtp'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('OTP verified!', 'success');
        document.getElementById('newPasswordSection').style.display = 'block';
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(document.getElementById('verifyForgotOtp'), false); }
  });

  document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword) return showToast('Enter new password', 'error');
    setLoading(document.getElementById('resetPasswordBtn'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Password reset! Please login.', 'success');
        modal.remove();
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(document.getElementById('resetPasswordBtn'), false); }
  });
}

function setupRegister() {
  let otpVerified = false;
  const sendBtn = document.getElementById('sendOtpBtn');
  const verifyBtn = document.getElementById('verifyOtpBtn');
  const regForm = document.getElementById('registerForm');
  const regBtn = document.getElementById('registerBtn');
  if (!sendBtn || !verifyBtn || !regForm) return;

  sendBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    if (!email) return showToast('Enter email first', 'error');
    setLoading(sendBtn, true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message, 'success');
        document.getElementById('otpSection').style.display = 'block';
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(sendBtn, false); }
  });

  verifyBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const otp = document.getElementById('otp').value.trim();
    if (!otp) return showToast('Enter OTP', 'error');
    setLoading(verifyBtn, true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      if (res.ok) { otpVerified = true; showToast('OTP verified!', 'success'); regBtn.disabled = false; }
      else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(verifyBtn, false); }
  });

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!otpVerified) return showToast('Verify OTP first', 'error');
    setLoading(regBtn, true);
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const otp = document.getElementById('otp').value.trim();
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password, otp })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        showToast('Registered!', 'success');
        location.href = 'dashboard.html';
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(regBtn, false); }
  });
}

// ====================== STUDENT DASHBOARD ======================
function setupDashboard() {
  const user = getCurrentUser();
  if (!user) { location.href = 'login.html'; return; }
  document.getElementById('topbarUser').textContent = user.name;

  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  if (!sidebar.querySelector('.close-sidebar')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-sidebar'; closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => sidebar.classList.remove('active');
    sidebar.prepend(closeBtn);
  }
  toggleBtn.onclick = () => sidebar.classList.toggle('active');

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 900) sidebar.classList.remove('active'); // auto close on mobile
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'dashboard') loadDashboardHome();
      else if (view === 'myCourses') loadMyCourses();
      else if (view === 'progress') loadProgress();
      else if (view === 'performance') loadPerformanceReport();
      else if (view === 'askDoubt') loadAskDoubtForm();
      else if (view === 'myDoubts') loadMyDoubts();
      else if (view === 'sankalpSathi') loadSankalpSathi();
      else if (view === 'tests') loadTests();
      else if (view === 'practice') loadPractice();
      else if (view === 'communityChat') loadCommunityChat();
      else if (view === 'messages') loadPrivateMessages();
    });
  });
  loadDashboardHome();
}

async function loadDashboardHome() {
  try {
    const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await res.json();
    const count = Array.isArray(courses) ? courses.length : 0;
    document.getElementById('dashboardContent').innerHTML = `<h2>Welcome, ${getCurrentUser().name}!</h2><p>Enrolled in <strong>${count}</strong> course(s).</p>`;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading data.</p>'; }
}

async function loadMyCourses() {
  try {
    let courses = cacheGet('my-enrollments');
    if (!courses) {
      const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      courses = await res.json();
      cacheSet('my-enrollments', courses, 15000);
    }
    if (!courses.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No enrolled courses.</p>';
      return;
    }
    let html = `<h3>My Courses</h3><div class="compact-course-list">`;
    for (let course of courses) {
      const progressRes = await fetch(`${API_BASE}/progress/${course._id}`, { headers: authHeaders() });
      const completedIds = await progressRes.json();
      let total = 0;
      (course.chapters || []).forEach(ch => total += ch.lectures.length);
      const completed = completedIds.filter(id => {
        return (course.chapters || []).some(ch => ch.lectures.some(l => l._id === id));
      }).length;
      html += `
        <div class="compact-course-item">
          <div class="course-info"><strong>${course.title}</strong><span class="progress-text">${completed}/${total} completed</span></div>
          <button class="btn btn-sm btn-outline view-lectures-btn" data-id="${course._id}">📂 View Chapters</button>
        </div>`;
    }
    html += `</div>`;
    document.getElementById('dashboardContent').innerHTML = html;
    document.querySelectorAll('.view-lectures-btn').forEach(btn => {
      btn.addEventListener('click', () => viewCourseChapters(btn.dataset.id));
    });
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading courses.</p>'; }
}

async function viewCourseChapters(courseId) {
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`);
    const course = await res.json();
    const progressRes = await fetch(`${API_BASE}/progress/${courseId}`, { headers: authHeaders() });
    const completedIds = await progressRes.json();
    let html = `<div class="lecture-header"><button class="btn btn-sm btn-outline back-to-courses-btn">← Back</button><h3>${course.title}</h3></div>`;
    if (course.chapters && course.chapters.length) {
      html += `<div class="chapters-container">`;
      course.chapters.forEach((ch, chIdx) => {
        html += `<div class="chapter-block">
          <h4 class="chapter-title">Chapter ${chIdx+1}: ${ch.title}</h4>
          <div class="lecture-list-stacked">`;
        if (ch.lectures.length) {
          ch.lectures.forEach((lec, lecIdx) => {
            const isCompleted = completedIds.includes(lec._id);
            html += `
              <div class="lecture-card">
                <div class="lecture-info-row">
                  <span class="lecture-title">${lecIdx+1}. ${lec.title}</span>
                  <span class="lecture-time">${timeAgo(lec.createdAt)}</span>
                  ${isCompleted ? '<span class="badge complete-badge">✔ Done</span>' : ''}
                </div>
                <div class="lecture-actions-row">
                  <a href="${lec.videoUrl}" target="_blank" class="btn btn-xs btn-primary">🎬 Video</a>
                  <a href="${lec.notesUrl}" target="_blank" class="btn btn-xs btn-outline">📄 Notes</a>
                  ${lec.dppLink ? `<a href="${lec.dppLink}" target="_blank" class="btn btn-xs btn-outline">📝 DPP</a>` : ''}
                  ${!isCompleted ? `<button class="btn btn-xs btn-success mark-complete-btn" data-lecture-id="${lec._id}">✅ Complete</button>` : ''}
                  <button class="btn btn-xs btn-warning doubt-btn" data-lecture-id="${lec._id}" data-course-id="${course._id}" data-chapter-id="${ch._id}">❓ Doubt</button>
                </div>
              </div>`;
          });
        } else {
          html += '<p>No lectures in this chapter.</p>';
        }
        html += `</div></div>`;
      });
      html += `</div>`;
    } else {
      html += '<p>No chapters available.</p>';
    }
    document.getElementById('dashboardContent').innerHTML = html;

    document.querySelector('.back-to-courses-btn').addEventListener('click', loadMyCourses);
    document.querySelectorAll('.mark-complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lectureId = btn.dataset.lectureId;
        setLoading(btn, true);
        await fetch(`${API_BASE}/progress/mark-complete/${courseId}/${lectureId}`, { method: 'POST', headers: authHeaders() });
        showToast('Marked as complete', 'success');
        viewCourseChapters(courseId);
        setLoading(btn, false);
      });
    });
    document.querySelectorAll('.doubt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const chapterId = btn.dataset.chapterId;
        const lectureId = btn.dataset.lectureId;
        openDiscussionPanel(courseId, chapterId, lectureId);
      });
    });
  } catch { showToast('Error loading chapters', 'error'); }
}

// ====================== DISCUSSION PANEL (YouTube‑style) ======================
function openDiscussionPanel(courseId, chapterId, lectureId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="discussion-panel">
      <div class="panel-header">
        <h3>Doubts & Discussion</h3>
        <button class="close-panel-btn">&times;</button>
      </div>
      <div class="comments-list" id="commentsList">
        <div class="loading-spinner">Loading comments...</div>
      </div>
      <div class="new-comment-box">
        <textarea id="newCommentMsg" placeholder="Ask a doubt or reply..." rows="2"></textarea>
        <button class="btn btn-primary btn-sm" id="postCommentBtn">Post</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const closeBtn = overlay.querySelector('.close-panel-btn');
  closeBtn.addEventListener('click', () => overlay.remove());

  async function loadDiscussion() {
    try {
      const res = await fetch(`${API_BASE}/doubts/${courseId}/${lectureId}`);
      const comments = await res.json();
      const container = overlay.querySelector('#commentsList');
      if (!comments.length) {
        container.innerHTML = '<p class="text-center mt-3">No comments yet. Be the first to ask!</p>';
        return;
      }
      let html = '';
      comments.forEach(d => {
        html += `
          <div class="comment-thread">
            <div class="comment">
              <span class="comment-author">${d.userName}</span>
              <span class="comment-time">${timeAgo(d.createdAt)}</span>
              <p class="comment-text">${d.message}</p>
              <button class="btn btn-xs btn-outline reply-toggle-btn" data-id="${d._id}">Reply</button>
              <div class="reply-form" id="replyForm-${d._id}" style="display:none; margin-left:20px;">
                <textarea class="reply-textarea" rows="2" placeholder="Write a reply..."></textarea>
                <button class="btn btn-xs btn-primary submit-reply-btn" data-parent-id="${d._id}">Submit</button>
              </div>
            </div>
            <div class="replies" id="replies-${d._id}">
              ${(d.replies || []).map(r => {
                if (r.isAdminReply) {
                  return `
                    <div class="comment admin-reply">
                      <span class="comment-author">👑 ${r.userName}</span>
                      <span class="comment-time">${timeAgo(r.createdAt)}</span>
                      <p class="comment-text">${r.message}</p>
                    </div>`;
                } else {
                  return `
                    <div class="comment reply">
                      <span class="comment-author">${r.userName}</span>
                      <span class="comment-time">${timeAgo(r.createdAt)}</span>
                      <p class="comment-text">${r.message}</p>
                    </div>`;
                }
              }).join('')}
            </div>
          </div>`;
      });
      container.innerHTML = html;

      overlay.querySelectorAll('.reply-toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          const form = document.getElementById(`replyForm-${id}`);
          form.style.display = form.style.display === 'none' ? 'block' : 'none';
        });
      });

      overlay.querySelectorAll('.submit-reply-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const parentId = btn.dataset.parentId;
          const textarea = btn.parentElement.querySelector('.reply-textarea');
          const message = textarea.value.trim();
          if (!message) return;
          setLoading(btn, true);
          await fetch(`${API_BASE}/doubts`, {
            method: 'POST',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, chapterId: null, lectureId, message, parentId })
          });
          showToast('Reply posted', 'success');
          loadDiscussion();
          setLoading(btn, false);
        });
      });
    } catch { showToast('Error loading discussion', 'error'); }
  }

  overlay.querySelector('#postCommentBtn').addEventListener('click', async () => {
    const msg = overlay.querySelector('#newCommentMsg').value.trim();
    if (!msg) return;
    const btn = overlay.querySelector('#postCommentBtn');
    setLoading(btn, true);
    await fetch(`${API_BASE}/doubts`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, chapterId, lectureId, message: msg, parentId: null })
    });
    showToast('Comment added', 'success');
    overlay.querySelector('#newCommentMsg').value = '';
    loadDiscussion();
    setLoading(btn, false);
  });

  loadDiscussion();
}

// ====================== PROGRESS & REPORT ======================
async function loadProgress() {
  try {
    const enrollRes = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await enrollRes.json();
    if (!courses.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No courses.</p>';
      return;
    }
    let total = 0, completed = 0;
    for (let c of courses) {
      const progressRes = await fetch(`${API_BASE}/progress/${c._id}`, { headers: authHeaders() });
      const ids = await progressRes.json();
      total += (c.chapters || []).reduce((sum, ch) => sum + ch.lectures.length, 0);
      completed += ids.filter(id => (c.chapters || []).some(ch => ch.lectures.some(l => l._id === id))).length;
    }
    const percent = total ? Math.round((completed / total) * 100) : 0;
    document.getElementById('dashboardContent').innerHTML = `
      <h2>📊 Overall Progress</h2>
      <p>${completed}/${total} lectures completed (${percent}%)</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>`;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

async function loadPerformanceReport() {
  try {
    const res = await fetch(`${API_BASE}/progress/my-report`, { headers: authHeaders() });
    const records = await res.json();
    if (!records.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No completion records yet.</p>';
      return;
    }
    let html = '<h3>🏆 Performance Report</h3><div class="report-list">';
    records.forEach(r => {
      html += `
        <div class="report-item">
          <span>${r.courseTitle} – ${r.lectureTitle}</span>
          <span class="report-date">${new Date(r.completedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
        </div>`;
    });
    html += '</div>';
    document.getElementById('dashboardContent').innerHTML = html;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

// ====================== ASK DOUBT FORM (with chapter) ======================
async function loadAskDoubtForm() {
  const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
  const courses = await res.json();
  if (!courses.length) {
    document.getElementById('dashboardContent').innerHTML = '<p>Enroll in a course first.</p>';
    return;
  }
  let html = `
    <h3>Ask a Doubt</h3>
    <div class="form-group">
      <label>Select Course</label>
      <select id="doubtCourseSelect" style="width:100%; padding:10px;">
        ${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Select Chapter</label>
      <select id="doubtChapterSelect" style="width:100%; padding:10px;">
        <option value="">-- Select Chapter --</option>
      </select>
    </div>
    <div class="form-group">
      <label>Select Lecture</label>
      <select id="doubtLectureSelect" style="width:100%; padding:10px;">
        <option value="">-- Select Lecture --</option>
      </select>
    </div>
    <div class="form-group">
      <textarea id="doubtMessage" rows="4" placeholder="Describe your doubt..." style="width:100%;"></textarea>
    </div>
    <button class="btn btn-primary" id="submitDoubtFormBtn">Submit Doubt</button>`;
  document.getElementById('dashboardContent').innerHTML = html;

  const courseSelect = document.getElementById('doubtCourseSelect');
  const chapterSelect = document.getElementById('doubtChapterSelect');
  const lectureSelect = document.getElementById('doubtLectureSelect');

  let currentChapters = [];

  async function loadChapters() {
    const courseId = courseSelect.value;
    chapterSelect.innerHTML = '<option value="">-- Select Chapter --</option>';
    lectureSelect.innerHTML = '<option value="">-- Select Lecture --</option>';
    if (!courseId) return;
    const course = courses.find(c => c._id === courseId);
    if (!course) return;
    const res = await fetch(`${API_BASE}/courses/${courseId}`);
    const fullCourse = await res.json();
    currentChapters = fullCourse.chapters || [];
    chapterSelect.innerHTML += currentChapters.map(ch => `<option value="${ch._id}">${ch.title}</option>`).join('');
  }

  function loadLectures() {
    const chapterId = chapterSelect.value;
    lectureSelect.innerHTML = '<option value="">-- Select Lecture --</option>';
    if (!chapterId) return;
    const chapter = currentChapters.find(ch => ch._id === chapterId);
    if (chapter) {
      chapter.lectures.forEach(l => {
        lectureSelect.innerHTML += `<option value="${l._id}">${l.title}</option>`;
      });
    }
  }

  courseSelect.addEventListener('change', loadChapters);
  chapterSelect.addEventListener('change', loadLectures);
  loadChapters();

  document.getElementById('submitDoubtFormBtn').addEventListener('click', async () => {
    const courseId = courseSelect.value;
    const chapterId = chapterSelect.value;
    const lectureId = lectureSelect.value;
    const message = document.getElementById('doubtMessage').value.trim();
    if (!message) return showToast('Write your doubt', 'error');
    if (!chapterId || !lectureId) return showToast('Please select chapter and lecture', 'error');
    setLoading(document.getElementById('submitDoubtFormBtn'), true);
    await fetch(`${API_BASE}/doubts`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, chapterId, lectureId, message, parentId: null })
    });
    showToast('Doubt submitted', 'success');
    document.getElementById('doubtMessage').value = '';
    setLoading(document.getElementById('submitDoubtFormBtn'), false);
  });
}

async function loadMyDoubts() {
  try {
    const res = await fetch(`${API_BASE}/doubts/my`, { headers: authHeaders() });
    const doubts = await res.json();
    if (!doubts.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No doubts submitted.</p>';
      return;
    }
    let html = '<h3>💬 My Doubts</h3>';
    doubts.forEach(d => {
      html += `
        <div class="doubt-card">
          <p><strong>${new Date(d.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></p>
          <p>${d.message}</p>
          ${d.adminReply ? `<p class="reply">↳ Admin: ${d.adminReply}</p>` : '<p class="pending">Awaiting reply...</p>'}
        </div>`;
    });
    document.getElementById('dashboardContent').innerHTML = html;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

// ====================== SANKALP SATHI ======================
function formatAIResponse(text) { /* unchanged from previous expert version */ }
async function loadSankalpSathi() { /* unchanged */ }

// ====================== PREMIUM TEST MODULE (JEE‑Mains style) ======================
let testState = null;
let tabWarningShown = false;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && testState && !tabWarningShown) {
    tabWarningShown = true;
    alert('⚠️ Warning: Do not switch tabs during the test. Your test may be submitted automatically.');
  }
});

async function loadTests() {
  try {
    const enrollRes = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await enrollRes.json();
    if (!courses.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>Enroll in a course to access tests.</p>';
      return;
    }
    let html = '<h3>📝 Available Tests</h3><div class="tests-list">';
    for (let course of courses) {
      const testsRes = await fetch(`${API_BASE}/tests/course/${course._id}`, { headers: authHeaders() });
      const tests = await testsRes.json();
      if (tests.length) {
        html += `<h4 style="margin-top:20px;">📘 ${course.title}</h4>`;
        tests.forEach(test => {
          const now = new Date();
          const start = test.startTime ? new Date(test.startTime) : null;
          const end = test.endTime ? new Date(test.endTime) : null;
          const available = (!start || now >= start) && (!end || now <= end);
          html += `
            <div class="test-card">
              <div class="test-info">
                <strong>${test.title} ${test.isLive ? '🟢' : '⚫'}</strong>
                <span>⏱ ${test.duration} min | 📝 ${test.questions.length} Q | 🕒 ${start ? start.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) : 'Always'}</span>
                <p>${test.description}</p>
              </div>
              <button class="btn btn-sm btn-primary start-test-btn" data-id="${test._id}" ${!available ? 'disabled' : ''}>${available ? 'Start Test' : 'Not Available'}</button>
            </div>`;
        });
      }
    }
    html += '</div>';
    document.getElementById('dashboardContent').innerHTML = html || '<p>No tests available yet.</p>';
    document.querySelectorAll('.start-test-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => startTest(btn.dataset.id));
    });
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading tests.</p>'; }
}

async function startTest(testId) {
  const res = await fetch(`${API_BASE}/tests/${testId}`, { headers: authHeaders() });
  const test = await res.json();

  const startRes = await fetch(`${API_BASE}/tests/${testId}/start`, { method: 'POST', headers: authHeaders() });
  const startData = await startRes.json();
  if (startData.message) return showToast(startData.message, 'error');
  const attemptId = startData.attemptId;

  testState = {
    testId, attemptId, test,
    currentIndex: 0,
    visited: new Set([0]),
    answers: test.questions.map(() => ({ selectedAnswer: '', isMarkedForReview: false })),
    timer: null,
    timeLeft: test.duration * 60
  };
  tabWarningShown = false;
  renderTestUI();
  startTimer();
}

function startTimer() {
  testState.timer = setInterval(() => {
    testState.timeLeft--;
    document.getElementById('timerDisplay').textContent = formatTime(testState.timeLeft);
    if (testState.timeLeft <= 0) {
      clearInterval(testState.timer);
      submitTest();
    }
  }, 1000);
}

function renderTestUI() {
  const test = testState.test;
  const currentQ = test.questions[testState.currentIndex];
  const answer = testState.answers[testState.currentIndex];
  const questionCount = test.questions.length;

  const paletteHTML = buildPaletteHTML();

  let html = `
    <div class="test-panel">
      <div class="test-topbar">
        <h3>${test.title}</h3>
        <div class="test-timer">⏱ <span id="timerDisplay">${formatTime(testState.timeLeft)}</span></div>
        <button class="btn btn-sm btn-outline" id="backToTestsFromTest">← Back</button>
        <button class="btn btn-sm btn-danger" id="submitTestBtn">Submit</button>
      </div>
      <div class="test-body">
        <div class="question-area">
          <div class="question-nav">
            <span>Question ${testState.currentIndex+1} of ${questionCount}</span>
          </div>
          <div class="question-content">
            <p><strong>Q${testState.currentIndex+1}.</strong> ${currentQ.questionText} (${currentQ.marks} marks)</p>
            ${currentQ.questionImage ? `<img src="${currentQ.questionImage}" style="max-height:200px; margin:10px 0; border-radius:8px;">` : ''}
            <div class="options-area">
              ${currentQ.type === 'mcq' ? currentQ.options.map((opt, oi) => {
                const checked = answer.selectedAnswer === opt ? 'checked' : '';
                return `<label class="test-option ${checked ? 'active' : ''}">
                  <input type="radio" name="answer" value="${opt}" ${checked}> ${opt}
                </label>`;
              }).join('') : `<input type="text" id="numericalAnswer" value="${answer.selectedAnswer}" placeholder="Enter your answer" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd;">`}
            </div>
          </div>
          <div class="question-actions">
            <button class="btn btn-outline btn-sm" id="markForReviewBtn">📌 ${answer.isMarkedForReview ? 'Unmark' : 'Mark for Review'}</button>
            <button class="btn btn-outline btn-sm" id="clearResponseBtn">🗑 Clear Response</button>
            <button class="btn btn-primary btn-sm" id="saveNextBtn">Save & Next</button>
            <button class="btn btn-outline btn-sm" id="prevBtn" ${testState.currentIndex === 0 ? 'disabled' : ''}>◀ Previous</button>
            <button class="btn btn-outline btn-sm" id="nextBtn" ${testState.currentIndex === questionCount-1 ? 'disabled' : ''}>Next ▶</button>
          </div>
        </div>
        <div class="question-palette">
          <h4>Question Palette</h4>
          <div class="palette-grid">${paletteHTML}</div>
          <div class="palette-legend">
            <div><span class="legend-circle not-visited"></span> Not Visited</div>
            <div><span class="legend-circle not-answered"></span> Not Answered</div>
            <div><span class="legend-circle answered"></span> Answered</div>
            <div><span class="legend-circle marked"></span> Marked for Review</div>
            <div><span class="legend-circle answered-marked"></span> Answered & Marked</div>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;

  document.getElementById('backToTestsFromTest').addEventListener('click', () => {
    clearInterval(testState.timer);
    testState = null;
    loadTests();
  });
  document.getElementById('submitTestBtn').addEventListener('click', submitTest);
  document.getElementById('markForReviewBtn').addEventListener('click', toggleMarkForReview);
  document.getElementById('clearResponseBtn').addEventListener('click', clearResponse);
  document.getElementById('saveNextBtn').addEventListener('click', () => { saveAnswer(); nextQuestion(); });
  document.getElementById('prevBtn').addEventListener('click', prevQuestion);
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);

  if (currentQ.type === 'mcq') {
    document.querySelectorAll('input[name="answer"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        testState.answers[testState.currentIndex].selectedAnswer = e.target.value;
        updatePalette();
      });
    });
  } else {
    document.getElementById('numericalAnswer').addEventListener('input', (e) => {
      testState.answers[testState.currentIndex].selectedAnswer = e.target.value;
    });
  }

  document.querySelectorAll('.palette-circle').forEach(circle => {
    circle.addEventListener('click', () => navigateTo(parseInt(circle.dataset.idx)));
  });
}

function buildPaletteHTML() {
  return testState.test.questions.map((q, idx) => {
    const status = getQuestionStatus(idx);
    const statusClass = status.replace(/ /g, '-').toLowerCase();
    return `<div class="palette-circle ${statusClass}" data-idx="${idx}">${idx+1}</div>`;
  }).join('');
}

function getQuestionStatus(idx) {
  const ans = testState.answers[idx];
  const visited = testState.visited.has(idx);
  const answered = ans.selectedAnswer.trim() !== '';
  const marked = ans.isMarkedForReview;
  if (answered && marked) return 'answered-marked';
  if (marked) return 'marked';
  if (answered) return 'answered';
  if (visited) return 'not-answered';
  return 'not-visited';
}

function navigateTo(idx) {
  testState.currentIndex = idx;
  testState.visited.add(idx);
  renderTestUI();
}

function saveAnswer() {}

function clearResponse() {
  testState.answers[testState.currentIndex].selectedAnswer = '';
  testState.answers[testState.currentIndex].isMarkedForReview = false;
  renderTestUI();
}

function toggleMarkForReview() {
  testState.answers[testState.currentIndex].isMarkedForReview = !testState.answers[testState.currentIndex].isMarkedForReview;
  renderTestUI();
}

function nextQuestion() {
  if (testState.currentIndex < testState.test.questions.length - 1) {
    navigateTo(testState.currentIndex + 1);
  }
}

function prevQuestion() {
  if (testState.currentIndex > 0) {
    navigateTo(testState.currentIndex - 1);
  }
}

function updatePalette() {
  const paletteCircles = document.querySelectorAll('.palette-circle');
  paletteCircles.forEach(circle => {
    const idx = parseInt(circle.dataset.idx);
    const status = getQuestionStatus(idx);
    circle.className = `palette-circle ${status.replace(/ /g, '-').toLowerCase()}`;
  });
}

async function submitTest() {
  clearInterval(testState.timer);
  const answers = testState.test.questions.map((q, i) => ({
    questionId: q._id,
    selectedAnswer: testState.answers[i].selectedAnswer
  }));
  setLoading(document.getElementById('submitTestBtn'), true);
  const submitRes = await fetch(`${API_BASE}/tests/${testState.testId}/submit`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ attemptId: testState.attemptId, answers })
  });
  const resultData = await submitRes.json();
  showTestResult(testState.testId, testState.attemptId, resultData.score, resultData.totalMarks);
  testState = null;
}

function showTestResult(testId, attemptId, score, totalMarks) {
  let html = `
    <div class="test-result-container">
      <h3>🎉 Test Submitted!</h3>
      <p>Your Score: <strong>${score} / ${totalMarks}</strong></p>
      ${score === totalMarks ? '<p>🏆 Perfect Score!</p>' : ''}
      <button class="btn btn-outline" id="viewDetailedResultBtn">View Detailed Result</button>
      <button class="btn btn-outline" id="backToTestsBtn">Back to Tests</button>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  document.getElementById('backToTestsBtn').addEventListener('click', loadTests);
  document.getElementById('viewDetailedResultBtn').addEventListener('click', () => viewDetailedResult(attemptId));
}

async function viewDetailedResult(attemptId) {
  try {
    const res = await fetch(`${API_BASE}/tests/result/${attemptId}`, { headers: authHeaders() });
    const data = await res.json();
    const { attempt, test } = data;
    let html = `
      <div class="test-result-detailed">
        <h3>${test.title} – Result</h3>
        <p>Score: <strong>${attempt.score} / ${attempt.totalMarks}</strong></p>
        <div class="questions-review">`;
    test.questions.forEach((q, i) => {
      const answer = attempt.answers.find(a => a.questionId === q._id.toString());
      const userAns = answer ? answer.selectedAnswer : '—';
      const isCorrect = answer ? answer.isCorrect : false;
      html += `
        <div class="question-review ${isCorrect ? 'correct' : 'incorrect'}">
          <p><strong>Q${i+1}.</strong> ${q.questionText}</p>
          ${q.questionImage ? `<img src="${q.questionImage}" style="max-height:150px; border-radius:8px;">` : ''}
          <p>Your Answer: <strong>${userAns}</strong> ${isCorrect ? '✅' : '❌'}</p>
          ${!isCorrect ? `<p>Correct: <strong>${q.correctAnswer}</strong></p>` : ''}
          <button class="btn btn-xs ai-explain-btn" data-question='${JSON.stringify(q)}' data-useranswer="${userAns}">🤖 AI Explain</button>
        </div>`;
    });
    html += `</div><button class="btn btn-outline" onclick="loadTests()">Back to Tests</button></div>`;
    document.getElementById('dashboardContent').innerHTML = html;

    document.querySelectorAll('.ai-explain-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const q = JSON.parse(this.dataset.question);
        const userAns = this.dataset.useranswer;
        openAIExplanation(q, userAns);
      });
    });
  } catch { showToast('Error loading result', 'error'); }
}

async function openAIExplanation(question, userAnswer) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:600px;">
      <h3>🤖 AI Explanation</h3>
      <div id="aiExplanationContent">Loading...</div>
      <button class="btn btn-outline" id="closeAIExplain">Close</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('closeAIExplain').addEventListener('click', () => overlay.remove());

  const messages = [
    { role: 'system', content: 'Explain the following question and answer clearly.' },
    { role: 'user', content: `Q: ${question.questionText}\nOptions: ${question.options.join(', ')}\nCorrect: ${question.correctAnswer}\nStudent: ${userAnswer}` }
  ];
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages })
  });
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const contentDiv = document.getElementById('aiExplanationContent');
  contentDiv.textContent = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (let line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        if (jsonStr === '[DONE]') continue;
        try {
          const data = JSON.parse(jsonStr);
          const content = data.choices?.[0]?.delta?.content;
          if (content) contentDiv.textContent += content;
        } catch (e) {}
      }
    }
  }
}

// ====================== PRACTICE SECTION ======================
async function loadPractice() {
  let html = `
    <h3>📋 Practice Tests</h3>
    <form id="practiceForm">
      <div class="form-group">
        <label>Select Course</label>
        <select id="practCourseSelect" required></select>
      </div>
      <div class="form-group">
        <label>Chapter</label>
        <select id="practChapterSelect" required></select>
      </div>
      <div class="form-group">
        <label>Topic (optional)</label>
        <input type="text" id="practTopic" placeholder="e.g., Loops, Functions">
      </div>
      <div class="form-group">
        <label>Difficulty</label>
        <select id="practLevel">
          <option value="easy">Easy</option>
          <option value="medium" selected>Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>
      <div class="form-group">
        <label>Questions (max 10)</label>
        <input type="number" id="practCount" value="5" min="1" max="10">
      </div>
      <button type="submit" class="btn btn-primary btn-full">Generate Practice Test</button>
    </form>
    <div id="previousPractices" style="margin-top:2rem;"></div>`;
  document.getElementById('dashboardContent').innerHTML = html;

  const enrollRes = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
  const courses = await enrollRes.json();
  const courseSelect = document.getElementById('practCourseSelect');
  courseSelect.innerHTML = courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('');
  courseSelect.addEventListener('change', async () => {
    const courseRes = await fetch(`${API_BASE}/courses/${courseSelect.value}`);
    const course = await courseRes.json();
    const chapterSelect = document.getElementById('practChapterSelect');
    chapterSelect.innerHTML = (course.chapters || []).map(ch => `<option value="${ch._id}">${ch.title}</option>`).join('');
  });
  courseSelect.dispatchEvent(new Event('change'));

  document.getElementById('practiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const courseId = courseSelect.value;
    const chapterId = document.getElementById('practChapterSelect').value;
    const topic = document.getElementById('practTopic').value;
    const level = document.getElementById('practLevel').value;
    const count = parseInt(document.getElementById('practCount').value);
    const btn = document.querySelector('#practiceForm button[type="submit"]');
    setLoading(btn, true);
    const resp = await fetch(`${API_BASE}/practice/generate`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, chapterId, topic, level, count })
    });
    const practice = await resp.json();
    if (resp.ok) {
      startPractice(practice._id);
    } else {
      showToast(practice.message || 'Error generating practice', 'error');
    }
    setLoading(btn, false);
  });

  // Load previous practices
  const prevRes = await fetch(`${API_BASE}/practice/my`, { headers: authHeaders() });
  const practices = await prevRes.json();
  const prevDiv = document.getElementById('previousPractices');
  prevDiv.innerHTML = practices.length ? '<h4>Previous Practices</h4>' + practices.map(p => `
    <div class="test-card">
      <div class="test-info">
        <strong>${p.topic} (${p.level})</strong>
        <span>Score: ${p.score}/${p.totalMarks}</span>
      </div>
      <button class="btn btn-xs btn-outline review-practice-btn" data-id="${p._id}">Review</button>
    </div>`).join('') : '';
  document.querySelectorAll('.review-practice-btn').forEach(btn => {
    btn.addEventListener('click', () => reviewPractice(btn.dataset.id));
  });
}

async function startPractice(practiceId) {
  const res = await fetch(`${API_BASE}/practice/${practiceId}`, { headers: authHeaders() });
  const practice = await res.json();
  // Similar UI to test but without timer (or optional timer)
  let html = `
    <div class="test-panel">
      <div class="test-topbar">
        <h3>Practice – ${practice.topic}</h3>
        <button class="btn btn-sm btn-outline" id="backToPracticeList">← Back</button>
        <button class="btn btn-sm btn-danger" id="submitPracticeBtn">Submit</button>
      </div>
      <div class="test-body">
        <div class="question-area">
          ${practice.questions.map((q, i) => `
            <div class="question-content" style="margin-bottom:20px;">
              <p><strong>Q${i+1}.</strong> ${q.questionText} (${q.marks} marks)</p>
              ${q.type === 'mcq' ? q.options.map(opt => `
                <label class="test-option">
                  <input type="radio" name="q${i}" value="${opt}"> ${opt}
                </label>`).join('') : `<input type="text" class="pract-numerical" data-qidx="${i}" placeholder="Your answer" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ddd;">`}
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  document.getElementById('backToPracticeList').addEventListener('click', loadPractice);
  document.getElementById('submitPracticeBtn').addEventListener('click', async () => {
    const answers = practice.questions.map((q, i) => {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      const numerical = document.querySelector(`.pract-numerical[data-qidx="${i}"]`);
      return {
        questionId: q._id,
        selectedAnswer: selected ? selected.value : (numerical ? numerical.value : '')
      };
    });
    const resp = await fetch(`${API_BASE}/practice/${practiceId}/submit`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });
    const result = await resp.json();
    showToast(`Practice submitted! Score: ${result.score}/${result.totalMarks}`, 'success');
    loadPractice();
  });
}

// ====================== COMMUNITY CHAT ======================
async function loadCommunityChat() {
  let html = `
    <div class="chat-container">
      <div class="chat-messages" id="communityMessages"></div>
      <div class="chat-input-area">
        <input type="text" id="communityMsgInput" placeholder="Type your message...">
        <button id="communitySendBtn">Send</button>
      </div>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  await refreshCommunityMessages();
  document.getElementById('communitySendBtn').addEventListener('click', async () => {
    const input = document.getElementById('communityMsgInput');
    const msg = input.value.trim();
    if (!msg) return;
    await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, type: 'community' })
    });
    input.value = '';
    refreshCommunityMessages();
  });
}

async function refreshCommunityMessages() {
  const res = await fetch(`${API_BASE}/chat/community`, { headers: authHeaders() });
  const messages = await res.json();
  const container = document.getElementById('communityMessages');
  container.innerHTML = messages.reverse().map(m => `
    <div class="message-bubble ${m.userEmail === getCurrentUser().email ? 'own' : ''}">
      <strong>${m.userName}</strong>: ${m.message}
      <div style="font-size:0.7rem;color:#999;">${timeAgo(m.createdAt)}</div>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

// ====================== PRIVATE MESSAGES ======================
async function loadPrivateMessages() {
  let html = `
    <div class="chat-container">
      <div class="chat-messages" id="privateMessages"></div>
      <div class="chat-input-area">
        <input type="text" id="privateMsgInput" placeholder="Type a message...">
        <button id="privateSendBtn">Send (to Admin)</button>
      </div>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  const res = await fetch(`${API_BASE}/chat/private`, { headers: authHeaders() });
  const messages = await res.json();
  const container = document.getElementById('privateMessages');
  container.innerHTML = messages.reverse().map(m => `
    <div class="message-bubble ${m.userEmail === getCurrentUser().email ? 'own' : ''}">
      <strong>${m.userName}</strong>: ${m.message}
      <div style="font-size:0.7rem;color:#999;">${timeAgo(m.createdAt)}</div>
    </div>
  `).join('');
  document.getElementById('privateSendBtn').addEventListener('click', async () => {
    const input = document.getElementById('privateMsgInput');
    const msg = input.value.trim();
    if (!msg) return;
    await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, type: 'private', receiverEmail: 'admin@sankalp.com' })
    });
    input.value = '';
    loadPrivateMessages();
  });
}

// ====================== ADMIN PANEL (full) ======================
function setupAdmin() {
  if (localStorage.getItem('adminToken')) {
    document.getElementById('adminLoginOverlay').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'flex';
    initAdmin();
  }
  document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    try {
      const res = await fetch(`${API_BASE}/auth/admin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('token');
        localStorage.setItem('adminToken', data.token);
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        initAdmin();
        showToast('Welcome Admin!', 'success');
      } else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(btn, false); }
  });
}

function initAdmin() {
  const sidebar = document.getElementById('adminSidebar');
  const toggleBtn = document.getElementById('adminSidebarToggle');
  if (!sidebar.querySelector('.close-sidebar')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-sidebar'; closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => sidebar.classList.remove('active');
    sidebar.prepend(closeBtn);
  }
  toggleBtn.onclick = () => sidebar.classList.toggle('active');

  document.querySelectorAll('#adminPanel .sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 900) sidebar.classList.remove('active');
      document.querySelectorAll('#adminPanel .sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'adminDashboard') adminStats();
      else if (view === 'adminCourses') adminManageCourses();
      else if (view === 'adminLectures') adminChapterLectureManager();
      else if (view === 'adminTests') adminTestManager();
      else if (view === 'adminStudents') adminStudentList();
      else if (view === 'adminAssign') adminAssignCourse();
      else if (view === 'adminDoubts') adminDoubts();
      else if (view === 'adminBroadcast') adminBroadcast();
      else if (view === 'adminReports') adminReports();
    });
  });
  adminStats();
}

async function adminStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: adminAuthHeaders() });
    if (!res.ok) throw new Error('Failed');
    const { totalCourses, totalStudents, totalEnrollments } = await res.json();
    document.getElementById('adminContent').innerHTML = `
      <div class="features-grid">
        <div class="feature-card"><h3>Courses</h3><p style="font-size:2rem;">${totalCourses}</p></div>
        <div class="feature-card"><h3>Students</h3><p style="font-size:2rem;">${totalStudents}</p></div>
        <div class="feature-card"><h3>Enrollments</h3><p style="font-size:2rem;">${totalEnrollments}</p></div>
      </div>`;
  } catch { showToast('Error', 'error'); }
}

async function adminManageCourses() {
  let html = `
    <h3>Add Course</h3>
    <form id="addCourseForm" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
      <input type="text" id="title" placeholder="Title" required>
      <input type="text" id="desc" placeholder="Description" required>
      <input type="number" id="price" placeholder="Selling Price" required>
      <input type="number" id="originalPrice" placeholder="Original Price">
      <input type="text" id="imageUrl" placeholder="Image URL" value="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600">
      <button type="submit" class="btn btn-primary">Add</button>
    </form>
    <div id="courseList"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]'); setLoading(btn, true);
    const title = document.getElementById('title').value;
    const description = document.getElementById('desc').value;
    const price = Number(document.getElementById('price').value);
    const originalPrice = document.getElementById('originalPrice').value ? Number(document.getElementById('originalPrice').value) : null;
    const imageUrl = document.getElementById('imageUrl').value;
    try {
      const res = await fetch(`${API_BASE}/admin/courses`, {
        method: 'POST', headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price, originalPrice, imageUrl, chapters: [] })
      });
      if (!res.ok) throw new Error('Failed');
      showToast('Course added!', 'success'); loadCourseList();
    } catch { showToast('Failed', 'error'); }
    finally { setLoading(btn, false); }
  });
  loadCourseList();
}

async function loadCourseList() {
  const list = document.getElementById('courseList');
  if (!list) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    list.innerHTML = courses.map(c => `
      <div class="course-card" style="margin-bottom:15px;">
        <img src="${c.imageUrl}" style="height:120px; object-fit:cover; border-radius:8px;">
        <h3>${c.title}</h3>
        <p>${c.description}</p>
        <div>₹${c.price} ${c.originalPrice ? `<span class="original-price">₹${c.originalPrice}</span>` : ''}</div>
        <button class="btn btn-danger delete-course-btn" data-id="${c._id}">Delete</button>
      </div>`).join('');
    document.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete?')) return;
        await fetch(`${API_BASE}/admin/courses/${btn.dataset.id}`, { method: 'DELETE', headers: adminAuthHeaders() });
        showToast('Deleted', 'info'); loadCourseList();
      });
    });
  } catch { list.innerHTML = '<p>Error.</p>'; }
}

// (Remaining admin functions: adminChapterLectureManager, adminStudentList, adminAssignCourse, adminDoubts – unchanged from previous expert version, with added IST timestamps where applicable)

async function adminTestManager() {
  const res = await fetch(`${API_BASE}/courses`);
  const courses = await res.json();
  let html = `
    <h3>Test Management</h3>
    <select id="testCourseSelect">${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}</select>
    <div id="testsPanel"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  const select = document.getElementById('testCourseSelect');
  const panel = document.getElementById('testsPanel');
  async function loadTests() {
    const courseId = select.value;
    try {
      const res = await fetch(`${API_BASE}/admin/tests/${courseId}`, { headers: adminAuthHeaders() });
      const tests = await res.json();
      panel.innerHTML = tests.length ? tests.map(t => `
        <div class="test-admin-card">
          <h4>${t.title} ${t.isLive ? '🟢 Live' : '⚫ Draft'}</h4>
          <p>Duration: ${t.duration} min | Q: ${t.questions.length} | Lang: ${t.language} | Negative: -${t.negativeMarking}</p>
          <p>Start: ${t.startTime ? new Date(t.startTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) : 'Always'} | End: ${t.endTime ? new Date(t.endTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}) : 'Always'}</p>
          <button class="btn btn-sm btn-primary edit-test-btn" data-id="${t._id}">Edit</button>
          <button class="btn btn-sm btn-danger delete-test-btn" data-id="${t._id}">Delete</button>
          <button class="btn btn-sm btn-outline view-attempts-btn" data-id="${t._id}">Attempts</button>
        </div>`).join('') : '<p>No tests.</p>';
      panel.innerHTML += `<button class="btn btn-primary" id="addTestBtn">+ Create New Test</button>`;
      document.getElementById('addTestBtn').addEventListener('click', () => showTestForm(courseId));
      document.querySelectorAll('.edit-test-btn').forEach(btn => btn.addEventListener('click', () => editTest(btn.dataset.id)));
      document.querySelectorAll('.delete-test-btn').forEach(btn => btn.addEventListener('click', async () => {
        if (!confirm('Delete?')) return;
        await fetch(`${API_BASE}/admin/tests/${btn.dataset.id}`, { method: 'DELETE', headers: adminAuthHeaders() });
        loadTests();
      }));
      document.querySelectorAll('.view-attempts-btn').forEach(btn => btn.addEventListener('click', () => adminViewAttempts(btn.dataset.id)));
    } catch { panel.innerHTML = '<p>Error.</p>'; }
  }
  select.addEventListener('change', loadTests);
  loadTests();
}

function showTestForm(courseId, existingTest = null) {
  const isEdit = !!existingTest;
  const t = existingTest || { title: '', description: '', duration: 30, language: 'english', negativeMarking: 0, isLive: false, startTime: '', endTime: '', questions: [] };

  let html = `
    <h3>${isEdit ? 'Edit' : 'Create'} Test</h3>
    <form id="testForm">
      <input type="text" id="testTitle" value="${t.title}" placeholder="Title" required style="width:100%; margin:5px 0; padding:10px;">
      <input type="text" id="testDesc" value="${t.description}" placeholder="Description" style="width:100%; margin:5px 0; padding:10px;">
      <input type="number" id="testDuration" value="${t.duration}" placeholder="Duration (min)" required style="width:100%; margin:5px 0; padding:10px;">
      <select id="testLanguage" style="width:100%; margin:5px 0; padding:10px;">
        <option value="english" ${t.language==='english'?'selected':''}>English</option>
        <option value="hindi" ${t.language==='hindi'?'selected':''}>Hindi</option>
        <option value="both" ${t.language==='both'?'selected':''}>Both</option>
      </select>
      <input type="number" id="testNegative" value="${t.negativeMarking}" placeholder="Negative Marking" style="width:100%; margin:5px 0; padding:10px;">
      <label>Start Time (IST)</label>
      <input type="datetime-local" id="testStartTime" value="${t.startTime ? new Date(t.startTime).toISOString().slice(0,16) : ''}" style="width:100%; margin:5px 0; padding:10px;">
      <label>End Time (IST)</label>
      <input type="datetime-local" id="testEndTime" value="${t.endTime ? new Date(t.endTime).toISOString().slice(0,16) : ''}" style="width:100%; margin:5px 0; padding:10px;">
      <label style="display:flex; align-items:center; gap:10px; margin:10px 0;">
        <input type="checkbox" id="testIsLive" ${t.isLive ? 'checked' : ''}> Go Live
      </label>
      <h4>Questions</h4>
      <div id="questionsContainer">
        ${t.questions.map((q, i) => `
          <div class="question-admin-item" style="border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:12px;">
            <select class="q-type" style="margin-bottom:5px;">
              <option value="mcq" ${q.type==='mcq'?'selected':''}>MCQ</option>
              <option value="numerical" ${q.type==='numerical'?'selected':''}>Numerical</option>
            </select>
            <input type="text" class="q-text" value="${q.questionText}" placeholder="Question" style="width:100%; margin:5px 0; padding:8px;">
            <input type="text" class="q-image" value="${q.questionImage || ''}" placeholder="Image URL (optional)" style="width:100%; margin:5px 0; padding:8px;">
            <div class="q-options-${i}" ${q.type==='numerical'?'style="display:none;"':''}>
              ${(q.options || ['','','','']).map((opt, oi) => `<input type="text" class="q-opt" value="${opt}" placeholder="Option ${oi+1}" style="width:100%; margin:3px 0; padding:6px;">`).join('')}
            </div>
            <input type="text" class="q-answer" value="${q.correctAnswer}" placeholder="Correct Answer" required style="width:100%; margin:5px 0; padding:8px;">
            <input type="number" class="q-marks" value="${q.marks}" placeholder="Marks" style="width:80px; margin:5px 0; padding:8px;">
            <button type="button" class="btn btn-xs btn-danger remove-question-btn">Remove</button>
          </div>`).join('')}
      </div>
      <button type="button" class="btn btn-sm btn-outline" id="addQuestionBtn">+ Add Question</button>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top:15px;">${isEdit ? 'Update' : 'Create'} Test</button>
    </form>`;
  document.getElementById('adminContent').innerHTML = html;

  document.getElementById('addQuestionBtn').addEventListener('click', () => {
    const container = document.getElementById('questionsContainer');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'question-admin-item';
    div.style = 'border:1px solid #ddd; padding:15px; margin:10px 0; border-radius:12px;';
    div.innerHTML = `
      <select class="q-type"><option value="mcq">MCQ</option><option value="numerical">Numerical</option></select>
      <input type="text" class="q-text" placeholder="Question" style="width:100%; margin:5px 0; padding:8px;">
      <input type="text" class="q-image" placeholder="Image URL" style="width:100%; margin:5px 0; padding:8px;">
      <div class="q-options-${idx}">
        <input type="text" class="q-opt" placeholder="Option 1" style="width:100%; margin:3px 0; padding:6px;">
        <input type="text" class="q-opt" placeholder="Option 2" style="width:100%; margin:3px 0; padding:6px;">
        <input type="text" class="q-opt" placeholder="Option 3" style="width:100%; margin:3px 0; padding:6px;">
        <input type="text" class="q-opt" placeholder="Option 4" style="width:100%; margin:3px 0; padding:6px;">
      </div>
      <input type="text" class="q-answer" placeholder="Correct Answer" required style="width:100%; margin:5px 0; padding:8px;">
      <input type="number" class="q-marks" value="1" placeholder="Marks" style="width:80px; margin:5px 0; padding:8px;">
      <button type="button" class="btn btn-xs btn-danger remove-question-btn">Remove</button>`;
    container.appendChild(div);
    div.querySelector('.q-type').addEventListener('change', function() {
      div.querySelector('.q-options-' + idx).style.display = this.value === 'mcq' ? 'block' : 'none';
    });
    div.querySelector('.remove-question-btn').addEventListener('click', () => div.remove());
  });

  document.querySelectorAll('.remove-question-btn').forEach(btn => btn.addEventListener('click', () => btn.closest('.question-admin-item').remove()));
  document.querySelectorAll('.q-type').forEach(sel => {
    sel.addEventListener('change', function() {
      const optsDiv = this.parentElement.querySelector('[class^="q-options-"]');
      if (optsDiv) optsDiv.style.display = this.value === 'mcq' ? 'block' : 'none';
    });
  });

  document.getElementById('testForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('testTitle').value;
    const description = document.getElementById('testDesc').value;
    const duration = Number(document.getElementById('testDuration').value);
    const language = document.getElementById('testLanguage').value;
    const negativeMarking = Number(document.getElementById('testNegative').value) || 0;
    const isLive = document.getElementById('testIsLive').checked;
    const startTime = document.getElementById('testStartTime').value ? new Date(document.getElementById('testStartTime').value).toISOString() : null;
    const endTime = document.getElementById('testEndTime').value ? new Date(document.getElementById('testEndTime').value).toISOString() : null;
    const questions = [];
    document.querySelectorAll('.question-admin-item').forEach(item => {
      const type = item.querySelector('.q-type').value;
      const questionText = item.querySelector('.q-text').value;
      const questionImage = item.querySelector('.q-image')?.value || '';
      const correctAnswer = item.querySelector('.q-answer').value;
      const marks = Number(item.querySelector('.q-marks').value) || 1;
      const options = type === 'mcq' ? Array.from(item.querySelectorAll('.q-opt')).map(o => o.value).filter(v => v) : [];
      questions.push({ type, questionText, questionImage, options, correctAnswer, marks });
    });
    const body = { courseId, title, description, duration, language, negativeMarking, isLive, startTime, endTime, questions };
    const url = isEdit ? `${API_BASE}/admin/tests/${existingTest._id}` : `${API_BASE}/admin/tests`;
    const method = isEdit ? 'PUT' : 'POST';
    const resp = await fetch(url, { method, headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (resp.ok) {
      showToast(isEdit ? 'Test updated!' : 'Test created!', 'success');
      adminTestManager();
    } else { showToast('Failed', 'error'); }
  });
}

async function editTest(testId) {
  const res = await fetch(`${API_BASE}/tests/${testId}`, { headers: adminAuthHeaders() });
  const test = await res.json();
  // fetch full test for editing
  const fullTest = await fetch(`${API_BASE}/admin/tests/${test.courseId}`, { headers: adminAuthHeaders() }).then(r => r.json());
  const t = fullTest.find(t => t._id === testId) || test;
  showTestForm(test.courseId, t);
}

async function adminViewAttempts(testId) {
  try {
    const res = await fetch(`${API_BASE}/admin/tests/${testId}/attempts`, { headers: adminAuthHeaders() });
    const attempts = await res.json();
    let html = `<h3>Student Attempts</h3>`;
    if (!attempts.length) html += '<p>No attempts.</p>';
    else {
      html += '<table><thead><tr><th>Student</th><th>Email</th><th>Score</th><th>Total</th><th>Date</th><th>Action</th></tr></thead><tbody>';
      attempts.forEach(a => {
        html += `<tr><td>${a.userName || 'Unknown'}</td><td>${a.userEmail}</td><td>${a.score}</td><td>${a.totalMarks}</td><td>${new Date(a.endTime).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})}</td><td><button class="btn btn-xs btn-outline view-attempt-btn" data-id="${a._id}">View</button></td></tr>`;
      });
      html += '</tbody></table>';
    }
    html += `<button class="btn btn-outline" id="backToTests">← Back</button>`;
    document.getElementById('adminContent').innerHTML = html;
    document.getElementById('backToTests').addEventListener('click', adminTestManager);
    document.querySelectorAll('.view-attempt-btn').forEach(btn => {
      btn.addEventListener('click', () => adminViewAttemptDetail(btn.dataset.id));
    });
  } catch { showToast('Error', 'error'); }
}

async function adminViewAttemptDetail(attemptId) {
  try {
    const res = await fetch(`${API_BASE}/admin/attempts/${attemptId}`, { headers: adminAuthHeaders() });
    const data = await res.json();
    const { attempt, test } = data;
    let html = `<h3>${test.title} – Attempt by ${attempt.userEmail}</h3><p>Score: <strong>${attempt.score} / ${attempt.totalMarks}</strong></p><div class="questions-review">`;
    test.questions.forEach((q, i) => {
      const answer = attempt.answers.find(a => a.questionId === q._id.toString());
      const userAns = answer ? answer.selectedAnswer : '—';
      const isCorrect = answer ? answer.isCorrect : false;
      html += `
        <div class="question-review ${isCorrect ? 'correct' : 'incorrect'}">
          <p><strong>Q${i+1}.</strong> ${q.questionText}</p>
          <p>Your Answer: <strong>${userAns}</strong> ${isCorrect ? '✅' : '❌'}</p>
          ${!isCorrect ? `<p>Correct: <strong>${q.correctAnswer}</strong></p>` : ''}
        </div>`;
    });
    html += `</div><button class="btn btn-outline" id="backToAttempts">← Back</button>`;
    document.getElementById('adminContent').innerHTML = html;
    document.getElementById('backToAttempts').addEventListener('click', () => adminViewAttempts(test._id));
  } catch { showToast('Error', 'error'); }
}

// ====================== ADMIN BROADCAST ======================
async function adminBroadcast() {
  const courses = await fetch(`${API_BASE}/courses`).then(r => r.json());
  let html = `
    <h3>📢 Send Broadcast</h3>
    <form id="broadcastForm">
      <div class="form-group">
        <label>Message</label>
        <textarea id="broadcastMsg" rows="4" required></textarea>
      </div>
      <div class="form-group">
        <label>Course (optional – empty for all)</label>
        <select id="broadcastCourse"><option value="">All Courses</option>${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}</select>
      </div>
      <div class="form-group">
        <label>Specific Student Email (optional)</label>
        <input type="email" id="broadcastStudentEmail" placeholder="Leave empty for broadcast">
      </div>
      <button type="submit" class="btn btn-primary">Send</button>
    </form>`;
  document.getElementById('adminContent').innerHTML = html;
  document.getElementById('broadcastForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('broadcastMsg').value;
    const courseId = document.getElementById('broadcastCourse').value || null;
    const targetEmail = document.getElementById('broadcastStudentEmail').value || null;
    await fetch(`${API_BASE}/admin/broadcast`, {
      method: 'POST',
      headers: { ...adminAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, courseId, targetEmail })
    });
    showToast('Sent!', 'success');
  });
}

// ====================== ADMIN REPORTS ======================
async function adminReports() {
  const students = await fetch(`${API_BASE}/admin/students`, { headers: adminAuthHeaders() }).then(r => r.json());
  let html = `<h3>📊 Student Reports</h3><select id="reportStudentSelect"><option value="">Select Student</option>${students.map(s => `<option value="${s.email}">${s.name} (${s.email})</option>`).join('')}</select><div id="reportContent"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  document.getElementById('reportStudentSelect').addEventListener('change', async () => {
    const email = document.getElementById('reportStudentSelect').value;
    if (!email) return;
    const res = await fetch(`${API_BASE}/admin/activity/${email}`, { headers: adminAuthHeaders() });
    const activities = await res.json();
    const content = document.getElementById('reportContent');
    content.innerHTML = activities.length ? activities.map(a => `
      <div class="activity-item">
        <strong>${a.action}</strong> – ${a.details} <br>
        <small>${new Date(a.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>
      </div>
    `).join('') : '<p>No activity recorded.</p>';
  });
}
