const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const GUEST_FILE = path.join(ROOT, 'guests.js');
const OUTPUT_DIR = path.join(ROOT, 'files');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'guest-link-mapping.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'guest-link-mapping.json');
const BASE_URL = (process.env.INVITE_BASE_URL || 'https://wedding-us-one.vercel.app').replace(/\/+$/, '');

function readGuestList() {
  const source = fs.readFileSync(GUEST_FILE, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__GUEST_LIST__ = weddingGuestList;`, sandbox, {
    filename: 'guests.js',
    timeout: 1000
  });
  return Array.isArray(sandbox.__GUEST_LIST__) ? sandbox.__GUEST_LIST__ : [];
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toInviteUrl(slug) {
  return `${BASE_URL}/?guest=${encodeURIComponent(slug)}`;
}

function main() {
  const guests = readGuestList();
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const rows = guests.map((guest, index) => ({
    stt: index + 1,
    name: guest.name || '',
    slug: guest.slug || '',
    group: guest.group || '',
    area: guest.area || '',
    inviteUrl: toInviteUrl(guest.slug || '')
  }));

  const header = ['STT', 'Ten khach', 'Slug', 'Group', 'Area', 'Invite URL'];
  const csvLines = [header.join(',')].concat(
    rows.map((row) => [
      row.stt,
      row.name,
      row.slug,
      row.group,
      row.area,
      row.inviteUrl
    ].map(csvEscape).join(','))
  );

  fs.writeFileSync(OUTPUT_CSV, csvLines.join('\n'), 'utf8');
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(rows, null, 2), 'utf8');

  console.log(`Generated ${rows.length} invite links.`);
  console.log(`CSV: ${path.relative(ROOT, OUTPUT_CSV)}`);
  console.log(`JSON: ${path.relative(ROOT, OUTPUT_JSON)}`);
}

main();
