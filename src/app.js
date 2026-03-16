/**
 * TaskMatrix — Smart Priority Engine
 * app.js
 *
 * Algorithm: Multi-Criteria Decision-Making (MCDM)
 * Weighted Decision Matrix + Fuzzy S-curve normalization
 *
 * Priority Score Formula:
 *   score = w1*urgency_norm + w2*impact_norm + w3*ease_norm + w4*deadline_norm
 *   All criteria normalized to [0,1] via Hermite smooth-step before weighting.
 */

// ─── STATE ───────────────────────────────────────────────────────────────────
let tasks   = JSON.parse(localStorage.getItem('taskmatrix_tasks')   || '[]');
let weights = JSON.parse(localStorage.getItem('taskmatrix_weights') || 'null') || {
  urgency: 0.35, impact: 0.30, effort: 0.20, deadline: 0.15
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const taskNameEl       = document.getElementById('taskName');
const taskCategoryEl   = document.getElementById('taskCategory');
const taskDeadlineEl   = document.getElementById('taskDeadline');
const taskUrgencyEl    = document.getElementById('taskUrgency');
const taskImpactEl     = document.getElementById('taskImpact');
const taskDifficultyEl = document.getElementById('taskDifficulty');
const taskEffortEl     = document.getElementById('taskEffort');
const urgencyValEl     = document.getElementById('urgencyVal');
const impactValEl      = document.getElementById('impactVal');
const diffValEl        = document.getElementById('diffVal');
const effortValEl      = document.getElementById('effortVal');
const addTaskBtn       = document.getElementById('addTaskBtn');
const taskListEl       = document.getElementById('taskList');
const emptyStateEl     = document.getElementById('emptyState');
const toastEl          = document.getElementById('toast');
const clearAllBtn      = document.getElementById('clearAllBtn');
const exportBtn        = document.getElementById('exportBtn');
const filterCatEl      = document.getElementById('filterCategory');
const filterPriorityEl = document.getElementById('filterPriority');
const hideDoneEl       = document.getElementById('hideDone');

// Weight sliders
const wUrgency     = document.getElementById('wUrgency');
const wImpact      = document.getElementById('wImpact');
const wEffort      = document.getElementById('wEffort');
const wDeadline    = document.getElementById('wDeadline');
const wUrgencyVal  = document.getElementById('wUrgencyVal');
const wImpactVal   = document.getElementById('wImpactVal');
const wEffortVal   = document.getElementById('wEffortVal');
const wDeadlineVal = document.getElementById('wDeadlineVal');
const weightTotal  = document.getElementById('weightTotal');
const weightWarn   = document.getElementById('weightWarn');

// Stats
const statTotal    = document.getElementById('statTotal');
const statCritical = document.getElementById('statCritical');
const statDone     = document.getElementById('statDone');
const statAvgScore = document.getElementById('statAvgScore');

// Eisenhower
const q1Tasks = document.getElementById('q1Tasks');
const q2Tasks = document.getElementById('q2Tasks');
const q3Tasks = document.getElementById('q3Tasks');
const q4Tasks = document.getElementById('q4Tasks');

// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  const today = new Date().toISOString().split('T')[0];
  taskDeadlineEl.min   = today;
  taskDeadlineEl.value = today;

  // Restore weights
  wUrgency.value  = weights.urgency;
  wImpact.value   = weights.impact;
  wEffort.value   = weights.effort;
  wDeadline.value = weights.deadline;

  bindSliderDisplay(taskUrgencyEl,    urgencyValEl);
  bindSliderDisplay(taskImpactEl,     impactValEl);
  bindSliderDisplay(taskDifficultyEl, diffValEl);
  bindSliderDisplay(taskEffortEl,     effortValEl);

  bindWeightSlider(wUrgency,  wUrgencyVal,  'urgency');
  bindWeightSlider(wImpact,   wImpactVal,   'impact');
  bindWeightSlider(wEffort,   wEffortVal,   'effort');
  bindWeightSlider(wDeadline, wDeadlineVal, 'deadline');

  addTaskBtn.addEventListener('click', handleAddTask);
  taskNameEl.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddTask(); });
  clearAllBtn.addEventListener('click', handleClearAll);
  exportBtn.addEventListener('click', handleExport);

  filterCatEl.addEventListener('change', renderTasks);
  filterPriorityEl.addEventListener('change', renderTasks);
  hideDoneEl.addEventListener('change', renderTasks);

  renderTasks();
  updateStats();
})();

