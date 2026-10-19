// Static-only frontend using localStorage. Demo only.
const STORAGE_KEYS = { LINKS: 'ml_links', TEMPLATES: 'ml_templates', TOKEN: 'ml_token' };
const DEMO_USER = { username: 'admin', password: 'password' };

function el(id){ return document.getElementById(id); }
function show(sel){ document.querySelectorAll(sel).forEach(n=>n.classList.remove('hidden')); }
function hide(sel){ document.querySelectorAll(sel).forEach(n=>n.classList.add('hidden')); }

function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function load(key){ try { return JSON.parse(localStorage.getItem(key) || 'null') || []; } catch(e){ return []; } }

let token = localStorage.getItem(STORAGE_KEYS.TOKEN) || null;

function loginFromForm(){
  const u = el('username').value;
  const p = el('password').value;
  if (u === DEMO_USER.username && p === DEMO_USER.password) {
    token = 'local-demo-token';
    localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    renderLoggedInState();
  } else alert('Sai thông tin đăng nhập');
}
function logout(){
  token = null;
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  renderLoggedOutState();
}

function renderLoggedInState(){
  hide('#loginView'); show('#mainNav'); show('#dashboard');
  renderLinks(load(STORAGE_KEYS.LINKS));
  renderTemplates(load(STORAGE_KEYS.TEMPLATES));
}
function renderLoggedOutState(){
  show('#loginView'); hide('#mainNav'); hide('#dashboard');
}

function renderLinks(list){
  const c = el('linksList'); c.innerHTML = '';
  if (!list.length) { c.innerHTML = '<div class="card muted">Chưa có liên kết nào.</div>'; return; }
  list.forEach((l, idx) => {
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div class="row between"><div><div class="link-title">${escape(l.name)}</div><div class="muted small">${escape(l.url)}</div></div>
      <div class="actions"><button class="btn ghost" data-idx="${idx}" data-act="open">Mở</button><button class="btn ghost" data-idx="${idx}" data-act="del">Xóa</button></div></div>`;
    c.appendChild(card);
  });
  c.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const idx = b.dataset.idx;
    const act = b.dataset.act;
    const list = load(STORAGE_KEYS.LINKS);
    if (act === 'open') window.open(list[idx].url, '_blank');
    else if (act === 'del') { if(confirm('Xóa?')){ list.splice(idx,1); save(STORAGE_KEYS.LINKS,list); renderLinks(list); } }
  }));
}

function addLink(){
  const name = el('linkName').value.trim(); const url = el('linkUrl').value.trim();
  if (!name || !url) return alert('Cần tên và url');
  const list = load(STORAGE_KEYS.LINKS);
  list.unshift({ id: Date.now(), name, url, createdAt: new Date().toISOString() });
  save(STORAGE_KEYS.LINKS, list);
  el('linkName').value=''; el('linkUrl').value='';
  renderLinks(list);
}

function renderTemplates(list){
  const c = el('templatesList'); c.innerHTML = '';
  if (!list.length) { c.innerHTML = '<div class="card muted">Chưa có mẫu nào.</div>'; return; }
  list.forEach((t, idx) => {
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<div class="row between"><div><div class="link-title">${escape(t.name)}</div><div class="muted small">${escape(t.url)} • ${escape(t.method)}</div></div>
      <div class="actions"><button class="btn ghost" data-idx="${idx}" data-act="use">Sử dụng</button><button class="btn ghost" data-idx="${idx}" data-act="del">Xóa</button></div></div>`;
    c.appendChild(card);
  });
  c.querySelectorAll('button').forEach(b => b.addEventListener('click', async () => {
    const idx = b.dataset.idx; const act = b.dataset.act; const list = load(STORAGE_KEYS.TEMPLATES);
    if (act === 'use') {
      const t = list[idx];
      el('apiUrl').value = t.url; el('apiMethod').value = t.method; el('apiHeaders').value = JSON.stringify(t.headers||{}, null, 2); el('apiBody').value = typeof t.body==='object'?JSON.stringify(t.body,null,2):(t.body||'');
    } else if (act === 'del') {
      if (!confirm('Xóa mẫu?')) return;
      list.splice(idx,1); save(STORAGE_KEYS.TEMPLATES, list); renderTemplates(list);
    }
  }));
}

function saveTemplate(){
  const name = el('templateName').value.trim(); const url = el('templateUrl').value.trim(); const method = el('templateMethod').value;
  const headersText = el('templateHeaders').value.trim(); const bodyText = el('templateBody').value.trim();
  if (!name || !url) return alert('Cần tên & url');
  let headers = {}; let body = null;
  if (headersText) { try { headers = JSON.parse(headersText); } catch (e){ return alert('Headers JSON không hợp lệ'); } }
  if (bodyText) { try { body = JSON.parse(bodyText); } catch (e){ return alert('Body JSON không hợp lệ'); } }
  const list = load(STORAGE_KEYS.TEMPLATES);
  list.unshift({ id: Date.now(), name, url, method, headers, body, createdAt: new Date().toISOString() });
  save(STORAGE_KEYS.TEMPLATES, list);
  el('templateName').value=''; el('templateUrl').value=''; el('templateHeaders').value=''; el('templateBody').value='';
  renderTemplates(list);
}

async function callApiDirect(){
  const url = el('apiUrl').value.trim(); const method = el('apiMethod').value;
  const headersText = el('apiHeaders').value.trim(); let body = null;
  if (!url) return alert('Cần URL');
  if (headersText) { try{ var headers = JSON.parse(headersText); }catch(e){ return alert('Headers JSON không hợp lệ'); } }
  const bodyText = el('apiBody').value.trim();
  if (bodyText) { try{ body = JSON.parse(bodyText); } catch(e){ return alert('Body JSON không hợp lệ'); } }
  el('apiResult').textContent = 'Đang gọi...';
  try {
    const opts = { method, headers: headers || {} };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(url, opts);
    const ct = resp.headers.get('content-type') || '';
    let data;
    if (ct.includes('application/json')) data = await resp.json();
    else data = await resp.text();
    el('apiResult').textContent = JSON.stringify({ status: resp.status, data }, null, 2);
  } catch (err) {
    el('apiResult').textContent = 'Lỗi: ' + err.message + '\nLưu ý: Nếu bị lỗi CORS, API không cho phép truy cập trực tiếp từ trình duyệt.';
  }
}

function escape(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

document.getElementById('btnLogin').addEventListener('click', loginFromForm);
document.getElementById('btnLogout').addEventListener('click', logout);
document.getElementById('btnAddLink').addEventListener('click', addLink);
document.getElementById('btnSaveTemplate').addEventListener('click', saveTemplate);
document.getElementById('btnCallApi').addEventListener('click', callApiDirect);
document.getElementById('btnClearApi').addEventListener('click', ()=>{ el('apiUrl').value=''; el('apiHeaders').value=''; el('apiBody').value=''; el('apiResult').textContent=''; });

document.addEventListener('click', (ev) => {
  if (ev.target.matches('.tab')) {
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    ev.target.classList.add('active');
    const tab = ev.target.dataset.tab;
    document.querySelectorAll('.tabContent').forEach(tc => tc.classList.add('hidden'));
    document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.remove('hidden');
  }
});

if (token) renderLoggedInState(); else renderLoggedOutState();