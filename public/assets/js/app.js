// ====================== CONFIG ======================
const API_BASE = window.location.origin + '/api';

// ====================== SIMPLE CACHE ======================
function cacheGet(key) {
  const entry = JSON.parse(localStorage.getItem(key));
  if (!entry || Date.now() > entry.expiry) return null;
  return entry.data;
}
function cacheSet(key, data, ttl = 15000) {
  localStorage.setItem(key, JSON.stringify({ data, expiry: Date.now() + ttl }));
}

// ====================== HELPER: TIME AGO ======================
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// ====================== TOAST & HELPERS ======================
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

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function setLoading(btn, loading = true) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Processing...' : btn.dataset.originalText;
}

// ====================== NAVBAR SCROLL HIDE ======================
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

// ====================== NAVIGATION UPDATE ======================
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
    initCarousel();
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

// ====================== CAROUSEL ======================
function initCarousel() {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;
  slides.forEach((s, i) => s.style.display = i === 0 ? 'block' : 'none');
  document.querySelector('.next-slide')?.addEventListener('click', () => {
    slides[currentSlide].style.display = 'none';
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].style.display = 'block';
  });
  document.querySelector('.prev-slide')?.addEventListener('click', () => {
    slides[currentSlide].style.display = 'none';
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    slides[currentSlide].style.display = 'block';
  });
}

// ====================== LOAD COURSES (public) ======================
function cardHTML(course) {
  const disc = course.originalPrice && course.originalPrice > course.price
    ? `<span class="original-price">₹${course.originalPrice}</span> <span class="discount-badge">${Math.round((1 - course.price / course.originalPrice) * 100)}% off</span>`
    : '';
  const enrolled = course.enrollmentCount ? `👥 ${course.enrollmentCount} enrolled` : '👥 Be the first to enroll';
  return `
    <div class="course-card">
      <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; height:180px; object-fit:cover; border-radius:12px; margin-bottom:12px;">
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <div class="price-container"><span class="price">₹${course.price}</span>${disc}</div>
      <div class="enrollment-count">${enrolled}</div>
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
        <img src="${course.imageUrl}" style="max-height:400px; object-fit:cover; border-radius:16px; margin-bottom:20px;">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <h3>Lectures</h3>
        <ul class="lecture-list">${course.lectures.map(l => `<li>📹 ${l.title}</li>`).join('')}</ul>
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

// ====================== LOGIN & FORGOT PASSWORD ======================
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
    if(!email) return showToast('Enter email','error');
    setLoading(document.getElementById('sendForgotOtp'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email}) });
      const data = await res.json();
      if(res.ok){ showToast(data.message,'success'); document.getElementById('forgotOtpSection').style.display='block'; }
      else showToast(data.message,'error');
    } catch{ showToast('Network error','error'); }
    finally{ setLoading(document.getElementById('sendForgotOtp'), false); }
  });
  document.getElementById('verifyForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    if(!otp) return showToast('Enter OTP','error');
    setLoading(document.getElementById('verifyForgotOtp'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-reset-otp`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,otp}) });
      const data = await res.json();
      if(res.ok){ showToast('OTP verified!','success'); document.getElementById('newPasswordSection').style.display='block'; }
      else showToast(data.message,'error');
    } catch{ showToast('Network error','error'); }
    finally{ setLoading(document.getElementById('verifyForgotOtp'), false); }
  });
  document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    if(!newPassword) return showToast('Enter new password','error');
    setLoading(document.getElementById('resetPasswordBtn'), true);
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,otp,newPassword}) });
      const data = await res.json();
      if(res.ok){ showToast('Password reset! Please login.','success'); modal.remove(); }
      else showToast(data.message,'error');
    } catch{ showToast('Network error','error'); }
    finally{ setLoading(document.getElementById('resetPasswordBtn'), false); }
  });
}

