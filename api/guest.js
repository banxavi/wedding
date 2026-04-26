const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GUEST_FILE = path.join(process.cwd(), 'guests.js');
const LODGING_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1IvNRduh-NVvrsaGTFQXvHHRfSog4uee3b05s0zW_BP4/edit?gid=962239887#gid=962239887';

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

function getGuestAddress(name) {
  const titlePatterns = [
    { pattern: /^(?:a|anh)\s+/i, title: 'anh' },
    { pattern: /^(?:chị|chi)\s+/i, title: 'chị' },
    { pattern: /^(?:thầy|thay)\s+/i, title: 'thầy' }
  ];

  for (const { pattern, title } of titlePatterns) {
    if (pattern.test(name)) {
      return {
        title,
        address: `${title} ${name.replace(pattern, '').trim()}`
      };
    }
  }

  return null;
}

function isFriendGroup(group) {
  return /bạn học|đá banh|tma|dc|xã giao/i.test(group || '');
}

function decodeEncodedGroup(value) {
  if (!value || typeof value !== 'string' || !value.startsWith('enc:')) {
    return value || '';
  }

  try {
    const token = value.slice(4);
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch (_) {
    return '';
  }
}

function decodeGuestGroup(group) {
  return decodeEncodedGroup(group) || group || '';
}

function toPublicGroup(rawGroup) {
  if (typeof rawGroup === 'string' && rawGroup.startsWith('enc:')) {
    return 'Khách mời';
  }
  return decodeGuestGroup(rawGroup) || 'Khách mời';
}

function shouldShowLodgingList(group) {
  const normalizedGroup = decodeGuestGroup(group).trim().toLowerCase();
  return ['dc13', 'dc khác', 'nhơn', 'tma sg'].includes(normalizedGroup);
}

function createGuestInvitation(guest) {
  const isFamily = Number(guest.partySize) >= 2;
  const titledGuest = getGuestAddress(guest.name);
  const decodedGroup = decodeGuestGroup(guest.group);
  const publicGroup = toPublicGroup(guest.group);
  const showLodgingList = shouldShowLodgingList(guest.group);
  const lodgingFileUrl = showLodgingList ? LODGING_SHEET_URL : null;

  if (titledGuest) {
    const displayName = isFamily ? `gia đình ${titledGuest.address}` : titledGuest.address;
    const presenceSubject = isFamily ? `gia đình ${titledGuest.title}` : titledGuest.title;

    return {
      greeting: `Thân mến ${displayName},`,
      invitationMessage: `Chúng em trân trọng kính mời ${displayName} đến chung vui cùng gia đình hai họ trong ngày thành hôn. Sự hiện diện của ${presenceSubject} là niềm vinh hạnh và là lời chúc phúc quý giá dành cho chúng em.`,
      name: guest.name,
      group: publicGroup,
      showAfterParty: false,
      showLodgingList,
      lodgingFileUrl
    };
  }

  const familyName = isFriendGroup(decodedGroup) ? `gia đình bạn ${guest.name}` : `gia đình ${guest.name}`;
  const displayName = isFamily ? familyName : `bạn ${guest.name} + ❤️`;
  const presenceSubject = isFamily && isFriendGroup(decodedGroup) ? 'gia đình bạn' : isFamily ? 'gia đình' : 'bạn';
  const recipientPronoun = isFriendGroup(decodedGroup) ? 'chúng mình' : 'chúng tôi';

  return {
    greeting: `Thân mến ${displayName},`,
    invitationMessage: isFamily
      ? `Trân trọng kính mời ${familyName} đến chung vui cùng gia đình hai họ trong ngày thành hôn. Sự hiện diện của ${presenceSubject} là niềm vinh hạnh và là lời chúc phúc quý giá dành cho ${recipientPronoun}.`
      : `Rất mong bạn đến chung vui cùng gia đình hai họ trong ngày thành hôn. Sự hiện diện của ${presenceSubject} là niềm vinh hạnh và là lời chúc phúc quý giá dành cho ${recipientPronoun}.`,
    name: guest.name,
    group: publicGroup,
    showAfterParty: false,
    showLodgingList,
    lodgingFileUrl
  };
}

module.exports = (req, res) => {
  const slug = String(req.query.guest || '').trim();
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Invalid guest slug' });
  }

  const list = readGuestList();
  const rawGuest = list.find((item) => item.slug === slug);

  if (!rawGuest) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  return res.status(200).json({ guest: createGuestInvitation(rawGuest) });
};
