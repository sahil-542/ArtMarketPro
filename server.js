const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware with UPDATED CSP
// app.use(helmet({
//   contentSecurityPolicy: {
//     directives: {
//       defaultSrc: ["'self'"],
//       styleSrc: [
//         "'self'", 
//         "'unsafe-inline'", 
//         "https://fonts.googleapis.com", 
//         "https://cdnjs.cloudflare.com",
//         "https://cdn.tailwindcss.com",        // ✅ ADDED
//         "https://cdn.jsdelivr.net"            // ✅ ADDED
//       ],
//       fontSrc: [
//         "'self'", 
//         "https://fonts.gstatic.com",
//         "https://fonts.googleapis.com",       // ✅ ADDED
//         "https://cdnjs.cloudflare.com"
//       ],
//       imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
//       scriptSrc: [
//         "'self'", 
//         "'unsafe-inline'",
//         "'unsafe-eval'",                      // ✅ ADDED (needed for Tailwind CDN)
//         "https://cdnjs.cloudflare.com", 
//         "https://js.stripe.com",
//         "https://cdn.tailwindcss.com",        // ✅ ADDED
//         "https://cdn.jsdelivr.net"            // ✅ ADDED
//       ],
//       connectSrc: [
//         "'self'", 
//         "https://api.stripe.com",
//         "https://cdnjs.cloudflare.com",       // ✅ ADDED (for .map files)
//         "ws://localhost:*",                   // ✅ ADDED (for Socket.IO local)
//         "wss://*"                             // ✅ ADDED (for Socket.IO production)
//       ],
//       frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
//       mediaSrc: ["'self'", "https:"],         // ✅ ADDED
//       objectSrc: ["'none'"]
//     }
//   },
//   crossOriginEmbedderPolicy: false            // ✅ ADDED (some CDNs need this)
// }));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://fonts.googleapis.com", 
        "https://cdnjs.cloudflare.com",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net"
      ],
      fontSrc: [
        "'self'", 
        "https://fonts.gstatic.com",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'", 
        "data:", 
        "https:", 
        "http:", 
        "blob:",
        "https://ui-avatars.com",           // ✅ ADDED for avatar placeholders
        "https://picsum.photos"             // ✅ ADDED for artwork images
      ],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdnjs.cloudflare.com", 
        "https://js.stripe.com",
        "https://cdn.tailwindcss.com",
        "https://cdn.jsdelivr.net"
      ],
      "script-src-attr": ["'unsafe-inline'"],  // ✅ ADDED for onclick handlers
      connectSrc: [
        "'self'", 
        "https://api.stripe.com",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",           // ✅ ADDED
        "ws://localhost:*",
        "wss://*"
      ],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      mediaSrc: ["'self'", "https:"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/artmarket', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/artworks', require('./routes/artworks'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/commissions', require('./routes/commissions'));
app.use('/api/collections', require('./routes/collections'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/payments', require('./routes/payments'));

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (room) => {
    socket.join(room);
  });
  
  socket.on('leave-room', (room) => {
    socket.leave(room);
  });
  
  socket.on('new-message', (data) => {
    io.to(data.conversationId).emit('message-received', data);
  });
  
  socket.on('bid-placed', (data) => {
    io.to(`auction-${data.auctionId}`).emit('bid-update', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Serve React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };