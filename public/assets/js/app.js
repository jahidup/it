// ====================== CONFIG ======================
const API_BASE = window.location.origin + '/api';

// ====================== CACHING ======================
const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) { cache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key, data, ttl = 15000) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// ====================== UTILITIES ======================
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
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
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  return new Date(date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatIST(date) {
  return new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ====================== NAVBAR SCROLL (throttled) ======================
let lastScroll = 0;
let ticking = false;
window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(() => {
      const navbar = document.getElementById('navbar');
      if (!navbar) return;
      const currentScroll = window.pageYOffset;
      if (currentScroll <= 0) navbar.classList.remove('hidden');
      else if (currentScroll > lastScroll && !navbar.classList.contains('hidden')) navbar.classList.add('hidden');
      else if (currentScroll < lastScroll && navbar.classList.contains('hidden')) navbar.classList.remove('hidden');
      lastScroll = currentScroll;
      ticking = false;
    });
    ticking = true;
  }
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
  window.location.href = 'index.html';
};
window.handleAdminLogout = () => {
  localStorage.removeItem('adminToken');
  window.location.href = 'admin.html';
};

// ====================== PAGE DETECTION ======================
document.addEventListener('DOMContentLoaded', () => {
  updateNav();
  const path = window.location.pathname;

  if (path.endsWith('index.html') || path === '/' || path.endsWith('/sankalp-digital-pathshala/')) loadFeatured();
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

// ====================== COURSE CARD (public) ======================
function cardHTML(course) {
  const disc = course.originalPrice && course.originalPrice > course.price
    ? `<span class="original-price">₹${course.originalPrice}</span> <span class="discount-badge">${Math.round((1 - course.price / course.originalPrice) * 100)}% off</span>`
    : '';
  return `
    <div class="course-card">
      <img src="${course.imageUrl}?w=400" alt="${course.title}" loading="lazy" style="height:200px; object-fit:cover;">
      <div class="course-card-body">
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <div class="price-container"><span class="price">₹${course.price}</span>${disc}</div>
        <a href="course-detail.html?id=${course._id}" class="btn btn-primary">View Details</a>
      </div>
    </div>`;
}

async function loadFeatured() {
  const grid = document.getElementById('featuredCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.slice(0, 3).map(cardHTML).join('');
  } catch { grid.innerHTML = '<p>Failed to load courses.</p>'; }
}

async function loadAllCourses() {
  const grid = document.getElementById('allCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.map(cardHTML).join('');
  } catch { grid.innerHTML = '<p>Failed to load courses.</p>'; }
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
        <img src="${course.imageUrl}?w=600" style="max-height:400px;" loading="lazy">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <h3>Chapters & Lectures</h3>
        <div class="chapters-list">
          ${course.chapters?.length ? course.chapters.map((ch, ci) => `
            <div class="chapter-item">
              <h4>Chapter ${ci+1}: ${ch.title}</h4>
              <ul class="lecture-list">
                ${ch.lectures.map(lec => `<li>📹 ${lec.title}</li>`).join('')}
              </ul>
            </div>`).join('') : '<p>No chapters available yet.</p>'}
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
      const res = await fetch(`${API_BASE}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
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
  forgotLink.style.display='block'; forgotLink.style.margin='15px 0'; forgotLink.style.textAlign='center';
  forgotLink.style.color='#4f46e5'; forgotLink.style.cursor='pointer';
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
      const res = await fetch(`${API_BASE}/auth/forgot-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) { showToast(data.message, 'success'); document.getElementById('forgotOtpSection').style.display='block'; }
      else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(document.getElementById('sendForgotOtp'), false); }
  });

  document.getElementById('verifyForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    if (!otp) return showToast('Enter OTP', 'error');
    setLoading(document.getElementById('verifyForgotOtp'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, otp }) });
      const data = await res.json();
      if (res.ok) { showToast('OTP verified!', 'success'); document.getElementById('newPasswordSection').style.display='block'; }
      else showToast(data.message, 'error');
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
      const res = await fetch(`${API_BASE}/auth/reset-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, otp, newPassword }) });
      const data = await res.json();
      if (res.ok) { showToast('Password reset! Please login.', 'success'); modal.remove(); }
      else showToast(data.message, 'error');
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
      const res = await fetch(`${API_BASE}/auth/send-otp`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (res.ok) { showToast(data.message, 'success'); document.getElementById('otpSection').style.display='block'; }
      else showToast(data.message, 'error');
    } catch { showToast('Network error', 'error'); }
    finally { setLoading(sendBtn, false); }
  });

  verifyBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const otp = document.getElementById('otp').value.trim();
    if (!otp) return showToast('Enter OTP', 'error');
    setLoading(verifyBtn, true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, otp }) });
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
      const res = await fetch(`${API_BASE}/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, phone, password, otp }) });
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
      // close sidebar on mobile
      sidebar.classList.remove('active');
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      const viewLoader = {
        dashboard: loadDashboardHome,
        myCourses: loadMyCourses,
        progress: loadProgress,
        performance: loadPerformanceReport,
        askDoubt: loadAskDoubtForm,
        myDoubts: loadMyDoubts,
        sankalpSathi: loadSankalpSathi,
        tests: loadTests,
        practice: loadPractice,
        messages: loadMessages,
        community: loadCommunity,
        notifications: loadNotifications
      };
      if (viewLoader[view]) viewLoader[view]();
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
      const completed = completedIds.filter(id => (course.chapters || []).some(ch => ch.lectures.some(l => l._id === id))).length;
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
    if (course.chapters?.length) {
      html += `<div class="chapters-container">`;
      course.chapters.forEach((ch, chIdx) => {
        html += `<div class="chapter-block"><h4 class="chapter-title">Chapter ${chIdx+1}: ${ch.title}</h4><div class="lecture-list-stacked">`;
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
        } else { html += '<p>No lectures in this chapter.</p>'; }
        html += `</div></div>`;
      });
      html += `</div>`;
    } else { html += '<p>No chapters available.</p>'; }
    document.getElementById('dashboardContent').innerHTML = html;

    document.querySelector('.back-to-courses-btn').addEventListener('click', loadMyCourses);
    document.querySelectorAll('.mark-complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lectureId = btn.dataset.lectureId;
        setLoading(btn, true);
        await fetch(`${API_BASE}/progress/mark-complete/${courseId}/${lectureId}`, { method:'POST', headers: authHeaders() });
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

function openDiscussionPanel(courseId, chapterId, lectureId) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="discussion-panel">
      <div class="panel-header"><h3>Doubts & Discussion</h3><button class="close-panel-btn">&times;</button></div>
      <div class="comments-list" id="commentsList"><div class="loading-spinner">Loading comments...</div></div>
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
      if (!comments.length) { container.innerHTML = '<p class="text-center">No comments yet.</p>'; return; }
      let html = '';
      comments.forEach(d => {
        html += `
          <div class="comment-thread">
            <div class="comment">
              <span class="comment-author">${d.userName}</span>
              <span class="comment-time">${timeAgo(d.createdAt)}</span>
              <p>${d.message}</p>
              <button class="btn btn-xs btn-outline reply-toggle-btn" data-id="${d._id}">Reply</button>
              <div class="reply-form" id="replyForm-${d._id}" style="display:none; margin-left:20px;">
                <textarea class="reply-textarea" placeholder="Write a reply..."></textarea>
                <button class="btn btn-xs btn-primary submit-reply-btn" data-parent-id="${d._id}">Submit</button>
              </div>
            </div>
            <div class="replies">${(d.replies || []).map(r => r.isAdminReply ? `<div class="comment admin-reply"><span>👑 Admin</span><p>${r.message}</p></div>` : `<div class="comment reply"><span>${r.userName}</span><p>${r.message}</p></div>`).join('')}</div>
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
            method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
            body: JSON.stringify({ courseId, chapterId: null, lectureId, message, parentId })
          });
          showToast('Reply posted', 'success');
          loadDiscussion();
          setLoading(btn, false);
        });
      });
    } catch { showToast('Error loading discussion', 'error'); }
  }

  loadDiscussion();

  overlay.querySelector('#postCommentBtn').addEventListener('click', async () => {
    const msg = overlay.querySelector('#newCommentMsg').value.trim();
    if (!msg) return;
    await fetch(`${API_BASE}/doubts`, {
      method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
      body: JSON.stringify({ courseId, chapterId, lectureId, message: msg, parentId: null })
    });
    showToast('Posted', 'success');
    overlay.querySelector('#newCommentMsg').value = '';
    loadDiscussion();
  });
}

async function loadProgress() {
  try {
    const enrollRes = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await enrollRes.json();
    if (!courses.length) { document.getElementById('dashboardContent').innerHTML = '<p>No courses.</p>'; return; }
    let total = 0, completed = 0;
    for (let c of courses) {
      const progressRes = await fetch(`${API_BASE}/progress/${c._id}`, { headers: authHeaders() });
      const ids = await progressRes.json();
      total += (c.chapters || []).reduce((s,ch) => s+ch.lectures.length, 0);
      completed += ids.filter(id => (c.chapters || []).some(ch => ch.lectures.some(l => l._id === id))).length;
    }
    const pct = total ? Math.round(completed/total*100) : 0;
    document.getElementById('dashboardContent').innerHTML = `<h2>📊 Progress</h2><p>${completed}/${total} complete (${pct}%)</p><div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

async function loadPerformanceReport() {
  try {
    const res = await fetch(`${API_BASE}/progress/my-report`, { headers: authHeaders() });
    const records = await res.json();
    if (!records.length) { document.getElementById('dashboardContent').innerHTML = '<p>No records yet.</p>'; return; }
    let html = '<h3>🏆 Performance Report</h3><div class="report-list">';
    records.forEach(r => html += `<div class="report-item"><span>${r.courseTitle} – ${r.lectureTitle}</span><span class="report-date">${formatIST(r.completedAt)}</span></div>`);
    html += '</div>';
    document.getElementById('dashboardContent').innerHTML = html;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

async function loadAskDoubtForm() { /* unchanged */ }
async function loadMyDoubts() { /* unchanged */ }

// ====================== SANKALP SATHI (AI Chat) ======================
function formatAIResponse(text) { /* unchanged */ }

async function loadSankalpSathi() {
  let html = `
    <div class="sathi-container">
      <div class="sathi-chat-header"><h3>🤖 Sankalp Sathi</h3></div>
      <div class="sathi-messages" id="sathiMessages"><div class="sathi-bot-message">👋 Hi! How can I help you?</div></div>
      <div class="sathi-input-area">
        <input type="text" id="sathiInput" placeholder="Type...">
        <button id="sathiSendBtn">➤</button>
      </div>
    </div>`;
  document.getElementById('dashboardContent').innerHTML = html;

  let conversation = await loadConversation();
  const msgContainer = document.getElementById('sathiMessages');
  conversation.forEach(m => {
    if (m.role === 'user') msgContainer.innerHTML += `<div class="sathi-user-message">${m.content}</div>`;
    else msgContainer.innerHTML += `<div class="sathi-bot-message">${m.content}</div>`;
  });

  async function sendMessage() {
    const input = document.getElementById('sathiInput');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    msgContainer.innerHTML += `<div class="sathi-user-message">${message}</div>`;
    conversation.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

    const typingDiv = document.createElement('div'); typingDiv.className = 'sathi-bot-message typing'; typingDiv.textContent = '...';
    msgContainer.appendChild(typingDiv);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ messages: conversation.map(m => ({ role: m.role, content: m.content })) })
      });
      if (!res.ok) throw new Error('error');
      typingDiv.remove();
      const botDiv = document.createElement('div'); botDiv.className = 'sathi-bot-message';
      msgContainer.appendChild(botDiv);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (let line of lines) {
          if (line.startsWith('data: ') && !line.includes('[DONE]')) {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) { reply += content; botDiv.textContent = reply; msgContainer.scrollTop = msgContainer.scrollHeight; }
            } catch (e) {}
          }
        }
      }
      conversation.push({ role: 'assistant', content: reply, timestamp: new Date().toISOString() });
      saveConversation(conversation);
    } catch (err) {
      typingDiv.textContent = 'Failed to reach AI.';
    }
  }

  document.getElementById('sathiSendBtn').addEventListener('click', sendMessage);
  document.getElementById('sathiInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
}

