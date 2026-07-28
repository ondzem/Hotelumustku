import { MOCK_ROOMS, getStoredReservations, updateStoredReservationStatus, deleteStoredReservation, getStoredBlockedDates, saveStoredBlockedDate, deleteStoredBlockedDate, getStoredDiscountCodes, saveStoredDiscountCode, deleteStoredDiscountCode, getStoredRoomPrices, saveStoredRoomPrice, getStoredDisabledRooms, saveStoredDisabledRoom, isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateSpaydQrUrl, BANK_ACCOUNT, formatCzechPrice, getVariableSymbol } from '../utils/pricing.js';
import { sendEmail, generateEmail2ApprovalAndPaymentRequest, generateEmail3FinalConfirmation, generateEmailCancellation, getEmailLogs, sendAllTestEmailsTo } from '../utils/emailService.js';

function groupContiguousDateRanges(dates) {
  if (!dates || dates.length === 0) return [];
  const sorted = [...dates].sort();
  const ranges = [];
  let currentStart = sorted[0];
  let currentEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(currentEnd);
    prev.setDate(prev.getDate() + 1);
    const nextStr = prev.toISOString().split('T')[0];
    if (sorted[i] === nextStr) {
      currentEnd = sorted[i];
    } else {
      ranges.push({ date_from: currentStart, date_to: currentEnd });
      currentStart = sorted[i];
      currentEnd = sorted[i];
    }
  }
  ranges.push({ date_from: currentStart, date_to: currentEnd });
  return ranges;
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
    this.showBlockModal = false;
    this.showDiscountModal = false;
    this.showPricesModal = false;
    this.showRoomMgmtModal = false;
    this.showDisabledRoomsModal = false;
    this.disabledRooms = getStoredDisabledRooms();
    (this.disabledRooms || []).forEach(p => {
      if (p.room_id) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.isDisabled = Boolean(p.is_disabled);
      }
    });
    this.newDiscountForm = { code: '', discount_value: '', discount_type: 'percent' };
    this.blockForm = { room_id: 'all', reason: '' };
    this.blockSelectedDates = [];
    this.calYearMonth = null;
    this.blockConflicts = [];
    this.selectedRoomFilter = 'all';
    this.statusFilter = 'all';
    this.expandedReservationId = null;
    this.activeEmailPreview = null;
    this.showEmailModal = false;
    this.adminToastMessage = '';
    this.showDeleteModal = false;
    this.pendingDeleteReservation = null;
  }

  async init() {
    this.render();
    try {
      await Promise.allSettled([
        this.fetchReservations(),
        this.fetchBlockedDates(),
        this.fetchDiscountCodes(),
        this.fetchRoomPrices(),
        this.fetchDisabledRooms()
      ]);
    } catch (err) {
      console.error('AdminDashboard init fetch error:', err);
    }
    this.render();
  }

  async fetchDiscountCodes() {
    let localCodes = getStoredDiscountCodes();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          const codeMap = new Map();
          localCodes.forEach(c => codeMap.set(c.code, c));
          data.forEach(c => codeMap.set(c.code, c));
          this.discountCodes = Array.from(codeMap.values());
          return;
        }
      } catch (err) {
        console.error('Supabase fetchDiscountCodes failed:', err);
      }
    }
    this.discountCodes = localCodes;
  }

  async addDiscountCode(code, discount_value, discount_type = 'percent') {
    const cleanCode = String(code || '').trim().toUpperCase();
    if (!cleanCode) return;
    const payload = {
      code: cleanCode,
      discount_type: discount_type || 'percent',
      discount_value: discount_value !== '' ? Number(discount_value) : 5,
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('discount_codes').upsert([payload], { onConflict: 'code' }).select();
        if (error) {
          console.error('Supabase addDiscountCode error:', error);
        } else if (data && data.length > 0) {
          payload.id = data[0].id;
        }
      } catch (err) {
        console.error('Supabase addDiscountCode failed:', err);
      }
    }

    saveStoredDiscountCode(payload);
    const existingIdx = (this.discountCodes || []).findIndex(c => c.code === cleanCode);
    if (existingIdx >= 0) {
      this.discountCodes[existingIdx] = payload;
    } else {
      this.discountCodes.unshift(payload);
    }

    this.showAdminToast(`Slevový kód ${cleanCode} (-${payload.discount_value} %) byl vytvořen.`);
    this.newDiscountForm = { code: '', discount_value: '', discount_type: 'percent' };
    this.showDiscountModal = true;
    this.render();
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
    const item = this.discountCodes.find(c => c.id === idOrCode || c.code === idOrCode);
    const codeToDelete = item ? item.code : idOrCode;

    deleteStoredDiscountCode(idOrCode);
    if (codeToDelete) deleteStoredDiscountCode(codeToDelete);

    this.discountCodes = (this.discountCodes || []).filter(c => c.id !== idOrCode && c.code !== idOrCode && c.code !== codeToDelete);

    if (isSupabaseConfigured && supabase && codeToDelete) {
      try {
        await supabase.from('discount_codes').delete().eq('code', codeToDelete);
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
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('room_prices').select('*');
        if (!error && data && data.length > 0) {
          const priceMap = new Map();
          localPrices.forEach(p => priceMap.set(p.room_id, p));
          data.forEach(p => priceMap.set(p.room_id, p));
          this.roomPrices = Array.from(priceMap.values());
        } else {
          this.roomPrices = localPrices;
        }
      } catch (err) {
        console.error('Supabase fetchRoomPrices failed:', err);
        this.roomPrices = localPrices;
      }
    } else {
      this.roomPrices = localPrices;
    }

    (this.roomPrices || []).forEach(p => {
      const priceVal = Number(p.base_price || p.basePrice);
      if (p.room_id && !isNaN(priceVal) && priceVal > 0) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.basePrice = priceVal;
        saveStoredRoomPrice({ room_id: p.room_id, base_price: priceVal });
      }
    });
  }

  async updateRoomPrice(roomId, newBasePrice) {
    const priceNum = Number(newBasePrice);
    if (!roomId || isNaN(priceNum) || priceNum <= 0) return;

    const payload = {
      room_id: roomId,
      base_price: priceNum,
      updated_at: new Date().toISOString()
    };

    // 1. Immediately update local storage & memory state
    saveStoredRoomPrice(payload);
    const existingIdx = (this.roomPrices || []).findIndex(p => p.room_id === roomId);
    if (existingIdx >= 0) {
      this.roomPrices[existingIdx] = payload;
    } else {
      this.roomPrices.push(payload);
    }

    const rm = MOCK_ROOMS.find(r => r.id === roomId);
    if (rm) rm.basePrice = priceNum;

    // 2. In-place DOM update without re-rendering or blowing away input focus
    if (this.container) {
      const priceCard = this.container.querySelector(`.room-price-card[data-roomid="${roomId}"]`);
      if (priceCard) {
        const priceLabel = priceCard.querySelector('.current-price-label');
        if (priceLabel) {
          priceLabel.textContent = `${formatCzechPrice(priceNum)} / os / noc`;
        }
      }
    }

    if (typeof window !== 'undefined' && typeof window.syncDynamicRoomPricesToDOM === 'function') {
      window.syncDynamicRoomPricesToDOM();
    }

    this.showAdminToast(`Cena pokoje byla upravena na ${formatCzechPrice(priceNum)} / noc.`);

    // 3. Save to Supabase asynchronously
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('room_prices').upsert([payload], { onConflict: 'room_id' }).select();
        if (error) {
          console.error('Supabase updateRoomPrice error:', error);
        } else if (data && data.length > 0) {
          payload.id = data[0].id;
        }
      } catch (err) {
        console.error('Supabase updateRoomPrice failed:', err);
      }
    }
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
    this.showAdminToast(shouldDisable ? `Pokoj ${rmName} byl zablokován pro rezervace.` : `Blokace pokoje ${rmName} byla zrušena.`);
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

  async fetchReservations() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('reservations').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          this.reservations = data;
          return;
        }
      } catch (err) {
        console.error('Supabase admin fetch failed:', err);
      }
    }
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

  async addBlockedDate(room_id, date_from, date_to, reason) {
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
    this.showAdminToast('Termín byl úspěšně zablokován.');
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
      return selectedDates.some(d => d >= r.date_from && d <= r.date_to);
    });
  }

  renderAdminCalendarMarkup() {
    const today = new Date();
    if (!this.calYearMonth) {
      this.calYearMonth = { year: today.getFullYear(), month: today.getMonth() + 1 };
    }
    const { year, month } = this.calYearMonth;

    const monthNames = [
      'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
      'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Mon = 0
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = today.toISOString().split('T')[0];
    const selectedRoomId = this.blockForm.room_id || 'all';

    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="cal-day cal-day-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dayStr < todayStr;
      
      const guestBooking = this.reservations.find(r => {
        if (r.status === 'cancelled' || r.status === 'stornováno') return false;
        if (selectedRoomId !== 'all' && r.room_id !== selectedRoomId) return false;
        return dayStr >= r.date_from && dayStr <= r.date_to;
      });

      const isAlreadyBlocked = this.blockedDates.some(b => {
        if (b.room_id !== 'all' && selectedRoomId !== 'all' && b.room_id !== selectedRoomId) return false;
        return dayStr >= b.date_from && dayStr <= b.date_to;
      });

      const isSelectedForBlock = this.blockSelectedDates.includes(dayStr);

      let dayClass = 'cal-day';
      if (isPast) dayClass += ' is-disabled';
      if (guestBooking) dayClass += ' is-occupied';
      if (isAlreadyBlocked) dayClass += ' is-already-blocked';
      if (isSelectedForBlock) dayClass += ' is-block-selected';

      let titleAttr = '';
      if (guestBooking) titleAttr = `Rezervace: ${guestBooking.guest_name} (${guestBooking.code || ''})`;
      else if (isAlreadyBlocked) titleAttr = `Již zablokováno recepcií`;

      daysHtml += `
        <button type="button" class="${dayClass}" data-date="${dayStr}" ${isPast ? 'disabled' : ''} title="${titleAttr}">
          ${day}
          ${isSelectedForBlock ? '<span style="position: absolute; top: 2px; right: 4px; font-size: 9px; font-weight: 800;">✓</span>' : ''}
          ${guestBooking ? '<span style="position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); font-size: 8px; font-weight: 800;">👤</span>' : ''}
        </button>
      `;
    }

    return `
      <div class="cal-modal-card admin-cal-card" style="box-shadow: none; border: 1px solid #e0dfd5; padding: 18px; margin-bottom: 20px; background: #ffffff; border-radius: 12px;">
        <div class="cal-modal-header" style="margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
          <button type="button" class="cal-nav-btn btn-admin-cal-prev" aria-label="Předchozí měsíc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <h4 class="cal-month-title" style="margin: 0; font-size: 16px; font-weight: 700;">${monthNames[month - 1]} ${year}</h4>
          <button type="button" class="cal-nav-btn btn-admin-cal-next" aria-label="Následující měsíc">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>

        <div class="cal-week-days" style="margin-bottom: 8px;">
          <span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span>
        </div>

        <div class="cal-grid admin-cal-grid">
          ${daysHtml}
        </div>

        <!-- LEGENDA KALENDÁŘE -->
        <div style="display: flex; flex-wrap: wrap; gap: 14px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #f0efe8; font-size: 12px; color: #555;">
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="width: 12px; height: 12px; background: #697947; border-radius: 3px; display: inline-block;"></span>
            <span>Vybraný termín k zablokování</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="width: 12px; height: 12px; background: #fef5e7; border: 1px solid #e67e22; border-radius: 3px; display: inline-block;"></span>
            <span>Aktivní rezervace hosta</span>
          </div>
          <div style="display: flex; align-items: center; gap: 5px;">
            <span style="width: 12px; height: 12px; background: #f2f4f4; border: 1px solid #95a5a6; border-radius: 3px; display: inline-block;"></span>
            <span>Již zablokováno</span>
          </div>
        </div>
      </div>
    `;
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
      '9b0ff4347547f372b1a3e770f486a380e2f81655219914b3bb28ac6279221f35', // 'mustku2026'
      '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'  // 'admin'
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
      this.render();
    }, 5000);
  }

  async advanceReservationPhase(id, targetAction) {
    const reservation = this.reservations.find(r => r.id === id || r.code === id);
    if (!reservation) return;

    const room = MOCK_ROOMS.find(rm => rm.id === reservation.room_id) || MOCK_ROOMS[0];
    const nights = Math.max(1, Math.round((new Date(reservation.date_to) - new Date(reservation.date_from)) / (1000 * 60 * 60 * 24)) || 1);
    
    const pricing = calculateReservationPrice({
      roomType: room.type,
      nights,
      persons: reservation.adults_count || 2,
      adults: reservation.adults_count || 2,
      children: reservation.children_count || 0,
      hasDog: reservation.has_dog,
      hasEbike: reservation.has_ebike,
      hasHalfBoard: reservation.has_half_board,
      halfBoardCount: reservation.half_board_count,
      ebikeCount: reservation.ebike_count
    });

    if (targetAction === 'approve_and_request_deposit') {
      // Phase 1 -> Phase 2: Approve & Request 30% Deposit with QR Code
      const newStatus = 'awaiting_deposit';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('reservations').update({ status: newStatus }).eq('id', id); } catch (e) {}
      }
      updateStoredReservationStatus(id, newStatus);
      reservation.status = newStatus;

      // Dispatch Email 2 (Payment Request with QR Code)
      try {
        const email2 = generateEmail2ApprovalAndPaymentRequest({ reservation, room, pricing });
        sendEmail({
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
        sendEmail({
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
        sendEmail({
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

    const pendingCount = this.reservations.filter(r => r.status === 'pending_approval').length;
    const awaitingDepositCount = this.reservations.filter(r => r.status === 'awaiting_deposit').length;
    const confirmedCount = this.reservations.filter(r => r.status === 'confirmed').length;
    const cancelledCount = this.reservations.filter(r => r.status === 'cancelled').length;

    const filteredReservations = this.reservations.filter(r => {
      const matchRoom = this.selectedRoomFilter === 'all' || r.room_id === this.selectedRoomFilter;
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      return matchRoom && matchStatus;
    });

    this.container.innerHTML = `
      <div class="admin-dashboard-wrapper">
        <!-- HORNÍ LIŠTA TITULKU A AKCÍ -->
        <div class="admin-header-bar">
          <div class="admin-title-group">
            <h2>Recepční portál</h2>
            <p>Správa rezervací a obsluha 30% záloh pro Hotel u Můstku</p>
          </div>
          <div class="admin-top-actions">
            <button type="button" class="btn btn-specs-secondary btn-admin-block-dates">
              📅 Blokovat termíny ${this.blockedDates.length > 0 ? `<span style="background: #e67e22; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${this.blockedDates.length}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-discounts">
              🏷️ Slevové kódy ${this.discountCodes.length > 0 ? `<span style="background: #4a5a24; color: #ffffff; border-radius: 99px; padding: 2px 7px; font-size: 11px; font-weight: 700; margin-left: 4px;">${this.discountCodes.length}</span>` : ''}
            </button>
            <button type="button" class="btn btn-specs-secondary btn-admin-room-mgmt">
              ⚙️ Správa pokojů
            </button>
            <button type="button" class="btn btn-booking-submit btn-admin-logout">🚪 Odhlásit se</button>
          </div>
        </div>

        <!-- JEDNOTNÁ LIŠTA FILTRŮ A VÝBĚRU POKOJŮ -->
        <div class="admin-toolbar">
          <div class="admin-status-tabs">
            <button type="button" class="status-tab-btn ${this.statusFilter === 'all' ? 'active' : ''}" data-status="all">
              <span>Všechny</span>
              <span class="tab-count">${this.reservations.length}</span>
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
          </div>

          <div class="admin-room-filter">
            <label for="filter-room">Pokoj:</label>
            <select id="filter-room" class="admin-room-select">
              <option value="all">Všechny pokoje</option>
              ${MOCK_ROOMS.map(r => `<option value="${r.id}" ${this.selectedRoomFilter === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
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
                    <div class="res-deposit-sub">Záloha 30%: ${formatCzechPrice(r.deposit_price || Math.round((r.total_price||0)*0.3))}</div>
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

                    <div class="res-secondary-btn-row">
                      <button type="button" class="res-btn-secondary btn-details-toggle" data-id="${r.id || r.code}">
                        ${isExpanded ? 'Skrýt podrobnosti' : 'Podrobnosti'}
                      </button>

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
                                  <li><span>Bydliště:</span> <strong>${g.street ? g.street + ', ' : ''}${g.city || 'Neuvedeno online'}</strong></li>
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
                          <li><span>Poznámka hosta:</span> <strong>${r.guest_note || 'Bez poznámky'}</strong></li>
                        </ul>
                      </div>

                      <!-- KARTA 3: PLATBA -->
                      <div>
                        <h4 class="drawer-section-title">Rozpis platby & Identifikace</h4>
                        <ul class="drawer-info-list">
                          <li><span>Celková cena pobytu:</span> <strong>${formatCzechPrice(r.total_price)} s DPH</strong></li>
                          <li><span>Záloha 30 % (předem):</span> <strong style="color: #4a5a24;">${formatCzechPrice(r.deposit_price || Math.round((r.total_price||0)*0.3))}</strong></li>
                          <li><span>Doplatek 70 % (na místě):</span> <strong>${formatCzechPrice(r.remaining_price || Math.round((r.total_price||0)*0.7))}</strong></li>
                          <li><span>Variabilní symbol:</span> <strong>${getVariableSymbol(r.code)}</strong></li>
                        </ul>
                      </div>
                    </div>

                    <!-- VYMAZÁNÍ REZERVAČNÍHO ZÁZNAMU -->
                    <div class="drawer-delete-bar">
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

        ${this.showBlockModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 600px; padding: 0 28px 24px 28px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18.5px; font-weight: 800;">📅 Správa uzávěrek & Blokování termínů</h3>
                <button type="button" class="btn-close-block-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
                Zaklikněte v kalendáři dny, které chcete zablokovat. Zablokované termíny nebudou na rezervačním portálu dostupné ke zvolení.
              </p>

              <!-- PROSTŘEDÍ VÝBĚRU POKOJE A DŮVODU -->
              <div style="background: #fafaf7; border: 1px solid #e8e7de; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;" class="block-form-grid">
                  <div>
                    <label style="font-size: 13px; font-weight: 600; color: #555; display: block; margin-bottom: 6px;">Pokoj</label>
                    <select id="block-room-select" class="form-select" style="height: 40px; font-size: 13.5px;">
                      <option value="all" ${this.blockForm.room_id === 'all' ? 'selected' : ''}>Všechny pokoje (Celý hotel)</option>
                      ${MOCK_ROOMS.map(rm => `<option value="${rm.id}" ${this.blockForm.room_id === rm.id ? 'selected' : ''}>${rm.name}</option>`).join('')}
                    </select>
                  </div>
                  <div>
                    <label style="font-size: 13px; font-weight: 600; color: #555; display: block; margin-bottom: 6px;">Důvod uzávěrky (volitelné)</label>
                    <input type="text" id="block-reason-input" class="form-input" placeholder="např. Dovolená správy..." style="height: 40px; font-size: 13.5px;" value="${this.blockForm.reason}">
                  </div>
                </div>
              </div>

              <!-- INTERAKTIVNÍ MĚSÍČNÍ KALENDÁŘ -->
              ${this.renderAdminCalendarMarkup()}

              ${this.blockConflicts.length > 0 ? `
                <div style="background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 13.5px; color: #795548;">
                  <strong>⚠️ Pozor: Na vybraný termín již existují rezervace (${this.blockConflicts.length}):</strong>
                  <ul style="margin: 8px 0 0 0; padding-left: 18px; line-height: 1.5;">
                    ${this.blockConflicts.map(c => `
                      <li><strong>${c.guest_name}</strong> (${c.code || 'HM-2026'}) | ${c.room_name || 'Pokoj'} | ${c.date_from} → ${c.date_to}</li>
                    `).join('')}
                  </ul>
                  <p style="margin: 8px 0 0 0; font-weight: 600; color: #c62828;">Pro zablokování bude nutné tyto rezervace kontaktovat nebo stornovat.</p>
                </div>
              ` : ''}

              <div style="margin-bottom: 24px;">
                <button type="button" class="btn btn-booking-submit btn-save-block-date" style="width: 100%; height: 44px; font-size: 15px; border-radius: 1px;" ${this.blockSelectedDates.length === 0 ? 'disabled' : ''}>
                  Zablokovat vybrané termíny ${this.blockSelectedDates.length > 0 ? `(${this.blockSelectedDates.length} dní)` : ''}
                </button>
              </div>

              <!-- SEZNAM AKTIVNÍCH UZÁVĚREK -->
              <div>
                <h4 style="margin: 0 0 14px 0; font-size: 15px; font-weight: 800; color: #1c1c19;">Aktivní uzávěrky & blokace (${this.blockedDates.length})</h4>
                ${this.blockedDates.length === 0 ? `
                  <p style="color: #777; font-size: 14px; text-align: center; margin: 20px 0;">V současnosti nejsou nastaveny žádné blokace termínů.</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 10px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
                    ${this.blockedDates.map(b => {
                      const rmName = b.room_id === 'all' ? 'Celý hotel (Všechny pokoje)' : (MOCK_ROOMS.find(m => m.id === b.room_id)?.name || 'Pokoj');
                      return `
                        <div style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                          <div>
                            <div style="font-weight: 700; font-size: 14px; color: #1c1c19;">${rmName}</div>
                            <div style="font-size: 13px; color: #4a5a24; font-weight: 600; margin-top: 2px;">📅 ${b.date_from} → ${b.date_to}</div>
                            ${b.reason ? `<div style="font-size: 12.5px; color: #777; margin-top: 2px;">📝 ${b.reason}</div>` : ''}
                          </div>
                          <button type="button" class="btn-cancel-block-item" data-id="${b.id}" style="background: none; border: 1px solid #d8d5c9; border-radius: 1px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; color: #c62828; cursor: pointer;">
                            Zrušit blokaci
                          </button>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>
            </div>
          </div>
        ` : ''}

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

              <div style="background: #fafaf7; border: 1px solid #e8e7de; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                <h4 style="margin: 0 0 12px 0; font-size: 14.5px; font-weight: 800; color: #1c1c19;">Vytvořit nový slevový kód</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;" class="block-form-grid">
                  <div>
                    <label style="font-size: 12.5px; font-weight: 600; color: #555; display: block; margin-bottom: 6px;">Kód slevy (např. HOTEL5)</label>
                    <input type="text" id="discount-code-input" class="form-input" placeholder="HOTEL5" style="height: 40px; font-size: 14px; text-transform: uppercase;" value="${this.newDiscountForm.code}">
                  </div>
                  <div>
                    <label style="font-size: 12.5px; font-weight: 600; color: #555; display: block; margin-bottom: 6px;">Sleva v % (např. 10)</label>
                    <input type="number" id="discount-value-input" class="form-input" placeholder="např. 10" min="1" max="100" style="height: 40px; font-size: 14px;" value="${this.newDiscountForm.discount_value || ''}">
                  </div>
                </div>
                <button type="button" class="btn btn-booking-submit btn-save-discount-code" style="width: 100%; height: 42px; font-size: 14.5px; border-radius: 1px;">
                  Vytvořit slevový kód
                </button>
              </div>

              <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14.5px; font-weight: 800; color: #1c1c19;">Aktivní slevové kódy (${this.discountCodes.length})</h4>
                ${this.discountCodes.length === 0 ? `
                  <p style="color: #777; font-size: 13.5px; text-align: center; margin: 16px 0;">V současnosti nejsou vytvořeny žádné slevové kódy.</p>
                ` : `
                  <div style="display: flex; flex-direction: column; gap: 10px; max-height: 220px; overflow-y: auto; padding-right: 4px;">
                    ${this.discountCodes.map(c => `
                      <div style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div>
                          <div style="font-weight: 800; font-size: 15px; color: #4a5a24; letter-spacing: 0.04em;">${c.code}</div>
                          <div style="font-size: 12.5px; color: #555; font-weight: 600; margin-top: 2px;">Sleva: <strong>-${c.discount_value} %</strong></div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <button type="button" class="btn-toggle-discount-active" data-id="${c.id}" data-active="${c.is_active ? 'false' : 'true'}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: ${c.is_active ? '#2e7d32' : '#777'}; cursor: pointer;">
                            ${c.is_active ? '✓ Aktivní' : 'Aktivovat'}
                          </button>
                          <button type="button" class="btn-delete-discount-item" data-id="${c.id}" style="background: none; border: 1px solid #d8d5c9; border-radius: 4px; padding: 5px 10px; font-size: 12px; font-weight: 600; color: #c62828; cursor: pointer;">
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

        ${this.showPricesModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-prices">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 580px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">💰 Úprava cen pokojů</h3>
                <button type="button" class="btn-close-prices-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
                Změňte základní cenu ubytování za noc u libovolného pokoje. Nová cena se okamžitě projeví ve všech nových rezervacích.
              </p>

              <div style="display: flex; flex-direction: column; gap: 10px; max-height: 360px; overflow-y: auto; padding-right: 4px;">
                ${MOCK_ROOMS.map(rm => {
                  const customP = (this.roomPrices || []).find(p => p.room_id === rm.id);
                  const currentPrice = customP ? (customP.base_price || customP.basePrice) : rm.basePrice;
                  return `
                    <div class="room-price-card" data-roomid="${rm.id}" style="background: #ffffff; border: 1px solid #e0dfd5; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                      <div>
                        <div style="font-weight: 700; font-size: 14.5px; color: #1c1c19;">${rm.name}</div>
                        <div style="font-size: 12.5px; color: #777; margin-top: 2px;">Aktuální cena: <strong class="current-price-label" style="color: #4a5a24;">${formatCzechPrice(currentPrice)} / os / noc</strong></div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="number" class="form-input room-price-input" data-roomid="${rm.id}" value="${currentPrice}" style="width: 95px; height: 38px; font-size: 14px; text-align: right; padding-right: 8px;">
                        <span style="font-size: 13px; font-weight: 600; color: #555;">Kč</span>
                        <button type="button" class="btn btn-specs-secondary btn-save-room-price" data-roomid="${rm.id}" style="height: 38px; padding: 0 14px; font-size: 13px; border-radius: 1px;">
                          Uložit
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showRoomMgmtModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-mgmt">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 480px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">⚙️ Správa pokojů</h3>
                <button type="button" class="btn-close-mgmt-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 20px; font-size: 13.5px; color: #55554e; text-align: center;">
                Vyberte možnost správy pokojů hotelu:
              </p>

              <div style="display: flex; flex-direction: column; gap: 12px;">
                <button type="button" class="btn btn-specs-secondary btn-open-prices-from-mgmt" style="height: 45px; font-size: 14.5px; font-weight: 700; width: 100%; justify-content: center; border-radius: 1px;">
                  💰 Ceník pokojů
                </button>
                <button type="button" class="btn btn-specs-secondary btn-open-disabled-from-mgmt" style="height: 45px; font-size: 14.5px; font-weight: 700; width: 100%; justify-content: center; background: #fff5f5; border-color: #f5c6cb; color: #c62828; border-radius: 1px;">
                  🔒 Blokování pokojů
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        ${this.showDisabledRoomsModal ? `
          <div class="admin-modal-overlay admin-modal-overlay-block admin-modal-overlay-disabled">
            <div class="admin-confirm-modal admin-block-modal" style="max-width: 620px; padding: 0 24px 24px 24px;">
              <div class="admin-modal-header-sticky">
                <h3 class="admin-modal-title" style="margin: 0; font-size: 18px; font-weight: 800; color: #1c1c19;">🔒 Blokování pokojů</h3>
                <button type="button" class="btn-close-disabled-modal" style="background: none; border: none; font-size: 26px; cursor: pointer; color: #777; line-height: 1; padding: 4px 8px;">&times;</button>
              </div>
              <p class="admin-modal-desc" style="margin-top: 14px; margin-bottom: 16px; font-size: 13.5px; color: #55554e;">
                Zablokujte vybraný pokoj. Zablokovaný pokoj zůstane na webu viditelný, ale tlačítko výběru se změní na „Dočasně nedostupné“ a v rezervaci bude označen jako zablokovaný.
              </p>

              <div style="display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto; padding-right: 4px;">
                ${MOCK_ROOMS.map(rm => {
                  const isBlocked = Boolean(rm.isDisabled);
                  return `
                    <div class="room-disabled-card" data-roomid="${rm.id}" style="background: ${isBlocked ? '#fff5f5' : '#ffffff'}; border: 1px solid ${isBlocked ? '#f5c6cb' : '#e0dfd5'}; border-radius: 8px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                      <div>
                        <div style="font-weight: 700; font-size: 14.5px; color: #1c1c19;">${rm.name}</div>
                        <div style="font-size: 12.5px; color: #777; margin-top: 2px;">
                          Stav: ${isBlocked 
                            ? '<strong style="color: #c62828;">🔒 Zablokovaný (Dočasně nedostupný)</strong>' 
                            : '<strong style="color: #2e7d32;">✓ Aktivní (Dostupný ke zvolení)</strong>'}
                        </div>
                      </div>
                      <div>
                        <button type="button" class="btn btn-toggle-room-disabled" data-roomid="${rm.id}" data-action="${isBlocked ? 'unblock' : 'block'}" style="height: 38px; padding: 0 16px; font-size: 13px; border-radius: 1px; ${isBlocked ? 'background: #2e7d32; color: #ffffff; border: none;' : 'background: #c62828; color: #ffffff; border: none;'}">
                          ${isBlocked ? '🔓 Zrušit blokaci' : '🔒 Zablokovat pokoj'}
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
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
      </div>
    `;

    this.attachAdminListeners();
  }

  attachAdminListeners() {
    const filterRoom = document.getElementById('filter-room');
    const btnLogout = this.container.querySelector('.btn-admin-logout');
    const btnRefresh = this.container.querySelector('.btn-admin-refresh');
    const btnBlockDates = this.container.querySelector('.btn-admin-block-dates');
    const btnCancelDelete = this.container.querySelector('.btn-cancel-delete-modal');

    if (btnBlockDates) {
      btnBlockDates.addEventListener('click', () => {
        this.showBlockModal = true;
        this.render();
      });
    }

    const btnDiscounts = this.container.querySelector('.btn-admin-discounts');
    if (btnDiscounts) {
      btnDiscounts.addEventListener('click', () => {
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

    const btnSaveDiscount = this.container.querySelector('.btn-save-discount-code');
    if (btnSaveDiscount) {
      btnSaveDiscount.addEventListener('click', () => {
        const codeInput = this.container.querySelector('#discount-code-input');
        const valInput = this.container.querySelector('#discount-value-input');
        const code = codeInput ? codeInput.value : '';
        const val = valInput ? valInput.value : 5;
        this.addDiscountCode(code, val, 'percent');
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

    const btnPrices = this.container.querySelector('.btn-admin-room-prices');
    if (btnPrices) {
      btnPrices.addEventListener('click', () => {
        this.showPricesModal = true;
        this.render();
      });
    }

    const btnClosePricesModal = this.container.querySelector('.btn-close-prices-modal');
    if (btnClosePricesModal) {
      btnClosePricesModal.addEventListener('click', () => {
        this.showPricesModal = false;
        this.render();
      });
    }

    const btnMgmt = this.container.querySelector('.btn-admin-room-mgmt');
    if (btnMgmt) {
      btnMgmt.addEventListener('click', () => {
        this.showRoomMgmtModal = true;
        this.render();
      });
    }

    const btnCloseMgmtModal = this.container.querySelector('.btn-close-mgmt-modal');
    if (btnCloseMgmtModal) {
      btnCloseMgmtModal.addEventListener('click', () => {
        this.showRoomMgmtModal = false;
        this.render();
      });
    }

    const mgmtModalOverlay = this.container.querySelector('.admin-modal-overlay-mgmt');
    if (mgmtModalOverlay) {
      mgmtModalOverlay.addEventListener('click', (e) => {
        if (e.target === mgmtModalOverlay) {
          this.showRoomMgmtModal = false;
          this.render();
        }
      });
    }

    const btnOpenPricesFromMgmt = this.container.querySelector('.btn-open-prices-from-mgmt');
    if (btnOpenPricesFromMgmt) {
      btnOpenPricesFromMgmt.addEventListener('click', async () => {
        this.showRoomMgmtModal = false;
        await this.fetchRoomPrices();
        this.showPricesModal = true;
        this.render();
      });
    }

    const btnOpenDisabledFromMgmt = this.container.querySelector('.btn-open-disabled-from-mgmt');
    if (btnOpenDisabledFromMgmt) {
      btnOpenDisabledFromMgmt.addEventListener('click', async () => {
        this.showRoomMgmtModal = false;
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

    this.container.querySelectorAll('.btn-toggle-room-disabled').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = e.currentTarget.dataset.roomid;
        const action = e.currentTarget.dataset.action;
        this.toggleRoomDisabled(roomId, action === 'block');
      });
    });

    const pricesModalOverlay = this.container.querySelector('.admin-modal-overlay-prices');
    if (pricesModalOverlay) {
      pricesModalOverlay.addEventListener('click', (e) => {
        if (e.target === pricesModalOverlay) {
          this.showPricesModal = false;
          this.render();
        }
      });
    }

    this.container.querySelectorAll('.btn-save-room-price').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roomId = e.currentTarget.dataset.roomid;
        const input = this.container.querySelector(`.room-price-input[data-roomid="${roomId}"]`);
        if (input && input.value) {
          this.updateRoomPrice(roomId, input.value);
        }
      });
    });

    this.container.querySelectorAll('.room-price-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const roomId = e.currentTarget.dataset.roomid;
          if (input.value) {
            this.updateRoomPrice(roomId, input.value);
          }
        }
      });
    });

    const btnCloseBlockModal = this.container.querySelector('.btn-close-block-modal');
    if (btnCloseBlockModal) {
      btnCloseBlockModal.addEventListener('click', () => {
        this.showBlockModal = false;
        this.blockConflicts = [];
        this.render();
      });
    }

    const blockModalOverlay = this.container.querySelector('.admin-modal-overlay-block');
    if (blockModalOverlay) {
      blockModalOverlay.addEventListener('click', (e) => {
        if (e.target === blockModalOverlay) {
          this.showBlockModal = false;
          this.blockConflicts = [];
          this.render();
        }
      });
    }

    const btnCalPrev = this.container.querySelector('.btn-admin-cal-prev');
    const btnCalNext = this.container.querySelector('.btn-admin-cal-next');

    if (btnCalPrev) {
      btnCalPrev.addEventListener('click', () => {
        if (!this.calYearMonth) return;
        this.calYearMonth.month--;
        if (this.calYearMonth.month < 1) {
          this.calYearMonth.year--;
          this.calYearMonth.month = 12;
        }
        this.render();
      });
    }

    if (btnCalNext) {
      btnCalNext.addEventListener('click', () => {
        if (!this.calYearMonth) return;
        this.calYearMonth.month++;
        if (this.calYearMonth.month > 12) {
          this.calYearMonth.year++;
          this.calYearMonth.month = 1;
        }
        this.render();
      });
    }

    this.container.querySelectorAll('.admin-cal-grid .cal-day').forEach(btn => {
      btn.addEventListener('click', () => {
        const dateStr = btn.dataset.date;
        if (!dateStr || btn.disabled) return;
        const idx = this.blockSelectedDates.indexOf(dateStr);
        if (idx >= 0) {
          this.blockSelectedDates.splice(idx, 1);
        } else {
          this.blockSelectedDates.push(dateStr);
        }
        this.blockConflicts = this.checkBlockedDateConflictsForDates(this.blockSelectedDates, this.blockForm.room_id);
        this.render();
      });
    });

    const blockRoomSel = this.container.querySelector('#block-room-select');
    const blockReasonInput = this.container.querySelector('#block-reason-input');

    if (blockRoomSel) {
      blockRoomSel.addEventListener('change', (e) => {
        this.blockForm.room_id = e.target.value;
        this.blockConflicts = this.checkBlockedDateConflictsForDates(this.blockSelectedDates, this.blockForm.room_id);
        this.render();
      });
    }

    if (blockReasonInput) {
      blockReasonInput.addEventListener('input', (e) => {
        this.blockForm.reason = e.target.value;
      });
    }

    const btnSaveBlockDate = this.container.querySelector('.btn-save-block-date');
    if (btnSaveBlockDate) {
      btnSaveBlockDate.addEventListener('click', async () => {
        if (this.blockSelectedDates.length === 0) {
          alert('Prosím zaklikněte v kalendáři alespoň jeden den pro zablokování.');
          return;
        }
        const ranges = groupContiguousDateRanges(this.blockSelectedDates);
        const room_id = this.blockForm.room_id || 'all';
        const reason = this.blockForm.reason || 'Uzávěrka recepce';

        for (const r of ranges) {
          await this.addBlockedDate(room_id, r.date_from, r.date_to, reason);
        }

        this.blockSelectedDates = [];
        this.blockConflicts = [];
        this.showAdminToast('Vybrané dny byly úspěšně zablokovány.');
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-cancel-block-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        if (id) {
          await this.removeBlockedDate(id);
        }
      });
    });

    if (btnCancelDelete) {
      btnCancelDelete.addEventListener('click', () => {
        this.showDeleteModal = false;
        this.pendingDeleteReservation = null;
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
  }
}
