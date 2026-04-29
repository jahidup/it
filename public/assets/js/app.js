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

// Button loading state helper
function setLoading(btn, loading = true) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Processing...' : btn.dataset.originalText;
}

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
    if (ids.navLogin) ids.navLogin.style.display = 'none';
    if (ids.navRegister) ids.navRegister.style.display = 'none';
    if (ids.navDashboard) ids.navDashboard.style.display = 'block';
    if (ids.navAdmin) ids.navAdmin.style.display = 'block';
    if (ids.navLogout) ids.navLogout.style.display = 'block';
  } else {
    if (ids.navLogin) ids.navLogin.style.display = 'block';
    if (ids.navRegister) ids.navRegister.style.display = 'block';
    if (ids.navDashboard) ids.navDashboard.style.display = 'none';
    if (ids.navAdmin) ids.navAdmin.style.display = 'none';
    if (ids.navLogout) ids.navLogout.style.display = 'none';
  }

  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (toggle) toggle.onclick = () => links.classList.toggle('active');
}

// ====================== GLOBAL LOGOUT FUNCTIONS ======================
window.handleLogout = function () {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  showToast('Logged out', 'success');
  window.location.href = 'index.html';
};

window.handleAdminLogout = function () {
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
});

// ====================== API LOADERS ======================
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

function cardHTML(course) {
  return `
    <div class="course-card">
      <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
      <h3>${course.title}</h3>
      <p>${course.description}</p>
      <div class="price">₹${course.price}</div>
      <a href="course-detail.html?id=${course._id}" class="btn btn-primary">View Details</a>
    </div>
  `;
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
        <img src="${course.imageUrl}" alt="${course.title}" style="width:100%; max-height:400px; object-fit:cover; border-radius:12px; margin-bottom:20px;">
        <h2>${course.title}</h2>
        <p>${course.description}</p>
        <h3>Lecture Preview</h3>
        <ul class="lecture-list">${course.lectures.map(l => `<li>📹 ${l.title}</li>`).join('')}</ul>
        <div class="price" style="font-size:1.5rem; margin:20px 0;">₹${course.price}</div>
        <button class="btn btn-primary btn-lg" id="buyNowBtn">Buy Now</button>
      </div>
    `;
    document.getElementById('buyNowBtn').addEventListener('click', () => {
      const user = getCurrentUser();
      if (!user) {
        showToast('Please login first', 'error');
        window.location.href = 'login.html';
        return;
      }
      const msg = `Hello Admin,\nName: ${user.name}\nEmail: ${user.email}\nCourse: ${course.title}`;
      window.open(`https://wa.me/919876543210?text=${encodeURIComponent(msg)}`, '_blank');
    });
  } catch {
    container.innerHTML = '<p>Course not found.</p>';
  }
}

// ====================== LOGIN ======================
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
    } catch (err) {
      showToast('Network error. Please try again.', 'error');
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
    } catch (err) {
      showToast('Network error. Check your connection.', 'error');
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
    } catch (err) {
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
    } catch (err) {
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

  document.getElementById('sidebarToggle').onclick = () => {
    document.getElementById('sidebar').classList.toggle('active');
  };

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
    document.getElementById('dashboardContent').innerHTML = `
      <h2>Welcome, ${getCurrentUser().name}!</h2>
      <p>You are enrolled in <strong>${courses.length}</strong> course(s).</p>
    `;
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading data.</p>'; }
}

async function loadMyCourses() {
  try {
    const res = await fetch(`${API_BASE}/courses/my-enrollments`, { headers: authHeaders() });
    const courses = await res.json();
    const html = courses.length ? courses.map(c => `
      <div class="course-card">
        <img src="${c.imageUrl}" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">
        <h3>${c.title}</h3>
        <p>${c.description}</p>
        <button class="btn btn-outline view-content-btn" data-id="${c._id}">View Content</button>
      </div>
    `).join('') : '<p>No enrolled courses yet.</p>';
    document.getElementById('dashboardContent').innerHTML = html;
    // Attach event listeners to newly created buttons
    document.querySelectorAll('.view-content-btn').forEach(btn => {
      btn.addEventListener('click', () => viewContent(btn.dataset.id));
    });
  } catch { document.getElementById('dashboardContent').innerHTML = '<p>Error loading courses.</p>'; }
}

