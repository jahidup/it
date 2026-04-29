// server.js
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
app.use(express.static(path.join(__dirname, 'public'))); // Serve frontend

// ---------- DATABASE CONNECTION ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ---------- MONGOOSE SCHEMAS (all defined inline) ----------
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
  notesUrl: String
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
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
  verified: { type: Boolean, default: false }
});
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
const OTP = mongoose.model('OTP', otpSchema);

// ---------- AUTH MIDDLEWARE ----------
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, name, role }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
  });
};

// ---------- EMAIL SETUP (Nodemailer) ----------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS     // Gmail App Password
  }
});

// Allowed email domains for registration
const ALLOWED_DOMAINS = [
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'aol.com', 'icloud.com', 'protonmail.com', 'zoho.com', 'yandex.com', 'mail.com'
];

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ---------- ROUTES ----------

// ====================== AUTH ROUTES ======================

// 1. Send OTP
app.post('/api/auth/send-otp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: 'Too many OTP requests, try later.' }),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email is required.' });

      const domain = email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain)) {
        return res.status(400).json({ message: 'Only popular email providers (Gmail, Yahoo, etc.) are allowed.' });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.isVerified) {
        return res.status(400).json({ message: 'Email already registered.' });
      }

      // Delete any previous OTP for this email
      await OTP.deleteMany({ email });

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await new OTP({ email, otp, expiresAt }).save();

      // Send email
      await transporter.sendMail({
        from: `"Sankalp Digital Pathshala" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your OTP for Registration',
        html: `<h2>Welcome to Sankalp Digital Pathshala!</h2>
               <p>Your OTP is: <strong>${otp}</strong></p>
               <p>It expires in 10 minutes.</p>`
      });

      res.json({ message: 'OTP sent to your email.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error.' });
    }
  }
);

// 2. Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });

    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) return res.status(400).json({ message: 'Invalid OTP.' });
    if (otpRecord.verified) return res.status(400).json({ message: 'OTP already used.' });
    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ email });
      return res.status(400).json({ message: 'OTP expired. Request a new one.' });
    }

    otpRecord.verified = true;
    await otpRecord.save();
    res.json({ message: 'OTP verified. You can now complete registration.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 3. Register (after OTP verification)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;
    if (!name || !email || !phone || !password || !otp) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      return res.status(400).json({ message: 'Only popular email providers are allowed.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already registered.' });

    const otpRecord = await OTP.findOne({ email, otp, verified: true });
    if (!otpRecord) return res.status(400).json({ message: 'OTP not verified or invalid.' });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      isVerified: true
    });
    await user.save();

    // Clear OTP
    await OTP.deleteMany({ email });

    // Generate JWT
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
    if (!user) return res.status(400).json({ message: 'Invalid email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid email or password.' });

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
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// 5. Admin login
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign(
        { email, role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );
      return res.json({ token });
    } else {
      return res.status(401).json({ message: 'Invalid admin credentials.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ====================== COURSES ROUTES ======================

// Get all courses (public)
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get single course
app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found.' });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Enroll (purchase) – requires auth
app.post('/api/courses/enroll', authMiddleware, async (req, res) => {
  try {
    const { courseId } = req.body;
    const userEmail = req.user.email;

    const existing = await Enrollment.findOne({ userEmail, courseId });
    if (existing) return res.status(400).json({ message: 'Already enrolled in this course.' });

    const enrollment = new Enrollment({ userEmail, courseId });
    await enrollment.save();
    res.status(201).json({ message: 'Enrolled successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Get my enrolled courses (student)
app.get('/api/courses/my-enrollments', authMiddleware, async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ userEmail: req.user.email }).populate('courseId');
    const courses = enrollments.map(e => e.courseId);
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ====================== ADMIN ROUTES (protected) ======================

// Dashboard stats
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  try {
    const totalCourses = await Course.countDocuments();
    const totalStudents = await User.countDocuments({ isVerified: true });
    const totalEnrollments = await Enrollment.countDocuments();
    res.json({ totalCourses, totalStudents, totalEnrollments });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Add a course
app.post('/api/admin/courses', adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, imageUrl, lectures } = req.body;
    const course = new Course({
      title,
      description,
      price,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600',
      lectures: lectures || []
    });
    await course.save();
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Delete a course
app.delete('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    await Enrollment.deleteMany({ courseId: req.params.id }); // Clean up enrollments
    res.json({ message: 'Course deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// List all students
app.get('/api/admin/students', adminMiddleware, async (req, res) => {
  try {
    const students = await User.find({}, 'name email phone');
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// Assign a course to a student
app.post('/api/admin/assign', adminMiddleware, async (req, res) => {
  try {
    const { userEmail, courseId } = req.body;
    if (!userEmail || !courseId) return res.status(400).json({ message: 'User email and course ID required.' });

    const existing = await Enrollment.findOne({ userEmail, courseId });
    if (existing) return res.status(400).json({ message: 'Student is already enrolled in this course.' });

    const enrollment = new Enrollment({ userEmail, courseId });
    await enrollment.save();
    res.status(201).json({ message: 'Course assigned successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// ---------- FRONTEND FALLBACK (for SPA / broken routes) ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
