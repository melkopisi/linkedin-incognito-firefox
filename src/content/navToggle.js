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

  function build() {
    const li = document.createElement('li');
    li.id = ID;
    li.style.cssText = 'display:flex;align-items:center;list-style:none;';
    const host = document.createElement('span');
    li.append(host);
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      button { all: unset; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 10px; font: 12px system-ui, sans-serif; color: inherit; opacity: .85; }
      button:hover { opacity: 1; }
      .pill { width: 28px; height: 16px; border-radius: 8px; background: #8c959f; position: relative; transition: background .15s; }
      .pill::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: left .15s; }
      .on .pill { background: #1a7f37; } .on .pill::after { left: 14px; }
      .busy { opacity: .5; pointer-events: none; }`;
    const btn = document.createElement('button');
    btn.type = 'button';
    const pill = document.createElement('span');
    pill.className = 'pill';
    const text = document.createElement('span');
    text.textContent = 'Private';
    btn.append(pill, text);
    root.append(style, btn);

    let on = false;
    const render = (res) => {
      if (!res) return;
      on = res.a.verifiedValue === 'HIDE';
      btn.classList.toggle('on', on);
      btn.title = res.status.label;
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', `Private mode: ${res.status.label}`);
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
      } finally {
        btn.classList.remove('busy');
      }
    };
    btn.addEventListener('click', () => run({ type: 'setA', on: !on }));
    run({ type: 'getStatus' });
    // Follow changes made from the popup or by the guard.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && (changes.aCheck || changes.bEnabled || changes.tripped)) run({ type: 'getStatus' });
    });
    return li;
  }

  let toggle = null;
  const insert = () => {
    if (document.getElementById(ID)) return true;
    const ul = findNavList();
    if (!ul) return false;
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
