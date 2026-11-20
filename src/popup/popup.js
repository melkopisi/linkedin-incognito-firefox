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

  const banner = $('banner');
  banner.hidden = true;
  banner.className = 'banner';
  if (status.level === 'warning') {
    banner.textContent = 'You are currently visible to profiles you view. Turn on Private mode in LinkedIn settings.';
    banner.className = 'banner bad';
    banner.hidden = false;
  } else if (status.badge === '!') {
    banner.textContent = 'View blocking stopped working. The last profile you opened may have seen your visit. Private mode is now on.';
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
    render(await send(msg));
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

run({ type: 'getStatus' });
