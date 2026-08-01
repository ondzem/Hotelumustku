// Supabase client initialization & Mock Store for offline/demo execution
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_URL) || 'https://jpvnvjcktpxyxrvsdukm.supabase.co';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || (typeof process !== 'undefined' && process.env && process.env.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwdm52amNrdHB4eXhydnNkdWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjczMzAsImV4cCI6MjEwMDIwMzMzMH0.NV9mI29eo5vUuBqTM2N-vd9GepeoD2iIcOZq5ypIqtY';

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

const INITIAL_MOCK_RESERVATIONS = [];

export const getStoredReservations = () => {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy mock data (res-seed-* or static demo records)
        const clean = parsed.filter(r => r && r.id && !String(r.id).startsWith('res-seed-'));
        return clean;
      }
    }
    return [];
  } catch {
    return [];
  }
};

const ALLOWED_SUPABASE_COLUMNS = new Set([
  'id', 'code', 'manage_token', 'room_id', 'room_name', 'date_from', 'date_to',
  'adults_count', 'children_count', 'guest_name', 'guest_email', 'guest_phone',
  'guest_note', 'guest_street', 'guest_city', 'guest_zip', 'guest_country', 'guests',
  'has_dog', 'has_ebike', 'ebike_count', 'has_half_board', 'half_board_count',
  'total_price', 'deposit_price', 'remaining_price', 'accommodation_price',
  'city_tax', 'addons_price', 'status', 'created_at'
]);

export function sanitizeReservationForSupabase(raw) {
  if (!raw) return {};
  const sanitized = {};
  for (const key of Object.keys(raw)) {
    if (ALLOWED_SUPABASE_COLUMNS.has(key) && raw[key] !== undefined) {
      sanitized[key] = raw[key];
    }
  }
  if (!sanitized.id) {
    sanitized.id = raw.code || ('res-' + Date.now());
  }

  // Preserve winter parking inside guests list if present
  let guestsArr = Array.isArray(raw.guests) ? [...raw.guests] : [];
  if (raw.has_winter_parking || raw.parking_cars_count) {
    let metaIdx = guestsArr.findIndex(g => g && g._winter_parking !== undefined);
    const winterMeta = {
      has_winter_parking: Boolean(raw.has_winter_parking),
      parking_cars_count: parseInt(raw.parking_cars_count || 1),
      winter_parking_price_total: parseInt(raw.winter_parking_price_total || 0)
    };
    if (metaIdx >= 0) {
      guestsArr[metaIdx] = { ...guestsArr[metaIdx], _winter_parking: winterMeta };
    } else {
      guestsArr.push({ _winter_parking: winterMeta });
    }
  }
  sanitized.guests = guestsArr;
  return sanitized;
}