// ─── SLIDER HELPERS ───────────────────────────────────────────────────────────
function bindSliderDisplay(rangeEl, displayEl) {
  rangeEl.addEventListener('input', () => { displayEl.textContent = rangeEl.value; });
}

function bindWeightSlider(rangeEl, displayEl, key) {
  rangeEl.addEventListener('input', () => {
    weights[key] = parseFloat(rangeEl.value);
    displayEl.textContent = weights[key].toFixed(2);
    updateWeightSum();
    saveWeights();
    renderTasks();
  });
}

function updateWeightSum() {
  const sum = weights.urgency + weights.impact + weights.effort + weights.deadline;
  weightTotal.textContent = sum.toFixed(2);
  if (Math.abs(sum - 1.0) > 0.01) {
    weightWarn.classList.remove('hidden');
    weightTotal.style.color = 'var(--orange)';
  } else {
    weightWarn.classList.add('hidden');
    weightTotal.style.color = 'var(--gold)';
  }
}

// ─── MCDM SCORING ENGINE ──────────────────────────────────────────────────────
/**
 * Fuzzy S-curve (Hermite smooth-step) normalization
 * Maps x ∈ [min, max] → [0, 1] with smooth sigmoid-like curve
 * Formula: 3n² − 2n³  where n = linear_normalize(x)
 */
function fuzzyS(x, min = 1, max = 10) {
  const n = Math.max(0, Math.min(1, (x - min) / (max - min)));
  return 3 * n * n - 2 * n * n * n;
}

/**
 * Deadline urgency — maps days remaining to a [0,1] score
 * Closer deadline = higher score
 */
function deadlineScore(deadlineStr) {
  if (!deadlineStr) return 0.3;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((new Date(deadlineStr) - today) / 86400000);
  if (daysLeft <= 0)  return 1.00;
  if (daysLeft <= 1)  return 0.95;
  if (daysLeft <= 3)  return 0.85;
  if (daysLeft <= 7)  return 0.70;
  if (daysLeft <= 14) return 0.50;
  if (daysLeft <= 30) return 0.25;
  return 0.10;
}

/**
 * MCDM Weighted Decision Matrix
 * Returns priority score ∈ [0, 100]
 */
function calculateScore(task) {
  const urgencyNorm = fuzzyS(task.urgency,    1, 10);
  const impactNorm  = fuzzyS(task.impact,     1, 10);
  const easeNorm    = 1 - fuzzyS(task.difficulty, 1, 10); // Ease = inverse of difficulty
  const dlNorm      = deadlineScore(task.deadline);

  // Auto-normalize weights if they don't sum to 1
  const totalW = weights.urgency + weights.impact + weights.effort + weights.deadline;
  const wU = weights.urgency  / totalW;
  const wI = weights.impact   / totalW;
  const wE = weights.effort   / totalW;
  const wD = weights.deadline / totalW;

  const raw = wU * urgencyNorm + wI * impactNorm + wE * easeNorm + wD * dlNorm;
  return Math.round(raw * 1000) / 10; // 0.0 – 100.0
}

/** Classify score into priority tier */
function getPriorityTier(score) {
  if (score >= 72) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 28) return 'medium';
  return 'low';
}

/** Score bar fill color */
function scoreBarColor(score) {
  if (score >= 72) return 'linear-gradient(90deg, #d94f2a, #ff6b6b)';
  if (score >= 50) return 'linear-gradient(90deg, #f07832, #f5a623)';
  if (score >= 28) return 'linear-gradient(90deg, #d4901a, #ffb830)';
  return 'linear-gradient(90deg, #2a9d5c, #5cc88c)';
}

