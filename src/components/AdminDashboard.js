import { MOCK_ROOMS, getStoredReservations, updateStoredReservationStatus, toggleStoredReservationArchive, deleteStoredReservation, getStoredBlockedDates, saveStoredBlockedDate, deleteStoredBlockedDate, getStoredDiscountCodes, saveStoredDiscountCode, deleteStoredDiscountCode, getStoredRoomPrices, saveStoredRoomPrice, getStoredCustomRoomNames, saveStoredCustomRoomName, getStoredDisabledRooms, saveStoredDisabledRoom, getStoredNewsItems, saveStoredNewsItem, deleteStoredNewsItem, reorderNewsItem, uploadNewsImage, isSupabaseConfigured, supabase, getStoredReviews, updateStoredReviewStatus, getStoredCenik, fetchCenik, doplnPriznakyZeStarychDat, ocistiHosty } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateSpaydQrUrl, BANK_ACCOUNT, formatCzechPrice, getVariableSymbol, procentoZalohy } from '../utils/pricing.js';
import { sendEmail, generateEmail2ApprovalAndPaymentRequest, generateEmail3FinalConfirmation, generateEmailCancellation, getEmailLogs, sendAllTestEmailsTo } from '../utils/emailService.js';
import { checkAndProcessExpiredUnpaidReservations } from '../utils/reservationExpiryService.js';
import { printReservationSheet } from '../utils/printReservationService.js';
import { renderCenikModal, bindCenikModal } from './AdminCenik.js';
import { renderRucniRezervaceModal, bindRucniRezervaceModal, prazdnaRucniRezervace } from './AdminRucniRezervace.js';
import { renderDostupnostModal, bindDostupnostModal, prazdnyPrehled } from './AdminDostupnost.js';

