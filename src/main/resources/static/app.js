// ==================== 通用弹窗 ====================
function closeModal(id) { $(id).classList.remove('show'); }

// 点击遮罩空白处关闭弹窗
document.querySelectorAll('.modal-mask').forEach(mask => {
  mask.addEventListener('click', e => { if (e.target === mask) mask.classList.remove('show'); });
});

// 通用单输入弹窗
let inputModalCallback = null;
function openInputModal(title, label, value, onConfirm) {
  $('imTitle').textContent = title;
  $('imLabel').textContent = label;
  $('imInput').value = value || '';
  inputModalCallback = onConfirm;
  $('inputModal').classList.add('show');
  setTimeout(() => $('imInput').focus(), 50);
}
function confirmInputModal() {
  const val = $('imInput').value.trim();
  if (inputModalCallback) inputModalCallback(val);
}

// ==================== 认证与权限 ====================
let currentUser = null;

const api = {
  async req(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('gd_token');
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const r = await fetch(url, { method, headers, body: body == null ? undefined : JSON.stringify(body) });
    if (r.status === 401) { showLogin(); throw new Error('未登录'); }
    if (!r.ok) {
      let msg = '请求失败 (' + r.status + ')';
      try { msg = (await r.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return r.json();
  },
  get(url) { return this.req('GET', url); },
  post(url, body) { return this.req('POST', url, body ?? {}); },
  put(url, body) { return this.req('PUT', url, body ?? {}); },
  del(url) { return this.req('DELETE', url); }
};

const $ = id => document.getElementById(id);
const esc = s => (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function showLogin() {
  $('loginMask').style.display = 'flex';
  $('mainGrid').style.display = 'none';
  localStorage.removeItem('gd_token');
}

async function doLogin() {
  $('loginErr').textContent = '';
  try {
    const r = await api.post('/api/auth/login', {
      username: $('loginUser').value.trim(),
      password: $('loginPass').value
    });
    localStorage.setItem('gd_token', r.token);
    await enterApp(r);
  } catch (e) {
    $('loginErr').textContent = e.message || '登录失败';
  }
}

async function doLogout() {
  try { await api.post('/api/auth/logout'); } catch (e) {}
  showLogin();
}

async function tryResume() {
  if (!localStorage.getItem('gd_token')) return showLogin();
  try {
    const me = await api.get('/api/auth/me');
    await enterApp(me);
  } catch (e) { /* 401 已触发 showLogin */ }
}

const LEVEL_NAMES = { 1: '一级权限', 2: '二级权限', 3: '三级权限' };

async function enterApp(user) {
  currentUser = user;
  $('loginMask').style.display = 'none';
  $('mainGrid').style.display = 'grid';
  $('userBadge').textContent = `👤 ${user.name} · ${LEVEL_NAMES[user.level] || user.level + '级'}`;
  // 权限渲染：level 数字越小权限越高；卡片 data-max-level 表示允许访问的最高级别数字
  document.querySelectorAll('[data-max-level]').forEach(el => {
    el.style.display = user.level <= +el.dataset.maxLevel ? '' : 'none';
  });
  refreshAll();
}

// ==================== 通用 ====================
function dueTag(t) {
  if (!t.dueDate) return '';
  const today = new Date().toISOString().slice(0, 10);
  if (t.status !== 'DONE' && t.dueDate < today) return `<span class="tag overdue">逾期 ${t.dueDate}</span>`;
  if (t.dueDate === today) return `<span class="tag today">今日截止</span>`;
  return `<span class="tag">${t.dueDate}</span>`;
}

function taskHtml(t, showCheck = true) {
  return `<div class="task-item ${t.status === 'DONE' ? 'done' : ''}">
    ${showCheck ? `<input type="checkbox" class="t-check" ${t.status === 'DONE' ? 'checked' : ''} onchange="toggleTask('${t.id}', this.checked)">` : ''}
    <div class="t-body">
      <div class="t-title"><span class="prio ${t.priority}">${t.priority}</span> ${esc(t.title)}</div>
      <div class="t-meta">
        ${dueTag(t)}
        ${t.category ? `<span class="tag cat">${esc(t.category)}</span>` : ''}
        ${t.repeatType === 'DAILY' ? '<span class="tag rep">每日必做</span>' : ''}
        ${t.repeatType === 'WEEKLY' ? '<span class="tag rep">每周必做</span>' : ''}
        ${t.needReport ? '<span class="tag">需汇报</span>' : ''}
        ${t.source ? `<span class="tag src">${esc(t.source)}</span>` : ''}
        ${t.note ? `<span>${esc(t.note)}</span>` : ''}
      </div>
    </div>
    <button class="btn-edit" onclick="openTaskForm('${t.id}')">✏</button>
    <button class="danger small" onclick="deleteTask('${t.id}')">删</button>
  </div>`;
}

// ==================== 1. 驾驶舱 ====================
async function loadDashboard() {
  try {
    const d = await api.get('/api/dashboard');
    $('nowTime').textContent = d.generatedAt;
    const s = d.stats;
    $('statCards').innerHTML = [
      ['今日截止', s.todayDue, 'c-warn'], ['逾期', s.overdue, 'c-danger'],
      ['高优先级', s.highPriority, 'c-accent'], ['需汇报', s.needReport, 'c-accent'],
      ['完成率', s.completionRate + '%', 'c-green'], ['待办', s.open, '']
    ].map(([lbl, num, cls]) => `<div class="stat-card ${cls}"><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`).join('');
    $('top3').innerHTML = d.top3.length
      ? d.top3.map(t => taskHtml(t)).join('')
      : '<div class="empty">暂无待办任务，先在下方「工作任务管理器」录入</div>';
    $('focusNow').innerHTML = '💡 ' + esc(d.focusNow);
  } catch (e) { console.error(e); }
}

// 驾驶舱右侧：能力评估入口（三级用户无此模块权限时提示）
async function loadCockpitAssessment() {
  const el = $('cockpitAssessment');
  if (currentUser.level > 2) {
    el.innerHTML = '<div class="empty">当前权限等级不包含能力评估模块</div>';
    return;
  }
  try {
    const s = await api.get('/api/assessment/status');
    if (s.available) {
      el.innerHTML = `<div style="font-size:13px;line-height:2">
        状态：<span class="badge">未评估</span><br>
        16 道情景选择题，约 5 分钟，结果将自动更新能力成长地图。<br>
        <button class="small" style="margin-top:6px" onclick="startAssessment()">开始评估</button>
      </div>`;
    } else if (s.status === 'COMPLETED' && s.result) {
      el.innerHTML = `<div style="font-size:13px;line-height:2">
        状态：<span class="badge on">已完成</span><br>
        综合得分 <b style="color:var(--accent);font-size:20px">${s.result.overallScore}</b> / 5
      </div>`;
    } else {
      el.innerHTML = '<div style="font-size:13px;line-height:2">状态：<span class="badge">已跳过</span><br>评估功能已关闭。</div>';
    }
  } catch (e) { console.error(e); }
}

// ==================== 2. 任务管理器 ====================
let currentView = 'today';
let taskCache = [];        // 当前视图缓存（用于编辑回填）
let lastViewTasks = null;  // 全量任务（备份用）

async function loadTasks(view, btn) {
  currentView = view || currentView;
  if (btn) {
    document.querySelectorAll('#taskTabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  try {
    const tasks = await api.get('/api/tasks?view=' + currentView);
    taskCache = tasks;
    $('taskCount').textContent = `共 ${tasks.length} 项`;
    $('taskList').innerHTML = tasks.length
      ? tasks.map(t => taskHtml(t)).join('')
      : '<div class="empty">该视图下暂无任务</div>';
  } catch (e) { console.error(e); }
}

async function toggleTask(id, done) {
  await api.post(`/api/tasks/${id}/${done ? 'complete' : 'reopen'}`);
  refreshAll();
}

async function deleteTask(id) {
  await api.del('/api/tasks/' + id);
  toast('已删除');
  refreshAll();
}

// ---------- 新增 / 编辑任务弹窗 ----------
function openTaskForm(id) {
  const t = id ? taskCache.find(x => x.id === id) : null;
  $('tfTitle').textContent = t ? '编辑任务' : '新增任务';
  $('tfId').value = t ? t.id : '';
  $('tfName').value = t ? t.title : '';
  $('tfCategory').value = t && t.category ? t.category : '';
  $('tfPriority').value = t ? t.priority : 'P2';
  $('tfSource').value = t && t.source ? t.source : '';
  $('tfDue').value = t && t.dueDate ? t.dueDate : '';
  $('tfNextStep').value = t && t.nextStep ? t.nextStep : '';
  $('tfOutcome').value = t && t.expectedOutcome ? t.expectedOutcome : '';
  $('tfBlocker').value = t && t.blocker ? t.blocker : '';
  $('tfNote').value = t && t.note ? t.note : '';
  $('tfNeedReport').checked = t ? t.needReport : false;
  $('tfDaily').checked = t ? t.repeatType === 'DAILY' : false;
  $('tfWeekly').checked = t ? t.repeatType === 'WEEKLY' : false;
  $('taskFormModal').classList.add('show');
  setTimeout(() => $('tfName').focus(), 50);
}

// 每日必做 / 每周必做互斥
function tfRepeatToggle(which) {
  if (which === 'daily' && $('tfDaily').checked) $('tfWeekly').checked = false;
  if (which === 'weekly' && $('tfWeekly').checked) $('tfDaily').checked = false;
}

async function saveTaskForm() {
  const title = $('tfName').value.trim();
  if (!title) return toast('请输入任务名称');
  const body = {
    title,
    priority: $('tfPriority').value,
    dueDate: $('tfDue').value || null,
    needReport: $('tfNeedReport').checked,
    capabilities: [],
    category: $('tfCategory').value || null,
    source: $('tfSource').value.trim() || null,
    nextStep: $('tfNextStep').value.trim() || null,
    expectedOutcome: $('tfOutcome').value.trim() || null,
    blocker: $('tfBlocker').value.trim() || null,
    note: $('tfNote').value.trim(),
    repeatType: $('tfDaily').checked ? 'DAILY' : ($('tfWeekly').checked ? 'WEEKLY' : 'NONE')
  };
  const id = $('tfId').value;
  if (id) {
    await api.put('/api/tasks/' + id, body);
    toast('任务已更新');
  } else {
    await api.post('/api/tasks', body);
    toast('任务已添加');
  }
  closeModal('taskFormModal');
  refreshAll();
}

// ---------- 清空与备份 ----------
async function clearAllTasks() {
  if (!confirm('确认清空你的全部任务？\n该操作不可恢复，建议先点「一键备份」。')) return;
  const r = await api.del('/api/tasks');
  toast(`已清空 ${r.deleted} 项任务`);
  refreshAll();
}

async function backupTasks() {
  try {
    const r = await fetch('/api/tasks/export', {
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('gd_token') }
    });
    if (!r.ok) throw new Error('备份失败');
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '任务备份-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('备份文件已下载');
  } catch (e) { toast(e.message); }
}

// ---------- 快速新增任务（AI 识别） ----------
let qaKind = 'doc';      // doc 文档/纪要 | official 收文/教育局文件
let qaDrafts = [];

function openQuickAdd() {
  $('qaResult').innerHTML = '';
  $('qaFileInfo').textContent = '';
  $('quickAddModal').classList.add('show');
}

function switchQaTab(kind) {
  qaKind = kind;
  $('qaTabDoc').classList.toggle('active', kind === 'doc');
  $('qaTabOfficial').classList.toggle('active', kind === 'official');
  $('qaDescDoc').style.display = kind === 'doc' ? '' : 'none';
  $('qaDescOfficial').style.display = kind === 'official' ? '' : 'none';
  $('qaText').placeholder = kind === 'official'
    ? '例如粘贴文件正文：\n关于开展 2026 年秋季开学工作检查的通知\n各校请于 9 月 10 日前将自查报告报送至基教科……'
    : '在此粘贴文本，或点击下方「选择文件」读取本地文件内容';
  $('qaResult').innerHTML = '';
}

async function uploadQaFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  $('qaFileInfo').textContent = '正在解析 ' + file.name + ' …';
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/ai/extract-text', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + localStorage.getItem('gd_token') },
      body: fd
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || '解析失败');
    if (!data.text) { $('qaFileInfo').textContent = '⚠ 文件中未提取到文本'; return; }
    $('qaText').value = data.text;
    $('qaFileInfo').textContent = `✔ 已解析 ${data.filename}（${data.chars} 字），可在上方校对后再识别`;
  } catch (e) {
    $('qaFileInfo').textContent = '⚠ ' + e.message;
  } finally {
    input.value = '';
  }
}

async function qaAnalyze(mode) {
  const text = $('qaText').value.trim();
  if (!text) return toast('请先粘贴文本或选择文件');
  $('qaResult').innerHTML = '<div class="loading">' +
    (mode === 'ai' ? 'AI 正在智能分析整理' : '本地规则引擎正在快速识别') + '</div>';
  try {
    qaDrafts = await api.post('/api/ai/doc-to-tasks', { text, kind: qaKind, mode });
    if (!qaDrafts.length) { $('qaResult').innerHTML = '<div class="empty">未识别到任务，请补充更明确的描述</div>'; return; }
    $('qaResult').innerHTML = qaDrafts.map(d => `
      <div class="draft-task">
        <span class="prio ${d.priority}">${d.priority}</span>
        <span style="flex:1">${esc(d.title)}</span>
        ${d.dueDate ? `<span class="tag">${d.dueDate}</span>` : ''}
        ${d.needReport ? '<span class="tag">需汇报</span>' : ''}
      </div>`).join('') +
      `<button class="btn-black" style="width:100%;margin-top:10px" onclick="importQaTasks()">✔ 一键导入 ${qaDrafts.length} 项任务</button>`;
  } catch (e) {
    $('qaResult').innerHTML = '<div class="empty">识别失败，请稍后再试</div>';
  }
}

async function importQaTasks() {
  const text = $('qaText').value.trim();
  const r = await api.post('/api/ai/doc-to-tasks/import', { text, kind: qaKind, mode: 'ai' });
  toast(`已导入 ${r.imported} 项任务`);
  closeModal('quickAddModal');
  $('qaText').value = ''; $('qaResult').innerHTML = ''; $('qaFileInfo').textContent = '';
  refreshAll();
}

// ==================== 3. 提醒中心 ====================
async function loadReminders() {
  try {
    const d = await api.get('/api/reminders');
    $('remPhase').textContent = d.phase;
    const groups = [
      ['⏰ 今日截止', d.reminders.todayDue], ['🔥 已逾期', d.reminders.overdue],
      ['⭐ 高优先级', d.reminders.highPriority], ['📣 需汇报', d.reminders.needReport],
      ['🔁 周期事项', d.reminders.recurring]
    ];
    const remItem = t => `<div class="rem-item">
      <span class="prio ${t.priority}">${t.priority}</span> ${esc(t.title)}
      ${t.repeatType === 'DAILY' ? '<span class="tag rep">每日</span>' : ''}
      ${t.repeatType === 'WEEKLY' ? '<span class="tag rep">每周</span>' : ''}
      ${dueTag(t)}</div>`;
    $('reminders').innerHTML = groups.map(([name, list]) => `
      <div class="rem-group">
        <h4>${name} <span class="count">${list.length} 项</span></h4>
        ${list.length ? list.map(remItem).join('') : '<div class="rem-item" style="color:var(--muted)">无</div>'}
      </div>`).join('') +
      `<div class="section-title">💬 跟进话术</div>` +
      d.scripts.map(s => `<div class="script-item"><b>${esc(s.scene)}</b>${esc(s.text)}</div>`).join('') +
      `<div class="focus-tip" style="margin-top:10px">💡 ${esc(d.focusNow)}</div>`;
  } catch (e) { console.error(e); }
}

// ==================== 4. 能力成长地图 ====================
let radarChart = null;

async function loadCapabilities() {
  if (currentUser.level > 2) return;
  try {
    const d = await api.get('/api/capabilities');
    const dims = d.dimensions;
    const el = $('radar');
    if (!radarChart) radarChart = echarts.init(el, 'dark');
    radarChart.setOption({
      backgroundColor: 'transparent',
      tooltip: {},
      radar: {
        indicator: dims.map(x => ({ name: x.name, max: 5 })),
        radius: '68%', splitNumber: 5,
        axisName: { color: '#8b96b0', fontSize: 11 }
      },
      series: [{
        type: 'radar',
        data: [
          { value: dims.map(x => x.score), name: '当前评分',
            areaStyle: { color: 'rgba(91,140,255,.3)' }, lineStyle: { color: '#5b8cff' }, itemStyle: { color: '#5b8cff' } },
          { value: dims.map(x => x.target), name: '目标',
            areaStyle: { color: 'rgba(55,208,167,.12)' }, lineStyle: { color: '#37d0a7', type: 'dashed' }, itemStyle: { color: '#37d0a7' } }
        ]
      }]
    });
    setTimeout(() => radarChart.resize(), 50);

    $('dimList').innerHTML = dims.map(x => `
      <div class="dim-card">
        <div class="dim-head">
          <span class="dim-name">${esc(x.name)}</span>
          <span class="dim-score ${x.score < x.target ? 'low' : ''}">${x.score}</span>
          <span style="font-size:11px;color:var(--muted)">/ 目标</span>
          <select onchange="setTarget('${esc(x.name)}', this.value)">
            ${[1,2,3,4,5].map(v => `<option ${v === x.target ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="dim-body">${esc(x.reasoning)}<br><span style="color:var(--accent)">依据：${esc(x.evidence)}</span></div>
      </div>`).join('');
  } catch (e) { console.error(e); }
}

async function setTarget(name, target) {
  await api.put('/api/capabilities/' + encodeURIComponent(name) + '/target', { target: +target });
  toast('目标分已更新');
  loadCapabilities();
}

async function analyzeCapabilities() {
  toast('AI 评估中…');
  try {
    const d = await api.post('/api/capabilities/analyze');
    toast('评估完成（' + d.aiProvider + '）');
    loadCapabilities();
  } catch (e) { toast(e.message); }
}

// ==================== 5. 每日精选 ====================
async function loadContent() {
  if (currentUser.level > 2) return;
  try {
    const c = await api.get('/api/content/daily');
    if (!c) { $('dailyContent').innerHTML = '<div class="empty">暂无内容</div>'; return; }
    $('contentDate').textContent = c.date;
    const itemHtml = (x, icon) => `
      <div class="content-item">
        <a href="${esc(x.url)}" target="_blank">${icon} ${esc(x.title)}</a><span class="src">${esc(x.source)}</span>
        <ul>${x.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
        <div class="act">🎯 行动建议：${esc(x.action)}</div>
      </div>`;
    $('dailyContent').innerHTML =
      `<div class="section-title">匹配短板：${(c.matchedDimensions || []).map(esc).join('、')}</div>` +
      c.articles.map(x => itemHtml(x, '📄')).join('') +
      c.videos.map(x => itemHtml(x, '🎬')).join('') +
      `<div class="focus-tip" style="margin-top:10px">${esc(c.notice)}</div>`;
  } catch (e) { console.error(e); }
}

async function refreshContent() {
  toast('AI 正在挑选今日内容…');
  try {
    await api.post('/api/content/daily/refresh');
    loadContent();
  } catch (e) { toast(e.message); }
}

// ==================== 6. 能力评估 ====================
let assessPaper = [];       // 当前试卷
let assessAnswers = {};     // qid -> optionIndex
let assessIndex = 0;

async function loadAssessment() {
  if (currentUser.level > 2) return;
  try {
    const s = await api.get('/api/assessment/status');
    const body = $('assessmentBody');
    if (s.available) {
      $('assessBadge').textContent = '未评估';
      body.innerHTML = `
        <div class="assess-intro">
          本评估基于看板的 <b>8 个能力维度</b>（结构化表达、情绪中立沟通、主动预判、主动解决问题、跨部门协作、团队管理与任务分配、风险意识、人才识别与培养），
          共 <b>16 道情景选择题</b>，约需 5 分钟。完成后评估结果将<b>自动更新能力成长地图</b>的当前评分。<br>
          ⚠️ 可选择跳过，但<b>跳过后本功能将不可再使用</b>。
        </div>
        <div class="assess-actions">
          <button onclick="startAssessment()">🚀 开始评估</button>
          <button class="ghost" onclick="skipAssessment()">跳过（不可恢复）</button>
        </div>`;
    } else if (s.status === 'SKIPPED') {
      $('assessBadge').textContent = '已跳过';
      body.innerHTML = '<div class="empty">您已跳过能力评估，本功能不再可用。</div>';
    } else if (s.status === 'COMPLETED' && s.result) {
      $('assessBadge').textContent = '已完成';
      renderAssessResult(s.result);
    }
  } catch (e) { console.error(e); }
}

async function startAssessment() {
  $('assessmentBody').innerHTML = '<div class="loading">AI 正在生成评估题目</div>';
  try {
    assessPaper = await api.get('/api/assessment/questions');
    assessAnswers = {};
    assessIndex = 0;
    renderQuestion();
    $('assessmentCard').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    toast(e.message);
    loadAssessment();
  }
}

function renderQuestion() {
  const q = assessPaper[assessIndex];
  const total = assessPaper.length;
  const sel = assessAnswers[q.id];
  $('assessmentBody').innerHTML = `
    <div class="q-progress">第 ${assessIndex + 1} / ${total} 题
      <div class="bar"><i style="width:${Math.round((assessIndex) / total * 100)}%"></i></div>
    </div>
    <div class="q-dim">评估维度：${esc(q.dimension)}</div>
    <div class="q-scenario">${esc(q.scenario)}</div>
    ${q.options.map((o, i) => `
      <div class="q-option ${sel === i ? 'sel' : ''}" onclick="chooseOption(${i})">
        <span class="opt-label">${esc(o.label)}</span><span>${esc(o.text)}</span>
      </div>`).join('')}
    <div class="q-nav">
      <button class="ghost" ${assessIndex === 0 ? 'disabled' : ''} onclick="assessIndex--;renderQuestion()">← 上一题</button>
      <span class="spacer"></span>
      ${assessIndex < total - 1
        ? `<button ${sel == null ? 'disabled' : ''} onclick="assessIndex++;renderQuestion()">下一题 →</button>`
        : `<button ${sel == null ? 'disabled' : ''} onclick="submitAssessment()">✔ 提交评估</button>`}
    </div>`;
}

function chooseOption(i) {
  assessAnswers[assessPaper[assessIndex].id] = i;
  renderQuestion();
}

async function submitAssessment() {
  $('assessmentBody').innerHTML = '<div class="loading">正在评分并更新能力成长地图</div>';
  try {
    const result = await api.post('/api/assessment/submit', { answers: assessAnswers });
    $('assessBadge').textContent = '已完成';
    renderAssessResult(result);
    loadCapabilities();
    loadCockpitAssessment();
    toast('评估完成');
  } catch (e) {
    toast(e.message);
    loadAssessment();
  }
}

async function skipAssessment() {
  if (!confirm('跳过后能力评估功能将不可再使用，确认跳过？')) return;
  try {
    await api.post('/api/assessment/skip');
    toast('已跳过，评估功能已关闭');
    loadAssessment();
    loadCockpitAssessment();
  } catch (e) { toast(e.message); }
}

function renderAssessResult(r) {
  $('assessmentBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px">
      <div><span class="assess-overall">${r.overallScore}</span><span style="color:var(--muted)"> / 5 综合得分</span></div>
      <div style="color:var(--muted);font-size:12px">共作答 ${r.questionCount} 题 · ${esc((r.completedAt || '').toString().replace('T', ' ').slice(0, 16))}</div>
    </div>
    <div class="assess-result-grid">
      ${Object.entries(r.dimensionScores).map(([dim, score]) => `
        <div class="assess-dim">
          <div class="ad-head"><span>${esc(dim)}</span><span class="ad-score">${score}</span></div>
          <div class="ad-bar"><i style="width:${score / 5 * 100}%"></i></div>
        </div>`).join('')}
    </div>
    <div class="assess-comment">🧭 ${esc(r.comment)}</div>`;
}

// ==================== 7. 日复盘与人才筛选（仅一级） ====================
async function loadReview() {
  if (currentUser.level > 1) return;
  try {
    const r = await api.get('/api/review/daily');
    if (r) renderReview(r);
  } catch (e) { /* 首次为空 */ }
}

function renderReview(r) {
  const list = (arr, icon) => (arr || []).map(x => `<li>${icon} ${esc(x)}</li>`).join('');
  $('reviewOutput').innerHTML = `
    <h4>📊 ${esc(r.date)} 数据</h4>
    <p style="font-size:12px;color:var(--muted)">${Object.entries(r.metrics || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
    <h4>🔥 逾期分析</h4><p>${esc(r.overdueAnalysis)}</p>
    <h4>📣 汇报质量</h4><p>${esc(r.reportQuality)}</p>
    <h4>🤝 协作问题</h4><p>${esc(r.collabIssues)}</p>
    <h4>✨ 亮点</h4><ul>${list(r.highlights, '·')}</ul>
    <h4>🔧 改进点</h4><ul>${list(r.improvements, '·')}</ul>
    <h4>🎯 明日目标</h4><ul>${list(r.tomorrowGoals, '·')}</ul>
    <h4>🧭 建议聚焦能力</h4><p><span class="badge on">${esc(r.focusCapability)}</span></p>`;
}

async function generateReview() {
  $('reviewOutput').innerHTML = '<div class="loading">AI 正在生成今日复盘</div>';
  try {
    const r = await api.post('/api/review/daily/generate');
    renderReview(r);
    toast('复盘已生成');
  } catch (e) {
    $('reviewOutput').innerHTML = '<div class="empty">生成失败，请稍后再试</div>';
  }
}

const CELL_NAMES = { '3,3': '明星', '3,2': '骨干', '3,1': '绩效好·潜力待挖', '2,3': '高潜待验证', '2,2': '中坚', '2,1': '稳定贡献', '1,3': '潜力股·绩效待提升', '1,2': '待辅导', '1,1': '重点关注' };

async function loadTalent() {
  if (currentUser.level > 1) return;
  try {
    const b = await api.get('/api/talent');
    talentPeople = b.people || [];
    talentRosters = b.rosters || {};
    const members = [];

    // 花名册：卡片内只显示紧凑摘要行，点击进入独立管理界面
    $('rosters').innerHTML = Object.entries(talentRosters).map(([key, list]) => {
      list.forEach(m => members.push({ ...m, roster: key }));
      const preview = list.slice(0, 4).map(m => m.name).join('、') + (list.length > 4 ? ' …' : '');
      return `<div class="roster-row" onclick="manageRoster('${esc(key)}')">
        <span class="r-name">📋 ${esc(key)}</span>
        <span class="r-count">${list.length} 人</span>
        <span class="r-preview">${esc(preview)}</span>
        <span class="r-go">管理 →</span>
      </div>`;
    }).join('') || '<div class="empty">暂无名册，点击上方「新建名册」创建</div>';
    $('personSelect').innerHTML = members.length
      ? members.map(m => `<option value="${esc(m.name)}|${m.roster}">${esc(m.name)}（${m.roster}）</option>`).join('')
      : '<option value="">请先在花名册中添加成员</option>';

    // 九宫格：点击人名打开编辑弹窗
    let html = '';
    for (let pot = 3; pot >= 1; pot--) {
      for (let perf = 1; perf <= 3; perf++) {
        const people = talentPeople.filter(p => p.performance === perf && p.potential === pot);
        html += `<div class="nine-cell">
          <div class="cell-name">${CELL_NAMES[perf + ',' + pot]}</div>
          ${people.map(p => `<span class="person" title="点击编辑 · ${esc(p.observation || '')}" onclick="openPersonModal('${p.id}')">${esc(p.name)}</span>`).join('')}
        </div>`;
      }
    }
    $('nineGrid').innerHTML = html;
  } catch (e) { console.error(e); }
}

// ---------- 花名册独立管理界面 ----------
let talentRosters = {};
let currentRoster = null;

function manageRoster(roster) {
  currentRoster = roster;
  renderRosterModal();
  $('rosterModal').classList.add('show');
}

function renderRosterModal() {
  const list = talentRosters[currentRoster] || [];
  $('rmTitle').textContent = currentRoster;
  $('rmCount').textContent = list.length + ' 人';
  $('rmMembers').innerHTML = list.length ? list.map(m => `
    <div class="rm-member">
      <span>${esc(m.name)}</span><span class="rm-role">${esc(m.role)}</span>
      <span class="rm-ops">
        <button class="ghost small" onclick="openMemberModal('${esc(m.name)}','${esc(m.role)}')">✏ 编辑</button>
        <button class="danger small" onclick="deleteMember('${esc(m.name)}')">删除</button>
      </span>
    </div>`).join('') : '<div class="empty">名册为空，请在下方添加成员</div>';
}

async function addMemberFromModal() {
  const name = $('rmName').value.trim();
  if (!name) return toast('请输入姓名');
  try {
    await api.post(`/api/talent/rosters/${encodeURIComponent(currentRoster)}/members`,
      { name, role: $('rmRole').value.trim() });
    $('rmName').value = ''; $('rmRole').value = '';
    toast('成员已添加');
    await refreshTalentKeepModal();
  } catch (e) { toast(e.message); }
}

// ---------- 成员编辑弹窗 ----------
let editingMemberName = null;

function openMemberModal(name, role) {
  editingMemberName = name;
  $('mmName').value = name;
  $('mmRole').value = role;
  $('memberModal').classList.add('show');
}

async function saveMember() {
  const newName = $('mmName').value.trim();
  if (!newName) return toast('姓名不能为空');
  try {
    await api.put(`/api/talent/rosters/${encodeURIComponent(currentRoster)}/members/${encodeURIComponent(editingMemberName)}`,
      { name: newName, role: $('mmRole').value.trim() });
    closeModal('memberModal');
    toast('成员已更新');
    await refreshTalentKeepModal();
  } catch (e) { toast(e.message); }
}

async function deleteMember(name) {
  if (!confirm(`确认从 ${currentRoster} 删除「${name}」？\n其九宫格观察记录将一并删除。`)) return;
  try {
    await api.del(`/api/talent/rosters/${encodeURIComponent(currentRoster)}/members/${encodeURIComponent(name)}`);
    toast('成员已删除');
    await refreshTalentKeepModal();
  } catch (e) { toast(e.message); }
}

async function deleteRosterFromModal() {
  const roster = currentRoster;
  if (!confirm(`确认删除名册「${roster}」？\n组内成员及其九宫格观察记录将一并删除。`)) return;
  try {
    const r = await api.del(`/api/talent/rosters/${encodeURIComponent(roster)}`);
    $('rosterModal').classList.remove('show');
    toast(`已删除名册（含 ${r.removedMembers} 名成员、${r.removedNotes} 条记录）`);
    loadTalent();
  } catch (e) { toast(e.message); }
}

/** 操作后刷新数据并保持在名册管理界面 */
async function refreshTalentKeepModal() {
  await loadTalent();
  if ($('rosterModal').classList.contains('show') && currentRoster in talentRosters) {
    renderRosterModal();
  }
}

// ---------- 花名册分组增删 ----------
function addRoster() {
  openInputModal('＋ 新建名册', '名册名称（如：实习生，最长 20 字）', '', async (name) => {
    if (!name) return;
    try {
      await api.post('/api/talent/rosters', { name });
      closeModal('inputModal');
      toast('名册已创建');
      loadTalent();
    } catch (e) { toast(e.message); }
  });
}

// ---------- 观察记录增改删 ----------
let talentPeople = [];

async function addPerson() {
  const val = $('personSelect').value;
  if (!val) return toast('请先在花名册添加成员');
  const [name, roster] = val.split('|');
  await api.post('/api/talent/people', {
    name, roster,
    performance: +$('personPerf').value,
    potential: +$('personPot').value,
    observation: $('personObs').value
  });
  $('personObs').value = '';
  toast('已记录');
  loadTalent();
}

function openPersonModal(id) {
  const p = talentPeople.find(x => x.id === id);
  if (!p) return;
  $('pmId').value = p.id;
  $('pmName').value = `${p.name}（${p.roster}）`;
  $('pmPerf').value = p.performance;
  $('pmPot').value = p.potential;
  $('pmObs').value = p.observation || '';
  $('personModal').classList.add('show');
}

async function savePersonNote() {
  const p = talentPeople.find(x => x.id === $('pmId').value);
  if (!p) return;
  await api.put('/api/talent/people/' + p.id, {
    name: p.name, roster: p.roster,
    performance: +$('pmPerf').value,
    potential: +$('pmPot').value,
    observation: $('pmObs').value
  });
  $('personModal').classList.remove('show');
  toast('记录已更新');
  loadTalent();
}

async function deletePersonNote() {
  if (!confirm('确认删除这条观察记录？')) return;
  await api.del('/api/talent/people/' + $('pmId').value);
  $('personModal').classList.remove('show');
  toast('已移除');
  loadTalent();
}

// ==================== 8. 账号管理（仅一级） ====================
const ASSESS_STATUS_NAMES = { NONE: '未评估', COMPLETED: '已完成', SKIPPED: '已跳过' };

async function loadUsers() {
  if (currentUser.level > 1) return;
  try {
    const users = await api.get('/api/admin/users');
    $('userTable').innerHTML = `<table class="user-table">
      <tr><th>用户名</th><th>姓名</th><th>权限等级</th><th>评估状态</th><th>操作</th></tr>
      ${users.map(u => `<tr>
        <td>${esc(u.username)}</td>
        <td>${esc(u.name)}</td>
        <td><span class="badge">${LEVEL_NAMES[u.level] || u.level}</span></td>
        <td><span class="assess-status ${u.assessmentStatus}">${ASSESS_STATUS_NAMES[u.assessmentStatus] || u.assessmentStatus}</span></td>
        <td><div class="actions">
          <button class="ghost small" onclick="resetPassword('${esc(u.username)}')">🔑 重置密码</button>
          ${u.assessmentStatus !== 'NONE' ? `<button class="ghost small" onclick="resetAssessment('${esc(u.username)}')">♻ 恢复评估资格</button>` : ''}
          ${u.username !== currentUser.username ? `<button class="danger small" onclick="deleteUser('${esc(u.username)}')">删除</button>` : ''}
        </div></td>
      </tr>`).join('')}
    </table>`;
  } catch (e) { console.error(e); }
}

async function addUser() {
  const username = $('nuName').value.trim(), name = $('nuDisplay').value.trim(),
        level = +$('nuLevel').value, password = $('nuPass').value;
  if (!username || !password) return toast('请填写用户名和密码');
  try {
    await api.post('/api/admin/users', { username, name, level, password });
    $('nuName').value = ''; $('nuDisplay').value = ''; $('nuPass').value = '';
    toast('用户已添加');
    loadUsers();
  } catch (e) { toast(e.message); }
}

function resetPassword(username) {
  openInputModal(`🔑 重置密码：${username}`, '新密码（至少 6 位，重置后该用户需重新登录）', '', async (pwd) => {
    if (!pwd) return;
    try {
      await api.post(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, { password: pwd });
      closeModal('inputModal');
      toast('密码已重置，该用户需重新登录');
    } catch (e) { toast(e.message); }
  });
}

async function resetAssessment(username) {
  if (!confirm(`恢复「${username}」的能力评估资格？\n其历史评估结果将被清除，可重新评估。`)) return;
  try {
    await api.post(`/api/admin/users/${encodeURIComponent(username)}/reset-assessment`);
    toast('评估资格已恢复');
    loadUsers();
  } catch (e) { toast(e.message); }
}

async function deleteUser(username) {
  if (!confirm(`确认删除用户「${username}」？该操作不可恢复。`)) return;
  try {
    await api.del(`/api/admin/users/${encodeURIComponent(username)}`);
    toast('用户已删除');
    loadUsers();
  } catch (e) { toast(e.message); }
}

// ==================== AI 状态 & 启动 ====================
async function loadAiStatus() {
  try {
    const s = await api.get('/api/ai/status');
    const badge = $('aiBadge');
    badge.textContent = s.remoteConfigured ? '🤖 AI：' + s.provider : '🤖 AI：本地规则引擎';
    badge.classList.toggle('on', s.remoteConfigured);
    badge.title = s.hint;
  } catch (e) { /* ignore */ }
}

function refreshAll() {
  loadDashboard(); loadCockpitAssessment(); loadTasks(); loadReminders();
  loadCapabilities(); loadContent(); loadAssessment(); loadReview(); loadTalent(); loadUsers();
}

tryResume();
setInterval(() => { if (currentUser) { loadDashboard(); loadReminders(); } }, 60000);
window.addEventListener('resize', () => radarChart && radarChart.resize());
