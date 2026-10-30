/* VersionBox. No framework, API keys, cookies or build step. */
(() => {
  'use strict';
  const asset = new URL(document.currentScript.src);
  const root = new URL('../', asset);
  const hub = new URL('./index.html', asset);
  const $ = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = String(value);
    return node;
  };
  const add = (parent, ...children) => {
    for (const child of children) if (child) parent.appendChild(child);
    return parent;
  };
  const link = (text, href, className) => {
    const el = $('a', className, text);
    el.href = href;
    el.rel = 'noopener noreferrer';
    return el;
  };
  const url = path => new URL(path, root).href;
  const repoUrl = repo => 'https://github.com/' + repo;
  const date = iso => {
    if (!iso) return 'Previously published';
    const value = new Date(iso);
    return Number.isNaN(+value) ? 'Published' : new Intl.DateTimeFormat(undefined, {year:'numeric', month:'short', day:'numeric'}).format(value);
  };
  const compact = (value, n = 50) => value && value.length > n ? value.slice(0, n - 1) + '…' : (value || 'Static snapshot');
  const params = new URLSearchParams(location.search);

  function versionRow(project, version, {small = false, compare = null} = {}) {
    const row = $('div', 'vb-version-row' + (small ? ' vb-version-row--small' : ''));
    const left = $('div', 'vb-version-main');
    const line = $('div', 'vb-version-line');
    add(line, $('span', 'vb-version-label', version.label || version.id));
    if (version.legacy) add(line, $('span', 'vb-chip', 'ARCHIVE'));
    add(left, line, $('div', 'vb-version-message', compact(version.message || (version.legacy ? 'Previously published build' : 'GitHub snapshot'), 100)), $('div', 'vb-version-date', date(version.date)));
    const actions = $('div', 'vb-version-actions');
    const open = link('Open ↗', url(version.url), 'vb-btn vb-btn--accent');
    open.target = '_blank';
    add(actions, open);
    if (compare) {
      const choose = $('button', 'vb-btn vb-btn--quiet', 'Compare');
      choose.type = 'button';
      choose.addEventListener('click', () => compare(project, version));
      add(actions, choose);
    }
    return add(row, left, actions);
  }

  function home(projects) {
    const target = document.getElementById('versionbox-home');
    if (!target) return;
    target.replaceChildren();
    const title = $('div', 'vb-home-head');
    const titleLeft = $('div');
    add(titleLeft, $('div', 'vb-eyebrow', 'AUTOMATIC VERSION ARCHIVE'), $('h2', 'vb-home-title', 'Your projects. Every version.'));
    const all = link('Open VersionBox ↗', hub.href, 'vb-btn vb-btn--accent');
    add(title, titleLeft, all);
    target.append(title);
    const grid = $('div', 'vb-home-grid');
    for (const project of projects) {
      const box = $('article', 'vb-home-card');
      const top = $('div', 'vb-home-card-top');
      const head = $('div');
      add(head, $('h3', '', project.name), $('p', '', project.description || 'Project archive'));
      const count = $('span', 'vb-count', project.versions.length + ' version' + (project.versions.length === 1 ? '' : 's'));
      add(top, head, count);
      add(box, top);
      if (!project.versions.length) {
        add(box, $('div', 'vb-empty', 'Waiting for the first published build.'));
      } else {
        const stack = $('div', 'vb-home-versions');
        for (const v of project.versions) add(stack, versionRow(project, v, {small:true}));
        add(box, stack);
      }
      const more = link('History & compare →', hub.href + '?project=' + encodeURIComponent(project.id), 'vb-home-more');
      add(box, more);
      add(grid, box);
    }
    target.append(grid);
  }

  function dashboard(projects, lastUpdated) {
    const app = document.getElementById('versionbox-app');
    if (!app) return;
    const state = {
      projectId: params.get('project') || projects[0]?.id,
      q: '',
      selected: [],
      compareOpen: Boolean(params.get('left') && params.get('right'))
    };
    if (!projects.some(p => p.id === state.projectId)) state.projectId = projects[0]?.id;
    const shell = $('div', 'vb-shell');
    const sidebar = $('aside', 'vb-sidebar');
    const logo = link('◈  VERSIONBOX', hub.href, 'vb-logo');
    const sub = $('div', 'vb-sidebar-sub', 'Your project timeline');
    const search = $('input', 'vb-search');
    search.type = 'search'; search.placeholder = 'Search projects…'; search.setAttribute('aria-label', 'Search projects');
    const nav = $('nav', 'vb-project-nav');
    const foot = $('div', 'vb-sidebar-foot');
    add(foot, $('span', 'vb-live-dot'), $('span', '', 'GitHub-powered archive'));
    add(sidebar, logo, sub, search, $('div', 'vb-nav-label', 'PROJECTS'), nav, foot);
    const main = $('main', 'vb-main');
    const header = $('header', 'vb-main-head');
    add(header, $('span', 'vb-eyebrow', 'PUBLIC PROJECT VERSIONS'), link('↗ Homepage', root.href, 'vb-btn vb-btn--quiet'));
    const content = $('div', 'vb-content');
    add(main, header, content);
    add(shell, sidebar, main);
    app.replaceChildren(shell);

    const currentProject = () => projects.find(p => p.id === state.projectId);
    function selectVersion(v) {
      if (state.selected.includes(v.id)) {
        state.selected = state.selected.filter(id => id !== v.id);
      } else {
        state.selected = [...state.selected.slice(-1), v.id];
      }
      state.compareOpen = state.selected.length === 2;
      render();
      if (state.compareOpen) document.querySelector('.vb-comparison')?.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }
    function renderNav() {
      nav.replaceChildren();
      for (const p of projects.filter(p => (p.name + ' ' + p.id).toLowerCase().includes(state.q))) {
        const btn = $('button', 'vb-nav-item' + (p.id === state.projectId ? ' active' : ''));
        btn.type = 'button';
        const dot = $('span', 'vb-project-dot', p.name.slice(0, 1).toUpperCase());
        const n = $('span', 'vb-nav-item-name', p.name);
        const count = $('span', 'vb-nav-count', p.versions.length);
        add(btn, dot, n, count);
        btn.addEventListener('click', () => {
          state.projectId = p.id; state.selected = []; state.compareOpen = false;
          history.replaceState(null, '', '?project=' + encodeURIComponent(p.id));
          render();
        });
        add(nav, btn);
      }
    }
    function renderCompare(project, container) {
      if (state.selected.length !== 2 || !state.compareOpen) return;
      const chosen = state.selected.map(id => project.versions.find(v => v.id === id));
      if (!chosen.every(Boolean)) return;
      const wrapper = $('section', 'vb-comparison');
      const top = $('div', 'vb-compare-header');
      const h = $('div');
      add(h, $('div', 'vb-eyebrow', 'LIVE SIDE-BY-SIDE'), $('h2', '', 'Compare versions'));
      const close = $('button', 'vb-btn vb-btn--quiet', 'Close comparison ✕');
      close.addEventListener('click', () => {state.compareOpen = false; render();});
      add(top, h, close);
      const panels = $('div', 'vb-compare-panels');
      for (const v of chosen) {
        const panel = $('div', 'vb-compare-panel');
        const label = $('div', 'vb-compare-panel-head');
        add(label, $('span', '', v.label), link('Open ↗', url(v.url), 'vb-btn vb-btn--quiet'));
        const frame = $('iframe', 'vb-preview');
        frame.title = `${project.name} ${v.label}`;
        frame.src = url(v.url);
        frame.loading = 'lazy';
        frame.referrerPolicy = 'no-referrer';
        add(panel, label, frame);
        add(panels, panel);
      }
      return add(wrapper, top, panels);
    }
    function render() {
      renderNav(); content.replaceChildren();
      const project = currentProject();
      if (!project) {content.append($('h1', '', 'No projects configured')); return;}
      const intro = $('section', 'vb-intro');
      const top = $('div', 'vb-intro-top');
      const titleBlock = $('div');
      add(titleBlock, $('div', 'vb-eyebrow', 'PROJECT / ' + project.id.toUpperCase()), $('h1', '', project.name), $('p', 'vb-description', project.description || 'Published versions and history'));
      const repo = project.repo ? link('View repository ↗', repoUrl(project.repo), 'vb-btn vb-btn--quiet') : null;
      if (repo) repo.target = '_blank';
      add(top, titleBlock, repo); add(intro, top);
      const stats = $('div', 'vb-stats');
      const snapshotCount = project.versions.filter(v => !v.legacy).length;
      for (const [number, caption] of [[project.versions.length, 'Total versions'], [snapshotCount, 'Permanent snapshots'], [lastUpdated ? date(lastUpdated) : '—', 'Last sync']]) {
        const item = $('div', 'vb-stat'); add(item, $('div', 'vb-stat-value', number), $('div', 'vb-stat-label', caption)); add(stats, item);
      }
      add(intro, stats); add(content, intro);
      const listSection = $('section', 'vb-history');
      const heading = $('div', 'vb-section-heading');
      add(heading, $('h2', '', 'Version history'), $('span', 'vb-hint', 'Select two versions to compare'));
      add(listSection, heading);
      const versions = $('div', 'vb-version-list');
      if (!project.versions.length) add(versions, $('div', 'vb-empty', 'No public versions yet. Add a build path in versionbox/catalog.json and run the sync.'));
      for (let i=0; i<project.versions.length; i++) {
        const v = project.versions[i];
        const row = versionRow(project, v, {compare: (_, item) => selectVersion(item)});
        if (state.selected.includes(v.id)) row.classList.add('selected');
        if (i === 0) {
          const badge = $('span', 'vb-chip vb-chip--latest', 'LATEST');
          row.querySelector('.vb-version-line').append(badge);
        }
        add(versions, row);
      }
      add(listSection, versions); add(content, listSection);
      if (state.selected.length === 1) add(content, $('div', 'vb-compare-prompt', '1 version selected · choose one more to compare'));
      add(content, renderCompare(project));
      const tip = $('p', 'vb-footer-note', 'Snapshots are immutable URLs. Changes from AI tools appear here after the changes are pushed to the source repository and VersionBox syncs.');
      add(content, tip);
    }
    search.addEventListener('input', e => {state.q = e.target.value.toLowerCase().trim(); renderNav();});
    const project = currentProject();
    if (project && state.compareOpen) {
      const ids = [params.get('left'), params.get('right')];
      if (ids.every(id => project.versions.some(v => v.id === id)) && ids[0] !== ids[1]) state.selected = ids;
      else state.compareOpen = false;
    }
    render();
  }

  (async () => {
    try {
      const response = await fetch(new URL('./data.json', asset), {cache: 'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.projects)) throw new Error('Invalid version data');
      home(data.projects);
      dashboard(data.projects, data.generated_at);
    } catch (error) {
      for (const id of ['versionbox-home','versionbox-app']) {
        const node = document.getElementById(id);
        if (node) node.replaceChildren($('p', 'vb-error', 'Version archive unavailable. Open VersionBox after publishing the site. (' + error.message + ')'));
      }
    }
  })();
})();