// ====================== REGISTER ======================
function setupRegister() {
  let otpVerified = false;
  const sendBtn = document.getElementById('sendOtpBtn');
  const verifyBtn = document.getElementById('verifyOtpBtn');
  const regForm = document.getElementById('registerForm');
  const regBtn = document.getElementById('registerBtn');
  if (!sendBtn || !verifyBtn || !regForm) return;
  sendBtn.addEventListener('click', async () => { /* same as before */ });
  verifyBtn.addEventListener('click', async () => { /* same as before */ });
  regForm.addEventListener('submit', async (e) => { /* same as before */ });
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
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'dashboard') loadDashboardHome();
      else if (view === 'myCourses') loadMyCourses();
      else if (view === 'progress') loadProgress();
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
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
}

async function loadMyCourses() {
  try {
    const cacheKey = 'my-enrollments';
    let courses = cacheGet(cacheKey);
    if (!courses) {
      const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed');
      courses = await res.json();
      cacheSet(cacheKey, courses, 15000);
    }
    if (!courses.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No enrolled courses yet.</p>';
      return;
    }
    let html = `<h3>My Courses</h3><div class="compact-course-list">`;
    for (let course of courses) {
      const progressRes = await fetch(`${API_BASE}/progress/${course._id}`, { headers: authHeaders() });
      const completedLectIds = await progressRes.json();
      const total = course.lectures?.length || 0;
      const completed = Array.isArray(completedLectIds) ? completedLectIds.filter(id => course.lectures.some(l => l._id === id)).length : 0;
      html += `
        <div class="compact-course-item">
          <div class="course-info">
            <strong>${course.title}</strong>
            <span class="progress-text">${completed}/${total} completed</span>
          </div>
          <button class="btn btn-sm btn-outline view-lectures-btn" data-id="${course._id}">📂 View Lectures</button>
        </div>`;
    }
    html += `</div>`;
    document.getElementById('dashboardContent').innerHTML = html;
    document.querySelectorAll('.view-lectures-btn').forEach(btn => {
      btn.addEventListener('click', () => viewCourseLectures(btn.dataset.id));
    });
  } catch {
    document.getElementById('dashboardContent').innerHTML = '<p>Error loading courses.</p>';
  }
}

async function viewCourseLectures(courseId) {
  try {
    const res1 = await fetch(`${API_BASE}/courses/${courseId}`);
    const course = await res1.json();
    const res2 = await fetch(`${API_BASE}/progress/${courseId}`, { headers: authHeaders() });
    const completedLectIds = await res2.json();
    let html = `<div class="lecture-header"><button class="btn btn-sm btn-outline back-to-courses-btn">← Back</button><h3>${course.title}</h3></div>`;
    if (course.lectures?.length) {
      html += `<div class="lecture-list-compact">`;
      course.lectures.forEach((lec, i) => {
        const isCompleted = completedLectIds.includes(lec._id);
        const time = timeAgo(lec.createdAt);
        html += `
          <div class="lecture-row">
            <div class="lecture-info">
              <span class="lecture-title">${i+1}. ${lec.title}</span>
              <span class="lecture-time">${time}</span>
              ${isCompleted ? '<span class="badge complete-badge">✔ Done</span>' : ''}
            </div>
            <div class="lecture-actions">
              <a href="${lec.videoUrl}" target="_blank" class="btn btn-xs btn-primary">🎬 Video</a>
              <a href="${lec.notesUrl}" target="_blank" class="btn btn-xs btn-outline">📄 Notes</a>
              ${lec.dppLink ? `<a href="${lec.dppLink}" target="_blank" class="btn btn-xs btn-outline">📝 DPP</a>` : ''}
              ${!isCompleted ? `<button class="btn btn-xs btn-success mark-complete-btn" data-lecture-id="${lec._id}">✅ Complete</button>` : ''}
              <button class="btn btn-xs btn-warning doubt-btn" data-lecture-id="${lec._id}" data-course-id="${course._id}">❓ Doubt</button>
            </div>
          </div>`;
      });
      html += `</div>`;
    } else {
      html += '<p>No lectures available.</p>';
    }
    document.getElementById('dashboardContent').innerHTML = html;

    document.querySelector('.back-to-courses-btn').addEventListener('click', loadMyCourses);
    document.querySelectorAll('.mark-complete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lectureId = btn.dataset.lectureId;
        setLoading(btn, true);
        await fetch(`${API_BASE}/progress/mark-complete/${courseId}/${lectureId}`, { method:'POST', headers: authHeaders() });
        showToast('Marked as complete', 'success');
        viewCourseLectures(courseId);
        setLoading(btn, false);
      });
    });
    document.querySelectorAll('.doubt-btn').forEach(btn => {
      btn.addEventListener('click', () => openDoubtModal(courseId, btn.dataset.lectureId));
    });
  } catch { showToast('Error loading lectures', 'error'); }
}

