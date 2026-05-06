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
otpSchema.index({ expiresAt很重要: 1 }, { expireAfterSeconds: 0 });
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

// ========== MIDDLEWARE ==========
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

// ========== EMAIL SETUP ==========
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

// ========== PROGRESS ROUTES (order matters – specific BEFORE parameterized) ==========
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

// Admin doubts – enriched with course, chapter, lecture titles
app.get('/api/admin/doubts', adminMiddleware, async (req, res) => {
  try {
    const topDoubts = await Doubt.find({ parentId: null })
      .sort({ createdAt: -1 })
      .lean();
    const enriched = await Promise.all(topDoubts.map(async (d) => {
      const course = await Course.findById(d.courseId).lean();
      let chapterTitle = 'Deleted Chapter';
      let lectureTitle = 'Deleted Lecture';
      if (course && course.chapters) {
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
        courseTitle: course ? course.title : 'Deleted Course',
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

// ========== AI CHATBOT (Sankalp Sathi) – with fallback models ==========
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: 'Messages array required.' });
  }

  const systemMsg = {
    role: "system",
    content: `You are a helpful AI assistant for Sankalp Digital Pathshala, an online IT institute. 
The platform offers courses like Complete Web Development, Python for Data Science, Digital Marketing, etc. 
Students can register, buy courses, watch lectures organised in chapters, mark lectures as completed, ask doubts in a discussion panel, and track progress. 
Admins manage courses, chapters, lectures, student enrollments, and reply to doubts. 
Provide friendly, concise, and accurate answers about the platform, courses, pricing, features, and how to use them. 
If you don't know something, say you're an AI and suggest contacting support at info@sankalppathshala.com or +91 8055698328.`
  };

  const fullMessages = [systemMsg, ...messages];

  // Fallback list of free models
  const models = [
    "meta-llama/llama-3.3-70b-instruct:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "google/gemini-flash-1.5-8b:free"
  ];

  let lastError = null;

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
        // Stream successful response
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
        lastError = 'Rate limited, trying next model...';
        console.warn(`Model ${model} rate limited.`);
        continue; // try next model
      } else {
        const errorText = await response.text();
        lastError = errorText;
        console.error(`Model ${model} error:`, errorText);
        break; // non-429 error, stop trying
      }
    } catch (err) {
      lastError = err.message;
      console.error(`Error with model ${model}:`, err);
      break;
    }
  }

  // If all models failed
  return res.status(503).json({ message: 'AI service temporarily unavailable. Please try again later.' });
});

// ========== FRONTEND FALLBACK ==========
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
