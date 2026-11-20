// Small Private-mode (switch A) toggle inside LinkedIn's top navigation.
// If the nav can't be found, it does nothing: the toolbar popup is the
// reliable control.
(() => {
  const ID = 'qpb-nav-toggle';
  const FIND_TIMEOUT_MS = 5000;

  const findNavList = () => {
    const navs = [...document.querySelectorAll('header nav')];
    let best = null;
    for (const nav of navs) {
      const ul = nav.querySelector('ul');
      if (ul && (!best || ul.children.length > best.children.length)) best = ul;
    }
    return best;
  };

  const send = (msg) => browser.runtime.sendMessage(msg);
  let debug = false;
  browser.storage.local.get({ debugMode: false }).then((s) => { debug = s.debugMode; });
  const dlog = (m) => { if (debug) console.info(`[QPB-nav] ${m} t=${Date.now()}`); };

  function build() {
    const li = document.createElement('li');
    li.id = ID;
    li.style.cssText = 'display:flex;align-items:center;list-style:none;';
    const host = document.createElement('span');
    li.append(host);
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      button { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0 8px; padding: 4px 10px;
               border-radius: 999px; border: 1px solid; font: 500 13px/1.2 system-ui, sans-serif; white-space: nowrap; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
      .good { background: #eaf3de; color: #27500a; border-color: #3b6d11; }
      .pending { background: #faeeda; color: #633806; border-color: #854f0b; }
      .neutral { background: transparent; color: #5f5e5a; border-color: #b4b2a9; }
      .bad { background: #fcebeb; color: #791f1f; border-color: #a32d2d; }
      @media (prefers-color-scheme: dark) {
        .good { background: #173404; color: #c0dd97; border-color: #639922; }
        .pending { background: #412402; color: #fac775; border-color: #ba7517; }
        .neutral { color: #d3d1c7; border-color: #888780; }
        .bad { background: #501313; color: #f7c1c1; border-color: #e24b4a; }
      }
      .busy { opacity: .6; pointer-events: none; }`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'neutral';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const text = document.createElement('span');
    text.textContent = 'Checking…';
    btn.append(dot, text);
    root.append(style, btn);

    let on = false;
    const render = (res) => {
      if (!res || !res.nav) return;
      dlog(`render a=${res.a.verifiedValue} level=${res.status.level} nav=${res.nav.text}`);
      on = res.a.verifiedValue === 'HIDE';
      text.textContent = res.nav.text;
      btn.className = res.nav.tone;
      btn.title = res.nav.hint;
      btn.setAttribute('aria-label', `${res.nav.text}. ${res.nav.hint}`);
    };
    const run = async (msg) => {
      btn.classList.add('busy');
      try {
        const res = await send(msg);
        if (res && res.needsHistoryWarning) {
          // eslint-disable-next-line no-alert
          const ok = window.confirm('LinkedIn says Private mode may disable “Who’s viewed your profile” and erase your viewer history. Turn on Private mode?');
          render(ok ? await send({ type: 'setA', on: true, confirmedHistoryWarning: true }) : res);
        } else {
          render(res);
        }
      } catch {
        text.textContent = 'Not checked';
        btn.className = 'neutral';
        btn.title = "Couldn't reach the extension. Reload the page.";
      } finally {
        btn.classList.remove('busy');
      }
    };
    btn.addEventListener('click', () => run({ type: 'setA', on: !on }));
    run({ type: 'getStatus' });
    // Follow changes made from the popup or by the guard.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      // Only react to real changes: every LinkedIn tab hears every write.
      const aChanged = changes.aCheck && (changes.aCheck.oldValue || {}).value !== (changes.aCheck.newValue || {}).value;
      const other = ['bEnabled', 'tripped', 'bConfirmedAt', 'fallbackFailed']
        .some((k) => changes[k] && JSON.stringify(changes[k].oldValue) !== JSON.stringify(changes[k].newValue));
      if (aChanged || other) { dlog(`storage change ${Object.keys(changes).join(',')}`); run({ type: 'getStatus' }); }
    });
    return li;
  }

  // Loud on-page warning when the guard trips. Stays until dismissed:
  // system notifications are easy to miss or blocked by the OS.
  const TOAST_ID = 'qpb-trip-toast';
  function showToast(text) {
    document.getElementById(TOAST_ID)?.remove();
    const host = document.createElement('div');
    host.id = TOAST_ID;
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .box { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); z-index: 2147483647; max-width: 520px; width: calc(100% - 32px);
             background: #cf222e; color: #fff; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 14px 16px; display: flex; gap: 12px; align-items: flex-start;
             font: 14px/1.4 system-ui, sans-serif; }
      strong { display: block; font-size: 15px; margin-bottom: 2px; }
      button { all: unset; cursor: pointer; font-weight: 600; padding: 2px 8px; border: 1px solid rgba(255,255,255,.7); border-radius: 6px; white-space: nowrap; }`;
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'alert');
    const msg = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'LinkedIn view blocking stopped working';
    msg.append(title, document.createTextNode(text));
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.addEventListener('click', () => host.remove());
    box.append(msg, close);
    root.append(style, box);
    document.documentElement.append(host);
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const log = changes.tripLog;
    const grew = log && (log.newValue || []).length > 0
      && JSON.stringify((log.newValue || []).at(-1)) !== JSON.stringify((log.oldValue || []).at(-1));
    if (grew) {
      showToast(' The profile you just opened may have seen your visit. Private mode has been turned on (this may erase your viewer history).');
    }
    if (changes.fallbackFailed && changes.fallbackFailed.newValue === true) {
      showToast(' You are currently visible to profiles you view. Turning on Private mode failed — turn it on in LinkedIn settings.');
    }
  });

  let toggle = null;
  const insert = () => {
    if (document.getElementById(ID)) return true;
    const ul = findNavList();
    if (!ul) return false;
    dlog(toggle ? 'reinsert' : 'insert');
    toggle = toggle || build();
    ul.append(toggle);
    return true;
  };

  // LinkedIn re-renders its header on in-page navigation; keep the toggle in place.
  const keepAlive = new MutationObserver(() => {
    if (!document.getElementById(ID)) insert();
  });

  if (insert()) {
    keepAlive.observe(document.body, { childList: true, subtree: true });
    return;
  }
  const finder = new MutationObserver(() => {
    if (insert()) {
      finder.disconnect();
      keepAlive.observe(document.body, { childList: true, subtree: true });
    }
  });
  finder.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => finder.disconnect(), FIND_TIMEOUT_MS);
})();