export const saveStoredReservation = (reservation) => {
  const current = getStoredReservations();
  const existingIdx = current.findIndex(r => (r.id && reservation.id && String(r.id) === String(reservation.id)) || (r.code && reservation.code && String(r.code) === String(reservation.code)));
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...reservation };
  } else {
    current.unshift(reservation);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    }
  } catch (err) {
    console.error('Failed to save reservation locally:', err);
  }

  if (isSupabaseConfigured && supabase) {
    const payload = sanitizeReservationForSupabase(reservation);
    supabase.from('reservations').upsert([payload]).then(({ error }) => {
      if (error) console.error('Supabase async upsert reservation error:', error);
    }).catch(err => console.error('Supabase async upsert exception:', err));
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
    }
  } catch (err) {
    console.error('Failed to update reservation status locally:', err);
  }

  if (isSupabaseConfigured && supabase && id) {
    supabase.from('reservations').update({ status: newStatus }).or(`id.eq.${id},code.eq.${id}`).then(({ error }) => {
      if (error) console.error('Supabase update status error:', error);
    }).catch(err => console.error('Supabase update status exception:', err));
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (err) {
    console.error('Failed to delete reservation locally:', err);
  }

  if (isSupabaseConfigured && supabase && targetStr) {
    supabase.from('reservations').delete().or(`id.eq.${targetStr},code.eq.${targetStr}`).then(({ error }) => {
      if (error) console.error('Supabase delete reservation error:', error);
    }).catch(err => console.error('Supabase delete reservation exception:', err));
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

// Local Storage Key for Custom Room Names
const CUSTOM_ROOM_NAMES_STORAGE_KEY = 'hotel_umustku_custom_room_names_v1';

export const getStoredCustomRoomNames = () => {
  try {
    const raw = localStorage.getItem(CUSTOM_ROOM_NAMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredCustomRoomName = (roomItem) => {
  const current = getStoredCustomRoomNames();
  const existingIdx = current.findIndex(p => p.room_id === roomItem.room_id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...roomItem };
  } else {
    current.push(roomItem);
  }
  try {
    localStorage.setItem(CUSTOM_ROOM_NAMES_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save custom room name locally:', err);
  }

  if (roomItem && roomItem.room_id && (roomItem.room_name || roomItem.name)) {
    const rm = MOCK_ROOMS.find(r => r.id === roomItem.room_id);
    if (rm) {
      rm.name = roomItem.room_name || roomItem.name;
    }
  }
  return roomItem;
};

export const initStoredCustomRoomNamesInMock = () => {
  try {
    const stored = getStoredCustomRoomNames();
    (stored || []).forEach(p => {
      if (p.room_id && (p.room_name || p.name)) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) {
          rm.name = p.room_name || p.name;
        }
      }
    });
  } catch (err) {
    console.error('initStoredCustomRoomNamesInMock failed:', err);
  }
};

initStoredCustomRoomNamesInMock();

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
          if (p.room_name || p.custom_name) rm.name = p.room_name || p.custom_name;
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

// Uložení zprávy z kontaktního formuláře do Supabase databáze
export const saveContactMessage = async (messageData) => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .insert([{
          name: messageData.name,
          surname: messageData.surname,
          email: messageData.email,
          phone: messageData.phone || '',
          message: messageData.message || '',
          status: 'new'
        }])
        .select();

      if (error) {
        console.error('Chyba při ukládání kontaktní zprávy do Supabase:', error);
        return { success: false, error };
      }
      return { success: true, data: data ? data[0] : null };
    } catch (err) {
      console.error('Výjimka při ukládání kontaktní zprávy:', err);
      return { success: false, error: err };
    }
  }
  return { success: true, isMock: true };
};

// ====================================================
// POMOCNÉ FUNKCE PRO PROJEKTOVÝ MODUL "AKTUALITY & OZNAMOVACÍ BANNER"
// ====================================================

// Načtení všech aktualit
export const getStoredNewsItems = async () => {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('aktuality')
        .select('*')
        .order('updated_at', { ascending: false });
      if (!error && data) return data;
    } catch (err) {
      console.error('Chyba při načítání aktualit ze Supabase:', err);
    }
  }
  return [];
};

// Uložení / Úprava aktuality (s vymáháním pravidla: MAXIMÁLNĚ 1 AKTIVNÍ BANNER)
export const saveStoredNewsItem = async (newsPayload) => {
  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Pokud je zapnut is_banner = true, zrušíme banner u všech ostatních
      if (newsPayload.is_banner) {
        await supabase
          .from('aktuality')
          .update({ is_banner: false })
          .eq('is_banner', true);
      }

      const payload = {
        title: newsPayload.title,
        content: newsPayload.content || '',
        banner_text: newsPayload.banner_text || '',
        is_active: Boolean(newsPayload.is_active),
        is_banner: Boolean(newsPayload.is_banner),
        image_url: newsPayload.image_url || null,
        updated_at: new Date().toISOString()
      };

      if (newsPayload.id) {
        const { data, error } = await supabase
          .from('aktuality')
          .update(payload)
          .eq('id', newsPayload.id)
          .select();
        if (error) throw error;
        return { success: true, data: data ? data[0] : null };
      } else {
        const { data, error } = await supabase
          .from('aktuality')
          .insert([payload])
          .select();
        if (error) throw error;
        return { success: true, data: data ? data[0] : null };
      }
    } catch (err) {
      console.error('Chyba při ukládání aktuality v Supabase:', err);
      return { success: false, error: err };
    }
  }
  return { success: false, error: 'Supabase not configured' };
};

