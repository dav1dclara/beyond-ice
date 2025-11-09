import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Read .env file and parse VITE_MAPBOX_TOKEN
let mapboxToken = '';
try {
  const envFile = readFileSync(join(rootDir, '.env'), 'utf-8');
  const tokenMatch = envFile.match(/VITE_MAPBOX_TOKEN=(.+)/);
  if (tokenMatch) {
    mapboxToken = tokenMatch[1].trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
  }
} catch (error) {
  console.warn('Could not read .env file:', error.message);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/config.js') {
    // Serve dynamically generated config.js with token from .env
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(`window.config = { accessToken: "${mapboxToken}" };`);
  } else if (url.pathname === '/overlay-model.html' || url.pathname === '/display-model.html' || url.pathname === '/') {
    // Serve the HTML files
    try {
      const filename = url.pathname === '/' ? 'overlay-model.html' : url.pathname.slice(1);
      const html = readFileSync(join(__dirname, filename), 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  } else {
    // Serve static files (e.g., data/raster.gltf)
    try {
      const filepath = join(__dirname, url.pathname.slice(1));
      // Security: ensure file is within __dirname
      if (!filepath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      const file = readFileSync(filepath);
      // Determine content type based on extension
      const ext = url.pathname.split('.').pop().toLowerCase();
      const contentTypes = {
        'gltf': 'model/gltf+json',
        'glb': 'model/gltf-binary',
        'bin': 'application/octet-stream',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg'
      };
      const contentType = contentTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(file);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
  }
});

const PORT = 8000;
server.listen(PORT, () => {
  console.log(`Test server running at http://localhost:${PORT}/`);
  console.log(`Available files:`);
  console.log(`  - http://localhost:${PORT}/overlay-model.html`);
  console.log(`  - http://localhost:${PORT}/display-model.html`);
  console.log(`Using Mapbox token from .env: ${mapboxToken ? 'Found' : 'NOT FOUND - check .env file'}`);
});

