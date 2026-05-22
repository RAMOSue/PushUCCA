const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5173;
const distPath = path.join(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

console.log(`📁 Serving from: ${distPath}`);
console.log(`🚀 Starting frontend server on port ${PORT}`);

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error(`❌ ERROR: dist folder not found at ${distPath}`);
  console.error('Make sure to run: npm run build');
}

// Serve static files from dist directory with caching
app.use(express.static(distPath, {
  maxAge: '1h',
  etag: true,
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', distExists: fs.existsSync(distPath) });
});

// SPA fallback: serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't redirect API calls
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  console.log(`📄 Serving index.html for route: ${req.path}`);
  
  // Check if index.html exists
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ ERROR: index.html not found at ${indexPath}`);
    return res.status(500).json({ error: 'index.html not found - build may have failed' });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`❌ Error serving index.html:`, err);
      res.status(500).json({ error: 'Failed to serve index.html' });
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
  console.log(`✅ Ready to serve SPA from: ${distPath}`);
});