function openDoubtModal(courseId, lectureId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:450px;">
      <h3>Ask a Doubt</h3>
      <textarea id="doubtMsg" rows="3" placeholder="Type your doubt..." style="width:100%; margin-bottom:10px;"></textarea>
      <button class="btn btn-primary" id="submitDoubtBtn">Submit</button>
      <button class="btn btn-outline" id="closeDoubtModal">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('closeDoubtModal').addEventListener('click', () => modal.remove());
  document.getElementById('submitDoubtBtn').addEventListener('click', async () => {
    const message = document.getElementById('doubtMsg').value.trim();
    if (!message) return showToast('Write something', 'error');
    setLoading(document.getElementById('submitDoubtBtn'), true);
    await fetch(`${API_BASE}/doubts`, {
      method:'POST',
      headers:{...authHeaders(),'Content-Type':'application/json'},
      body: JSON.stringify({ courseId, lectureId, message })
    });
    showToast('Doubt submitted', 'success');
    modal.remove();
  });
}

async function loadProgress() {
  try {
    const enrollRes = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await enrollRes.json();
    if (!courses.length) {
      document.getElementById('dashboardContent').innerHTML = '<p>No courses.</p>';
      return;
    }
    let totalLectures = 0, completedLectures = 0;
    for (let c of courses) {
      const progressRes = await fetch(`${API_BASE}/progress/${c._id}`, { headers: authHeaders() });
      const completedIds = await progressRes.json();
      totalLectures += c.lectures.length;
      completedLectures += completedIds.filter(id => c.lectures.some(l => l._id === id)).length;
    }
    const percent = totalLectures ? Math.round((completedLectures / totalLectures) * 100) : 0;
    document.getElementById('dashboardContent').innerHTML = `
      <h2>📊 Your Progress</h2>
      <p>Overall completion: <strong>${percent}%</strong> (${completedLectures}/${totalLectures} lectures)</p>
      <div class="progress-bar"><div class="progress-fill" style="width:${percent}%"></div></div>`;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error.</p>'; }
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
      document.querySelectorAll('#adminPanel .sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'adminDashboard') adminStats();
      else if (view === 'adminCourses') adminManageCourses();
      else if (view === 'adminLectures') adminLectureManager();
      else if (view === 'adminStudents') adminStudentList();
      else if (view === 'adminAssign') adminAssignCourse();
      else if (view === 'adminDoubts') adminDoubts();
    });
  });

  adminStats();
}

async function adminStats() { /* as before */ }

async function adminManageCourses() { /* with originalPrice */ }
async function loadCourseList() { /* as before */ }

