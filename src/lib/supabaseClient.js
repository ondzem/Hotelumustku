// Supabase client initialization & Mock Store for offline/demo execution
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jpvnvjcktpxyxrvsdukm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwdm52amNrdHB4eXhydnNkdWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjczMzAsImV4cCI6MjEwMDIwMzMzMH0.NV9mI29eo5vUuBqTM2N-vd9GepeoD2iIcOZq5ypIqtY';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initial Mock Rooms Data
// Initial Mock Rooms Data with Dual-Rate Pricing (Weekday vs Weekend)
export const MOCK_ROOMS = [
  { id: 'p6', name: 'Pokoj Standard P1', type: 'standard', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/hezky pokoj 1.webp' },
  { id: 'p5', name: 'Pokoj Standard P2', type: 'standard', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/pokoje/p5/1.webp' },
  { id: 'pa', name: 'Pokoj Nadstandard Mahagon', type: 'nadstandard', floor: 'prizemi', capacity: 2, extraBeds: 1, basePrice: 890, weekdayPrice: 890, weekendPrice: 990, image: '/pokoje/mahagon/1.webp' },
  { id: 'p3', name: 'Pokoj Turistický P4', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, isDisabled: true, image: '/balkony 1 copy.webp' },
  { id: 'p2', name: 'Pokoj Turistický P5', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, isDisabled: true, image: '/hezky pokoj 1.webp' },
  { id: 'p1', name: 'Pokoj Turistický P6', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, isDisabled: true, image: '/hezky pokoj 1.webp' },
  { id: 'p7', name: 'Pokoj Standard P7', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/pokoje/p7/1.webp' },
  { id: 'a1', name: 'Pokoj Nadstandard Motýl', type: 'nadstandard', floor: 'vyhled', capacity: 2, extraBeds: 1, basePrice: 890, weekdayPrice: 890, weekendPrice: 990, image: '/pokoje/motyl/1.webp' },
  { id: 'zen', name: 'Pokoj Nadstandard Zen', type: 'nadstandard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 890, weekdayPrice: 890, weekendPrice: 990, image: '/pokoje/zen/1.webp' },
  { id: 'p10', name: 'Pokoj Standard P10', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/pokoje/p10/1.webp' },
  { id: 'p11', name: 'Pokoj Standard P11', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/pokoje/p11/1.webp' },
  { id: 'p12', name: 'Pokoj Standard P12', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, weekdayPrice: 830, weekendPrice: 890, image: '/pokoje/p12/1.webp' },
];

// Local Storage / Memory Reservations Store
const LOCAL_STORAGE_KEY = 'hotel_umustku_reservations_v1';

const INITIAL_MOCK_RESERVATIONS = [
  {
    id: 'res-seed-1',
    code: 'HM-2026-101',
    room_id: 'p5',
    room_name: 'Pokoj Standard P5',
    date_from: '2026-08-05',
    date_to: '2026-08-08',
    guest_name: 'Jan Novák',
    guest_email: 'jan.novak@seznam.cz',
    guest_phone: '+420 777 123 456',
    adults_count: 2,
    children_count: 0,
    total_price: 4980,
    deposit_price: 1494,
    remaining_price: 3486,
    status: 'pending_approval', // 1. Fáze: Čeká na schválení recepcí
    created_at: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'res-seed-2',
    code: 'HM-2026-102',
    room_id: 'pa',
    room_name: 'Pokoj Nadstandard Mahagon',
    date_from: '2026-08-12',
    date_to: '2026-08-15',
    guest_name: 'Petr Svoboda',
    guest_email: 'petr.svoboda@email.cz',
    guest_phone: '+420 608 987 654',
    adults_count: 2,
    children_count: 0,
    total_price: 5340,
    deposit_price: 1602,
    remaining_price: 3738,
    status: 'awaiting_deposit', // 2. Fáze: Čeká na úhradu 30% zálohy
    created_at: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'res-seed-3',
    code: 'HM-2026-103',
    room_id: 'p1',
    room_name: 'Pokoj Turistický P1',
    date_from: '2026-08-02',
    date_to: '2026-08-06',
    guest_name: 'Marie Dvořáková',
    guest_email: 'marie.dvorakova@post.cz',
    guest_phone: '+420 732 111 222',
    adults_count: 2,
    children_count: 0,
    total_price: 6640,
    deposit_price: 1992,
    remaining_price: 4648,
    status: 'confirmed', // 3. Fáze: Závazně potvrzeno & zaplaceno
    created_at: new Date(Date.now() - 172800000).toISOString()
  }
];

export const getStoredReservations = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_RESERVATIONS));
    return INITIAL_MOCK_RESERVATIONS;
  } catch {
    return INITIAL_MOCK_RESERVATIONS;
  }
};

export const saveStoredReservation = (reservation) => {
  const current = getStoredReservations();
  current.unshift(reservation);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save reservation locally:', err);
  }
  return reservation;
};

export const updateStoredReservationStatus = (id, newStatus) => {
  const current = getStoredReservations();
  const target = current.find(r => r.id === id || r.code === id || (r.id && id && String(r.id) === String(id)) || (r.code && id && String(r.code) === String(id)));
  if (target) {
    target.status = newStatus;
  } else if (current.length > 0 && (id === undefined || id === 'undefined')) {
    current[0].status = newStatus;
  }
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to update reservation status locally:', err);
  }
  return target || current[0];
};