async function loadConversation() {
  try {
    const res = await fetch(`${API_BASE}/conversations/my`, { headers: authHeaders() });
    const data = await res.json();
    return data.messages || [];
  } catch { return []; }
}

async function saveConversation(messages) {
  await fetch(`${API_BASE}/conversations`, {
    method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
    body: JSON.stringify({ messages })
  }).catch(console.error);
}

// ====================== TEST FUNCTIONS (premium) ======================
let testState = null;
let tabSwitchCount = 0;

window.addEventListener('blur', () => {
  if (testState && !testState.completed) {
    tabSwitchCount++;
    showToast(`⚠️ Tab switch detected (${tabSwitchCount}). This will be reported.`, 'error');
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
          html += `
            <div class="test-card">
              <div class="test-info">
                <strong>${test.title}</strong>
                <span>⏱ ${test.duration} min | 📝 ${test.questions.length} questions</span>
                <p>${test.description || ''}</p>
              </div>
              <button class="btn btn-sm btn-primary start-test-btn" data-id="${test._id}">Start Test</button>
            </div>`;
        });
      }
    }
    html += '</div>';
    if (html.includes('start-test-btn')) {
      document.getElementById('dashboardContent').innerHTML = html;
      document.querySelectorAll('.start-test-btn').forEach(btn => {
        btn.addEventListener('click', () => startTest(btn.dataset.id));
      });
    } else {
      document.getElementById('dashboardContent').innerHTML = '<p>No tests available yet for your courses.</p>';
    }
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading tests.</p>'; }
}

