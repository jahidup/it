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
app.use(express.json({ limit: '10mb' }));
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
  isVerified: { type: Boolean, default: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student' }
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
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }
});
const Enrollment = mongoose.model('Enrollment', enrollmentSchema);

const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: Date,
  verified: Boolean,
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
  aiReply: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});
const Doubt = mongoose.model('Doubt', doubtSchema);

const questionSchema = new mongoose.Schema({
  type: { type: String, enum: ['mcq', 'numerical'], required: true },
  questionText: String,
  questionImage: String,
  options: [String],
  correctAnswer: String,
  marks: { type: Number, default: 1 },
  explanation: String
});
const testSchema = new mongoose.Schema({
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: String,
  description: String,
  duration: Number,
  startTime: Date,
  endTime: Date,
  isLive: { type: Boolean, default: false },
  negativeMarking: { type: Number, default: 0 },
  language: { type: String, enum: ['english', 'hindi', 'both'], default: 'english' },
  questions: [questionSchema]
});
const Test = mongoose.model('Test', testSchema);

const testAttemptSchema = new mongoose.Schema({
  testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
  userEmail: String,
  startTime: Date,
  endTime: Date,
  score: Number,
  totalMarks: Number,
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedAnswer: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  completed: { type: Boolean, default: false }
});
const TestAttempt = mongoose.model('TestAttempt', testAttemptSchema);

const practiceSchema = new mongoose.Schema({
  userEmail: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  chapterId: String,
  topic: String,
  level: String,
  questions: [questionSchema],
  answers: [{
    questionId: mongoose.Schema.Types.ObjectId,
    selectedAnswer: String,
    isCorrect: Boolean,
    marksObtained: Number
  }],
  score: Number,
  totalMarks: Number,
  createdAt: { type: Date, default: Date.now }
});
const Practice = mongoose.model('Practice', practiceSchema);

const activitySchema = new mongoose.Schema({
  userEmail: String,
  action: String,
  details: String,
  timestamp: { type: Date, default: Date.now }
});
const Activity = mongoose.model('Activity', activitySchema);

const chatMessageSchema = new mongoose.Schema({
  userEmail: String,
  userName: String,
  message: String,
  type: { type: String, enum: ['ai', 'broadcast', 'community', 'private'], default: 'ai' },
  receiverEmail: String,
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  createdAt: { type: Date, default: Date.now }
});
const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

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

async function logActivity(userEmail, action, details = '') {
  await new Activity({ userEmail, action, details, timestamp: new Date() }).save();
}

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Sankalp Digital Pathshala" <${process.env.EMAIL_USER}>`,
      to, subject, html
    });
  } catch (e) { console.error('Email error:', e); }
}

// ========== AUTH ROUTES ==========
app.post('/api/auth/send-otp',
  rateLimit({ windowMs: 15*60*1000, max: 3, message: 'Too many OTP requests.' }),
  async (req, res) => { /* ... same as before ... */ });

app.post('/api/auth/verify-otp', async (req, res) => { /* ... */ });
app.post('/api/auth/register', async (req, res) => { /* ... */ });

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
    const user = await User.findOne({ email, isVerified: true });
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { userId: user._id, email: user.email, name: user.name, role: user.role || 'student' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    // Send login notification
    sendEmail(user.email, 'New Login Alert', `<p>Hello ${user.name}, you just logged in.</p>`);
    logActivity(user.email, 'login');
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

app.post('/api/auth/forgot-password', async (req, res) => { /* ... */ });
app.post('/api/auth/verify-reset-otp', async (req, res) => { /* ... */ });
app.post('/api/auth/reset-password', async (req, res) => { /* ... */ });

// ========== COURSE ROUTES ==========
app.get('/api/courses', async (req, res) => {
  const courses = await Course.find().sort({ createdAt: -1 }).lean();
  res.json(courses);
});
app.post('/api/courses/enroll', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/courses/my-enrollments', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/courses/:id', async (req, res) => { /* ... */ });

// ========== PROGRESS ROUTES ==========
app.get('/api/progress/my-report', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/progress/:courseId', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/progress/mark-complete/:courseId/:lectureId', authMiddleware, async (req, res) => { /* ... */ });

// ========== DOUBTS ROUTES ==========
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
    logActivity(req.user.email, 'doubt_posted', message.substring(0, 50));

    // Generate AI auto‑reply (async)
    generateAIDoubtReply(doubt._id, message).catch(e => console.error('AI doubt error:', e));

    res.status(201).json(doubt);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

async function generateAIDoubtReply(doubtId, question) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b:free",
        messages: [
          { role: "system", content: "Provide a helpful, concise explanation." },
          { role: "user", content: question }
        ],
        stream: false
      })
    });
    const data = await response.json();
    const aiReply = data.choices?.[0]?.message?.content || '';
    if (aiReply) {
      await Doubt.findByIdAndUpdate(doubtId, { aiReply, adminReply: aiReply });
    }
  } catch (e) { /* ignore */ }
}

