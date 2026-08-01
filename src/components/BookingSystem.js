import { MOCK_ROOMS, isSupabaseConfigured, supabase, getStoredReservations, saveStoredReservation, getStoredBlockedDates, getStoredDiscountCodes, getStoredRoomPrices, getStoredDisabledRooms, getDeviceRedeemedDiscountCodes, markDiscountCodeRedeemedOnDevice, incrementDiscountCodeUsage } from '../lib/supabaseClient.js';
import { calculateReservationPrice, generateReservationCode, generateManageToken, BANK_ACCOUNT, BANK_NAME, formatCzechPrice, validateSystemDateIntegrity } from '../utils/pricing.js';
import { sendEmail, generateEmail1RequestReceived, generateEmail1ReceptionNotification } from '../utils/emailService.js';

function getTodayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function getDayAfterTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 3); // 2 noci vychozi pobyt
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function formatCzechDateStr(isoStr) {
  if (!isoStr) return '';
  const parts = isoStr.split('-');
  if (parts.length !== 3) return isoStr;
  const [year, month, day] = parts;
  return `${parseInt(day, 10)}. ${parseInt(month, 10)}. ${year}`;
}

function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(email.trim());
}

function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 9;
}

function isDummyName(nameStr) {
  if (!nameStr) return true;
  const clean = nameStr.trim().toLowerCase();
  const dummyWords = ['test', 'asdf', 'qwer', 'aaa', 'bbb', 'xxx', 'yyy', 'zzz', '123', 'admin'];
  if (dummyWords.some(w => clean === w || clean.startsWith(w + ' '))) return true;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return true;
  return false;
}

function isDummyIdNumber(idStr) {
  if (!idStr) return false;
  const clean = idStr.trim();
  const dummyPatterns = ['123456', '12345678', '000000', '111111', '999999', 'asdf', 'test'];
  return dummyPatterns.some(p => clean.includes(p));
}

