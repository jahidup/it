// ====================== CONFIG ======================
const API_BASE = window.location.origin + '/api';

// ====================== HELPERS ======================
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

// ====================== GLOBAL LOGOUT ======================
window.handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  showToast('Logged out successfully', 'success');
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

  if (path.endsWith('index.html') || path === '/' || path.endsWith('/sankalp-digital-pathshala/')) loadFeatured();
  if (path.includes('courses.html')) loadAllCourses();
  if (path.includes('course-detail.html')) loadDetail();
  if (path.includes('login.html')) setupLogin();
  if (path.includes('register.html')) setupRegister();
  if (path.includes('dashboard.html')) setupDashboard();
  if (path.includes('admin.html')) setupAdmin();

  // Floating WhatsApp button
  const waBtn = document.createElement('a');
  waBtn.href = 'https://wa.me/+918055698328?text=Hi%20Sankalp%20Digital%20Pathshala';
  waBtn.target = '_blank';
  waBtn.className = 'floating-whatsapp';
  waBtn.innerHTML = '💬';
  document.body.appendChild(waBtn);
});

// ====================== COURSE CARD (with discount & enrollment) ======================
function cardHTML(course) {
  const disc = course.originalPrice && course.originalPrice > course.price
    ? `<span class="original-price">₹${course.originalPrice}</span>
       <span class="discount-badge">${Math.round((1 - course.price / course.originalPrice) * 100)}% off</span>`
    : '';
  const enrolled = course.enrollmentCount
    ? `👥 ${course.enrollmentCount} students enrolled`
    : '👥 Be the first to enroll';
  return `
    <div class="course-card">
      <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; height:180px; object-fit:cover; border-radius:12px; margin-bottom:12px;">
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <div class="price-container">
        <span class="price">₹${course.price}</span>
        ${disc}
      </div>
      <div class="enrollment-count">${enrolled}</div>
      <a href="course-detail.html?id=${course._id}" class="btn btn-primary btn-full">View Details</a>
    </div>
  `;
}

// ====================== LOAD COURSES ======================
async function loadFeatured() {
  const grid = document.getElementById('featuredCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.slice(0, 3).map(c => cardHTML(c)).join('');
  } catch { grid.innerHTML = '<p>Failed to load courses.</p>'; }
}

async function loadAllCourses() {
  const grid = document.getElementById('allCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API_BASE}/courses`);
    const courses = await res.json();
    grid.innerHTML = courses.map(c => cardHTML(c)).join('');
  } catch { grid.innerHTML = '<p>Failed to load courses.</p>'; }
}

// ====================== COURSE DETAIL & BUY NOW ======================
async function loadDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('courseDetailContent');
  if (!container || !id) return;
  try {
    const res = await fetch(`${API_BASE}/courses/${id}`);
    const course = await res.json();
    container.innerHTML = `
      <div class="course-detail">
        <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; max-height:400px; object-fit:cover; border-radius:16px; margin-bottom:20px;">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <h3>Lecture Preview</h3>
        <ul class="lecture-list">${course.lectures.map(l => `<li>📹 ${l.title}</li>`).join('')}</ul>
        <div style="margin:20px 0;">
          <span class="price" style="font-size:1.8rem;">₹${course.price}</span>
          ${course.originalPrice && course.originalPrice > course.price ? `<span class="original-price" style="margin-left:10px;">₹${course.originalPrice}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-lg" id="buyNowBtn">Buy Now</button>
      </div>
    `;
    document.getElementById('buyNowBtn').addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) {
        showToast('Please login to purchase', 'error');
        window.location.href = 'login.html';
        return;
      }
      const msg = `Hello Admin,\nName: ${user.name}\nEmail: ${user.email}\nCourse: ${course.title}`;
      window.open(`https://wa.me/+918055698328?text=${encodeURIComponent(msg)}`, '_blank');
    });
  } catch { container.innerHTML = '<p>Course not found.</p>'; }
}

// ====================== LOGIN + FORGOT PASSWORD ======================
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
        window.location.href = 'dashboard.html';
      } else {
        showToast(data.message || 'Login failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  // Forgot password link
  const forgotLink = document.createElement('a');
  forgotLink.href = '#';
  forgotLink.textContent = 'Forgot Password?';
  forgotLink.style.display = 'block';
  forgotLink.style.marginTop = '15px';
  forgotLink.style.textAlign = 'center';
  forgotLink.style.color = '#2563eb';
  forgotLink.style.cursor = 'pointer';
  form.appendChild(forgotLink);

  forgotLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordModal();
  });
}

function showForgotPasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:400px; padding:25px;">
      <h3 style="margin-bottom:15px;">Reset Password</h3>
      <input type="email" id="forgotEmail" placeholder="Your registered email" required style="width:100%; padding:10px; margin-bottom:15px; border:1px solid #ddd; border-radius:8px;">
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
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('closeForgotModal').addEventListener('click', () => modal.remove());
  document.getElementById('sendForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) return showToast('Please enter your email', 'error');
    const btn = document.getElementById('sendForgotOtp');
    setLoading(btn, true);
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
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('verifyForgotOtp').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    if (!otp) return showToast('Enter OTP', 'error');
    const btn = document.getElementById('verifyForgotOtp');
    setLoading(btn, true);
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
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });

  document.getElementById('resetPasswordBtn').addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const otp = document.getElementById('forgotOtp').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    if (!newPassword) return showToast('Enter new password', 'error');
    const btn = document.getElementById('resetPasswordBtn');
    setLoading(btn, true);
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
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

// ====================== REGISTER (with OTP) ======================
function setupRegister() {
  let otpVerified = false;
  const sendBtn = document.getElementById('sendOtpBtn');
  const verifyBtn = document.getElementById('verifyOtpBtn');
  const registerForm = document.getElementById('registerForm');
  const registerBtn = document.getElementById('registerBtn');

  if (!sendBtn || !verifyBtn || !registerForm) return;

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
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(sendBtn, false);
    }
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
      if (res.ok) {
        otpVerified = true;
        showToast('OTP verified!', 'success');
        registerBtn.disabled = false;
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(verifyBtn, false);
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!otpVerified) return showToast('Please verify OTP first', 'error');
    setLoading(registerBtn, true);
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
        showToast('Registration successful!', 'success');
        window.location.href = 'dashboard.html';
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(registerBtn, false);
    }
  });
}

// ====================== STUDENT DASHBOARD ======================
function setupDashboard() {
  const user = getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return; }
  document.getElementById('topbarUser').textContent = user.name;

  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');

  if (!sidebar.querySelector('.close-sidebar')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-sidebar';
    closeBtn.innerHTML = '&times;';
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
    });
  });

  loadDashboardHome();
}

async function loadDashboardHome() {
  try {
    const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await res.json();
    const count = Array.isArray(courses) ? courses.length : 0;
    document.getElementById('dashboardContent').innerHTML = `
      <h2>Welcome, ${getCurrentUser().name}!</h2>
      <p>You are enrolled in <strong>${count}</strong> course(s).</p>
    `;
  } catch {
    document.getElementById('dashboardContent').innerHTML = '<p>Error loading data.</p>';
  }
}

async function loadMyCourses() {
  try {
    const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await res.json();
    const html = Array.isArray(courses) && courses.length
      ? courses.map(c => cardHTML(c)).join('')
      : '<p>No enrolled courses yet.</p>';
    document.getElementById('dashboardContent').innerHTML = html;
    // Re-attach event listeners for view content buttons
    document.querySelectorAll('.view-content-btn').forEach(btn => {
      btn.addEventListener('click', () => viewContent(btn.dataset.id));
    });
  } catch {
    document.getElementById('dashboardContent').innerHTML = '<p>Error loading courses.</p>';
  }
}

