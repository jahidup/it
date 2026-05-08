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

// ---------- DATABASE ----------
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// ========== SCHEMAS ==========
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
  thumbnail: String,
  createdAt: { type: Date, default: Date.now }
});

const chapterSchema = new mongoose.Schema({
  title: { type: String, required: true },
  lectures: [lectureSchema]
});

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, default: null },
  imageUrl: { type: String, default: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600' },
  chapters: [chapterSchema]
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

const lectureProgressSchema = new mongoose.Schema({
  userEmail: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  lectureId: String,
  completedAt: { type: Date, default: Date.now }
});
const LectureProgress = mongoose.model('LectureProgress', lectureProgressSchema);

const doubtSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  userName: { type: String, required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  chapterId: { type: String, required: true },
  lectureId: { type: String, required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  message: { type: String, required: true },
  adminReply: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Doubt = mongoose.model('Doubt', doubtSchema);

// ========== NEW TEST SCHEMAS ==========
const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'numerical'], required: true },
  questionText: { type: String, required: true },
  questionImage: { type: String, default: '' },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
  marks: { type: Number, default: 1 },
  explanation: { type: String, default: '' }
});

const testSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: Number, required: true },
  language: { type: String, enum: ['english', 'hindi', 'both'], default: 'english' },
  scheduledAt: { type: Date, default: null },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now }
});
const Test = mongoose.model('Test', testSchema);

const testAttemptSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  userEmail: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  score: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedAnswer: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  completed: { type: Boolean, default: false }
});
const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);

// ---------- MIDDLEWARE ----------
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token provided.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) { res.status(401).json({ message: 'Invalid token.' }); }
};

const adminMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required.' });
    next();
  });
};

// ---------- EMAIL ----------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});
const ALLOWED_DOMAINS = ['gmail.com','yahoo.com','outlook.com','hotmail.com','aol.com','icloud.com','protonmail.com','zoho.com','yandex.com','mail.com'];
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ========== AUTH ROUTES ==========
app.post('/api/auth/send-otp',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 3, message: 'Too many OTP requests.' }),
  async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: 'Email required.' });
      const domain = email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(domain))
        return res.status(400).json({ message: 'Only popular email providers allowed.' });
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
    res.json({ message: 'OTP verified.' });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;
    if (!name || !email || !phone || !password || !otp)
      return res.status(400).json({ message: 'All fields required.' });
    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain))
      return res.status(400).json({ message: 'Only popular email providers allowed.' });

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
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

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
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { email, password } = req.body;
  if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
    const token = jwt.sign({ email, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ message: 'Invalid admin credentials.' });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found.' });

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
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/auth/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = await OTP.findOne({ email, otp, purpose: 'reset' });
    if (!record) return res.status(400).json({ message: 'Invalid OTP.' });
    if (record.verified) return res.status(400).json({ message: 'OTP already used.' });
    if (new Date() > record.expiresAt) return res.status(400).json({ message: 'OTP expired.' });
    record.verified = true;
    await record.save();
    res.json({ message: 'OTP verified.' });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

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
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// ========== COURSE ROUTES (order matters) ==========
app.get('/api/courses', async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  res.json(courses);
});

app.post('/api/courses/enroll', authMiddleware, async (req, res) => {
  const { courseId } = req.body;
  const userEmail = req.user.email;
  if (await Enrollment.findOne({ userEmail, courseId })) return res.status(400).json({ message: 'Already enrolled.' });
  await new Enrollment({ userEmail, courseId }).save();
  res.status(201).json({ message: 'Enrolled.' });
});

app.get('/api/courses/my-enrollments', authMiddleware, async (req, res) => {
  const enrollments = await Enrollment.find({ userEmail: req.user.email }).populate('courseId').lean();
  const courses = enrollments.map(e => e.courseId).filter(Boolean);
  res.json(courses);
});

app.get('/api/courses/:id', async (req, res) => {
  const course = await Course.findById(req.params.id).lean();
  if (!course) return res.status(404).json({ message: 'Not found.' });
  res.json(course);
});

