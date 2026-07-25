// 🏨 Senior-Friendly Booking System Component for Hotel u Můstku
import { MOCK_ROOMS, isSupabaseConfigured, supabase, getStoredReservations, saveStoredReservation } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateReservationCode, generateManageToken } from '../utils/pricing.js';
import { generateQrCodeDataUrl, BANK_ACCOUNT } from '../utils/qrPayment.js';

export class BookingSystem {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentStep = 1;

    // Helper: default date range (Tomorrow -> 2 nights)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 2);

    this.state = {
      selectedRoomId: 'p5',
      dateFrom: tomorrow.toISOString().split('T')[0],
      dateTo: dayAfter.toISOString().split('T')[0],
      adults: 2,
      children: 0,
      hasDog: false,
      hasEbike: false,
      ebikeCount: 1,
      hasHalfBoard: false,
      halfBoardCount: 2,
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestNote: '',
      agreedTerms: false,
      honeypot: '', // Spam protection
      isSubmitting: false,
      confirmedReservation: null,
      qrDataUrl: null,
      errorMessage: '',
    };

    this.roomsList = MOCK_ROOMS;
  }

  init(initialRoomId) {
    if (initialRoomId && this.roomsList.some(r => r.id === initialRoomId)) {
      this.state.selectedRoomId = initialRoomId;
    }
    this.render();
  }

  setStep(step) {
    this.currentStep = step;
    this.state.errorMessage = '';
    this.render();
    window.scrollTo({ top: this.container.offsetTop - 80, behavior: 'smooth' });
  }

  getSelectedRoom() {
    return this.roomsList.find(r => r.id === this.state.selectedRoomId) || this.roomsList[0];
  }

  calculateNights() {
    if (!this.state.dateFrom || !this.state.dateTo) return 1;
    const start = new Date(this.state.dateFrom);
    const end = new Date(this.state.dateTo);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  }

  getPricingBreakdown() {
    const room = this.getSelectedRoom();
    const nights = this.calculateNights();
    return calculateReservationPrice({
      roomType: room.type,
      nights,
      persons: this.state.adults,
      adults: this.state.adults,
      children: this.state.children,
      hasDog: this.state.hasDog,
      hasEbike: this.state.hasEbike,
      ebikeCount: this.state.ebikeCount,
      hasHalfBoard: this.state.hasHalfBoard,
      halfBoardCount: this.state.halfBoardCount,
    });
  }

  async handleFinalBookingSubmit(e) {
    e.preventDefault();
    if (this.state.isSubmitting) return;

    // Honeypot spam check
    if (this.state.honeypot) {
      console.warn('Spam detected via honeypot.');
      return;
    }

    if (!this.state.guestName || !this.state.guestEmail || !this.state.guestPhone) {
      this.state.errorMessage = 'Prosíme, vyplňte všechna povinná pole (Jméno, E-mail a Telefon).';
      this.render();
      return;
    }

    if (!this.state.agreedTerms) {
      this.state.errorMessage = 'Pro dokončení rezervace je nutné souhlasit s obchodními podmínkami.';
      this.render();
      return;
    }

    this.state.isSubmitting = true;
    this.state.errorMessage = '';
    this.render();

    const room = this.getSelectedRoom();
    const pricing = this.getPricingBreakdown();
    const code = generateReservationCode();
    const manageToken = generateManageToken();

    const reservationData = {
      code,
      manage_token: manageToken,
      room_id: room.id,
      room_name: room.name,
      date_from: this.state.dateFrom,
      date_to: this.state.dateTo,
      guest_name: this.state.guestName,
      guest_email: this.state.guestEmail,
      guest_phone: this.state.guestPhone,
      guest_note: this.state.guestNote,
      adults_count: this.state.adults,
      children_count: this.state.children,
      has_dog: this.state.hasDog,
      has_ebike: this.state.hasEbike,
      ebike_count: pricing.ebikeCount,
      has_half_board: this.state.hasHalfBoard,
      half_board_count: pricing.halfBoardCount,
      total_price: pricing.totalPrice,
      accommodation_price: pricing.accommodationPrice,
      city_tax: pricing.cityTax,
      addons_price: pricing.addonsPrice,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    let savedResult = null;

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('reservations').insert([{
          code: reservationData.code,
          manage_token: reservationData.manage_token,
          room_id: reservationData.room_id,
          date_from: reservationData.date_from,
          date_to: reservationData.date_to,
          guest_name: reservationData.guest_name,
          guest_email: reservationData.guest_email,
          guest_phone: reservationData.guest_phone,
          guest_note: reservationData.guest_note,
          adults_count: reservationData.adults_count,
          children_count: reservationData.children_count,
          has_dog: reservationData.has_dog,
          has_ebike: reservationData.has_ebike,
          ebike_count: reservationData.ebike_count,
          has_half_board: reservationData.has_half_board,
          half_board_count: reservationData.half_board_count,
          total_price: reservationData.total_price,
          accommodation_price: reservationData.accommodation_price,
          city_tax: reservationData.city_tax,
          addons_price: reservationData.addons_price,
          status: 'pending',
          source: 'web',
        }]).select();

        if (error) {
          if (error.code === '23P01' || error.message.includes('overlapping')) {
            throw new Error('Tento pokoj je v vybraném termínu již zarezervovaný. Prosíme vyberte jiný termín nebo pokoj.');
          }
          throw error;
        }
        savedResult = data ? data[0] : reservationData;
      } catch (err) {
        console.error('Supabase DB booking failed, falling back to local store:', err);
        this.state.errorMessage = err.message || 'Nepodařilo se uložit rezervaci do databáze.';
        this.state.isSubmitting = false;
        this.render();
        return;
      }
    }

    if (!savedResult) {
      savedResult = saveStoredReservation(reservationData);
    }

    // Generate Payment QR code
    const qrUrl = await generateQrCodeDataUrl({
      amount: pricing.totalPrice,
      variableSymbol: code.replace(/[^0-9]/g, ''),
      message: `Hotel u Mustku - ${code}`,
    });

    this.state.confirmedReservation = savedResult;
    this.state.qrDataUrl = qrUrl;
    this.state.isSubmitting = false;
    this.setStep(3);
  }

  render() {
    if (!this.container) return;

    const room = this.getSelectedRoom();
    const pricing = this.getPricingBreakdown();
    const nights = this.calculateNights();

    let contentHtml = '';

    if (this.currentStep === 1) {
      contentHtml = this.renderStep1(room, pricing, nights);
    } else if (this.currentStep === 2) {
      contentHtml = this.renderStep2(room, pricing, nights);
    } else if (this.currentStep === 3) {
      contentHtml = this.renderStep3(room, pricing);
    }

    this.container.innerHTML = `
      <div class="booking-wizard-wrapper">
        <div class="booking-stepper">
          <div class="step-item ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
            <span class="step-number">1</span>
            <span class="step-label">Termín & Doplňky</span>
          </div>
          <div class="step-divider"></div>
          <div class="step-item ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}">
            <span class="step-number">2</span>
            <span class="step-label">Údaje hosta</span>
          </div>
          <div class="step-divider"></div>
          <div class="step-item ${this.currentStep === 3 ? 'active' : ''}">
            <span class="step-number">3</span>
            <span class="step-label">Potvrzení & Platba</span>
          </div>
        </div>

        ${this.state.errorMessage ? `<div class="booking-error-alert">${this.state.errorMessage}</div>` : ''}

        ${contentHtml}
      </div>

      ${this.renderTermsModal()}
    `;

    this.attachEventListeners();
  }

  renderTermsModal() {
    return `
      <div class="terms-modal-overlay" id="terms-modal-overlay" aria-hidden="true">
        <div class="terms-modal-card">
          <div class="terms-modal-header">
            <h3 class="terms-modal-title">📋 Podmínky ubytování & Stornopodmínky</h3>
            <button type="button" class="terms-modal-close" id="btn-close-terms-modal" aria-label="Zavřít">&times;</button>
          </div>

          <div class="terms-modal-body">
            <div class="terms-info-box flex-info-box">
              <div class="terms-info-icon">🕒</div>
              <div class="terms-info-content">
                <strong>Časy příjezdu a odjezdu:</strong>
                <p>Standardní <strong>Check-in</strong> je od <strong>15:00 hod.</strong> a <strong>Check-out</strong> do <strong>10:00 hod.</strong></p>
                <small class="terms-highlight-sub">💡 Po předchozí dohodě s recepcí vám časy příjezdu či odjezdu rádi individuálně přizpůsobíme.</small>
              </div>
            </div>

            <div class="terms-info-box reschedule-info-box">
              <div class="terms-info-icon">🤝</div>
              <div class="terms-info-content">
                <strong>Flexibilní změna termínu:</strong>
                <p>V případě jakýchkoliv nečekaných událostí či nemoci se s námi neváhejte okamžitě spojit. Rádi s vámi po dohodě <strong>přesuneme termín pobytu</strong> na jiný vyhovující termín zdarma a s osobním přístupem.</p>
              </div>
            </div>

            <div class="terms-storno-wrap">
              <h4 class="storno-title">Stornopodmínky při zrušení pobytu</h4>
              <div class="terms-storno-table">
                <div class="storno-row">
                  <span class="storno-label">Více než 21 dní před příjezdem:</span>
                  <span class="storno-val green">ZDARMA <small>(bez poplatku)</small></span>
                </div>
                <div class="storno-row">
                  <span class="storno-label">21 – 14 dní před příjezdem:</span>
                  <span class="storno-val">40 % <small>z ceny pobytu</small></span>
                </div>
                <div class="storno-row">
                  <span class="storno-label">14 – 7 dní před příjezdem:</span>
                  <span class="storno-val">60 % <small>z ceny pobytu</small></span>
                </div>
                <div class="storno-row">
                  <span class="storno-label">Méně než 7 dní / Nedojezd:</span>
                  <span class="storno-val red">100 % <small>z ceny pobytu</small></span>
                </div>
              </div>
            </div>
          </div>

          <div class="terms-modal-footer">
            <button type="button" class="btn btn-secondary btn-close-modal-footer" id="btn-close-modal-footer">Rozumím, zavřít</button>
          </div>
        </div>
      </div>
    `;
  }

  renderStep1(room, pricing, nights) {
    return `
      <div class="booking-step-content">
        <div class="booking-grid">
          <!-- Levý sloupec: Výběr pokoje a parametrů -->
          <div class="booking-left-col">
            <div class="booking-card">
              <h3 class="card-title">1. Výběr pokoje <span class="required-badge">* Povinné</span></h3>
              <div class="room-selector-group">
                <label for="room-select" class="form-label">Vybraný pokoj:</label>
                <select id="room-select" class="form-select">
                  ${this.roomsList.map(r => `
                    <option value="${r.id}" ${r.id === room.id ? 'selected' : ''}>
                      ${r.name} (${r.basePrice} Kč / noc)
                    </option>
                  `).join('')}
                </select>
              </div>

              <div class="room-mini-preview">
                <img src="${room.image || '/hezky pokoj 1.webp'}" alt="${room.name}" class="preview-room-thumb" loading="lazy" decoding="async">
                <div class="preview-info-wrap">
                  <span class="preview-badge">${room.floor === 'prizemi' ? 'Přízemí' : '1. Patro (Výhled na můstky)'}</span>
                  <h4 class="preview-room-title">${room.name}</h4>
                  <p class="preview-desc">Kapacita: až 4 osoby (3 lůžka + možnost 1 přistýlky) • Včetně snídaně</p>
                </div>
                <button type="button" class="btn btn-view-room-details" id="btn-view-room-details" data-room-id="${room.id}">
                  <span>Zobrazit pokoj</span>
                  <svg class="btn-arrow-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="7" y1="17" x2="17" y2="7"></line>
                    <polyline points="7 7 17 7 17 17"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            <div class="booking-card">
              <h3 class="card-title">2. Termín pobytu <span class="required-badge">* Povinné</span></h3>
              <div class="dates-grid">
                <div class="form-field">
                  <label for="date-from" class="form-label">Datum příjezdu (Check-in od 15:00):</label>
                  <input type="date" id="date-from" class="form-input" value="${this.state.dateFrom}">
                </div>
                <div class="form-field">
                  <label for="date-to" class="form-label">Datum odjezdu (Check-out do 10:00):</label>
                  <input type="date" id="date-to" class="form-input" value="${this.state.dateTo}">
                </div>
              </div>
              
              <div class="terms-card-bottom-row">
                <p class="nights-counter">Délka pobytu: <strong>${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</strong></p>
                <button type="button" class="btn-terms-modal-trigger" id="btn-open-terms-modal">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Podmínky ubytování & stornopodmínky</span>
                </button>
              </div>
            </div>

            <div class="booking-card">
              <h3 class="card-title">3. Počet osob <span class="required-badge">* Povinné</span></h3>
              <div class="guests-picker-grid">
                <div class="guest-counter-item">
                  <span class="counter-label">Osoby (ubytovaní hosté):</span>
                  <div class="counter-controls">
                    <button class="btn-counter btn-counter-minus" data-target="persons">-</button>
                    <span class="counter-value">${this.state.adults || 2}</span>
                    <button class="btn-counter btn-counter-plus" data-target="persons">+</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="booking-card">
              <h3 class="card-title">4. Doplňkové služby <span class="optional-badge">Volitelné</span></h3>
              <div class="checkbox-addons-list">
                <div class="checkbox-addon-group">
                  <label class="checkbox-addon-item">
                    <input type="checkbox" id="addon-halfboard" ${this.state.hasHalfBoard ? 'checked' : ''}>
                    <span class="addon-text">
                      <strong>Dokoupit polopenzi</strong> (+195 Kč / osoba / noc)
                      <small>Poctivá teplá večeře podávaná v hotelové restauraci.</small>
                    </span>
                  </label>
                  ${this.state.hasHalfBoard ? `
                    <div class="addon-subcontrols">
                      <span class="subcontrol-label">Počet osob s polopenzí:</span>
                      <div class="counter-controls">
                        <button class="btn-counter btn-counter-minus" data-target="halfBoardCount">-</button>
                        <span class="counter-value">${pricing.halfBoardCount}</span>
                        <button class="btn-counter btn-counter-plus" data-target="halfBoardCount">+</button>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <label class="checkbox-addon-item">
                  <input type="checkbox" id="addon-dog" ${this.state.hasDog ? 'checked' : ''}>
                  <span class="addon-text">
                    <strong>Pobyt s pejskem</strong> (+150 Kč / noc pro celý pokoj)
                    <small>Váš čtyřnohý mazlíček je u nás vítán (poplatek za celý pokoj).</small>
                  </span>
                </label>

                <div class="checkbox-addon-group">
                  <label class="checkbox-addon-item">
                    <input type="checkbox" id="addon-ebike" ${this.state.hasEbike ? 'checked' : ''}>
                    <span class="addon-text">
                      <strong>Nabíjení elektrokola</strong> (+15 Kč / den / ks)
                      <small>Bezpečná úschovna a dobíjecí stanice v areálu.</small>
                    </span>
                  </label>
                  ${this.state.hasEbike ? `
                    <div class="addon-subcontrols">
                      <span class="subcontrol-label">Počet elektrokol:</span>
                      <div class="counter-controls">
                        <button class="btn-counter btn-counter-minus" data-target="ebikeCount">-</button>
                        <span class="counter-value">${pricing.ebikeCount}</span>
                        <button class="btn-counter btn-counter-plus" data-target="ebikeCount">+</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Pravý sloupec: Živý rozpis ceny a tlačítko pokračovat -->
          <div class="booking-right-col">
            <div class="summary-sticky-card">
              <h3 class="summary-title">Přehled ceny pobytu</h3>
              
              <div class="summary-rows">
                <div class="summary-row">
                  <div class="row-info">
                    <span class="row-label">Ubytování se snídaní</span>
                    <span class="row-details">(${nights}x noc, ${pricing.totalGuests}x osoba)</span>
                  </div>
                  <span class="row-price">${pricing.accommodationPrice} Kč</span>
                </div>

                ${pricing.singleNightSurchargeTotal > 0 ? `
                  <div class="summary-row surcharge">
                    <div class="row-info">
                      <span class="row-label">Příplatek za 1 noc</span>
                      <span class="row-details">(+200 Kč / os)</span>
                    </div>
                    <span class="row-price">+${pricing.singleNightSurchargeTotal} Kč</span>
                  </div>
                ` : ''}

                ${pricing.hasHalfBoard ? `
                  <div class="summary-row">
                    <div class="row-info">
                      <span class="row-label">Dokoupená polopenze</span>
                      <span class="row-details">(+195 Kč/os/noc • ${pricing.halfBoardCount}x os, ${nights}x noc)</span>
                    </div>
                    <span class="row-price">+${pricing.halfBoardPriceTotal} Kč</span>
                  </div>
                ` : ''}

                ${pricing.hasDog ? `
                  <div class="summary-row">
                    <div class="row-info">
                      <span class="row-label">Pobyt s pejskem</span>
                      <span class="row-details">(+150 Kč/noc za pokoj • ${nights}x noc)</span>
                    </div>
                    <span class="row-price">+${pricing.dogPriceTotal} Kč</span>
                  </div>
                ` : ''}

                ${pricing.hasEbike ? `
                  <div class="summary-row">
                    <div class="row-info">
                      <span class="row-label">Nabíjení elektrokola</span>
                      <span class="row-details">(+15 Kč/den • ${pricing.ebikeCount}x ks, ${nights}x noc)</span>
                    </div>
                    <span class="row-price">+${pricing.ebikePriceTotal} Kč</span>
                  </div>
                ` : ''}

                <div class="summary-row">
                  <div class="row-info">
                    <span class="row-label">Místní poplatek z pobytu</span>
                    <span class="row-details">(20 Kč / osoba / noc • ${pricing.totalGuests}x os, ${nights}x noc)</span>
                  </div>
                  <span class="row-price">${pricing.cityTax} Kč</span>
                </div>
              </div>

              <div class="summary-total-divider"></div>

              <div class="summary-total-row">
                <span>Celková cena s DPH:</span>
                <span class="total-price-amount">${pricing.totalPrice} Kč</span>
              </div>

              <div class="summary-perks">
                <span>✓ Snídaně formou bufetu v ceně</span>
                <span>✓ Parkování u hotelu ZDARMA</span>
                <span>✓ Wi-Fi připojené zdarma</span>
              </div>

              <button class="btn btn-booking-submit btn-next-step-1">
                Pokračovat k údajům hosta →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep2(room, pricing, nights) {
    return `
      <div class="booking-step-content">
        <div class="booking-grid">
          <div class="booking-left-col">
            <div class="booking-card">
              <h3 class="card-title">Kontaktní údaje rezervujícího</h3>
              <p class="card-intro">Vyplňte prosím vaše nacionále pro vystavení potvrzení rezervace.</p>

              <form id="booking-form-step2" class="booking-form">
                <!-- Honeypot anti-spam field (hidden) -->
                <div style="display:none;" aria-hidden="true">
                  <input type="text" id="hp-field" tabindex="-1" autocomplete="off" value="${this.state.honeypot}">
                </div>

                <div class="form-field">
                  <label for="guest-name" class="form-label">Jméno a Příjmení <span class="required">*</span></label>
                  <input type="text" id="guest-name" class="form-input" placeholder="např. Jan Novák" value="${this.state.guestName}" required>
                </div>

                <div class="form-field">
                  <label for="guest-email" class="form-label">E-mailová adresa <span class="required">*</span></label>
                  <input type="email" id="guest-email" class="form-input" placeholder="např. jan.novak@seznam.cz" value="${this.state.guestEmail}" required>
                  <small class="field-hint">Na tento e-mail zašleme potvrzení rezervace a platební údaje.</small>
                </div>

                <div class="form-field">
                  <label for="guest-phone" class="form-label">Telefonní číslo <span class="required">*</span></label>
                  <input type="tel" id="guest-phone" class="form-input" placeholder="např. +420 777 123 456" value="${this.state.guestPhone}" required>
                </div>

                <div class="form-field">
                  <label for="guest-note" class="form-label">Poznámka / Speciální přání (Volitelné):</label>
                  <textarea id="guest-note" class="form-textarea" rows="3" placeholder="Předpokládaný čas příjezdu, dieta či jiná přání...">${this.state.guestNote}</textarea>
                </div>

                <div class="form-field checkbox-field">
                  <label class="checkbox-terms">
                    <input type="checkbox" id="agree-terms" ${this.state.agreedTerms ? 'checked' : ''} required>
                    <span>Souhlasím s obchodními a storno podmínkami Hotelu u Můstku a se zpracováním osobních údajů (GDPR). <span class="required">*</span></span>
                  </label>
                </div>

                <div class="step-nav-buttons">
                  <button type="button" class="btn btn-specs-secondary btn-back-step-1">← Zpět k výběru termínu</button>
                  <button type="submit" class="btn btn-booking-submit btn-confirm-booking" ${this.state.isSubmitting ? 'disabled' : ''}>
                    ${this.state.isSubmitting ? 'Odesílám rezervaci...' : 'Závazně rezervovat pobyt'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div class="booking-right-col">
            <div class="summary-sticky-card">
              <h3 class="summary-title">Rekapitulace rezervace</h3>
              <div class="recap-info-block">
                <p><strong>Pokoj:</strong> ${room.name}</p>
                <p><strong>Termín:</strong> ${this.state.dateFrom} až ${this.state.dateTo} (${nights} nocí)</p>
                <p><strong>Hosté:</strong> ${this.state.adults} dospělí ${this.state.children > 0 ? `, ${this.state.children} dětí` : ''}</p>
              </div>

              <div class="summary-total-divider"></div>
              <div class="summary-total-row">
                <span>Celkem k úhradě:</span>
                <span class="total-price-amount">${pricing.totalPrice} Kč</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep3(room, pricing) {
    const res = this.state.confirmedReservation || {};
    return `
      <div class="booking-step-content success-step">
        <div class="success-card">
          <div class="success-icon-wrap">✓</div>
          <h3 class="success-title">Děkujeme, vaše rezervace byla úspěšně přijata!</h3>
          <p class="success-code-badge">Kód rezervace: <strong>${res.code || 'HM-2026-0000'}</strong></p>

          <p class="success-intro">
            Potvrzení rezervace a platební údaje byly odeslány na váš e-mail <strong>${res.guest_email || this.state.guestEmail}</strong>.
          </p>

          <div class="payment-instructions-grid">
            <!-- Levá část: Bankovní údaje -->
            <div class="payment-info-box">
              <h4 class="box-subtitle">Platební údaje pro bankovní převod</h4>
              <ul class="payment-details-list">
                <li><span>Číslo účtu:</span> <strong>${BANK_ACCOUNT}</strong></li>
                <li><span>Banka:</span> <strong>Česká spořitelna</strong></li>
                <li><span>Variabilní kód:</span> <strong>${(res.code || '').replace(/[^0-9]/g, '')}</strong></li>
                <li><span>Částka k úhradě:</span> <strong>${pricing.totalPrice} Kč</strong></li>
                <li><span>Splatnost:</span> <strong>Do 3 pracovních dnů</strong></li>
              </ul>
            </div>

            <!-- Pravá část: Český QR Kód -->
            <div class="payment-qr-box">
              <h4 class="box-subtitle">Rychlá platba QR kódem</h4>
              ${this.state.qrDataUrl ? `
                <img src="${this.state.qrDataUrl}" alt="QR kód pro platbu z mobilního bankovnictví" class="qr-code-img">
                <small class="qr-hint">Naskenujte v aplikaci vaší české banky</small>
              ` : '<p>QR kód načítám...</p>'}
            </div>
          </div>

          <div class="hotel-contacts-card">
            <h4>Důležité informace k příjezdu</h4>
            <p>📍 <strong>Adresa hotelu:</strong> Desná v Jizerských horách 143, 468 61 Desná</p>
            <p>⏰ <strong>Check-in (Příjezd):</strong> 14:00 – 19:00 hod.</p>
            <p>⏰ <strong>Check-out (Odjezd):</strong> do 10:00 hod.</p>
            <p>📞 <strong>Telefon na recepci:</strong> +420 777 123 456</p>
          </div>

          <div class="success-actions">
            <button class="btn btn-specs-secondary btn-new-booking">Vytvořit další rezervaci</button>
            <button class="btn btn-booking-submit btn-go-home">Zpět na hlavní stránku</button>
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    if (this.currentStep === 1) {
      const roomSelect = document.getElementById('room-select');
      if (roomSelect) {
        roomSelect.addEventListener('change', (e) => {
          this.state.selectedRoomId = e.target.value;
          this.render();
        });
      }

      const dateFrom = document.getElementById('date-from');
      const dateTo = document.getElementById('date-to');
      if (dateFrom) {
        dateFrom.addEventListener('change', (e) => {
          this.state.dateFrom = e.target.value;
          this.render();
        });
      }
      if (dateTo) {
        dateTo.addEventListener('change', (e) => {
          this.state.dateTo = e.target.value;
          this.render();
        });
      }

      const btnViewRoom = this.container.querySelector('#btn-view-room-details');
      if (btnViewRoom) {
        btnViewRoom.addEventListener('click', (e) => {
          e.preventDefault();
          const room = this.getSelectedRoom();
          const targetHash = room.floor === 'prizemi' ? '#pokoje-prizemi' : '#pokoje-vyhled';
          window.pendingAutoOpenRoom = room.id;
          window.location.hash = targetHash;
        });
      }

      this.container.querySelectorAll('.btn-counter').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.dataset.target;
          const isPlus = btn.classList.contains('btn-counter-plus');
          if (target === 'persons' || target === 'adults') {
            this.state.adults = isPlus ? Math.min(4, this.state.adults + 1) : Math.max(1, this.state.adults - 1);
            if (this.state.halfBoardCount > this.state.adults) {
              this.state.halfBoardCount = this.state.adults;
            }
          } else if (target === 'halfBoardCount') {
            const maxHB = this.state.adults || 2;
            const currentHB = this.state.halfBoardCount ?? maxHB;
            this.state.halfBoardCount = isPlus ? Math.min(maxHB, currentHB + 1) : Math.max(1, currentHB - 1);
          } else if (target === 'ebikeCount') {
            const currentE = this.state.ebikeCount || 1;
            this.state.ebikeCount = isPlus ? Math.min(4, currentE + 1) : Math.max(1, currentE - 1);
          }
          this.render();
        });
      });

      const addonHalfBoard = document.getElementById('addon-halfboard');
      const addonDog = document.getElementById('addon-dog');
      const addonEbike = document.getElementById('addon-ebike');

      if (addonHalfBoard) {
        addonHalfBoard.addEventListener('change', (e) => {
          this.state.hasHalfBoard = e.target.checked;
          if (this.state.hasHalfBoard && !this.state.halfBoardCount) {
            this.state.halfBoardCount = this.state.adults;
          }
          this.render();
        });
      }
      if (addonDog) {
        addonDog.addEventListener('change', (e) => {
          this.state.hasDog = e.target.checked;
          this.render();
        });
      }
      if (addonEbike) {
        addonEbike.addEventListener('change', (e) => {
          this.state.hasEbike = e.target.checked;
          if (this.state.hasEbike && !this.state.ebikeCount) {
            this.state.ebikeCount = 1;
          }
          this.render();
        });
      }

      const btnNext = this.container.querySelector('.btn-next-step-1');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          const start = new Date(this.state.dateFrom);
          const end = new Date(this.state.dateTo);
          if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            this.state.errorMessage = 'Prosíme, vyberte platný termín pobytu (Datum odjezdu musí být po datu příjezdu).';
            this.render();
            return;
          }
          this.setStep(2);
        });
      }
    } else if (this.currentStep === 2) {
      const form = document.getElementById('booking-form-step2');
      if (form) {
        form.addEventListener('submit', (e) => this.handleFinalBookingSubmit(e));
      }

      const guestName = document.getElementById('guest-name');
      const guestEmail = document.getElementById('guest-email');
      const guestPhone = document.getElementById('guest-phone');
      const guestNote = document.getElementById('guest-note');
      const agreeTerms = document.getElementById('agree-terms');
      const hpField = document.getElementById('hp-field');

      if (guestName) guestName.addEventListener('input', (e) => { this.state.guestName = e.target.value; });
      if (guestEmail) guestEmail.addEventListener('input', (e) => { this.state.guestEmail = e.target.value; });
      if (guestPhone) guestPhone.addEventListener('input', (e) => { this.state.guestPhone = e.target.value; });
      if (guestNote) guestNote.addEventListener('input', (e) => { this.state.guestNote = e.target.value; });
      if (agreeTerms) agreeTerms.addEventListener('change', (e) => { this.state.agreedTerms = e.target.checked; });
      if (hpField) hpField.addEventListener('input', (e) => { this.state.honeypot = e.target.value; });

      const btnBack = this.container.querySelector('.btn-back-step-1');
      if (btnBack) {
        btnBack.addEventListener('click', () => this.setStep(1));
      }
    } else if (this.currentStep === 3) {
      const btnNew = this.container.querySelector('.btn-new-booking');
      const btnBackStep1 = this.container.querySelector('.btn-prev-step-1');
      if (btnBackStep1) {
        btnBackStep1.addEventListener('click', (e) => {
          e.preventDefault();
          this.setStep(1);
        });
      }
      const btnHome = this.container.querySelector('.btn-go-home');

      if (btnNew) {
        btnNew.addEventListener('click', () => {
          this.state.confirmedReservation = null;
          this.setStep(1);
        });
      }
    }

    // Modal Podmínky Ubytování listeners
    const modalOverlay = this.container.querySelector('#terms-modal-overlay');
    const btnOpenModal = this.container.querySelector('#btn-open-terms-modal');
    const btnCloseModalX = this.container.querySelector('#btn-close-terms-modal');
    const btnCloseModalFooter = this.container.querySelector('#btn-close-modal-footer');

    const openModal = () => {
      if (modalOverlay) {
        modalOverlay.classList.add('is-open');
        modalOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
    };

    const closeModal = () => {
      if (modalOverlay) {
        modalOverlay.classList.remove('is-open');
        modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
    };

    if (btnOpenModal) btnOpenModal.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
    if (btnCloseModalX) btnCloseModalX.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
    if (btnCloseModalFooter) btnCloseModalFooter.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('is-open')) {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  }
}