// ---------- LECTURE MANAGER (with edit) ----------
async function adminLectureManager() {
  const res = await fetch(`${API_BASE}/courses`);
  const courses = await res.json();
  let html = `<h3>Manage Lectures</h3><select id="lectureCourseSelect">${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}</select><div id="lectureManagerPanel"></div>`;
  document.getElementById('adminContent').innerHTML = html;
  const select = document.getElementById('lectureCourseSelect');
  const panel = document.getElementById('lectureManagerPanel');
  async function refresh() {
    const courseId = select.value;
    try {
      const res = await fetch(`${API_BASE}/admin/lectures/${courseId}`, { headers: authHeaders() });
      const lectures = await res.json();
      panel.innerHTML = `
        <h4>Lectures</h4>
        ${lectures.map(l => `
          <div class="lecture-item">
            <input type="text" value="${l.title}" class="edit-title" data-id="${l._id}">
            <input type="text" value="${l.videoUrl}" class="edit-video" data-id="${l._id}">
            <input type="text" value="${l.notesUrl}" class="edit-notes" data-id="${l._id}">
            <input type="text" value="${l.dppLink||''}" class="edit-dpp" data-id="${l._id}">
            <input type="text" value="${l.thumbnail||''}" class="edit-thumb" data-id="${l._id}">
            <button class="btn btn-sm btn-primary save-lecture-btn" data-id="${l._id}">Save</button>
            <button class="btn btn-sm btn-danger delete-lecture-btn" data-id="${l._id}">Remove</button>
          </div>`).join('')}
        <h4>Add Lecture</h4>
        <form id="addLectureForm">
          <input type="text" id="lecTitle" placeholder="Title" required>
          <input type="text" id="lecVideo" placeholder="YouTube URL" required>
          <input type="text" id="lecNotes" placeholder="Notes Link" required>
          <input type="text" id="lecDpp" placeholder="DPP Link">
          <input type="text" id="lecThumbnail" placeholder="Thumbnail URL">
          <button type="submit" class="btn btn-primary">Add</button>
        </form>`;
      document.querySelectorAll('.save-lecture-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const title = document.querySelector(`.edit-title[data-id="${id}"]`).value;
          const videoUrl = document.querySelector(`.edit-video[data-id="${id}"]`).value;
          const notesUrl = document.querySelector(`.edit-notes[data-id="${id}"]`).value;
          const dppLink = document.querySelector(`.edit-dpp[data-id="${id}"]`).value;
          const thumbnail = document.querySelector(`.edit-thumb[data-id="${id}"]`).value;
          await fetch(`${API_BASE}/admin/lectures/${courseId}/${id}`, {
            method:'PUT',
            headers:{...authHeaders(),'Content-Type':'application/json'},
            body: JSON.stringify({ title, videoUrl, notesUrl, dppLink, thumbnail })
          });
          refresh();
          showToast('Lecture updated', 'success');
        });
      });
      document.querySelectorAll('.delete-lecture-btn').forEach(b => b.addEventListener('click', async () => {
        await fetch(`${API_BASE}/admin/lectures/${courseId}/${b.dataset.id}`, { method:'DELETE', headers: authHeaders() });
        refresh();
      }));
      document.getElementById('addLectureForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          title: document.getElementById('lecTitle').value,
          videoUrl: document.getElementById('lecVideo').value,
          notesUrl: document.getElementById('lecNotes').value,
          dppLink: document.getElementById('lecDpp').value,
          thumbnail: document.getElementById('lecThumbnail').value
        };
        await fetch(`${API_BASE}/admin/lectures/${courseId}`, { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body: JSON.stringify(body) });
        refresh();
        showToast('Lecture added', 'success');
      });
    } catch { panel.innerHTML = '<p>Error.</p>'; }
  }
  select.addEventListener('change', refresh);
  refresh();
}

// ---------- DOUBT MANAGEMENT (bi‑directional) ----------
async function adminDoubts() {
  try {
    const res = await fetch(`${API_BASE}/admin/doubts`, { headers: authHeaders() });
    const doubts = await res.json();
    let html = `<h3>Student Doubts</h3>`;
    for (let d of doubts) {
      html += `
        <div class="doubt-card">
          <p><strong>${d.userEmail}</strong> (${new Date(d.createdAt).toLocaleString()})</p>
          <p>${d.message}</p>
          ${d.adminReply ? `<p class="reply">↳ Admin: ${d.adminReply}</p>` : ''}
          <input type="text" class="reply-input" data-id="${d._id}" placeholder="Reply..." style="width:100%; margin-top:8px; padding:6px;">
          <button class="btn btn-xs btn-primary send-reply-btn" data-id="${d._id}" style="margin-top:5px;">Send Reply</button>
        </div>`;
    }
    document.getElementById('adminContent').innerHTML = html;
    document.querySelectorAll('.send-reply-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const reply = document.querySelector(`.reply-input[data-id="${id}"]`).value;
        if (!reply) return;
        await fetch(`${API_BASE}/admin/doubts/${id}`, {
          method:'PUT',
          headers:{...authHeaders(),'Content-Type':'application/json'},
          body: JSON.stringify({ adminReply: reply })
        });
        adminDoubts();
      });
    });
  } catch { showToast('Error loading doubts', 'error'); }
}

async function adminStudentList() { /* as before */ }
async function adminAssignCourse() { /* as before */ }
