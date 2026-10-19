// Frontend logic (vanilla JS) for demo admin UI (with backend)
const endpoints = {
  login: '/api/login',
  links: '/api/links',
  templates: '/api/templates',
  proxy: '/api/proxy'
};

function el(id) { return document.getElementById(id); }
function show(sel) { document.querySelectorAll(sel).forEach(n => n.classList.remove('hidden')); }
function hide(sel) { document.querySelectorAll(sel).forEach(n => n.classList.add('hidden')); }

let token = localStorage.getItem('token') || null;

async function apiFetch(url, opts = {}) {
  opts.headers = opts.headers || {};
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  opts.headers['Accept'] = 'application/json';
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const r = await fetch(url, opts);
  if (r.status === 401) {
    logout();
    throw new Error('Unauthorized');
  }
  return r.json();
}

/* --- Auth / UI toggles --- */
function renderLoggedInState() {
  hide('#loginView');
  show('#mainNav'); show('#dashboard');
  loadLinks();
  loadTemplates();
}
function renderLoggedOutState() {
  hide('#mainNav'); hide('#dashboard');
  show('#loginView');
}

function loginFromForm() {
  const username = el('username').value;
  const password = el('password').value;
  apiFetch(endpoints.login, { method: 'POST', body: { username, password } })
    .then(res => {
      if (res.ok && res.token) {
        token = res.token;
        localStorage.setItem('token', token);
        renderLoggedInState();
      } else {
        alert('Đăng nhập thất bại');
      }
    })
    .catch(err => alert('Lỗi đăng nhập: ' + err.message));
}

function logout() {
  token = null;
  localStorage.removeItem('token');
  renderLoggedOutState();
}

/* --- Links management --- */
async function loadLinks() {
  try {
    const res = await apiFetch(endpoints.links);
    if (!res.ok) throw new Error(res.error || 'Load failed');
    renderLinks(res.links || []);
  } catch (err) {
    console.error(err);
    alert('Không thể tải liên kết: ' + err.message);
  }
}