// ─── TASK CRUD ────────────────────────────────────────────────────────────────
function handleAddTask() {
  const name = taskNameEl.value.trim();
  if (!name) {
    showToast('⚠️ Please enter a task name!');
    taskNameEl.focus();
    return;
  }

  const task = {
    id:         Date.now(),
    name,
    category:   taskCategoryEl.value,
    deadline:   taskDeadlineEl.value,
    urgency:    parseInt(taskUrgencyEl.value),
    impact:     parseInt(taskImpactEl.value),
    difficulty: parseInt(taskDifficultyEl.value),
    effort:     parseInt(taskEffortEl.value),
    done:       false,
    createdAt:  new Date().toISOString()
  };

  tasks.push(task);
  saveTasks();
  renderTasks();
  updateStats();
  resetForm();
  showToast(`✅ "${name}" added to queue!`);
}

function toggleDone(id) {
  const t = tasks.find(t => t.id === id);
  if (t) {
    t.done = !t.done;
    saveTasks(); renderTasks(); updateStats();
    showToast(t.done ? '✔ Marked as done!' : '↩ Moved back to pending');
  }
}

function deleteTask(id) {
  const t = tasks.find(t => t.id === id);
  tasks = tasks.filter(t => t.id !== id);
  saveTasks(); renderTasks(); updateStats();
  showToast(t ? `🗑 "${t.name}" removed` : '🗑 Task removed');
}

function handleClearAll() {
  if (!tasks.length) return showToast('No tasks to clear.');
  if (!confirm('Clear all tasks? This cannot be undone.')) return;
  tasks = [];
  saveTasks(); renderTasks(); updateStats();
  showToast('🗑 All tasks cleared');
}

function handleExport() {
  const out = tasks.map(t => ({ ...t, score: calculateScore(t), priority: getPriorityTier(calculateScore(t)) }));
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })),
    download: `taskmatrix_${new Date().toISOString().slice(0,10)}.json`
  });
  a.click(); URL.revokeObjectURL(a.href);
  showToast('📤 Exported as JSON!');
}

// ─── RENDER ───────────────────────────────────────────────────────────────────
function renderTasks() {
  const catFilter  = filterCatEl.value;
  const priFilter  = filterPriorityEl.value;
  const hideDone   = hideDoneEl.checked;

  let visible = tasks
    .map(t => ({ ...t, score: calculateScore(t) }))
    .sort((a, b) => b.score - a.score);

  if (catFilter !== 'All') visible = visible.filter(t => t.category === catFilter);
  if (priFilter !== 'All') visible = visible.filter(t => getPriorityTier(t.score) === priFilter);
  if (hideDone)            visible = visible.filter(t => !t.done);

  taskListEl.querySelectorAll('.task-card').forEach(el => el.remove());

  if (!visible.length) {
    emptyStateEl.style.display = '';
    renderMatrix([]);
    return;
  }

  emptyStateEl.style.display = 'none';

  visible.forEach((task, idx) => {
    const priority   = getPriorityTier(task.score);
    const daysLeft   = getDaysLeft(task.deadline);
    const dlLabel    = formatDeadline(task.deadline, daysLeft);
    const rankClass  = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-other';

    const card = document.createElement('div');
    card.className = `task-card p-${priority} ${task.done ? 'done' : ''}`;
    card.dataset.id = task.id;
    card.style.animationDelay = `${idx * 45}ms`;

    card.innerHTML = `
      <div class="rank-badge ${rankClass}">${idx + 1}</div>
      <div class="task-body">
        <div class="task-name">${escHtml(task.name)}</div>
        <div class="task-meta">
          <span class="chip chip-cat">${task.category}</span>
          <span class="chip chip-deadline">📅 ${dlLabel}</span>
          <span class="chip chip-diff">⚡ Diff ${task.difficulty}/10</span>
          <span class="chip chip-effort">⏱ ${task.effort}h effort</span>
        </div>
        <div class="task-actions">
          <button class="btn-icon btn-done" onclick="toggleDone(${task.id})">
            ${task.done ? '↩ Undo' : '✔ Done'}
          </button>
          <button class="btn-icon btn-del" onclick="deleteTask(${task.id})">🗑 Delete</button>
        </div>
      </div>
      <div class="task-score">
        <div class="score-num">${task.score}</div>
        <div class="score-label">SCORE</div>
        <div class="score-bar-wrap">
          <div class="score-bar-fill" style="width:${task.score}%; background:${scoreBarColor(task.score)}"></div>
        </div>
        <div class="priority-pill pill-${priority}">${priority.toUpperCase()}</div>
      </div>
    `;

    taskListEl.appendChild(card);
  });

  renderMatrix(visible);
}