// ========== PROGRESS ROUTES (specific before parameterized) ==========
app.get('/api/progress/my-report', authMiddleware, async (req, res) => {
  try {
    const completions = await LectureProgress.find({ userEmail: req.user.email })
      .populate({ path: 'courseId', select: 'title chapters' })
      .sort({ completedAt: -1 })
      .lean();
    const enriched = await Promise.all(completions.map(async (c) => {
      const course = c.courseId;
      let lecture = null;
      if (course?.chapters) {
        for (let ch of course.chapters) {
          lecture = ch.lectures.find(l => l._id.toString() === c.lectureId);
          if (lecture) break;
        }
      }
      return {
        courseTitle: course?.title || 'Deleted Course',
        lectureTitle: lecture?.title || 'Unknown Lecture',
        completedAt: c.completedAt
      };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/progress/:courseId', authMiddleware, async (req, res) => {
  const progress = await LectureProgress.find({ userEmail: req.user.email, courseId: req.params.courseId });
  res.json(progress.map(p => p.lectureId));
});

app.post('/api/progress/mark-complete/:courseId/:lectureId', authMiddleware, async (req, res) => {
  try {
    const { courseId, lectureId } = req.params;
    const userEmail = req.user.email;
    if (await LectureProgress.findOne({ userEmail, courseId, lectureId }))
      return res.status(400).json({ message: 'Already completed.' });
    await new LectureProgress({ userEmail, courseId, lectureId }).save();
    res.json({ message: 'Lecture marked as complete.' });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

// ========== DOUBTS ROUTES (threaded, with admin reply visible) ==========
app.post('/api/doubts', authMiddleware, async (req, res) => {
  try {
    const { courseId, chapterId, lectureId, message, parentId } = req.body;
    const user = await User.findOne({ email: req.user.email });
    const doubt = new Doubt({
      userEmail: req.user.email,
      userName: user ? user.name : req.user.email,
      courseId,
      chapterId: chapterId || null,
      lectureId,
      message,
      parentId: parentId || null
    });
    await doubt.save();
    res.status(201).json(doubt);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/doubts/:courseId/:lectureId', async (req, res) => {
  const { courseId, lectureId } = req.params;
  const topLevel = await Doubt.find({ courseId, lectureId, parentId: null })
    .sort({ createdAt: -1 })
    .lean();
  for (let d of topLevel) {
    d.replies = await Doubt.find({ parentId: d._id }).sort({ createdAt: 1 }).lean();
    if (d.adminReply && d.adminReply.trim() !== '') {
      d.replies.push({
        _id: 'admin-' + d._id,
        userEmail: 'admin',
        userName: 'Admin',
        message: d.adminReply,
        createdAt: d.updatedAt || d.createdAt,
        isAdminReply: true
      });
    }
  }
  res.json(topLevel);
});

app.get('/api/doubts/my', authMiddleware, async (req, res) => {
  const doubts = await Doubt.find({ userEmail: req.user.email }).sort({ createdAt: -1 }).lean();
  res.json(doubts);
});

// ========== ADMIN ROUTES ==========
app.get('/api/admin/stats', adminMiddleware, async (req, res) => {
  const totalCourses = await Course.countDocuments();
  const totalStudents = await User.countDocuments({ isVerified: true });
  const totalEnrollments = await Enrollment.countDocuments();
  res.json({ totalCourses, totalStudents, totalEnrollments });
});

// Courses CRUD
app.post('/api/admin/courses', adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, originalPrice, imageUrl, chapters } = req.body;
    const course = new Course({
      title, description, price,
      originalPrice: originalPrice || null,
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600',
      chapters: chapters || []
    });
    await course.save();
    res.status(201).json(course);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.put('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, description, price, originalPrice, imageUrl, chapters } = req.body;
    const updated = await Course.findByIdAndUpdate(
      req.params.id,
      { title, description, price, originalPrice, imageUrl, chapters },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: 'Course not found.' });
    res.json(updated);
  } catch (err) { res.status(500).json({ message: 'Update failed.' }); }
});

app.delete('/api/admin/courses/:id', adminMiddleware, async (req, res) => {
  await Course.findByIdAndDelete(req.params.id);
  await Enrollment.deleteMany({ courseId: req.params.id });
  res.json({ message: 'Course deleted.' });
});

// Chapters
app.post('/api/admin/courses/:id/chapters', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  course.chapters.push(req.body);
  await course.save();
  res.json(course.chapters);
});

app.put('/api/admin/courses/:id/chapters/:chapterId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const chapter = course.chapters.id(req.params.chapterId);
  if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });
  Object.assign(chapter, req.body);
  await course.save();
  res.json(course.chapters);
});

app.delete('/api/admin/courses/:id/chapters/:chapterId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  course.chapters = course.chapters.filter(c => c._id.toString() !== req.params.chapterId);
  await course.save();
  res.json(course.chapters);
});