app.get('/api/doubts/:courseId/:lectureId', async (req, res) => {
  const { courseId, lectureId } = req.params;
  const topLevel = await Doubt.find({ courseId, lectureId, parentId: null })
    .sort({ createdAt: -1 }).lean();
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

app.get('/api/doubts/my', authMiddleware, async (req, res) => { /* ... */ });

// ========== ADMIN ROUTES ==========
app.get('/api/admin/stats', adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/courses', adminMiddleware, async (req, res) => { /* ... */ });
app.put('/api/admin/courses/:id', adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/admin/courses/:id', adminMiddleware, async (req, res) => { /* ... */ });

// Chapters & Lectures CRUD
app.post('/api/admin/courses/:id/chapters', adminMiddleware, async (req, res) => { /* ... */ });
app.put('/api/admin/courses/:id/chapters/:chapterId', adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/admin/courses/:id/chapters/:chapterId', adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/courses/:id/chapters/:chapterId/lectures', adminMiddleware, async (req, res) => { /* ... */ });
app.put('/api/admin/courses/:id/chapters/:chapterId/lectures/:lectureId', adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/admin/courses/:id/chapters/:chapterId/lectures/:lectureId', adminMiddleware, async (req, res) => { /* ... */ });

app.get('/api/admin/students', adminMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/assign', adminMiddleware, async (req, res) => { /* ... */ });
app.get('/api/admin/doubts', adminMiddleware, async (req, res) => { /* ... */ });
app.put('/api/admin/doubts/:id', adminMiddleware, async (req, res) => { /* ... */ });

// ========== TEST ADMIN ROUTES ==========
app.post('/api/admin/tests', adminMiddleware, async (req, res) => {
  try {
    const { courseId, title, description, duration, language, startTime, endTime, isLive, negativeMarking, questions } = req.body;
    const test = new Test({
      courseId, title, description, duration, language,
      startTime: startTime || null, endTime: endTime || null,
      isLive: isLive || false, negativeMarking: negativeMarking || 0,
      questions: questions || []
    });
    await test.save();
    res.status(201).json(test);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/admin/tests/:courseId', adminMiddleware, async (req, res) => { /* ... */ });
app.put('/api/admin/tests/:id', adminMiddleware, async (req, res) => { /* ... */ });
app.delete('/api/admin/tests/:id', adminMiddleware, async (req, res) => { /* ... */ });
app.get('/api/admin/tests/:id/attempts', adminMiddleware, async (req, res) => { /* ... */ });
app.get('/api/admin/attempts/:attemptId', adminMiddleware, async (req, res) => { /* ... */ });

// ========== STUDENT TEST ROUTES ==========
app.get('/api/tests/course/:courseId', authMiddleware, async (req, res) => {
  const now = new Date();
  const tests = await Test.find({
    courseId: req.params.courseId,
    isLive: true,
    $or: [{ startTime: null, endTime: null }, { startTime: { $lte: now }, endTime: { $gte: now } }]
  }).select('-questions.correctAnswer').lean();
  res.json(tests);
});

app.get('/api/tests/:id', authMiddleware, async (req, res) => {
  const test = await Test.findById(req.params.id).select('-questions.correctAnswer').lean();
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
      testId: req.params.id, userEmail: req.user.email, startTime: new Date(),
      totalMarks: test.questions.reduce((s, q) => s + q.marks, 0)
    });
    await attempt.save();
    logActivity(req.user.email, 'test_started', `Test: ${test.title}`);
    res.status(201).json({ attemptId: attempt._id });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.post('/api/tests/:id/submit', authMiddleware, async (req, res) => {
  try {
    const { attemptId, answers } = req.body;
    const attempt = await TestAttempt.findById(attemptId);
    if (!attempt || attempt.completed) return res.status(400).json({ message: 'Already submitted or invalid.' });
    const test = await Test.findById(req.params.id);
    let score = 0;
    const gradedAnswers = answers.map(ans => {
      const question = test.questions.id(ans.questionId);
      const isCorrect = question && question.correctAnswer.trim().toLowerCase() === ans.selectedAnswer.trim().toLowerCase();
      let marksObtained = 0;
      if (isCorrect) marksObtained = question.marks;
      else if (ans.selectedAnswer.trim() !== '') marksObtained = -test.negativeMarking;
      score += marksObtained;
      return { questionId: ans.questionId, selectedAnswer: ans.selectedAnswer, isCorrect, marksObtained };
    });
    attempt.endTime = new Date();
    attempt.score = score;
    attempt.answers = gradedAnswers;
    attempt.completed = true;
    await attempt.save();

    sendEmail(req.user.email, 'Test Result', `<p>You scored <strong>${score}</strong> / ${attempt.totalMarks} in <strong>${test.title}</strong>.</p>`);
    logActivity(req.user.email, 'test_completed', `Score: ${score}/${attempt.totalMarks}`);

    res.json({ score, totalMarks: attempt.totalMarks });
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/tests/result/:attemptId', authMiddleware, async (req, res) => {
  const attempt = await TestAttempt.findById(req.params.attemptId).populate('testId', 'title duration').lean();
  if (!attempt) return res.status(404).json({ message: 'Not found.' });
  const test = await Test.findById(attempt.testId._id || attempt.testId).lean();
  res.json({ attempt, test });
});

app.get('/api/tests/:id/leaderboard', async (req, res) => { /* ... */ });

// ========== PRACTICE ROUTES ==========
app.post('/api/practice/generate', authMiddleware, async (req, res) => {
  try {
    const { courseId, chapterId, topic, level, count } = req.body;
    // Simplified AI generation – in production you'd call the AI model
    const questions = Array.from({ length: count || 5 }, (_, i) => ({
      type: 'mcq',
      questionText: `Practice question ${i+1} about ${topic || 'this topic'} (${level})`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      marks: 1
    }));
    const practice = new Practice({
      userEmail: req.user.email, courseId, chapterId, topic, level,
      questions, totalMarks: questions.reduce((s, q) => s + q.marks, 0)
    });
    await practice.save();
    logActivity(req.user.email, 'practice_generated', `Practice: ${topic}`);
    res.status(201).json(practice);
  } catch (err) { res.status(500).json({ message: 'Server error.' }); }
});

app.get('/api/practice/my', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/practice/:id', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/practice/:id/submit', authMiddleware, async (req, res) => { /* ... */ });

// ========== CHAT / COMMUNITY / BROADCAST ==========
app.post('/api/chat/send', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/chat/community', authMiddleware, async (req, res) => { /* ... */ });
app.get('/api/chat/private', authMiddleware, async (req, res) => { /* ... */ });
app.post('/api/admin/broadcast', adminMiddleware, async (req, res) => { /* ... */ });

// ========== ACTIVITY FEED (ADMIN) ==========
app.get('/api/admin/activity/:userEmail', adminMiddleware, async (req, res) => { /* ... */ });

// ========== AI CHATBOT (Sankalp Sathi) ==========
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ message: 'Messages array required.' });

  const systemMsg = {
    role: "system",
    content: `You are "Sankalp Sathi", the official AI assistant of Sankalp Digital Pathshala...` // full prompt
  };

  const fullMessages = [systemMsg, ...messages];
  const models = ["openai/gpt-oss-120b:free", "meta-llama/llama-3.3-70b-instruct:free", "google/gemini-flash-1.5-8b:free"];

  for (const model of models) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: fullMessages, stream: true })
      });

      if (response.ok) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(decoder.decode(value));
        }
      } else if (response.status === 429) { continue; } else { continue; }
    } catch (err) { continue; }
  }

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const fallback = "I'm sorry, I'm currently experiencing high demand. Please try again later.";
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: fallback } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
});

// ========== FRONTEND FALLBACK ==========
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