export const deleteStoredReservation = (targetIdOrCode) => {
  if (!targetIdOrCode) return getStoredReservations();
  const current = getStoredReservations();
  const targetStr = String(targetIdOrCode).trim();
  const filtered = current.filter(r => {
    const rId = r.id ? String(r.id).trim() : '';
    const rCode = r.code ? String(r.code).trim() : '';
    return rId !== targetStr && rCode !== targetStr;
  });
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete reservation locally:', err);
  }
  return filtered;
};

// Local Storage Key for Blocked Dates
const BLOCKED_DATES_STORAGE_KEY = 'hotel_umustku_blocked_dates_v1';

export const getStoredBlockedDates = () => {
  try {
    const raw = localStorage.getItem(BLOCKED_DATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredBlockedDate = (blockedItem) => {
  const current = getStoredBlockedDates();
  current.unshift(blockedItem);
  try {
    localStorage.setItem(BLOCKED_DATES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save blocked date locally:', err);
  }
  return blockedItem;
};

export const deleteStoredBlockedDate = (id) => {
  const current = getStoredBlockedDates();
  const filtered = current.filter(b => b.id !== id && String(b.id) !== String(id));
  try {
    localStorage.setItem(BLOCKED_DATES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete blocked date locally:', err);
  }
  return filtered;
};

// Local Storage Key for Discount Codes & Device Anti-Abuse Tracking
const DISCOUNT_CODES_STORAGE_KEY = 'hotel_umustku_discount_codes_v1';
const DEVICE_USED_DISCOUNTS_STORAGE_KEY = 'hotel_umustku_used_discounts_v1';

const INITIAL_MOCK_DISCOUNT_CODES = [
  { id: 'dc-0', code: 'POBYT5', discount_type: 'percent', discount_value: 5, valid_from: null, valid_until: null, max_uses: null, used_count: 0, is_active: true },
  { id: 'dc-1', code: 'HOTEL5', discount_type: 'percent', discount_value: 5, valid_from: null, valid_until: null, max_uses: null, used_count: 0, is_active: true },
  { id: 'dc-2', code: 'HOTEL10', discount_type: 'percent', discount_value: 10, valid_from: null, valid_until: null, max_uses: null, used_count: 0, is_active: true }
];

export const getStoredDiscountCodes = () => {
  try {
    const raw = localStorage.getItem(DISCOUNT_CODES_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [...INITIAL_MOCK_DISCOUNT_CODES];
    if (!list.some(c => c.code === 'POBYT5')) {
      list.unshift({ id: 'dc-0', code: 'POBYT5', discount_type: 'percent', discount_value: 5, valid_from: null, valid_until: null, max_uses: null, used_count: 0, is_active: true });
      localStorage.setItem(DISCOUNT_CODES_STORAGE_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return INITIAL_MOCK_DISCOUNT_CODES;
  }
};

export const saveStoredDiscountCode = (codeItem) => {
  const current = getStoredDiscountCodes();
  const cleanCode = String(codeItem.code || '').toUpperCase().trim();
  const existingIdx = current.findIndex(c => (c.code && String(c.code).toUpperCase().trim() === cleanCode) || (codeItem.id && c.id === codeItem.id));

  if (existingIdx >= 0) {
    const existing = current[existingIdx];
    const merged = {
      ...existing,
      ...codeItem,
      valid_from: codeItem.valid_from !== undefined ? codeItem.valid_from : (existing.valid_from || null),
      valid_until: codeItem.valid_until !== undefined ? codeItem.valid_until : (existing.valid_until || null),
      max_uses: (codeItem.max_uses !== undefined && codeItem.max_uses !== null) ? Number(codeItem.max_uses) : (existing.max_uses || null),
      used_count: (codeItem.used_count !== undefined && codeItem.used_count !== null) ? Number(codeItem.used_count) : Number(existing.used_count || 0)
    };
    current[existingIdx] = merged;
  } else {
    const newObj = {
      valid_from: null,
      valid_until: null,
      max_uses: null,
      used_count: 0,
      is_active: true,
      ...codeItem
    };
    current.unshift(newObj);
  }
  try {
    localStorage.setItem(DISCOUNT_CODES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save discount code locally:', err);
  }
  return codeItem;
};

export const deleteStoredDiscountCode = (idOrCode) => {
  const current = getStoredDiscountCodes();
  const clean = String(idOrCode || '').toUpperCase().trim();
  const filtered = current.filter(c => c.id !== idOrCode && String(c.code || '').toUpperCase().trim() !== clean);
  try {
    localStorage.setItem(DISCOUNT_CODES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete discount code locally:', err);
  }
  return filtered;
};

// Device Redemption Tracker (Anti-abuse protection preventing same browser from reusing discount)
export const getDeviceRedeemedDiscountCodes = () => {
  try {
    const raw = localStorage.getItem(DEVICE_USED_DISCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const markDiscountCodeRedeemedOnDevice = (codeStr) => {
  if (!codeStr) return;
  const cleanCode = String(codeStr).toUpperCase().trim();
  const current = getDeviceRedeemedDiscountCodes();
  if (!current.includes(cleanCode)) {
    current.push(cleanCode);
    try {
      localStorage.setItem(DEVICE_USED_DISCOUNTS_STORAGE_KEY, JSON.stringify(current));
    } catch (err) {
      console.error('Failed to save device redemption history:', err);
    }
  }
};

export const incrementDiscountCodeUsage = async (codeIdOrStr) => {
  if (!codeIdOrStr) return;
  const cleanCode = String(codeIdOrStr).toUpperCase().trim();

  // 1. Update Supabase directly if connected
  if (isSupabaseConfigured && supabase) {
    try {
      let { data: dbItem } = await supabase
        .from('discount_codes')
        .select('*')
        .eq('code', cleanCode)
        .maybeSingle();

      if (!dbItem && codeIdOrStr && String(codeIdOrStr).includes('-')) {
        const { data: byId } = await supabase
          .from('discount_codes')
          .select('*')
          .eq('id', codeIdOrStr)
          .maybeSingle();
        dbItem = byId;
      }

      if (dbItem) {
        const newUsedCount = Number(dbItem.used_count || 0) + 1;
        const maxUsesNum = (dbItem.max_uses !== null && dbItem.max_uses !== undefined && dbItem.max_uses !== '') ? Number(dbItem.max_uses) : null;
        const newIsActive = maxUsesNum !== null ? (newUsedCount < maxUsesNum) : (dbItem.is_active !== false);

        await supabase
          .from('discount_codes')
          .update({
            used_count: newUsedCount,
            is_active: newIsActive
          })
          .eq('id', dbItem.id);

        saveStoredDiscountCode({
          ...dbItem,
          used_count: newUsedCount,
          is_active: newIsActive
        });
        return;
      }
    } catch (err) {
      console.error('Failed to update discount code in Supabase:', err);
    }
  }

  // 2. Fallback to local storage
  const currentCodes = getStoredDiscountCodes();
  const target = currentCodes.find(c => c.id === codeIdOrStr || String(c.code).toUpperCase().trim() === cleanCode);
  if (target) {
    target.used_count = (Number(target.used_count) || 0) + 1;
    if (target.max_uses !== null && target.max_uses !== undefined && target.max_uses !== '' && target.used_count >= Number(target.max_uses)) {
      target.is_active = false;
    }
    saveStoredDiscountCode(target);
  }
};

export const decrementDiscountCodeUsage = async (codeIdOrStr) => {
  if (!codeIdOrStr) return;
  const cleanCode = String(codeIdOrStr).toUpperCase().trim();
  const currentCodes = getStoredDiscountCodes();
  const target = currentCodes.find(c => c.id === codeIdOrStr || String(c.code).toUpperCase().trim() === cleanCode);
  if (!target) return;

  target.used_count = Math.max(0, (Number(target.used_count) || 1) - 1);
  if (target.max_uses !== null && target.max_uses !== undefined && target.max_uses !== '' && target.used_count < Number(target.max_uses)) {
    target.is_active = true;
  }

  saveStoredDiscountCode(target);

  if (isSupabaseConfigured && supabase) {
    try {
      const codeVal = target.code || cleanCode;
      await supabase.from('discount_codes').update({
        used_count: target.used_count,
        is_active: target.is_active
      }).eq('code', codeVal);
    } catch (err) {
      console.error('Failed to decrement discount usage in Supabase:', err);
    }
  }
};

// Local Storage Key for Room Prices
const ROOM_PRICES_STORAGE_KEY = 'hotel_umustku_room_prices_v1';

export const getStoredRoomPrices = () => {
  try {
    const raw = localStorage.getItem(ROOM_PRICES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredRoomPrice = (priceItem) => {
  const current = getStoredRoomPrices();
  const existingIdx = current.findIndex(p => p.room_id === priceItem.room_id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...priceItem };
  } else {
    current.push(priceItem);
  }
  try {
    localStorage.setItem(ROOM_PRICES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save room price locally:', err);
  }
  return priceItem;
};

export const initStoredRoomPricesInMock = () => {
  try {
    const stored = getStoredRoomPrices();
    (stored || []).forEach(p => {
      const priceVal = Number(p.base_price || p.basePrice || p.weekday_price || p.weekdayPrice);
      const weekdayVal = Number(p.weekday_price || p.weekdayPrice || priceVal);
      const weekendVal = Number(p.weekend_price || p.weekendPrice || priceVal);

      if (p.room_id) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) {
          if (!isNaN(priceVal) && priceVal > 0) rm.basePrice = priceVal;
          if (!isNaN(weekdayVal) && weekdayVal > 0) rm.weekdayPrice = weekdayVal;
          if (!isNaN(weekendVal) && weekendVal > 0) rm.weekendPrice = weekendVal;
        }
      }
    });
  } catch (err) {
    console.error('initStoredRoomPricesInMock failed:', err);
  }
};

initStoredRoomPricesInMock();

// Local Storage Key for Disabled Rooms
const DISABLED_ROOMS_STORAGE_KEY = 'hotel_umustku_disabled_rooms_v1';

export const getStoredDisabledRooms = () => {
  try {
    const raw = localStorage.getItem(DISABLED_ROOMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredDisabledRoom = (roomItem) => {
  const current = getStoredDisabledRooms();
  const existingIdx = current.findIndex(r => r.room_id === roomItem.room_id);
  if (existingIdx >= 0) {
    current[existingIdx] = roomItem;
  } else {
    current.push(roomItem);
  }
  try {
    localStorage.setItem(DISABLED_ROOMS_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save disabled room locally:', err);
  }
  return roomItem;
};

export const initStoredDisabledRoomsInMock = () => {
  try {
    const stored = getStoredDisabledRooms();
    (stored || []).forEach(p => {
      if (p.room_id) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.isDisabled = Boolean(p.is_disabled);
      }
    });
  } catch (err) {
    console.error('initStoredDisabledRoomsInMock failed:', err);
  }
};

initStoredDisabledRoomsInMock();
