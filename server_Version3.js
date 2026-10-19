// server.js (demo backend with links + templates + proxy)
// WARNING: demo-only. Use HTTPS, proper auth, validation & DB for production.
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const LINKS_FILE = path.join(__dirname, 'links.json');
const TEMPLATES_FILE = path.join(__dirname, 'templates.json');

// Demo user + token (for demo only)
const DEMO_USER = { username: 'admin', password: 'password' };
const DEMO_TOKEN = 'demo-token-12345';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Helpers to load/save JSON
function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}
function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadLinks() { return loadJson(LINKS_FILE); }
function saveLinks(data) { saveJson(LINKS_FILE, data); }

function loadTemplates() { return loadJson(TEMPLATES_FILE); }
function saveTemplates(data) { saveJson(TEMPLATES_FILE, data); }

// Auth endpoints (VERY simple demo)
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === DEMO_USER.username && password === DEMO_USER.password) {
    return res.json({ ok: true, token: DEMO_TOKEN });
  }
  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

function requireAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (auth === `Bearer ${DEMO_TOKEN}`) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized' });
}

/* --- Links CRUD --- */
app.get('/api/links', requireAuth, (req, res) => {
  res.json({ ok: true, links: loadLinks() });
});

app.post('/api/links', requireAuth, (req, res) => {
  const links = loadLinks();
  const { name, url, icon } = req.body || {};
  if (!name || !url) return res.status(400).json({ ok: false, error: 'Missing name or url' });
  const item = { id: uuidv4(), name, url, icon: icon || '', createdAt: new Date().toISOString() };
  links.unshift(item);
  saveLinks(links);
  res.json({ ok: true, link: item });
});

app.put('/api/links/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const links = loadLinks();
  const idx = links.findIndex(l => l.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const { name, url, icon } = req.body || {};
  links[idx] = { ...links[idx], name: name || links[idx].name, url: url || links[idx].url, icon: icon || links[idx].icon, updatedAt: new Date().toISOString() };
  saveLinks(links);
  res.json({ ok: true, link: links[idx] });
});

app.delete('/api/links/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  let links = loadLinks();
  const before = links.length;
  links = links.filter(l => l.id !== id);
  if (links.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
  saveLinks(links);
  res.json({ ok: true });
});

/* --- Templates CRUD --- */
app.get('/api/templates', requireAuth, (req, res) => {
  res.json({ ok: true, templates: loadTemplates() });
});

app.post('/api/templates', requireAuth, (req, res) => {
  const templates = loadTemplates();
  const { name, url, method = 'GET', headers = {}, body = null, description = '' } = req.body || {};
  if (!name || !url) return res.status(400).json({ ok: false, error: 'Missing name or url' });
  const item = { id: uuidv4(), name, url, method, headers, body, description, createdAt: new Date().toISOString() };
  templates.unshift(item);
  saveTemplates(templates);
  res.json({ ok: true, template: item });
});

app.put('/api/templates/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const templates = loadTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Not found' });
  const { name, url, method, headers, body, description } = req.body || {};
  templates[idx] = {
    ...templates[idx],
    name: name || templates[idx].name,
    url: url || templates[idx].url,
    method: method || templates[idx].method,
    headers: headers || templates[idx].headers,
    body: (body === undefined) ? templates[idx].body : body,
    description: description || templates[idx].description,
    updatedAt: new Date().toISOString()
  };
  saveTemplates(templates);
  res.json({ ok: true, template: templates[idx] });
});

app.delete('/api/templates/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  let templates = loadTemplates();
  const before = templates.length;
  templates = templates.filter(t => t.id !== id);
  if (templates.length === before) return res.status(404).json({ ok: false, error: 'Not found' });
  saveTemplates(templates);
  res.json({ ok: true });
});

/* --- Simple API proxy (be careful!) --- */
app.post('/api/proxy', requireAuth, async (req, res) => {
  const { method = 'GET', url, headers = {}, body } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });

  // Basic safety: disallow some local addresses (very naive)
  if (url.startsWith('http://localhost') || url.startsWith('http://127.') || url.startsWith('file://')) {
    return res.status(400).json({ ok: false, error: 'Local addresses are not allowed' });
  }

  try {
    const opts = { method, headers: { ...headers } };
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    const resp = await fetch(url, opts);
    const contentType = resp.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) data = await resp.json();
    else data = await resp.text();
    res.json({ ok: true, status: resp.status, headers: Object.fromEntries(resp.headers.entries()), data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* --- Fallback to serve frontend --- */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});