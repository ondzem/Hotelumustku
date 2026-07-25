// Supabase client initialization & Mock Store for offline/demo execution
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

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

export const getStoredReservations = () => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredReservation = (reservation) => {
  const current = getStoredReservations();
  current.push(reservation);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save reservation locally:', err);
  }
  return reservation;
};