function renderLinks(list) {
  const container = el('linksList');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="card muted">Chưa có liên kết nào.</div>';
    return;
  }
  list.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card link-item';
    card.innerHTML = `
      <div class="row between">
        <div class="left">
          <div class="link-title">${escapeHtml(item.name)}</div>
          <div class="muted small">${escapeHtml(item.url)}</div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-action="open" data-id="${item.id}">Mở</button>
          <button class="btn ghost" data-action="edit" data-id="${item.id}">Sửa</button>
          <button class="btn ghost danger" data-action="del" data-id="${item.id}">Xóa</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  container.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const action = b.dataset.action;
      const all = (await apiFetch(endpoints.links)).links || [];
      const target = all.find(l => l.id === id);
      if (!target) return alert('Không tìm thấy liên kết');
      if (action === 'open') window.open(target.url, '_blank');
      else if (action === 'edit') {
        el('linkName').value = target.name;
        el('linkUrl').value = target.url;
        el('linkIcon').value = target.icon || '';
        el('btnAddLink').dataset.editId = id;
        el('btnAddLink').textContent = 'Lưu';
      } else if (action === 'del') {
        if (!confirm('Xóa liên kết này?')) return;
        await apiFetch(`${endpoints.links}/${id}`, { method: 'DELETE' });
        loadLinks();
      }
    });
  });
}

function clearLinkForm() {
  el('linkName').value = '';
  el('linkUrl').value = '';
  el('linkIcon').value = '';
  delete el('btnAddLink').dataset.editId;
  el('btnAddLink').textContent = 'Thêm';
}

async function submitLink() {
  const name = el('linkName').value.trim();
  const url = el('linkUrl').value.trim();
  const icon = el('linkIcon').value.trim();
  if (!name || !url) return alert('Cần tên và url');
  const editId = el('btnAddLink').dataset.editId;
  if (editId) {
    await apiFetch(`${endpoints.links}/${editId}`, { method: 'PUT', body: { name, url, icon } });
  } else {
    await apiFetch(endpoints.links, { method: 'POST', body: { name, url, icon } });
  }
  clearLinkForm();
  loadLinks();
}

/* --- Templates management (frontend) --- */
async function loadTemplates() {
  try {
    const res = await apiFetch(endpoints.templates);
    if (!res.ok) throw new Error(res.error || 'Load templates failed');
    renderTemplates(res.templates || []);
  } catch (err) {
    console.error(err);
  }
}

function renderTemplates(list) {
  const container = el('templatesList');
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="card muted">Chưa có mẫu nào.</div>';
    return;
  }
  list.forEach(t => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row between">
        <div class="left">
          <div class="link-title">${escapeHtml(t.name)}</div>
          <div class="muted small">${escapeHtml(t.url)} • ${escapeHtml(t.method)}</div>
          <div class="muted small">${escapeHtml(t.description || '')}</div>
        </div>
        <div class="actions">
          <button class="btn ghost" data-action="use" data-id="${t.id}">Sử dụng</button>
          <button class="btn ghost" data-action="edit" data-id="${t.id}">Sửa</button>
          <button class="btn ghost danger" data-action="del" data-id="${t.id}">Xóa</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  container.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', async () => {
      const id = b.dataset.id;
      const action = b.dataset.action;
      const all = (await apiFetch(endpoints.templates)).templates || [];
      const target = all.find(x => x.id === id);
      if (!target) return alert('Không tìm thấy mẫu');
      if (action === 'use') {
        el('apiUrl').value = target.url;
        el('apiMethod').value = target.method;
        el('apiHeaders').value = JSON.stringify(target.headers || {}, null, 2);
        el('apiBody').value = typeof target.body === 'object' ? JSON.stringify(target.body, null, 2) : (target.body || '');
      } else if (action === 'edit') {
        el('templateName').value = target.name;
        el('templateUrl').value = target.url;
        el('templateMethod').value = target.method;
        el('templateHeaders').value = JSON.stringify(target.headers || {}, null, 2);
        el('templateBody').value = typeof target.body === 'object' ? JSON.stringify(target.body, null, 2) : (target.body || '');
        el('templateDesc').value = target.description || '';
        el('btnSaveTemplate').dataset.editId = id;
        el('btnSaveTemplate').textContent = 'Lưu sửa';
      } else if (action === 'del') {
        if (!confirm('Xóa mẫu này?')) return;
        await apiFetch(`${endpoints.templates}/${id}`, { method: 'DELETE' });
        loadTemplates();
      }
    });
  });
}

function clearTemplateForm() {
  el('templateName').value = '';
  el('templateUrl').value = '';
  el('templateHeaders').value = '';
  el('templateBody').value = '';
  el('templateDesc').value = '';
  delete el('btnSaveTemplate').dataset.editId;
  el('btnSaveTemplate').textContent = 'Lưu mẫu';
}

async function saveTemplate() {
  const name = el('templateName').value.trim();
  const url = el('templateUrl').value.trim();
  const method = el('templateMethod').value;
  const headersText = el('templateHeaders').value.trim();
  const bodyText = el('templateBody').value.trim();
  const description = el('templateDesc').value.trim();
  if (!name || !url) return alert('Cần tên và url cho mẫu');
  let headers = {};
  let body = null;
  if (headersText) {
    try { headers = JSON.parse(headersText); } catch (e) { return alert('Headers phải là JSON hợp lệ'); }
  }
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch (e) { return alert('Body phải là JSON hợp lệ'); }
  }
  const editId = el('btnSaveTemplate').dataset.editId;
  if (editId) {
    await apiFetch(`${endpoints.templates}/${editId}`, { method: 'PUT', body: { name, url, method, headers, body, description } });
  } else {
    await apiFetch(endpoints.templates, { method: 'POST', body: { name, url, method, headers, body, description } });
  }
  clearTemplateForm();
  loadTemplates();
}

/* --- API proxy call (with headers) --- */
async function callApiProxy() {
  const url = el('apiUrl').value.trim();
  const method = el('apiMethod').value;
  const headersText = el('apiHeaders').value.trim();
  let bodyText = el('apiBody').value.trim();
  let body = null;
  let headers = {};
  if (headersText) {
    try { headers = JSON.parse(headersText); } catch (e) { return alert('Headers phải là JSON hợp lệ'); }
  }
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch (e) { return alert('Body phải là JSON hợp lệ'); }
  }
  el('apiResult').textContent = 'Đang gọi...';
  try {
    const res = await apiFetch(endpoints.proxy, { method: 'POST', body: { url, method, headers, body } });
    el('apiResult').textContent = JSON.stringify(res, null, 2);
  } catch (err) {
    el('apiResult').textContent = 'Lỗi: ' + err.message;
  }
}

/* --- Tabs --- */
document.addEventListener('click', (ev) => {
  if (ev.target.matches('.tab')) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    ev.target.classList.add('active');
    const tab = ev.target.dataset.tab;
    document.querySelectorAll('.tabContent').forEach(tc => tc.classList.add('hidden'));
    document.getElementById('tab' + capitalize(tab)).classList.remove('hidden');
  }
});

/* --- Helpers --- */
function escapeHtml(s) { return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

/* --- Wire up events --- */
document.getElementById('btnLogin').addEventListener('click', loginFromForm);
document.getElementById('btnLogout').addEventListener('click', logout);
document.getElementById('btnAddLink').addEventListener('click', submitLink);
document.getElementById('btnClear').addEventListener('click', clearLinkForm);
document.getElementById('btnSaveTemplate').addEventListener('click', saveTemplate);
document.getElementById('btnClearTemplate').addEventListener('click', clearTemplateForm);
document.getElementById('btnCallApi').addEventListener('click', callApiProxy);
document.getElementById('btnClearApi').addEventListener('click', () => { el('apiUrl').value=''; el('apiHeaders').value=''; el('apiBody').value=''; el('apiResult').textContent=''; });

if (token) renderLoggedInState(); else renderLoggedOutState();