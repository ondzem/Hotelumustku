// 🏨 Reception Admin Dashboard Component for Hotel u Můstku
import { MOCK_ROOMS, getStoredReservations, isSupabaseConfigured, supabase } from '../lib/supabaseClient.js';

export class AdminDashboard {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.isAuthenticated = false;
    this.passwordInput = '';
    this.reservations = [];
    this.selectedRoomFilter = 'all';
    this.statusFilter = 'all';
    this.showNewReservationModal = false;
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

  handleLogin(e) {
    e.preventDefault();
    if (this.passwordInput === 'mustku2026' || this.passwordInput === 'admin') {
      this.isAuthenticated = true;
      this.render();
    } else {
      alert('Nesprávné přístupové heslo k recepčnímu adminu.');
    }
  }

  async updateReservationStatus(id, newStatus) {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('reservations').update({ status: newStatus }).eq('id', id);
      } catch (err) {
        console.error('Failed to update status in Supabase:', err);
      }
    }

    const item = this.reservations.find(r => r.id === id || r.code === id);
    if (item) {
      item.status = newStatus;
    }
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

    const filteredReservations = this.reservations.filter(r => {
      const matchRoom = this.selectedRoomFilter === 'all' || r.room_id === this.selectedRoomFilter;
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      return matchRoom && matchStatus;
    });

    this.container.innerHTML = `
      <div class="admin-dashboard-wrapper">
        <div class="admin-top-bar">
          <div>
            <h2 class="admin-page-title">Recepční panel Hotel u Můstku</h2>
            <p class="admin-page-sub">Přehled a správa všech zákaznických i telefonických rezervací</p>
          </div>
          <div class="admin-top-actions">
            <button class="btn btn-specs-secondary btn-admin-refresh">🔄 Obnovit data</button>
            <button class="btn btn-booking-submit btn-admin-logout">Odhlásit se</button>
          </div>
        </div>

        <!-- Filtry -->
        <div class="admin-filters-card">
          <div class="filter-group">
            <label class="filter-label">Filtr dle pokoje:</label>
            <select id="filter-room" class="form-select select-sm">
              <option value="all">Všechny pokoje (${MOCK_ROOMS.length})</option>
              ${MOCK_ROOMS.map(r => `<option value="${r.id}" ${this.selectedRoomFilter === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label">Filtr dle stavu:</label>
            <select id="filter-status" class="form-select select-sm">
              <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>Všechny stavy</option>
              <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>Čeká na platbu (Pending)</option>
              <option value="confirmed" ${this.statusFilter === 'confirmed' ? 'selected' : ''}>Potvrzeno (Confirmed)</option>
              <option value="paid" ${this.statusFilter === 'paid' ? 'selected' : ''}>Zaplaceno (Paid)</option>
              <option value="cancelled" ${this.statusFilter === 'cancelled' ? 'selected' : ''}>Stornováno (Cancelled)</option>
            </select>
          </div>
        </div>

        <!-- Seznam Rezervací -->
        <div class="admin-table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Kód / Datum</th>
                <th>Pokoj</th>
                <th>Host & Kontakt</th>
                <th>Termín pobytu</th>
                <th>Hosté</th>
                <th>Celková cena</th>
                <th>Stav</th>
                <th>Akce recepce</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReservations.length === 0 ? `
                <tr>
                  <td colspan="8" class="empty-table-td">Zatím nebyly nalezeny žádné rezervace odpovídající filtru.</td>
                </tr>
              ` : filteredReservations.map(r => `
                <tr class="status-row-${r.status}">
                  <td>
                    <strong>${r.code || 'HM-2026-0000'}</strong><br>
                    <small class="text-muted">${r.created_at ? new Date(r.created_at).toLocaleDateString('cs-CZ') : 'Není k dispozici'}</small>
                  </td>
                  <td><strong>${r.room_name || r.room_id || 'Pokoj'}</strong></td>
                  <td>
                    <strong>${r.guest_name}</strong><br>
                    <small>📧 ${r.guest_email}</small><br>
                    <small>📞 ${r.guest_phone}</small>
                  </td>
                  <td>
                    <strong>${r.date_from} → ${r.date_to}</strong>
                  </td>
                  <td>${r.adults_count || 1} dospělí ${r.children_count ? `, ${r.children_count} dětí` : ''}</td>
                  <td><strong class="price-green">${r.total_price} Kč</strong></td>
                  <td>
                    <span class="badge-status badge-${r.status}">
                      ${r.status === 'pending' ? '⏳ Čeká' : (r.status === 'confirmed' ? '✓ Potvrzeno' : (r.status === 'paid' ? '💰 Zaplaceno' : '✕ Stornováno'))}
                    </span>
                  </td>
                  <td class="table-actions-td">
                    ${r.status !== 'confirmed' ? `<button class="btn-action btn-act-confirm" data-id="${r.id}" data-status="confirmed">Potvrdit</button>` : ''}
                    ${r.status !== 'paid' ? `<button class="btn-action btn-act-pay" data-id="${r.id}" data-status="paid">Zaplaceno</button>` : ''}
                    ${r.status !== 'cancelled' ? `<button class="btn-action btn-act-cancel" data-id="${r.id}" data-status="cancelled">Stornovat</button>` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    this.attachAdminListeners();
  }

  attachAdminListeners() {
    const filterRoom = document.getElementById('filter-room');
    const filterStatus = document.getElementById('filter-status');
    const btnLogout = this.container.querySelector('.btn-admin-logout');
    const btnRefresh = this.container.querySelector('.btn-admin-refresh');

    if (filterRoom) {
      filterRoom.addEventListener('change', (e) => {
        this.selectedRoomFilter = e.target.value;
        this.render();
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }

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

    this.container.querySelectorAll('.btn-action').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const status = btn.dataset.status;
        await this.updateReservationStatus(id, status);
      });
    });
  }
}