async function viewContent(courseId) {
  setLoading(document.querySelector(`[data-id="${courseId}"]`), true);
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`);
    const course = await res.json();
    let html = `<h2>${course.title}</h2>`;
    if (course.lectures && course.lectures.length) {
      html += course.lectures.map((l, i) => `
        <div style="margin-bottom:30px; background:white; padding:20px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
          <h3>${i+1}. ${l.title}</h3>
          <div style="position:relative; padding-bottom:56.25%; height:0; margin:15px 0;">
            <iframe src="${l.videoUrl}" style="position:absolute; top:0; left:0; width:100%; height:100%;" frameborder="0" allowfullscreen></iframe>
          </div>
          <a href="${l.notesUrl}" target="_blank" class="btn btn-outline">📄 Download Notes</a>
        </div>
      `).join('');
    } else {
      html += '<p>No lectures available.</p>';
    }
    document.getElementById('dashboardContent').innerHTML = html;
  } catch {
    showToast('Failed to load course content', 'error');
  } finally {
    setLoading(document.querySelector(`[data-id="${courseId}"]`), false);
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
    } catch (err) {
      showToast('Network error', 'error');
    } finally {
      setLoading(btn, false);
    }
  });
}

function initAdmin() {
  document.getElementById('adminSidebarToggle').onclick = () => {
    document.getElementById('adminSidebar').classList.toggle('active');
  };

  document.querySelectorAll('#adminPanel .sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('#adminPanel .sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      const view = link.dataset.view;
      if (view === 'adminDashboard') adminStats();
      else if (view === 'adminCourses') adminManageCourses();
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
  } catch { showToast('Error loading stats', 'error'); }
}

async function adminManageCourses() {
  let html = `
    <h3>Add New Course</h3>
    <form id="addCourseForm" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
      <input type="text" id="title" placeholder="Course Title" required>
      <input type="text" id="desc" placeholder="Description" required>
      <input type="number" id="price" placeholder="Price" required>
      <input type="text" id="imageUrl" placeholder="Image URL (optional)">
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
    const price = document.getElementById('price').value;
    const imageUrl = document.getElementById('imageUrl').value;
    try {
      await fetch(`${API_BASE}/admin/courses`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, price, imageUrl, lectures: [] })
      });
      showToast('Course added!', 'success');
      loadCourseList();
      document.getElementById('addCourseForm').reset();
    } catch { showToast('Failed to add course', 'error'); }
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
        <h3>${c.title}</h3>
        <p>${c.description}</p>
        <div>₹${c.price}</div>
        <button class="btn btn-danger delete-course-btn" data-id="${c._id}">Delete</button>
      </div>
    `).join('');
    document.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Delete this course and its enrollments?')) return;
        setLoading(btn, true);
        try {
          await fetch(`${API_BASE}/admin/courses/${btn.dataset.id}`, { method: 'DELETE', headers: authHeaders() });
          showToast('Course deleted', 'info');
          loadCourseList();
        } catch { showToast('Failed to delete', 'error'); }
        finally { setLoading(btn, false); }
      });
    });
  } catch { list.innerHTML = '<p>Error loading courses.</p>'; }
}

async function adminStudentList() {
  try {
    const res = await fetch(`${API_BASE}/admin/students`, { headers: authHeaders() });
    const students = await res.json();
    document.getElementById('adminContent').innerHTML = students.length ? `
      <table style="width:100%; background:white; border-collapse:collapse; border-radius:12px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
        <thead style="background:#f8fafc;"><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead>
        <tbody>${students.map(u => `<tr><td>${u.name}</td><td>${u.email}</td><td>${u.phone}</td></tr>`).join('')}</tbody>
      </table>
    ` : '<p>No students registered.</p>';
  } catch { showToast('Error loading students', 'error'); }
}

async function adminAssignCourse() {
  try {
    const [usersRes, coursesRes] = await Promise.all([
      fetch(`${API_BASE}/admin/students`, { headers: authHeaders() }),
      fetch(`${API_BASE}/courses`)
    ]);
    const users = await usersRes.json();
    const courses = await coursesRes.json();
    document.getElementById('adminContent').innerHTML = `
      <form id="assignForm" style="background:white; padding:30px; border-radius:12px; box-shadow:0 2px 10px rgba(0,0,0,0.05); max-width:500px;">
        <div class="form-group">
          <label>Select Student</label>
          <select id="assignStudent" required style="width:100%; padding:10px;">${users.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}</select>
        </div>
        <div class="form-group">
          <label>Select Course</label>
          <select id="assignCourse" required style="width:100%; padding:10px;">${courses.map(c => `<option value="${c._id}">${c.title}</option>`).join('')}</select>
        </div>
        <button type="submit" class="btn btn-primary btn-full">Assign Course</button>
      </form>
    `;
    document.getElementById('assignForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type="submit"]');
      setLoading(btn, true);
      const userEmail = document.getElementById('assignStudent').value;
      const courseId = document.getElementById('assignCourse').value;
      try {
        const res = await fetch(`${API_BASE}/admin/assign`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail, courseId })
        });
        const data = await res.json();
        if (res.ok) showToast('Course assigned!', 'success');
        else showToast(data.message, 'error');
      } catch { showToast('Network error', 'error'); }
      finally { setLoading(btn, false); }
    });
  } catch { showToast('Error loading data', 'error'); }
}
