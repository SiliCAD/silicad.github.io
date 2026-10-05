// Visitor analytics for GoatCounter (https://silicad.goatcounter.com).
// Sends events for: tab opened, scroll depth per tab, how much of each demo was
// watched, and contact link clicks. A ?ref=<who> in the link is added to every
// event name, e.g. "demo-02/finished [acme]", so each recipient can be told apart.
(() => {
  'use strict';

  const ref = (() => {
    try {
      const r = new URLSearchParams(location.search).get('ref') || sessionStorage.getItem('silicad-ref') || '';
      if (r) sessionStorage.setItem('silicad-ref', r);
      return r.replace(/[^\w.-]/g, '').slice(0, 40);
    } catch (e) { return ''; }
  })();

  const queue = [];
  const flush = () => {
    const gc = window.goatcounter;
    if (!gc || !gc.count) return false;
    while (queue.length) gc.count(queue.shift());
    return true;
  };
  const send = (name) => {
    queue.push({ path: ref ? name + ' [' + ref + ']' : name, title: name, event: true });
    if (!flush()) setTimeout(flush, 1500);
  };
  const once = new Set();
  const sendOnce = (name) => { if (!once.has(name)) { once.add(name); send(name); } };

  // Tabs switch with history.replaceState, which fires no event, so poll.
  const tab = () => {
    const el = document.querySelector('[data-screen-label]');
    const l = el && el.getAttribute('data-screen-label');
    return l ? l.replace(/^\d+\s*/, '').toLowerCase() : '';
  };
  let lastTab = '';
  setInterval(() => {
    const t = tab();
    if (t && t !== lastTab) { lastTab = t; sendOnce('tab/' + t); }
  }, 1000);

  // Scroll depth, per tab.
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    setTimeout(() => {
      ticking = false;
      const t = tab(), max = document.documentElement.scrollHeight - innerHeight;
      if (!t || max < 200) return;
      const pct = scrollY / max;
      [25, 50, 75, 100].forEach((p) => { if (pct >= p / 100 - 0.02) sendOnce('scroll/' + t + '/' + p + '%'); });
    }, 300);
  }, { passive: true });

  // Demo videos autoplay as they scroll into view, so count seconds actually
  // played rather than the "play" event.
  const watched = new Map();
  const demoNo = (v) => {
    const i = Array.prototype.indexOf.call(document.querySelectorAll('video[data-vid]'), v);
    return i < 0 ? '' : 'demo-0' + (i + 1);
  };
  document.addEventListener('timeupdate', (e) => {
    const v = e.target;
    if (!(v instanceof HTMLVideoElement) || v.paused || !v.duration) return;
    const id = demoNo(v);
    if (!id) return;
    const w = watched.get(v) || { secs: 0, at: v.currentTime };
    const step = v.currentTime - w.at;
    if (step > 0 && step < 2) w.secs += step;
    w.at = v.currentTime;
    watched.set(v, w);
    const frac = w.secs / v.duration;
    if (w.secs >= 5) sendOnce(id + '/started');
    if (frac >= 0.5) sendOnce(id + '/half');
    if (frac >= 0.9) sendOnce(id + '/finished');
  }, true);

  // Contact links (email, LinkedIn, GitHub).
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const h = a.getAttribute('href');
    const name = /^mailto:/.test(h) ? 'email' : /linkedin/.test(h) ? 'linkedin' : /github/.test(h) ? 'github' : '';
    if (name) send('click/' + name);
  }, true);
})();