// Změna pořadí aktualit (Posun nahoru/dolů)
export const reorderNewsItem = async (id, direction) => {
  if (isSupabaseConfigured && supabase && id) {
    try {
      const items = await getStoredNewsItems();
      const index = items.findIndex(item => String(item.id) === String(id));
      if (index === -1) return { success: false };

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= items.length) return { success: false };

      const currentItem = items[index];
      const targetItem = items[targetIndex];

      const curTime = new Date(currentItem.updated_at).getTime();
      const tarTime = new Date(targetItem.updated_at).getTime();

      let newCurTime = tarTime;
      let newTarTime = curTime;
      if (newCurTime === newTarTime) {
        if (direction === 'up') {
          newCurTime = curTime + 1000;
          newTarTime = curTime - 1000;
        } else {
          newCurTime = curTime - 1000;
          newTarTime = curTime + 1000;
        }
      }

      await supabase.from('aktuality').update({ updated_at: new Date(newCurTime).toISOString() }).eq('id', currentItem.id);
      await supabase.from('aktuality').update({ updated_at: new Date(newTarTime).toISOString() }).eq('id', targetItem.id);

      return { success: true };
    } catch (err) {
      console.error('Chyba při změně pořadí aktuality:', err);
      return { success: false, error: err };
    }
  }
  return { success: false };
};

// Smazání aktuality
export const deleteStoredNewsItem = async (id) => {
  if (isSupabaseConfigured && supabase && id) {
    try {
      const { error } = await supabase
        .from('aktuality')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('Chyba při mazání aktuality v Supabase:', err);
      return { success: false, error: err };
    }
  }
  return { success: false };
};

