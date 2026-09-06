const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const connectDB = require('./backend/config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// PC Direct Route & Asset Prefix Middleware:
// Supports clean URLs like: /PC-01, /PC=02, /PC-13, /PC=13, /pc13, /13
app.use((req, res, next) => {
  const pcMatch = req.url.match(/^\/pc(?:id)?[-_=\s]*([0-9]{1,3})(\/.*)?$/i) || req.url.match(/^\/([0-9]{1,3})(\/.*)?$/);
  if (pcMatch) {
    const subPath = pcMatch[2];
    if (subPath && subPath !== '/') {
      // Subpath requested like /PC-02/css/style.css or /PC=13/registration.html
      req.url = subPath;
      return next();
    } else {
      // Direct PC terminal request: serve index.html
      return res.sendFile(path.join(__dirname, 'frontend/index.html'));
    }
  }
  next();
});

// Static directories
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/students', require('./backend/routes/students'));
app.use('/api/admin', require('./backend/routes/admin'));
app.use('/api/question-sets', require('./backend/routes/questionSets'));
app.use('/api/questions', require('./backend/routes/questions'));
app.use('/api/traps', require('./backend/routes/traps'));
app.use('/api/clues', require('./backend/routes/clues'));
app.use('/api/game', require('./backend/routes/game'));
app.use('/api/results', require('./backend/routes/results'));

// Fallback to index.html for single page application styling or clean refreshes if needed,
// but for standard static page routing let's handle pages directly.
app.get('*', (req, res, next) => {
  // If it's an API route that failed, let it return 404 naturally
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`Server running locally: http://localhost:${PORT}`);
  
  // Dynamically list network IP addresses for Ethernet / Wi-Fi connection
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  console.log(`\nTo connect other PCs over local network (Ethernet/Wi-Fi):`);
  let foundAddress = false;
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      // Node 18+ uses family: 'IPv4', older might use 4
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        console.log(`  🔗 Student PC-01: http://${iface.address}:${PORT}/PC-01`);
        console.log(`  🔗 Student PC-02: http://${iface.address}:${PORT}/PC-02`);
        console.log(`  🔗 Student PC-03: http://${iface.address}:${PORT}/PC-03  (and so on /PC-XX)`);
        console.log(`  👑 Admin Panel:   http://${iface.address}:${PORT}/admin/dashboard.html\n`);
        foundAddress = true;
      }
    }
  }
  if (!foundAddress) {
    console.log(`  (No active local network interfaces found)`);
  }
  console.log(`==================================================\n`);
});
