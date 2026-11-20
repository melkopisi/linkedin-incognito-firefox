// Small Private-mode (switch A) toggle inside LinkedIn's top navigation.
// If the nav can't be found, it does nothing: the toolbar popup is the
// reliable control.
(() => {
  const ID = 'qpb-nav-toggle';
  const FIND_TIMEOUT_MS = 20000;

  // LinkedIn's main menu: the biggest *visible* list in the header. While
  // the page loads, the header briefly holds small hidden lists; never
  // settle in one of those.
  const MIN_ITEMS = 3;
  const findNavList = () => {
    let best = null;
    for (const nav of document.querySelectorAll('header nav')) {
      const ul = nav.querySelector('ul');
      if (!ul || ul.getBoundingClientRect().width === 0) continue;
      const items = [...ul.children].filter((c) => c.id !== ID).length;
      if (items < MIN_ITEMS) continue;
      if (!best || items > best.items) best = { ul, items };
    }
    return best && best.ul;
  };

  const send = (msg) => browser.runtime.sendMessage(msg);
  let debug = false;
  browser.storage.local.get({ debugMode: false }).then((s) => { debug = s.debugMode; });
  const dlog = (m) => { if (debug) console.info(`[QPB-nav] ${m} t=${Date.now()}`); };

  // The label in the top bar opens a small menu with both switches.
  function build() {
    const li = document.createElement('li');
    li.id = ID;
    li.style.cssText = 'display:flex;align-items:center;list-style:none;';
    const host = document.createElement('span');
    host.style.cssText = 'position:relative;display:inline-block;';
    li.append(host);
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      .chip { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 0 8px; padding: 5px 12px;
              border-radius: 999px; border: 1.5px solid; font: 600 13px/1.2 system-ui, sans-serif; white-space: nowrap; }
      .chip:focus-visible { outline: 2px solid #378add; outline-offset: 2px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
      .caret { font-size: 10px; opacity: .8; }
      .good { background: #eaf3de; color: #27500a; border-color: #3b6d11; }
      .pending { background: #faeeda; color: #633806; border-color: #854f0b; }
      .neutral { background: #f1efe8; color: #444441; border-color: #888780; }
      .bad { background: #fcebeb; color: #791f1f; border-color: #a32d2d; }
      .menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 2147483646; width: 290px; padding: 12px 14px;
              background: #fff; color: #1f2328; border: 1px solid #d0d7de; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18);
              font: 13px/1.4 system-ui, sans-serif; }
      .menu[hidden] { display: none; }
      .status { font-weight: 600; margin-bottom: 8px; }
      label.sw { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; border-top: 1px solid #d0d7de; cursor: pointer; }
      label.sw input { margin-top: 2px; }
      small { color: #656d76; display: block; }
      .tag { font-size: 11px; color: #9a6700; border: 1px solid #9a6700; border-radius: 4px; padding: 0 4px; margin-left: 4px; }
      .note { background: #fff8c5; border: 1px solid #d4a72c; border-radius: 6px; padding: 8px 10px; margin: 8px 0; }
      .note[hidden] { display: none; }
      .hint { font-style: italic; margin-top: 2px; } .hint[hidden] { display: none; }
      .note p { margin: 0 0 6px; }
      .row { display: flex; gap: 6px; }
      .row button { font: inherit; padding: 3px 10px; border-radius: 6px; border: 1px solid #d0d7de; background: #fff; color: inherit; cursor: pointer; }
      .row button.primary { background: #1f2328; color: #fff; border-color: #1f2328; }
      .busy { opacity: .6; pointer-events: none; }
      @media (prefers-color-scheme: dark) {
        .good { background: #173404; color: #c0dd97; border-color: #97c459; }
        .pending { background: #412402; color: #fac775; border-color: #ef9f27; }
        .neutral { background: #2c2c2a; color: #f1efe8; border-color: #b4b2a9; }
        .bad { background: #501313; color: #f7c1c1; border-color: #f09595; }
        .menu { background: #1c1e21; color: #e6edf3; border-color: #3d444d; }
        label.sw { border-color: #3d444d; } small { color: #9198a1; }
        .note { background: #3b2f00; border-color: #9a6700; }
        .row button { background: #1c1e21; border-color: #3d444d; } .row button.primary { background: #e6edf3; color: #1c1e21; }
      }`;

    const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };

    const text = el('span', { textContent: 'Checking…' });
    const chip = el('button', { type: 'button', className: 'chip neutral' }, [el('span', { className: 'dot' }), text, el('span', { className: 'caret', textContent: '▾' })]);
    chip.setAttribute('aria-haspopup', 'true');
    chip.setAttribute('aria-expanded', 'false');

    const statusLine = el('div', { className: 'status' });
    const boxA = el('input', { type: 'checkbox' });
    const boxB = el('input', { type: 'checkbox' });
    const bHint = el('small', { className: 'hint', hidden: true });
    const histYes = el('button', { type: 'button', className: 'primary', textContent: 'Turn on Private mode' });
    const histNo = el('button', { type: 'button', textContent: 'Cancel' });
    const histNote = el('div', { className: 'note', hidden: true }, [
      el('p', { textContent: 'LinkedIn says Private mode may disable “Who’s viewed your profile” and erase your viewer history.' }),
      el('div', { className: 'row' }, [histYes, histNo]),
    ]);
    const offYes = el('button', { type: 'button', className: 'primary', textContent: 'Turn off' });
    const offNo = el('button', { type: 'button', textContent: 'Keep on' });
    const offNote = el('div', { className: 'note', hidden: true }, [
      el('p', { textContent: 'Blocking keeps your viewer list only if Private mode is off. Turn Private mode off?' }),
      el('div', { className: 'row' }, [offYes, offNo]),
    ]);
    const menu = el('div', { className: 'menu', hidden: true }, [
      statusLine,
      histNote,
      offNote,
      el('label', { className: 'sw' }, [boxA, el('span', {}, [document.createTextNode('Private mode '), el('small', { textContent: 'LinkedIn setting' })])]),
      el('label', { className: 'sw' }, [boxB, el('span', {}, [
        document.createTextNode('Block view signal'), el('span', { className: 'tag', textContent: 'Experimental' }),
        el('small', { textContent: 'May stop working when LinkedIn changes things.' }),
        bHint,
      ])]),
    ]);
    menu.setAttribute('role', 'menu');
    root.append(style, chip, menu);

    // Questions stay open until answered, even when the menu refreshes.
    let askHistory = false;
    let askOffer = false;
    const render = (res) => {
      if (!res || !res.nav) return;
      dlog(`render a=${res.a.verifiedValue} level=${res.status.level} nav=${res.nav.text}`);
      text.textContent = res.nav.text;
      chip.className = `chip ${res.nav.tone}`;
      chip.title = res.nav.hint;
      chip.setAttribute('aria-label', `${res.nav.text}. Open privacy menu`);
      statusLine.textContent = res.status.label;
      boxA.checked = res.a.verifiedValue === 'HIDE';
      boxB.checked = res.b.enabled;
      bHint.textContent = res.bNote || '';
      bHint.hidden = !res.bNote;
      if (res.needsHistoryWarning) askHistory = true;
      if (res.offerTurnOffA) askOffer = true;
      if (!res.b.enabled || !boxA.checked) askOffer = false;
      histNote.hidden = !askHistory;
      offNote.hidden = !askOffer;
    };
    const run = async (msg) => {
      menu.classList.add('busy');
      try {
        render(await send(msg));
      } catch {
        text.textContent = 'Not checked';
        chip.className = 'chip neutral';
        chip.title = "Couldn't reach the extension. Reload the page.";
        statusLine.textContent = "Couldn't reach the extension. Reload the page.";
      } finally {
        menu.classList.remove('busy');
      }
    };

    const setOpen = (open) => {
      menu.hidden = !open;
      chip.setAttribute('aria-expanded', String(open));
      if (open) run({ type: 'getStatus', fresh: true });
    };
    chip.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
    menu.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

    boxA.addEventListener('change', () => run({ type: 'setA', on: boxA.checked }));
    boxB.addEventListener('change', () => run({ type: 'setB', on: boxB.checked }));
    histYes.addEventListener('click', () => { askHistory = false; run({ type: 'setA', on: true, confirmedHistoryWarning: true }); });
    histNo.addEventListener('click', () => { askHistory = false; run({ type: 'getStatus' }); });
    offYes.addEventListener('click', () => { askOffer = false; run({ type: 'setA', on: false }); });
    offNo.addEventListener('click', () => { askOffer = false; offNote.hidden = true; });

    run({ type: 'getStatus' });
    // Follow changes made from the popup or by the guard.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      // Only react to real changes: every LinkedIn tab hears every write.
      const aChanged = changes.aCheck && (changes.aCheck.oldValue || {}).value !== (changes.aCheck.newValue || {}).value;
      const other = ['bEnabled', 'tripped', 'bConfirmedAt', 'fallbackFailed']
        .some((k) => changes[k] && JSON.stringify(changes[k].oldValue) !== JSON.stringify(changes[k].newValue));
      if ((aChanged || other) && !menu.classList.contains('busy')) { dlog(`storage change ${Object.keys(changes).join(',')}`); run({ type: 'getStatus' }); }
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
  let stopped = false;
  const insert = () => {
    if (stopped) return true;
    const ul = findNavList();
    if (!ul) return false;
    if (toggle && toggle.parentElement === ul) return true; // already in the right place
    dlog(toggle ? 'reinsert' : 'insert');
    toggle = toggle || build();
    ul.append(toggle);
    setTimeout(() => {
      const r = toggle.getBoundingClientRect();
      const cs = getComputedStyle(toggle);
      dlog(`placed at ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} vw=${innerWidth} display=${cs.display} vis=${cs.visibility} inDoc=${document.contains(toggle)} ulItems=${ul.children.length}`);
    }, 2000);
    return true;
  };

  // LinkedIn re-renders its header on in-page navigation; keep the toggle in place.
  // Also moves the label if LinkedIn swaps in a new menu list.
  let pending = false;
  const keepAlive = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; insert(); });
  });

  // Hand the top bar to whichever copy of this script loaded last.
  let finder = null;
  globalThis.qpbClaimNav(document, ID, () => {
    stopped = true;
    keepAlive.disconnect();
    if (finder) finder.disconnect();
    if (toggle) toggle.remove();
  });

  if (insert()) {
    keepAlive.observe(document.body, { childList: true, subtree: true });
    return;
  }
  finder = new MutationObserver(() => {
    if (insert()) {
      finder.disconnect();
      keepAlive.observe(document.body, { childList: true, subtree: true });
    }
  });
  finder.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => finder.disconnect(), FIND_TIMEOUT_MS);
})();
