// Supabase client initialization & Mock Store for offline/demo execution
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jpvnvjcktpxyxrvsdukm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwdm52amNrdHB4eXhydnNkdWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjczMzAsImV4cCI6MjEwMDIwMzMzMH0.NV9mI29eo5vUuBqTM2N-vd9GepeoD2iIcOZq5ypIqtY';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initial Mock Rooms Data
export const MOCK_ROOMS = [
  { id: 'p1', name: 'Pokoj Turistický P1', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, image: '/hezky pokoj 1.webp' },
  { id: 'p2', name: 'Pokoj Turistický P2', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, image: '/hezky pokoj 1.webp' },
  { id: 'p3', name: 'Pokoj Turistický P3', type: 'turisticky', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, image: '/balkony 1 copy.webp' },
  { id: 'pa', name: 'Pokoj Nadstandard A', type: 'nadstandard', floor: 'prizemi', capacity: 2, extraBeds: 1, basePrice: 890, image: '/hezky pokoj 1.webp' },
  { id: 'p5', name: 'Pokoj Standard P5', type: 'standard', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, image: '/balkony 1 copy.webp' },
  { id: 'p6', name: 'Pokoj Standard P6', type: 'standard', floor: 'prizemi', capacity: 2, extraBeds: 0, basePrice: 830, image: '/hezky pokoj 1.webp' },
  { id: 'p7', name: 'Pokoj Standard P7', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, image: '/desna_41.webp' },
  { id: 'a1', name: 'Pokoj Nadstandard A1', type: 'nadstandard', floor: 'vyhled', capacity: 2, extraBeds: 1, basePrice: 890, image: '/vyhled_z_balkonu.webp' },
  { id: 'zen', name: 'Pokoj Nadstandard Zen', type: 'nadstandard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 890, image: '/vyhled_z_balkonu.webp' },
  { id: 'p10', name: 'Pokoj Standard P10', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, image: '/desna_41.webp' },
  { id: 'p11', name: 'Pokoj Standard P11', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, image: '/desna_41.webp' },
  { id: 'p12', name: 'Pokoj Standard P12', type: 'standard', floor: 'vyhled', capacity: 2, extraBeds: 0, basePrice: 830, image: '/desna_41.webp' },
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
    room_name: 'Pokoj Nadstandard A',
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

// Local Storage Key for Discount Codes
const DISCOUNT_CODES_STORAGE_KEY = 'hotel_umustku_discount_codes_v1';
const INITIAL_MOCK_DISCOUNT_CODES = [
  { id: 'dc-1', code: 'HOTEL5', discount_type: 'percent', discount_value: 5, is_active: true },
  { id: 'dc-2', code: 'HOTEL10', discount_type: 'percent', discount_value: 10, is_active: true }
];

export const getStoredDiscountCodes = () => {
  try {
    const raw = localStorage.getItem(DISCOUNT_CODES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    localStorage.setItem(DISCOUNT_CODES_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_DISCOUNT_CODES));
    return INITIAL_MOCK_DISCOUNT_CODES;
  } catch {
    return INITIAL_MOCK_DISCOUNT_CODES;
  }
};

export const saveStoredDiscountCode = (codeItem) => {
  const current = getStoredDiscountCodes();
  const existingIdx = current.findIndex(c => c.code === codeItem.code || c.id === codeItem.id);
  if (existingIdx >= 0) {
    current[existingIdx] = codeItem;
  } else {
    current.unshift(codeItem);
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
  const filtered = current.filter(c => c.id !== idOrCode && c.code !== idOrCode);
  try {
    localStorage.setItem(DISCOUNT_CODES_STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to delete discount code locally:', err);
  }
  return filtered;
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
    current[existingIdx] = priceItem;
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
