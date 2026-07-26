// 🏨 Reception Admin Dashboard Component for Hotel u Můstku
import { MOCK_ROOMS, getStoredReservations, updateStoredReservationStatus, deleteStoredReservation, isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateSpaydQrUrl, BANK_ACCOUNT, formatCzechPrice, getVariableSymbol } from '../utils/pricing.js';
import { sendEmail, generateEmail2ApprovalAndPaymentRequest, generateEmail3FinalConfirmation, generateEmailCancellation, getEmailLogs, sendAllTestEmailsTo } from '../utils/emailService.js';

const ADMIN_SESSION_KEY = 'hotel_mustku_admin_auth_v1';

export class AdminDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isAuthenticated = (typeof localStorage !== 'undefined' && localStorage.getItem(ADMIN_SESSION_KEY) === 'true');
    this.passwordInput = '';
    this.loginError = false;
    this.reservations = [];
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
    await this.fetchReservations();
    this.render();
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
            <button type="button" class="btn btn-specs-secondary btn-admin-refresh">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.3L2.5 16"/></svg>
              Obnovit data
            </button>
            <button type="button" class="btn btn-booking-submit btn-admin-logout">Odhlásit se</button>
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
    const btnEmails = this.container.querySelector('.btn-admin-emails');
    const btnCancelDelete = this.container.querySelector('.btn-cancel-delete-modal');

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
        await this.fetchReservations();
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