async function startTest(testId) {
  const res = await fetch(`${API_BASE}/tests/${testId}`, { headers: authHeaders() });
  const test = await res.json();

  const startRes = await fetch(`${API_BASE}/tests/${testId}/start`, { method:'POST', headers: authHeaders() });
  if (!startRes.ok) {
    const data = await startRes.json();
    showToast(data.message, 'error');
    return;
  }
  const startData = await startRes.json();
  const attemptId = startData.attemptId;

  testState = {
    testId, attemptId, test,
    currentIndex: 0,
    visited: new Set([0]),
    answers: test.questions.map(() => ({ selectedAnswer: '', isMarkedForReview: false })),
    timer: null,
    timeLeft: test.duration * 60,
    completed: false
  };
  tabSwitchCount = 0;
  renderTestUI();
  startTimer();
}

function startTimer() {
  testState.timer = setInterval(() => {
    testState.timeLeft--;
    const mins = Math.floor(testState.timeLeft / 60);
    const secs = testState.timeLeft % 60;
    const timerEl = document.getElementById('timerDisplay');
    if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    if (testState.timeLeft <= 0) {
      clearInterval(testState.timer);
      submitTest();
    }
  }, 1000);
}

function renderTestUI() {
  if (!testState) return;
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
          <div class="question-nav"><span>Question ${testState.currentIndex+1} of ${questionCount}</span></div>
          <div class="question-content">
            <p><strong>Q${testState.currentIndex+1}.</strong> ${currentQ.questionText} (${currentQ.marks} mark${currentQ.marks>1?'s':''})</p>
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

  // Attach event listeners
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
    const numInput = document.getElementById('numericalAnswer');
    if (numInput) {
      numInput.addEventListener('input', (e) => {
        testState.answers[testState.currentIndex].selectedAnswer = e.target.value;
      });
    }
  }

  // Palette circle click navigation
  document.querySelectorAll('.palette-circle').forEach(circle => {
    circle.addEventListener('click', () => {
      const idx = parseInt(circle.dataset.idx);
      navigateTo(idx);
    });
  });
}