export class BookingSystem {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.roomsList = MOCK_ROOMS;
    this.activeReservations = [];
    this.blockedDates = [];
    this.disabledRooms = getStoredDisabledRooms();
    this.discountCodes = getStoredDiscountCodes().filter(c => c.is_active);
    this.roomPrices = getStoredRoomPrices();
    (this.roomPrices || []).forEach(p => {
      const priceVal = Number(p.base_price || p.basePrice);
      if (p.room_id && !isNaN(priceVal) && priceVal > 0) {
        const rm = MOCK_ROOMS.find(r => r.id === p.room_id);
        if (rm) rm.basePrice = priceVal;
      }
    });
    this.appliedDiscount = null;
    this.discountError = '';
    this.discountSuccessMsg = '';
    this.discountCodeInput = '';
    this.currentStep = 1;
    this.state = {
      selectedRoomId: '',
      isCustomDropdownOpen: false,
      preselectedFromExternal: false,
      dateFrom: getTomorrowDateString(),
      dateTo: getDayAfterTomorrowDateString(),
      tempDateFrom: null,
      tempDateTo: null,
      selectingStep: 1, // 1 = picking arrival, 2 = picking departure
      adults: 2,
      children: 0,
      hasDog: false,
      hasEbike: false,
      ebikeCount: 1,
      hasHalfBoard: false,
      halfBoardCount: null,
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      guestStreet: '',
      guestCity: '',
      guestZip: '',
      guestCountry: 'Česká republika',
      guestNote: '',
      honeypot: '',
      isSubmitting: false,
      errorMessage: '',
      guests: [
        {
          name: '',
          email: '',
          phone: '',
          birthDate: '',
          idNumber: '',
          street: '',
          city: '',
          zip: '',
          country: 'Česká republika'
        }
      ],
      fieldErrors: {}
    };
  }

  syncGuestsArray() {
    const totalCount = this.state.adults;
    while (this.state.guests.length < totalCount) {
      this.state.guests.push({
        name: '',
        email: '',
        phone: '',
        birthDate: '',
        idNumber: '',
        street: '',
        city: '',
        zip: '',
        country: 'Česká republika'
      });
    }
    while (this.state.guests.length > totalCount && this.state.guests.length > 1) {
      this.state.guests.pop();
    }
  }

  async init(initialRoomId) {
    if (initialRoomId && this.roomsList.some(r => r.id === initialRoomId)) {
      this.state.selectedRoomId = initialRoomId;
      this.state.preselectedFromExternal = true;
    }
    this.syncGuestsArray();

    if (!window.history.state || !window.history.state.bookingStep) {
      window.history.replaceState({ bookingStep: 1 }, '', window.location.hash || '#rezervace');
    }

    if (!this.popstateListenerAttached) {
      this.popstateListenerAttached = true;
      window.addEventListener('popstate', (e) => {
        const targetStep = (e.state && e.state.bookingStep) ? e.state.bookingStep : 1;
        if (targetStep !== this.currentStep) {
          this.setStep(targetStep, false);
        }
      });
    }

    this.render();

    try {
      await Promise.allSettled([
        this.fetchActiveReservations(),
        this.fetchBlockedDates(),
        this.fetchDisabledRooms(),
        this.fetchDiscountCodes(),
        this.fetchRoomPrices()
      ]);
    } catch (err) {
      console.error('BookingSystem init fetch error:', err);
    }

    this.render();
  }

  async fetchDisabledRooms() {
    let localDisabled = getStoredDisabledRooms();
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('disabled_rooms').select('*');
        if (!error && data) {
          localDisabled = data;
        }
      } catch (err) {
        console.error('Failed to fetch disabled_rooms:', err);
      }
    }
    this.disabledRooms = localDisabled;
    (this.disabledRooms || []).forEach(d => {
      const rm = MOCK_ROOMS.find(r => r.id === d.room_id);
      if (rm) rm.isDisabled = Boolean(d.is_disabled);
    });
  }

  async fetchDiscountCodes() {
    let localCodes = getStoredDiscountCodes().filter(c => c.is_active);
    const localMap = new Map();
    localCodes.forEach(c => {
      if (c.code) localMap.set(String(c.code).trim().toUpperCase(), c);
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('discount_codes').select('*').eq('is_active', true);
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
          return;
        }
      } catch (err) {
        console.error('Fetch discount codes error:', err);
      }
    }
    this.discountCodes = localCodes;
  }

  async fetchRoomPrices() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('room_prices').select('*');
        if (!error && data) {
          this.roomPrices = data;
          return;
        }
      } catch (err) {
        console.error('Fetch room prices error:', err);
      }
    }
    this.roomPrices = getStoredRoomPrices();
  }

  async applyDiscountCode(inputCode) {
    const clean = String(inputCode || '').trim().toUpperCase();
    this.discountError = '';
    if (!clean) {
      this.appliedDiscount = null;
      this.discountSuccessMsg = '';
      this.render();
      return;
    }

    await this.fetchDiscountCodes();
    const found = (this.discountCodes || []).find(c => {
      return String(c.code || '').trim().toUpperCase() === clean;
    });

    if (!found) {
      this.appliedDiscount = null;
      this.discountError = `Slevový kód "${clean}" neexistuje.`;
      this.discountSuccessMsg = '';
      this.render();
      return;
    }

    // 1. Active Check
    const isActive = found.is_active === true || found.is_active === 'true' || found.is_active === 1;
    if (!isActive) {
      this.appliedDiscount = null;
      this.discountError = `Slevový kód "${clean}" je neaktivní nebo vypršel.`;
      this.discountSuccessMsg = '';
      this.render();
      return;
    }

    // 2. Date Range Check (valid_from / valid_until)
    const todayStr = getTodayDateString();
    const stayFromStr = this.state.dateFrom || todayStr;

    if (found.valid_from) {
      if (todayStr < found.valid_from) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" ještě není platný. Akce začíná od ${formatCzechDateStr(found.valid_from)}.`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
      if (stayFromStr < found.valid_from) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" nelze uplatnit na vybraný termín pobytu (Platí až od ${formatCzechDateStr(found.valid_from)}).`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
    }

    if (found.valid_until) {
      if (todayStr > found.valid_until) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" již vypršel dnem ${formatCzechDateStr(found.valid_until)}.`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
      if (stayFromStr > found.valid_until) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" nelze uplatnit na vybraný termín pobytu (Platí pouze do ${formatCzechDateStr(found.valid_until)}).`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
    }

    // 3. Usage Count Cap Check
    if (found.max_uses !== null && found.max_uses !== undefined && found.max_uses !== '') {
      const maxUses = Number(found.max_uses);
      const usedCount = Number(found.used_count || 0);
      if (usedCount >= maxUses) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" již vyčerpal svojí maximální kapacitu použití (${maxUses}×).`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
    }

    // 4. One-Use-Per-Device Protection Check
    if (found.max_uses === 1) {
      const deviceUsedCodes = getDeviceRedeemedDiscountCodes();
      if (deviceUsedCodes.includes(clean)) {
        this.appliedDiscount = null;
        this.discountError = `Slevový kód "${clean}" jste již na svém zařízení v minulosti uplatnili. Každý kód lze uplatnit pouze 1× na osobu.`;
        this.discountSuccessMsg = '';
        this.render();
        return;
      }
    }

    // Valid code passed all 4 checks!
    this.appliedDiscount = found;
    this.discountSuccessMsg = `Slevový kód ${found.code} (-${found.discount_value} %) byl úspěšně uplatněn!`;
    this.discountError = '';
    this.render();
  }

  async fetchActiveReservations() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('reservations').select('*').neq('status', 'cancelled');
        if (!error && data) {
          this.activeReservations = data;
          return;
        }
      } catch (err) {
        console.error('Failed to fetch active reservations from Supabase:', err);
      }
    }
    const stored = getStoredReservations();
    this.activeReservations = stored.filter(r => r.status !== 'cancelled' && r.status !== 'stornováno');
  }

  async fetchBlockedDates() {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('blocked_dates').select('*');
        if (!error && data) {
          this.blockedDates = data;
          return;
        }
      } catch (err) {
        console.error('Failed to fetch blocked_dates from Supabase:', err);
      }
    }
    this.blockedDates = getStoredBlockedDates();
  }

  isDateOccupied(dateStr, roomId) {
    if (this.blockedDates && this.blockedDates.length > 0) {
      const isBlocked = this.blockedDates.some(b => {
        if (b.room_id !== 'all' && b.room_id !== roomId) return false;
        return dateStr >= b.date_from && dateStr <= b.date_to;
      });
      if (isBlocked) return true;
    }

    if (!this.activeReservations || this.activeReservations.length === 0) return false;
    return this.activeReservations.some(r => {
      if (r.room_id !== roomId || r.status === 'cancelled' || r.status === 'stornováno') return false;
      return dateStr >= r.date_from && dateStr < r.date_to;
    });
  }

  checkReservationOverlap(roomId, dateFrom, dateTo) {
    if (this.blockedDates && this.blockedDates.length > 0) {
      const blockedConflict = this.blockedDates.find(b => {
        if (b.room_id !== 'all' && b.room_id !== roomId) return false;
        return b.date_from <= dateTo && b.date_to >= dateFrom;
      });
      if (blockedConflict) {
        return { isBlocked: true, reason: blockedConflict.reason };
      }
    }

    if (!this.activeReservations || this.activeReservations.length === 0) return null;
    return this.activeReservations.find(r => {
      if (r.room_id !== roomId || r.status === 'cancelled' || r.status === 'stornováno') return false;
      return r.date_from < dateTo && r.date_to > dateFrom;
    });
  }

  scrollToErrorMessage() {
    setTimeout(() => {
      const errBanner = this.container.querySelector('.booking-error-alert') ||
        this.container.querySelector('.booking-alert-error') ||
        this.container.querySelector('.form-field.has-error') ||
        this.container.querySelector('#date-from-btn') ||
        this.container.querySelector('.booking-card');
      if (errBanner) {
        errBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollTo({ top: this.container.offsetTop - 80, behavior: 'smooth' });
      }
    }, 60);
  }

  showFieldError(fieldId, errorMsg) {
    this.state.fieldErrors = { [fieldId]: errorMsg };
    this.render();

    setTimeout(() => {
      const match = fieldId.match(/^guest-(\d+)-/);
      if (match) {
        const guestIdx = match[1];
        const accordionItem = document.getElementById(`guest-accordion-${guestIdx}`);
        if (accordionItem) {
          accordionItem.classList.add('is-open');
          const body = accordionItem.querySelector('.guest-accordion-body');
          if (body) body.style.display = 'block';
          const chevron = accordionItem.querySelector('.guest-chevron');
          if (chevron) chevron.textContent = '▲';
        }
      }
      const el = document.getElementById(fieldId) || this.container.querySelector(`[data-field="${fieldId.replace(/^guest-\d+-/, '')}"]`);
      const targetContainer = el ? (el.closest('.form-field') || el) : this.container.querySelector('.form-field.has-error');
      if (targetContainer) {
        targetContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (el && typeof el.focus === 'function') {
          el.focus({ preventScroll: true });
          if (typeof el.setCustomValidity === 'function') {
            el.setCustomValidity(errorMsg || 'Vyplňte prosím toto pole.');
            if (typeof el.reportValidity === 'function') {
              el.reportValidity();
            }
          }
        }
      } else {
        this.scrollToErrorMessage();
      }
    }, 80);
  }

  clearFieldError(fieldId) {
    if (this.state.fieldErrors && this.state.fieldErrors[fieldId]) {
      delete this.state.fieldErrors[fieldId];
      this.render();
    }
  }

  setupAddressAutocomplete() {
    const streetInputs = this.container.querySelectorAll('input[data-field="street"]');
    streetInputs.forEach(input => {
      const idx = parseInt(input.dataset.idx, 10);
      const parentField = input.closest('.form-field');
      if (!parentField) return;

      let wrap = parentField.querySelector('.address-autocomplete-wrap');
      if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'address-autocomplete-wrap';
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);
      }

      let dropdown = wrap.querySelector('.address-autocomplete-dropdown');
      if (!dropdown) {
        dropdown = document.createElement('ul');
        dropdown.className = 'address-autocomplete-dropdown';
        dropdown.style.display = 'none';
        wrap.appendChild(dropdown);
      }

      let debounceTimer = null;

      const hideDropdown = () => {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
      };

      input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);
        if (query.length < 3) {
          hideDropdown();
          return;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=cz,sk&q=${encodeURIComponent(query)}&limit=5`, {
              headers: { 'User-Agent': 'HotelUMustku/1.0' }
            });
            if (!res.ok) return;
            const data = await res.json();
            if (!data || data.length === 0) {
              hideDropdown();
              return;
            }

            dropdown.innerHTML = data.map(item => {
              const addr = item.address || {};
              const road = addr.road || addr.pedestrian || addr.suburb || query;
              const houseNum = addr.house_number || addr.building || '';
              const streetStr = (road + (houseNum ? ' ' + houseNum : '')).trim();
              const cityStr = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
              const postcodeStr = addr.postcode || '';
              const countryStr = addr.country || 'Česká republika';
              const displayTitle = streetStr + (cityStr ? `, ${cityStr}` : '');
              const displaySub = (postcodeStr ? postcodeStr + ' ' : '') + cityStr;

              return `
                <li class="address-autocomplete-item" 
                    data-street="${streetStr}" 
                    data-city="${cityStr}" 
                    data-zip="${postcodeStr}" 
                    data-country="${countryStr}">
                  <span class="address-main">${displayTitle}</span>
                  <span class="address-sub">${displaySub}</span>
                </li>
              `;
            }).join('');

            dropdown.style.display = 'block';

            dropdown.querySelectorAll('.address-autocomplete-item').forEach(itemEl => {
              itemEl.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const s = itemEl.dataset.street;
                const c = itemEl.dataset.city;
                const z = itemEl.dataset.zip;
                const cnt = itemEl.dataset.country;

                input.value = s;
                if (this.state.guests[idx]) {
                  this.state.guests[idx].street = s;
                  if (c) this.state.guests[idx].city = c;
                  if (z) this.state.guests[idx].zip = z;
                  if (cnt) this.state.guests[idx].country = cnt;

                  if (idx === 0) {
                    this.state.guestStreet = s;
                    if (c) this.state.guestCity = c;
                    if (z) this.state.guestZip = z;
                    if (cnt) this.state.guestCountry = cnt;
                  }
                }

                const cityEl = this.container.querySelector(`#guest-${idx}-city`);
                const zipEl = this.container.querySelector(`#guest-${idx}-zip`);
                const countryEl = this.container.querySelector(`#guest-${idx}-country`);

                if (cityEl && c) cityEl.value = c;
                if (zipEl && z) zipEl.value = z;
                if (countryEl && cnt) countryEl.value = cnt;

                hideDropdown();
              });
            });

          } catch (err) {
            console.warn('Address autocomplete fetch failed:', err);
            hideDropdown();
          }
        }, 280);
      });

      document.addEventListener('click', (e) => {
        if (!wrap.contains(e.target)) {
          hideDropdown();
        }
      });
    });
  }

  setStep(step, pushHistory = true) {
    if (pushHistory && step !== this.currentStep) {
      try {
        window.history.pushState({ bookingStep: step }, '', '#rezervace');
      } catch (err) {
        console.warn('History pushState failed:', err);
      }
    }
    this.currentStep = step;
    this.state.errorMessage = '';
    this.render();
    window.scrollTo({ top: this.container.offsetTop - 80, behavior: 'smooth' });
  }

  getSelectedRoom() {
    if (!this.state.selectedRoomId) return null;
    const found = this.roomsList.find(r => r.id === this.state.selectedRoomId);
    if (found && !found.isDisabled) return found;
    return null;
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
    if (!room) {
      return {
        nights,
        roomBasePriceTotal: 0,
        singleNightSurchargeTotal: 0,
        halfBoardPriceTotal: 0,
        dogPriceTotal: 0,
        ebikePriceTotal: 0,
        cityTax: 0,
        discountAmount: 0,
        discountPercent: 0,
        discountLabel: '',
        formattedDiscountAmount: '0 Kč',
        totalPrice: 0,
        depositPriceTotal: 0,
        remainingPriceTotal: 0,
      };
    }
    const customPriceObj = (this.roomPrices || []).find(p => p.room_id === room.id);
    const customBaseRate = customPriceObj ? (customPriceObj.base_price || customPriceObj.weekday_price) : (room.weekdayPrice || room.basePrice);
    const customWeekdayRate = customPriceObj ? (customPriceObj.weekday_price || customPriceObj.base_price) : room.weekdayPrice;
    const customWeekendRate = customPriceObj ? (customPriceObj.weekend_price || customPriceObj.base_price) : room.weekendPrice;

    return calculateReservationPrice({
      roomType: room.type,
      nights,
      persons: this.state.adults,
      adults: this.state.adults,
      children: 0,
      dateFrom: this.state.dateFrom,
      dateTo: this.state.dateTo,
      hasDog: this.state.hasDog,
      hasEbike: this.state.hasEbike,
      ebikeCount: this.state.ebikeCount,
      hasHalfBoard: this.state.hasHalfBoard,
      halfBoardCount: this.state.halfBoardCount,
      customBaseRate,
      customWeekdayRate,
      customWeekendRate,
      discountObj: this.appliedDiscount,
    });
  }

  async handleFinalBookingSubmit(e) {
    e.preventDefault();
    if (this.state.isSubmitting) return;

    if (this.state.honeypot) {
      console.warn('Spam detected via honeypot.');
      return;
    }

    const g0NameEl = this.container.querySelector('#guest-0-name');
    const g0EmailEl = this.container.querySelector('#guest-0-email');
    const g0PhoneEl = this.container.querySelector('#guest-0-phone');
    if (g0NameEl && g0NameEl.value) this.state.guestName = g0NameEl.value.trim();
    if (g0EmailEl && g0EmailEl.value) this.state.guestEmail = g0EmailEl.value.trim();
    if (g0PhoneEl && g0PhoneEl.value) this.state.guestPhone = g0PhoneEl.value.trim();

    this.syncGuestsArray();

    this.state.guests.forEach((g, idx) => {
      const nameEl = this.container.querySelector(`#guest-${idx}-name`);
      const birthEl = this.container.querySelector(`#guest-${idx}-birthdate`);
      const idNumEl = this.container.querySelector(`#guest-${idx}-idnumber`);
      const streetEl = this.container.querySelector(`#guest-${idx}-street`);
      const cityEl = this.container.querySelector(`#guest-${idx}-city`);
      const zipEl = this.container.querySelector(`#guest-${idx}-zip`);
      const countryEl = this.container.querySelector(`#guest-${idx}-country`);

      if (nameEl && nameEl.value) g.name = nameEl.value.trim();
      if (birthEl && birthEl.value) g.birthDate = birthEl.value.trim();
      if (idNumEl && idNumEl.value) g.idNumber = idNumEl.value.trim();
      if (streetEl && streetEl.value) g.street = streetEl.value.trim();
      if (cityEl && cityEl.value) g.city = cityEl.value.trim();
      if (zipEl && zipEl.value) g.zip = zipEl.value.trim();
      if (countryEl && countryEl.value) g.country = countryEl.value.trim();
    });

    if (!this.state.guestName || !this.state.guestName.trim() || isDummyName(this.state.guestName)) {
      this.showFieldError('guest-0-name', 'Prosíme, vyplňte vaše platné Jméno a Příjmení.');
      return;
    }

    if (!isValidEmail(this.state.guestEmail)) {
      this.showFieldError('guest-0-email', 'Prosíme, zadejte platnou e-mailovou adresu hlavního rezervujícího.');
      return;
    }

    if (!isValidPhone(this.state.guestPhone)) {
      this.showFieldError('guest-0-phone', 'Prosíme, zadejte platné telefonní číslo vč. předvolby hlavního rezervujícího.');
      return;
    }

    const g0IdNum = this.container.querySelector('#guest-0-idnumber')?.value || this.state.guests[0]?.idNumber;
    if (g0IdNum && isDummyIdNumber(g0IdNum)) {
      this.showFieldError('guest-0-idnumber', 'Prosíme, zadejte platné číslo OP nebo pasu (ne sekvenční číslo).');
      return;
    }

    for (let i = 1; i < this.state.guests.length; i++) {
      const nameEl = this.container.querySelector(`#guest-${i}-name`);
      if (nameEl && nameEl.value) this.state.guests[i].name = nameEl.value.trim();
      const g = this.state.guests[i];
      if (!g || !g.name || !g.name.trim() || isDummyName(g.name)) {
        this.showFieldError(`guest-${i}-name`, `Prosíme, vyplňte platné Jméno a Příjmení u Host ${i + 1}.`);
        return;
      }
      const idNumEl = this.container.querySelector(`#guest-${i}-idnumber`);
      const idVal = idNumEl?.value || g.idNumber;
      if (idVal && isDummyIdNumber(idVal)) {
        this.showFieldError(`guest-${i}-idnumber`, `Prosíme, zadejte platné číslo OP nebo pasu u Host ${i + 1}.`);
        return;
      }
    }

    const room = this.getSelectedRoom();
    if (!room) {
      this.state.errorMessage = 'Prosíme vyberte si nejprve pokoj v Kroku 1.';
      this.setStep(1);
      return;
    }

    this.state.isSubmitting = true;
    const submitBtn = this.container.querySelector('.btn-confirm-booking');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      submitBtn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span>Odesílám žádost...</span>
      `;
    }

    await this.fetchActiveReservations();
    const overlap = this.checkReservationOverlap(room.id, this.state.dateFrom, this.state.dateTo);
    if (overlap) {
      this.state.errorMessage = 'Tento pokoj je ve vybraném termínu již zarezervovaný. Prosíme vyberte jiný termín nebo pokoj.';
      this.state.isSubmitting = false;
      this.render();

      setTimeout(() => {
        const errorAlert = this.container.querySelector('.booking-alert-error') || this.container.querySelector('.card-step-2');
        if (errorAlert) {
          errorAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
      return;
    }

    const pricing = this.getPricingBreakdown();
    const code = generateReservationCode();
    const manageToken = generateManageToken();
    const resId = 'res-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    const reservationData = {
      id: resId,
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
      guest_street: this.state.guests[0]?.street || this.state.guestStreet || '',
      guest_city: this.state.guests[0]?.city || this.state.guestCity || '',
      guest_zip: this.state.guests[0]?.zip || this.state.guestZip || '',
      guest_country: this.state.guests[0]?.country || this.state.guestCountry || 'Česká republika',
      guests: this.state.guests.map((g, idx) => ({
        is_main: idx === 0,
        role: idx === 0 ? 'Hlavní rezervující' : `Ubytovaný host ${idx + 1}`,
        name: idx === 0 ? this.state.guestName : g.name,
        email: idx === 0 ? this.state.guestEmail : (g.email || ''),
        phone: idx === 0 ? this.state.guestPhone : (g.phone || ''),
        birth_date: g.birthDate || '',
        id_number: g.idNumber || '',
        street: g.street || (idx === 0 ? this.state.guestStreet : ''),
        city: g.city || (idx === 0 ? this.state.guestCity : ''),
        zip: g.zip || (idx === 0 ? this.state.guestZip : ''),
        country: g.country || 'Česká republika'
      })),
      adults_count: this.state.adults,
      children_count: 0,
      has_dog: this.state.hasDog,
      has_ebike: this.state.hasEbike,
      ebike_count: pricing.ebikeCount,
      has_half_board: this.state.hasHalfBoard,
      half_board_count: pricing.halfBoardCount,
      total_price: pricing.totalPrice,
      deposit_price: pricing.depositPriceTotal,
      remaining_price: pricing.remainingPriceTotal,
      accommodation_price: pricing.accommodationPrice,
      city_tax: pricing.cityTax,
      addons_price: pricing.addonsPrice,
      status: 'pending_approval',
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('reservations').insert([reservationData]);
      } catch (err) {
        console.error('Failed to insert reservation into Supabase:', err);
      }
    }

    saveStoredReservation(reservationData);

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'rezervace_odeslana', {
        value: pricing.totalPrice,
        currency: 'CZK',
        nights: this.calculateNights(),
        adults: this.state.adults,
        children: 0,
        room_type: room?.name || 'neurceno',
        half_board: this.state.hasHalfBoard,
        with_dog: this.state.hasDog
      });
    }

    if (!this.appliedDiscount && (this.discountCodeInput || '').trim()) {
      await this.applyDiscountCode(this.discountCodeInput.trim());
    }

    if (this.appliedDiscount) {
      await incrementDiscountCodeUsage(this.appliedDiscount.code || this.appliedDiscount.id);
      markDiscountCodeRedeemedOnDevice(this.appliedDiscount.code);
    }

    try {
      const email1Guest = generateEmail1RequestReceived({ reservation: reservationData, room, pricing });
      await sendEmail({
        to: reservationData.guest_email,
        subject: email1Guest.subject,
        html: email1Guest.html,
        type: 'email_1_request_received',
        reservationCode: code
      });

      const email1Reception = generateEmail1ReceptionNotification({ reservation: reservationData, room, pricing });
      await sendEmail({
        to: 'ondra.zeman05@gmail.com',
        subject: email1Reception.subject,
        html: email1Reception.html,
        type: 'email_1_reception_notification',
        reservationCode: code
      });
    } catch (emailErr) {
      console.error('Failed to dispatch Phase 1 emails:', emailErr);
    }

    this.state.confirmedReservation = reservationData;
    this.state.isSubmitting = false;
    this.setStep(3);
  }

  render() {
    if (!this.container) return;

    if (this.state.showCalendarModal) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('modal-open');
      document.body.classList.add('modal-open');
    } else {
      const isTermsOpen = Boolean(this.container && this.container.querySelector('#terms-modal-overlay.is-open'));
      if (!isTermsOpen) {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
      }
    }

    const room = this.getSelectedRoom();
    const pricing = this.getPricingBreakdown();
    const nights = this.calculateNights();

    let contentHtml = '';

    if (this.currentStep === 1) {
      contentHtml = this.renderStep1(room, pricing, nights);
    } else if (this.currentStep === 2) {
      contentHtml = this.renderStep2Form(room, pricing, nights);
    } else if (this.currentStep === 3) {
      contentHtml = this.renderStep3Confirmation(room, pricing);
    }

    this.container.innerHTML = `
      <div class="booking-wizard-wrapper">
        <div class="booking-stepper">
          <button type="button" class="step-item ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''} btn-step-nav" data-target-step="1" title="Krok 1: Termín & Výběr pokoje">
            <span class="step-number">1</span>
            <span class="step-label">
              <span class="label-full">Termín & Pokoj</span>
              <span class="label-short">Pokoj</span>
            </span>
          </button>
          <div class="step-divider"></div>
          <button type="button" class="step-item ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''} ${this.currentStep < 2 ? 'disabled' : 'btn-step-nav'}" data-target-step="2" title="Krok 2: Údaje hosta">
            <span class="step-number">2</span>
            <span class="step-label">
              <span class="label-full">Údaje hosta</span>
              <span class="label-short">Údaje</span>
            </span>
          </button>
          <div class="step-divider"></div>
          <button type="button" class="step-item ${this.currentStep === 3 ? 'active' : ''}" disabled>
            <span class="step-number">3</span>
            <span class="step-label">
              <span class="label-full">Potvrzení & Platba</span>
              <span class="label-short">Platba</span>
            </span>
          </button>
        </div>

        ${this.state.errorMessage ? `<div class="booking-error-alert">${this.state.errorMessage}</div>` : ''}

        ${contentHtml}
      </div>

      ${this.renderTermsModal()}
      ${this.renderCustomCalendarModal()}
    `;

    this.attachEventListeners();
  }

  renderCustomCalendarModal() {
    if (!this.state.showCalendarModal) return '';

    const room = this.getSelectedRoom();
    const roomIdForCal = room ? room.id : 'all';

    const effectiveFrom = this.state.tempDateFrom || this.state.dateFrom;
    const effectiveTo = this.state.tempDateTo || this.state.dateTo;

    const baseForMonth = effectiveFrom || getTodayDateString();

    if (!this.state.calYearMonth) {
      const [y, m] = baseForMonth.split('-').map(Number);
      this.state.calYearMonth = { year: y, month: m };
    }

    const { year, month } = this.state.calYearMonth;

    const monthNames = [
      'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
      'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
    ];

    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = getTodayDateString();

    let daysHtml = '';
    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="cal-day cal-day-empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dayStr < todayStr;
      const isOccupied = this.isDateOccupied(dayStr, roomIdForCal);

      const isFrom = dayStr === effectiveFrom;
      const isTo = dayStr === effectiveTo;
      const isInRange = effectiveFrom && effectiveTo && dayStr > effectiveFrom && dayStr < effectiveTo;

      let dayClass = 'cal-day';
      if (isPast) dayClass += ' is-disabled';
      if (isOccupied) dayClass += ' is-occupied';
      if (isFrom) dayClass += ' is-from is-selected';
      if (isTo) dayClass += ' is-to is-selected';
      if (isInRange) dayClass += ' in-range';

      const isDisabled = isPast;

      daysHtml += `
        <button type="button" class="${dayClass}" data-date="${dayStr}" ${isDisabled ? 'disabled' : ''} title="${isOccupied ? 'V tomto dni probíhá rezervace či uzávěrka' : ''}">
          ${day}
        </button>
      `;
    }

    let tempNights = 1;
    if (effectiveFrom && effectiveTo) {
      const start = new Date(effectiveFrom);
      const end = new Date(effectiveTo);
      const diffTime = end - start;
      tempNights = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    return `
      <div class="cal-modal-overlay" id="cal-modal-overlay">
        <div class="cal-modal-card">
          <div class="cal-modal-header">
            <button type="button" class="cal-nav-btn" id="cal-prev-month" aria-label="Předchozí měsíc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <h4 class="cal-month-title">${monthNames[month - 1]} ${year}</h4>
            <button type="button" class="cal-nav-btn" id="cal-next-month" aria-label="Následující měsíc">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <button type="button" class="cal-close-btn" id="cal-close-btn" aria-label="Zavřít">&times;</button>
          </div>

          <div class="cal-week-days">
            <span>Po</span><span>Út</span><span>St</span><span>Čt</span><span>Pá</span><span>So</span><span>Ne</span>
          </div>

          <div class="cal-grid">
            ${daysHtml}
          </div>

          <div class="cal-modal-footer" style="padding: 16px; border-top: 1px solid #E7E5DC; display: flex; flex-direction: column; gap: 12px;">
            ${effectiveFrom && effectiveTo ? `
              <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
                <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #1C1C19;">
                  Příjezd: ${formatCzechDateStr(effectiveFrom)} &nbsp;|&nbsp; Odjezd: ${formatCzechDateStr(effectiveTo)}
                </span>
                <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
                  Celková délka pobytu: <strong>${tempNights} ${tempNights === 1 ? 'noc' : (tempNights < 5 ? 'noci' : 'nocí')}</strong>
                </span>
              </div>
              <button type="button" class="btn btn-confirm-cal-dates" id="cal-confirm-dates-btn" style="height: 42px; padding: 0 24px; font-size: 15px; font-weight: 600; color: #FFFFFF; background-color: #4A5A24; border: none; border-radius: 2px; cursor: pointer; width: 100%; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s ease;">
                Potvrdit termín pobytu
              </button>
            ` : `
              <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
                <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #4A5A24;">
                  Příjezd: ${formatCzechDateStr(effectiveFrom)}
                </span>
                <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
                  Nyní klikněte v kalendáři na datum odjezdu (Check-out)
                </span>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  renderTermsModal() {
    return `
      <div class="terms-modal-overlay" id="terms-modal-overlay" aria-hidden="true">
        <div class="terms-modal-card">
          <div class="terms-modal-header">
            <h3 class="terms-modal-title">Podmínky ubytování & stornopodmínky</h3>
            <button type="button" class="terms-modal-close" id="btn-close-terms-modal" aria-label="Zavřít">&times;</button>
          </div>

          <div class="terms-modal-body">
            <div class="terms-top-contacts">
              <a href="tel:+420777666273" class="terms-contact-link">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                <span>+420 777 666 273</span>
              </a>
              <span class="terms-contact-sep">•</span>
              <a href="mailto:hotel@umustku.cz" class="terms-contact-link">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <span>hotel@umustku.cz</span>
              </a>
            </div>

            <div class="terms-row-item">
              <span class="terms-row-title">Příjezd a odjezd (Check-in & Check-out)</span>
              <div class="terms-row-desc">
                <p>Standardní čas <strong>Check-in je od 15:00 hod.</strong> a čas <strong>Check-out do 10:00 hod.</strong></p>
                <p class="terms-sub-note">Po předchozí dohodě s recepcí lze časy příjezdu či odjezdu individuálně přizpůsobit.</p>
              </div>
            </div>

            <div class="terms-row-item">
              <span class="terms-row-title">Flexibilní přesun termínu</span>
              <div class="terms-row-desc">
                <p>V případě jakýchkoliv nečekaných událostí se s námi neváhejte spojit. Po vzájemné dohodě vám rádi flexibilně přesuneme termín pobytu na jiný vyhovující termín.</p>
              </div>
            </div>

            <div class="terms-row-item">
              <span class="terms-row-title">Příplatek za 1 noc a samostatné obsazení pokoje</span>
              <div class="terms-row-desc">
                <p>Při pobytu na <strong>pouze 1 noc</strong> nebo při <strong>samostatném obsazení pokoje jedním hostem</strong> se k ceně připočítává přiměřený příplatek:</p>
                <ul class="terms-surcharge-list" style="margin: 8px 0 8px 18px; padding: 0; list-style-type: disc; font-size: 14.5px; color: #333333; line-height: 1.6;">
                  <li><strong>Standardní a Turistické pokoje:</strong> +200 Kč / osoba / noc</li>
                  <li><strong>Nadstandardní pokoje (A, A1, Zen):</strong> +300 Kč / osoba / noc</li>
                </ul>
                <p class="terms-sub-note">Tento příplatek kompenzuje zvýšené režijní náklady spojené s kompletní přípravou pokoje, úklidem a výměnou ložního prádla pro krátkodobý pobyt či neobsazené lůžko.</p>
              </div>
            </div>

            <div class="terms-row-item storno-section-item">
              <span class="terms-row-title">Stornopodmínky při zrušení rezervace</span>
              
              <div class="clean-storno-table">
                <div class="clean-storno-row">
                  <span class="storno-time-label">Více než 3 dny před příjezdem:</span>
                  <div class="storno-fee-group">
                    <span class="storno-fee-val">Zdarma</span>
                    <span class="storno-fee-sub">bez storno poplatku</span>
                  </div>
                </div>

                <div class="clean-storno-row">
                  <span class="storno-time-label">Méně než 3 dny před příjezdem:</span>
                  <div class="storno-fee-group">
                    <span class="storno-fee-val">100 %</span>
                    <span class="storno-fee-sub">z celkové ceny pobytu (nebo nedojezd)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="terms-modal-footer">
            <button type="button" class="btn-terms-close-footer" id="btn-close-modal-footer">Zavřít okno</button>
          </div>
        </div>
      </div>
    `;
  }

  renderStep1(room, pricing, nights) {
    const formattedFrom = formatCzechDateStr(this.state.dateFrom);
    const formattedTo = formatCzechDateStr(this.state.dateTo);

    const isOccupiedSelected = room ? Boolean(this.checkReservationOverlap(room.id, this.state.dateFrom, this.state.dateTo)) : false;
    const isDisabledSelected = room ? Boolean(room.isDisabled || (this.disabledRooms && this.disabledRooms.some(d => d.room_id === room.id && d.is_disabled))) : false;
    const isAvailableSelected = room ? (!isOccupiedSelected && !isDisabledSelected) : false;

    // Prepare availability statuses for all rooms for selected date range
    const roomItems = this.roomsList.map(r => {
      const isOccupied = Boolean(this.checkReservationOverlap(r.id, this.state.dateFrom, this.state.dateTo));
      const isDisabled = Boolean(r.isDisabled || (this.disabledRooms && this.disabledRooms.some(d => d.room_id === r.id && d.is_disabled)));
      const isAvailable = !isOccupied && !isDisabled;

      const customPriceObj = (this.roomPrices || []).find(p => p.room_id === r.id);
      const customBaseRate = customPriceObj ? (customPriceObj.base_price || customPriceObj.weekday_price) : (r.weekdayPrice || r.basePrice);
      const customWeekdayRate = customPriceObj ? (customPriceObj.weekday_price || customPriceObj.base_price) : r.weekdayPrice;
      const customWeekendRate = customPriceObj ? (customPriceObj.weekend_price || customPriceObj.base_price) : r.weekendPrice;

      const roomPricing = calculateReservationPrice({
        roomType: r.type,
        nights,
        persons: this.state.adults,
        adults: this.state.adults,
        children: 0,
        dateFrom: this.state.dateFrom,
        dateTo: this.state.dateTo,
        hasDog: this.state.hasDog,
        hasEbike: this.state.hasEbike,
        ebikeCount: this.state.ebikeCount,
        hasHalfBoard: this.state.hasHalfBoard,
        halfBoardCount: this.state.halfBoardCount,
        customBaseRate,
        customWeekdayRate,
        customWeekendRate,
        discountObj: this.appliedDiscount,
      });

      return {
        room: r,
        isAvailable,
        isOccupied,
        isDisabled,
        pricing: roomPricing
      };
    });

    return `
      <div class="booking-step-content">
        <div class="booking-grid">
          <div class="booking-left-col">
            
            <!-- 1. TERMÍN POBYTU (NAHOŘE JAKO PRVNÍ) -->
            <div class="booking-card card-step-1">
              <h3 class="card-title">1. Termín pobytu <span class="required-badge">* Povinné</span></h3>
              
              <div class="dates-grid">
                <div class="form-field">
                  <label for="date-from-btn" class="form-label">Datum příjezdu (Check-in od 15:00):</label>
                  <button type="button" id="date-from-btn" class="custom-date-btn" data-field="dateFrom">
                    <span class="custom-date-text">${formattedFrom}</span>
                    <svg class="custom-date-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#697947" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                </div>
                <div class="form-field">
                  <label for="date-to-btn" class="form-label">Datum odjezdu (Check-out do 10:00):</label>
                  <button type="button" id="date-to-btn" class="custom-date-btn" data-field="dateTo">
                    <span class="custom-date-text">${formattedTo}</span>
                    <svg class="custom-date-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#697947" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                  </button>
                </div>
              </div>
              
              <div class="terms-card-bottom-row">
                <p class="nights-counter">Délka pobytu: <strong>${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</strong></p>
                <button type="button" class="btn-terms-link" id="btn-open-terms-modal">
                  <span>Podmínky ubytování a storno</span>
                  <span class="link-arrow">&rarr;</span>
                </button>
              </div>
            </div>

            <!-- 2. VÝBĚR POKOJE K REZERVACI (ČISTÁ TYPOGRAFICKÁ INFORMACE BEZ RÁMEČKU A POZADÍ) -->
            <div class="booking-card card-step-2-rooms">
              <h3 class="card-title">2. Výběr pokoje k rezervaci <span class="required-badge">* Povinné</span></h3>
              
              ${this.state.preselectedFromExternal && room ? `
                <div style="padding: 12px 0; margin: 14px 0 18px 0; border-top: 1px solid #E5E3D9; border-bottom: 1px solid #E5E3D9;">
                  ${isAvailableSelected ? `
                    <div style="font-size: 14px; color: #4A5A24; font-weight: 600; display: flex; align-items: center; gap: 8px; line-height: 1.4;">
                      <span class="status-dot dot-available"></span>
                      <span>Vybrali jste <strong>${room.name}</strong> pro termín <strong>${formattedFrom} – ${formattedTo}</strong>. Přejete-li si jiný termín, upravte jej v bodu 1.</span>
                    </div>
                  ` : `
                    <div style="font-size: 14px; color: #C62828; font-weight: 600; display: flex; align-items: center; gap: 8px; line-height: 1.4;">
                      <span class="status-dot dot-occupied"></span>
                      <span>Pokoj <strong>${room.name}</strong> je v termínu <strong>${formattedFrom} – ${formattedTo}</strong> ${isOccupiedSelected ? 'obsazený' : 'nedostupný'}. Upravte prosím termín v bodu 1 nebo zvolte jiný pokoj.</span>
                    </div>
                  `}
                </div>
              ` : ''}

              <div class="custom-room-dropdown ${this.state.isCustomDropdownOpen ? 'is-open' : ''}" id="custom-room-dropdown">
                <label for="custom-dropdown-trigger" class="form-label">Vyberte si pokoj ze seznamu:</label>
                
                <button type="button" id="custom-dropdown-trigger" class="dropdown-trigger-btn ${room ? 'has-selection' : ''}" aria-expanded="${this.state.isCustomDropdownOpen ? 'true' : 'false'}" aria-haspopup="listbox">
                  ${room ? `
                    <div class="trigger-room-content">
                      <div class="trigger-info">
                        <div class="trigger-header-line">
                          <span class="trigger-room-name">${room.name}</span>
                          <span class="room-status-pill ${isAvailableSelected ? 'status-available' : (isDisabledSelected ? 'status-blocked' : 'status-occupied')}" style="font-size: 11px; padding: 2px 7px;">
                            <span class="status-dot ${isAvailableSelected ? 'dot-available' : (isDisabledSelected ? 'dot-blocked' : 'dot-occupied')}"></span>
                            ${isAvailableSelected ? 'Volno' : (isDisabledSelected ? 'Nedostupné' : 'Obsazeno')}
                          </span>
                        </div>
                        <span class="trigger-price-text">${formatCzechPrice(pricing.totalPrice)} za ${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</span>
                      </div>
                    </div>
                  ` : `
                    <span class="trigger-placeholder">-- Vyberte si pokoj pro tento termín --</span>
                  `}
                  <span class="trigger-chevron">${this.state.isCustomDropdownOpen ? '▲' : '▼'}</span>
                </button>

                <div class="dropdown-options-panel ${this.state.isCustomDropdownOpen ? 'is-visible' : ''}" role="listbox" id="custom-dropdown-options">
                  <div class="dropdown-panel-header">
                    <span>Dostupnost pokojů pro termín ${formattedFrom} – ${formattedTo}</span>
                  </div>
                  <div class="dropdown-options-list">
                    ${roomItems.map(item => {
                      const r = item.room;
                      const p = item.pricing;
                      const isSelected = r.id === (room ? room.id : '');
                      const isAvailable = item.isAvailable;
                      const statusClass = isAvailable ? 'status-available' : (item.isDisabled ? 'status-blocked' : 'status-occupied');
                      const statusDotClass = isAvailable ? 'dot-available' : (item.isDisabled ? 'dot-blocked' : 'dot-occupied');
                      const statusBadgeText = isAvailable ? 'Volno' : (item.isDisabled ? 'Nedostupné' : 'Obsazeno');
                      
                      return `
                        <div class="custom-dropdown-option ${isSelected ? 'is-selected' : ''} ${!isAvailable ? 'is-disabled' : ''}" 
                             role="option" 
                             aria-selected="${isSelected ? 'true' : 'false'}"
                             data-room-id="${r.id}" 
                             ${!isAvailable ? 'aria-disabled="true"' : 'tabindex="0"'}>
                          
                          <div class="option-main-info">
                            <div class="option-title-row">
                              <span class="option-room-name">${r.name}</span>
                              <span class="option-floor-tag">${r.floor === 'prizemi' ? 'Přízemí' : '1. Patro'}</span>
                            </div>
                            <div class="option-sub-row">
                              <span class="option-price-tag">${formatCzechPrice(p.totalPrice)} <small>/ ${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</small></span>
                            </div>
                          </div>

                          <div class="option-right-status">
                            <span class="room-status-pill ${statusClass}">
                              <span class="status-dot ${statusDotClass}"></span>${statusBadgeText}
                            </span>
                            ${isSelected ? '<span class="option-checkmark">✓</span>' : ''}
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </div>
              </div>

              ${room ? `
                <div class="room-mini-preview" style="margin-top: 16px;">
                  <img src="${room.image || '/hezky pokoj 1.webp'}" alt="${room.name}" class="preview-room-thumb" loading="eager" decoding="async" fetchpriority="high">
                  <div class="preview-info-wrap">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
                      <span class="preview-badge">${room.floor === 'prizemi' ? 'Přízemí' : '1. Patro (Výhled na můstky)'}</span>
                      <span class="room-status-pill ${isAvailableSelected ? 'status-available' : (isDisabledSelected ? 'status-blocked' : 'status-occupied')}" style="font-size: 11px; padding: 2px 8px;">
                        <span class="status-dot ${isAvailableSelected ? 'dot-available' : (isDisabledSelected ? 'dot-blocked' : 'dot-occupied')}"></span>
                        ${isAvailableSelected ? 'Volno v tomto termínu' : (isDisabledSelected ? 'Nedostupné v tomto termínu' : 'Obsazeno v tomto termínu')}
                      </span>
                    </div>
                    <h4 class="preview-room-title">${room.name}</h4>
                    <p class="preview-desc">Kapacita: až ${room.capacity + (room.extraBeds || 0)} osoby • Včetně bufetové snídaně a Wi-Fi zdarma</p>
                  </div>
                  <button type="button" class="btn btn-view-room-details" id="btn-view-room-details" data-room-id="${room.id}">
                    <span>Zobrazit fotky pokoje</span>
                  </button>
                </div>
              ` : `
                <div class="room-select-prompt" style="background: #FAF9F5; border: 1.5px dashed #C8C6B9; border-radius: 4px; padding: 18px 20px; text-align: left; margin-top: 14px;">
                  <h4 style="margin: 0 0 4px 0; font-size: 15.5px; font-weight: 700; color: #1C1C19;">Zatím jste nevybrali žádný pokoj</h4>
                  <p style="margin: 0; font-size: 13.5px; color: #666666;">Pro zobrazení informací a výpočet přesné ceny klikněte na tlačítko výběru pokoje výše.</p>
                </div>
              `}
            </div>

            <!-- 3. POČET OSOB (UBYTOVANÍ HOSTÉ - JEDINÉ POČÍTALO) -->
            <div class="booking-card">
              <h3 class="card-title">3. Počet ubytovaných osob <span class="required-badge">* Povinné</span></h3>
              <div class="guests-picker-grid">
                <div class="guest-counter-item">
                  <span class="counter-label">Osoby (ubytovaní hosté):</span>
                  <div class="counter-controls">
                    <button type="button" class="btn-counter btn-counter-minus" data-target="adults">-</button>
                    <span class="counter-value">${this.state.adults || 2}</span>
                    <button type="button" class="btn-counter btn-counter-plus" data-target="adults">+</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. DOPLŇKOVÉ SLUŽBY -->
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
                        <button type="button" class="btn-counter btn-counter-minus" data-target="halfBoardCount">-</button>
                        <span class="counter-value">${pricing.halfBoardCount}</span>
                        <button type="button" class="btn-counter btn-counter-plus" data-target="halfBoardCount">+</button>
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
                        <button type="button" class="btn-counter btn-counter-minus" data-target="ebikeCount">-</button>
                        <span class="counter-value">${pricing.ebikeCount}</span>
                        <button type="button" class="btn-counter btn-counter-plus" data-target="ebikeCount">+</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>

          </div>

          <!-- PRAVÝ SLOUPEC: Živý přehled ceny & Tlačítko k údajům hosta -->
          <div class="booking-right-col">
            <div class="summary-sticky-card">
              <h3 class="summary-title">Přehled ceny pobytu</h3>
              
              <div class="recap-clean-list">
                <div class="recap-clean-item">
                  <span class="recap-clean-label">Vybraný pokoj:</span>
                  <span class="recap-clean-val"><strong>${room ? room.name : 'Vyberte si pokoj ze seznamu'}</strong></span>
                </div>

                <div class="recap-clean-item">
                  <span class="recap-clean-label">Termín pobytu:</span>
                  <div class="recap-clean-val-group">
                    <span class="recap-clean-val"><strong>${formattedFrom} – ${formattedTo}</strong></span>
                    <span class="recap-sub-val">(${nights} ${nights === 1 ? 'noc' : (nights >= 2 && nights <= 4 ? 'noci' : 'nocí')}${pricing.nightBreakdownLabel ? ` • ${pricing.nightBreakdownLabel}` : ''})</span>
                  </div>
                </div>

                <div class="recap-clean-item">
                  <span class="recap-clean-label">Počet hostů:</span>
                  <span class="recap-clean-val"><strong>${this.state.adults} ${this.state.adults === 1 ? 'osoba' : (this.state.adults < 5 ? 'osoby' : 'osob')}</strong></span>
                </div>
              </div>

              ${pricing.discountAmount > 0 ? `
                <div class="summary-total-divider"></div>
                <div class="summary-rows">
                  <div class="summary-row" style="color: #2e7d32; font-weight: 700;">
                    <div class="row-info">
                      <span class="row-label">✓ ${pricing.discountLabel}</span>
                    </div>
                    <span class="row-price">-${pricing.formattedDiscountAmount}</span>
                  </div>
                </div>
              ` : ''}

              <!-- PROMO CODE INPUT BOX -->
              <div class="promo-code-box" style="margin-top: 16px; padding-top: 14px; border-top: 1px dashed #e0dfd5;">
                <label for="promo-code-input" style="font-size: 13.5px; font-weight: 700; color: #4a5a24; display: block; margin-bottom: 8px;">Máte slevový kód?</label>
                <div style="display: flex; align-items: stretch; gap: 8px; width: 100%;">
                  <input type="text" id="promo-code-input" placeholder="Např. HOTEL5" style="flex: 1; min-width: 0; height: 42px; padding: 0 12px; font-size: 14px; font-weight: 600; text-transform: uppercase; color: #1c1c19; background: #ffffff; border: 1px solid #c8c6b9; border-radius: 1px; box-sizing: border-box; outline: none;" value="${this.appliedDiscount ? this.appliedDiscount.code : (this.discountCodeInput || '')}" ${this.appliedDiscount ? 'disabled' : ''}>
                  <button type="button" class="btn-apply-promo" style="height: 42px; padding: 0 20px; font-size: 14px; font-weight: 700; color: #ffffff; background: ${this.appliedDiscount ? '#c62828' : '#4a5a24'}; border: none; border-radius: 1px; cursor: pointer; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s ease;">
                    ${this.appliedDiscount ? 'Odebrat' : 'Uplatnit'}
                  </button>
                </div>
                ${this.discountError ? `<div style="color: #c62828; font-size: 12.5px; font-weight: 600; margin-top: 8px; display: flex; align-items: center; gap: 4px;">⚠️ ${this.discountError}</div>` : ''}
                ${this.discountSuccessMsg ? `<div style="color: #2e7d32; font-size: 12.5px; font-weight: 700; margin-top: 8px; display: flex; align-items: center; gap: 4px;">✓ ${this.discountSuccessMsg}</div>` : ''}
              </div>

              ${(pricing.singleNightSurchargeTotal > 0 || pricing.hasHalfBoard || pricing.hasDog || pricing.hasEbike || pricing.cityTax > 0) ? `
                <div class="summary-total-divider"></div>
                <div class="summary-rows">
                  ${pricing.singleNightSurchargeTotal > 0 ? `
                    <div class="summary-row surcharge">
                      <div class="row-info">
                        <span class="row-label">
                          ${pricing.surchargeReason === 'single_occupancy'
                            ? 'Příplatek za neobsazené lůžko'
                            : (pricing.surchargeReason === 'both' ? 'Příplatek za 1 noc & 1 osobu' : 'Příplatek za 1 noc')}
                        </span>
                        <span class="row-details">(+${pricing.singleNightRatePerPerson} Kč / ${pricing.surchargeReason === 'single_occupancy' ? 'noc' : 'osoba'})</span>
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
                </div>
              ` : ''}

              <div class="summary-total-divider"></div>

              <div class="summary-clean-deposit">
                <div class="deposit-clean-row zero-deposit">
                  <div class="deposit-clean-info">
                    <span class="deposit-clean-title">Dnes při odeslání neplatíte nic</span>
                    <small class="deposit-clean-sub">(Podání žádosti o rezervaci je zdarma)</small>
                  </div>
                  <span class="deposit-clean-amount badge-zero-pay">0 Kč</span>
                </div>

                <div class="deposit-clean-row main-deposit">
                  <div class="deposit-clean-info">
                    <span class="deposit-clean-title">1. Záloha po schválení recepcí</span>
                    <small class="deposit-clean-sub">(30 % záloha z celkové ceny pobytu)</small>
                  </div>
                  <span class="deposit-clean-amount">${formatCzechPrice(pricing.depositPriceTotal)}</span>
                </div>

                <div class="deposit-clean-row remaining-deposit">
                  <div class="deposit-clean-info">
                    <span class="deposit-clean-title">2. Doplatek při příjezdu</span>
                    <small class="deposit-clean-sub">(70 % doplatek na místě na recepci)</small>
                  </div>
                  <span class="deposit-clean-amount">${formatCzechPrice(pricing.remainingPriceTotal)}</span>
                </div>
              </div>

              <div class="summary-total-row">
                <span>Celková cena pobytu s DPH:</span>
                <span class="total-price-amount">${formatCzechPrice(pricing.totalPrice)}</span>
              </div>

              <div class="summary-perks">
                <span>✓ Snídaně formou bufetu v ceně</span>
                <span>✓ Parkování u hotelu ZDARMA</span>
                <span>✓ Wi-Fi připojené zdarma</span>
              </div>

              <button type="button" class="btn btn-booking-submit btn-next-step-1">
                Pokračovat k údajům hosta →
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStep2Form(room, pricing, nights) {
    if (!room) {
      const firstAvail = this.roomsList.find(r => !r.isDisabled);
      if (firstAvail) this.state.selectedRoomId = firstAvail.id;
    }
    const currentRoom = this.getSelectedRoom() || room || this.roomsList[0];
    const currentPricing = this.getPricingBreakdown();

    this.syncGuestsArray();
    const formattedFrom = formatCzechDateStr(this.state.dateFrom);
    const formattedTo = formatCzechDateStr(this.state.dateTo);
    const totalGuests = this.state.guests.length;

    const renderHost1Fields = (g) => `
      <div class="form-field ${this.state.fieldErrors['guest-0-name'] ? 'has-error' : ''}">
        <label for="guest-0-name" class="form-label">Jméno a Příjmení <span class="required">*</span></label>
        <input type="text" id="guest-0-name" class="form-input guest-input" data-idx="0" data-field="name" placeholder="např. Jan Novák" value="${g?.name || this.state.guestName}">
        ${this.state.fieldErrors['guest-0-name'] ? `
          <div class="field-error-popover">
            <span class="popover-arrow"></span>
            <span class="popover-icon">⚠️</span>
            <span>${this.state.fieldErrors['guest-0-name']}</span>
          </div>
        ` : ''}
      </div>

      <div class="form-grid-2col">
        <div class="form-field ${this.state.fieldErrors['guest-0-email'] ? 'has-error' : ''}">
          <label for="guest-0-email" class="form-label">E-mailová adresa <span class="required">*</span></label>
          <input type="email" id="guest-0-email" class="form-input guest-input" data-idx="0" data-field="email" placeholder="např. jan.novak@seznam.cz" value="${g?.email || this.state.guestEmail}">
          <p class="field-help-note" style="font-size: 12.5px; color: #666666; margin: 6px 0 0 0; line-height: 1.4;">
            Na tento e-mail vám odešleme potvrzení rezervace, ubytovací pokyny a platební údaje.
          </p>
          ${this.state.fieldErrors['guest-0-email'] ? `
            <div class="field-error-popover">
              <span class="popover-arrow"></span>
              <span class="popover-icon">⚠️</span>
              <span>${this.state.fieldErrors['guest-0-email']}</span>
            </div>
          ` : ''}
        </div>

        <div class="form-field ${this.state.fieldErrors['guest-0-phone'] ? 'has-error' : ''}">
          <label for="guest-0-phone" class="form-label">Telefonní číslo <span class="required">*</span></label>
          <input type="tel" id="guest-0-phone" class="form-input guest-input" data-idx="0" data-field="phone" placeholder="např. +420 777 123 456" value="${g?.phone || this.state.guestPhone}">
          ${this.state.fieldErrors['guest-0-phone'] ? `
            <div class="field-error-popover">
              <span class="popover-arrow"></span>
              <span class="popover-icon">⚠️</span>
              <span>${this.state.fieldErrors['guest-0-phone']}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="form-optional-section">
        <div class="optional-section-header">
          <h4 class="optional-section-title">Údaje pro Ubytovací knihu & Rychlý check-in <span class="optional-tag">(Volitelné)</span></h4>
        </div>

        <div class="form-grid-2col">
          <div class="form-field ${this.state.fieldErrors['guest-0-birthdate'] ? 'has-error' : ''}">
            <label for="guest-0-birthdate" class="form-label">Datum narození:</label>
            <input type="text" id="guest-0-birthdate" class="form-input guest-input" data-idx="0" data-field="birthDate" placeholder="např. 15. 05. 1988 (DD.MM.YYYY)" value="${g?.birthDate || ''}">
            <small class="form-hint" style="font-size: 12px; color: #777770; margin-top: 4px; display: block;">Zadejte např. 15. 05. 1988 nebo RRRR-MM-DD</small>
          </div>
          <div class="form-field ${this.state.fieldErrors['guest-0-idnumber'] ? 'has-error' : ''}">
            <label for="guest-0-idnumber" class="form-label">Číslo OP / Pasu:</label>
            <input type="text" id="guest-0-idnumber" class="form-input guest-input" data-idx="0" data-field="idNumber" placeholder="např. 209847162" value="${g?.idNumber || ''}">
            ${this.state.fieldErrors['guest-0-idnumber'] ? `
              <div class="field-error-popover">
                <span class="popover-arrow"></span>
                <span class="popover-icon">⚠️</span>
                <span>${this.state.fieldErrors['guest-0-idnumber']}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="form-grid-2col" style="margin-top: 10px;">
          <div class="form-field">
            <label for="guest-0-street" class="form-label">Ulice a číslo popisné:</label>
            <input type="text" id="guest-0-street" class="form-input guest-input" data-idx="0" data-field="street" placeholder="např. Nádražní 14" value="${g?.street || this.state.guestStreet}">
          </div>
          <div class="form-field">
            <label for="guest-0-city" class="form-label">Město / Obec:</label>
            <input type="text" id="guest-0-city" class="form-input guest-input" data-idx="0" data-field="city" placeholder="např. Liberec" value="${g?.city || this.state.guestCity}">
          </div>
        </div>

        <div class="form-grid-2col" style="margin-top: 10px;">
          <div class="form-field">
            <label for="guest-0-zip" class="form-label">PSČ:</label>
            <input type="text" id="guest-0-zip" class="form-input guest-input" data-idx="0" data-field="zip" placeholder="např. 460 01" value="${g?.zip || this.state.guestZip}">
          </div>
          <div class="form-field">
            <label for="guest-0-country" class="form-label">Stát:</label>
            <input type="text" id="guest-0-country" class="form-input guest-input" data-idx="0" data-field="country" placeholder="Česká republika" value="${g?.country || this.state.guestCountry}">
          </div>
        </div>

        <p class="quick-checkin-notice" style="font-size: 13.5px; color: #55554E; margin: 16px 0 0 0; line-height: 1.5;">
          💡 <strong>Proč vyplnit tyto údaje online?</strong> Vyplněním ušetříte čas při příjezdu na recepci — nemusíte po cestě nic zdlouhavě vypisovat a klíče od pokoje vám předáme ihned.
        </p>
      </div>
    `;

    return `
      <div class="booking-step-content">
        <form id="booking-form-step2" class="booking-form" novalidate>
          <div class="booking-grid">
            <div class="booking-left-col">
              <div class="booking-card card-step-2">
                <div class="booking-back-inside">
                  <button type="button" class="btn-back-link btn-back-step-1">
                    ← Zpět k výběru pokoje a termínu
                  </button>
                </div>

                <div class="step-card-header" style="margin-bottom: 24px;">
                  <h3 class="card-title" style="margin:0 0 6px 0;">${totalGuests === 1 ? 'Kontaktní údaje rezervujícího' : 'Údaje ubytovaných hostů'}</h3>
                  <p style="margin:0; font-size:14px; color:#666666;">
                    ${totalGuests === 1
                      ? 'Vyplňte prosím vaše kontaktní informace pro potvrzení rezervace.'
                      : `Vyplňte prosím informace o všech ubytovaných hostech (${totalGuests} ${totalGuests >= 2 && totalGuests <= 4 ? 'osoby' : 'osob'}).`}
                  </p>
                </div>

                ${this.state.errorMessage ? `
                  <div class="booking-alert-error" style="margin-bottom: 22px;">
                    <span class="alert-icon">⚠️</span>
                    <span>${this.state.errorMessage}</span>
                  </div>
                ` : ''}

                <!-- Honeypot anti-spam field -->
                <div style="display:none;" aria-hidden="true">
                  <input type="text" id="hp-field" tabindex="-1" autocomplete="off" value="${this.state.honeypot}">
                </div>

                ${totalGuests === 1 ? `
                  <div class="single-guest-form">
                    ${renderHost1Fields(this.state.guests[0])}
                  </div>
                ` : `
                  <div class="guests-accordion-list">
                    ${this.state.guests.map((g, idx) => {
                      const isMain = idx === 0;
                      const isOpen = idx === 0;
                      const hasError = isMain
                        ? Boolean(this.state.fieldErrors['guest-0-name'] || this.state.fieldErrors['guest-0-email'] || this.state.fieldErrors['guest-0-phone'])
                        : Boolean(this.state.fieldErrors[`guest-${idx}-name`]);
                      const isFilled = isMain
                        ? Boolean((g.name || this.state.guestName) && (g.email || this.state.guestEmail) && (g.phone || this.state.guestPhone))
                        : Boolean(g.name && g.name.trim());

                      return `
                        <div class="guest-accordion-item ${isOpen ? 'is-open' : ''} ${hasError ? 'has-error' : ''}" id="guest-accordion-${idx}">
                          <button type="button" class="guest-accordion-header" data-idx="${idx}">
                            <div class="guest-header-left">
                              <span class="guest-num-badge">${idx + 1}</span>
                              <div class="guest-header-titles">
                                <span class="guest-header-role">${isMain ? '1. Hlavní host (Rezervující)' : `${idx + 1}. Ubytovaný host`}</span>
                                <span class="guest-header-name">${g.name ? g.name : (isMain ? 'Hlavní kontakt pro rozpis platby' : 'Klikněte pro rozbalení a vyplnění')}</span>
                              </div>
                            </div>

                            <div class="guest-header-right">
                              ${isFilled ? `
                                <span class="guest-status-pill status-ok">✓ Vyplněno</span>
                              ` : `
                                <span class="guest-status-pill status-pending">Vyžadováno *</span>
                              `}
                              <span class="guest-chevron">${isOpen ? '▲' : '▼'}</span>
                            </div>
                          </button>

                          <div class="guest-accordion-body" style="${isOpen ? 'display: block;' : 'display: none;'}">
                            <div class="guest-body-inner">
                              ${isMain ? renderHost1Fields(g) : `
                                <div class="form-field ${this.state.fieldErrors[`guest-${idx}-name`] ? 'has-error' : ''}">
                                  <label for="guest-${idx}-name" class="form-label">Jméno a Příjmení <span class="required">*</span></label>
                                  <input type="text" id="guest-${idx}-name" class="form-input guest-input" data-idx="${idx}" data-field="name" placeholder="např. Petra Nováková" value="${g.name || ''}">
                                  ${this.state.fieldErrors[`guest-${idx}-name`] ? `
                                    <div class="field-error-popover">
                                      <span class="popover-arrow"></span>
                                      <span class="popover-icon">⚠️</span>
                                      <span>${this.state.fieldErrors[`guest-${idx}-name`]}</span>
                                    </div>
                                  ` : ''}
                                </div>

                                <div class="form-optional-section">
                                  <div class="optional-section-header">
                                    <h4 class="optional-section-title">Údaje pro Ubytovací knihu & Rychlý check-in <span class="optional-tag">(Volitelné)</span></h4>
                                  </div>
                                  <div class="form-grid-2col">
                                    <div class="form-field ${this.state.fieldErrors[`guest-${idx}-birthdate`] ? 'has-error' : ''}">
                                      <label for="guest-${idx}-birthdate" class="form-label">Datum narození:</label>
                                      <input type="text" id="guest-${idx}-birthdate" class="form-input guest-input" data-idx="${idx}" data-field="birthDate" placeholder="např. 20. 08. 1995 (DD.MM.YYYY)" value="${g.birthDate || ''}">
                                      <small class="form-hint" style="font-size: 12px; color: #777770; margin-top: 4px; display: block;">Zadejte např. 20. 08. 1995 nebo RRRR-MM-DD</small>
                                    </div>
                                    <div class="form-field ${this.state.fieldErrors[`guest-${idx}-idnumber`] ? 'has-error' : ''}">
                                      <label for="guest-${idx}-idnumber" class="form-label">Číslo OP / Pasu:</label>
                                      <input type="text" id="guest-${idx}-idnumber" class="form-input guest-input" data-idx="${idx}" data-field="idNumber" placeholder="např. 102938475" value="${g.idNumber || ''}">
                                      ${this.state.fieldErrors[`guest-${idx}-idnumber`] ? `
                                        <div class="field-error-popover">
                                          <span class="popover-arrow"></span>
                                          <span class="popover-icon">⚠️</span>
                                          <span>${this.state.fieldErrors[`guest-${idx}-idnumber`]}</span>
                                        </div>
                                      ` : ''}
                                    </div>
                                  </div>
                                  
                                  <div class="form-grid-2col" style="margin-top: 10px;">
                                    <div class="form-field">
                                      <label for="guest-${idx}-street" class="form-label">Ulice a číslo popisné:</label>
                                      <input type="text" id="guest-${idx}-street" class="form-input guest-input" data-idx="${idx}" data-field="street" placeholder="např. Nádražní 14" value="${g.street || ''}">
                                    </div>
                                    <div class="form-field">
                                      <label for="guest-${idx}-city" class="form-label">Město / Obec:</label>
                                      <input type="text" id="guest-${idx}-city" class="form-input guest-input" data-idx="${idx}" data-field="city" placeholder="např. Liberec" value="${g.city || ''}">
                                    </div>
                                  </div>

                                  <div class="form-grid-2col" style="margin-top: 10px;">
                                    <div class="form-field">
                                      <label for="guest-${idx}-zip" class="form-label">PSČ:</label>
                                      <input type="text" id="guest-${idx}-zip" class="form-input guest-input" data-idx="${idx}" data-field="zip" placeholder="např. 460 01" value="${g.zip || ''}">
                                    </div>
                                    <div class="form-field">
                                      <label for="guest-${idx}-country" class="form-label">Stát:</label>
                                      <input type="text" id="guest-${idx}-country" class="form-input guest-input" data-idx="${idx}" data-field="country" placeholder="Česká republika" value="${g.country || 'Česká republika'}">
                                    </div>
                                  </div>

                                  <p class="quick-checkin-notice" style="font-size: 13.5px; color: #55554E; margin: 16px 0 0 0; line-height: 1.5;">
                                    💡 <strong>Proč vyplnit tyto údaje online?</strong> Vyplněním ušetříte čas při příjezdu na recepci — nemusíte po cestě nic zdlouhavě vypisovat a klíče od pokoje vám předáme ihned.
                                  </p>
                                </div>
                              `}
                            </div>
                          </div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                `}

                <div class="form-section-divider" style="margin: 24px 0;"></div>

                <div class="form-field">
                  <label for="guest-note" class="form-label">Poznámka / Speciální přání pro celý pobyt <span class="optional-tag">(Volitelné / Nepovinné)</span></label>
                  <textarea id="guest-note" class="form-textarea" rows="3" placeholder="Předpokládaný čas příjezdu, dieta či jiná přání...">${this.state.guestNote}</textarea>
                </div>
              </div>
            </div>

            <div class="booking-right-col">
              <div class="summary-sticky-card">
                <h3 class="summary-title">Rekapitulace rezervace</h3>

                <div class="recap-clean-list">
                  <div class="recap-clean-item">
                    <span class="recap-clean-label">Vybraný pokoj:</span>
                    <span class="recap-clean-val"><strong>${currentRoom.name}</strong></span>
                  </div>

                  <div class="recap-clean-item">
                    <span class="recap-clean-label">Termín pobytu:</span>
                    <div class="recap-clean-val-group">
                      <span class="recap-clean-val"><strong>${formattedFrom} – ${formattedTo}</strong></span>
                      <span class="recap-sub-val">(${nights} ${nights === 1 ? 'noc' : (nights >= 2 && nights <= 4 ? 'noci' : 'nocí')}${currentPricing.nightBreakdownLabel ? ` • ${currentPricing.nightBreakdownLabel}` : ''})</span>
                    </div>
                  </div>

                  <div class="recap-clean-item">
                    <span class="recap-clean-label">Počet hostů:</span>
                    <span class="recap-clean-val"><strong>${this.state.adults} ${this.state.adults === 1 ? 'osoba' : (this.state.adults < 5 ? 'osoby' : 'osob')}</strong></span>
                  </div>
                </div>

                ${(currentPricing.singleNightSurchargeTotal > 0 || currentPricing.hasHalfBoard || currentPricing.hasDog || currentPricing.hasEbike || currentPricing.discountAmount > 0 || currentPricing.cityTax > 0) ? `
                  <div class="summary-total-divider"></div>
                  <div class="summary-rows">
                    ${currentPricing.discountAmount > 0 ? `
                      <div class="summary-row discount-row" style="color: #2e7d32; font-weight: 700;">
                        <div class="row-info">
                          <span class="row-label">✓ ${currentPricing.discountLabel}</span>
                        </div>
                        <span class="row-price">-${currentPricing.formattedDiscountAmount}</span>
                      </div>
                    ` : ''}

                    ${currentPricing.singleNightSurchargeTotal > 0 ? `
                      <div class="summary-row surcharge">
                        <div class="row-info">
                          <span class="row-label">
                            ${currentPricing.surchargeReason === 'single_occupancy'
                              ? 'Příplatek za neobsazené lůžko'
                              : (currentPricing.surchargeReason === 'both' ? 'Příplatek za 1 noc & 1 osobu' : 'Příplatek za 1 noc')}
                          </span>
                          <span class="row-details">(+${currentPricing.singleNightRatePerPerson} Kč / ${currentPricing.surchargeReason === 'single_occupancy' ? 'noc' : 'osoba'})</span>
                        </div>
                        <span class="row-price">+${currentPricing.singleNightSurchargeTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasHalfBoard ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Dokoupená polopenze</span>
                          <span class="row-details">(+195 Kč/os/noc • ${currentPricing.halfBoardCount}x os, ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.halfBoardPriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasDog ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Pobyt s pejskem</span>
                          <span class="row-details">(+150 Kč/noc za pokoj • ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.dogPriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasEbike ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Nabíjení elektrokola</span>
                          <span class="row-details">(+15 Kč/den • ${currentPricing.ebikeCount}x ks, ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.ebikePriceTotal} Kč</span>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <div class="summary-total-divider"></div>

                <div class="summary-clean-deposit">
                  <div class="deposit-clean-row zero-deposit">
                    <div class="deposit-clean-info">
                      <span class="deposit-clean-title">Dnes při odeslání neplatíte nic</span>
                      <small class="deposit-clean-sub">(Podání žádosti o rezervaci je zdarma)</small>
                    </div>
                    <span class="deposit-clean-amount badge-zero-pay">0 Kč</span>
                  </div>

                  <div class="deposit-clean-row main-deposit">
                    <div class="deposit-clean-info">
                      <span class="deposit-clean-title">1. Záloha po schválení recepcí</span>
                      <small class="deposit-clean-sub">(30 % záloha z celkové ceny pobytu)</small>
                    </div>
                    <span class="deposit-clean-amount">${formatCzechPrice(currentPricing.depositPriceTotal)}</span>
                  </div>

                  <div class="deposit-clean-row remaining-deposit">
                    <div class="deposit-clean-info">
                      <span class="deposit-clean-title">2. Doplatek při příjezdu</span>
                      <small class="deposit-clean-sub">(70 % doplatek na místě na recepci)</small>
                    </div>
                    <span class="deposit-clean-amount">${formatCzechPrice(currentPricing.remainingPriceTotal)}</span>
                  </div>
                </div>

                <div class="summary-total-row">
                  <span>Celková cena pobytu s DPH:</span>
                  <span class="total-price-amount">${formatCzechPrice(currentPricing.totalPrice)}</span>
                </div>

                <div class="summary-perks">
                  <span>✓ Snídaně v ceně</span>
                  <span>✓ Parkování ZDARMA</span>
                  <span>✓ Wi-Fi ZDARMA</span>
                </div>

                <button type="submit" class="btn btn-booking-submit btn-confirm-booking ${this.state.isSubmitting ? 'is-loading' : ''}" ${this.state.isSubmitting ? 'disabled' : ''}>
                  ${this.state.isSubmitting ? `
                    <span class="btn-spinner" aria-hidden="true"></span>
                    <span>Odesílám žádost...</span>
                  ` : 'Odeslat žádost o rezervaci →'}
                </button>

                <p class="terms-inline-notice" style="margin-top: 14px; font-size: 13px; color: #666666; text-align: center; line-height: 1.5;">
                  Odesláním žádosti o rezervaci souhlasíte s <button type="button" class="terms-modal-trigger-link" id="open-terms-modal-step2">obchodními a storno podmínkami</button> Hotelu u Můstku a se zpracováním osobních údajů (GDPR).
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    `;
  }

  renderStep3Confirmation(room, pricing) {
    const res = this.state.confirmedReservation || {};
    const formattedFrom = formatCzechDateStr(this.state.dateFrom);
    const formattedTo = formatCzechDateStr(this.state.dateTo);
    const nights = this.calculateNights();

    return `
      <div class="booking-step-content success-step" style="width: 100%; max-width: 1440px; margin: 0 auto; box-sizing: border-box;">
        <div class="standalone-confirmation-wrap" style="display: flex; flex-direction: column; gap: clamp(20px, 2.5vw, 32px); width: 100%;">

          <div class="confirmation-hero-card" style="background: #FFFFFF; border: 1px solid #E7E5DC; border-radius: 12px; padding: clamp(28px, 5vw, 48px) clamp(20px, 4vw, 48px); text-align: center;">
            <div class="confirmation-icon-circle" style="width: 80px; height: 80px; border-radius: 50%; background: #E1EDD6; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <svg width="38" height="38" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M9 21.5L16.5 29L31 12.5" stroke="#4A5A24" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h1 style="margin: 0 0 14px; font-size: clamp(24px, 3.8vw, 36px); line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; color: #1C1C19;">
              Žádost o rezervaci byla úspěšně odeslána!
            </h1>
            <p style="margin: 0 auto 24px; max-width: 48ch; font-size: clamp(15.5px, 1.5vw, 18px); color: #55554E; line-height: 1.5;">
              Potvrzení o přijetí žádosti jsme odeslali na váš e-mail <strong style="color: #1C1C19; font-weight: 700; white-space: nowrap;">${res.guest_email || this.state.guestEmail}</strong>.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 10px; background: #EDF2E4; color: #4A5A24; border-radius: 8px; padding: 10px 20px; font-size: clamp(14.5px, 1.3vw, 17px); font-weight: 700;">
              <span style="font-weight: 500; color: #5D6B34;">Kód žádosti:</span> ${res.code || 'HM-2026-0000'}
            </div>
          </div>

          <div class="confirmation-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(340px, 100%), 1fr)); gap: clamp(20px, 2.5vw, 32px); align-items: start;">

            <section style="background: #FFFFFF; border: 1px solid #E7E5DC; border-radius: 20px; padding: clamp(24px, 3.2vw, 40px);">
              <h2 style="margin: 0 0 14px; font-size: clamp(21px, 2.2vw, 25px); font-weight: 700; letter-spacing: -0.01em; color: #1C1C19;">Co bude následovat nyní?</h2>
              <p style="margin: 0 0 28px; color: #55554E; font-size: 15.5px; line-height: 1.6;">
                Abychom předešli překrývání termínů, vaši rezervaci nyní fyzicky ověřuje recepce hotelu.
              </p>

              <ol style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px;">
                <li style="display: grid; grid-template-columns: 44px 1fr; gap: 18px; padding: 20px 0; border-top: 1px solid #EFEEE7;">
                  <span style="width: 44px; height: 44px; border-radius: 50%; background: #697947; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; flex-shrink: 0;">1</span>
                  <div>
                    <h3 style="margin: 4px 0 6px; font-size: clamp(17px, 1.7vw, 20px); font-weight: 700; color: #1C1C19;">Ověření kapacity recepcí</h3>
                    <p style="margin: 0; color: #55554E; font-size: 14.5px; line-height: 1.5;">
                      Recepce zkontroluje dostupnost pokoje <strong style="color: #1C1C19;">${room ? room.name : ''}</strong>. Dnes při odeslání <strong style="color: #1C1C19;">neplatíte nic (0 Kč)</strong>.
                    </p>
                  </div>
                </li>

                <li style="display: grid; grid-template-columns: 44px 1fr; gap: 18px; padding: 20px 0; border-top: 1px solid #EFEEE7;">
                  <span style="width: 44px; height: 44px; border-radius: 50%; background: #EDF2E4; color: #697947; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; flex-shrink: 0;">2</span>
                  <div>
                    <h3 style="margin: 4px 0 6px; font-size: clamp(17px, 1.7vw, 20px); font-weight: 700; color: #1C1C19;">Výzva k úhradě 30% zálohy</h3>
                    <p style="margin: 0; color: #55554E; font-size: 14.5px; line-height: 1.5;">
                      Jakmile termín schválíme, zašleme vám e-mail s pokyny k úhradě 30% zálohy (<strong style="color: #1C1C19;">${formatCzechPrice(pricing.depositPriceTotal)}</strong>) s QR kódem.
                    </p>
                  </div>
                </li>

                <li style="display: grid; grid-template-columns: 44px 1fr; gap: 18px; padding: 20px 0; border-top: 1px solid #EFEEE7;">
                  <span style="width: 44px; height: 44px; border-radius: 50%; background: #EDF2E4; color: #697947; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; flex-shrink: 0;">3</span>
                  <div>
                    <h3 style="margin: 4px 0 6px; font-size: clamp(17px, 1.7vw, 20px); font-weight: 700; color: #1C1C19;">Závazné potvrzení pobytu</h3>
                    <p style="margin: 0; color: #55554E; font-size: 14.5px; line-height: 1.5;">
                      Po přijetí zálohy vám zašleme finální potvrzení. Doplatek 70 % (<strong style="color: #1C1C19;">${formatCzechPrice(pricing.remainingPriceTotal)}</strong>) zaplatíte na místě při příjezdu.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <div style="display: flex; flex-direction: column; gap: clamp(20px, 2.5vw, 32px);">
              <section style="background: #FFFFFF; border: 1px solid #E7E5DC; border-radius: 20px; padding: clamp(24px, 3.2vw, 40px);">
                <h2 style="margin: 0 0 24px; font-size: clamp(21px, 2.2vw, 25px); font-weight: 700; letter-spacing: -0.01em; color: #1C1C19;">Rekapitulace rezervace</h2>
                <dl style="margin: 0; display: flex; flex-direction: column; gap: 0;">
                  <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px; padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <dt style="color: #55554E; font-size: 15px;">Pokoj</dt>
                    <dd style="margin: 0; font-weight: 700; text-align: right; color: #1C1C19; font-size: 15px;">${room ? room.name : ''}</dd>
                  </div>

                  <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px; padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <dt style="color: #55554E; font-size: 15px;">Termín</dt>
                    <dd style="margin: 0; font-weight: 700; text-align: right; color: #1C1C19; font-size: 15px;">${formattedFrom} – ${formattedTo} (${nights} ${nights === 1 ? 'noc' : (nights >= 2 && nights <= 4 ? 'noci' : 'nocí')})</dd>
                  </div>

                  <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px; padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <dt style="color: #55554E; font-size: 15px;">Počet osob</dt>
                    <dd style="margin: 0; font-weight: 700; text-align: right; color: #1C1C19; font-size: 15px;">${this.state.adults} ${this.state.adults === 1 ? 'osoba' : (this.state.adults < 5 ? 'osoby' : 'osob')}</dd>
                  </div>

                  <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px; padding: 18px 0 14px; margin-top: 10px; border-top: 2px solid #E7E5DC;">
                    <dt style="color: #55554E; font-size: 15px;">Celková cena</dt>
                    <dd style="margin: 0; font-weight: 800; font-size: clamp(19px, 1.8vw, 22px); text-align: right; color: #1C1C19;">${formatCzechPrice(pricing.totalPrice)} s DPH</dd>
                  </div>
                </dl>

                <div style="margin-top: 16px; background: #EDF2E4; border-radius: 14px; padding: 20px 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 20px;">
                  <span style="color: #4A5A24; font-weight: 600; font-size: 15px;">Záloha k platbě po schválení</span>
                  <strong style="color: #4A5A24; font-size: clamp(20px, 2vw, 24px); font-weight: 800;">${formatCzechPrice(pricing.depositPriceTotal)}</strong>
                </div>
              </section>

              <section style="background: #FFFFFF; border: 1px solid #E7E5DC; border-radius: 20px; padding: clamp(24px, 3.2vw, 40px);">
                <h2 style="margin: 0 0 24px; font-size: clamp(21px, 2.2vw, 25px); font-weight: 700; letter-spacing: -0.01em; color: #1C1C19;">Kontaktní údaje recepce hotelu</h2>
                <div style="display: flex; flex-direction: column; gap: 0;">
                  <div style="padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <div style="color: #55554E; font-size: 14.5px; margin-bottom: 2px;">Adresa</div>
                    <div style="font-weight: 600; color: #1C1C19; font-size: 15px;">Údolní 368, 468 61 Desná v Jizerských horách 1</div>
                  </div>

                  <div style="padding: 14px 0; border-top: 1px solid #EFEEE7; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 14px 24px;">
                    <div>
                      <div style="color: #55554E; font-size: 14.5px; margin-bottom: 2px;">Check-in (Příjezd)</div>
                      <div style="font-weight: 600; color: #1C1C19; font-size: 15px;">od 15:00 hod.</div>
                    </div>
                    <div>
                      <div style="color: #55554E; font-size: 14.5px; margin-bottom: 2px;">Check-out (Odjezd)</div>
                      <div style="font-weight: 600; color: #1C1C19; font-size: 15px;">do 10:00 hod.</div>
                    </div>
                  </div>

                  <div style="padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <div style="color: #55554E; font-size: 14.5px; margin-bottom: 2px;">Telefon na recepci</div>
                    <a href="tel:+420777666273" style="font-size: clamp(18px, 1.7vw, 21px); font-weight: 700; color: #697947; text-decoration: none;">+420 777 666 273</a>
                  </div>

                  <div style="padding: 14px 0; border-top: 1px solid #EFEEE7;">
                    <div style="color: #55554E; font-size: 14.5px; margin-bottom: 2px;">E-mail</div>
                    <a href="mailto:hotel@umustku.cz" style="font-size: clamp(17px, 1.6vw, 19px); font-weight: 700; color: #697947; text-decoration: none;">hotel@umustku.cz</a>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div class="confirmation-actions-row">
            <button type="button" class="btn btn-specs-secondary btn-new-booking">← Vytvořit další žádost</button>
            <button type="button" class="btn btn-booking-submit btn-go-home">Zpět na hlavní stránku</button>
          </div>

        </div>
      </div>
    `;
  }

  attachEventListeners() {
    this.container.querySelectorAll('.btn-step-nav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetStep = parseInt(btn.dataset.targetStep, 10);
        if (targetStep && targetStep < this.currentStep) {
          this.setStep(targetStep);
        }
      });
    });

    if (this.currentStep === 1) {
      const dropdownWrap = document.getElementById('custom-room-dropdown');
      const dropdownTrigger = document.getElementById('custom-dropdown-trigger');
      const optionsPanel = document.getElementById('custom-dropdown-options');

      if (dropdownTrigger && optionsPanel) {
        dropdownTrigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.state.isCustomDropdownOpen = !this.state.isCustomDropdownOpen;
          if (this.state.isCustomDropdownOpen) {
            dropdownWrap.classList.add('is-open');
            optionsPanel.classList.add('is-visible');
            dropdownTrigger.setAttribute('aria-expanded', 'true');
          } else {
            dropdownWrap.classList.remove('is-open');
            optionsPanel.classList.remove('is-visible');
            dropdownTrigger.setAttribute('aria-expanded', 'false');
          }
        });

        optionsPanel.querySelectorAll('.custom-dropdown-option').forEach(optionEl => {
          optionEl.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (optionEl.classList.contains('is-disabled')) return;
            const roomId = optionEl.dataset.roomId;
            if (roomId) {
              this.state.selectedRoomId = roomId;
              this.state.isCustomDropdownOpen = false;
              this.render();
            }
          });
        });

        // Click outside handler
        const clickOutsideHandler = (e) => {
          if (this.state.isCustomDropdownOpen && dropdownWrap && !dropdownWrap.contains(e.target)) {
            this.state.isCustomDropdownOpen = false;
            dropdownWrap.classList.remove('is-open');
            optionsPanel.classList.remove('is-visible');
            dropdownTrigger.setAttribute('aria-expanded', 'false');
          }
        };

        document.removeEventListener('click', this._boundClickOutside);
        this._boundClickOutside = clickOutsideHandler;
        document.addEventListener('click', this._boundClickOutside);
      }

      const openCalModal = (field) => {
        this.state.tempDateFrom = this.state.dateFrom;
        this.state.tempDateTo = this.state.dateTo;
        this.state.selectingStep = 1;
        this.state.showCalendarModal = true;
        const [y, m] = (this.state.dateFrom || getTodayDateString()).split('-').map(Number);
        this.state.calYearMonth = { year: y, month: m };
        this.render();
      };

      const btnDateFrom = document.getElementById('date-from-btn');
      const btnDateTo = document.getElementById('date-to-btn');
      if (btnDateFrom) {
        btnDateFrom.addEventListener('click', (e) => {
          e.preventDefault();
          openCalModal('dateFrom');
        });
      }
      if (btnDateTo) {
        btnDateTo.addEventListener('click', (e) => {
          e.preventDefault();
          openCalModal('dateTo');
        });
      }

      const btnOpenTerms = document.getElementById('btn-open-terms-modal');
      if (btnOpenTerms) {
        btnOpenTerms.addEventListener('click', (e) => {
          e.preventDefault();
          const modal = document.getElementById('terms-modal-overlay');
          if (modal) modal.classList.add('is-open');
        });
      }

      const btnViewRoom = this.container.querySelector('#btn-view-room-details');
      if (btnViewRoom) {
        btnViewRoom.addEventListener('click', (e) => {
          e.preventDefault();
          const room = this.getSelectedRoom();
          if (room) {
            const targetHash = room.floor === 'prizemi' ? '#pokoje-prizemi' : '#pokoje-vyhled';
            window.pendingAutoOpenRoom = room.id;
            window.location.hash = targetHash;
          }
        });
      }

      this.container.querySelectorAll('.btn-counter').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.dataset.target;
          const isPlus = btn.classList.contains('btn-counter-plus');
          if (target === 'adults') {
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

      const btnApplyPromo = this.container.querySelector('.btn-apply-promo');
      const promoInput = this.container.querySelector('#promo-code-input');

      if (promoInput) {
        promoInput.addEventListener('input', (e) => {
          this.discountCodeInput = e.target.value;
        });
        promoInput.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.applyDiscountCode(promoInput.value);
          }
        });
      }

      if (btnApplyPromo) {
        btnApplyPromo.addEventListener('click', () => {
          if (this.appliedDiscount) {
            this.appliedDiscount = null;
            this.discountCodeInput = '';
            this.discountSuccessMsg = '';
            this.discountError = '';
            this.render();
          } else {
            const val = promoInput ? promoInput.value : this.discountCodeInput;
            this.applyDiscountCode(val);
          }
        });
      }

      const btnNext = this.container.querySelector('.btn-next-step-1');
      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (!this.state.selectedRoomId) {
            this.state.errorMessage = 'Prosíme, vyberte si nejprve pokoj v rozevírací nabídce v bodu 2.';
            this.render();
            this.scrollToErrorMessage();
            return;
          }
          const start = new Date(this.state.dateFrom);
          const end = new Date(this.state.dateTo);
          if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            this.state.errorMessage = 'Prosíme, vyberte platný termín pobytu (Datum odjezdu musí být po datu příjezdu).';
            this.render();
            this.scrollToErrorMessage();
            return;
          }

          const overlap = this.checkReservationOverlap(this.state.selectedRoomId, this.state.dateFrom, this.state.dateTo);
          if (overlap) {
            this.state.errorMessage = 'Vybraný pokoj je ve vašem termínu již zarezervovaný. Prosíme zvolte jiný pokoj nebo upravte termín.';
            this.render();
            this.scrollToErrorMessage();
            return;
          }

          this.setStep(2);
        });
      }
    } else if (this.currentStep === 2) {
      const btnBackStep1 = this.container.querySelector('.btn-back-step-1');
      if (btnBackStep1) {
        btnBackStep1.addEventListener('click', (e) => {
          e.preventDefault();
          this.setStep(1);
        });
      }

      const form = document.getElementById('booking-form-step2');
      if (form) {
        form.addEventListener('submit', (e) => this.handleFinalBookingSubmit(e));
      }

      const btnOpenTerms = document.getElementById('open-terms-modal-step2');
      if (btnOpenTerms) {
        btnOpenTerms.addEventListener('click', (e) => {
          e.preventDefault();
          const modal = document.getElementById('terms-modal-overlay');
          if (modal) modal.classList.add('is-open');
        });
      }

      this.container.querySelectorAll('.guest-accordion-header').forEach(header => {
        header.addEventListener('click', (e) => {
          e.preventDefault();
          const item = header.closest('.guest-accordion-item');
          const body = item.querySelector('.guest-accordion-body');
          const chevron = header.querySelector('.guest-chevron');

          const isCurrentlyOpen = item.classList.contains('is-open');
          if (isCurrentlyOpen) {
            item.classList.remove('is-open');
            body.style.display = 'none';
            if (chevron) chevron.textContent = '▼';
          } else {
            item.classList.add('is-open');
            body.style.display = 'block';
            if (chevron) chevron.textContent = '▲';
            const firstInput = body.querySelector('input');
            if (firstInput) firstInput.focus();
          }
        });
      });

      this.container.querySelectorAll('.guest-input').forEach(input => {
        input.addEventListener('input', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          const field = e.target.dataset.field;
          if (this.state.guests[idx]) {
            this.state.guests[idx][field] = e.target.value;
            if (idx === 0) {
              if (field === 'name') this.state.guestName = e.target.value;
              if (field === 'email') this.state.guestEmail = e.target.value;
              if (field === 'phone') this.state.guestPhone = e.target.value;
              if (field === 'street') this.state.guestStreet = e.target.value;
              if (field === 'city') this.state.guestCity = e.target.value;
              if (field === 'zip') this.state.guestZip = e.target.value;
              if (field === 'country') this.state.guestCountry = e.target.value;
            }
            const headerNameEl = this.container.querySelector(`#guest-accordion-${idx} .guest-header-name`);
            if (headerNameEl && field === 'name') {
              headerNameEl.textContent = e.target.value ? e.target.value : (idx === 0 ? 'Hlavní kontakt pro rozpis platby' : 'Klikněte pro rozbalení a vyplnění');
            }
            const statusPill = this.container.querySelector(`#guest-accordion-${idx} .guest-status-pill`);
            if (statusPill) {
              const g = this.state.guests[idx];
              const isFilled = idx === 0
                ? Boolean((g.name || this.state.guestName) && (g.email || this.state.guestEmail) && (g.phone || this.state.guestPhone))
                : Boolean(g.name && g.name.trim());
              if (isFilled) {
                statusPill.className = 'guest-status-pill status-ok';
                statusPill.textContent = '✓ Vyplněno';
              } else {
                statusPill.className = 'guest-status-pill status-pending';
                statusPill.textContent = 'Vyžadováno *';
              }
            }
          }
        });
      });

      this.setupAddressAutocomplete();
    } else if (this.currentStep === 3) {
      const btnNewBooking = this.container.querySelector('.btn-new-booking');
      const btnGoHome = this.container.querySelector('.btn-go-home');

      if (btnNewBooking) {
        btnNewBooking.addEventListener('click', () => {
          this.state.confirmedReservation = null;
          this.state.selectedRoomId = '';
          this.state.guestName = '';
          this.state.guestEmail = '';
          this.state.guestPhone = '';
          this.state.guestNote = '';
          this.state.fieldErrors = {};
          this.setStep(1);
        });
      }

      if (btnGoHome) {
        btnGoHome.addEventListener('click', () => {
          window.location.hash = '';
          window.location.reload();
        });
      }
    }

    const modalCloseBtns = [
      document.getElementById('btn-close-terms-modal'),
      document.getElementById('btn-close-modal-footer')
    ];
    modalCloseBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          const modal = document.getElementById('terms-modal-overlay');
          if (modal) modal.classList.remove('is-open');
        });
      }
    });

    const calOverlay = document.getElementById('cal-modal-overlay');
    if (calOverlay) {
      const closeCal = () => {
        this.state.showCalendarModal = false;
        this.render();
      };

      const btnCloseCal = document.getElementById('cal-close-btn');
      if (btnCloseCal) btnCloseCal.addEventListener('click', closeCal);

      calOverlay.addEventListener('click', (e) => {
        if (e.target === calOverlay) closeCal();
      });

      const prevBtn = document.getElementById('cal-prev-month');
      const nextBtn = document.getElementById('cal-next-month');

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.preventDefault();
          let { year, month } = this.state.calYearMonth;
          month--;
          if (month < 1) { month = 12; year--; }
          this.state.calYearMonth = { year, month };
          this.render();
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.preventDefault();
          let { year, month } = this.state.calYearMonth;
          month++;
          if (month > 12) { month = 1; year++; }
          this.state.calYearMonth = { year, month };
          this.render();
        });
      }

      const btnConfirmCal = document.getElementById('cal-confirm-dates-btn');
      if (btnConfirmCal) {
        btnConfirmCal.addEventListener('click', (e) => {
          e.preventDefault();
          if (this.state.tempDateFrom && this.state.tempDateTo) {
            this.state.dateFrom = this.state.tempDateFrom;
            this.state.dateTo = this.state.tempDateTo;
          }
          this.state.showCalendarModal = false;
          this.render();
          const card1 = this.container.querySelector('.card-step-1');
          if (card1) {
            card1.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }

      calOverlay.querySelectorAll('.cal-day:not(.is-disabled)').forEach(dayBtn => {
        dayBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const selectedDate = dayBtn.dataset.date;

          if (this.state.selectingStep === 1 || !this.state.tempDateFrom || selectedDate <= this.state.tempDateFrom) {
            this.state.tempDateFrom = selectedDate;
            this.state.tempDateTo = null;
            this.state.selectingStep = 2;
          } else if (this.state.selectingStep === 2 && selectedDate > this.state.tempDateFrom) {
            this.state.tempDateTo = selectedDate;
            this.state.selectingStep = 1;
          }

          this.render();
        });
      });
    }
  }
}