function formatCzechDateStr(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parseInt(parts[2], 10)}. ${parseInt(parts[1], 10)}. ${parts[0]}`;
  }
  return dateStr;
}

function getDiscountValidityDisplay(validFrom, validUntil) {
  if (validFrom && validUntil) {
    return `${formatCzechDateStr(validFrom)} – ${formatCzechDateStr(validUntil)}`;
  } else if (validFrom) {
    return `od ${formatCzechDateStr(validFrom)}`;
  } else if (validUntil) {
    return `do ${formatCzechDateStr(validUntil)}`;
  }
  return '';
}

/**
 * Posune datum ve tvaru YYYY-MM-DD o daný počet dnů.
 * Počítá v UTC, aby letní čas neposunul výsledek o den.
 */
function posunDatum(datumStr, dny) {
  const [r, m, d] = String(datumStr).split('-').map(Number);
  const dt = new Date(Date.UTC(r, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dny);
  return dt.toISOString().split('T')[0];
}

/**
 * Vypíše blokaci lidsky. V databázi je date_to výlučné (první neblokovaný
 * den), obsluze se ale ukazuje poslední SKUTEČNĚ blokovaný den.
 */
function zobrazRozsahBlokace(dateFrom, dateTo) {
  if (!dateFrom) return '';
  const posledni = dateTo ? posunDatum(dateTo, -1) : dateFrom;
  if (posledni === dateFrom) {
    return formatCzechDateStr(dateFrom) + ' (1 den)';
  }
  const [r1, m1, d1] = dateFrom.split('-').map(Number);
  const [r2, m2, d2] = posledni.split('-').map(Number);
  const pocet = Math.round((Date.UTC(r2, m2 - 1, d2) - Date.UTC(r1, m1 - 1, d1)) / 86400000) + 1;
  return `${formatCzechDateStr(dateFrom)} – ${formatCzechDateStr(posledni)} (${pocet} dnů)`;
}

const ADMIN_SESSION_KEY = 'hotel_mustku_admin_auth_v1';

export class AdminDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isAuthenticated = (typeof localStorage !== 'undefined' && localStorage.getItem(ADMIN_SESSION_KEY) === 'true');
    this.passwordInput = '';
    this.loginError = false;
    this.reservations = [];
    this.blockedDates = [];
    this.discountCodes = getStoredDiscountCodes();
    this.roomPrices = getStoredRoomPrices();
    (this.roomPrices || []).forEach(p => {
      const priceVal = Number(p.base_price || p.basePrice);
      if (p.room_id && !isNaN(priceVal) && priceVal > 0) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.basePrice = priceVal;
      }
    });
    this.showDiscountModal = false;
    this.showPricesModal = false;

    // Ceník — sezóny, ceny podle počtu osob, výjimky, příplatky.
    // Okno je průvodce, cenikKrok drží, na které obrazovce uživatel je.
    this.cenik = getStoredCenik();
    this.cenikKrok = 'rozcestnik';
    this.cenikSezonaId = null;
    this.cenikVyjimkyOtevrene = false;
    this.showDisabledRoomsModal = false;
    this.disabledRooms = getStoredDisabledRooms();
    this.showConfirmRoomBlockModal = false;
    this.pendingRoomBlock = null;
    this.showRucniModal = false;
    this.showPrehledModal = false;
    this.prehled = prazdnyPrehled();
    this.rucniRezervace = prazdnaRucniRezervace();
    this.rucniChyba = '';
    this.rucniKolize = false;
    (this.disabledRooms || []).forEach(p => {
      if (p.room_id) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.isDisabled = Boolean(p.is_disabled);
      }
    });
    this.newDiscountForm = { code: '', discount_value: '', discount_type: 'percent', valid_from: '', valid_until: '', max_uses: '' };
    this.showAdminCalendarModal = false;
    this.adminActiveDateField = 'valid_from';
    this.adminCalYearMonth = null;
    this.tempValidFrom = '';
    this.tempValidUntil = '';
    this.selectedRoomFilter = 'all';
    this.statusFilter = 'all';
    this.expandedReservationId = null;
    this.activeEmailPreview = null;
    this.showEmailModal = false;
    this.adminToastMessage = '';
    this.showDeleteModal = false;
    this.pendingDeleteReservation = null;
    this.showNewsModal = false;
    this.newsItems = [];
    this.editingNewsItem = null;
    this.newsForm = { title: '', banner_text: '', content: '', is_active: true, is_banner: false, image_url: '' };
    this.showCropModal = false;
    this.cropImageSrc = null;
    this.showReviewsModal = false;
    this.showDeleteReviewModal = false;
    this.pendingDeleteReview = null;
    this.reviews = [];
    this.reviewsTab = 'pending';
  }

  async init() {
    this.render();
    try {
      await Promise.allSettled([
        this.fetchReservations(),
        this.fetchBlockedDates(),
        this.fetchDiscountCodes(),
        this.fetchRoomPrices(),
        this.fetchDisabledRooms(),
        this.fetchNewsItems(),
        this.fetchReviews()
      ]);
    } catch (err) {
      console.error('AdminDashboard init fetch error:', err);
    }
    this.render();
  }

  async fetchReviews() {
    try {
      this.reviews = await getStoredReviews();
    } catch (err) {
      console.error('AdminDashboard fetchReviews error:', err);
    }
  }

  async fetchNewsItems() {
    try {
      this.newsItems = await getStoredNewsItems();
    } catch (err) {
      console.error('fetchNewsItems error:', err);
    }
  }

  async fetchDiscountCodes() {
    let localCodes = getStoredDiscountCodes();
    const localMap = new Map();
    localCodes.forEach(c => {
      if (c.code) localMap.set(String(c.code).trim().toUpperCase(), c);
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          const remoteCodes = data.map(remoteItem => {
            const cleanCode = String(remoteItem.code || '').trim().toUpperCase();
            const localItem = localMap.get(cleanCode) || {};
            return {
              ...localItem,
              ...remoteItem,
              code: cleanCode,
              valid_from: (remoteItem.valid_from) ? remoteItem.valid_from : (localItem.valid_from || null),
              valid_until: (remoteItem.valid_until) ? remoteItem.valid_until : (localItem.valid_until || null),
              max_uses: (remoteItem.max_uses !== undefined && remoteItem.max_uses !== null && remoteItem.max_uses !== '') ? Number(remoteItem.max_uses) : (localItem.max_uses !== undefined && localItem.max_uses !== null ? Number(localItem.max_uses) : null),
              used_count: (remoteItem.used_count !== undefined && remoteItem.used_count !== null) ? Number(remoteItem.used_count) : Number(localItem.used_count || 0)
            };
          });

          this.discountCodes = remoteCodes;
          try {
            localStorage.setItem('hotel_umustku_discount_codes_v1', JSON.stringify(remoteCodes));
          } catch (e) {
            console.error('Failed to sync discount codes to localStorage:', e);
          }
          return;
        }
      } catch (err) {
        console.error('Supabase fetchDiscountCodes failed:', err);
      }
    }
    this.discountCodes = localCodes;
  }

  async addDiscountCode(code, discount_value, discount_type = 'percent', valid_from = null, valid_until = null, max_uses = null) {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return;

    const parsedMaxUses = (max_uses !== null && max_uses !== undefined && max_uses !== '') ? Number(max_uses) : null;

    const payload = {
      id: 'dc-' + Date.now(),
      code: cleanCode,
      discount_type: discount_type || 'percent',
      discount_value: discount_value !== '' ? Number(discount_value) : 5,
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      max_uses: parsedMaxUses,
      used_count: 0,
      is_active: true,
      created_at: new Date().toISOString()
    };

    saveStoredDiscountCode(payload);
    const existingIdx = (this.discountCodes || []).findIndex(c => c.code === cleanCode);
    if (existingIdx >= 0) {
      this.discountCodes[existingIdx] = { ...this.discountCodes[existingIdx], ...payload };
    } else {
      this.discountCodes.unshift(payload);
    }

    this.showAdminToast(`Slevový kód ${cleanCode} (-${payload.discount_value} %) byl vytvořen.`);
    this.newDiscountForm = { code: '', discount_value: '', discount_type: 'percent', valid_from: '', valid_until: '', max_uses: '' };
    this.showDiscountModal = true;
    this.render();

    if (isSupabaseConfigured && supabase) {
      try {
        const dbPayload = {
          code: cleanCode,
          discount_type: discount_type || 'percent',
          discount_value: payload.discount_value,
          valid_from: valid_from || null,
          valid_until: valid_until || null,
          max_uses: parsedMaxUses,
          used_count: 0,
          is_active: true,
          created_at: payload.created_at
        };
        const { error: fullError } = await supabase.from('discount_codes').upsert([dbPayload], { onConflict: 'code' });
        if (fullError) {
          console.warn('Supabase addDiscountCode full payload warning:', fullError.message);
        }
      } catch (err) {
        console.error('Supabase addDiscountCode failed:', err);
      }
    }
  }

  async toggleDiscountCodeActive(idOrCode, newStatus) {
    const item = this.discountCodes.find(c => c.id === idOrCode || c.code === idOrCode);
    if (!item) return;

    item.is_active = newStatus;
    saveStoredDiscountCode(item);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('discount_codes').update({ is_active: newStatus }).eq('code', item.code);
      } catch (err) {
        console.error('Supabase toggleDiscountCodeActive failed:', err);
      }
    }

    this.showDiscountModal = true;
    this.render();
  }

  async deleteDiscountCode(idOrCode) {
    const item = (this.discountCodes || []).find(c => c.id === idOrCode || c.code === idOrCode || String(c.code).toUpperCase().trim() === String(idOrCode).toUpperCase().trim());
    const codeToDelete = item ? item.code : idOrCode;
    const cleanCode = String(codeToDelete || '').toUpperCase().trim();

    deleteStoredDiscountCode(idOrCode);
    if (codeToDelete) deleteStoredDiscountCode(codeToDelete);

    this.discountCodes = (this.discountCodes || []).filter(c => c.id !== idOrCode && c.code !== idOrCode && String(c.code).toUpperCase().trim() !== cleanCode);

    if (isSupabaseConfigured && supabase && cleanCode) {
      try {
        await supabase.from('discount_codes').delete().or(`code.eq.${cleanCode},code.eq.${cleanCode.toLowerCase()}`);
      } catch (err) {
        console.error('Supabase deleteDiscountCode failed:', err);
      }
    }

    this.showAdminToast('Slevový kód byl vymazán.');
    this.showDiscountModal = true;
    this.render();
  }

  async fetchRoomPrices() {
    let localPrices = getStoredRoomPrices();
    const priceMap = new Map();
    localPrices.forEach(p => priceMap.set(p.room_id, p));

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('room_prices').select('*');
        if (!error && data && data.length > 0) {
          data.forEach(remoteItem => {
            const localItem = priceMap.get(remoteItem.room_id) || {};
            const localCas = localItem.updated_at ? Date.parse(localItem.updated_at) : 0;
            const remoteCas = remoteItem.updated_at ? Date.parse(remoteItem.updated_at) : 0;

            // Novější záznam přebíjí starší
            const mergedItem = remoteCas >= localCas
              ? { ...localItem, ...remoteItem }
              : { ...remoteItem, ...localItem };

            const merged = {
              ...mergedItem,
              weekday_price: Number(mergedItem.weekday_price || mergedItem.base_price || 830),
              weekend_price: Number(mergedItem.weekend_price || mergedItem.base_price || 890),
              base_price: Number(mergedItem.base_price || 830)
            };
            priceMap.set(remoteItem.room_id, merged);
          });
        }
      } catch (err) {
        console.error('Supabase fetchRoomPrices failed:', err);
      }
    }

    this.roomPrices = Array.from(priceMap.values());

    (this.roomPrices || []).forEach(p => {
      const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
      if (rm) {
        if (p.room_name) rm.name = p.room_name;
        if (p.weekday_price) rm.weekdayPrice = Number(p.weekday_price);
        if (p.weekend_price) rm.weekendPrice = Number(p.weekend_price);
        if (p.base_price) rm.basePrice = Number(p.base_price);
      }
      saveStoredRoomPrice(p);
    });
  }

  async updateRoomNameAndPrice(roomId, newName, newWeekdayPrice, newWeekendPrice) {
    const weekdayNum = Number(newWeekdayPrice);
    const weekendNum = Number(newWeekendPrice || newWeekdayPrice);
    if (!roomId) return;

    const trimmedName = newName ? String(newName).trim() : '';

    const rm = MOCK_ROOMS.find(r => r.id === roomId);
    if (rm && trimmedName) {
      rm.name = trimmedName;
      saveStoredCustomRoomName({ room_id: roomId, room_name: trimmedName, name: trimmedName });
    }

    const fullPayload = {
      room_id: roomId,
      room_name: trimmedName || (rm ? rm.name : ''),
      base_price: !isNaN(weekdayNum) && weekdayNum > 0 ? weekdayNum : (rm ? rm.basePrice : 830),
      weekday_price: !isNaN(weekdayNum) && weekdayNum > 0 ? weekdayNum : (rm ? rm.weekdayPrice : 830),
      weekend_price: !isNaN(weekendNum) && weekendNum > 0 ? weekendNum : (rm ? rm.weekendPrice : 890),
      updated_at: new Date().toISOString()
    };

    saveStoredRoomPrice(fullPayload);
    const existingIdx = (this.roomPrices || []).findIndex(p => p.room_id === roomId);
    if (existingIdx >= 0) {
      this.roomPrices[existingIdx] = { ...this.roomPrices[existingIdx], ...fullPayload };
    } else {
      this.roomPrices.push(fullPayload);
    }

    if (rm && !isNaN(weekdayNum) && weekdayNum > 0) {
      rm.basePrice = weekdayNum;
      rm.weekdayPrice = weekdayNum;
      rm.weekendPrice = weekendNum;
    }

    if (typeof window !== 'undefined') {
      if (typeof window.syncCustomRoomNamesToDOM === 'function') {
        window.syncCustomRoomNamesToDOM();
      }
      if (typeof window.syncDynamicRoomPricesToDOM === 'function') {
        window.syncDynamicRoomPricesToDOM();
      }
    }

    const roomName = rm ? rm.name : 'Pokoj';

    let upsertSuccess = true;
    let upsertErrMsg = '';

    if (isSupabaseConfigured && supabase) {
      try {
        const { error: upsertError } = await supabase.from('room_prices').upsert([fullPayload], { onConflict: 'room_id' });
        if (upsertError) {
          console.warn('Upsert room_prices returned error:', upsertError.message);
          upsertSuccess = false;
          upsertErrMsg = upsertError.message;
        }
      } catch (err) {
        console.error('Supabase updateRoomNameAndPrice failed:', err);
        upsertSuccess = false;
        upsertErrMsg = err.message;
      }
    }

    if (upsertSuccess) {
      this.showAdminToast(`✅ Název a ceny pro "${roomName}" byly úspěšně uloženy.`);
    } else {
      this.showAdminToast(`⚠️ Uložení do databáze selhalo: ${upsertErrMsg}`);
    }
  }

  async updateRoomPrice(roomId, newWeekdayPrice, newWeekendPrice) {
    return this.updateRoomNameAndPrice(roomId, '', newWeekdayPrice, newWeekendPrice);
  }

  async fetchDisabledRooms() {
    let localDisabled = getStoredDisabledRooms();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('disabled_rooms').select('*');
        if (!error && data && data.length > 0) {
          const map = new Map();
          localDisabled.forEach(d => map.set(d.room_id, d));
          data.forEach(d => map.set(d.room_id, d));
          this.disabledRooms = Array.from(map.values());
        } else {
          this.disabledRooms = localDisabled;
        }
      } catch (err) {
        console.error('Supabase fetchDisabledRooms failed:', err);
        this.disabledRooms = localDisabled;
      }
    } else {
      this.disabledRooms = localDisabled;
    }

    (this.disabledRooms || []).forEach(d => {
      if (d.room_id) {
        const rm = MOCK_ROOMS.find(r => r.id === d.room_id);
        if (rm) rm.isDisabled = Boolean(d.is_disabled);
      }
    });

    if (typeof window !== 'undefined' && typeof window.syncDisabledRoomsToDOM === 'function') {
      window.syncDisabledRoomsToDOM();
    }
  }

  async toggleRoomDisabled(roomId, shouldDisable) {
    if (!roomId) return;

    const payload = {
      room_id: roomId,
      is_disabled: Boolean(shouldDisable),
      updated_at: new Date().toISOString()
    };

    saveStoredDisabledRoom(payload);
    const existingIdx = (this.disabledRooms || []).findIndex(d => d.room_id === roomId);
    if (existingIdx >= 0) {
      this.disabledRooms[existingIdx] = payload;
    } else {
      this.disabledRooms.push(payload);
    }

    const rm = MOCK_ROOMS.find(r => r.id === roomId);
    if (rm) rm.isDisabled = Boolean(shouldDisable);

    if (typeof window !== 'undefined' && typeof window.syncDisabledRoomsToDOM === 'function') {
      window.syncDisabledRoomsToDOM();
    }

    const rmName = rm ? rm.name : roomId;
    this.showAdminToast(shouldDisable ? `${rmName} je vyřazený z provozu, rezervovat ho nejde.` : `${rmName} je zase v provozu a jde ho rezervovat.`);
    this.showDisabledRoomsModal = true;
    this.render();

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('disabled_rooms').upsert([payload], { onConflict: 'room_id' });
      } catch (err) {
        console.error('Supabase toggleRoomDisabled failed:', err);
      }
    }
  }

  /**
   * Otevře ruční zápis rezervace, případně s předvyplněnými údaji.
   * Volá se z tlačítka nad seznamem i z přehledu dostupnosti.
   */
  otevriRucniRezervaci(predvyplneno = null) {
    this.rucniRezervace = { ...prazdnaRucniRezervace(), ...(predvyplneno || {}) };
    this.rucniChyba = '';
    this.rucniKolize = false;
    this.rucniOdesila = false;   // pojistka proti dvojímu založení téže rezervace
    this.showPrehledModal = false;
    this.showRucniModal = true;
    this.zkontrolujKoliziRucni();
    this.render();
  }

  /**
   * Je vybraný pokoj v zadaném termínu už obsazený?
   *
   * Jen upozornění, ne zákaz — recepční může vědět o výměně pokoje nebo
   * o rezervaci, která se má vzápětí zrušit.
   */
  zkontrolujKoliziRucni() {
    const f = this.rucniRezervace || {};
    if (!f.room_id || !f.date_from || !f.date_to) { this.rucniKolize = false; return; }
    this.rucniKolize = (this.reservations || []).some(r => {
      if (r.room_id !== f.room_id) return false;
      if (r.status && (String(r.status).startsWith('cancelled') || r.status === 'stornováno')) return false;
      return r.date_from < f.date_to && r.date_to > f.date_from;
    });
  }

  async fetchReservations() {
    try {
      await checkAndProcessExpiredUnpaidReservations();
    } catch (e) {
      console.error('Error checking expired reservations:', e);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          // doplnPriznakyZeStarychDat zároveň vyčistí pole guests od
          // technických položek, které tam zapsala starší verze archivace
          this.reservations = data.map(doplnPriznakyZeStarychDat);

          // Sync clean list into localStorage so browser wipes out any stale orphan items
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('hotel_umustku_reservations_v1', JSON.stringify(this.reservations));
            }
          } catch {}
          return;
        }
      } catch (err) {
        console.error('Supabase admin fetch failed:', err);
      }
    }

    // Only used as fallback if Supabase is offline / unconfigured
    this.reservations = getStoredReservations();
  }

  async fetchBlockedDates() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('blocked_dates').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          this.blockedDates = data;
          return;
        }
      } catch (err) {
        console.error('Supabase fetchBlockedDates failed:', err);
      }
    }
    this.blockedDates = getStoredBlockedDates();
  }

  async addBlockedDate(room_id, date_from, date_to, reason, tichy = false) {
    const newItem = {
      id: 'blk-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      room_id: room_id || 'all',
      date_from: date_from,
      date_to: date_to,
      reason: reason || 'Uzávěrka recepce',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('blocked_dates').insert([{
          room_id: newItem.room_id,
          date_from: newItem.date_from,
          date_to: newItem.date_to,
          reason: newItem.reason
        }]).select();
        if (!error && data && data.length > 0) {
          newItem.id = data[0].id;
        }
      } catch (err) {
        console.error('Supabase addBlockedDate failed:', err);
      }
    }

    saveStoredBlockedDate(newItem);
    await this.fetchBlockedDates();
    if (!tichy) this.showAdminToast('Termín byl úspěšně zablokován.');
  }

  async removeBlockedDate(id) {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('blocked_dates').delete().eq('id', id);
      } catch (err) {
        console.error('Supabase removeBlockedDate failed:', err);
      }
    }

    deleteStoredBlockedDate(id);
    await this.fetchBlockedDates();
    this.showAdminToast('Blokace termínu byla úspěšně zrušena.');
    this.render();
  }

  checkBlockedDateConflictsForDates(selectedDates, roomId) {
    if (!selectedDates || selectedDates.length === 0) return [];
    return this.reservations.filter(r => {
      if (r.status === 'cancelled' || r.status === 'stornováno') return false;
      if (roomId !== 'all' && r.room_id !== roomId) return false;
      return selectedDates.some(d => d >= r.date_from && d < r.date_to);
    });
  }

  async handleLogin(e) {
    e.preventDefault();
    const encoder = new TextEncoder();
    const data = encoder.encode(this.passwordInput || '');
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const inputHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // SHA-256 cryptographic hashes (No plain text passwords stored in client source code)
    const validHashes = [
      '9b0ff4347547f372b1a3e770f486a380e2f81655219914b3bb28ac6279221f35',
      '3155fd625056427feaa42b58d5e27f4f3b778fe28540b8c7a0c7ffccdf1ecc25'
    ];

    if (validHashes.includes(inputHash)) {
      this.isAuthenticated = true;
      this.loginError = false;
      try {
        localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      } catch (err) {}
      this.render();
    } else {
      this.loginError = true;
      this.render();
      setTimeout(() => {
        const pwdInput = document.getElementById('admin-password');
        const loginErrAlert = this.container.querySelector('.login-error-alert') || pwdInput;
        if (loginErrAlert) loginErrAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (pwdInput && typeof pwdInput.focus === 'function') pwdInput.focus({ preventScroll: true });
      }, 60);
    }
  }

  showAdminToast(msg) {
    this.adminToastMessage = msg;
    this.toastExiting = false;
    this.render();

    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.toastExitTimer) clearTimeout(this.toastExitTimer);

    this.toastExitTimer = setTimeout(() => {
      this.toastExiting = true;
      const widget = this.container ? this.container.querySelector('.admin-toast-bottom-widget') : null;
      if (widget) widget.classList.add('is-exiting');
    }, 4600);

    this.toastTimer = setTimeout(() => {
      this.adminToastMessage = '';
      this.toastExiting = false;
      const widget = this.container ? this.container.querySelector('.admin-toast-bottom-widget') : null;
      if (widget) widget.remove();
    }, 5000);
  }

  async advanceReservationPhase(id, targetAction) {
    const reservation = this.reservations.find(r => r.id === id || r.code === id);
    if (!reservation) return;

    const room = MOCK_ROOMS.find(rm => rm.id === reservation.room_id) || MOCK_ROOMS[0];
    const nights = Math.max(1, Math.round((new Date(reservation.date_to) - new Date(reservation.date_from)) / (1000 * 60 * 60 * 24)) || 1);
    
    const pricing = calculateReservationPrice({
      roomType: room.type,
      roomId: room.id,
      nights,
      persons: reservation.adults_count || 2,
      adults: reservation.adults_count || 2,
      children: reservation.children_count || 0,
      // Bez termínu by se nepoznal víkend ani sezóna a cena v e-mailu
      // by nesouhlasila s tím, co host viděl při rezervaci.
      dateFrom: reservation.date_from,
      dateTo: reservation.date_to,
      hasDog: reservation.has_dog,
      hasEbike: reservation.has_ebike,
      hasHalfBoard: reservation.has_half_board,
      halfBoardCount: reservation.half_board_count,
      ebikeCount: reservation.ebike_count,
      hasWinterParking: reservation.has_winter_parking,
      parkingCarsCount: reservation.parking_cars_count,
      cenik: this.cenik,
      nastaveni: this.cenik && this.cenik.nastaveni
    });

    if (targetAction === 'approve_and_request_deposit') {
      // Phase 1 -> Phase 2: Approve & Request 30% Deposit with QR Code
      const newStatus = 'awaiting_deposit';
      const sentTimeStr = new Date().toISOString();
      reservation.payment_instructions_sent_at = sentTimeStr;
      reservation.approved_at = sentTimeStr;
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('reservations').update({
            status: newStatus,
            payment_instructions_sent_at: sentTimeStr,
            approved_at: sentTimeStr
          }).eq('id', id);
        } catch (e) {}
      }
      updateStoredReservationStatus(id, newStatus);
      reservation.status = newStatus;

      // Dispatch Email 2 (Payment Request with QR Code)
      try {
        const email2 = generateEmail2ApprovalAndPaymentRequest({ reservation, room, pricing });
        await sendEmail({
          to: reservation.guest_email,
          subject: email2.subject,
          html: email2.html,
          type: 'email_2_approval_payment_request',
          reservationCode: reservation.code
        });
      } catch (err) {
        console.error('Failed to send Email 2:', err);
      }

      this.showAdminToast(`✅ Žádost ${reservation.code} byla schválena. E-mail s QR kódem pro 30% zálohu byl odeslán hostu.`);

    } else if (targetAction === 'confirm_deposit_paid') {
      // Phase 2 -> Phase 3: Confirm 30% Deposit Paid & Hard-lock Stay
      const newStatus = 'confirmed';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('reservations').update({ status: newStatus }).eq('id', id); } catch (e) {}
      }
      updateStoredReservationStatus(id, newStatus);
      reservation.status = newStatus;

      // Dispatch Email 3 (Final Confirmation)
      try {
        const email3 = generateEmail3FinalConfirmation({ reservation, room, pricing });
        await sendEmail({
          to: reservation.guest_email,
          subject: email3.subject,
          html: email3.html,
          type: 'email_3_final_confirmation',
          reservationCode: reservation.code
        });
      } catch (err) {
        console.error('Failed to send Email 3:', err);
      }

      this.showAdminToast(`🎉 Záloha pro ${reservation.code} byla potvrzena. Závazné potvrzení pobytu bylo odesláno hostu.`);

    } else if (targetAction === 'cancel') {
      // Cancel reservation & send cancellation email
      const newStatus = 'cancelled';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('reservations').update({ status: newStatus }).eq('id', id); } catch (e) {}
      }
      updateStoredReservationStatus(id, newStatus);
      reservation.status = newStatus;

      // Dispatch Email 4 (Cancellation & Alternative dates offer)
      try {
        const emailCancel = generateEmailCancellation({
          reservation,
          room,
          reasonNote: 'Pokoj je v požadovaném termínu již plně obsazen nebo probíhá údržba kapacity.'
        });
        await sendEmail({
          to: reservation.guest_email,
          subject: emailCancel.subject,
          html: emailCancel.html,
          type: 'email_cancellation',
          reservationCode: reservation.code
        });
      } catch (err) {
        console.error('Failed to send Cancellation email:', err);
      }

      this.showAdminToast(`❌ Rezervace ${reservation.code} byla stornována. E-mail o zamítnutí s nabídkou náhradního termínu byl odeslán hostu.`);

    } else if (targetAction === 'print_reservation') {
      if (printReservationSheet(reservation) === false) {
        this.showAdminToast('⚠️ Prohlížeč zablokoval vyskakovací okno. Povolte je pro tuto stránku a zkuste tisk znovu.');
      }
      return;
    } else if (targetAction === 'delete') {
      this.pendingDeleteReservation = reservation;
      this.showDeleteModal = true;
      this.render();
      return;
    } else if (targetAction === 'confirm_delete') {
      const resId = reservation.id || id;
      const resCode = reservation.code || id;
      if (isSupabaseConfigured && supabase) {
        try {
          if (resCode) await supabase.from('reservations').delete().eq('code', resCode);
          if (resId) await supabase.from('reservations').delete().eq('id', resId);
        } catch (e) {
          console.error('Supabase delete exception:', e);
        }
      }
      if (resId) deleteStoredReservation(resId);
      if (resCode) deleteStoredReservation(resCode);
      if (id) deleteStoredReservation(id);

      this.reservations = this.reservations.filter(r => r.id !== resId && r.code !== resCode && r.id !== id && r.code !== id);
      this.showDeleteModal = false;
      this.pendingDeleteReservation = null;
      this.showAdminToast(`🗑️ Rezervace ${resCode || id} byla trvale vymazána z databáze.`);
    } else if (targetAction === 'archive') {
      const resId = reservation.id || id;
      const resCode = reservation.code || id;
      toggleStoredReservationArchive(resId || resCode, true);
      this.showAdminToast(`📦 Rezervace ${resCode || id} byla přesunuta do archivu.`);
      await this.fetchReservations();
      this.render();
      return;
    } else if (targetAction === 'unarchive') {
      const resId = reservation.id || id;
      const resCode = reservation.code || id;
      toggleStoredReservationArchive(resId || resCode, false);
      this.showAdminToast(`📤 Rezervace ${resCode || id} byla obnovena z archivu do aktivních objednávek.`);
      await this.fetchReservations();
      this.render();
      return;
    }

    await this.fetchReservations();
    this.render();
  }

  render() {
    if (!this.container) {
      this.container = document.getElementById('admin-container');
    }
    if (!this.container) return;

    if (!this.isAuthenticated) {
      this.container.innerHTML = `
        <div class="admin-login-wrapper">
          <div class="admin-login-card">
            <div class="admin-login-brand">Hotel u Můstku</div>
            <h2 class="admin-login-title">Recepční portál</h2>
            <p class="admin-login-desc">Zadejte přístupové heslo pro vstup do správy rezervací.</p>

            ${this.loginError ? `
              <div class="admin-login-error-banner">
                <span style="font-size: 16px;">⚠️</span>
                <span>Zadali jste nesprávné heslo. Zkuste to prosím znovu.</span>
              </div>
            ` : ''}

            <form id="admin-login-form" class="admin-login-form">
              <div class="form-field ${this.loginError ? 'has-error' : ''}">
                <label for="admin-pass" class="form-label">Heslo recepce</label>
                <input type="password" id="admin-pass" class="form-input" placeholder="Vložte přístupové heslo..." autofocus required value="${this.passwordInput}">
              </div>
              <button type="submit" class="btn btn-booking-submit btn-admin-login">Vstoupit do správy →</button>
            </form>
          </div>
        </div>
      `;

      const form = document.getElementById('admin-login-form');
      const pass = document.getElementById('admin-pass');
      if (pass) {
        pass.focus();
        pass.addEventListener('input', (e) => {
          this.passwordInput = e.target.value;
          if (this.loginError) this.loginError = false;
        });
      }
      if (form) form.addEventListener('submit', (e) => this.handleLogin(e));
      return;
    }

    // Pozor: každé nové okno sem patří dopsat, jinak se pod ním roluje
    // stránka místo obsahu okna.
    const isAnyAdminModalOpen = Boolean(
      this.showDiscountModal ||
      this.showPricesModal ||
      this.showDisabledRoomsModal ||
      this.showDeleteModal ||
      this.showNewsModal ||
      this.showRucniModal ||
      this.showPrehledModal ||
      this.showCropModal ||
      this.showDetailDrawerCode
    );
    if (isAnyAdminModalOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.documentElement.classList.remove('modal-open');
      document.body.classList.remove('modal-open');
    }

    const activeReservations = this.reservations.filter(r => !r.is_archived && !r.isArchived);
    const archivedReservations = this.reservations.filter(r => Boolean(r.is_archived || r.isArchived));

    const pendingCount = activeReservations.filter(r => r.status === 'pending_approval').length;
    const awaitingDepositCount = activeReservations.filter(r => r.status === 'awaiting_deposit').length;
    const confirmedCount = activeReservations.filter(r => r.status === 'confirmed').length;
    const cancelledCount = activeReservations.filter(r => r.status === 'cancelled').length;
    const archivedCount = archivedReservations.length;

    const filteredReservations = (this.statusFilter === 'archived' ? archivedReservations : activeReservations).filter(r => {
      const matchRoom = this.selectedRoomFilter === 'all' || r.room_id === this.selectedRoomFilter;
      const matchStatus = this.statusFilter === 'all' || this.statusFilter === 'archived' || r.status === this.statusFilter;
      return matchRoom && matchStatus;
    });

    const pendingReviewsCount = (this.reviews || []).filter(r => r.status === 'pending_approval').length;
    const approvedReviewsCount = (this.reviews || []).filter(r => r.status === 'approved').length;

    this.container.innerHTML = `
      <div class="admin-dashboard-wrapper">
        <!-- HORNÍ LIŠTA TITULKU A AKCÍ -->
        <div class="admin-header-bar">
          <div class="admin-title-group">
            <h2>Recepční portál</h2>
            <p>Správa rezervací a obsluha 30% záloh pro Hotel u Můstku</p>
          </div>

          <!-- Pořadí je podle toho, jak často to recepční potřebuje:
               dostupnost a ceník denně, aktuality a recenze občas.
               Archiv je předposlední, Odhlásit se poslední.
               Blokování termínů tu vlastní tlačítko NEMÁ — dělá se
               v Dostupnosti, kde je u toho rovnou vidět obsazenost. -->
          <div class="admin-top-actions">
            <button type="button" class="btn btn-specs-secondary btn-admin-prehled">
              📆 Dostupnost a blokace ${this.blockedDates.length > 0 ? `<span style="background: #e67e22; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${this.blockedDates.length}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-prices">
              💰 Ceník
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-disabled-rooms">
              🔒 Blokování pokojů
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-news">
              📰 Správa aktualit ${this.newsItems.length > 0 ? `<span style="background: #2e3524; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${this.newsItems.length}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-reviews">
              ⭐ Správa recenzí ${pendingReviewsCount > 0 ? `<span style="background: #e67e22; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${pendingReviewsCount}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-discounts">
              🏷️ Slevové kódy ${this.discountCodes.length > 0 ? `<span style="background: #4a5a24; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${this.discountCodes.length}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-archive-tab${this.statusFilter === 'archived' ? ' is-active' : ''}">
              📂 Archiv ${archivedCount > 0 ? `<span style="background: #4a5a24; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${archivedCount}</span>` : ''}
            </button>
            <button type="button" class="btn btn-booking-submit btn-admin-logout">🚪 Odhlásit se</button>
          </div>
        </div>

        <!-- JEDNOTNÁ LIŠTA FILTRŮ A VÝBĚRU POKOJŮ -->
        <div class="admin-toolbar">
          <div class="admin-status-tabs">
            <button type="button" class="status-tab-btn ${this.statusFilter === 'all' ? 'active' : ''}" data-status="all">
              <span>Všechny</span>
              <span class="tab-count">${activeReservations.length}</span>
            </button>
            <button type="button" class="status-tab-btn tab-pending ${pendingCount > 0 ? 'has-pending' : ''} ${this.statusFilter === 'pending_approval' ? 'active' : ''}" data-status="pending_approval">
              <span>1. Ke schválení</span>
              <span class="tab-count">${pendingCount}</span>
            </button>
            <button type="button" class="status-tab-btn ${this.statusFilter === 'awaiting_deposit' ? 'active' : ''}" data-status="awaiting_deposit">
              <span>2. Čeká na zálohu</span>
              <span class="tab-count">${awaitingDepositCount}</span>
            </button>
            <button type="button" class="status-tab-btn ${this.statusFilter === 'confirmed' ? 'active' : ''}" data-status="confirmed">
              <span>3. Závazně potvrzeno</span>
              <span class="tab-count">${confirmedCount}</span>
            </button>
            <button type="button" class="status-tab-btn ${this.statusFilter === 'cancelled' ? 'active' : ''}" data-status="cancelled">
              <span>Stornováno</span>
              <span class="tab-count">${cancelledCount}</span>
            </button>
            <button type="button" class="status-tab-btn ${this.statusFilter === 'archived' ? 'active' : ''}" data-status="archived">
              <span>📂 Archiv</span>
              <span class="tab-count">${archivedCount}</span>
            </button>
          </div>

          <div class="admin-room-filter">
            <label for="filter-room">Pokoj:</label>
            <select id="filter-room" class="admin-room-select">
              <option value="all">Všechny pokoje</option>
              ${MOCK_ROOMS.map(r => `<option value="${r.id}" ${this.selectedRoomFilter === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Ruční založení rezervace patří k seznamu pod ním, ne mezi
             nástroje nahoře ani mezi filtry. Vzhled má stejný jako
             ostatní tlačítka administrace. -->
        <div class="admin-nova-rezervace-radek">
          <button type="button" class="btn btn-specs-secondary btn-admin-nova-rezervace">
            ➕ Nová rezervace
          </button>
        </div>

        <!-- SEZNAM KARET REZERVACÍ -->
        <div class="admin-reservations-container">
          ${filteredReservations.length === 0 ? `
            <div class="admin-res-card" style="text-align: center; padding: 48px 24px; color: #666660;">
              <p style="margin: 0; font-size: 16px; font-weight: 600;">Žádné rezervace neodpovídají vybraným filtrům.</p>
            </div>
          ` : filteredReservations.map(r => {
            const isExpanded = this.expandedReservationId === r.id;
            const room = MOCK_ROOMS.find(rm => rm.id === r.room_id) || { name: r.room_name || 'Pokoj' };
            const formattedCreated = r.created_at ? new Date(r.created_at).toLocaleDateString('cs-CZ') + ' ' + new Date(r.created_at).toLocaleTimeString('cs-CZ', {hour:'2-digit', minute:'2-digit'}) : 'Není k dispozici';

            return `
              <div class="admin-res-card status-card-${r.status}" data-id="${r.id || r.code}">
                <div class="res-card-grid">

                  <!-- COL 1: KÓD A DATUM -->
                  <div>
                    <span class="res-code-badge">${r.code || 'HM-2026-0000'}</span>
                    <div class="res-created-at">${formattedCreated}</div>
                  </div>

                  <!-- COL 2: HOST A KONTAKT -->
                  <div>
                    <div class="res-guest-name">${r.guest_name}</div>
                    <div class="res-contact-info">
                      <div>📞 <a href="tel:${r.guest_phone}" style="color: inherit; text-decoration: none; font-weight: 600;">${r.guest_phone}</a></div>
                      <div>✉️ <a href="mailto:${r.guest_email}" style="color: #697947; text-decoration: none;">${r.guest_email}</a></div>
                      ${r.guest_note ? `<div style="margin-top: 4px; color: #4a5a24; font-weight: 500;">📝 ${r.guest_note}</div>` : ''}
                    </div>
                  </div>

                  <!-- COL 3: POKOJ A TERMÍN -->
                  <div class="res-room-col">
                    <div class="res-room-title">${room.name || r.room_name || 'Pokoj'}</div>
                    <div class="res-stay-dates">
                      <strong>${r.date_from} → ${r.date_to}</strong>
                    </div>
                  </div>

                  <!-- COL 4: FINANCE A STAV -->
                  <div>
                    <div class="res-price-total">${formatCzechPrice(r.total_price)}</div>
                    <div class="res-deposit-sub">Záloha ${procentoZalohy(r)}%: ${formatCzechPrice(r.deposit_price || 0)}</div>
                    <div style="margin-top: 6px;">
                      ${r.status === 'pending_approval' ? `
                        <span style="display:inline-block; font-size:12.5px; font-weight:700; color:#d35400; background:#fef5e7; padding:3px 10px; border-radius:4px;">1. Ke schválení</span>
                      ` : (r.status === 'awaiting_deposit' ? `
                        <span style="display:inline-block; font-size:12.5px; font-weight:700; color:#2980b9; background:#ebf5fb; padding:3px 10px; border-radius:4px;">2. Čeká na zálohu</span>
                      ` : (r.status === 'confirmed' ? `
                        <span style="display:inline-block; font-size:12.5px; font-weight:700; color:#27ae60; background:#e8f8f5; padding:3px 10px; border-radius:4px;">3. Závazně potvrzeno</span>
                      ` : `<span style="display:inline-block; font-size:12.5px; font-weight:700; color:#7f8c8d; background:#f2f4f4; padding:3px 10px; border-radius:4px;">Stornováno</span>`))}
                    </div>
                  </div>

                  <!-- COL 5: RECEPČNÍ AKCE -->
                  <div class="res-actions-cell">
                    ${r.status === 'pending_approval' ? `
                      <button type="button" class="res-btn-approve-primary btn-admin-action" data-id="${r.id || r.code}" data-act="approve_and_request_deposit">
                        Schválit & poslat QR kód
                      </button>
                    ` : ''}

                    ${r.status === 'awaiting_deposit' ? `
                      <button type="button" class="res-btn-pay-primary btn-admin-action" data-id="${r.id || r.code}" data-act="confirm_deposit_paid">
                        Potvrdit přijetí zálohy
                      </button>
                    ` : ''}

                    ${r.status === 'confirmed' ? `
                      <button type="button" class="res-btn-print-primary btn-admin-action" data-id="${r.id || r.code}" data-act="print_reservation" style="background-color: #1c1c19 !important; color: #ece8dd !important; border: 1px solid #1c1c19 !important; font-weight: 700 !important; width: 100% !important; padding: 9px 14px !important; border-radius: 2px !important; display: inline-flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;">
                        🖨️ Vytisknout rezervaci
                      </button>
                    ` : ''}

                    <div class="res-secondary-btn-row">
                      <button type="button" class="res-btn-secondary btn-details-toggle" data-id="${r.id || r.code}">
                        ${isExpanded ? 'Skrýt podrobnosti' : 'Podrobnosti'}
                      </button>

                      ${r.is_archived || r.isArchived ? `
                        <button type="button" class="res-btn-archive-soft btn-admin-action" data-id="${r.id || r.code}" data-act="unarchive">
                          Vrátit z archivu
                        </button>
                      ` : `
                        <button type="button" class="res-btn-archive-soft btn-admin-action" data-id="${r.id || r.code}" data-act="archive">
                          Do archivu
                        </button>
                      `}

                      ${r.status !== 'cancelled' ? `
                        <button type="button" class="res-btn-cancel-soft btn-admin-action" data-id="${r.id || r.code}" data-act="cancel">
                          Stornovat
                        </button>
                      ` : ''}
                    </div>
                  </div>

                </div>

                <!-- DRAWER PODROBNOSTÍ -->
                ${isExpanded ? `
                  <div class="admin-card-drawer">
                    <div class="drawer-content-grid">
                      <!-- KARTA 1: HOSTÉ PRO UBYTOVACÍ KNIHU -->
                      <div>
                        <h4 class="drawer-section-title">Hosté pro Ubytovací knihu (${r.guests && r.guests.length > 0 ? r.guests.length : (r.adults_count || 1)})</h4>
                        <div class="drawer-guest-list">
                          ${(r.guests && r.guests.length > 0) ? r.guests.map((g, gIdx) => `
                            <div class="drawer-guest-entry">
                              <div class="guest-entry-header">
                                <div class="guest-entry-title">
                                  ${gIdx + 1}. ${g.name || 'Jméno neuvedeno'}
                                  <span class="guest-role-inline">(${g.is_main ? 'Hlavní ubytovaný' : `Host ${gIdx + 1}`})</span>
                                </div>
                                <div class="guest-toggle-trigger">
                                  <span class="guest-toggle-label">Rozbalit</span>
                                  <span class="guest-accordion-chevron">▾</span>
                                </div>
                              </div>
                              <div class="guest-entry-body">
                                <ul class="drawer-info-list" style="margin-top: 4px;">
                                  ${g.phone ? `<li><span>Telefon:</span> <strong>${g.phone}</strong></li>` : ''}
                                  ${g.email ? `<li><span>E-mail:</span> <strong>${g.email}</strong></li>` : ''}
                                  <li><span>Datum narození:</span> <strong>${g.birth_date || 'Neuvedeno online'}</strong></li>
                                  <li><span>Číslo OP / Pasu:</span> <strong>${g.id_number || 'Neuvedeno online'}</strong></li>
                                  <li><span>Ulice a č.p.:</span> <strong>${g.street || 'Neuvedeno online'}</strong></li>
                                  <li><span>Město / Obec:</span> <strong>${g.city || 'Neuvedeno online'}</strong></li>
                                  <li><span>PSČ:</span> <strong>${g.zip || 'Neuvedeno online'}</strong></li>
                                  <li><span>Stát:</span> <strong>${g.country || 'Česká republika'}</strong></li>
                                </ul>
                              </div>
                            </div>
                          `).join('') : `
                            <div class="drawer-guest-entry">
                              <div class="guest-entry-header">
                                <div class="guest-entry-title">
                                  1. ${r.guest_name}
                                  <span class="guest-role-inline">(Hlavní ubytovaný)</span>
                                </div>
                                <div class="guest-toggle-trigger">
                                  <span class="guest-toggle-label">Rozbalit</span>
                                  <span class="guest-accordion-chevron">▾</span>
                                </div>
                              </div>
                              <div class="guest-entry-body">
                                <ul class="drawer-info-list" style="margin-top: 4px;">
                                  <li><span>Telefon:</span> <strong>${r.guest_phone}</strong></li>
                                  <li><span>E-mail:</span> <strong>${r.guest_email}</strong></li>
                                  <li><span>Počet osob:</span> <strong>${r.adults_count || 1} dospělí ${r.children_count > 0 ? `, ${r.children_count} dětí` : ''}</strong></li>
                                  <li><span>Bydliště:</span> <strong>${r.guest_street ? r.guest_street + ', ' : ''}${r.guest_city || 'Doplní se na recepci'}</strong></li>
                                </ul>
                              </div>
                            </div>
                          `}
                        </div>
                      </div>

                      <!-- KARTA 2: SLUŽBY -->
                      <div>
                        <h4 class="drawer-section-title">Doplňkové služby & Poznámka</h4>
                        <ul class="drawer-info-list">
                          <li><span>Polopenze:</span> <strong>${r.has_half_board ? `${r.half_board_count || r.adults_count || 1} osob` : 'Ne'}</strong></li>
                          <li><span>Pobyt s pejskem:</span> <strong>${r.has_dog ? 'Ano (150 Kč/den)' : 'Ne'}</strong></li>
                          <li><span>Elektrokolo:</span> <strong>${r.has_ebike ? `${r.ebike_count || 1}x ks` : 'Ne'}</strong></li>
                          <li><span>Zimní parkování:</span> <strong>${r.has_winter_parking ? `${r.parking_cars_count || 1}x auto (${(r.parking_cars_count || 1) * 50} Kč/noc)` : 'Ne (0 Kč)'}</strong></li>
                          <li><span>Poznámka hosta:</span> <strong>${r.guest_note || 'Bez poznámky'}</strong></li>
                        </ul>
                      </div>

                      <!-- KARTA 3: PLATBA -->
                      <div>
                        <h4 class="drawer-section-title">Rozpis platby & Identifikace</h4>
                        <ul class="drawer-info-list">
                          <li><span>Celková cena pobytu:</span> <strong>${formatCzechPrice(r.total_price)} s DPH</strong></li>
                          <li><span>Záloha ${procentoZalohy(r)} % (předem):</span> <strong style="color: #4a5a24;">${formatCzechPrice(r.deposit_price || 0)}</strong></li>
                          <li><span>Doplatek 70 % (na místě):</span> <strong>${formatCzechPrice(r.remaining_price || Math.round((r.total_price||0)*0.7))}</strong></li>
                          <li><span>Variabilní symbol:</span> <strong>${getVariableSymbol(r.code)}</strong></li>
                        </ul>
                      </div>
                    </div>

                    <!-- ARCHIVACE A VYMAZÁNÍ REZERVAČNÍHO ZÁZNAMU -->
                    <div class="drawer-delete-bar" style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                      ${r.is_archived || r.isArchived ? `
                        <button type="button" class="btn-drawer-archive-clean btn-admin-action" data-id="${r.id || r.code}" data-act="unarchive">
                          Vrátit z archivu mezi aktivní
                        </button>
                      ` : `
                        <button type="button" class="btn-drawer-archive-clean btn-admin-action" data-id="${r.id || r.code}" data-act="archive">
                          Přesunout do archivu
                        </button>
                      `}
                      <button type="button" class="btn-drawer-delete-clean btn-admin-action" data-id="${r.id || r.code}" data-act="delete">
                        Vymazat rezervaci z databáze
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${this.showDeleteModal && this.pendingDeleteReservation ? `
          <div class="admin-modal-overlay">
            <div class="admin-confirm-modal">
              <h3 class="admin-modal-title">Trvalé vymazání rezervace</h3>
              <p class="admin-modal-desc">
                Opravdu chcete trvale smazat rezervaci <strong>${this.pendingDeleteReservation.code}</strong> (${this.pendingDeleteReservation.guest_name})? Tato akce je nevratná a záznam bude vymazán z databáze.
              </p>
              <div class="admin-modal-actions">
                <button type="button" class="btn-modal-cancel btn-cancel-delete-modal">Zrušit</button>
                <button type="button" class="btn-modal-danger btn-admin-action" data-id="${this.pendingDeleteReservation.id || this.pendingDeleteReservation.code}" data-act="confirm_delete">Ano, trvale vymazat</button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showDiscountModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-discount">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 580px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">🏷️ Správa slevových kódů</h3>
                <button type="button" class="btn-close-discount-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
                Vytvořte nové slevové kódy pro hosty. Po zadání kódu v rezervaci se vypočtená sleva automaticky odečte z celkové ceny ubytování.
              </p>

              <div style="background: #fafaf7; border: 1px solid #e8e7de; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 800; color: #1c1c19;">Vytvořit nový slevový kód</h4>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;" class="block-form-grid">
                  <div>
                    <label style="font-size: 12.5px; font-weight: 700; color: #444; display: block; margin-bottom: 5px;">Kód slevy (např. LETO20)</label>
                    <input type="text" id="discount-code-input" class="admin-discount-input" placeholder="LETO20" style="text-transform: uppercase;" value="${this.newDiscountForm.code || ''}">
                  </div>
                  <div>
                    <label style="font-size: 12.5px; font-weight: 700; color: #444; display: block; margin-bottom: 5px;">Sleva v % (např. 15)</label>
                    <input type="number" id="discount-value-input" class="admin-discount-input" placeholder="např. 15" min="1" max="100" value="${this.newDiscountForm.discount_value || ''}">
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 16px;" class="block-form-grid">
                  <div>
                    <label style="font-size: 12.5px; font-weight: 700; color: #444; display: block; margin-bottom: 5px;">Platnost kódu (Volitelné)</label>
                    <div style="position: relative; display: flex; align-items: center;" id="btn-trigger-discount-validity">
                      <input type="text" id="discount-validity-input" class="admin-discount-input" readonly placeholder="Vyberte platnost kódu" value="${getDiscountValidityDisplay(this.newDiscountForm.valid_from, this.newDiscountForm.valid_until)}" style="padding-right: 56px; cursor: pointer;">
                      <div style="position: absolute; right: 10px; display: flex; align-items: center; gap: 6px;">
                        ${(this.newDiscountForm.valid_from || this.newDiscountForm.valid_until) ? `
                          <button type="button" id="btn-clear-discount-validity-inline" title="Vymazat platnost" style="background: none; border: none; font-size: 15px; font-weight: 700; color: #c62828; cursor: pointer; padding: 2px 4px; line-height: 1;">&times;</button>
                        ` : ''}
                        <span style="pointer-events: none; color: #4a5a24; display: flex; align-items: center;">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style="font-size: 12.5px; font-weight: 700; color: #444; display: block; margin-bottom: 5px;">Max. použití (Např. 20)</label>
                    <input type="number" id="discount-max-uses-input" class="admin-discount-input" placeholder="Neomezeně" min="1" value="${this.newDiscountForm.max_uses || ''}">
                  </div>
                </div>

                <button type="button" class="btn btn-booking-submit btn-save-discount-code" style="width: 100%; height: 44px; font-size: 15px; font-weight: 700; border-radius: 1px;">
                  Vytvořit slevový kód
                </button>
              </div>

              <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14.5px; font-weight: 800; color: #1c1c19;">Aktivní slevové kódy (${this.discountCodes.length})</h4>
                ${this.discountCodes.length === 0 ? `
                  <p style="color: #777; font-size: 13.5px; text-align: center; margin: 16px 0;">V současnosti nejsou vytvořeny žádné slevové kódy.</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 10px; max-height: 240px; overflow-y: auto; padding-right: 4px;">
                    ${this.discountCodes.map(c => {
                      const maxLabel = c.max_uses ? `Použito ${c.used_count || 0} z ${c.max_uses}` : `Použito ${c.used_count || 0}× (Neomezeně)`;
                      const dateLabel = (c.valid_from || c.valid_until)
                        ? `${c.valid_from ? formatCzechDateStr(c.valid_from) : 'Od teď'} – ${c.valid_until ? formatCzechDateStr(c.valid_until) : 'Neomezeně'}`
                        : 'Neomezená platnost';
                      return `
                        <div style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                          <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                              <span style="font-weight: 800; font-size: 15px; color: #4a5a24; letter-spacing: 0.04em;">${c.code}</span>
                              <span style="font-size: 11.5px; font-weight: 700; background: #eef2e6; color: #4a5a24; padding: 2px 6px; border-radius: 3px;">-${c.discount_value} %</span>
                            </div>
                            <div style="font-size: 12px; color: #666; margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap;">
                              <span>📅 ${dateLabel}</span>
                              <span>👥 ${maxLabel}</span>
                            </div>
                          </div>
                          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                            <button type="button" class="btn-toggle-discount-active" data-id="${c.id}" data-active="${c.is_active ? 'false' : 'true'}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: ${c.is_active ? '#2e7d32' : '#777'}; cursor: pointer;">
                              ${c.is_active ? '✓ Aktivní' : 'Aktivovat'}
                            </button>
                            <button type="button" class="btn-delete-discount-item" data-id="${c.id}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #c62828; cursor: pointer;">
                              Smazat
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showPricesModal ? renderCenikModal(this) : ''}

        ${this.showRucniModal ? renderRucniRezervaceModal(this) : ''}

        ${this.showPrehledModal ? renderDostupnostModal(this) : ''}

        ${this.showDisabledRoomsModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-disabled">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 620px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">🔒 Blokování pokojů</h3>
                <button type="button" class="btn-close-disabled-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 18px; font-size: 13.5px; color: #55554e;">
                Vyřazený pokoj zůstane na webu vidět, ale nejde ho zarezervovat — místo tlačítka výběru se u něj ukáže „Dočasně nedostupné“. Platí bez ohledu na datum; na jednotlivé termíny je Blokování termínů.
              </p>

              <div style="display: flex; flex-direction: column; gap: 8px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                ${MOCK_ROOMS.map(rm => {
                  const isBlocked = Boolean(rm.isDisabled);
                  return `
                    <div class="room-disabled-card" data-roomid="${rm.id}" style="background: #ffffff; border: 1px solid #e4e2d8; border-left: 3px solid ${isBlocked ? '#c62828' : '#697947'}; border-radius: 6px; padding: 13px 15px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
                      <div style="min-width: 0;">
                        <div style="font-weight: 700; font-size: 14.5px; color: #1c1c19;">${rm.name}</div>
                        <span style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; ${isBlocked ? 'background: #fbeaea; color: #a5231f;' : 'background: #eef2e4; color: #4a5a24;'}">
                          <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isBlocked ? '#c62828' : '#697947'};"></span>
                          ${isBlocked ? 'Mimo provoz' : 'V provozu'}
                        </span>
                      </div>
                      <button type="button" class="btn btn-toggle-room-disabled" data-roomid="${rm.id}" data-action="${isBlocked ? 'unblock' : 'block'}" style="flex-shrink: 0; height: 38px; padding: 0 16px; font-size: 13px; font-weight: 700; border-radius: 4px; cursor: pointer; ${isBlocked ? 'background: #ffffff; color: #4a5a24; border: 1.5px solid #697947;' : 'background: #ffffff; color: #a5231f; border: 1.5px solid #d9a3a1;'}">
                        ${isBlocked ? 'Vrátit do provozu' : 'Vyřadit z provozu'}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showConfirmRoomBlockModal && this.pendingRoomBlock ? `
          <div class="admin-modal-overlay admin-modal-overlay-confirm-room-block" style="z-index: 10080;">
            <div class="admin-confirm-modal" style="max-width: 460px; width: 92%; padding: 24px; border-radius: 12px; background: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #ece8dd; padding-bottom: 12px;">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: ${this.pendingRoomBlock.block ? '#c62828' : '#4a5a24'};">
                  ${this.pendingRoomBlock.block ? 'Vyřadit pokoj z provozu?' : 'Vrátit pokoj do provozu?'}
                </h3>
                <button type="button" class="btn-cancel-room-block" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 0; line-height: 1;">&times;</button>
              </div>

              <p style="font-size: 14px; color: #444440; line-height: 1.55; margin: 0 0 20px 0;">
                ${this.pendingRoomBlock.block
                  ? `<strong>${this.pendingRoomBlock.name}</strong> přestane jít rezervovat — na webu u něj místo tlačítka výběru bude „Dočasně nedostupné“. Už uložených rezervací se to netýká.`
                  : `<strong>${this.pendingRoomBlock.name}</strong> se vrátí do nabídky a hosté si ho budou moct zase zarezervovat.`}
              </p>

              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-cancel-room-block" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 9px 18px; font-size: 13.5px; font-weight: 600; color: #444; cursor: pointer;">
                  Zrušit
                </button>
                <button type="button" class="btn-confirm-room-block" style="border: none; border-radius: 4px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; color: #ffffff; cursor: pointer; background: ${this.pendingRoomBlock.block ? '#c62828' : '#697947'};">
                  ${this.pendingRoomBlock.block ? 'Ano, vyřadit z provozu' : 'Ano, vrátit do provozu'}
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showNewsModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-news">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 780px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">📰 Správa aktualit hotelu</h3>
                <button type="button" class="btn-close-news-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
                Přidávejte a upravujte novinky zobrazené v sekci a na stránce Aktuality.
              </p>

              <!-- FORMULÁŘ AKTUALITY -->
              <div style="background: #fafaf7; border: 1px solid #e8e7de; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #ece8dd; padding-bottom: 12px;">
                  <h4 style="margin: 0; font-size: 15.5px; font-weight: 800; color: #1c1c19;">
                    ${this.editingNewsItem ? '✏️ Úprava aktuality' : '➕ Přidat novou aktualitu'}
                  </h4>
                  ${this.editingNewsItem ? `
                    <button type="button" class="btn-reset-news-form" style="background: #ffffff; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; color: #4a5a24;">
                      + Vytvořit novou místo úpravy
                    </button>
                  ` : ''}
                </div>

                <div style="display: flex; flex-direction: column; gap: 16px;">
                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: #1c1c19; display: block; margin-bottom: 6px;">Název aktuality (Povinné) *</label>
                    <input type="text" id="news-title-input" class="admin-discount-input" placeholder="Napište výstižný název novinky nebo akce..." value="${this.newsForm.title || ''}">
                  </div>

                  <div>
                    <label style="font-size: 13px; font-weight: 700; color: #1c1c19; display: block; margin-bottom: 6px;">Text aktuality (Povinné) *</label>
                    <textarea id="news-content-input" rows="6" class="admin-discount-input" placeholder="Napište obsah novinky, oznamovací zprávu nebo podrobnosti k akci..." style="font-family: inherit; font-size: 14px; padding: 12px; line-height: 1.6; resize: vertical;">${this.newsForm.content || ''}</textarea>
                  </div>

                  <!-- NAHRÁNÍ A OŘEZ FOTOGRAFIE (NEPOVINNÉ) -->
                  <div style="background: #ffffff; border: 1px dashed #cccccc; border-radius: 6px; padding: 16px;">
                    <label style="font-size: 13px; font-weight: 700; color: #1c1c19; display: block; margin-bottom: 8px;">Fotografie aktuality (Volitelné, poměr 16:9)</label>
                    
                    ${this.newsForm.image_url ? `
                      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 12px; background: #fafaf7; padding: 10px; border-radius: 6px; border: 1px solid #e8e7de;">
                        <img src="${this.newsForm.image_url}" alt="Obrázek" style="width: 120px; height: 68px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
                        <div>
                          <span style="font-size: 12px; color: #27ae60; font-weight: 700; display: block; margin-bottom: 6px;">✓ Fotografie nahrána a oříznuta</span>
                          <button type="button" class="btn-remove-news-photo" style="background: #fff0f0; border: 1px solid #f5c6cb; color: #c62828; border-radius: 4px; padding: 5px 12px; font-size: 12px; font-weight: 600; cursor: pointer;">
                            🗑️ Odstranit fotku
                          </button>
                        </div>
                      </div>
                    ` : ''}

                    <div style="display: flex; align-items: center; gap: 10px;">
                      <input type="file" id="news-photo-file-input" accept="image/*" style="display: none;">
                      <button type="button" class="btn btn-specs-secondary btn-trigger-photo-upload" style="width: 100%; min-height: 42px; font-size: 13.5px; font-weight: 700; border-radius: 4px; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box;">
                        📷 ${this.newsForm.image_url ? 'Změnit fotku' : 'Nahrát fotku (16:9)'}
                      </button>
                    </div>
                  </div>

                  <!-- PŘEPÍNAČ PUBLIKOVÁNÍ -->
                  <div style="background: #ffffff; border: 1px solid #e8e7de; border-radius: 6px; padding: 14px 16px;">
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: #1c1c19; cursor: pointer;">
                      <input type="checkbox" id="news-is-active-check" ${this.newsForm.is_active ? 'checked' : ''} style="width: 19px; height: 19px; accent-color: #4a5a24;">
                      Zobrazit na webu (Publikováno)
                    </label>
                  </div>

                  <!-- OZNÁMENÍ V BOČNÍ ZÁLOŽCE
                       Pole tu dřív chyběla, přestože se ukládala i vykreslovala —
                       banner tedy nešlo z administrace vůbec zapnout ani přepsat. -->
                  <div style="background: #ffffff; border: 1px solid #e8e7de; border-radius: 6px; padding: 14px 16px;">
                    <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; color: #1c1c19; cursor: pointer;">
                      <input type="checkbox" id="news-is-banner-check" ${this.newsForm.is_banner ? 'checked' : ''} style="width: 19px; height: 19px; accent-color: #4a5a24;">
                      Připnout jako oznámení do boční záložky
                    </label>
                    <p style="margin: 8px 0 0 29px; font-size: 12.5px; color: #55554e; line-height: 1.5;">
                      Oznámení může být na webu jen jedno — zapnutím se u ostatních aktualit vypne.
                    </p>
                    <div id="news-banner-text-wrap" style="margin-top: 12px; ${this.newsForm.is_banner ? '' : 'display: none;'}">
                      <label style="font-size: 13px; font-weight: 700; color: #1c1c19; display: block; margin-bottom: 6px;">Text na záložce</label>
                      <input type="text" id="news-banner-text-input" class="admin-discount-input" placeholder="Krátká věta, která se ukáže na záložce…" value="${(this.newsForm.banner_text || '').replace(/"/g, '&quot;')}">
                      <p style="margin: 6px 0 0 0; font-size: 12.5px; color: #55554e;">
                        Když zůstane prázdný, použije se název aktuality.
                      </p>
                    </div>
                  </div>

                  <button type="button" class="btn btn-booking-submit btn-save-news-item" style="width: 100%; height: 46px; font-size: 15px; font-weight: 700; border-radius: 4px; margin-top: 4px;">
                    ${this.editingNewsItem ? 'Uložit změny aktuality' : 'Publikovat novou aktualitu'}
                  </button>
                </div>
              </div>

              <!-- SEZNAM AKTUALIT -->
              <div>
                <h4 style="margin: 0 0 14px 0; font-size: 15.5px; font-weight: 800; color: #1c1c19;">Seznam aktualit (${this.newsItems.length})</h4>
                ${this.newsItems.length === 0 ? `
                  <p style="font-size: 13.5px; color: #777; text-align: center; margin: 24px 0;">Zatím nebyly vytvořeny žádné aktuality.</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 12px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                    ${this.newsItems.map((item, idx) => `
                      <div style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
                          <!-- ŠIPKY PRO ZMĚNU POŘADÍ -->
                          <div style="display: flex; flex-direction: column; gap: 3px; flex-shrink: 0;">
                            <button type="button" class="btn-reorder-news-item" data-id="${item.id}" data-dir="up" ${idx === 0 ? 'disabled style="opacity:0.25; cursor:default; background:none; border:1px solid #ddd; border-radius:3px; padding:2px 6px; font-size:10px;"' : 'style="cursor:pointer; background:#fafaf7; border:1px solid #d8d5c9; border-radius:3px; padding:2px 6px; font-size:10px; color:#1c1c19;"'} title="Posunout nahoru">
                              ▲
                            </button>
                            <button type="button" class="btn-reorder-news-item" data-id="${item.id}" data-dir="down" ${idx === this.newsItems.length - 1 ? 'disabled style="opacity:0.25; cursor:default; background:none; border:1px solid #ddd; border-radius:3px; padding:2px 6px; font-size:10px;"' : 'style="cursor:pointer; background:#fafaf7; border:1px solid #d8d5c9; border-radius:3px; padding:2px 6px; font-size:10px; color:#1c1c19;"'} title="Posunout dolů">
                              ▼
                            </button>
                          </div>

                          ${item.image_url ? `
                            <img src="${item.image_url}" alt="" style="width: 64px; height: 40px; object-fit: cover; border-radius: 4px; flex-shrink: 0;">
                          ` : `
                            <div style="width: 64px; height: 40px; background: #f2f2ee; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #888; flex-shrink: 0;">Bez fotky</div>
                          `}
                          <div style="min-width: 0; flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px;">
                              <span style="font-weight: 800; font-size: 14px; color: #1c1c19; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px;">${item.title}</span>
                              ${item.is_active ? `
                                <span style="font-size: 10.5px; font-weight: 700; color: #27ae60; background: #e8f8f5; padding: 2px 7px; border-radius: 4px;">Publikováno</span>
                              ` : `
                                <span style="font-size: 10.5px; font-weight: 700; color: #7f8c8d; background: #f2f4f4; padding: 2px 7px; border-radius: 4px;">Skryto</span>
                              `}
                            </div>
                            <div style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                              ${item.banner_text || item.content}
                            </div>
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                          <button type="button" class="btn-edit-news-item" data-id="${item.id}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #1c1c19; cursor: pointer;">
                            Upravit
                          </button>
                          <button type="button" class="btn-delete-news-item" data-id="${item.id}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #c62828; cursor: pointer;">
                            Smazat
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>

            </div>
          </div>
        ` : ''}

        ${this.showCropModal && this.cropImageSrc ? `
          <div class="admin-modal-overlay admin-modal-overlay-crop" style="z-index: 10050;">
            <div class="admin-confirm-modal" style="max-width: 860px; width: 95%; padding: 24px; border-radius: 12px; background: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #ece8dd; padding-bottom: 12px;">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">📷 Ořez a pozicování fotografie (Poměr 16:9)</h3>
                <button type="button" class="btn-cancel-crop" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888;">&times;</button>
              </div>

              <p style="font-size: 13.5px; color: #55554e; margin: 0 0 16px 0;">
                💡 <strong>Táhněte za rohové body (šipky) pro změnu velikosti výřezu</strong>, nebo posouvejte mřížku uvnitř. Pravá strana okamžitě ukazuje živý náhled.
              </p>

              <div style="display: grid; grid-template-columns: 1fr 280px; gap: 20px; align-items: start;" class="crop-modal-grid">
                
                <!-- LEVÝ SLOUPEC: INTERAKTIVNÍ EDITOČNÍ PLOCHA -->
                <div>
                  <div style="position: relative; width: 100%; height: 320px; background: #111110; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; user-select: none; cursor: move; touch-action: none;" id="crop-viewport">
                    <canvas id="news-crop-canvas" width="560" height="315" style="display: block; max-width: 100%; max-height: 100%; border-radius: 4px;"></canvas>
                    <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); color: #ffffff; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; pointer-events: none;">
                      ↕️ Posunujte drag & drop
                    </div>
                  </div>

                  <!-- OVLÁDACÍ PRVKY ZOOM -->
                  <div style="margin-top: 14px; background: #fafaf7; border: 1px solid #e8e7de; border-radius: 8px; padding: 12px 16px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 8px;">
                      <label style="font-size: 12.5px; font-weight: 700; color: #1c1c19; display: flex; align-items: center; gap: 6px;">
                        🔍 Přiblížení (Zoom): <span id="crop-zoom-label" style="color: #4a5a24;">100 %</span>
                      </label>
                      <button type="button" id="btn-crop-reset" style="background: #ffffff; border: 1px solid #d8d5c9; border-radius: 4px; padding: 3px 10px; font-size: 11.5px; font-weight: 700; color: #4a5a24; cursor: pointer;">
                        🔄 Vycentrovat
                      </button>
                    </div>
                    <input type="range" id="crop-zoom-slider" min="1" max="3" step="0.05" value="${this.cropState?.zoom || 1}" style="width: 100%; accent-color: #4a5a24; cursor: pointer;">
                  </div>
                </div>

                <!-- PRAVÝ SLOUPEC: ŽIVÝ NÁHLED V REÁLNÉM ČASE -->
                <div>
                  <label style="font-size: 12.5px; font-weight: 700; color: #1c1c19; display: block; margin-bottom: 8px;">✨ Živý náhled na webu (16:9):</label>
                  <div style="position: relative; width: 100%; aspect-ratio: 16 / 9; background: #ece8dd; border-radius: 6px; overflow: hidden; border: 2px solid #4a5a24; box-shadow: 0 4px 16px rgba(0,0,0,0.12);">
                    <canvas id="news-preview-canvas" width="320" height="180" style="width: 100%; height: 100%; object-fit: cover; display: block;"></canvas>
                  </div>
                  <p style="font-size: 11.5px; color: #777; margin-top: 8px; line-height: 1.4;">
                    Takhle bude fotka vypadat u aktuality na hotelovém webu.
                  </p>
                </div>

              </div>

              <!-- SPODNÍ TLAČÍTKA -->
              <div style="margin-top: 20px; display: flex; align-items: center; justify-content: flex-end; gap: 12px; border-top: 1px solid #ece8dd; padding-top: 16px;">
                <button type="button" class="btn-cancel-crop" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 9px 18px; font-size: 13.5px; font-weight: 600; color: #444; cursor: pointer;">Zrušit</button>
                <button type="button" class="btn btn-booking-submit btn-confirm-crop" style="height: 42px; padding: 0 24px; font-size: 14px; font-weight: 700; border-radius: 4px;">✓ Oříznout a použít fotku</button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showDeleteNewsModal && this.pendingDeleteNewsItem ? `
          <div class="admin-modal-overlay admin-modal-overlay-delete-news" style="z-index: 10060;">
            <div class="admin-confirm-modal" style="max-width: 460px; width: 92%; padding: 24px; border-radius: 12px; background: #ffffff;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #ece8dd; padding-bottom: 12px;">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #c62828;">🗑️ Smazat aktualitu?</h3>
                <button type="button" class="btn-cancel-delete-news" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 0; line-height: 1;">&times;</button>
              </div>

              <p style="font-size: 14px; color: #444440; line-height: 1.5; margin: 0 0 20px 0;">
                Opravdu chcete nenávratně smazat aktualitu <strong>„${this.pendingDeleteNewsItem.title}“</strong>? Tato akce vymaže aktualitu ze všech stránek hotelu.
              </p>

              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-cancel-delete-news" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 9px 18px; font-size: 13.5px; font-weight: 600; color: #444; cursor: pointer;">
                  Zrušit
                </button>
                <button type="button" class="btn-confirm-delete-news" style="background: #c62828; border: none; border-radius: 4px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; color: #ffffff; cursor: pointer;">
                  🗑️ Ano, smazat aktualitu
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showReviewsModal ? this.renderReviewsModalMarkup(pendingReviewsCount, approvedReviewsCount) : ''}

        ${this.showDeleteReviewModal && this.pendingDeleteReview ? `
          <div class="admin-modal-overlay admin-modal-overlay-delete-review" style="z-index: 10070;">
            <div class="admin-confirm-modal" style="max-width: 460px; width: 92%; padding: 24px; border-radius: 12px; background: #ffffff; box-shadow: 0 10px 30px rgba(0,0,0,0.25);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #ece8dd; padding-bottom: 12px;">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #c62828;">🗑️ Potvrzení smazání recenze</h3>
                <button type="button" class="btn-cancel-delete-review" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #888; padding: 0; line-height: 1;">&times;</button>
              </div>

              <p style="font-size: 14px; color: #444440; line-height: 1.5; margin: 0 0 20px 0;">
                Opravdu chcete smazat / neschválit recenzi od hosta <strong>„${this.pendingDeleteReview.author_name || this.pendingDeleteReview.full_name || 'Host'}“</strong>? Záznam bude odstraněn z webu i databáze.
              </p>

              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                <button type="button" class="btn-cancel-delete-review" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 9px 18px; font-size: 13.5px; font-weight: 600; color: #444; cursor: pointer;">
                  Zrušit
                </button>
                <button type="button" class="btn-confirm-delete-review" style="background: #c62828; border: none; border-radius: 4px; padding: 9px 20px; font-size: 13.5px; font-weight: 700; color: #ffffff; cursor: pointer;">
                  🗑️ Ano, smazat recenzi
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.adminToastMessage ? `
          <div class="admin-toast-bottom-widget ${this.toastExiting ? 'is-exiting' : ''}">
            <div class="toast-inner-content">
              <span class="toast-icon-badge">✓</span>
              <span>${this.adminToastMessage}</span>
            </div>
            <div class="toast-progress-bar">
              <div class="toast-progress-fill"></div>
            </div>
          </div>
        ` : ''}
        ${this.renderAdminCalendarModal()}
      </div>
    `;

    this.attachAdminListeners();
  }

  renderReviewsModalMarkup(pendingCount, approvedCount) {
    const activeTab = this.reviewsTab || 'pending_approval';
    const list = (this.reviews || []).filter(r => {
      if (activeTab === 'pending' || activeTab === 'pending_approval') {
        return r.status === 'pending_approval' || r.status === 'pending';
      }
      return r.status === activeTab;
    });

    return `
      <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-reviews">
        <div class="admin-confirm-modal admin-block-modal" style="max-width: 780px; padding: 0 24px 24px 24px;">
          <div class="admin-modal-header-sticky">
            <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">⭐ Správa recenzí hostů</h3>
            <button type="button" class="btn-close-reviews-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
          </div>
          <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
            Zde můžete schvalovat nové recenze zaslané hosty přes web, nebo vymazat nevhodné recenze.
          </p>

          <!-- TLAČÍTKA TABŮ -->
          <div style="display: flex; gap: 10px; border-bottom: 1px solid #e8e7de; margin-bottom: 20px; padding-bottom: 10px;">
            <button type="button" class="review-tab-btn ${activeTab === 'pending_approval' || activeTab === 'pending' ? 'active' : ''}" data-tab="pending_approval" style="background: ${activeTab === 'pending_approval' || activeTab === 'pending' ? '#697947' : '#f2f2ee'}; color: ${activeTab === 'pending_approval' || activeTab === 'pending' ? '#ffffff' : '#333330'}; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13.5px; font-weight: 700; cursor: pointer;">
              Ke schválení ${pendingCount > 0 ? `<span style="background: #e67e22; color: #ffffff; border-radius: 99px; padding: 1px 7px; font-size: 11px; margin-left: 6px;">${pendingCount}</span>` : ''}
            </button>
            <button type="button" class="review-tab-btn ${activeTab === 'approved' ? 'active' : ''}" data-tab="approved" style="background: ${activeTab === 'approved' ? '#697947' : '#f2f2ee'}; color: ${activeTab === 'approved' ? '#ffffff' : '#333330'}; border: none; padding: 8px 16px; border-radius: 4px; font-size: 13.5px; font-weight: 700; cursor: pointer;">
              Schválené na webu (${approvedCount})
            </button>
          </div>

          <!-- SEZNAM RECENZÍ -->
          <div style="max-height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding-right: 4px;">
            ${list.length === 0 ? `
              <div style="text-align: center; padding: 32px 16px; color: #777; font-size: 14px; background: #fafaf7; border-radius: 6px; border: 1px dashed #ddd;">
                ${activeTab === 'pending_approval' || activeTab === 'pending' ? '✨ V současnosti nemáte žádné nové recenze ke schválení.' : 'Zatím nebyly schváleny žádné uživatelské recenze.'}
              </div>
            ` : list.map(r => `
              <div style="background: #ffffff; border: 1px solid #e8e7de; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 8px;">
                  <div>
                    <strong style="font-size: 15px; color: #1c1c19;">${r.full_name || r.author_name}</strong>
                    <span style="font-size: 12.5px; color: #697947; background: #edf2e4; padding: 2px 7px; border-radius: 4px; font-weight: 600; margin-left: 8px;">
                      GDPR: ${r.author_name}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 12.5px; color: #888880;">${r.date || ''}</span>
                  </div>
                </div>

                <p style="margin: 0 0 14px 0; font-size: 14px; color: #333330; line-height: 1.5; background: #fafaf7; padding: 12px; border-radius: 6px; border-left: 3px solid #697947;">
                  „${r.text}“
                </p>

                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                  ${r.status === 'pending_approval' || r.status === 'pending' ? `
                    <button type="button" class="btn-approve-review" data-id="${r.id}" style="background: #27ae60; color: #ffffff; border: none; border-radius: 4px; padding: 7px 16px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                      ✓ Schválit a zveřejnit
                    </button>
                    <button type="button" class="btn-reject-review" data-id="${r.id}" style="background: #fff0f0; color: #c62828; border: 1px solid #f5c6cb; border-radius: 4px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">
                      ✕ Zamítnout
                    </button>
                  ` : `
                    <button type="button" class="btn-reject-review" data-id="${r.id}" style="background: #fff0f0; color: #c62828; border: 1px solid #f5c6cb; border-radius: 4px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer;">
                      🗑️ Odstranit z webu
                    </button>
                  `}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  renderAdminCalendarModal() {
    if (!this.showAdminCalendarModal) return '';

    const currentDateStr = this.tempValidFrom || this.newDiscountForm.valid_from || new Date().toISOString().split('T')[0];

    if (!this.adminCalYearMonth) {
      const parts = (currentDateStr || '').split('-').map(Number);
      const y = parts[0] || new Date().getFullYear();
      const m = parts[1] || (new Date().getMonth() + 1);
      this.adminCalYearMonth = { year: y, month: m };
    }

    const { year, month } = this.adminCalYearMonth;

    const monthNames = [
      'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
      'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(year, month, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];
    const from = this.tempValidFrom;
    const until = this.tempValidUntil;

    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="cal-day cal-day-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const isStart = dayStr === from;
      const isEnd = dayStr === until;
      const isBetween = Boolean(from && until && dayStr > from && dayStr < until);
      const isPast = dayStr < todayStr;

      let dayClass = 'cal-day';
      let dayStyle = '';

      if (isStart || isEnd) {
        dayClass += ' is-selected';
        dayStyle = 'background-color: #eef3e6 !important; color: #1c1c19 !important; font-weight: 700 !important; border: none; border-radius: 1px;';
      } else if (isBetween) {
        dayClass += ' in-range';
        dayStyle = 'background-color: #eef3e6 !important; color: #697947 !important; font-weight: 600 !important; border: none; border-radius: 0;';
      } else if (isPast) {
        dayClass += ' is-disabled';
        dayStyle = 'color: #a0a098; font-weight: 400;';
      } else {
        dayStyle = 'color: #1a1a1a; font-weight: 500;';
      }

      daysHtml += `
        <button type="button" class="${dayClass}" data-date="${dayStr}" style="${dayStyle}">
          ${day}
        </button>
      `;
    }

    let summaryText = '';
    if (from && until) {
      const d1 = new Date(from);
      const d2 = new Date(until);
      const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      summaryText = `Platí od: <strong>${formatCzechDateStr(from)}</strong> | do: <strong>${formatCzechDateStr(until)}</strong> (${diffDays} ${diffDays === 1 ? 'den' : (diffDays < 5 ? 'dny' : 'dnů')})`;
    } else if (from) {
      summaryText = `Platí od: <strong>${formatCzechDateStr(from)}</strong> (vyberte konec platnosti)`;
    } else {
      summaryText = `Není vybráno žádné omezení (kód bude platit neomezeně)`;
    }

    return `
      <div class="cal-modal-overlay" id="admin-cal-modal-overlay" style="z-index: 100000;">
        <div class="cal-modal-card">
          <div class="cal-modal-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="cal-month-title">${monthNames[month - 1]} ${year}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-cal-nav cal-nav-btn" id="admin-cal-prev-month" title="Předchozí měsíc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-nav cal-nav-btn" id="admin-cal-next-month" title="Následující měsíc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-close cal-close-btn" id="admin-cal-close-btn" title="Zavřít kalendář">
                &times;
              </button>
            </div>
          </div>

          <div class="cal-week-days">
            <span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span>
          </div>

          <div class="cal-grid">
            ${daysHtml}
          </div>

          <div class="cal-modal-footer" style="padding: 16px 20px 20px 20px; border-top: 1px solid #e2e6d8; display: flex; flex-direction: column; gap: 14px; background: #ffffff;">
            <div style="font-size: 13.5px; color: #444440; line-height: 1.4; text-align: center;">
              ${summaryText}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <button type="button" id="btn-clear-admin-date" style="background: none; border: none; font-size: 13.5px; font-weight: 600; color: #c62828; cursor: pointer; text-decoration: underline; padding: 0;">
                Vynulovat výběr
              </button>
              <button type="button" id="btn-confirm-admin-date-range" class="btn btn-booking-submit" style="height: 42px; padding: 0 22px; font-size: 14.5px; font-weight: 700; border-radius: 2px; background: #697947; color: #ffffff; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                Potvrdit platnost
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachAdminListeners() {
    const filterRoom = document.getElementById('filter-room');
    const btnLogout = this.container.querySelector('.btn-admin-logout');
    const btnRefresh = this.container.querySelector('.btn-admin-refresh');
    const btnCancelDelete = this.container.querySelector('.btn-cancel-delete-modal');

    const btnDiscounts = this.container.querySelector('.btn-admin-discounts');
    if (btnDiscounts) {
      btnDiscounts.addEventListener('click', async () => {
        await this.fetchDiscountCodes();
        this.showDiscountModal = true;
        this.render();
      });
    }

    const btnCloseDiscountModal = this.container.querySelector('.btn-close-discount-modal');
    if (btnCloseDiscountModal) {
      btnCloseDiscountModal.addEventListener('click', () => {
        this.showDiscountModal = false;
        this.render();
      });
    }

    const discountModalOverlay = this.container.querySelector('.admin-modal-overlay-discount');
    if (discountModalOverlay) {
      discountModalOverlay.addEventListener('click', (e) => {
        if (e.target === discountModalOverlay) {
          this.showDiscountModal = false;
          this.render();
        }
      });
    }

    const discountCodeInputEl = this.container.querySelector('#discount-code-input');
    if (discountCodeInputEl) {
      discountCodeInputEl.addEventListener('input', (e) => {
        this.newDiscountForm.code = e.target.value;
      });
    }

    const discountValInputEl = this.container.querySelector('#discount-value-input');
    if (discountValInputEl) {
      discountValInputEl.addEventListener('input', (e) => {
        this.newDiscountForm.discount_value = e.target.value;
      });
    }

    const discountMaxUsesInputEl = this.container.querySelector('#discount-max-uses-input');
    if (discountMaxUsesInputEl) {
      discountMaxUsesInputEl.addEventListener('input', (e) => {
        this.newDiscountForm.max_uses = e.target.value;
      });
    }

    const btnSaveDiscount = this.container.querySelector('.btn-save-discount-code');
    if (btnSaveDiscount) {
      btnSaveDiscount.addEventListener('click', () => {
        const codeInput = this.container.querySelector('#discount-code-input');
        const valInput = this.container.querySelector('#discount-value-input');
        const maxUsesInput = this.container.querySelector('#discount-max-uses-input');

        const code = codeInput ? codeInput.value : '';
        const val = valInput ? valInput.value : 5;
        const validFrom = this.newDiscountForm.valid_from || null;
        const validUntil = this.newDiscountForm.valid_until || null;
        const maxUses = maxUsesInput ? maxUsesInput.value : null;

        this.addDiscountCode(code, val, 'percent', validFrom, validUntil, maxUses);
      });
    }

    const btnDiscountValidity = this.container.querySelector('#btn-trigger-discount-validity');
    if (btnDiscountValidity) {
      btnDiscountValidity.addEventListener('click', (e) => {
        if (e.target.closest('#btn-clear-discount-validity-inline')) {
          e.preventDefault();
          e.stopPropagation();
          this.newDiscountForm.valid_from = '';
          this.newDiscountForm.valid_until = '';
          this.tempValidFrom = '';
          this.tempValidUntil = '';
          this.render();
          return;
        }

        this.tempValidFrom = this.newDiscountForm.valid_from || '';
        this.tempValidUntil = this.newDiscountForm.valid_until || '';
        const initialDate = this.tempValidFrom || new Date().toISOString().split('T')[0];
        const [y, m] = initialDate.split('-').map(Number);
        this.adminCalYearMonth = { year: y || new Date().getFullYear(), month: m || (new Date().getMonth() + 1) };
        this.showAdminCalendarModal = true;
        this.render();
      });
    }

    const adminCalOverlay = this.container.querySelector('#admin-cal-modal-overlay');
    if (adminCalOverlay) {
      const btnPrev = adminCalOverlay.querySelector('#admin-cal-prev-month');
      const btnNext = adminCalOverlay.querySelector('#admin-cal-next-month');
      const btnClose = adminCalOverlay.querySelector('#admin-cal-close-btn');
      const btnClear = adminCalOverlay.querySelector('#btn-clear-admin-date');
      const btnConfirmRange = adminCalOverlay.querySelector('#btn-confirm-admin-date-range');

      if (btnPrev) {
        btnPrev.addEventListener('click', (e) => {
          e.preventDefault();
          let { year, month } = this.adminCalYearMonth || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
          month--;
          if (month < 1) { month = 12; year--; }
          this.adminCalYearMonth = { year, month };
          this.render();
        });
      }

      if (btnNext) {
        btnNext.addEventListener('click', (e) => {
          e.preventDefault();
          let { year, month } = this.adminCalYearMonth || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
          month++;
          if (month > 12) { month = 1; year++; }
          this.adminCalYearMonth = { year, month };
          this.render();
        });
      }

      if (btnClose) {
        btnClose.addEventListener('click', (e) => {
          e.preventDefault();
          this.showAdminCalendarModal = false;
          this.render();
        });
      }

      if (btnClear) {
        btnClear.addEventListener('click', (e) => {
          e.preventDefault();
          this.tempValidFrom = '';
          this.tempValidUntil = '';
          this.newDiscountForm.valid_from = '';
          this.newDiscountForm.valid_until = '';
          this.render();
        });
      }

      if (btnConfirmRange) {
        btnConfirmRange.addEventListener('click', (e) => {
          e.preventDefault();
          this.newDiscountForm.valid_from = this.tempValidFrom || '';
          this.newDiscountForm.valid_until = this.tempValidUntil || '';
          this.showAdminCalendarModal = false;
          this.render();
        });
      }

      adminCalOverlay.addEventListener('click', (e) => {
        if (e.target === adminCalOverlay) {
          this.showAdminCalendarModal = false;
          this.render();
        }
      });

      adminCalOverlay.querySelectorAll('.cal-day:not(.cal-day-empty)').forEach(dayBtn => {
        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const selectedDate = dayBtn.dataset.date;
          if (!this.tempValidFrom) {
            this.tempValidFrom = selectedDate;
            this.tempValidUntil = '';
          } else if (this.tempValidFrom && !this.tempValidUntil) {
            if (selectedDate > this.tempValidFrom) {
              this.tempValidUntil = selectedDate;
            } else {
              this.tempValidFrom = selectedDate;
              this.tempValidUntil = '';
            }
          } else {
            this.tempValidFrom = selectedDate;
            this.tempValidUntil = '';
          }
          this.render();
        });
      });
    }

    this.container.querySelectorAll('.btn-toggle-discount-active').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const newStatus = e.currentTarget.dataset.active === 'true';
        this.toggleDiscountCodeActive(id, newStatus);
      });
    });

    this.container.querySelectorAll('.btn-delete-discount-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.deleteDiscountCode(id);
      });
    });

    /**
     * Otevře ceník okamžitě, čerstvá data dorazí až potom.
     *
     * Dřív se čekalo na dvě volání do databáze, než se okno vůbec
     * ukázalo — po kliknutí se skoro vteřinu nedělo nic a obsluha
     * klikala znovu. Rozcestník ke svému vykreslení žádná data
     * nepotřebuje, takže se ukáže hned a překreslí se, jakmile data
     * dojdou. Na rozcestníku není co přepsat pod rukama.
     */
    const otevriCenik = async () => {
      // Vždy od rozcestníku, ať uživatel nespadne doprostřed minulé úpravy
      this.cenikKrok = 'rozcestnik';
      this.cenikVyjimkyOtevrene = false;
      this.showPricesModal = true;

      // Rozcestník sám žádná data nepotřebuje. Načítání se hlásí jen
      // tehdy, když ceník ještě vůbec nemáme — jinak je co ukázat hned.
      const bezDat = ((this.cenik && this.cenik.sezony) || []).length === 0;
      this.cenikNacita = bezDat;
      this.render();

      try {
        const [, cenik] = await Promise.all([this.fetchRoomPrices(), fetchCenik()]);
        this.cenik = cenik;
      } catch (err) {
        console.error('Načtení ceníku selhalo:', err);
      }
      this.cenikNacita = false;

      // Překreslit jen tehdy, když je opravdu co vyměnit — tedy když se
      // ukazovalo načítání. Jinak by se celá administrace překreslila
      // podruhé a okno by viditelně bliklo, přestože se na rozcestníku
      // nic nezměnilo. Čerstvá data se použijí při dalším překreslení,
      // které stejně přijde s prvním klikem na kartu.
      if (this.showPricesModal && bezDat) this.render();
    };

    const btnPrices = this.container.querySelector('.btn-admin-prices, .btn-admin-room-prices');
    if (btnPrices) {
      btnPrices.addEventListener('click', otevriCenik);
    }

    const btnDisabledRooms = this.container.querySelector('.btn-admin-disabled-rooms');
    if (btnDisabledRooms) {
      btnDisabledRooms.addEventListener('click', async () => {
        await this.fetchDisabledRooms();
        this.showDisabledRoomsModal = true;
        this.render();
      });
    }

    const btnCloseDisabledModal = this.container.querySelector('.btn-close-disabled-modal');
    if (btnCloseDisabledModal) {
      btnCloseDisabledModal.addEventListener('click', () => {
        this.showDisabledRoomsModal = false;
        this.render();
      });
    }

    const disabledModalOverlay = this.container.querySelector('.admin-modal-overlay-disabled');
    if (disabledModalOverlay) {
      disabledModalOverlay.addEventListener('click', (e) => {
        if (e.target === disabledModalOverlay) {
          this.showDisabledRoomsModal = false;
          this.render();
        }
      });
    }

    // Vyřazení pokoje z provozu se nejdřív potvrzuje — dřív stačilo
    // jedno kliknutí a pokoj hned zmizel z nabídky.
    this.container.querySelectorAll('.btn-toggle-room-disabled').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = e.currentTarget.dataset.roomid;
        const block = e.currentTarget.dataset.action === 'block';
        const rm = MOCK_ROOMS.find(r => r.id === roomId);
        this.pendingRoomBlock = { roomId, block, name: rm ? rm.name : roomId };
        this.showConfirmRoomBlockModal = true;
        this.render();
      });
    });

    this.container.querySelectorAll('.btn-cancel-room-block').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showConfirmRoomBlockModal = false;
        this.pendingRoomBlock = null;
        this.render();
      });
    });

    const prekrytiRoomBlock = this.container.querySelector('.admin-modal-overlay-confirm-room-block');
    if (prekrytiRoomBlock) {
      prekrytiRoomBlock.addEventListener('click', (e) => {
        if (e.target === prekrytiRoomBlock) {
          this.showConfirmRoomBlockModal = false;
          this.pendingRoomBlock = null;
          this.render();
        }
      });
    }

    const btnPotvrdRoomBlock = this.container.querySelector('.btn-confirm-room-block');
    if (btnPotvrdRoomBlock) {
      btnPotvrdRoomBlock.addEventListener('click', () => {
        if (!this.pendingRoomBlock) return;
        const { roomId, block } = this.pendingRoomBlock;
        this.showConfirmRoomBlockModal = false;
        this.pendingRoomBlock = null;
        this.toggleRoomDisabled(roomId, block);
      });
    }

    // Okno s ceníkem si obsluhuje vlastní modul (AdminCenik.js)
    bindCenikModal(this);

    // Ruční založení rezervace — vlastní modul (AdminRucniRezervace.js)
    const btnNovaRezervace = this.container.querySelector('.btn-admin-nova-rezervace');
    if (btnNovaRezervace) {
      btnNovaRezervace.addEventListener('click', () => this.otevriRucniRezervaci());
    }
    bindRucniRezervaceModal(this);

    // Přehled dostupnosti — vlastní modul (AdminDostupnost.js)
    const btnPrehled = this.container.querySelector('.btn-admin-prehled');
    if (btnPrehled) {
      btnPrehled.addEventListener('click', () => {
        this.prehled = prazdnyPrehled();
        this.showPrehledModal = true;
        this.render();
      });
    }
    bindDostupnostModal(this);

    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', () => {
        this.showDeleteModal = false;
        this.pendingDeleteReservation = null;
        this.render();
      });
    }

    const btnArchiveTab = this.container.querySelector('.btn-admin-archive-tab');
    if (btnArchiveTab) {
      btnArchiveTab.addEventListener('click', () => {
        this.statusFilter = 'archived';
        this.render();
      });
    }

    if (filterRoom) {
      filterRoom.addEventListener('change', (e) => {
        this.selectedRoomFilter = e.target.value;
        this.render();
      });
    }

    this.container.querySelectorAll('.status-tab-btn').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const status = tab.dataset.status || tab.closest('.status-tab-btn').dataset.status;
        if (status) {
          this.statusFilter = status;
          this.render();
        }
      });
    });

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.isAuthenticated = false;
        try {
          localStorage.removeItem(ADMIN_SESSION_KEY);
        } catch (err) {}
        this.render();
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        btnRefresh.disabled = true;
        btnRefresh.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle; animation: spin 0.8s linear infinite;"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"/></svg>
          Načítám...
        `;
        await this.fetchReservations();
        this.showAdminToast('Data byla úspěšně aktualizována.');
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-admin-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act) {
          await this.advanceReservationPhase(id, act);
        }
      });
    });

    this.container.querySelectorAll('.admin-res-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button, a, input, select, textarea, .drawer-guest-entry, .btn-drawer-delete-clean')) {
          return;
        }
        const id = card.dataset.id;
        if (id) {
          this.expandedReservationId = (this.expandedReservationId === id) ? null : id;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-details-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        this.expandedReservationId = (this.expandedReservationId === id) ? null : id;
        this.render();
      });
    });

    this.container.querySelectorAll('.guest-entry-header').forEach(hdr => {
      hdr.addEventListener('click', (e) => {
        const entry = hdr.closest('.drawer-guest-entry');
        if (entry) {
          const isOpen = entry.classList.toggle('is-open');
          const label = entry.querySelector('.guest-toggle-label');
          if (label) {
            label.textContent = isOpen ? 'Sbalit' : 'Rozbalit';
          }
        }
      });
    });

    // ====================================================
    // HANDLERY PRO SPRÁVU RECENZÍ
    // ====================================================
    const btnAdminReviews = this.container.querySelector('.btn-admin-reviews');
    if (btnAdminReviews) {
      btnAdminReviews.addEventListener('click', async () => {
        await this.fetchReviews();
        this.showReviewsModal = true;
        this.render();
      });
    }

    const btnCloseReviewsModal = this.container.querySelector('.btn-close-reviews-modal');
    if (btnCloseReviewsModal) {
      btnCloseReviewsModal.addEventListener('click', () => {
        this.showReviewsModal = false;
        this.render();
      });
    }

    const reviewsOverlay = this.container.querySelector('.admin-modal-overlay-reviews');
    if (reviewsOverlay) {
      reviewsOverlay.addEventListener('click', (e) => {
        if (e.target === reviewsOverlay) {
          this.showReviewsModal = false;
          this.render();
        }
      });
    }

    this.container.querySelectorAll('.review-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.reviewsTab = btn.dataset.tab;
        this.render();
      });
    });

    this.container.querySelectorAll('.btn-approve-review').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const res = await updateStoredReviewStatus(id, 'approved');
        await this.fetchReviews();
        if (res && res.error) {
          this.showAdminToast(`⚠️ Schválení selhalo: ${res.error.message || res.error}`);
        } else {
          this.showAdminToast('Recenze byla schválena a přidána na web.');
        }
        this.render();
      });
    });

    this.container.querySelectorAll('.btn-reject-review').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.dataset.id;
        const review = (this.reviews || []).find(r => String(r.id) === String(id));
        if (review) {
          this.pendingDeleteReview = review;
          this.showDeleteReviewModal = true;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-cancel-delete-review').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showDeleteReviewModal = false;
        this.pendingDeleteReview = null;
        this.render();
      });
    });

    const overlayDeleteReview = this.container.querySelector('.admin-modal-overlay-delete-review');
    if (overlayDeleteReview) {
      overlayDeleteReview.addEventListener('click', (e) => {
        if (e.target === overlayDeleteReview) {
          this.showDeleteReviewModal = false;
          this.pendingDeleteReview = null;
          this.render();
        }
      });
    }

    const btnConfirmDeleteReview = this.container.querySelector('.btn-confirm-delete-review');
    if (btnConfirmDeleteReview) {
      btnConfirmDeleteReview.addEventListener('click', async () => {
        if (this.pendingDeleteReview) {
          const id = this.pendingDeleteReview.id;
          this.showDeleteReviewModal = false;
          this.pendingDeleteReview = null;
          const res = await updateStoredReviewStatus(id, 'rejected');
          await this.fetchReviews();
          if (res && res.error) {
            this.showAdminToast(`⚠️ Odstranění selhalo: ${res.error.message || res.error}`);
          } else {
            this.showAdminToast('Recenze byla úspěšně odstraněna.');
          }
          this.render();
        }
      });
    }

    // ====================================================
    // HANDLERY PRO SPRÁVU AKTUALIT & 16:9 OŘEZÁVÁTKO
    // ====================================================
    const btnAdminNews = this.container.querySelector('.btn-admin-news');
    if (btnAdminNews) {
      btnAdminNews.addEventListener('click', () => {
        this.showNewsModal = true;
        this.render();
      });
    }

    const btnCloseNewsModal = this.container.querySelector('.btn-close-news-modal');
    if (btnCloseNewsModal) {
      btnCloseNewsModal.addEventListener('click', () => {
        this.showNewsModal = false;
        this.editingNewsItem = null;
        this.newsForm = { title: '', banner_text: '', content: '', is_active: true, is_banner: false, image_url: '' };
        this.render();
      });
    }

    const newsModalOverlay = this.container.querySelector('.admin-modal-overlay-news');
    if (newsModalOverlay) {
      newsModalOverlay.addEventListener('click', (e) => {
        if (e.target === newsModalOverlay) {
          this.showNewsModal = false;
          this.editingNewsItem = null;
          this.newsForm = { title: '', banner_text: '', content: '', is_active: true, is_banner: false, image_url: '' };
          this.render();
        }
      });
    }

    const btnResetNewsForm = this.container.querySelector('.btn-reset-news-form');
    if (btnResetNewsForm) {
      btnResetNewsForm.addEventListener('click', () => {
        this.editingNewsItem = null;
        this.newsForm = { title: '', banner_text: '', content: '', is_active: true, is_banner: false, image_url: '' };
        this.render();
      });
    }

    const newsTitleInput = this.container.querySelector('#news-title-input');
    const newsBannerTextInput = this.container.querySelector('#news-banner-text-input');
    const newsContentInput = this.container.querySelector('#news-content-input');
    const newsIsActiveCheck = this.container.querySelector('#news-is-active-check');
    const newsIsBannerCheck = this.container.querySelector('#news-is-banner-check');

    if (newsTitleInput) newsTitleInput.addEventListener('input', e => { this.newsForm.title = e.target.value; });
    if (newsBannerTextInput) newsBannerTextInput.addEventListener('input', e => { this.newsForm.banner_text = e.target.value; });
    if (newsContentInput) newsContentInput.addEventListener('input', e => { this.newsForm.content = e.target.value; });
    if (newsIsActiveCheck) newsIsActiveCheck.addEventListener('change', e => { this.newsForm.is_active = e.target.checked; });
    if (newsIsBannerCheck) newsIsBannerCheck.addEventListener('change', e => {
      this.newsForm.is_banner = e.target.checked;
      // Přepnutí v DOM, ne přes render() — překreslení by zahodilo rozepsaný text.
      const wrap = this.container.querySelector('#news-banner-text-wrap');
      if (wrap) wrap.style.display = e.target.checked ? '' : 'none';
    });

    const btnRemoveNewsPhoto = this.container.querySelector('.btn-remove-news-photo');
    if (btnRemoveNewsPhoto) {
      btnRemoveNewsPhoto.addEventListener('click', () => {
        this.newsForm.image_url = '';
        this.render();
      });
    }

    const btnTriggerPhotoUpload = this.container.querySelector('.btn-trigger-photo-upload');
    const newsPhotoFileInput = this.container.querySelector('#news-photo-file-input');

    if (btnTriggerPhotoUpload && newsPhotoFileInput) {
      btnTriggerPhotoUpload.addEventListener('click', () => {
        newsPhotoFileInput.click();
      });

      newsPhotoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          this.cropImageSrc = evt.target.result;
          this.showCropModal = true;
          this.render();
          this.initCropCanvas();
        };
        reader.readAsDataURL(file);
      });
    }

    const btnSaveNewsItem = this.container.querySelector('.btn-save-news-item');
    if (btnSaveNewsItem) {
      btnSaveNewsItem.addEventListener('click', async () => {
        const title = (newsTitleInput ? newsTitleInput.value : this.newsForm.title || '').trim();
        const content = (newsContentInput ? newsContentInput.value : this.newsForm.content || '').trim();
        const banner_text = (newsBannerTextInput ? newsBannerTextInput.value : this.newsForm.banner_text || '').trim();
        const is_active = newsIsActiveCheck ? newsIsActiveCheck.checked : this.newsForm.is_active;
        const is_banner = newsIsBannerCheck ? newsIsBannerCheck.checked : this.newsForm.is_banner;

        if (!title) {
          this.showAdminToast('⚠️ Vyplňte nadpis aktuality.');
          return;
        }
        if (!content) {
          this.showAdminToast('⚠️ Vyplňte hlavní text aktuality.');
          return;
        }

        btnSaveNewsItem.disabled = true;
        btnSaveNewsItem.textContent = 'Ukládám...';

        const payload = {
          id: this.editingNewsItem ? this.editingNewsItem.id : null,
          title,
          content,
          banner_text,
          is_active,
          is_banner,
          image_url: this.newsForm.image_url || null
        };

        const result = await saveStoredNewsItem(payload);
        if (result.success) {
          this.showAdminToast(this.editingNewsItem ? '✓ Aktualita byla úspěšně upravena.' : '🎉 Nová aktualita byla úspěšně přidána.');
          this.editingNewsItem = null;
          this.newsForm = { title: '', banner_text: '', content: '', is_active: true, is_banner: false, image_url: '' };
          await this.fetchNewsItems();
        } else {
          this.showAdminToast('⚠️ Aktualitu se nepodařilo uložit.');
        }
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-edit-news-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const item = this.newsItems.find(n => String(n.id) === String(id));
        if (item) {
          this.editingNewsItem = item;
          this.newsForm = {
            title: item.title || '',
            banner_text: item.banner_text || '',
            content: item.content || '',
            is_active: Boolean(item.is_active),
            is_banner: Boolean(item.is_banner),
            image_url: item.image_url || ''
          };
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-reorder-news-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const dir = btn.dataset.dir;
        if (id && dir) {
          const res = await reorderNewsItem(id, dir);
          if (res.success) {
            this.showAdminToast(dir === 'up' ? '▲ Pořadí posunuto nahoru.' : '▼ Pořadí posunuto dolů.');
            await this.fetchNewsItems();
            this.render();
          }
        }
      });
    });

    this.container.querySelectorAll('.btn-delete-news-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        const item = (this.newsItems || []).find(n => String(n.id) === String(id));
        if (item) {
          this.pendingDeleteNewsItem = item;
          this.showDeleteNewsModal = true;
          this.render();
        }
      });
    });

    this.container.querySelectorAll('.btn-cancel-delete-news').forEach(btn => {
      btn.addEventListener('click', () => {
        this.showDeleteNewsModal = false;
        this.pendingDeleteNewsItem = null;
        this.render();
      });
    });

    const deleteNewsModalOverlay = this.container.querySelector('.admin-modal-overlay-delete-news');
    if (deleteNewsModalOverlay) {
      deleteNewsModalOverlay.addEventListener('click', (e) => {
        if (e.target === deleteNewsModalOverlay) {
          this.showDeleteNewsModal = false;
          this.pendingDeleteNewsItem = null;
          this.render();
        }
      });
    }

    const btnConfirmDeleteNews = this.container.querySelector('.btn-confirm-delete-news');
    if (btnConfirmDeleteNews) {
      btnConfirmDeleteNews.addEventListener('click', async () => {
        if (!this.pendingDeleteNewsItem) return;
        btnConfirmDeleteNews.disabled = true;
        btnConfirmDeleteNews.textContent = 'Mazám...';

        // Výsledek se musí ověřit — dřív se hlásilo „smazáno“ i tehdy,
        // když mazání selhalo, a aktualita zůstala hostům na webu.
        const vysledek = await deleteStoredNewsItem(this.pendingDeleteNewsItem.id);
        this.showAdminToast(vysledek && vysledek.success
          ? '🗑️ Aktualita byla úspěšně smazána.'
          : '⚠️ Aktualitu se nepodařilo smazat. Zkuste to prosím znovu.');
        this.showDeleteNewsModal = false;
        this.pendingDeleteNewsItem = null;
        await this.fetchNewsItems();
        this.render();
      });
    }

    const btnCancelCrop = this.container.querySelector('.btn-cancel-crop');
    if (btnCancelCrop) {
      btnCancelCrop.addEventListener('click', () => {
        this.showCropModal = false;
        this.cropImageSrc = null;
        this.render();
      });
    }

    const btnConfirmCrop = this.container.querySelector('.btn-confirm-crop');
    if (btnConfirmCrop) {
      btnConfirmCrop.addEventListener('click', async () => {
        const canvas = this.container.querySelector('#news-crop-canvas');
        if (!canvas || !this.cropLoadedImg || !this.cropBox) return;
        btnConfirmCrop.disabled = true;
        btnConfirmCrop.textContent = 'Nahrávám fotku...';

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = 1280;
        exportCanvas.height = 720;
        const eCtx = exportCanvas.getContext('2d');

        const cw = canvas.width;
        const ch = canvas.height;
        const scaleX = this.cropLoadedImg.width / cw;
        const scaleY = this.cropLoadedImg.height / ch;

        const sx = Math.max(0, this.cropBox.x * scaleX);
        const sy = Math.max(0, this.cropBox.y * scaleY);
        const sw = Math.min(this.cropLoadedImg.width - sx, this.cropBox.w * scaleX);
        const sh = Math.min(this.cropLoadedImg.height - sy, this.cropBox.h * scaleY);

        eCtx.drawImage(this.cropLoadedImg, sx, sy, sw, sh, 0, 0, 1280, 720);

        exportCanvas.toBlob(async (blob) => {
          let selhalo = false;
          if (blob) {
            const uploadRes = await uploadNewsImage(blob);
            if (uploadRes.success && uploadRes.url) {
              this.newsForm.image_url = uploadRes.url;
              this.showAdminToast('📷 Fotografie 16:9 byla úspěšně nahraná.');
            } else {
              // Dřív se fotka při neúspěchu vložila jako base64 přímo do
              // databáze a obsluze se hlásil úspěch. Řádek pak měl stovky
              // kilobajtů, stahoval ho každý návštěvník a skutečná příčina
              // (chybějící úložiště) zůstala skrytá.
              selhalo = true;
              this.newsForm.image_url = '';
              this.showAdminToast('⚠️ Fotku se nepodařilo nahrát. Aktualitu lze uložit bez ní, fotku zkuste přidat později.');
            }
          }
          this.showCropModal = false;
          this.cropImageSrc = null;
          this.cropBox = null;
          this.render();
          if (selhalo) console.error('Nahrání fotky aktuality selhalo — zkontrolujte úložiště aktuality-images v Supabase.');
        }, 'image/jpeg', 0.90);
      });
    }
  }

  initCropCanvas() {
    setTimeout(() => {
      const viewport = this.container.querySelector('#crop-viewport');
      const canvas = this.container.querySelector('#news-crop-canvas');
      const previewCanvas = this.container.querySelector('#news-preview-canvas');
      const zoomSlider = this.container.querySelector('#crop-zoom-slider');
      const zoomLabel = this.container.querySelector('#crop-zoom-label');
      const btnReset = this.container.querySelector('#btn-crop-reset');

      if (!canvas || !this.cropImageSrc) return;

      const img = new Image();
      img.onload = () => {
        this.cropLoadedImg = img;

        const cw = 560;
        const ch = 315; // 16:9 ratio
        canvas.width = cw;
        canvas.height = ch;

        const targetAspect = 16 / 9;
        let boxW = cw * 0.85;
        let boxH = boxW / targetAspect;
        if (boxH > ch * 0.85) {
          boxH = ch * 0.85;
          boxW = boxH * targetAspect;
        }

        const defaultCenterBox = {
          x: (cw - boxW) / 2,
          y: (ch - boxH) / 2,
          w: boxW,
          h: boxH
        };

        this.cropBox = this.cropBox || { ...defaultCenterBox };

        const handleRadius = 14;

        const render = () => {
          if (!canvas || !this.cropLoadedImg) return;
          const ctx = canvas.getContext('2d');
          const pCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

          ctx.clearRect(0, 0, cw, ch);

          // 1. Draw full original image fitted inside canvas
          ctx.drawImage(img, 0, 0, cw, ch);

          const { x, y, w, h } = this.cropBox;

          // 2. Fill dark overlay OUTSIDE the crop box
          ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
          ctx.fillRect(0, 0, cw, Math.max(0, y));
          ctx.fillRect(0, y + h, cw, Math.max(0, ch - (y + h)));
          ctx.fillRect(0, y, Math.max(0, x), h);
          ctx.fillRect(x + w, y, Math.max(0, cw - (x + w)), h);

          // 3. Draw Rule of Thirds Grid Lines inside crop box
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);

          ctx.beginPath();
          ctx.moveTo(x + w / 3, y); ctx.lineTo(x + w / 3, y + h);
          ctx.moveTo(x + (w / 3) * 2, y); ctx.lineTo(x + (w / 3) * 2, y + h);
          ctx.moveTo(x, y + h / 3); ctx.lineTo(x + w, y + h / 3);
          ctx.moveTo(x, y + (h / 3) * 2); ctx.lineTo(x + w, y + (h / 3) * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // 4. Draw Crop Box Border
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);

          // 5. Draw 4 Corner Drag Handles (Figma / Instagram style)
          const handles = [
            { id: 'nw', cx: x, cy: y },
            { id: 'ne', cx: x + w, cy: y },
            { id: 'sw', cx: x, cy: y + h },
            { id: 'se', cx: x + w, cy: y + h }
          ];

          handles.forEach(hnd => {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#4a5a24';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(hnd.cx, hnd.cy, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#4a5a24';
            ctx.beginPath();
            ctx.arc(hnd.cx, hnd.cy, 3, 0, Math.PI * 2);
            ctx.fill();
          });

          // 6. Update High-Res Real-Time Live Preview Canvas (16:9)
          if (pCtx && previewCanvas) {
            previewCanvas.width = 320;
            previewCanvas.height = 180;
            pCtx.clearRect(0, 0, 320, 180);

            const scaleX = img.width / cw;
            const scaleY = img.height / ch;

            const sx = Math.max(0, x * scaleX);
            const sy = Math.max(0, y * scaleY);
            const sw = Math.min(img.width - sx, w * scaleX);
            const sh = Math.min(img.height - sy, h * scaleY);

            pCtx.drawImage(img, sx, sy, sw, sh, 0, 0, 320, 180);
          }
        };

        render();

        const getHandle = (px, py) => {
          const { x, y, w, h } = this.cropBox;
          const dist = (hx, hy) => Math.hypot(px - hx, py - hy);

          if (dist(x, y) <= handleRadius + 6) return 'nw';
          if (dist(x + w, y) <= handleRadius + 6) return 'ne';
          if (dist(x, y + h) <= handleRadius + 6) return 'sw';
          if (dist(x + w, y + h) <= handleRadius + 6) return 'se';
          if (px >= x && px <= x + w && py >= y && py <= y + h) return 'move';
          return null;
        };

        let draggingHandle = null;
        let startX = 0, startY = 0;
        let dragStartBox = null;

        const getCanvasCoords = (e) => {
          const rect = canvas.getBoundingClientRect();
          const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
          const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
          return {
            x: (clientX - rect.left) * (cw / rect.width),
            y: (clientY - rect.top) * (ch / rect.height)
          };
        };

        const onMouseDown = (e) => {
          const coords = getCanvasCoords(e);
          draggingHandle = getHandle(coords.x, coords.y);

          if (draggingHandle) {
            startX = coords.x;
            startY = coords.y;
            dragStartBox = { ...this.cropBox };
          }
        };

        const onMouseMove = (e) => {
          const coords = getCanvasCoords(e);

          if (!draggingHandle) {
            const hnd = getHandle(coords.x, coords.y);
            if (hnd === 'nw' || hnd === 'se') canvas.style.cursor = 'nwse-resize';
            else if (hnd === 'ne' || hnd === 'sw') canvas.style.cursor = 'nesw-resize';
            else if (hnd === 'move') canvas.style.cursor = 'move';
            else canvas.style.cursor = 'default';
            return;
          }

          const dx = coords.x - startX;
          const dy = coords.y - startY;
          const minW = 40;

          if (draggingHandle === 'move') {
            let newX = dragStartBox.x + dx;
            let newY = dragStartBox.y + dy;
            newX = Math.max(0, Math.min(cw - dragStartBox.w, newX));
            newY = Math.max(0, Math.min(ch - dragStartBox.h, newY));
            this.cropBox.x = newX;
            this.cropBox.y = newY;
          } else if (draggingHandle === 'se') {
            let newW = Math.max(minW, Math.min(cw - dragStartBox.x, dragStartBox.w + dx));
            let newH = newW / targetAspect;
            if (dragStartBox.y + newH > ch) {
              newH = ch - dragStartBox.y;
              newW = newH * targetAspect;
            }
            this.cropBox.w = newW;
            this.cropBox.h = newH;
          } else if (draggingHandle === 'sw') {
            let newW = Math.max(minW, dragStartBox.w - dx);
            let newX = dragStartBox.x + (dragStartBox.w - newW);
            let newH = newW / targetAspect;
            if (newX < 0) {
              newX = 0;
              newW = dragStartBox.x + dragStartBox.w;
              newH = newW / targetAspect;
            }
            if (dragStartBox.y + newH > ch) {
              newH = ch - dragStartBox.y;
              newW = newH * targetAspect;
              newX = dragStartBox.x + dragStartBox.w - newW;
            }
            this.cropBox.x = newX;
            this.cropBox.w = newW;
            this.cropBox.h = newH;
          } else if (draggingHandle === 'ne') {
            let newW = Math.max(minW, Math.min(cw - dragStartBox.x, dragStartBox.w + dx));
            let newH = newW / targetAspect;
            let newY = dragStartBox.y + (dragStartBox.h - newH);
            if (newY < 0) {
              newY = 0;
              newH = dragStartBox.y + dragStartBox.h;
              newW = newH * targetAspect;
            }
            this.cropBox.y = newY;
            this.cropBox.w = newW;
            this.cropBox.h = newH;
          } else if (draggingHandle === 'nw') {
            let newW = Math.max(minW, dragStartBox.w - dx);
            let newX = dragStartBox.x + (dragStartBox.w - newW);
            let newH = newW / targetAspect;
            let newY = dragStartBox.y + (dragStartBox.h - newH);
            if (newX < 0) {
              newX = 0;
              newW = dragStartBox.x + dragStartBox.w;
              newH = newW / targetAspect;
              newY = dragStartBox.y + dragStartBox.h - newH;
            }
            if (newY < 0) {
              newY = 0;
              newH = dragStartBox.y + dragStartBox.h;
              newW = newH * targetAspect;
              newX = dragStartBox.x + dragStartBox.w - newW;
            }
            this.cropBox.x = newX;
            this.cropBox.y = newY;
            this.cropBox.w = newW;
            this.cropBox.h = newH;
          }

          render();
        };

        const onMouseUp = () => {
          draggingHandle = null;
        };

        canvas.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        canvas.addEventListener('touchstart', onMouseDown, { passive: true });
        window.addEventListener('touchmove', onMouseMove, { passive: true });
        window.addEventListener('touchend', onMouseUp);

        if (zoomSlider) {
          zoomSlider.addEventListener('input', (e) => {
            const factor = parseFloat(e.target.value);
            const baseW = cw * 0.85;
            const baseH = baseW / targetAspect;
            const minW = 40;
            const newW = Math.max(minW, Math.min(cw, baseW * (1 / factor)));
            const newH = newW / targetAspect;

            const centerX = this.cropBox.x + this.cropBox.w / 2;
            const centerY = this.cropBox.y + this.cropBox.h / 2;

            let newX = centerX - newW / 2;
            let newY = centerY - newH / 2;

            newX = Math.max(0, Math.min(cw - newW, newX));
            newY = Math.max(0, Math.min(ch - newH, newY));

            this.cropBox = { x: newX, y: newY, w: newW, h: newH };
            if (zoomLabel) zoomLabel.textContent = `${Math.round(factor * 100)} %`;
            render();
          });
        }

        if (btnReset) {
          btnReset.addEventListener('click', () => {
            this.cropBox = { ...defaultCenterBox };
            if (zoomSlider) zoomSlider.value = 1;
            if (zoomLabel) zoomLabel.textContent = '100 %';
            render();
          });
        }
      };
      img.src = this.cropImageSrc;
    }, 50);
  }
}