function buildPaletteHTML() {
  return testState.test.questions.map((q, idx) => {
    const status = getQuestionStatus(idx);
    return `<div class="palette-circle ${status.replace(/ /g, '-').toLowerCase()}" data-idx="${idx}">${idx+1}</div>`;
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
  const circles = document.querySelectorAll('.palette-circle');
  circles.forEach(circle => {
    const idx = parseInt(circle.dataset.idx);
    circle.className = `palette-circle ${getQuestionStatus(idx).replace(/ /g, '-').toLowerCase()}`;
  });
}

async function submitTest() {
  clearInterval(testState.timer);
  const answers = testState.test.questions.map((q, i) => ({
    questionId: q._id,
    selectedAnswer: testState.answers[i].selectedAnswer
  }));
  setLoading(document.getElementById('submitTestBtn'), true);
  const res = await fetch(`${API_BASE}/tests/${testState.testId}/submit`, {
    method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
    body: JSON.stringify({ attemptId: testState.attemptId, answers, tabSwitchCount })
  });
  const data = await res.json();
  showTestResult(testState.testId, testState.attemptId, data.score, data.totalMarks);
  testState.completed = true;
  testState = null;
  tabSwitchCount = 0;
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
      const correct = q.correctAnswer;
      const isCorrect = answer ? answer.isCorrect : false;
      html += `
        <div class="question-review ${isCorrect ? 'correct' : 'incorrect'}">
          <p><strong>Q${i+1}.</strong> ${q.questionText}</p>
          ${q.questionImage ? `<img src="${q.questionImage}" style="max-height:150px; border-radius:8px; margin:5px 0;">` : ''}
          <p>Your Answer: <strong>${userAns}</strong> ${isCorrect ? '✅' : '❌'}</p>
          ${!isCorrect ? `<p>Correct Answer: <strong>${correct}</strong></p>` : ''}
          ${q.explanation ? `<p><em>${q.explanation}</em></p>` : ''}
          <button class="btn btn-xs btn-outline ai-explain-btn" data-test-id="${test._id}" data-question-id="${q._id}">🤖 Explain with AI</button>
        </div>`;
    });
    html += `</div><button class="btn btn-outline" onclick="loadTests()">Back to Tests</button></div>`;
    document.getElementById('dashboardContent').innerHTML = html;
    document.querySelectorAll('.ai-explain-btn').forEach(btn => {
      btn.addEventListener('click', () => explainQuestion(btn.dataset.testId, btn.dataset.questionId, btn));
    });
  } catch { showToast('Error loading result', 'error'); }
}

