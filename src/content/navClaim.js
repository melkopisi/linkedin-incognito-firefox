// When the extension reloads or updates, Firefox injects a fresh copy of the
// top-bar script into open LinkedIn tabs, but the old copy's button stays on
// the page. The newest copy owns the top bar: it removes leftover buttons and
// tells any older copy that is still running to stop.
globalThis.qpbClaimNav = (doc, id, onLose) => {
  const EVENT = 'qpb-nav-claim';
  const token = Math.random().toString(36).slice(2);
  for (const el of doc.querySelectorAll(`#${id}`)) el.remove();
  const handler = (e) => {
    if (e.detail === token) return;
    doc.removeEventListener(EVENT, handler);
    onLose();
  };
  doc.addEventListener(EVENT, handler);
  doc.dispatchEvent(new CustomEvent(EVENT, { detail: token }));
};