async function viewContent(courseId) {
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`);
    const course = await res.json();
    let html = `<h2>${course.title}</h2>`;
    if (course.lectures && course.lectures.length) {
      html += course.lectures.map((l, i) => `
        <div style="margin-bottom:30px; background:white; padding:20px; border-radius:16px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
          <h3>${i + 1}. ${l.title}</h3>
          ${l.thumbnail ? `<img src="${l.thumbnail}" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; margin-bottom:10px;">` : ''}
          <div style="position:relative; padding-bottom:56.25%; height:0; margin:15px 0;">
            <iframe src="${l.videoUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%;" frameborder="0" allowfullscreen></iframe>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <a href="${l.notesUrl}" target="_blank" class="btn btn-outline">📄 Notes</a>
            ${l.dppLink ? `<a href="${l.dppLink}" target="_blank" class="btn btn-outline">📝 DPP</a>` : ''}
          </div>
        </div>
      `).join('');
    } else {
      html += '<p>No lectures available for this course.</p>';
    }
    document.getElementById('dashboardContent').innerHTML = html;
  } catch {
    showToast('Failed to load course content', 'error');
  }
}

// ====================== ADMIN PANEL ======================
function setupAdmin() {
  // If already logged in
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
        localStorage.setItem('adminToken', data.token);
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        initAdmin();
        showToast('Welcome Admin!', 'success');
      } else {
        showToast(data.message, 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

function initAdmin() {
  const sidebar = document.getElementById('adminSidebar');
  const toggleBtn = document.getElementById('adminSidebarToggle');

  if (!sidebar.querySelector('.close-sidebar')) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-sidebar';
    closeBtn.innerHTML = '&times;';
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
    });
  });

  adminStats();
}

async function adminStats() {
  try {
    const res = await fetch(`${API_BASE}/admin/stats`, { headers: authHeaders() });
    const { totalCourses, totalStudents, totalEnrollments } = await res.json();
    document.getElementById('adminContent').innerHTML = `
      <div class="features-grid">
        <div class="feature-card"><h3>Total Courses</h3><p style="font-size:2rem;">${totalCourses}</p></div>
        <div class="feature-card"><h3>Total Students</h3><p style="font-size:2rem;">${totalStudents}</p></div>
        <div class="feature-card"><h3>Enrollments</h3><p style="font-size:2rem;">${totalEnrollments}</p></div>
      </div>
    `;
  } catch {
    showToast('Error loading stats', 'error');
  }
}

// ---------- ADMIN - COURSE MANAGEMENT ----------
async function adminManageCourses() {
  let html = `
    <h3>Add New Course</h3>
    <form id="addCourseForm" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
      <input type="text" id="title" placeholder="Course Title" required>
      <input type="text" id="desc" placeholder="Description" required>
      <input type="number" id="price" placeholder="Selling Price" required>
      <input type="number" id="originalPrice" placeholder="Original Price (optional)">
      <input type="text" id="imageUrl" placeholder="Image URL" value="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600">
      <button type="submit" class="btn btn-primary">Add Course</button>
    </form>
    <div id="courseList"></div>
  `;
  document.getElementById('adminContent').innerHTML = html;

  document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);
    const title = document.getElementById('title').value;
    const description = document.getElementById('desc').value;
    const price = Number(document.getElementById('price').value);
    const originalPrice = document.getElementById('originalPrice').value
      ? Number(document.getElementById('originalPrice').value)
      : null;
    const imageUrl = document.getElementById('imageUrl').value;
    try {
      await fetch(`${API_BASE}/admin/courses`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price, originalPrice, imageUrl, lectures: [] })
      });
      showToast('Course added!', 'success');
      loadCourseList();
      e.target.reset();
    } catch {
      showToast('Failed to add course', 'error');
    } finally {
      setLoading(btn, false);
    }
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
      </div>
    `).join('');

    document.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this course?')) return;
        await fetch(`${API_BASE}/admin/courses/${btn.dataset.id}`, {
          method: 'DELETE',
          headers: authHeaders()
        });
        showToast('Course deleted', 'info');
        loadCourseList();
      });
    });
  } catch {
    list.innerHTML = '<p>Error loading courses.</p>';
  }
}

