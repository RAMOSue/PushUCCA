const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5173;
const distPath = path.join(__dirname, 'dist');

console.log(`📁 Serving from: ${distPath}`);
console.log(`🚀 Starting frontend server on port ${PORT}`);

// Serve static files from dist directory with caching
app.use(express.static(distPath, {
  maxAge: '1h',
  etag: true,
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't redirect API calls
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  console.log(`📄 Serving index.html for route: ${req.path}`);
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      console.error(`❌ Error serving index.html:`, err);
      res.status(404).json({ error: 'Not found' });
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Frontend server running on port ${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'dist')}`);
});