// Lectures inside a chapter
app.post('/api/admin/courses/:id/chapters/:chapterId/lectures', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const chapter = course.chapters.id(req.params.chapterId);
  if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });
  chapter.lectures.push(req.body);
  await course.save();
  res.json(chapter.lectures);
});

app.put('/api/admin/courses/:id/chapters/:chapterId/lectures/:lectureId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const chapter = course.chapters.id(req.params.chapterId);
  if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });
  const lecture = chapter.lectures.id(req.params.lectureId);
  if (!lecture) return res.status(404).json({ message: 'Lecture not found.' });
  Object.assign(lecture, req.body);
  await course.save();
  res.json(chapter.lectures);
});

app.delete('/api/admin/courses/:id/chapters/:chapterId/lectures/:lectureId', adminMiddleware, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) return res.status(404).json({ message: 'Course not found.' });
  const chapter = course.chapters.id(req.params.chapterId);
  if (!chapter) return res.status(404).json({ message: 'Chapter not found.' });
  chapter.lectures = chapter.lectures.filter(l => l._id.toString() !== req.params.lectureId);
  await course.save();
  res.json(chapter.lectures);
});

// Students list with progress
app.get('/api/admin/students', adminMiddleware, async (req, res) => {
  const students = await User.find({}, 'name email phone').lean();
  for (let s of students) {
    s.completedLectures = await LectureProgress.countDocuments({ userEmail: s.email });
  }
  res.json(students);
});