// ─── EISENHOWER MATRIX ────────────────────────────────────────────────────────
function renderMatrix(scoredTasks) {
  [q1Tasks, q2Tasks, q3Tasks, q4Tasks].forEach(q => q.innerHTML = '');

  scoredTasks.filter(t => !t.done).forEach(task => {
    const dot = document.createElement('div');
    dot.className = 'q-task-dot';
    dot.textContent = task.name.length > 18 ? task.name.slice(0, 16) + '…' : task.name;
    dot.title = task.name;

    const highU = task.urgency >= 6;
    const highI = task.impact  >= 6;

    if      ( highU &&  highI) q1Tasks.appendChild(dot);
    else if (!highU &&  highI) q2Tasks.appendChild(dot);
    else if ( highU && !highI) q3Tasks.appendChild(dot);
    else                       q4Tasks.appendChild(dot);
  });
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStats() {
  const scored   = tasks.map(t => ({ ...t, score: calculateScore(t) }));
  const total    = tasks.length;
  const done     = tasks.filter(t => t.done).length;
  const critical = scored.filter(t => getPriorityTier(t.score) === 'critical' && !t.done).length;
  const avg      = total ? Math.round(scored.reduce((s, t) => s + t.score, 0) / total) : null;

  animateNum(statTotal,    total);
  animateNum(statCritical, critical);
  animateNum(statDone,     done);
  statAvgScore.textContent = avg !== null ? avg : '—';
}

/** Animate number count-up */
function animateNum(el, target) {
  const start   = parseInt(el.textContent) || 0;
  const diff    = target - start;
  const steps   = 20;
  const step    = diff / steps;
  let current   = start;
  let count      = 0;
  const timer = setInterval(() => {
    count++;
    current += step;
    el.textContent = Math.round(current);
    if (count >= steps) { el.textContent = target; clearInterval(timer); }
  }, 16);
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function getDaysLeft(ds) {
  if (!ds) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((new Date(ds) - today) / 86400000);
}

function formatDeadline(ds, daysLeft) {
  if (!ds || daysLeft === null) return 'No deadline';
  if (daysLeft < 0)   return `Overdue ${Math.abs(daysLeft)}d`;
  if (daysLeft === 0) return '🚨 Due Today!';
  if (daysLeft === 1) return '⚡ Tomorrow';
  if (daysLeft <= 7)  return `${daysLeft}d left`;
  return new Date(ds).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function resetForm() {
  taskNameEl.value = '';
  taskUrgencyEl.value    = 5; urgencyValEl.textContent = 5;
  taskImpactEl.value     = 5; impactValEl.textContent  = 5;
  taskDifficultyEl.value = 5; diffValEl.textContent    = 5;
  taskEffortEl.value     = 3; effortValEl.textContent  = 3;
  taskNameEl.focus();
}

function saveTasks()   { localStorage.setItem('taskmatrix_tasks',   JSON.stringify(tasks)); }
function saveWeights() { localStorage.setItem('taskmatrix_weights', JSON.stringify(weights)); }

let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
}