// Nahrání oříznuté fotky aktuality do Supabase Storage bucketu aktuality-images
export const uploadNewsImage = async (fileOrBlob) => {
  if (isSupabaseConfigured && supabase) {
    try {
      const filename = `news_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
      const { data, error } = await supabase.storage
        .from('aktuality-images')
        .upload(filename, fileOrBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('aktuality-images')
        .getPublicUrl(filename);

      return { success: true, url: publicUrlData.publicUrl };
    } catch (err) {
      console.error('Chyba při nahrávání fotky do aktuality-images storage:', err);
      return { success: false, error: err };
    }
  }
  return { success: false, error: 'Supabase not configured' };
};

// ====================================================
// POMOCNÉ FUNKCE PRO PROJEKTOVÝ MODUL "RECENZE HOSTŮ"
// ====================================================

export const DEFAULT_REVIEWS = [
  { id: 'rev-seed-1', author_name: 'Honza s přáteli', full_name: 'Honza s přáteli', rating: 5, date: '09. 09. 2014', text: 'O prázdninách jsme navštívili s kamarády Jizerské hory a ubytování v hotelu U Můstků bylo super. Určitě pojedeme znovu i v zimě na lyže. Tímto pozdravuji provozovatele.', status: 'approved', created_at: '2014-09-09T12:00:00Z' },
  { id: 'rev-seed-2', author_name: 'Michal a Jitka', full_name: 'Michal a Jitka', rating: 5, date: '24. 07. 2014', text: 'Rodinný hotel v klidném prostředí, výborná domácí kuchyně a příjemní lidé... :-) Parádní dovolená.', status: 'approved', created_at: '2014-07-24T12:00:00Z' },
  { id: 'rev-seed-3', author_name: 'Dana M.', full_name: 'Dana Malá', rating: 5, date: '13. 07. 2014', text: 'S přítelem jsme strávili tři dny a byli jsme velice spokojeni.', status: 'approved', created_at: '2014-07-13T12:00:00Z' },
  { id: 'rev-seed-4', author_name: 'Jana V.', full_name: 'Jana Veselá', rating: 5, date: '31. 05. 2014', text: 'Minulý týden jsme se s rodinou ubytovali v hotelu U Můstků a můžu jenom doporučit. Velice příjemní lidé, výborná domácí kuchyně. Všude čisto. Opravdu doporučit.', status: 'approved', created_at: '2014-05-31T12:00:00Z' },
  { id: 'rev-seed-5', author_name: 'Ilona M.', full_name: 'Ilona Marešová', rating: 5, date: '16. 04. 2014', text: 'Přespali jsme sice jenom jednu noc a musím konstatovat, že jsme spokojeni s přístupem a hlavně nádherně čistě uklizenými pokoji. Snídaně formou bufetu bez sebemenších připomínek.', status: 'approved', created_at: '2014-04-16T12:00:00Z' },
  { id: 'rev-seed-6', author_name: 'Jaroslav K.', full_name: 'Jaroslav Kučera', rating: 5, date: '15. 04. 2014', text: 'Za profesionální přístup personálu a příjemné prostředí palec nahoru. Mohu všem jen doporučit. Zároveň si přeji, aby takto fungovala všechna podobná zařízení v Desné. Majitelům a personálu přeji plno slušných hostů a hodně elánu do jejich další práce.', status: 'approved', created_at: '2014-04-15T12:00:00Z' },
  { id: 'rev-seed-7', author_name: 'Zbyněk V.', full_name: 'Zbyněk Vávra', rating: 5, date: '03. 04. 2014', text: 'Krásné prostředí, příjemná obsluha a výborná domácí kuchyně. Také jsme měli možnost ochutnat domácí uzený bůček a různé dobroty z grilu. Můžu jenom doporučit.', status: 'approved', created_at: '2014-04-03T12:00:00Z' }
];

const REVIEWS_LOCAL_KEY = 'hotel_umustku_reviews_v1';

export function formatGDPRName(nameStr) {
  if (!nameStr || typeof nameStr !== 'string') return 'Host hotelu';
  const clean = nameStr.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

let inMemoryReviews = [...DEFAULT_REVIEWS];

const safeSetLocalStorage = (key, value) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Silently handle QuotaExceededError or storage restrictions
  }
};

export const getStoredReviews = async () => {
  let localReviews = inMemoryReviews;
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(REVIEWS_LOCAL_KEY);
      if (raw) {
        localReviews = JSON.parse(raw);
        inMemoryReviews = localReviews;
      }
    } catch (e) {
      // Fallback to inMemoryReviews if JSON parse fails
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch (err) {
      console.warn('Supabase fetch reviews failed, using local storage:', err);
    }
  }

  return localReviews;
};

export const saveStoredReview = async (reviewPayload) => {
  const gdprAuthor = formatGDPRName(reviewPayload.full_name || reviewPayload.author_name);
  const nowISO = new Date().toISOString();
  const d = new Date();
  const formattedDate = `${String(d.getDate()).padStart(2, '0')}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${d.getFullYear()}`;

  const payload = {
    id: reviewPayload.id || ('rev-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
    full_name: (reviewPayload.full_name || reviewPayload.author_name || '').trim(),
    author_name: gdprAuthor,
    rating: Number(reviewPayload.rating || 5),
    text: (reviewPayload.text || '').trim(),
    date: reviewPayload.date || formattedDate,
    status: reviewPayload.status || 'pending_approval',
    created_at: reviewPayload.created_at || nowISO
  };

  const existingIdx = inMemoryReviews.findIndex(r => r.id === payload.id);
  if (existingIdx !== -1) {
    inMemoryReviews[existingIdx] = { ...inMemoryReviews[existingIdx], ...payload };
  } else {
    inMemoryReviews.unshift(payload);
  }

  // Always save to localStorage
  safeSetLocalStorage(REVIEWS_LOCAL_KEY, inMemoryReviews);

  // Save to Supabase if available
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .insert([payload])
        .select();

      if (!error && data) {
        return { success: true, data: data[0] };
      }
    } catch (err) {
      console.warn('Supabase insert review failed, stored locally:', err);
    }
  }

  return { success: true, data: payload, isLocalOnly: true };
};

export const updateStoredReviewStatus = async (reviewId, status) => {
  if (status === 'rejected') {
    inMemoryReviews = inMemoryReviews.filter(r => r.id !== reviewId);
  } else {
    inMemoryReviews = inMemoryReviews.map(r => r.id === reviewId ? { ...r, status } : r);
  }

  // Update localStorage
  safeSetLocalStorage(REVIEWS_LOCAL_KEY, inMemoryReviews);

  // Update Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      if (status === 'rejected') {
        await supabase.from('reviews').delete().eq('id', reviewId);
      } else {
        await supabase.from('reviews').update({ status }).eq('id', reviewId);
      }
    } catch (err) {
      console.warn('Supabase update review status failed:', err);
    }
  }

  return { success: true };
};

