// Static dashboard: reads data/history.json written by scripts/0-ov-ci-dashboard/record_result.py.
const REPO = 'ravi9/llamacpp-ov-ci-dashboard';
const UPSTREAM = 'ggml-org/llama.cpp';

// Workflow display names must match upstream exactly (they are the workflow_run trigger keys).
const WORKFLOWS = [
  { name: 'CI (openvino)', short: 'CI (openvino)', file: 'build-openvino.yml', hint: 'GitHub-hosted Ubuntu + Windows' },
  { name: 'CI (self-hosted OpenVINO backend)', short: 'CI (self-hosted)', file: 'ci-self-hosted-openvino.yml', hint: 'Self-hosted Intel runner' },
];

const HISTORY_DAYS = 45; // days shown in the job history grid
const RATE_DAYS = 30;    // window for the pass-rate headline

// Conclusion -> display kind. Unknown conclusions fall back to 'fail' so nothing broken looks green.
const KIND_OF = {
  success: 'pass',
  failure: 'fail', timed_out: 'fail', startup_failure: 'fail', action_required: 'fail',
  cancelled: 'cancel',
  skipped: 'skip', neutral: 'skip',
};
const KINDS = {
  pass:   { label: 'pass',      dot: 'bg-emerald-500', cell: 'bg-emerald-500 hover:bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400',
            badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30' },
  fail:   { label: 'fail',      dot: 'bg-red-500',     cell: 'bg-red-500 hover:bg-red-400',         text: 'text-red-600 dark:text-red-400',
            badge: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30' },
  cancel: { label: 'cancelled', dot: 'bg-amber-500',   cell: 'bg-amber-500 hover:bg-amber-400',     text: 'text-amber-600 dark:text-amber-400',
            badge: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30' },
  skip:   { label: 'skipped',   dot: 'bg-slate-400',   cell: 'bg-slate-400 hover:bg-slate-300',     text: 'text-slate-500 dark:text-slate-400',
            badge: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/30' },
  none:   { label: 'no data',   dot: 'bg-slate-300 dark:bg-slate-600', cell: 'bg-slate-200 dark:bg-slate-700', text: 'text-slate-400',
            badge: 'bg-slate-100 text-slate-500 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600/40' },
};
const kindOf = (conclusion) => (conclusion == null ? 'none' : KIND_OF[conclusion] || 'fail');

// Combined result of many conclusions: any fail wins, then cancelled, then pass. Missing jobs are ignored.
const WORST = ['fail', 'cancel', 'pass', 'skip'];
const CONCLUSION_OF = { pass: 'success', fail: 'failure', cancel: 'cancelled', skip: 'skipped' };
function combined(conclusions) {
  const kinds = conclusions.map(kindOf).filter((k) => k !== 'none');
  const k = WORST.find((w) => kinds.includes(w));
  return k ? CONCLUSION_OF[k] : null;
}

const LINK = 'text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline';
const CARD = 'rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700';

// Lucide-style inline SVG icons, currentColor stroke.
const ICON_PATHS = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
};
const icon = (name, cls = 'w-5 h-5') => `<svg class="${cls} inline-block shrink-0 -mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

const $ = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// history is sorted newest first; latest is the newest record per workflow.
let state = { history: [], latest: {} };

async function loadJSON(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (e) {
    return fallback;
  }
}

function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '-';
  const opts = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' };
  if (withTime) Object.assign(opts, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  return d.toLocaleString('en-US', opts);
}

// Prefer the upstream commit under test; fall back to this repo's commit for older records.
function commitLink(rec) {
  const [repo, sha] = rec.upstream_sha ? [UPSTREAM, rec.upstream_sha] : [REPO, rec.sha];
  if (!sha) return '-';
  return `<a class="${LINK} font-mono" target="_blank" rel="noopener" title="${repo}@${esc(sha)}" href="https://github.com/${repo}/commit/${esc(sha)}">${esc(sha.slice(0, 7))}</a>`;
}

function badge(conclusion, text) {
  const k = KINDS[kindOf(conclusion)];
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${k.badge}">
    <span class="w-1.5 h-1.5 rounded-full ${k.dot}"></span>${esc(text || k.label)}</span>`;
}

// Per-job badge; links to the job log when the API gave a URL.
function jobBadge(job) {
  const b = badge(job.conclusion, job.name);
  const title = `${job.name}: ${job.conclusion || job.status || 'unknown'}`;
  return job.html_url
    ? `<a class="hover:opacity-80" target="_blank" rel="noopener" title="${esc(title)}" href="${esc(job.html_url)}">${b}</a>`
    : `<span title="${esc(title)}">${b}</span>`;
}

// Newest-first history for one workflow.
const runsOf = (workflow) => state.history.filter((r) => r.job === workflow);

// Job names for a workflow, ordered as in its latest run, then any older names.
function jobNamesOf(workflow) {
  const names = [];
  for (const rec of runsOf(workflow)) {
    for (const j of rec.jobs || []) if (!names.includes(j.name)) names.push(j.name);
  }
  return names;
}

// Every job seen across all workflows, in workflow order.
function allJobs() {
  const jobs = [];
  for (const w of WORKFLOWS) for (const name of jobNamesOf(w.name)) jobs.push({ workflow: w.name, name });
  return jobs;
}

// One combined run per tested commit: the daily sync dispatches both workflows on the same commit.
// If a workflow ran more than once on a commit, its newest run is used. Newest batch first.
function batches() {
  const groups = new Map();
  for (const r of state.history) {
    const key = r.sha || `run-${r.run_id}`;
    if (!groups.has(key)) groups.set(key, { key, runs: {}, timestamp: r.timestamp, rec: r });
    const g = groups.get(key);
    if (!g.runs[r.job]) g.runs[r.job] = r;
  }
  const jobs = allJobs();
  return [...groups.values()].map((g) => {
    const cells = jobs.map((j) => {
      const r = g.runs[j.workflow];
      const found = r && (r.jobs || []).find((x) => x.name === j.name);
      return { ...j, job: found || null };
    });
    return { ...g, cells, conclusion: combined(cells.map((c) => (c.job ? c.job.conclusion : null))) };
  });
}

function section(iconName, title, hint, id) {
  return $(`<div class="mb-3 mt-10 scroll-mt-6" id="${id}">
    <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100">${icon(iconName)} <span class="align-middle">${title}</span></h2>
    ${hint ? `<p class="text-sm text-slate-500 dark:text-slate-400">${hint}</p>` : ''}
  </div>`);
}

function themeToggle() {
  const btn = $(`<button type="button" class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-400"></button>`);
  const paint = () => {
    const dark = document.documentElement.classList.contains('dark');
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.innerHTML = dark ? `${icon('sun', 'w-4 h-4')} <span>Light</span>` : `${icon('moon', 'w-4 h-4')} <span>Dark</span>`;
  };
  btn.onclick = () => {
    const dark = document.documentElement.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) {}
    paint();
  };
  paint();
  return btn;
}

function freshnessBanner(newest) {
  const last = newest && newest.timestamp;
  const when = last ? fmtDate(last) : 'no runs recorded yet';
  return $(`<div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 px-4 py-2 text-sm">
    <span class="inline-block w-2 h-2 rounded-full ${last ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
    Last run recorded: <span class="font-semibold text-slate-800 dark:text-slate-100">${when}</span>
    <span class="text-slate-400">- Updated daily</span>
  </div>`);
}

function introAndNav() {
  const frag = document.createDocumentFragment();
  const wfLink = (f) => `<a class="${LINK}" target="_blank" rel="noopener" href="https://github.com/${UPSTREAM}/blob/master/.github/workflows/${f}">${f}</a>`;
  frag.append($(`<p class="text-slate-500 dark:text-slate-300 mb-1">
    Fetches the latest <a class="${LINK}" target="_blank" rel="noopener" href="https://github.com/${UPSTREAM}/tree/master">${UPSTREAM} master</a> daily
    and runs OpenVINO CI workflows (${wfLink('build-openvino.yml')}, ${wfLink('ci-self-hosted-openvino.yml')}). OpenVINO CI results are tracked here over time.
  </p>`));
  frag.append($(`<p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Tip: Hard-refresh (Ctrl/Cmd+Shift+R) if data looks stale.</p>`));
  const sep = '<span class="text-slate-300 dark:text-slate-600" aria-hidden="true">|</span>';
  const link = 'inline-flex items-center gap-1.5 font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:underline';
  frag.append($(`<nav aria-label="Sections" class="mb-6 flex flex-wrap justify-center items-center gap-x-2 gap-y-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-2 text-sm w-full">
    <a class="${link}" href="#latest">${icon('activity', 'w-4 h-4')} Latest CI status</a>
    ${sep}
    <a class="${link}" href="#jobs">${icon('grid', 'w-4 h-4')} Job history</a>
    ${sep}
    <a class="${link}" href="#runs">${icon('list', 'w-4 h-4')} Recent runs</a>
  </nav>`));
  return frag;
}

function headline(newest) {
  // Latest conclusion per job across all workflows.
  let latestJobs = [];
  for (const w of WORKFLOWS) {
    const rec = state.latest[w.name];
    if (rec && rec.jobs) latestJobs = latestJobs.concat(rec.jobs);
  }
  const passing = latestJobs.filter((j) => kindOf(j.conclusion) === 'pass').length;

  // Per-job pass rate over the latest run of each day (same runs as Job history). Anything not passed counts
  // against it, including cancelled; jobs whose workflow did not run that day are left out.
  let pass = 0, total = 0;
  for (const d of historyDays(RATE_DAYS)) {
    for (const c of d.batch ? d.batch.cells : []) {
      if (!c.job) continue;
      total++;
      if (kindOf(c.job.conclusion) === 'pass') pass++;
    }
  }
  const rate = total ? `${Math.round((pass / total) * 100)}%` : '-';

  const latestDate = newest ? fmtDate(newest.timestamp, false) : 'latest run';

  const card = (label, value, sub, valueCls = 'text-slate-800 dark:text-slate-100') => `<div class="${CARD} p-4 sm:p-5">
    <div class="text-xs uppercase tracking-wide text-slate-400">${label}</div>
    <div class="mt-1 text-2xl sm:text-3xl font-bold ${valueCls} break-words tabular-nums">${value}</div>
    ${sub ? `<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${sub}</div>` : ''}
  </div>`;
  const allPass = latestJobs.length && passing === latestJobs.length;
  return $(`<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-2">
    ${card(`Jobs passing (${latestDate})`, latestJobs.length ? `${passing} / ${latestJobs.length}` : '-', 'Across all OpenVINO CI workflows',
      latestJobs.length ? (allPass ? KINDS.pass.text : KINDS.fail.text) : undefined)}
    ${card(`Job pass rate (last ${RATE_DAYS} days)`, rate, total ? `${pass} of ${total} job runs passed` : 'No job runs yet')}
    ${card('Last upstream commit tested', newest ? commitLink(newest) : '-', newest ? fmtDate(newest.timestamp) : '')}
  </div>`);
}

function latestCards() {
  const grid = $(`<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4"></div>`);
  for (const w of WORKFLOWS) {
    const rec = state.latest[w.name];
    const wfLink = w.file ? `<a class="${LINK}" target="_blank" rel="noopener" href="https://github.com/${REPO}/actions/workflows/${w.file}">${esc(w.name)}</a>` : esc(w.name);
    let body;
    if (!rec) {
      body = `<p class="text-sm text-slate-400">No runs recorded yet.</p>`;
    } else {
      body = `<ul class="divide-y divide-slate-100 dark:divide-slate-700">${rec.jobs.map((j) => `<li class="flex items-center justify-between gap-3 py-2">
        <span class="flex items-center gap-2 min-w-0"><span class="w-2 h-2 rounded-full shrink-0 ${KINDS[kindOf(j.conclusion)].dot}"></span>
          ${j.html_url ? `<a class="${LINK} truncate" target="_blank" rel="noopener" href="${esc(j.html_url)}">${esc(j.name)}</a>` : `<span class="truncate">${esc(j.name)}</span>`}</span>
        ${badge(j.conclusion)}
      </li>`).join('')}</ul>`;
    }
    const border = rec ? { pass: 'border-l-emerald-500', fail: 'border-l-red-500', cancel: 'border-l-amber-500', skip: 'border-l-slate-400' }[kindOf(rec.status)] : 'border-l-slate-300 dark:border-l-slate-600';
    grid.append($(`<div class="${CARD} border-l-4 ${border} p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold text-slate-800 dark:text-slate-100">${wfLink}</div>
          ${w.hint ? `<div class="text-xs text-slate-400">${esc(w.hint)}</div>` : ''}
        </div>
        ${rec ? badge(rec.status) : badge(null)}
      </div>
      ${rec ? `<div class="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
        <span>${fmtDate(rec.timestamp)}</span><span>commit ${commitLink(rec)}</span>
        <a class="${LINK}" target="_blank" rel="noopener" href="${esc(rec.run_url)}">view run ${icon('external', 'w-3 h-3')}</a>
      </div>` : ''}
      <div class="mt-3">${body}</div>
    </div>`));
  }
  return grid;
}

function legend() {
  return $(`<div class="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
    ${['pass', 'fail', 'cancel', 'skip', 'none'].map((k) => `<span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-sm ${KINDS[k].cell}"></span>${KINDS[k].label}</span>`).join('')}
  </div>`);
}

const TZ = 'America/Los_Angeles';
// YYYY-MM-DD of a timestamp in Pacific time, matching the dates shown elsewhere on the page.
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });

// Last n calendar days, oldest first, each with the newest combined run of that day (or null).
function historyDays(n = HISTORY_DAYS) {
  const byDay = new Map();
  for (const b of batches()) {
    const k = dayKey(b.timestamp);
    if (!byDay.has(k)) byDay.set(k, b);
  }
  const days = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKey(now - i * 86400000);
    const [y, m, d] = key.split('-').map(Number);
    const month = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    days.push({ key, day: d, month, batch: byDay.get(key) || null });
  }
  return days;
}

// Grid: name column, one column per day, pass count. Header rows: month (spanning its days) and day of month.
// Rows: one per job across all workflows, then a combined "overall" row. Each cell links to that job's log.
function jobHistory() {
  const wrap = $(`<div class="${CARD} p-4 sm:p-5"></div>`);
  wrap.append(legend());
  if (!state.history.length) {
    wrap.append($(`<p class="text-sm text-slate-400">No runs recorded yet.</p>`));
    return wrap;
  }
  const days = historyDays();
  const cols = `10.5rem repeat(${days.length}, 13px) 5rem`;
  // Name column stays pinned while the day columns scroll on narrow screens.
  const STICKY = 'sticky left-0 z-10 bg-white dark:bg-slate-800';
  const cell = (inner, extra = '') => `<div class="${extra}">${inner}</div>`;

  // Month row: one span per run of consecutive days in the same month.
  const months = [];
  for (const d of days) {
    const last = months[months.length - 1];
    if (last && last.month === d.month) last.n++;
    else months.push({ month: d.month, n: 1 });
  }
  let html = cell('', STICKY + ' self-stretch');
  html += months.map((m, i) => `<div class="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden ${i ? 'border-l border-slate-200 dark:border-slate-600 pl-1' : ''}" style="grid-column: span ${m.n}">${m.n >= 2 ? m.month : ''}</div>`).join('');
  html += cell('');
  html += cell('', STICKY + ' self-stretch');
  html += days.map((d) => `<div class="text-[9px] leading-4 text-center tabular-nums text-slate-400 ${d.batch ? 'font-semibold text-slate-600 dark:text-slate-200' : ''}">${d.day}</div>`).join('');
  html += cell('');

  const rows = allJobs().map((j, i) => ({ label: j.name, title: `${j.workflow} / ${j.name}`, pick: (b) => b.cells[i] }))
    .concat([{ label: 'overall', title: 'All jobs across all OpenVINO CI workflows', overall: true, pick: (b) => ({ job: { conclusion: b.conclusion } }) }]);
  for (const row of rows) {
    if (row.overall) html += `<div class="border-t border-slate-100 dark:border-slate-700 my-1" style="grid-column: 1 / -1"></div>`;
    const counts = { pass: 0, fail: 0, cancel: 0, skip: 0, none: 0 };
    const cells = days.map((d) => {
      const b = d.batch;
      const c = b ? row.pick(b) : { job: null };
      const conclusion = c.job ? c.job.conclusion : null;
      const k = kindOf(conclusion);
      counts[k]++;
      const title = b
        ? `${fmtDate(b.timestamp)} - ${c.job ? (conclusion || c.job.status) : 'not run'} - ${(b.rec.upstream_sha || b.rec.sha || '').slice(0, 7)}`
        : `${d.key} - no run`;
      const cls = `block w-full h-6 rounded-sm ${KINDS[k].cell}`;
      return c.job && c.job.html_url
        ? `<a class="${cls}" target="_blank" rel="noopener" title="${esc(title)}" href="${esc(c.job.html_url)}"></a>`
        : `<span class="${cls}" title="${esc(title)}"></span>`;
    }).join('');
    const ran = days.length - counts.none;
    const tip = `${counts.pass} pass, ${counts.fail} fail, ${counts.cancel} cancelled, ${counts.skip} skipped, ${counts.none} days without a run (last ${days.length} days)`;
    const nameCls = row.overall ? 'font-semibold text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200';
    html += `<div class="${STICKY} self-stretch flex items-center text-sm truncate pr-3 ${nameCls}" title="${esc(row.title)}">${esc(row.label)}</div>${cells}`;
    html += `<div class="text-xs text-right tabular-nums text-slate-500 dark:text-slate-400" title="${esc(tip)}">${counts.pass} / ${ran} pass</div>`;
  }
  const scroller = $(`<div class="overflow-x-auto"><div class="grid items-center gap-x-0.5 gap-y-1 w-max" style="grid-template-columns: ${cols}">${html}</div></div>`);
  wrap.append(scroller);
  // Start scrolled to the newest day when the grid is wider than the screen.
  requestAnimationFrame(() => { scroller.scrollLeft = scroller.scrollWidth; });
  return wrap;
}

// Missing jobs (workflow not run on that commit) show as a grey "not run" badge.
function cellBadge(c) {
  if (c.job) return jobBadge(c.job);
  return `<span title="${esc(`${c.workflow}: not run on this commit`)}">${badge(null, c.name)}</span>`;
}

function runsTable() {
  const rows = batches();
  if (!rows.length) return $(`<div class="${CARD} p-5 text-sm text-slate-400">No runs recorded yet.</div>`);
  const tr = rows.map((b) => {
    const logs = WORKFLOWS.filter((w) => b.runs[w.name])
      .map((w) => `<a class="${LINK} whitespace-nowrap" target="_blank" rel="noopener" title="${esc(w.name)}" href="${esc(b.runs[w.name].run_url)}">${esc(w.short)} ${icon('external', 'w-3 h-3')}</a>`)
      .join('<br>');
    return `<tr class="border-t border-slate-100 dark:border-slate-700 align-top">
    <td class="py-2.5 pl-4 pr-3 whitespace-nowrap text-slate-600 dark:text-slate-300">${fmtDate(b.timestamp)}</td>
    <td class="py-2.5 px-3">${badge(b.conclusion)}</td>
    <td class="py-2.5 px-3"><div class="flex flex-wrap gap-1">${b.cells.map(cellBadge).join('')}</div></td>
    <td class="py-2.5 px-3">${commitLink(b.rec)}</td>
    <td class="py-2.5 pl-3 pr-4 text-xs leading-6">${logs}</td>
  </tr>`;
  }).join('');
  return $(`<div class="overflow-x-auto ${CARD}"><table class="w-full min-w-[760px] text-sm">
    <thead><tr class="text-xs uppercase tracking-wide text-slate-400 text-left">
      <th class="py-2.5 pl-4 pr-3">Date</th><th class="py-2.5 px-3">Result</th>
      <th class="py-2.5 px-3">Jobs</th><th class="py-2.5 px-3">Commit</th><th class="py-2.5 pl-3 pr-4">CI workflow logs</th>
    </tr></thead>
    <tbody>${tr}</tbody>
  </table></div>`);
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  const titleRow = $(`<div class="flex items-start justify-between gap-3 mb-2"></div>`);
  titleRow.append(
    $(`<h1 class="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-slate-100">llama.cpp OpenVINO Backend CI Status Dashboard</h1>`),
    themeToggle(),
  );
  const newest = state.history[0];
  app.append(titleRow, freshnessBanner(newest), introAndNav(), headline(newest));

  const asOf = newest ? ` Last run: ${fmtDate(newest.timestamp)}.` : '';
  app.append(section('activity', 'Latest CI status', `Most recent run of each workflow, per job.${asOf}`, 'latest'), latestCards());
  app.append(section('grid', 'Job history', `Last ${HISTORY_DAYS} days, latest run per day, newest on the right. Dates in Pacific time. Click a cell to open the job log.`, 'jobs'), jobHistory());

  app.append(section('list', 'Recent runs', 'One row per tested commit, all jobs across all OpenVINO CI workflows, newest first.', 'runs'), runsTable());
}

(async function init() {
  state.history = (await loadJSON('data/history.json', [])).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  for (const r of state.history) state.latest[r.job] ??= r;
  render();
})();