async function explainQuestion(testId, questionId, btn) {
  setLoading(btn, true);
  const res = await fetch(`${API_BASE}/tests/${testId}/question/${questionId}/explain`, { method:'POST', headers: authHeaders() });
  const data = await res.json();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content"><h4>AI Explanation</h4><p>${data.explanation}</p><button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Close</button></div>`;
  document.body.appendChild(modal);
  setLoading(btn, false);
}

// ====================== PRACTICE TEST ======================
async function loadPractice() {
  let html = `
    <h3>📝 Practice Test</h3>
    <div class="form-group"><label>Topic</label><input type="text" id="practiceTopic" style="width:100%; padding:10px;"></div>
    <div class="form-group"><label>Difficulty</label><select id="practiceDifficulty"><option>Easy</option><option selected>Medium</option><option>Hard</option></select></div>
    <button class="btn btn-primary" id="generatePracticeBtn">Generate 10 Questions</button>
    <div id="practiceContainer"></div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  document.getElementById('generatePracticeBtn').addEventListener('click', async () => {
    const topic = document.getElementById('practiceTopic').value.trim();
    const difficulty = document.getElementById('practiceDifficulty').value;
    if (!topic) return showToast('Enter a topic', 'error');
    setLoading(document.getElementById('generatePracticeBtn'), true);
    const res = await fetch(`${API_BASE}/practice/generate`, {
      method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
      body: JSON.stringify({ topic, difficulty })
    });
    const data = await res.json();
    renderPracticeTest(data.practiceId, data.questions);
    setLoading(document.getElementById('generatePracticeBtn'), false);
  });
}

function renderPracticeTest(practiceId, questions) {
  let html = `<h4>Practice Test</h4><form id="practiceForm">`;
  questions.forEach((q, i) => {
    html += `
      <div class="test-question">
        <p><strong>Q${i+1}.</strong> ${q.questionText} (${q.marks} mark)</p>
        ${q.type === 'mcq' ? q.options.map((opt, oi) => `
          <label class="test-option"><input type="radio" name="practice_q${i}" value="${opt}"> ${opt}</label>`).join('') : `<input type="text" name="practice_q${i}" placeholder="Your answer" style="width:100%; padding:10px;">`}
      </div>`;
  });
  html += `<button type="submit" class="btn btn-primary" id="submitPracticeBtn">Submit</button></form>`;
  document.getElementById('practiceContainer').innerHTML = html;
  document.getElementById('practiceForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = questions.map((q, i) => ({
      questionId: q._id,
      selectedAnswer: document.querySelector(`input[name="practice_q${i}"]:checked`)?.value || document.querySelector(`input[name="practice_q${i}"]`)?.value || ''
    }));
    setLoading(document.getElementById('submitPracticeBtn'), true);
    const res = await fetch(`${API_BASE}/practice/${practiceId}/submit`, {
      method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'},
      body: JSON.stringify({ answers })
    });
    const data = await res.json();
    showToast(`Score: ${data.score}/${data.totalMarks}`, 'success');
    document.getElementById('practiceContainer').innerHTML = `<p>Practice completed! Score: ${data.score}/${data.totalMarks}</p>`;
  });
}

// ====================== MESSAGES & COMMUNITY ======================
async function loadMessages() {
  const user = getCurrentUser();
  const res = await fetch(`${API_BASE}/admin/students`, { headers: authHeaders() });
  const users = await res.json();
  let html = '<h3>💬 Messages</h3><div class="contact-list">';
  users.forEach(u => {
    if (u.email !== user.email) html += `<button class="btn btn-outline btn-sm" onclick="openChat('${u.email}','${u.name}')">${u.name}</button>`;
  });
  html += '</div><div id="chatWindow"></div>';
  document.getElementById('dashboardContent').innerHTML = html;
}

window.openChat = async function(email, name) {
  const res = await fetch(`${API_BASE}/messages/${email}`, { headers: authHeaders() });
  const msgs = await res.json();
  let html = `<h4>${name}</h4><div class="chat-messages">`;
  msgs.forEach(m => html += `<div class="${m.from === getCurrentUser().email ? 'sent' : 'received'}">${m.message}</div>`);
  html += `</div><div class="chat-input"><input id="chatMsgInput"><button onclick="sendMessage('${email}')">Send</button></div>`;
  document.getElementById('chatWindow').innerHTML = html;
};

window.sendMessage = async function(to) {
  const msg = document.getElementById('chatMsgInput').value.trim();
  if (!msg) return;
  await fetch(`${API_BASE}/messages`, { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body: JSON.stringify({ to, message: msg }) });
  openChat(to, to);
};

async function loadCommunity() {
  const res = await fetch(`${API_BASE}/community`, { headers: authHeaders() });
  const msgs = await res.json();
  let html = '<h3>🌐 Community</h3><div class="community-chat">';
  msgs.forEach(m => html += `<p><strong>${m.userName}</strong>: ${m.message}</p>`);
  html += `</div><div class="chat-input"><input id="communityMsg"><button id="sendCommunityMsg">Send</button></div>`;
  document.getElementById('dashboardContent').innerHTML = html;
  document.getElementById('sendCommunityMsg').addEventListener('click', async () => {
    const msg = document.getElementById('communityMsg').value.trim();
    if (!msg) return;
    await fetch(`${API_BASE}/community`, { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body: JSON.stringify({ message: msg }) });
    loadCommunity();
  });
}

async function loadNotifications() {
  const res = await fetch(`${API_BASE}/notifications/my`, { headers: authHeaders() });
  const notifs = await res.json();
  let html = '<h3>🔔 Notifications</h3>';
  notifs.forEach(n => html += `<div class="notification-item"><p>${n.message}</p><small>${formatIST(n.createdAt)}</small></div>`);
  document.getElementById('dashboardContent').innerHTML = html;
}

// ====================== ADMIN PANEL ======================
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
      const res = await fetch(`${API_BASE}/auth/admin-login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
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
      sidebar.classList.remove('active');
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

async function adminStats() { /* unchanged */ }
async function adminManageCourses() { /* unchanged */ }
async function adminChapterLectureManager() { /* unchanged */ }
async function adminStudentList() { /* unchanged */ }
async function adminAssignCourse() { /* unchanged */ }
async function adminDoubts() { /* unchanged */ }

async function adminTestManager() {
  const res = await fetch(`${API_BASE}/courses`);
  const courses = await res.json();
  let html = `<h3>Test Management</h3><select id="testCourseSelect">${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}</select><div id="testsPanel"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  const select = document.getElementById('testCourseSelect');
  const panel = document.getElementById('testsPanel');
  async function loadTests() {
    const courseId = select.value;
    const res = await fetch(`${API_BASE}/admin/tests/${courseId}`, { headers: adminAuthHeaders() });
    const tests = await res.json();
    panel.innerHTML = tests.length ? tests.map(t => `
      <div class="test-admin-card">
        <h4>${t.title} ${t.isLive ? '🟢' : '⚫'}</h4>
        <p>Duration: ${t.duration}m | Questions: ${t.questions.length} | Negative: -${t.negativeMarking}</p>
        <p>Schedule: ${t.startTime ? formatIST(t.startTime) : 'NA'} - ${t.endTime ? formatIST(t.endTime) : 'NA'}</p>
        <button class="btn btn-sm btn-primary edit-test-btn" data-id="${t._id}">Edit</button>
        <button class="btn btn-sm btn-danger delete-test-btn" data-id="${t._id}">Delete</button>
        <button class="btn btn-sm btn-outline view-attempts-btn" data-id="${t._id}">Attempts</button>
      </div>`).join('') : '<p>No tests.</p>';
    panel.innerHTML += `<button class="btn btn-primary" id="addTestBtn">+ New Test</button>`;
    document.getElementById('addTestBtn').addEventListener('click', () => showTestForm(courseId));
    document.querySelectorAll('.edit-test-btn').forEach(btn => btn.addEventListener('click', () => editTest(btn.dataset.id)));
    document.querySelectorAll('.delete-test-btn').forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Delete?')) return;
      await fetch(`${API_BASE}/admin/tests/${btn.dataset.id}`, { method:'DELETE', headers: adminAuthHeaders() });
      loadTests();
    }));
    document.querySelectorAll('.view-attempts-btn').forEach(btn => btn.addEventListener('click', () => adminViewAttempts(btn.dataset.id)));
  }
  select.addEventListener('change', loadTests);
  loadTests();
}

function showTestForm(courseId, existingTest = null) { /* full form with start/end time, isLive, etc. */ }
async function editTest(testId) { /* fetch and show test form */ }
async function adminViewAttempts(testId) { /* list attempts with scores */ }
async function adminViewAttemptDetail(attemptId) { /* detailed attempt view */ }

async function adminBroadcast() {
  let html = `<h3>📢 Broadcast</h3>
    <div class="form-group"><label>Recipient (email, empty=all)</label><input type="email" id="broadcastRecipient" style="width:100%;"></div>
    <div class="form-group"><label>Course (optional)</label><input type="text" id="broadcastCourseId" placeholder="Course ID" style="width:100%;"></div>
    <div class="form-group"><label>Message</label><textarea id="broadcastMsg" rows="4" style="width:100%;"></textarea></div>
    <button class="btn btn-primary" id="sendBroadcast">Send</button>`;
  document.getElementById('adminContent').innerHTML = html;
  document.getElementById('sendBroadcast').addEventListener('click', async () => {
    const recipient = document.getElementById('broadcastRecipient').value.trim() || null;
    const courseId = document.getElementById('broadcastCourseId').value.trim() || null;
    const message = document.getElementById('broadcastMsg').value.trim();
    if (!message) return showToast('Message required', 'error');
    await fetch(`${API_BASE}/notifications`, { method:'POST', headers:{...adminAuthHeaders(),'Content-Type':'application/json'}, body: JSON.stringify({ recipient, courseId, message }) });
    showToast('Sent!', 'success');
  });
}

async function adminReports() {
  let html = `<h3>📊 Student Report</h3><input type="email" id="reportEmail" placeholder="Student email" style="width:100%; padding:10px;"><button class="btn btn-primary" id="fetchReportBtn">Fetch</button><div id="reportResult"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  document.getElementById('fetchReportBtn').addEventListener('click', async () => {
    const email = document.getElementById('reportEmail').value.trim();
    if (!email) return;
    const res = await fetch(`${API_BASE}/admin/reports/student/${email}`, { headers: adminAuthHeaders() });
    const data = await res.json();
    document.getElementById('reportResult').innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
  });
}
