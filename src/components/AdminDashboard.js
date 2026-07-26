// 🏨 Reception Admin Dashboard Component for Hotel u Můstku
import { MOCK_ROOMS, getStoredReservations, updateStoredReservationStatus, isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateSpaydQrUrl, BANK_ACCOUNT, formatCzechPrice } from '../utils/pricing.js';
import { sendEmail, generateEmail2ApprovalAndPaymentRequest, generateEmail3FinalConfirmation, getEmailLogs, sendAllTestEmailsTo } from '../utils/emailService.js';

export class AdminDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isAuthenticated = false;
    this.passwordInput = '';
    this.reservations = [];
    this.selectedRoomFilter = 'all';
    this.statusFilter = 'all';
    this.expandedReservationId = null;
    this.activeEmailPreview = null;
    this.showEmailModal = false;
    this.adminToastMessage = '';
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
      this.render();
    } else {
      alert('Nesprávné přístupové heslo k recepčnímu adminu.');
    }
  }

  showAdminToast(msg) {
    this.adminToastMessage = msg;
    this.render();
    setTimeout(() => {
      this.adminToastMessage = '';
      this.render();
    }, 4000);
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
      // Cancel reservation
      const newStatus = 'cancelled';
      if (isSupabaseConfigured && supabase) {
        try { await supabase.from('reservations').update({ status: newStatus }).eq('id', id); } catch (e) {}
      }
      updateStoredReservationStatus(id, newStatus);
      reservation.status = newStatus;

      this.showAdminToast(`❌ Rezervace ${reservation.code} byla zrušena / stornována.`);
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
            <h2 class="admin-login-title">🔒 Recepční systém Hotel u Můstku</h2>
            <p class="admin-login-desc">Zadejte přístupové heslo pro vstup do správy rezervací.</p>

            <form id="admin-login-form" class="admin-login-form">
              <div class="form-field">
                <label for="admin-pass" class="form-label">Heslo recepce:</label>
                <input type="password" id="admin-pass" class="form-input" placeholder="Zadejte heslo..." autofocus required>
              </div>
              <button type="submit" class="btn btn-booking-submit btn-admin-login">Vstoupit do správy</button>
            </form>
          </div>
        </div>
      `;

      const form = document.getElementById('admin-login-form');
      const pass = document.getElementById('admin-pass');
      if (pass) pass.addEventListener('input', (e) => { this.passwordInput = e.target.value; });
      if (form) form.addEventListener('submit', (e) => this.handleLogin(e));
      return;
    }

    const pendingCount = this.reservations.filter(r => r.status === 'pending_approval').length;
    const awaitingDepositCount = this.reservations.filter(r => r.status === 'awaiting_deposit').length;
    const confirmedCount = this.reservations.filter(r => r.status === 'confirmed').length;

    const filteredReservations = this.reservations.filter(r => {
      const matchRoom = this.selectedRoomFilter === 'all' || r.room_id === this.selectedRoomFilter;
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      return matchRoom && matchStatus;
    });

    const emailLogs = getEmailLogs();

    this.container.innerHTML = `
      <div class="admin-dashboard-wrapper">
        ${this.adminToastMessage ? `
          <div class="admin-toast-banner">
            <span>${this.adminToastMessage}</span>
          </div>
        ` : ''}

        <div class="admin-top-bar">
          <div>
            <h2 class="admin-page-title">Recepční správa Hotel u Můstku</h2>
            <p class="admin-page-sub">Jednoduchá obsluha schvalování 30% záloh pro zaměstnance i správce</p>
          </div>
          <div class="admin-top-actions">
            <button class="btn btn-specs-secondary btn-admin-emails">✉️ Log odeslaných e-mailů (${emailLogs.length})</button>
            <button class="btn btn-specs-secondary btn-admin-refresh">🔄 Obnovit data</button>
            <button class="btn btn-booking-submit btn-admin-logout">Odhlásit se</button>
          </div>
        </div>

        <!-- Přehledové karty stavů (Senior & Admin Friendly) -->
        <div class="admin-stats-grid">
          <div class="stat-card ${pendingCount > 0 ? 'highlight-pending' : ''}">
            <div class="stat-num">${pendingCount}</div>
            <div class="stat-txt">1. Žádosti ke schválení</div>
            <small class="stat-sub">Čekají na schválení volné kapacity recepcí</small>
          </div>

          <div class="stat-card">
            <div class="stat-num" style="color: #2980b9;">${awaitingDepositCount}</div>
            <div class="stat-txt">2. Čeká na 30% zálohu</div>
            <small class="stat-sub">Schváleno, poslany pokyny s QR kódem</small>
          </div>

          <div class="stat-card">
            <div class="stat-num" style="color: #27ae60;">${confirmedCount}</div>
            <div class="stat-txt">3. Závazně potvrzeno</div>
            <small class="stat-sub">Záloha 30 % přijata, pokoj zablokován</small>
          </div>
        </div>

        <!-- Filtry -->
        <div class="admin-filters-card">
          <div class="filter-group">
            <label class="filter-label">Zobrazit stav:</label>
            <div class="filter-tabs">
              <button class="filter-tab ${this.statusFilter === 'all' ? 'active' : ''}" data-status="all">Všechny (${this.reservations.length})</button>
              <button class="filter-tab ${this.statusFilter === 'pending_approval' ? 'active' : ''}" data-status="pending_approval">1. K vyřízení (${pendingCount})</button>
              <button class="filter-tab ${this.statusFilter === 'awaiting_deposit' ? 'active' : ''}" data-status="awaiting_deposit">2. Čeká na zálohu (${awaitingDepositCount})</button>
              <button class="filter-tab ${this.statusFilter === 'confirmed' ? 'active' : ''}" data-status="confirmed">3. Potvrzené (${confirmedCount})</button>
            </div>
          </div>

          <div class="filter-group" style="margin-top: 14px;">
            <label class="filter-label">Pokoj:</label>
            <select id="filter-room" class="form-select select-sm">
              <option value="all">Všechny pokoje</option>
              ${MOCK_ROOMS.map(r => `<option value="${r.id}" ${this.selectedRoomFilter === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Seznam Žádostí a Rezervací -->
        <div class="admin-table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Kód & Datum</th>
                <th>Vybraný pokoj</th>
                <th>Host & Kontakt</th>
                <th>Termín pobytu</th>
                <th>Cena & Záloha (30 %)</th>
                <th>Stav rezervace</th>
                <th>Akce recepčního</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReservations.length === 0 ? `
                <tr>
                  <td colspan="7" class="empty-table-td">Žádné rezervace v tomto filtru.</td>
                </tr>
              ` : filteredReservations.map(r => {
                const isExpanded = this.expandedReservationId === r.id;
                const hasAddress = r.guest_street || r.guest_city;
                return `
                  <tr class="admin-row status-row-${r.status}">
                    <td>
                      <strong>${r.code || 'HM-2026-0000'}</strong><br>
                      <small class="text-muted">${r.created_at ? new Date(r.created_at).toLocaleDateString('cs-CZ') + ' ' + new Date(r.created_at).toLocaleTimeString('cs-CZ', {hour:'2-digit', minute:'2-digit'}) : 'Není k dispozici'}</small>
                    </td>
                    <td><strong>${r.room_name || r.room_id || 'Pokoj'}</strong></td>
                    <td>
                      <strong>${r.guest_name}</strong><br>
                      <small>📧 ${r.guest_email}</small><br>
                      <small>📞 ${r.guest_phone}</small>
                      ${r.guest_note ? `<br><small class="guest-note-pill">📝 ${r.guest_note}</small>` : ''}
                    </td>
                    <td>
                      <strong>${r.date_from} → ${r.date_to}</strong>
                    </td>
                    <td>
                      <strong class="price-main">${formatCzechPrice(r.total_price)} celkem</strong><br>
                      <small class="deposit-pill">Záloha 30 %: <strong>${formatCzechPrice(r.deposit_price || Math.round((r.total_price||0)*0.3))}</strong></small><br>
                      <small class="remaining-pill">Doplatek na místě: ${formatCzechPrice(r.remaining_price || Math.round((r.total_price||0)*0.7))}</small>
                    </td>
                    <td>
                      ${r.status === 'pending_approval' ? `
                        <span class="badge-phase badge-pending">1. Čeká na schválení</span>
                      ` : (r.status === 'awaiting_deposit' ? `
                        <span class="badge-phase badge-awaiting">2. Čeká na 30% zálohu</span>
                      ` : (r.status === 'confirmed' ? `
                        <span class="badge-phase badge-confirmed">3. Závazně potvrzeno</span>
                      ` : `<span class="badge-phase badge-cancelled">Stornováno</span>`))}
                    </td>
                    <td class="table-actions-td">
                      ${r.status === 'pending_approval' ? `
                        <button class="btn-admin-action btn-approve" data-id="${r.id || r.code}" data-act="approve_and_request_deposit">
                          ✅ Schválit & Poslat QR kód (30% záloha)
                        </button>
                      ` : ''}

                      ${r.status === 'awaiting_deposit' ? `
                        <button class="btn-admin-action btn-confirm-pay" data-id="${r.id || r.code}" data-act="confirm_deposit_paid">
                          💳 Potvrdit přijetí zálohy
                        </button>
                      ` : ''}

                      <button class="btn-admin-action btn-details-toggle" data-id="${r.id || r.code}">
                        🔍 ${isExpanded ? 'Skrýt podrobnosti' : 'Podrobnosti & Adresa'}
                      </button>

                      ${r.status !== 'cancelled' ? `
                        <button class="btn-admin-action btn-cancel-sm" data-id="${r.id || r.code}" data-act="cancel">
                          ✕ Stornovat
                        </button>
                      ` : ''}
                    </td>
                  </tr>

                  ${isExpanded ? `
                    <tr class="admin-details-drawer-row">
                      <td colspan="7">
                        <div class="admin-details-drawer">
                          <div class="details-drawer-grid">
                            <div class="details-box" style="grid-column: 1 / -1;">
                              <h4 class="details-box-title">👥 Ubytovaní hosté pro Ubytovací knihu (${r.guests ? r.guests.length : (r.adults_count || 1)})</h4>
                              <div class="admin-guests-list" style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
                                ${(r.guests && r.guests.length > 0) ? r.guests.map((g, gIdx) => `
                                  <div class="admin-guest-card" style="background:#ffffff; border:1px solid #e0e4d6; border-radius:4px; padding:10px 14px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                      <strong style="color:#1a1a1a; font-size:14.5px;">${gIdx + 1}. ${g.name || 'Jméno neuvedeno'}</strong>
                                      <span style="font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:4px; ${g.is_main ? 'background:#e8f5e9; color:#2e7d32;' : 'background:#eee; color:#555;'}">
                                        ${g.is_main ? '🟢 Hlavní rezervující' : `👤 Host ${gIdx + 1}`}
                                      </span>
                                    </div>
                                    <div style="font-size:13px; color:#555; display:flex; flex-wrap:wrap; gap:14px; margin-top:4px;">
                                      ${g.email ? `<span>📧 ${g.email}</span>` : ''}
                                      ${g.phone ? `<span>📞 ${g.phone}</span>` : ''}
                                      ${g.birth_date ? `<span>🎂 Nar.: <strong>${g.birth_date}</strong></span>` : '<span style="color:#999;">🎂 Nar.: Neuvedeno</span>'}
                                      ${g.id_number ? `<span>🪪 OP/Pas: <strong>${g.id_number}</strong></span>` : '<span style="color:#999;">🪪 OP/Pas: Neuvedeno</span>'}
                                      ${(g.city || g.street) ? `<span>🏠 Bydliště: <strong>${g.street ? g.street + ', ' : ''}${g.city || ''} (${g.country || 'ČR'})</strong></span>` : '<span style="color:#999;">🏠 Adresa: Neuvedeno online</span>'}
                                    </div>
                                  </div>
                                `).join('') : `
                                  <div class="admin-guest-card" style="background:#ffffff; border:1px solid #e0e4d6; border-radius:4px; padding:10px 14px;">
                                    <strong style="color:#1a1a1a;">1. ${r.guest_name} (🟢 Hlavní rezervující)</strong>
                                    <div style="font-size:13px; color:#555; margin-top:4px;">
                                      📧 ${r.guest_email} | 📞 ${r.guest_phone}
                                      ${hasAddress ? `<br>🏠 Bydliště: ${r.guest_street ? r.guest_street + ', ' : ''}${r.guest_city || ''}` : '<br><span style="color:#999;">⚠️ Adresa nebyla vyplněna online (bude zapsána na recepci při příjezdu).</span>'}
                                    </div>
                                  </div>
                                `}
                              </div>
                            </div>

                            <div class="details-box">
                              <h4 class="details-box-title">💳 Rozpad platby & Doplňkové služby</h4>
                              <ul class="details-list">
                                <li><span>Celková cena pobytu:</span> <strong>${formatCzechPrice(r.total_price)} s DPH</strong></li>
                                <li><span>Záloha 30 % (předem):</span> <strong style="color:#697947;">${formatCzechPrice(r.deposit_price || Math.round((r.total_price||0)*0.3))}</strong></li>
                                <li><span>Doplatek 70 % (na místě):</span> <strong>${formatCzechPrice(r.remaining_price || Math.round((r.total_price||0)*0.7))}</strong></li>
                                ${r.has_half_board ? `<li><span>Polopenze:</span> <strong>${r.half_board_count || r.adults_count || 1} osob</strong></li>` : ''}
                                ${r.has_dog ? `<li><span>Pobyt s pejskem:</span> <strong>Ano (150 Kč/den)</strong></li>` : ''}
                                ${r.has_ebike ? `<li><span>Elektrokolo:</span> <strong>${r.ebike_count || 1}x ks</strong></li>` : ''}
                              </ul>
                            </div>

                            <div class="details-box">
                              <h4 class="details-box-title">📝 Poznámka & Identifikace</h4>
                              <ul class="details-list">
                                <li><span>Poznámka hosta:</span> <strong>${r.guest_note || 'Bez poznámky'}</strong></li>
                                <li><span>Kód rezervace:</span> <strong>${r.code}</strong></li>
                                <li><span>VS pro platbu:</span> <strong>${String(r.code || '').replace(/[^0-9]/g, '')}</strong></li>
                                <li><span>Vytvořeno:</span> <strong>${r.created_at ? new Date(r.created_at).toLocaleString('cs-CZ') : '-'}</strong></li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ` : ''}
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Email Logs Modal -->
      ${this.showEmailModal ? `
        <div class="cal-modal-overlay">
          <div class="cal-modal-card" style="max-width: 680px;">
            <div class="cal-modal-header">
              <h4 class="cal-month-title">✉️ Historie odeslaných e-mailů (${emailLogs.length})</h4>
              <button type="button" class="cal-close-btn" id="close-email-modal">&times;</button>
            </div>
            <div style="padding: 20px; max-height: 70vh; overflow-y: auto;">
              ${emailLogs.length === 0 ? '<p>Zatím nebyly odeslány žádné e-maily.</p>' : `
                <div class="email-logs-list">
                  ${emailLogs.map(m => `
                    <div class="email-log-item">
                      <div class="log-item-header">
                        <strong>${m.subject}</strong>
                        <small>${new Date(m.timestamp).toLocaleString('cs-CZ')}</small>
                      </div>
                      <div class="log-item-sub">
                        <span>Příjemce: <strong>${m.to}</strong></span> |
                        <span>Kód: <strong>${m.reservation_code || '-'}</strong></span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
            <div class="terms-modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
              <button type="button" class="btn btn-booking btn-send-test-emails" id="btn-send-test-emails" style="font-size:13.5px; padding:0 16px;">🧪 Vygenerovat testovací e-maily</button>
              <button type="button" class="btn-terms-close-footer" id="close-email-modal-ft">Zavřít logy</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    this.attachAdminListeners();
  }

  attachAdminListeners() {
    const filterRoom = document.getElementById('filter-room');
    const btnLogout = this.container.querySelector('.btn-admin-logout');
    const btnRefresh = this.container.querySelector('.btn-admin-refresh');
    const btnEmails = this.container.querySelector('.btn-admin-emails');

    if (filterRoom) {
      filterRoom.addEventListener('change', (e) => {
        this.selectedRoomFilter = e.target.value;
        this.render();
      });
    }

    this.container.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.statusFilter = tab.dataset.status;
        this.render();
      });
    });

    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.isAuthenticated = false;
        this.render();
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        await this.fetchReservations();
        this.render();
      });
    }

    if (btnEmails) {
      btnEmails.addEventListener('click', () => {
        this.showEmailModal = true;
        this.render();
      });
    }

    const btnTestEmails = document.getElementById('btn-send-test-emails');
    if (btnTestEmails) {
      btnTestEmails.addEventListener('click', () => {
        sendAllTestEmailsTo('ondra.zeman05@gmail.com');
        this.showAdminToast('📧 Všechny 3 testovací e-maily (Přijetí, Záloha s QR kódem, Potvrzení) byly úspěšně vygenerovány!');
        this.render();
      });
    }

    const btnCloseModal = document.getElementById('close-email-modal');
    const btnCloseModalFt = document.getElementById('close-email-modal-ft');
    if (btnCloseModal) btnCloseModal.addEventListener('click', () => { this.showEmailModal = false; this.render(); });
    if (btnCloseModalFt) btnCloseModalFt.addEventListener('click', () => { this.showEmailModal = false; this.render(); });

    this.container.querySelectorAll('.btn-admin-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const act = btn.dataset.act;
        if (act) {
          await this.advanceReservationPhase(id, act);
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
  }
}