app.post('/api/admin/assign', adminMiddleware, async (req, res) => {
  try {
    const { userEmail, courseId } = req.body;
    if (!userEmail || !courseId) return res.status(400).json({ message: 'Missing fields.' });
    if (await Enrollment.findOne({ userEmail, courseId }))
      return res.status(400).json({ message: 'Already enrolled.' });
    await new Enrollment({ userEmail, courseId }).save();
    res.status(201).json({ message: 'Assigned.' });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/admin/doubts', adminMiddleware, async (req, res) => {
  try {
    const topDoubts = await Doubt.find({ parentId: null }).sort({ createdAt: -1 }).lean();
    const enriched = await Promise.all(topDoubts.map(async (d) => {
      const course = await Course.findById(d.courseId).lean();
      let chapterTitle = 'Deleted Chapter', lectureTitle = 'Deleted Lecture';
      if (course?.chapters) {
        for (let ch of course.chapters) {
          if (ch._id.toString() === d.chapterId) {
            chapterTitle = ch.title;
            const lec = ch.lectures.find(l => l._id.toString() === d.lectureId);
            if (lec) lectureTitle = lec.title;
            break;
          }
        }
      }
      return {
        ...d,
        courseTitle: course?.title || 'Deleted Course',
        chapterTitle,
        lectureTitle
      };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.put('/api/admin/doubts/:id', adminMiddleware, async (req, res) => {
  const { adminReply } = req.body;
  const doubt = await Doubt.findByIdAndUpdate(req.params.id, { adminReply }, { new: true });
  if (!doubt) return res.status(404).json({ message: 'Doubt not found.' });
  res.json(doubt);
});

// ========== TEST ADMIN ROUTES ==========
app.post('/api/admin/tests', adminMiddleware, async (req, res) => {
  try {
    const { courseId, title, description, duration, language, scheduledAt, questions } = req.body;
    const test = new Test({ courseId, title, description, duration, language, scheduledAt, questions: questions || [] });
    await test.save();
    res.status(201).json(test);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/admin/tests/:courseId', adminMiddleware, async (req, res) => {
  const tests = await Test.find({ courseId: req.params.courseId }).sort({ createdAt: -1 }).lean();
  res.json(tests);
});

app.put('/api/admin/tests/:id', adminMiddleware, async (req, res) => {
  try {
    const { title, description, duration, language, scheduledAt, questions } = req.body;
    const test = await Test.findByIdAndUpdate(req.params.id,
      { title, description, duration, language, scheduledAt, questions },
      { new: true, runValidators: true });
    if (!test) return res.status(404).json({ message: 'Test not found.' });
    res.json(test);
  } catch (err) { res.status(500).json({ message: 'Update failed.' }); }
});

app.delete('/api/admin/tests/:id', adminMiddleware, async (req, res) => {
  await Test.findByIdAndDelete(req.params.id);
  await TestAttempt.deleteMany({ testId: req.params.id });
  res.json({ message: 'Test deleted.' });
});

// ========== STUDENT TEST ROUTES ==========
app.get('/api/tests/course/:courseId', authMiddleware, async (req, res) => {
  const tests = await Test.find({ courseId: req.params.courseId })
    .select('-questions.correctAnswer') // hide correct answers
    .sort({ createdAt: -1 }).lean();
  res.json(tests);
});

app.get('/api/tests/:id', authMiddleware, async (req, res) => {
  const test = await Test.findById(req.params.id)
    .select('-questions.correctAnswer').lean();
  if (!test) return res.status(404).json({ message: 'Test not found.' });
  res.json(test);
});

app.post('/api/tests/:id/start', authMiddleware, async (req, res) => {
  try {
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test not found.' });
    const existing = await TestAttempt.findOne({ testId: req.params.id, userEmail: req.user.email, completed: true });
    if (existing) return res.status(400).json({ message: 'You have already taken this test.' });
    const attempt = new TestAttempt({
      testId: req.params.id,
      userEmail: req.user.email,
      totalMarks: test.questions.reduce((sum, q) => sum + q.marks, 0)
    });
    await attempt.save();
    res.status(201).json({ attemptId: attempt._id, startTime: attempt.startTime });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/tests/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { attemptId, answers } = req.body;
    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt) return res.status(404).json({ message: 'Attempt not found.' });
    if (attempt.completed) return res.status(400).json({ message: 'Already submitted.' });
    const test = await Test.findById(req.params.id);
    let score = 0;
    const gradedAnswers = answers.map(ans => {
      const question = test.questions.id(ans.questionId);
      const isCorrect = question && question.correctAnswer.trim().toLowerCase() === ans.selectedAnswer.trim().toLowerCase();
      const marksObtained = isCorrect ? question.marks : 0;
      score += marksObtained;
      return { questionId: ans.questionId, selectedAnswer: ans.selectedAnswer, isCorrect, marksObtained };
    });
    attempt.endTime = new Date();
    attempt.score = score;
    attempt.answers = gradedAnswers;
    attempt.completed = true;
    await attempt.save();
    res.json({ score, totalMarks: attempt.totalMarks, attemptId: attempt._id });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/tests/result/:attemptId', authMiddleware, async (req, res) => {
  const attempt = await TestAttempt.findById(req.params.attemptId)
    .populate('testId', 'title duration').lean();
  if (!attempt) return res.status(404).json({ message: 'Attempt not found.' });
  const test = await Test.findById(attempt.testId._id || attempt.testId).lean();
  res.json({ attempt, test });
});

app.get('/api/tests/:id/my-attempts', authMiddleware, async (req, res) => {
  const attempts = await TestAttempt.find({ testId: req.params.id, userEmail: req.user.email })
    .sort({ createdAt: -1 }).lean();
  res.json(attempts);
});

app.get('/api/tests/:id/leaderboard', async (req, res) => {
  const attempts = await TestAttempt.find({ testId: req.params.id, completed: true })
    .sort({ score: -1, endTime: 1 })
    .limit(50)
    .lean();
  const enriched = await Promise.all(attempts.map(async (a) => {
    const user = await User.findOne({ email: a.userEmail }).select('name').lean();
    return { ...a, userName: user ? user.name : 'Unknown' };
  }));
  res.json(enriched);
});

// ========== AI CHATBOT (Sankalp Sathi) – TRAINED ==========
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: 'Messages array required.' });
  }

  const systemMsg = {
    role: "system",
    content: `You are "Sankalp Sathi", the official AI assistant of Sankalp Digital Pathshala, a platform under the Sankalp Shiksha Foundation.

Your answers must follow these rules strictly:
- Use plain paragraphs only. Never use markdown formatting like bold (**), italic (*), headings (#), tables (|), lists (- or *), or code blocks.
- Write naturally as if you are talking to a friend. Use simple, clear sentences.
- Break information into short paragraphs (2-4 sentences each). Use a blank line between paragraphs.

About the organization – Sankalp Shiksha Foundation:

The foundation's mission is "हमारा संकल्प, सामाजिक उत्थान व कायाकल्प" (Our Pledge: Social Upliftment and Transformation). It works to close the digital divide between villages and cities.

It was founded on November 18, 2020, and is headquartered in Gorakhpur, Uttar Pradesh. The learning center called Sankalp Digital Pathshala is in Salemgarh, Tamkuhi, Kushinagar.

The founders are Abhishek Kumar and Vikas Kumar, both serving as Co-Founder and Director.

Abhishek Kumar holds a B.Tech from IIT. He is an engineer and tech entrepreneur who earlier worked in product development for a startup in Delhi. During college, he volunteered with NGOs. He was driven to start the Pathshala after seeing the growing digital divide between urban and rural India while visiting his native village in Uttar Pradesh. He wanted to bring the same quality of digital education that city kids enjoy to his own community.

Vikas Kumar holds a B.Tech in Computer Science from NIT Hamirpur. He is an engineer who later became a technical lead in a multinational IT services firm. He has experience building AI-driven platforms and robotics labs. During college, he actively participated in community-service clubs. During the COVID-19 lockdown in 2020, he and his friends were distributing food, masks, and sanitizers to stranded workers. The crisis showed him how lack of digital access made rural families even more vulnerable. This inspired him to set up a digital learning hub that could continue even during emergencies.

Why they started Sankalp Digital Pathshala: First, to bridge the digital divide by providing modern learning resources like computers, internet, and AI/Robotics labs to underprivileged children in villages of Kushinagar and surrounding districts. Second, to enable rural youth to acquire job-ready skills like web development, digital marketing, and AI basics without having to leave their hometowns. Third, to drive holistic community upliftment by combining education with health, sanitation, environmental, and livelihood initiatives.

Their journey milestones: In 2020, it started as a COVID-19 relief effort with food, masks, and sanitizers. In 2021, they launched the first digital classroom in Salemgarh, Tamkuhi. In 2022, they introduced AI and Robotics Labs with drones and automation kits. In 2023, they rolled out Rojgaar Buddy, a skilling program for youth aged 18 to 25. In 2024, they were recognized by Doordarshan for their impact on rural digital literacy. In 2025, Rojgaar Buddy had 312 plus trainees and 40 plus placements, with 73 percent from BPL families. In 2026, they are expanding to neighboring districts and discussing partnerships with the state IT ministry for scaling labs.

The Rojgaar Buddy program trains rural youth in Web Development, Graphic Design, Excel, Digital Marketing, Communication and Personality Development. Success stories include Vishal, a 22-year-old who now earns through freelance web design; Priya, who runs a small online business; and Imran, who manages a part-time digital marketing project for a local startup.

The foundation also runs community programs like cleanliness campaigns at Gomti river front, road safety awareness rallies, flood relief in UP and Bihar, COVID-19 ration distribution to over 400 families, festival celebrations with underprivileged children, and cricket competitions for talent identification.

Their vision: "Digital education is not a luxury; it is a right. By placing future-tech labs and skilled mentors in villages, we aim to create a generation that can innovate from the heart of rural India, turning local challenges into opportunities."

Contact: info@sankalppathshala.com, phone/WhatsApp: +91 8055698328. To donate or support, visit sankalpshiksha.com/donate.

Always answer in a friendly, warm tone. If you don't know something, say so honestly and suggest contacting the support team.`
  };

  const fullMessages = [systemMsg, ...messages];

  const models = [
    "openai/gpt-oss-120b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemini-flash-1.5-8b:free"
  ];

  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          stream: true
        })
      });

      if (response.ok) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value));
        }
      } else if (response.status === 429) {
        console.warn(`Model ${model} rate limited.`);
        continue;
      } else {
        console.error(`Model ${model} returned ${response.status}`);
        continue;
      }
    } catch (err) {
      console.error(`Error with model ${model}:`, err.message);
      continue;
    }
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const fallback = "I'm sorry, I'm currently experiencing high demand. Please try again in a moment, or contact our support team at info@sankalppathshala.com or +91 8055698328.";
  const chunk = JSON.stringify({ choices: [{ delta: { content: fallback } }] });
  res.write(`data: ${chunk}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});

// ========== FRONTEND FALLBACK ==========
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
