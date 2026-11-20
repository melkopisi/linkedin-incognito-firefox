// Recognises LinkedIn's profile-view tracking event inside request bodies.
// Matching is on content only, never on the URL: LinkedIn's tracking
// endpoints have scrambled names that change.

const concat = (chunks) => {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
};

const gunzip = async (bytes) => {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export async function decodeBody(chunks) {
  try {
    let bytes = concat(chunks);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = await gunzip(bytes);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

export function classifyBody(text, rules) {
  if (rules.viewMarkers.some((m) => text.includes(m))) return 'view-signal';
  if (rules.suspiciousMarkers.some((m) => text.includes(m))) return 'suspicious';
  return 'other';
}

export function extractViewee(text) {
  const m = text.match(/"vieweeMemberUrn"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}
