require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();

// ---------- MIDDLEWARE ----------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- DATABASE CONNECTION ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ---------- SCHEMAS ----------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

const lectureSchema = new mongoose.Schema({
  title: String,
  videoUrl: String,
  notesUrl: String,
  dppLink: String,
  thumbnail: String
});
const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, default: null },
  imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600' },
  lectures: [lectureSchema]
}, { timestamps: true });
const Course = mongoose.model('Course', courseSchema);

const enrollmentSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  enrolledAt: { type: Date, default: Date.now }
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  verified: { type: Boolean, default: false },
  purpose: { type: String, enum: ['registration', 'reset'], default: 'registration' }
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const OTP = mongoose.model('OTP', otpSchema);

// ---------- AUTH MIDDLEWARE ----------
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });
};

// ---------- EMAIL SETUP ----------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const ALLOWED_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'aol.com', 'icloud.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com'
];
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------- AUTH ROUTES ----------
// 1. Send OTP (registration)
app.post('/api/auth/send-otp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: 'Too many OTP requests.' }),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required.' });
      const domain = email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        return res.status(400).json({ message: 'Only popular email providers allowed.' });
      }
      const existingUser = await User.findOne({ email });
      if (existingUser?.isVerified) return res.status(400).json({ message: 'Email already registered.' });

      await OTP.deleteMany({ email, purpose: 'registration' });
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await new OTP({ email, otp, expiresAt, purpose: 'registration' }).save();

      await transporter.sendMail({
        from: `"Sankalp Digital Pathshala" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your OTP for Registration',
        html: `<h2>Welcome!</h2><p>Your OTP is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`
      });
      res.json({ message: 'OTP sent to your email.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    }
  });

// 2. Verify OTP (registration)
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({ email, otp, purpose: 'registration' });
    if (!record) return res.status(400).json({ message: 'Invalid OTP.' });
    if (record.verified) return res.status(400).json({ message: 'OTP already used.' });
    if (new Date() > record.expiresAt) {
      await OTP.deleteMany({ email, purpose: 'registration' });
      return res.status(400).json({ message: 'OTP expired.' });
    }
    record.verified = true;
    await record.save();
    res.json({ message: 'OTP verified. You can now register.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// 3. Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;
    if (!name || !email || !phone || !password || !otp) {
      return res.status(400).json({ message: 'All fields required.' });
    }
    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return res.status(400).json({ message: 'Only popular email providers allowed.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered.' });

    const otpRecord = await OTP.findOne({ email, otp, verified: true, purpose: 'registration' });
    if (!otpRecord) return res.status(400).json({ message: 'OTP not verified.' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await new User({ name, email, phone, password: hashed, isVerified: true }).save();
    await OTP.deleteMany({ email, purpose: 'registration' });

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 4. Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });

    const user = await User.findOne({ email, isVerified: true });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name, role: 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// 5. Admin Login
app.post('/api/auth/admin-login', async (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ message: 'Invalid admin credentials.' });
});

// 6. Forgot Password – send OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with that email.' });

    await OTP.deleteMany({ email, purpose: 'reset' });
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await new OTP({ email, otp, expiresAt, purpose: 'reset' }).save();

    await transporter.sendMail({
      from: `"Sankalp Digital Pathshala" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP',
      html: `<h2>Reset Your Password</h2><p>Your OTP is: <strong>${otp}</strong></p><p>Expires in 10 minutes.</p>`
    });
    res.json({ message: 'OTP sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// 7. Verify Reset OTP
app.post('/api/auth/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({ email, otp, purpose: 'reset' });
    if (!record) return res.status(400).json({ message: 'Invalid OTP.' });
    if (record.verified) return res.status(400).json({ message: 'OTP already used.' });
    if (new Date() > record.expiresAt) return res.status(400).json({ message: 'OTP expired.' });

    record.verified = true;
    await record.save();
    res.json({ message: 'OTP verified. You can now reset your password.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// 8. Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'All fields required.' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found.' });

    const otpRecord = await OTP.findOne({ email, otp, verified: true, purpose: 'reset' });
    if (!otpRecord) return res.status(400).json({ message: 'OTP not verified.' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await OTP.deleteMany({ email, purpose: 'reset' });

    res.json({ message: 'Password updated. You can now login.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ---------- COURSES ROUTES (public) ----------
// 1. Get all courses (with enrollment counts)
app.get('/api/courses', async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  for (let course of courses) {
    course.enrollmentCount = await Enrollment.countDocuments({ courseId: course._id });
  }
  res.json(courses);
});

// 2. Enroll (purchase) – auth required
app.post('/api/courses/enroll', authMiddleware, async (req, res) => {
  const { courseId } = req.body;
  const userEmail = req.user.email;

  const existing = await Enrollment.findOne({ userEmail, courseId });
  if (existing) return res.status(400).json({ message: 'Already enrolled.' });

  await new Enrollment({ userEmail, courseId }).save();
  res.status(201).json({ message: 'Enrolled successfully.' });
});

// 3. My enrollments – auth required (MUST BE BEFORE /:id)
app.get('/api/courses/my-enrollments', authMiddleware, async (req, res) => {
  const enrollments = await Enrollment.find({ userEmail: req.user.email }).populate('courseId').lean();
  const courses = enrollments.map(e => e.courseId).filter(Boolean);
  for (let c of courses) {
    c.enrollmentCount = await Enrollment.countDocuments({ courseId: c._id });
  }
  res.json(courses);
});

// 4. Get single course (with enrollment count) – AFTER specific routes
app.get('/api/courses/:id', async (req, res) => {
  const course = await Course.findById(req.params.id).lean();
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  course.enrollmentCount = await Enrollment.countDocuments({ courseId: course._id });
  res.json(course);
});

// ---------- ADMIN ROUTES ----------
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  const totalCourses = await Course.countDocuments();
  const totalStudents = await User.countDocuments({ isVerified: true });
  const totalEnrollments = await Enrollment.countDocuments();
  res.json({ totalCourses, totalStudents, totalEnrollments });
});

// Course CRUD
app.post('/api/admin/courses', adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, originalPrice, imageUrl, lectures } = req.body;
    const course = new Course({
      title,
      description,
      price,
      originalPrice: originalPrice || null,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600',
      lectures: lectures || []
    });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

app.put('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, originalPrice, imageUrl, lectures } = req.body;
    const updated = await Course.findByIdAndUpdate(
      req.params.id,
      { title, description, price, originalPrice, imageUrl, lectures },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Course not found.' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Update failed.' });
  }
});

app.delete('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  await Enrollment.deleteMany({ courseId: req.params.id });
  res.json({ message: 'Course deleted.' });
});

// Lecture management (dedicated endpoints)
app.get('/api/admin/lectures/:courseId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  res.json(course.lectures);
});

app.post('/api/admin/lectures/:courseId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  course.lectures.push(req.body); // { title, videoUrl, notesUrl, dppLink, thumbnail }
  await course.save();
  res.json(course.lectures);
});

app.delete('/api/admin/lectures/:courseId/:lectureId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  course.lectures = course.lectures.filter(l => l._id.toString() !== req.params.lectureId);
  await course.save();
  res.json(course.lectures);
});

// Students list
app.get('/api/admin/students', adminMiddleware, async (req, res) => {
  const students = await User.find({}, 'name email phone');
  res.json(students);
});

// Assign course to student
app.post('/api/admin/assign', adminMiddleware, async (req, res) => {
  try {
    const { userEmail, courseId } = req.body;
    if (!userEmail || !courseId) return res.status(400).json({ message: 'Missing fields.' });

    const existing = await Enrollment.findOne({ userEmail, courseId });
    if (existing) return res.status(400).json({ message: 'Already enrolled.' });

    await new Enrollment({ userEmail, courseId }).save();
    res.status(201).json({ message: 'Assigned.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ---------- FRONTEND FALLBACK ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
