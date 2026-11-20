// Toolbar popup: a thin view over the background's message API.
const $ = (id) => document.getElementById(id);
const send = (msg) => browser.runtime.sendMessage(msg);

const TRIP_TEXT = {
  'missed-block': 'View blocking missed a profile visit',
  'unrecognised-report': 'LinkedIn sent a view report the extension did not recognise',
};

function render(res) {
  if (!res) return;
  const { status, a, b, tripLog } = res;
  $('dot').className = `dot ${status.level}`;
  $('label').textContent = status.label;
  $('toggleA').checked = a.verifiedValue === 'HIDE';
  $('toggleB').checked = b.enabled;
  $('bNote').textContent = res.bNote || '';
  $('bNote').hidden = !res.bNote;

  const banner = $('banner');
  banner.hidden = true;
  banner.className = 'banner';
  if (status.level === 'warning') {
    banner.textContent = 'You are currently visible to profiles you view. Turn on Private mode in LinkedIn settings.';
    banner.className = 'banner bad';
    banner.hidden = false;
  } else if (status.badge === '!') {
    banner.textContent = a.verifiedValue === 'HIDE'
      ? 'View blocking stopped working. The last profile you opened may have seen your visit. Private mode is now on.'
      : 'View blocking stopped working, and Private mode is off — you are visible to profiles you view.';
    banner.className = 'banner bad';
    banner.hidden = false;
  }

  $('historyWarning').hidden = !res.needsHistoryWarning;
  $('offerOffA').hidden = !res.offerTurnOffA;

  const list = $('logList');
  list.replaceChildren();
  for (const e of [...(tripLog || [])].reverse().slice(0, 10)) {
    const li = document.createElement('li');
    li.textContent = `${new Date(e.time).toLocaleString()} — ${TRIP_TEXT[e.reason] || e.reason}${e.path ? ` (${e.path})` : ''}`;
    list.append(li);
  }
  $('log').hidden = !tripLog || tripLog.length === 0;
}

async function run(msg) {
  $('toggleA').disabled = true;
  $('toggleB').disabled = true;
  try {
    const res = await send(msg);
    if (!res) throw new Error('No answer from the extension background');
    render(res);
  } catch (err) {
    $('dot').className = 'dot unknown';
    $('label').textContent = 'Error';
    const banner = $('banner');
    banner.textContent = `Couldn’t reach the extension: ${err && err.message ? err.message : err}`;
    banner.className = 'banner bad';
    banner.hidden = false;
  } finally {
    $('toggleA').disabled = false;
    $('toggleB').disabled = false;
  }
}

$('toggleA').addEventListener('change', (e) => run({ type: 'setA', on: e.target.checked }));
$('toggleB').addEventListener('change', (e) => run({ type: 'setB', on: e.target.checked }));
$('confirmA').addEventListener('click', () => run({ type: 'setA', on: true, confirmedHistoryWarning: true }));
$('cancelA').addEventListener('click', () => run({ type: 'getStatus' }));
$('offAYes').addEventListener('click', () => run({ type: 'setA', on: false }));
$('offANo').addEventListener('click', () => { $('offerOffA').hidden = true; });

// Show the remembered status at once, then confirm with LinkedIn.
(async () => {
  await run({ type: 'getStatus' });
  const label = $('label');
  if (label.textContent !== 'Error') label.textContent += ' · re-checking…';
  await run({ type: 'getStatus', fresh: true });
})();