// ---------- ADMIN - LECTURE MANAGER ----------
async function adminLectureManager() {
  // Fetch courses for the dropdown
  const res = await fetch(`${API_BASE}/courses`);
  const courses = await res.json();

  let html = `
    <h3>Manage Lectures</h3>
    <div class="form-group">
      <label>Select Course</label>
      <select id="lectureCourseSelect" style="width:100%; padding:10px;">
        ${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}
      </select>
    </div>
    <div id="lectureManagerPanel"></div>
  `;
  document.getElementById('adminContent').innerHTML = html;

  const select = document.getElementById('lectureCourseSelect');
  const panel = document.getElementById('lectureManagerPanel');

  async function refreshLectures() {
    const courseId = select.value;
    try {
      const res = await fetch(`${API_BASE}/admin/lectures/${courseId}`, { headers: authHeaders() });
      const lectures = await res.json();
      panel.innerHTML = `
        <h4>Current Lectures</h4>
        ${lectures.map(l => `
          <div class="lecture-item" style="border:1px solid #e2e8f0; padding:15px; margin-bottom:10px; border-radius:8px;">
            <strong>${l.title}</strong><br>
            Video: ${l.videoUrl}<br>
            Notes: ${l.notesUrl}<br>
            DPP: ${l.dppLink || '—'}<br>
            Thumbnail: ${l.thumbnail ? `<img src="${l.thumbnail}" style="max-height:80px; border-radius:6px;">` : '—'}
            <button class="btn btn-danger delete-lecture-btn" data-id="${l._id}">Remove</button>
          </div>
        `).join('')}
        <h4 style="margin-top:25px;">Add New Lecture</h4>
        <form id="addLectureForm">
          <input type="text" id="lecTitle" placeholder="Lecture Topic" required style="width:100%; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #ddd;">
          <input type="text" id="lecVideo" placeholder="YouTube Embed URL" required style="width:100%; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #ddd;">
          <input type="text" id="lecNotes" placeholder="Notes Link (Google Drive)" required style="width:100%; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #ddd;">
          <input type="text" id="lecDpp" placeholder="DPP Link (optional)" style="width:100%; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #ddd;">
          <input type="text" id="lecThumbnail" placeholder="Thumbnail URL (optional)" style="width:100%; margin-bottom:10px; padding:10px; border-radius:8px; border:1px solid #ddd;">
          <button type="submit" class="btn btn-primary">Add Lecture</button>
        </form>
      `;

      // Delete lecture handler
      document.querySelectorAll('.delete-lecture-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this lecture?')) return;
          await fetch(`${API_BASE}/admin/lectures/${courseId}/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: authHeaders()
          });
          refreshLectures();
          showToast('Lecture removed', 'info');
        });
      });

      // Add lecture form handler
      document.getElementById('addLectureForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
          title: document.getElementById('lecTitle').value,
          videoUrl: document.getElementById('lecVideo').value,
          notesUrl: document.getElementById('lecNotes').value,
          dppLink: document.getElementById('lecDpp').value,
          thumbnail: document.getElementById('lecThumbnail').value
        };
        await fetch(`${API_BASE}/admin/lectures/${courseId}`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        refreshLectures();
        showToast('Lecture added successfully', 'success');
      });
    } catch {
      panel.innerHTML = '<p>Error loading lectures.</p>';
    }
  }

  select.addEventListener('change', refreshLectures);
  refreshLectures(); // initial load
}

// ---------- ADMIN - STUDENT LIST ----------
async function adminStudentList() {
  try {
    const res = await fetch(`${API_BASE}/admin/students`, { headers: authHeaders() });
    const students = await res.json();
    document.getElementById('adminContent').innerHTML = students.length
      ? `
        <table style="width:100%; background:white; border-collapse:collapse; border-radius:12px; overflow:hidden;">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
          <tbody>${students.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.phone}</td></tr>`).join('')}</tbody>
        </table>
      `
      : '<p>No students registered.</p>';
  } catch {
    showToast('Error loading students', 'error');
  }
}

// ---------- ADMIN - ASSIGN COURSE (with search) ----------
async function adminAssignCourse() {
  try {
    const [usersRes, coursesRes] = await Promise.all([
      fetch(`${API_BASE}/admin/students`, { headers: authHeaders() }),
      fetch(`${API_BASE}/courses`)
    ]);
    const users = await usersRes.json();
    const courses = await coursesRes.json();

    document.getElementById('adminContent').innerHTML = `
      <h3>Assign Course to Student</h3>
      <input type="text" id="studentSearch" placeholder="🔍 Search by name or email" style="width:100%; padding:12px; margin-bottom:20px; border-radius:10px; border:1px solid #ddd;">
      <div class="form-group">
        <label>Select Student</label>
        <select id="assignStudent" required style="width:100%; padding:10px;">
          ${users.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Select Course</label>
        <select id="assignCourse" required style="width:100%; padding:10px;">
          ${courses.map(c => `<option value="${c._id}">${c.title} - ₹${c.price}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-full" id="assignBtn">Assign Course</button>
    `;

    // Real-time search
    document.getElementById('studentSearch').addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const select = document.getElementById('assignStudent');
      select.innerHTML = users
        .filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
        .map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`)
        .join('');
    });

    document.getElementById('assignBtn').addEventListener('click', async () => {
      const userEmail = document.getElementById('assignStudent').value;
      const courseId = document.getElementById('assignCourse').value;
      const res = await fetch(`${API_BASE}/admin/assign`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, courseId })
      });
      const data = await res.json();
      if (res.ok) showToast('Course assigned successfully!', 'success');
      else showToast(data.message, 'error');
    });
  } catch {
    showToast('Error loading data', 'error');
  }
}
