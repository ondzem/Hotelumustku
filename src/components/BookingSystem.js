import { MOCK_ROOMS, isSupabaseConfigured, supabase, getStoredReservations, saveStoredReservation, sanitizeReservationForSupabase, getStoredBlockedDates, getStoredDiscountCodes, getStoredRoomPrices, getStoredDisabledRooms, getStoredCenik, fetchCenik, fetchRoomPrices, getDeviceRedeemedDiscountCodes, markDiscountCodeRedeemedOnDevice, incrementDiscountCodeUsage } from '../lib/supabaseClient.js';
import { obsazenostPulek, pulkyDne } from '../utils/obsazenost.js';
import {
  minimumNoci, popisNoci, zasahujeDoSvatku, zahrnujeSilvestr, jeSilvestr,
  mesicZasahujeMimoProvoz, mesicZasahujeSvatky, popisRozsahu,
  SVATKY, MIMO_PROVOZ,
} from '../utils/terminy.js';
import { calculateReservationPrice, generateReservationCode, generateManageToken, BANK_ACCOUNT, BANK_NAME, formatCzechPrice, validateSystemDateIntegrity, isWinterSeason, VYCHOZI_NASTAVENI } from '../utils/pricing.js';
import { maxOsobNaPokoji, obdobiSOmezenouDostupnosti } from '../utils/cenik.js';
import { sendEmail, generateEmail1RequestReceived, generateEmail1ReceptionNotification, RECEPCE_PRIJEMCE } from '../utils/emailService.js';
import { fotkyPokoje } from '../utils/roomGalleries.js';

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
    this.cenik = getStoredCenik();
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
      pendingRoomId: null,
      isCustomDropdownOpen: false,
      isRoomGalleryOpen: false,
      preselectedFromExternal: false,
      dateFrom: null,
      dateTo: null,
      tempDateFrom: null,
      tempDateTo: null,
      selectingStep: 1, // 1 = picking arrival, 2 = picking departure
      adults: 2,
      children: 0,
      hasDog: false,
      hasEbike: false,
      ebikeCount: 1,
      hasHalfBoard: false,
      halfBoardCount: 2,
      hasWinterParking: false,
      parkingCarsCount: 1,
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

  hasValidDates() {
    if (!this.state.dateFrom || !this.state.dateTo) return false;
    const start = new Date(this.state.dateFrom);
    const end = new Date(this.state.dateTo);
    if (isNaN(start) || isNaN(end)) return false;
    // Minimum se liší podle termínu: přes svátky tři noci, jinak dvě.
    return Math.ceil((end - start) / 86400000) >= minimumNoci(this.state.dateFrom);
  }

  /** Kolik nocí je nejméně potřeba u právě rozpracovaného termínu. */
  minimumNociProVyber(datumPrijezdu) {
    return minimumNoci(datumPrijezdu || this.state.dateFrom);
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

  /**
   * Zapamatuje si rozdělaný výběr, aby o něj host nepřišel.
   *
   * Typický případ: vybere termín a pokoj, klikne na „Detaily pokoje“,
   * přečte si je na stránce Ubytování a vrátí se zpátky. Bez tohohle
   * by musel termín i pokoj vybírat znovu — jen za to, že se chtěl
   * podívat. Sezení, ne trvalé úložiště: příště má začít načisto.
   */
  ulozVyberDoSezeni() {
    try {
      sessionStorage.setItem('hotel_rozdelana_rezervace', JSON.stringify({
        dateFrom: this.state.dateFrom,
        dateTo: this.state.dateTo,
        adults: this.state.adults,
        children: this.state.children,
        selectedRoomId: this.state.selectedRoomId,

        // Doplňkové služby. Dřív se neukládaly, takže host, který si odskočil
        // na jinou stránku, našel po návratu termín i pokoj, ale zaškrtnutou
        // polopenzi nebo psa musel vybírat znovu.
        hasHalfBoard: this.state.hasHalfBoard,
        halfBoardCount: this.state.halfBoardCount,
        hasDog: this.state.hasDog,
        hasEbike: this.state.hasEbike,
        ebikeCount: this.state.ebikeCount,
        hasWinterParking: this.state.hasWinterParking,
        parkingCarsCount: this.state.parkingCarsCount,

        // Jen text kódu, a to z uplatněné slevy — `discountCodeInput` drží
        // jen to, co je zrovna napsané v políčku, a po překreslení bývá
        // prázdné. Hotovou slevu schválně neukládáme: při návratu se kód
        // ověří znovu, aby mezitím zneplatněný kód nepřežil.
        // Dokud se zapamatovaný kód nestihne znovu uplatnit, drží ho
        // `slevovyKodKUplatneni`. Bez toho ho první překreslení po návratu
        // přepsalo prázdnou hodnotou dřív, než doběhlo načtení kódů —
        // a sleva se tím ztratila, přestože byla uložená správně.
        slevovyKod: this.appliedDiscount
          ? (this.appliedDiscount.code || this.discountCodeInput || '')
          : (this.slevovyKodKUplatneni || ''),

        // Údaje hosta, ať se nepřepisují při každém odskoku.
        guestName: this.state.guestName,
        guestEmail: this.state.guestEmail,
        guestPhone: this.state.guestPhone,
        guestStreet: this.state.guestStreet,
        guestCity: this.state.guestCity,
        guestZip: this.state.guestZip,
        guestCountry: this.state.guestCountry,
        guestNote: this.state.guestNote,
        guests: this.state.guests,

        ulozeno: Date.now(),
      }));
    } catch { /* soukromý režim prohlížeče — bez zapamatování, ale bez pádu */ }
  }

  /** Zahodí zapamatovaný výběr — po odeslané rezervaci nebo při vynulování. */
  zapomenVyberVSezeni() {
    this.slevovyKodKUplatneni = '';
    try {
      sessionStorage.removeItem('hotel_rozdelana_rezervace');
    } catch { /* soukromý režim prohlížeče */ }
  }

  nactiVyberZeSezeni() {
    try {
      const raw = sessionStorage.getItem('hotel_rozdelana_rezervace');
      if (!raw) return null;
      const v = JSON.parse(raw);
      // Po dvou hodinách už to není „vrátil se z detailu“, ale nová návštěva.
      if (!v || !v.ulozeno || Date.now() - v.ulozeno > 2 * 60 * 60 * 1000) return null;
      // Termín v minulosti nemá cenu obnovovat.
      if (v.dateFrom && v.dateFrom < getTodayDateString()) return null;
      return v;
    } catch {
      return null;
    }
  }

  async init(initialRoomId, openCalendar) {
    const zapamatovane = this.nactiVyberZeSezeni();
    if (zapamatovane) {
      // Podrží kód, než se stihne ověřit a uplatnit (viz ulozVyberDoSezeni).
      this.slevovyKodKUplatneni = zapamatovane.slevovyKod || '';

      if (zapamatovane.dateFrom && zapamatovane.dateTo) {
        this.state.dateFrom = zapamatovane.dateFrom;
        this.state.dateTo = zapamatovane.dateTo;
      }
      if (zapamatovane.adults) this.state.adults = zapamatovane.adults;
      if (typeof zapamatovane.children === 'number') this.state.children = zapamatovane.children;

      // Doplňkové služby
      for (const klic of ['hasHalfBoard', 'hasDog', 'hasEbike', 'hasWinterParking']) {
        if (typeof zapamatovane[klic] === 'boolean') this.state[klic] = zapamatovane[klic];
      }
      for (const klic of ['halfBoardCount', 'ebikeCount', 'parkingCarsCount']) {
        const n = parseInt(zapamatovane[klic], 10);
        if (Number.isFinite(n) && n > 0) this.state[klic] = n;
      }

      // Údaje hosta
      for (const klic of ['guestName', 'guestEmail', 'guestPhone', 'guestStreet',
                          'guestCity', 'guestZip', 'guestCountry', 'guestNote']) {
        if (typeof zapamatovane[klic] === 'string' && zapamatovane[klic]) {
          this.state[klic] = zapamatovane[klic];
        }
      }
      if (Array.isArray(zapamatovane.guests) && zapamatovane.guests.length) {
        this.state.guests = zapamatovane.guests;
      }
      // Pokoj z adresy (proklik „Zvolit pokoj“) má přednost před
      // zapamatovaným — host právě řekl, který chce.
      if (!initialRoomId && zapamatovane.selectedRoomId
          && this.roomsList.some(r => r.id === zapamatovane.selectedRoomId)) {
        this.state.selectedRoomId = zapamatovane.selectedRoomId;
      }
    }

    if (initialRoomId && this.roomsList.some(r => r.id === initialRoomId)) {
      if (this.hasValidDates()) {
        this.state.selectedRoomId = initialRoomId;
        this.state.preselectedFromExternal = true;
      } else {
        this.state.pendingRoomId = initialRoomId;
      }
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

    // Obsazenost kalendáře se dotahuje zvlášť a překreslí se hned, jak dorazí.
    // Dřív se čekalo na všech šest dotazů najednou (včetně ceníku, který sám
    // dělá čtyři), takže vybarvená políčka naskočila až po několika vteřinách
    // a host mezitím klikal do kalendáře, který vypadal celý volný.
    const dostupnost = Promise.allSettled([
      this.fetchActiveReservations(),
      this.fetchBlockedDates(),
      this.fetchDisabledRooms(),
    ]).then(() => this.render())
      .catch(err => console.error('BookingSystem availability fetch error:', err));

    const zbytek = Promise.allSettled([
      this.fetchDiscountCodes(),
      this.fetchRoomPrices(),
      this.fetchCenik()
    ]).then(() => {
      // Slevový kód se uplatní až tady — ověřuje se proti seznamu, který
      // musí být načtený. Ukládá se jen text kódu, ne hotová sleva, takže
      // kód mezitím zneplatněný se prostě znovu neuplatní.
      if (zapamatovane && zapamatovane.slevovyKod && !this.appliedDiscount) {
        this.discountCodeInput = zapamatovane.slevovyKod;
        return this.applyDiscountCode(zapamatovane.slevovyKod)
          .catch(() => {})
          .finally(() => { this.slevovyKodKUplatneni = ''; });
      }
      this.slevovyKodKUplatneni = '';
    }).catch(err => console.error('BookingSystem init fetch error:', err));

    await dostupnost;

    if (openCalendar && !this.hasValidDates()) {
      this.state.showCalendarModal = true;
      this.state.tempDateFrom = null;
      this.state.tempDateTo = null;
      this.state.selectingStep = 1;
      this.render();
    }

    await zbytek;
    this.render();
  }

  /** Načte ceník — sezóny, ceny podle počtu osob, příplatky. */
  async fetchCenik() {
    this.cenik = await fetchCenik();
    return this.cenik;
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
    // Přes společnou funkci, ne vlastním dotazem — stránku načítají karty
    // pokojů i formulář naráz a takhle se z toho stane jeden dotaz.
    try {
      const data = await fetchRoomPrices();
      this.roomPrices = Array.isArray(data) ? data : getStoredRoomPrices();
    } catch (err) {
      console.error('Fetch room prices error:', err);
      this.roomPrices = getStoredRoomPrices();
    }
  }

  async applyDiscountCode(inputCode) {
    const clean = String(inputCode || '').trim().toUpperCase();
    this.discountError = '';
    if (!clean) {
      this.appliedDiscount = null;
      this.slevovyKodKUplatneni = '';   // host kód smazal, nekřísit ho
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
    const isPercent = found.discount_type === 'percent' || Number(found.discount_value) <= 100;
    this.discountSuccessMsg = `Slevový kód ${found.code} (${isPercent ? `-${found.discount_value} %` : `-${found.discount_value} Kč`} na pokoj) byl úspěšně uplatněn!`;
    this.discountError = '';
    this.render();
  }

  async fetchActiveReservations() {
    // Kontrola prošlých lhůt tu schválně NEBĚŽÍ. Dělala dvě věci, které do
    // prohlížeče hosta nepatří: předřadila kalendáři další dotaz do databáze
    // (obsazenost se tím načítala dvakrát tak dlouho) a rozesílala stornovací
    // e-maily z návštěvníkova zařízení. Běží v administraci (AdminDashboard).
    if (isSupabaseConfigured && supabase) {
      try {
        // Jen sloupce potřebné pro obsazenost — jména, e-maily a telefony
        // hostů nemá cizí prohlížeč proč stahovat.
        const { data, error } = await supabase
          .from('reservations')
          .select('room_id,date_from,date_to,status')
          .not('status', 'in', '("cancelled","cancelled_unpaid","stornováno")');
        if (!error && data) {
          this.activeReservations = data;
          return;
        }
      } catch (err) {
        console.error('Failed to fetch active reservations from Supabase:', err);
      }
    }
    const stored = getStoredReservations();
    this.activeReservations = stored.filter(r => !r.status.startsWith('cancelled') && r.status !== 'stornováno');
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
        return dateStr >= b.date_from && dateStr < b.date_to;
      });
      if (isBlocked) return true;
    }

    if (!this.activeReservations || this.activeReservations.length === 0) return false;
    return this.activeReservations.some(r => {
      if (r.room_id !== roomId || (r.status && (r.status.startsWith('cancelled') || r.status === 'stornováno'))) return false;
      return dateStr >= r.date_from && dateStr < r.date_to;
    });
  }

  /**
   * Jak je hotel obsazený dopoledne a jak odpoledne.
   *
   * `date_from` znamená obsazeno až od 15:00, `date_to` jen do 10:00.
   * Host tak vidí, že den, kdy někdo odjíždí, je odpoledne volný — a
   * nepřijde o termín kvůli tomu, že vypadá obsazeně.
   *
   * Nepočítají se přestupy, ale obsazenost obou polovin. Rozdíl je vidět,
   * jakmile se termíny překrývají: když jednomu pokoji blokace ve 25. ráno
   * končí, ale jiný pokoj je 25. obsazený celý, hotel dopoledne prázdný
   * NENÍ a půlit se nesmí. Podrobně v src/utils/obsazenost.js.
   */
  obsazenostPulekDne(dateStr, roomId = 'all') {
    const prodejne = this.prodejnePokoje(roomId);

    const jeAktivni = (r) => !(r.status && (r.status.startsWith('cancelled') || r.status === 'stornováno'));

    return obsazenostPulek(prodejne.map(r => r.id), {
      obsazeno: (roomId) => this.isDateOccupied(dateStr, roomId),
      zacina: (roomId) =>
        (this.blockedDates || []).some(b => (b.room_id === 'all' || b.room_id === roomId) && b.date_from === dateStr)
        || (this.activeReservations || []).some(r => r.room_id === roomId && jeAktivni(r) && r.date_from === dateStr),
      konci: (roomId) =>
        (this.blockedDates || []).some(b => (b.room_id === 'all' || b.room_id === roomId) && b.date_to === dateStr)
        || (this.activeReservations || []).some(r => r.room_id === roomId && jeAktivni(r) && r.date_to === dateStr),
    });
  }

  /**
   * Pokoje, které se do obsazenosti počítají.
   *
   * S konkrétním `roomId` jen ten jeden. Kalendář dřív barvil vždycky
   * celý hotel, i když měl host vybraný pokoj — den svítil zeleně
   * (jiné pokoje volné), host ho zvolil a formulář mu vzápětí oznámil,
   * že JEHO pokoj je obsazený. Majitel to hlásil jako „volné datum se
   * ukazuje jako zabrané". Teď se barví to, co si host opravdu vybírá.
   */
  prodejnePokoje(roomId = 'all') {
    return (this.roomsList || []).filter((r) => {
      if (roomId && roomId !== 'all' && r.id !== roomId) return false;
      const vypnuty = Boolean(
        r.isDisabled ||
        (this.disabledRooms || []).some(
          (d) => d.room_id === r.id && d.is_disabled
        )
      );
      return !vypnuty;
    });
  }

  getDayOccupancy(dateStr, roomId = 'all') {
    const prodejne = this.prodejnePokoje(roomId);

    const celkem = prodejne.length;
    if (celkem === 0) return { obsazeno: 0, celkem: 0 };

    const obsazeno = prodejne.filter(
      (r) => this.isDateOccupied(dateStr, r.id)
    ).length;

    return { obsazeno, celkem };
  }

  checkReservationOverlap(roomId, dateFrom, dateTo) {
    if (!dateFrom || !dateTo) return null;
    if (this.blockedDates && this.blockedDates.length > 0) {
      const blockedConflict = this.blockedDates.find(b => {
        if (b.room_id !== 'all' && b.room_id !== roomId) return false;
        return b.date_from < dateTo && b.date_to > dateFrom;
      });
      if (blockedConflict) {
        return { isBlocked: true, reason: blockedConflict.reason };
      }
    }

    if (!this.activeReservations || this.activeReservations.length === 0) return null;
    return this.activeReservations.find(r => {
      if (r.room_id !== roomId || (r.status && (r.status.startsWith('cancelled') || r.status === 'stornováno'))) return false;
      return r.date_from < dateTo && r.date_to > dateFrom;
    });
  }

  scrollToErrorMessage() {
    setTimeout(() => {
      const errBanner = this.container.querySelector('.booking-error-alert') ||
        this.container.querySelector('.booking-alert-error') ||
        this.container.querySelector('.form-field.has-error') ||
        this.container.querySelector('#date-range-btn') ||
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

  /**
   * Upozornění, že mimo hlavní sezónu nemusí být volno na každý termín.
   *
   * Ukazuje se až po zvolení termínu a jen když do takového období
   * pobyt opravdu zasahuje — dřív by to byla jen další věta, kterou
   * host přeskočí. Formulace nesmí znít jako odmítnutí: rezervaci lze
   * podat vždy, hotel ji jen musí potvrdit.
   */
  /**
   * Rozbalený náhled fotek vybraného pokoje.
   *
   * Dřív tlačítko odvádělo hosta na stránku Ubytování a rozdělaná
   * rezervace se tím ztrácela z očí. Fotky se teď ukážou rovnou tady;
   * na Ubytování vede až tlačítko „Detaily pokoje“ pro toho, kdo chce
   * číst dál.
   */
  /**
   * Oživí rozbalenou galerii — šipky, tažení myší a počítadlo fotek.
   *
   * Rolování mění jen scrollLeft, nikdy nevolá render(): překreslení
   * formuláře by galerii přetočilo zpět na první fotku.
   */
  bindRoomGallery() {
    const okno = this.container.querySelector('.booking-gallery-viewport');
    if (!okno) return;

    const stopa = okno.querySelector('.booking-gallery-track');
    const citac = this.container.querySelector('.booking-gallery-index');
    const krok = () => {
      const s = okno.querySelector('.booking-gallery-slide');
      const mezera = stopa ? parseFloat(getComputedStyle(stopa).columnGap || '0') || 0 : 0;
      return s ? s.offsetWidth + mezera : okno.clientWidth;
    };

    const celkem = okno.querySelectorAll('.booking-gallery-slide').length;

    // Pořadí si držíme zvlášť, ne dopočítané ze scrollLeft: plynulé
    // rolování ještě běží, takže dvě rychlá kliknutí za sebou by se
    // odvodila ze stejné polohy a druhé by nikam neposunulo.
    let aktualni = 0;
    const ukazCislo = () => { if (citac) citac.textContent = String(aktualni + 1); };

    const skoc = (index) => {
      aktualni = (index + celkem) % celkem; // za poslední fotkou zpět na začátek
      okno.scrollTo({ left: aktualni * krok(), behavior: 'smooth' });
      ukazCislo();
    };

    // Když host fotky přetáhne rukou, srovnáme pořadí podle skutečné polohy.
    okno.addEventListener('scroll', () => {
      aktualni = Math.min(celkem - 1, Math.max(0, Math.round(okno.scrollLeft / Math.max(1, krok()))));
      ukazCislo();
    }, { passive: true });

    const prev = this.container.querySelector('.booking-gallery-prev');
    const next = this.container.querySelector('.booking-gallery-next');
    if (next) next.addEventListener('click', (e) => { e.preventDefault(); skoc(aktualni + 1); });
    if (prev) prev.addEventListener('click', (e) => { e.preventDefault(); skoc(aktualni - 1); });

    let drzi = false;
    let zacatekX = 0;
    let zacatekScroll = 0;
    okno.addEventListener('mousedown', (e) => {
      drzi = true;
      zacatekX = e.pageX - okno.offsetLeft;
      zacatekScroll = okno.scrollLeft;
    });
    const pust = () => { drzi = false; };
    okno.addEventListener('mouseleave', pust);
    okno.addEventListener('mouseup', pust);
    okno.addEventListener('mousemove', (e) => {
      if (!drzi) return;
      e.preventDefault();
      okno.scrollLeft = zacatekScroll - ((e.pageX - okno.offsetLeft) - zacatekX) * 1.6;
    });
  }

  renderRoomGallery(room) {
    const fotky = fotkyPokoje(room.id);
    const kapacita = this.maxOsobProPokoj(room);

    return `
      <div class="booking-room-gallery" id="room-gallery-panel">
        <div class="booking-gallery-head">
          <span class="booking-gallery-nazev">${room.name}</span>
          <span class="booking-gallery-pocet">${fotky.length} ${fotky.length === 1 ? 'fotka' : (fotky.length < 5 ? 'fotky' : 'fotek')}</span>
        </div>

        <div class="booking-gallery-stage">
          <div class="booking-gallery-viewport">
            <div class="booking-gallery-track">
              ${fotky.map((src, i) => `
                <div class="booking-gallery-slide">
                  <img src="${src}" alt="${room.name} — fotka ${i + 1}"
                       loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async" draggable="false"
                       onerror="this.onerror=null;this.src='/hezky pokoj 1.webp';">
                </div>
              `).join('')}
            </div>
          </div>

          ${fotky.length > 1 ? `
            <button type="button" class="booking-gallery-sipka booking-gallery-prev" aria-label="Předchozí fotka">
              <svg width="9" height="14" viewBox="0 0 8 12" fill="none" aria-hidden="true"><path d="M7 1L2 6L7 11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="booking-gallery-sipka booking-gallery-next" aria-label="Další fotka">
              <svg width="9" height="14" viewBox="0 0 8 12" fill="none" aria-hidden="true"><path d="M1 1L6 6L1 11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
            </button>
            <span class="booking-gallery-citac"><strong class="booking-gallery-index">1</strong> / ${fotky.length}</span>
          ` : ''}
        </div>

        <div class="booking-gallery-pata">
          <span class="booking-gallery-popis">Kapacita až ${kapacita} ${kapacita < 5 ? 'osoby' : 'osob'} • ${room.floor === 'prizemi' ? 'Přízemí' : '1. patro'}</span>
          <button type="button" class="btn-room-detail-odkaz" data-room-id="${room.id}">
            Detaily pokoje
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Upozornění na Silvestr.
   *
   * Majitel pořádá silvestrovský večer s programem a předem do něj
   * investuje (kapela, výzdoba). Když se sejde pět lidí, nevyplatí se —
   * a host, který přijede s očekáváním oslavy, by byl zklamaný. Věta
   * proto říká pravdu dopředu: ubytování je jisté, program ne.
   *
   * Schválně to NENÍ varování ani podmínka. Je to informace, kterou si
   * host přečte jednou a ví, na čem je.
   */
  renderSilvestrNote() {
    if (!this.state.dateFrom || !this.state.dateTo) return '';
    if (!zahrnujeSilvestr(this.state.dateFrom, this.state.dateTo)) return '';

    return `
      <div class="booking-poznamka je-silvestr">
        <span class="booking-poznamka-ikona" aria-hidden="true">✦</span>
        <span class="booking-poznamka-text">
          <strong>Váš pobyt zahrnuje Silvestr.</strong>
          Silvestrovský večer s programem chystáme jen tehdy, když se sejde dost hostů —
          jestli letos vyjde, dáme vám vědět při potvrzení rezervace.
          <strong>Ubytování máte jisté tak jako tak.</strong>
        </span>
      </div>
    `;
  }

  /**
   * Upozornění na svátky: nejméně tři noci.
   *
   * Ukazuje se, jakmile termín do svátků zasahuje — tedy i tehdy, když
   * je délka v pořádku. Host tak ví, proč tam to pravidlo je, a ne jen
   * že mu tlačítko nejde zmáčknout.
   */
  renderSvatkyNote() {
    if (!this.state.dateFrom || !this.state.dateTo) return '';
    if (!zasahujeDoSvatku(this.state.dateFrom, this.state.dateTo)) return '';

    return `
      <div class="booking-poznamka je-svatky">
        <span class="booking-poznamka-ikona" aria-hidden="true">❄</span>
        <span class="booking-poznamka-text">
          Termín spadá do svátků (<strong>${popisRozsahu(SVATKY)}</strong>).
          V tomto období přijímáme pobyty nejméně na <strong>${popisNoci(SVATKY.minNoci)}</strong>.
        </span>
      </div>
    `;
  }

  /**
   * Upozornění na zimní přestávku.
   *
   * Váže se na ZOBRAZENÝ MĚSÍC, ne na vybraný termín. Zavřené dny jsou
   * v kalendáři plné a nedají se rozkliknout, takže podle výběru by se
   * upozornění nikdy neukázalo — a host by koukal na červený říjen bez
   * vysvětlení. Takhle to čte přesně ve chvíli, kdy se ptá „proč".
   */
  /**
   * Upozornění na zimní přestávku.
   *
   * Váže se na ZOBRAZENÝ MĚSÍC, ne na vybraný termín. Zavřené dny jsou
   * v kalendáři plné a nedají se rozkliknout, takže podle výběru by se
   * upozornění nikdy neukázalo — a host by koukal na červený říjen bez
   * vysvětlení. Takhle to čte přesně ve chvíli, kdy se ptá „proč".
   *
   * Na formulaci záleží víc než na kódu. Holé „máme zavřeno" čte host
   * jako „tomu hotelu se nechce", a to majiteli ubližuje. Text proto
   * pojmenuje DŮVOD, který je v horách samozřejmý — je po podzimu a sníh
   * ještě nedorazil — a ukáže, že se ten čas využívá na údržbu. Zavření
   * je pak vidět jako péče o hotel, ne jako lajdáctví. Poslední věta
   * nechává dveře otevřené, protože při větší skupině se otevřít vyplatí.
   */
  renderMimoProvozNote(rok, mesic) {
    if (!mesicZasahujeMimoProvoz(rok, mesic)) return '';
    // Zavřené upozornění se už v témž otevření kalendáře nevrací.
    // Bez toho zabíralo přes půl okna a na dny pod ním se nedalo dostat.
    if (this.state.mimoSezonuSkryto) return '';

    return `
      <div class="booking-mimo-sezonu">
        <button type="button" class="mimo-sezonu-zavrit" id="mimo-sezonu-zavrit" aria-label="Skrýt upozornění">&times;</button>
        <span class="mimo-sezonu-stitek">Mimo sezónu</span>
        <p class="mimo-sezonu-nadpis">Mezi podzimem a zimou hotel zavíráme</p>
        <p class="mimo-sezonu-text">
          V období <strong>${popisRozsahu(MIMO_PROVOZ)}</strong> je po podzimní sezóně.
          Tento čas využíváme na údržbu a přípravu na zimu. Pro větší skupiny
          v tomto období pronajímáme <strong>celý objekt</strong> — ozvěte se nám.
        </p>
        <a class="mimo-sezonu-telefon" href="tel:+420777666273">+420 777 666 273</a>
      </div>
    `;
  }

  renderOmezenaDostupnostNote() {
    if (!this.hasValidDates()) return '';

    const obdobi = obdobiSOmezenouDostupnosti(
      this.state.dateFrom,
      this.calculateNights(),
      this.cenik || {}
    );
    if (obdobi.length === 0) return '';

    const nazvy = obdobi.length === 1
      ? obdobi[0].toLowerCase()
      : `${obdobi.slice(0, -1).join(', ').toLowerCase()} a ${obdobi[obdobi.length - 1].toLowerCase()}`;

    return `
      <div class="booking-season-note" style="margin-top: 14px; display: flex; gap: 10px; align-items: flex-start; background: #f7f6f1; border: 1px solid #e0dfd5; border-left: 3px solid #697947; border-radius: 6px; padding: 12px 14px;">
        <span style="font-size: 16px; line-height: 1.3; flex-shrink: 0;">🌿</span>
        <span style="font-size: 13px; color: #55554e; line-height: 1.6;">
          Váš termín spadá do období <strong>${nazvy}</strong>. Mimo hlavní sezónu si dopřáváme
          kratší provozní přestávky, takže nabídka pokojů může být omezená.
          Rezervaci klidně odešlete — <strong>dostupnost vám obratem potvrdíme</strong>
          a teprve potom platíte zálohu.
        </span>
      </div>
    `;
  }

  /**
   * Částka z ceníku pro popisky ve formuláři.
   *
   * Popisky MUSÍ brát stejné číslo jako výpočet. Dřív byly částky
   * v textech napsané natvrdo, takže po změně v administraci formulář
   * dál sliboval starou cenu a účtoval novou — polopenze hlásila 195 Kč,
   * i když v ceníku bylo něco jiného. Nikdy sem nepiš číslo ručně.
   */
  castka(klic) {
    const v = Number(this.cenik && this.cenik.nastaveni && this.cenik.nastaveni[klic]);
    return Number.isFinite(v) ? v : VYCHOZI_NASTAVENI[klic];
  }

  /**
   * Upozornění uvnitř kalendáře místo alert() z prohlížeče.
   *
   * Nativní okno se otevře mimo stránku, vypadá jako systémová chyba
   * a na mobilu překryje celý displej. Hláška proto sedí přímo nad
   * tlačítkem Potvrdit, ve stejném stylu jako upozornění na minimální
   * délku pobytu.
   */
  ukazHlaskuVKalendari(text) {
    const tlacitko = this.container.querySelector('#cal-confirm-dates-btn');
    if (!tlacitko) return;

    let hlaska = this.container.querySelector('.cal-hlaska-obsazeno');
    if (!hlaska) {
      hlaska = document.createElement('div');
      hlaska.className = 'cal-hlaska-obsazeno';
      hlaska.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; background: #fdecea; border: 1px solid #f5c2bd; border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; font-size: 13px; color: #a33; line-height: 1.5;';
      tlacitko.parentNode.insertBefore(hlaska, tlacitko);
    }
    hlaska.innerHTML = `<span style="flex-shrink: 0;">⚠️</span><span>${text}</span>`;
    hlaska.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    clearTimeout(this._hlaskaCasovac);
    this._hlaskaCasovac = setTimeout(() => hlaska.remove(), 6000);
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
    const isWinter = isWinterSeason(this.state.dateFrom, this.state.dateTo);
    if (!room) {
      return {
        nights,
        roomBasePriceTotal: 0,
        halfBoardPriceTotal: 0,
        dogPriceTotal: 0,
        ebikePriceTotal: 0,
        cityTax: 0,
        soloPriplatekCelkem: 0,
        discountAmount: 0,
        discountPercent: 0,
        discountLabel: '',
        formattedDiscountAmount: '0 Kč',
        totalPrice: 0,
        // Bez vybraného pokoje se procento zálohy bere přímo z nastavení,
        // jinak by popisek zálohy ukazoval „undefined %".
        depositPercentage: this.castka('zaloha_procent'),
        depositPriceTotal: 0,
        remainingPriceTotal: 0,
        hasHalfBoard: this.state.hasHalfBoard,
        halfBoardCount: this.state.halfBoardCount || this.state.adults || 2,
        hasDog: this.state.hasDog,
        hasEbike: this.state.hasEbike,
        ebikeCount: this.state.ebikeCount || 1,
        isWinterSeason: isWinter,
        hasWinterParking: isWinter && this.state.hasWinterParking,
        parkingCarsCount: this.state.parkingCarsCount || 1,
        winterParkingPriceTotal: 0,
      };
    }
    return calculateReservationPrice({
      roomType: room.type,
      roomId: room.id,
      nights,
      persons: this.state.adults,
      adults: this.state.adults,
      children: 0,
      dateFrom: this.state.dateFrom,
      dateTo: this.state.dateTo,
      hasDog: this.state.hasDog,
      hasEbike: this.state.hasEbike,
      ebikeCount: this.state.ebikeCount || 1,
      hasHalfBoard: this.state.hasHalfBoard,
      halfBoardCount: this.state.halfBoardCount || this.state.adults || 2,
      hasWinterParking: this.state.hasWinterParking,
      parkingCarsCount: this.state.parkingCarsCount || 1,
      cenik: this.cenik,
      nastaveni: this.cenik && this.cenik.nastaveni,
      discountObj: this.appliedDiscount,
    });
  }

  /**
   * Sníží počet osob, když se do vybraného pokoje nevejdou.
   * Volá se po každé změně pokoje.
   */
  osekniPocetOsobNaKapacitu() {
    const pokoj = this.getSelectedRoom();
    const maxOsob = this.maxOsobProPokoj(pokoj);
    if (this.state.adults > maxOsob) {
      const puvodne = this.state.adults;
      this.state.adults = maxOsob;
      // Tiché snížení počtu osob host nezaznamená a pak se diví ceně,
      // proto se mu rovnou napíše, co se stalo a proč.
      this.state.errorMessage = `${pokoj ? pokoj.name : 'Pokoj'} má ${this.popisLuzek(pokoj)}, ubytovat se sem tedy může nejvýš ${maxOsob} ${maxOsob === 1 ? 'osoba' : 'osoby'}. Počet hostů jsme z ${puvodne} snížili na ${maxOsob}. Pro větší skupinu zvolte prostornější pokoj, nebo rezervujte pokoje dva.`;
    }
    if (this.state.halfBoardCount > this.state.adults) {
      this.state.halfBoardCount = this.state.adults;
    }
  }

  /**
   * Kolik osob jde na daný pokoj vybrat — stálá lůžka plus přistýlky
   * podle nastavení v administraci.
   */
  maxOsobProPokoj(room) {
    if (!room) return 4;
    const { luzka, pristylky } = this.luzkaPokoje(room);
    return maxOsobNaPokoji({ zakladni_luzka: luzka, max_pristylek: pristylky });
  }

  /** Stálá lůžka a přistýlky pokoje — z administrace, jinak ze záložního seznamu. */
  luzkaPokoje(room) {
    const p = (this.roomPrices || []).find(x => x.room_id === room.id) || {};
    return {
      luzka: Number(p.zakladni_luzka != null ? p.zakladni_luzka : room.capacity) || 0,
      pristylky: Number(p.max_pristylek != null ? p.max_pristylek : room.extraBeds) || 0,
    };
  }

  /**
   * Věta typu „2 lůžka + 1 přistýlka“. Host tak vidí, z čeho se kapacita
   * skládá — ne jen holé číslo, které vypadá jako počet postelí.
   */
  popisLuzek(room) {
    const { luzka, pristylky } = this.luzkaPokoje(room);
    const slovoLuzka = luzka === 1 ? 'lůžko' : (luzka < 5 ? 'lůžka' : 'lůžek');
    if (!pristylky) return `${luzka} ${slovoLuzka}`;
    const slovoPristylka = pristylky === 1 ? 'přistýlka' : (pristylky < 5 ? 'přistýlky' : 'přistýlek');
    return `${luzka} ${slovoLuzka} + ${pristylky} ${slovoPristylka}`;
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

    // Pobyt s pejskem vyžaduje upřesnění v poznámce —
    // recepce podle toho pobyt schvaluje.
    if (this.state.hasDog) {
      const poznamkaEl = this.container.querySelector('#guest-note');
      const poznamka = (poznamkaEl ? poznamkaEl.value : this.state.guestNote || '').trim();

      if (poznamka.length < 5) {
        this.showFieldError('guest-note',
          'Uveďte prosím do poznámky rasu a velikost pejska. Bez toho nemůže recepce pobyt se psem schválit.');
        return;
      }
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
      has_winter_parking: pricing.hasWinterParking,
      parking_cars_count: pricing.parkingCarsCount,
      winter_parking_price_total: pricing.winterParkingPriceTotal,
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
        const payload = sanitizeReservationForSupabase(reservationData);
        const { error } = await supabase.from('reservations').insert([payload]);
        if (error) {
          console.error('Failed to insert reservation into Supabase:', error);
        } else {
          console.log('✅ Reservation inserted into Supabase:', code);
        }
      } catch (err) {
        console.error('Exception inserting reservation into Supabase:', err);
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
        to: RECEPCE_PRIJEMCE,
        subject: email1Reception.subject,
        html: email1Reception.html,
        type: 'email_1_reception_notification',
        reservationCode: code
      });
    } catch (emailErr) {
      console.error('Failed to dispatch Phase 1 emails:', emailErr);
    }

    // Rezervace je odeslaná — rozdělaný výběr už neplatí. Bez tohohle se
    // hostovi po návratu na formulář předvyplnil pokoj a termín, které si
    // právě objednal, a vypadalo to, že objednává znovu.
    this.zapomenVyberVSezeni();

    this.state.confirmedReservation = reservationData;
    this.state.isSubmitting = false;
    this.setStep(3);
  }

  render() {
    if (!this.container) return;

    // Výběr se ukládá při každém překreslení — pokrývá to změnu termínu,
    // pokoje i počtu osob bez zvláštní obsluhy u každého ovládacího prvku.
    // Na děkovací obrazovce už ne: rezervace je hotová a uložením by se
    // výběr, který jsme právě zahodili, vrátil zpátky.
    if (this.currentStep !== 3) this.ulozVyberDoSezeni();

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

    const roomIdForCal = this.state.selectedRoomId || this.state.pendingRoomId || 'all';
    // Kalendář barví obsazenost toho, co si host vybírá: konkrétní pokoj,
    // nebo celý hotel, dokud pokoj vybraný není. Viz prodejnePokoje().
    const pokojKalendare = roomIdForCal !== 'all'
      ? (this.roomsList || []).find(r => r.id === roomIdForCal) : null;
    const jedenPokoj = Boolean(pokojKalendare);

    const effectiveFrom = this.state.tempDateFrom;
    const effectiveTo = this.state.tempDateTo;

    const baseForMonth = effectiveFrom || this.state.dateFrom || getTodayDateString();

    if (!this.state.calYearMonth) {
      const [y, m] = baseForMonth.split('-').map(Number);
      this.state.calYearMonth = { year: y, month: m };
    }

    const { year, month } = this.state.calYearMonth;

    // Do minulosti se rezervovat nedá, takže se do ní nedá ani listovat.
    // Host by tam jen bloudil mezi samými nedostupnými dny a ptal se,
    // proč nejde nic vybrat. V administraci to platit NESMÍ — majitel
    // se do starých měsíců dívá schválně, když dohledává, kdo tam byl.
    const [rokDnes, mesicDnes] = getTodayDateString().split('-').map(Number);
    const jeNejstarsiMesic = year === rokDnes && month === mesicDnes;

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

    // Který plně obsazený den ještě smí být odjezdem? Jen ten PRVNÍ za
    // příjezdem — na pozdější by se muselo přespat plnou noc. Hledá se
    // dopředu jednou, ne v každé buňce znovu.
    let prvniPlnyPoPrijezdu = null;
    if (this.state.tempDateFrom && !this.state.tempDateTo) {
      const kurzor = new Date(this.state.tempDateFrom + 'T00:00:00');
      for (let i = 0; i < 400; i++) {
        kurzor.setDate(kurzor.getDate() + 1);
        const dStr = `${kurzor.getFullYear()}-${String(kurzor.getMonth() + 1).padStart(2, '0')}-${String(kurzor.getDate()).padStart(2, '0')}`;
        const { obsazeno, celkem } = this.getDayOccupancy(dStr, roomIdForCal);
        if (celkem > 0 && obsazeno >= celkem) { prvniPlnyPoPrijezdu = dStr; break; }
      }
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isPast = dayStr < todayStr;

      // Dvě různé věci naráz, proto dva dotazy:
      //   ČERVENÁ  — vybraný pokoj (nebo celý hotel) je ten den zabraný,
      //   ORANŽOVÁ — vybraný pokoj volný, ale někde v hotelu už rezervace je.
      // Oranžová je záměrně i u konkrétního pokoje: host má vidět, že se
      // hotel plní, jinak mu celý měsíc svítí zeleně a termín nespěchá.
      // Do 2. 9. 2026 se počítal jen vybraný pokoj, takže oranžová z výběru
      // jednoho pokoje zmizela úplně. Ruční zápis v administraci to takhle
      // dělal odjakživa (`obsazenostDne`), tohle je návrat k témuž pravidlu.
      const vybraný = this.getDayOccupancy(dayStr, roomIdForCal);
      const hotel = jedenPokoj ? this.getDayOccupancy(dayStr, 'all') : vybraný;
      const obsazeno = hotel.obsazeno;
      const celkem = hotel.celkem;
      const jePlne = vybraný.celkem > 0 && vybraný.obsazeno >= vybraný.celkem;
      const jeCastecne = !jePlne && obsazeno > 0 && obsazeno < celkem;

      const isFrom = dayStr === effectiveFrom;
      const isTo = dayStr === effectiveTo;
      const isInRange = effectiveFrom && effectiveTo && dayStr > effectiveFrom && dayStr < effectiveTo;

      // Plně obsazený den jde zvolit jako den ODJEZDU. Odjezdem se totiž
      // nocuje naposledy předchozí noc — date_to je výlučné, takže na sám
      // den odjezdu už pokoj nikdo neblokuje. Bez tohohle nešlo odjet
      // v první den uzávěrky a na okraji každé blokace padala rezervace.
      // Pobyt musí mít aspoň dvě noci (hasValidDates), takže odjezd hned
      // druhý den by stejně neprošel a nemá cenu ho nabízet.
      const dostNoci = this.state.tempDateFrom
        ? (new Date(dayStr) - new Date(this.state.tempDateFrom)) / 86400000 >= 2
        : false;
      const lzeJakoOdjezd = !isPast && jePlne && dayStr === prvniPlnyPoPrijezdu && dostNoci;

      const pulky = isPast ? { dopoledne: 0, odpoledne: 0 } : this.obsazenostPulekDne(dayStr, roomIdForCal);
      // Půlí se jen tehdy, když je druhá polovina dne opravdu prázdná.
      const { prijezdovy: jePrijezdovy, odjezdovy: jeOdjezdovy } = pulkyDne(pulky);
      // Vybraný termín má přednost před obsazeností hotelu. Host si potřebuje
      // přečíst, co si vybral; půlka v barvě obsazenosti mu přes vlastní
      // příjezd přemalovala zelenou na oranžovou a vypadalo to, že den
      // vybraný není.
      const jeVybrany = isFrom || isTo || isInRange;

      let dayClass = 'cal-day';
      if (isPast) dayClass += ' is-disabled';
      // Minulý den nedostává barvu obsazenosti. Kdo se dívá na srpen 18. srpna,
      // nemá řešit, jestli bylo 10. plno — a růžová v minulosti vypadala jako
      // porouchané vykreslení, ne jako „tenhle den už je pryč".
      if (!isPast) {
        if (jePlne) dayClass += ' is-full';
        else if (jeCastecne) dayClass += ' is-partial';
      }
      if (lzeJakoOdjezd) dayClass += ' je-jen-odjezd';
      if (!isPast && !jeVybrany && jeOdjezdovy) dayClass += ' is-turnover-day';
      if (!isPast && !jeVybrany && jePrijezdovy) dayClass += ' is-arrival-day';
      if (isFrom) dayClass += ' is-from is-selected';
      if (isTo) dayClass += ' is-to is-selected';
      if (isInRange) dayClass += ' in-range';
      // 31. 12. se odliší i bez výběru — host tak v kalendáři rovnou vidí,
      // kde Silvestr leží, a nemusí ho dopočítávat z čísel.
      if (!isPast && jeSilvestr(dayStr)) dayClass += ' je-silvestr';

      const isDisabled = isPast || (jePlne && !lzeJakoOdjezd);

      let tooltipText = '';
      if (isPast) {
        tooltipText = 'Tento den už je za námi';
      } else if (lzeJakoOdjezd) {
        tooltipText = `${jedenPokoj ? 'Pokoj je obsazený' : 'Plně obsazeno'} — jde zvolit už jen jako den odjezdu`;
      } else if (jeOdjezdovy) {
        tooltipText = `Do 10:00 se odjíždí, potom je volno${jeCastecne ? ` (obsazeno ${obsazeno} z ${celkem})` : ''}`;
      } else if (jePrijezdovy) {
        tooltipText = `Do 15:00 je ještě volno, potom se přijíždí${jeCastecne ? ` (obsazeno ${obsazeno} z ${celkem})` : ''}`;
      } else if (jeCastecne) {
        tooltipText = jedenPokoj
          ? `Tento pokoj je volný — v hotelu je obsazeno ${obsazeno} z ${celkem} pokojů`
          : `Volno máme, obsazeno je ${obsazeno} z ${celkem} pokojů`;
      } else if (jePlne) {
        tooltipText = jedenPokoj ? 'Tento den je pokoj obsazený' : 'Tento den je hotel plně obsazený';
      } else if (isFrom) {
        tooltipText = 'Váš příjezd — ubytování od 15:00';
      } else if (isTo) {
        tooltipText = 'Váš odjezd — pokoj opouštíte do 10:00';
      } else {
        tooltipText = 'Volný den, příjezd možný od 15:00';
      }
      if (jeSilvestr(dayStr) && !isPast) tooltipText = `Silvestr — ${tooltipText.charAt(0).toLowerCase()}${tooltipText.slice(1)}`;

      daysHtml += `
        <button type="button" class="${dayClass}" data-date="${dayStr}" ${isDisabled ? 'disabled' : ''} title="${tooltipText}">
          ${day}
        </button>
      `;
    }

    // Minimum se řídí dnem příjezdu — přes svátky tři noci, jinak dvě.
    const minNoci = this.minimumNociProVyber(effectiveFrom);

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
          <div class="cal-modal-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <span class="cal-month-title">${monthNames[month - 1]} ${year}</span>
              <span class="cal-pokoj-popis" style="font-size: 12.5px; color: #6b6b60; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${jedenPokoj ? `Obsazenost: <strong>${pokojKalendare.name}</strong>` : 'Obsazenost celého hotelu'}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-cal-nav cal-nav-btn${jeNejstarsiMesic ? ' je-nedostupne' : ''}" id="cal-prev-month"
                ${jeNejstarsiMesic ? 'disabled aria-disabled="true"' : ''}
                title="${jeNejstarsiMesic ? 'Dřívější měsíce už rezervovat nejde' : 'Předchozí měsíc'}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-nav cal-nav-btn" id="cal-next-month" title="Následující měsíc">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
              <button type="button" class="btn btn-cal-reset" id="cal-reset-btn" style="font-size: 13px; font-weight: 600; color: #4A5A24; background: none; border: none; cursor: pointer; padding: 4px 8px; margin-left: 4px; text-decoration: underline;">
                Vynulovat výběr
              </button>
              <button type="button" class="btn btn-cal-close cal-close-btn" id="cal-close-btn" title="Zavřít kalendář">
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

          ${mesicZasahujeMimoProvoz(year, month) || mesicZasahujeSvatky(year, month) ? `
            <div class="cal-poznamky">
              ${this.renderMimoProvozNote(year, month)}
              ${mesicZasahujeSvatky(year, month) ? `
                <div class="booking-poznamka je-svatky">
                  <span class="booking-poznamka-ikona" aria-hidden="true">❄</span>
                  <span class="booking-poznamka-text">
                    Přes svátky (<strong>${popisRozsahu(SVATKY)}</strong>) přijímáme pobyty
                    nejméně na <strong>${popisNoci(SVATKY.minNoci)}</strong>.
                  </span>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="cal-modal-footer" style="padding: 16px; border-top: 1px solid #E7E5DC; display: flex; flex-direction: column; gap: 12px;">
            <div class="cal-legend" style="display:flex; flex-wrap:wrap; gap:14px; padding:4px 0 10px 0; border-bottom:1px solid #E7E5DC; margin-bottom:4px;">
              <span class="cal-legend-item">
                <i class="cal-legend-box" style="background:var(--kal-volno);"></i>
                Volno
              </span>
              <span class="cal-legend-item">
                <i class="cal-legend-box" style="background:var(--kal-vybrano);"></i>
                Váš termín
              </span>
              <span class="cal-legend-item">
                <i class="cal-legend-box" style="background:var(--kal-plno);"></i>
                ${jedenPokoj ? 'Pokoj obsazený' : 'Obsazeno'}
              </span>
              <span class="cal-legend-item">
                <i class="cal-legend-box" style="background:var(--kal-castecne);"></i>
                Částečně obsazeno
              </span>
              <span class="cal-legend-item">
                <i class="cal-legend-box je-pulka"></i>
                Odjezd do 10:00, příjezd od 15:00
              </span>
            </div>
            ${effectiveFrom && effectiveTo ? `
              <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
                <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #1C1C19;">
                  Příjezd: ${formatCzechDateStr(effectiveFrom)} &nbsp;|&nbsp; Odjezd: ${formatCzechDateStr(effectiveTo)}
                </span>
                ${tempNights < minNoci ? `
                  <span class="cal-summary-sub" style="font-size: 13.5px; color: #B45309; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; margin-top: 3px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    ${minNoci > 2
                      ? `Přes svátky (${popisRozsahu(SVATKY)}) přijímáme pobyty nejméně na ${popisNoci(minNoci)}. Zvolte prosím pozdější datum odjezdu.`
                      : `Minimální délka pobytu jsou ${popisNoci(minNoci)}. Prosíme zvolte pozdější datum odjezdu.`}
                  </span>
                ` : `
                  <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
                    Celková délka pobytu: <strong>${tempNights} ${tempNights < 5 ? 'noci' : 'nocí'}</strong>
                  </span>
                `}
              </div>
              <button type="button" class="btn btn-confirm-cal-dates" id="cal-confirm-dates-btn" ${tempNights < minNoci ? 'disabled' : ''} style="height: 42px; padding: 0 24px; font-size: 15px; font-weight: 600; color: ${tempNights < minNoci ? '#999990' : '#FFFFFF'}; background-color: ${tempNights < minNoci ? '#E7E5DC' : '#4A5A24'}; border: none; border-radius: 2px; cursor: ${tempNights < minNoci ? 'not-allowed' : 'pointer'}; width: 100%; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s ease;">
                ${tempNights < minNoci ? `Potvrdit termín (min. ${popisNoci(minNoci)})` : 'Potvrdit termín pobytu'}
              </button>
            ` : (effectiveFrom ? `
              <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
                <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #4A5A24;">
                  Příjezd: ${formatCzechDateStr(effectiveFrom)}
                </span>
                <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
                  Nyní klikněte v kalendáři na datum odjezdu (odjezd nejdřív po ${popisNoci(minNoci)})
                </span>
              </div>
            ` : `
              <div class="cal-range-summary" style="display: flex; flex-direction: column; gap: 2px;">
                <span class="cal-summary-label" style="font-size: 14px; font-weight: 700; color: #1C1C19;">
                  Žádný termín není vybraný
                </span>
                <span class="cal-summary-sub" style="font-size: 13px; color: #666660; font-weight: 500;">
                  Klikněte v kalendáři na datum příjezdu, nebo uložte prázdný výběr.
                </span>
              </div>
              <button type="button" class="btn btn-confirm-cal-dates" id="cal-confirm-dates-btn" style="height: 42px; padding: 0 24px; font-size: 15px; font-weight: 600; color: #FFFFFF; background-color: #4A5A24; border: none; border-radius: 2px; cursor: pointer; width: 100%; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s ease;">
                Uložit a zavřít
              </button>
            `)}
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
              <span class="terms-row-title">Nejkratší možný pobyt</span>
              <div class="terms-row-desc">
                <p>Rezervovat lze pobyt na <strong>minimálně 2 noci</strong>. Kratší pobyty hotel nepřijímá.
                Přes svátky (<strong>${popisRozsahu(SVATKY)}</strong>) je nejkratší pobyt <strong>${popisNoci(SVATKY.minNoci)}</strong>.</p>
                <p class="terms-sub-note">Za samostatné obsazení pokoje jedním hostem se nic navíc nepřipočítává — je už zahrnuté v ceně za jednu osobu.</p>
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

      // Nabídka v rozbalovacím seznamu počítá s tolika osobami,
      // kolik se na daný pokoj vejde — jinak by u menších pokojů
      // svítila cena za počet lidí, který tam nejde ubytovat.
      const osobNaPokoj = Math.min(this.state.adults, this.maxOsobProPokoj(r));

      const roomPricing = calculateReservationPrice({
        roomType: r.type,
        roomId: r.id,
        nights,
        persons: osobNaPokoj,
        adults: osobNaPokoj,
        children: 0,
        dateFrom: this.state.dateFrom,
        dateTo: this.state.dateTo,
        hasDog: this.state.hasDog,
        hasEbike: this.state.hasEbike,
        ebikeCount: this.state.ebikeCount,
        hasHalfBoard: this.state.hasHalfBoard,
        halfBoardCount: this.state.halfBoardCount,
        cenik: this.cenik,
        nastaveni: this.cenik && this.cenik.nastaveni,
        discountObj: this.appliedDiscount,
      });

      return {
        room: r,
        isAvailable,
        isOccupied,
        isDisabled,
        maxOsob: this.maxOsobProPokoj(r),
        maloMista: this.maxOsobProPokoj(r) < this.state.adults,
        pricing: roomPricing
      };
    });

    return `
      <div class="booking-step-content">
        <div class="booking-grid">
          <div class="booking-left-col">
            
            <!-- 1. TERMÍN POBYTU (SJEDNOCENÉ TLAČÍTKO PRO CELÝ TERMÍN POBYTU) -->
            <div class="booking-card card-step-1">
              <h3 class="card-title">1. Termín pobytu <span class="required-badge">* Povinné</span></h3>
              
              <div class="form-field">
                <label for="date-range-btn" class="form-label">Vybraný termín pobytu (Příjezd od 15:00 & Odjezd do 10:00):</label>
                <button type="button" id="date-range-btn" class="custom-date-btn unified-date-range-btn">
                  <div class="date-range-btn-inner">
                    <svg class="custom-date-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#697947" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <div class="date-range-text-group">
                      ${this.state.dateFrom && this.state.dateTo ? `
                        <span class="date-range-main">${formattedFrom} – ${formattedTo}</span>
                        <span class="date-range-nights-pill">${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</span>
                      ` : `
                        <span class="date-range-main" style="color: #888880;">Vyberte termín pobytu</span>
                      `}
                    </div>
                  </div>
                  <span class="date-range-action-text"><span class="action-text-full">Změnit termín v kalendáři</span><span class="action-text-short">Změnit</span> &rarr;</span>
                </button>
              </div>
              
              ${this.renderSvatkyNote()}
              ${this.renderSilvestrNote()}
              ${this.renderOmezenaDostupnostNote()}

              <div class="terms-card-bottom-row" style="margin-top: 14px;">
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

              <div class="custom-room-dropdown ${this.hasValidDates() ? '' : 'is-locked'} ${this.state.isCustomDropdownOpen ? 'is-open' : ''}" id="custom-room-dropdown">
                <label for="custom-dropdown-trigger" class="form-label">${this.hasValidDates() ? 'Vyberte si pokoj ze seznamu:' : 'Nejprve zvolte termín pobytu ↑'}</label>
                
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
                        <span class="trigger-price-text">${isDisabledSelected ? '' : `${formatCzechPrice(pricing.totalPrice)} za ${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}`}</span>
                      </div>
                    </div>
                  ` : `
                    <span class="trigger-placeholder">${this.hasValidDates() ? '-- Vyberte si pokoj pro tento termín --' : '-- Nejprve zvolte termín pobytu --'}</span>
                  `}
                  <span class="trigger-chevron">${this.state.isCustomDropdownOpen ? '▲' : '▼'}</span>
                </button>

                <div class="dropdown-options-panel ${this.state.isCustomDropdownOpen ? 'is-visible' : ''}" role="listbox" id="custom-dropdown-options">
                  <div class="dropdown-panel-header">
                    <span>${this.hasValidDates() ? `Dostupnost pokojů pro termín ${formattedFrom} – ${formattedTo}` : 'Nejprve zvolte termín pobytu v kalendáři'}</span>
                  </div>
                  <div class="dropdown-options-list">
                    ${roomItems.map(item => {
                      const r = item.room;
                      const p = item.pricing;
                      const isSelected = r.id === (room ? room.id : '');
                      const isAvailable = item.isAvailable;
                      const statusClass = isAvailable ? 'status-available' : (item.isDisabled ? 'status-blocked' : 'status-occupied');
                      const statusDotClass = isAvailable ? 'dot-available' : (item.isDisabled ? 'dot-blocked' : 'dot-occupied');
                      const statusBadgeText = isAvailable ? 'Volno' : (item.isDisabled ? 'Nedostupné' : 'Obsazeno v tomto termínu');
                      
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
                              ${item.isDisabled ? '' : `<span class="option-price-tag">${formatCzechPrice(p.totalPrice)} <small>/ ${nights} ${nights === 1 ? 'noc' : (nights < 5 ? 'noci' : 'nocí')}</small></span>`}
                              ${item.isDisabled ? '' : `<span class="option-capacity-tag">${this.popisLuzek(r)}</span>`}
                            </div>
                            ${item.maloMista ? `
                              <div class="option-capacity-warning">Pojme nejvýš ${item.maxOsob} ${item.maxOsob === 1 ? 'osobu' : 'osoby'} — pro ${this.state.adults} osoby nestačí.</div>
                            ` : ''}
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
              ${this.hasValidDates() ? '' : '<div class="room-select-hint">Jakmile zvolíte termín, ukážeme vám pouze pokoje, které jsou v tomto termínu volné.</div>'}

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
                    <p class="preview-desc">Kapacita: až ${this.maxOsobProPokoj(room)} ${this.maxOsobProPokoj(room) < 5 ? 'osoby' : 'osob'} • Včetně bufetové snídaně a Wi-Fi zdarma</p>
                  </div>
                  <button type="button" class="btn btn-view-room-details ${this.state.isRoomGalleryOpen ? 'is-open' : ''}"
                          id="btn-view-room-details" data-room-id="${room.id}"
                          aria-expanded="${this.state.isRoomGalleryOpen ? 'true' : 'false'}" aria-controls="room-gallery-panel">
                    <span>${this.state.isRoomGalleryOpen ? 'Skrýt fotky pokoje' : 'Zobrazit fotky pokoje'}</span>
                    <svg class="btn-room-gallery-arrow" width="12" height="7" viewBox="0 0 12 7" fill="none" aria-hidden="true">
                      <path d="M1 1L6 6L11 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>

                ${this.state.isRoomGalleryOpen ? this.renderRoomGallery(room) : ''}
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
                    <button type="button" class="btn-counter btn-counter-plus" data-target="adults" ${room && (this.state.adults || 2) >= this.maxOsobProPokoj(room) ? 'disabled' : ''}>+</button>
                  </div>
                </div>
              </div>
              ${room ? `
                <!-- Bez téhle věty tlačítko „+“ jen přestalo reagovat a host nevěděl proč. -->
                <p class="guest-capacity-note ${(this.state.adults || 2) >= this.maxOsobProPokoj(room) ? 'is-at-limit' : ''}">
                  ${(this.state.adults || 2) >= this.maxOsobProPokoj(room)
                    ? `Víc osob sem ubytovat nejde — <strong>${room.name}</strong> má ${this.popisLuzek(room)}, tedy nejvýš ${this.maxOsobProPokoj(room)} ${this.maxOsobProPokoj(room) === 1 ? 'osobu' : 'osoby'}. Pro větší skupinu zvolte jiný pokoj, nebo si jich rezervujte víc.`
                    : `${room.name} má ${this.popisLuzek(room)} — ubytovat se sem může nejvýš ${this.maxOsobProPokoj(room)} ${this.maxOsobProPokoj(room) === 1 ? 'osoba' : 'osoby'}.`}
                </p>
              ` : ''}
            </div>

            <!-- 4. DOPLŇKOVÉ SLUŽBY -->
            <div class="booking-card">
              <h3 class="card-title">4. Doplňkové služby <span class="optional-badge">Volitelné</span></h3>
              <div class="checkbox-addons-list">
                <div class="checkbox-addon-group">
                  <label class="checkbox-addon-item">
                    <input type="checkbox" id="addon-halfboard" ${this.state.hasHalfBoard ? 'checked' : ''}>
                    <span class="addon-text">
                      <strong>Dokoupit polopenzi</strong> (+${this.castka('polopenze')} Kč / osoba / noc)
                      <small>Poctivá teplá večeře podávaná v hotelové restauraci bez možnosti výběru.</small>
                    </span>
                  </label>
                  ${this.state.hasHalfBoard ? `
                    <div class="addon-subcontrols">
                      <span class="subcontrol-label">Počet osob s polopenzí:</span>
                      <div class="counter-controls">
                        <button type="button" class="btn-counter btn-counter-minus" data-target="halfBoardCount">-</button>
                        <span class="counter-value">${pricing.halfBoardCount || this.state.halfBoardCount || this.state.adults || 1}</span>
                        <button type="button" class="btn-counter btn-counter-plus" data-target="halfBoardCount">+</button>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <label class="checkbox-addon-item">
                  <input type="checkbox" id="addon-dog" ${this.state.hasDog ? 'checked' : ''}>
                  <span class="addon-text">
                    <strong>Pobyt s pejskem</strong> (+${this.castka('pes')} Kč / noc pro celý pokoj)
                    <small>⚠️ Pouze po předchozí domluvě s recepcí. Uveďte prosím rasu a velikost pejska do poznámky v 2. kroku rezervace.</small>
                  </span>
                </label>

                <div class="checkbox-addon-group">
                  <label class="checkbox-addon-item">
                    <input type="checkbox" id="addon-ebike" ${this.state.hasEbike ? 'checked' : ''}>
                    <span class="addon-text">
                      <strong>Nabíjení elektrokola</strong> (+${this.castka('elektrokolo')} Kč / den / ks)
                      <small>Bezpečná úschovna a dobíjecí stanice v areálu.</small>
                    </span>
                  </label>
                  ${this.state.hasEbike ? `
                    <div class="addon-subcontrols">
                      <span class="subcontrol-label">Počet elektrokol:</span>
                      <div class="counter-controls">
                        <button type="button" class="btn-counter btn-counter-minus" data-target="ebikeCount">-</button>
                        <span class="counter-value">${pricing.ebikeCount || this.state.ebikeCount || 1}</span>
                        <button type="button" class="btn-counter btn-counter-plus" data-target="ebikeCount">+</button>
                      </div>
                    </div>
                  ` : ''}
                </div>

                ${pricing.isWinterSeason ? `
                  <div class="checkbox-addon-group">
                    <label class="checkbox-addon-item">
                      <input type="checkbox" id="addon-winter-parking" ${this.state.hasWinterParking ? 'checked' : ''}>
                      <span class="addon-text">
                        <strong>Zimní parkování u hotelu</strong> (+${this.castka('zimni_parkovani')} Kč / auto, jednorázově za pobyt)
                        <small>Jednorázový poplatek bez ohledu na délku pobytu. Příspěvek na pravidelnou zimní údržbu, odhrnování sněhu a údržbu příjezdové dráhy v zimním období (1. 11. – 15. 4.). V létě je parkování u hotelu zdarma.</small>
                      </span>
                    </label>
                    ${this.state.hasWinterParking ? `
                      <div class="addon-subcontrols">
                        <span class="subcontrol-label">Počet aut:</span>
                        <div class="counter-controls">
                          <button type="button" class="btn-counter btn-counter-minus" data-target="parkingCarsCount">-</button>
                          <span class="counter-value">${pricing.parkingCarsCount || this.state.parkingCarsCount || 1}</span>
                          <button type="button" class="btn-counter btn-counter-plus" data-target="parkingCarsCount">+</button>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
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
                    ${this.state.dateFrom && this.state.dateTo ? `
                      <span class="recap-clean-val"><strong>${formattedFrom} – ${formattedTo}</strong></span>
                      <span class="recap-sub-val">(${nights} ${nights === 1 ? 'noc' : (nights >= 2 && nights <= 4 ? 'noci' : 'nocí')}${pricing.nightBreakdownLabel ? ` • ${pricing.nightBreakdownLabel}` : ''})</span>
                    ` : `
                      <span class="recap-clean-val"><strong style="color: #888880;">nevybrán</strong></span>
                    `}
                  </div>
                </div>

                <div class="recap-clean-item">
                  <span class="recap-clean-label">Počet hostů:</span>
                  <span class="recap-clean-val"><strong>${this.state.adults} ${this.state.adults === 1 ? 'osoba' : (this.state.adults < 5 ? 'osoby' : 'osob')}</strong></span>
                </div>
              </div>

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

              <!-- ROZPIS CENY: ubytování + doplňky + sleva pod sebou, ať si host umí sám sečíst celkovou částku -->
              ${((room && this.state.dateFrom && this.state.dateTo) || pricing.hasHalfBoard || pricing.hasDog || pricing.hasEbike || pricing.hasWinterParking || pricing.soloPriplatekCelkem > 0 || pricing.discountAmount > 0) ? `
                <div class="summary-total-divider"></div>
                <div class="summary-rows">
                  ${room && this.state.dateFrom && this.state.dateTo ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Ubytování se snídaní</span>
                        <span class="row-details">(${pricing.totalGuests}x os, ${nights}x noc)</span>
                      </div>
                      <span class="row-price">${pricing.formattedUbytovaniBezPriplatku}</span>
                    </div>
                  ` : ''}

                  ${pricing.soloPriplatekCelkem > 0 ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Příplatek za jednu osobu na pokoji</span>
                        <span class="row-details">(+${pricing.soloPriplatekZaNoc} Kč/noc • ${nights}x noc)</span>
                      </div>
                      <span class="row-price">+${pricing.formattedSoloPriplatekCelkem}</span>
                    </div>
                  ` : ''}

                  ${pricing.hasHalfBoard ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Dokoupená polopenze</span>
                        <span class="row-details">(+${this.castka('polopenze')} Kč/os/noc • ${pricing.halfBoardCount}x os, ${nights}x noc)</span>
                      </div>
                      <span class="row-price">+${pricing.halfBoardPriceTotal} Kč</span>
                    </div>
                  ` : ''}

                  ${pricing.hasDog ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Pobyt s pejskem</span>
                        <span class="row-details">(+${this.castka('pes')} Kč/noc za pokoj • ${nights}x noc)</span>
                      </div>
                      <span class="row-price">+${pricing.dogPriceTotal} Kč</span>
                    </div>
                  ` : ''}

                  ${pricing.hasEbike ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Nabíjení elektrokola</span>
                        <span class="row-details">(+${this.castka('elektrokolo')} Kč/den • ${pricing.ebikeCount}x ks, ${nights}x noc)</span>
                      </div>
                      <span class="row-price">+${pricing.ebikePriceTotal} Kč</span>
                    </div>
                  ` : ''}

                  ${pricing.hasWinterParking ? `
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Zimní parkování u hotelu</span>
                        <span class="row-details">(+${this.castka('zimni_parkovani')} Kč za auto a pobyt • ${pricing.parkingCarsCount}x auto)</span>
                      </div>
                      <span class="row-price">+${pricing.winterParkingPriceTotal} Kč</span>
                    </div>
                  ` : ''}

                  ${pricing.discountAmount > 0 ? `
                    <div class="summary-row" style="color: #2e7d32; font-weight: 700;">
                      <div class="row-info">
                        <span class="row-label">✓ ${pricing.discountLabel}</span>
                      </div>
                      <span class="row-price">-${pricing.formattedDiscountAmount}</span>
                    </div>
                  ` : ''}
                </div>
              ` : ''}

              <div class="summary-total-divider"></div>

              <div class="summary-total-row">
                <span>Celková cena pobytu s DPH:</span>
                <span class="total-price-amount">${formatCzechPrice(pricing.totalPrice)}</span>
              </div>

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
                    <small class="deposit-clean-sub">(${pricing.depositPercentage} % záloha z celkové ceny pobytu)</small>
                  </div>
                  <span class="deposit-clean-amount">${formatCzechPrice(pricing.depositPriceTotal)}</span>
                </div>

                <div class="deposit-clean-row remaining-deposit">
                  <div class="deposit-clean-info">
                    <span class="deposit-clean-title">2. Doplatek při příjezdu</span>
                    <small class="deposit-clean-sub">(${100 - pricing.depositPercentage} % doplatek na místě na recepci)</small>
                  </div>
                  <span class="deposit-clean-amount">${formatCzechPrice(pricing.remainingPriceTotal)}</span>
                </div>
              </div>

              <div class="summary-perks">
                <span>✓ Snídaně formou bufetu v ceně</span>
                <span>${pricing.isWinterSeason ? (pricing.hasWinterParking ? '✓ Zimní údržba & parkování v ceně' : '✓ Parkování u hotelu (v zimě s údržbou)') : '✓ Parkování u hotelu ZDARMA'}</span>
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

                <div class="form-field ${this.state.fieldErrors['guest-note'] ? 'has-error' : ''}">
                  <label for="guest-note" class="form-label">
                    Poznámka / Speciální přání pro celý pobyt
                    ${this.state.hasDog
                      ? '<span class="required-badge">* Povinné</span>'
                      : '<span class="optional-tag">(Volitelné / Nepovinné)</span>'}
                  </label>
                  ${this.state.hasDog ? `
                    <div style="background: #fff8e1; border: 1px solid #ffe082; padding: 10px 14px; border-radius: 2px; margin-bottom: 10px; font-size: 13.5px; color: #5d4037; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                      <span>🐶</span> <span><strong>Pobyt s pejskem:</strong> Napište nám prosím do poznámky rasu a velikost pejska pro schválení recepcí.</span>
                    </div>
                  ` : ''}
                  <textarea id="guest-note" class="form-textarea" rows="3" placeholder="${this.state.hasDog ? 'Doplňte prosím rasu a velikost pejska, případně předpokládaný čas příjezdu...' : 'Předpokládaný čas příjezdu, dieta či jiná přání...'}">${this.state.guestNote || ''}</textarea>
                  ${this.state.fieldErrors['guest-note'] ? `
                    <div class="field-error-popover">
                      <span class="popover-arrow"></span>
                      <span class="popover-icon">⚠️</span>
                      <span>${this.state.fieldErrors['guest-note']}</span>
                    </div>
                  ` : ''}
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

                <div class="summary-total-divider"></div>
                <div class="summary-rows">
                    <div class="summary-row">
                      <div class="row-info">
                        <span class="row-label">Ubytování se snídaní</span>
                        <span class="row-details">(${currentPricing.totalGuests}x os, ${nights}x noc)</span>
                      </div>
                      <span class="row-price">${currentPricing.formattedUbytovaniBezPriplatku}</span>
                    </div>

                    ${currentPricing.soloPriplatekCelkem > 0 ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Příplatek za jednu osobu na pokoji</span>
                          <span class="row-details">(+${currentPricing.soloPriplatekZaNoc} Kč/noc • ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.formattedSoloPriplatekCelkem}</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasHalfBoard ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Dokoupená polopenze</span>
                          <span class="row-details">(+${this.castka('polopenze')} Kč/os/noc • ${currentPricing.halfBoardCount}x os, ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.halfBoardPriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasDog ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Pobyt s pejskem</span>
                          <span class="row-details">(+${this.castka('pes')} Kč/noc za pokoj • ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.dogPriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasEbike ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Nabíjení elektrokola</span>
                          <span class="row-details">(+${this.castka('elektrokolo')} Kč/den • ${currentPricing.ebikeCount}x ks, ${nights}x noc)</span>
                        </div>
                        <span class="row-price">+${currentPricing.ebikePriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.hasWinterParking ? `
                      <div class="summary-row">
                        <div class="row-info">
                          <span class="row-label">Zimní parkování u hotelu</span>
                          <span class="row-details">(+${this.castka('zimni_parkovani')} Kč za auto a pobyt • ${currentPricing.parkingCarsCount}x auto)</span>
                        </div>
                        <span class="row-price">+${currentPricing.winterParkingPriceTotal} Kč</span>
                      </div>
                    ` : ''}

                    ${currentPricing.discountAmount > 0 ? `
                      <div class="summary-row discount-row" style="color: #2e7d32; font-weight: 700;">
                        <div class="row-info">
                          <span class="row-label">✓ ${currentPricing.discountLabel}</span>
                        </div>
                        <span class="row-price">-${currentPricing.formattedDiscountAmount}</span>
                      </div>
                    ` : ''}
                </div>

                <div class="summary-total-divider"></div>

                <div class="summary-total-row">
                  <span>Celková cena pobytu s DPH:</span>
                  <span class="total-price-amount">${formatCzechPrice(currentPricing.totalPrice)}</span>
                </div>

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
                      <small class="deposit-clean-sub">(${currentPricing.depositPercentage} % záloha z celkové ceny pobytu)</small>
                    </div>
                    <span class="deposit-clean-amount">${formatCzechPrice(currentPricing.depositPriceTotal)}</span>
                  </div>

                  <div class="deposit-clean-row remaining-deposit">
                    <div class="deposit-clean-info">
                      <span class="deposit-clean-title">2. Doplatek při příjezdu</span>
                      <small class="deposit-clean-sub">(${100 - currentPricing.depositPercentage} % doplatek na místě na recepci)</small>
                    </div>
                    <span class="deposit-clean-amount">${formatCzechPrice(currentPricing.remainingPriceTotal)}</span>
                  </div>
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
                    <h3 style="margin: 4px 0 6px; font-size: clamp(17px, 1.7vw, 20px); font-weight: 700; color: #1C1C19;">Výzva k úhradě ${pricing.depositPercentage}% zálohy</h3>
                    <p style="margin: 0; color: #55554E; font-size: 14.5px; line-height: 1.5;">
                      Jakmile termín schválíme, zašleme vám e-mail s pokyny k úhradě ${pricing.depositPercentage}% zálohy (<strong style="color: #1C1C19;">${formatCzechPrice(pricing.depositPriceTotal)}</strong>) s QR kódem.
                    </p>
                  </div>
                </li>

                <li style="display: grid; grid-template-columns: 44px 1fr; gap: 18px; padding: 20px 0; border-top: 1px solid #EFEEE7;">
                  <span style="width: 44px; height: 44px; border-radius: 50%; background: #EDF2E4; color: #697947; display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; flex-shrink: 0;">3</span>
                  <div>
                    <h3 style="margin: 4px 0 6px; font-size: clamp(17px, 1.7vw, 20px); font-weight: 700; color: #1C1C19;">Závazné potvrzení pobytu</h3>
                    <p style="margin: 0; color: #55554E; font-size: 14.5px; line-height: 1.5;">
                      Po přijetí zálohy vám zašleme finální potvrzení. Doplatek ${100 - pricing.depositPercentage} % (<strong style="color: #1C1C19;">${formatCzechPrice(pricing.remainingPriceTotal)}</strong>) zaplatíte na místě při příjezdu.
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
          if (!this.hasValidDates()) {
            this.state.errorMessage = 'Nejprve si prosím zvolte termín pobytu. Podle něj vám ukážeme, které pokoje jsou volné.';
            this.render();
            document.getElementById('date-range-btn')?.focus();
            return;
          }
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
            if (!this.hasValidDates()) {
              this.state.errorMessage = 'Nejprve si prosím zvolte termín pobytu. Podle něj vám ukážeme, které pokoje jsou volné.';
              this.render();
              document.getElementById('date-range-btn')?.focus();
              return;
            }
            if (optionEl.classList.contains('is-disabled')) return;
            const roomId = optionEl.dataset.roomId;
            if (roomId) {
              this.state.selectedRoomId = roomId;
              this.state.isCustomDropdownOpen = false;
              // Menší pokoj nesmí zůstat s vyšším počtem osob z předchozí volby
              this.osekniPocetOsobNaKapacitu();
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

      const openCalModal = () => {
        this.state.tempDateFrom = this.state.dateFrom;
        this.state.tempDateTo = this.state.dateTo;
        this.state.selectingStep = 1;
        this.state.showCalendarModal = true;
        // Při novém otevření kalendáře se upozornění ukáže znovu — skrytí
        // platí jen do zavření, ne natrvalo.
        this.state.mimoSezonuSkryto = false;
        const [y, m] = (this.state.dateFrom || getTodayDateString()).split('-').map(Number);
        this.state.calYearMonth = { year: y, month: m };
        this.render();
      };

      const btnDateRange = document.getElementById('date-range-btn');
      if (btnDateRange) {
        btnDateRange.addEventListener('click', (e) => {
          e.preventDefault();
          openCalModal();
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
          if (!this.getSelectedRoom()) return;
          this.state.isRoomGalleryOpen = !this.state.isRoomGalleryOpen;
          this.render();
        });
      }

      // Odkaz na podrobnosti — hosta pustíme na stránku Ubytování až tady,
      // ne už při zobrazení fotek.
      const btnDetail = this.container.querySelector('.btn-room-detail-odkaz');
      if (btnDetail) {
        btnDetail.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.href = '/ubytovani';
        });
      }

      this.bindRoomGallery();

      this.container.querySelectorAll('.btn-counter').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const target = btn.dataset.target;
          const isPlus = btn.classList.contains('btn-counter-plus');
          if (target === 'adults') {
            // Strop dává vybraný pokoj — stálá lůžka plus přistýlky.
            const maxOsob = this.maxOsobProPokoj(this.getSelectedRoom());
            this.state.adults = isPlus
              ? Math.min(maxOsob, this.state.adults + 1)
              : Math.max(1, this.state.adults - 1);
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
          } else if (target === 'parkingCarsCount') {
            const currentCars = this.state.parkingCarsCount || 1;
            this.state.parkingCarsCount = isPlus ? Math.min(5, currentCars + 1) : Math.max(1, currentCars - 1);
          }
          this.render();
        });
      });

      const addonHalfBoard = document.getElementById('addon-halfboard');
      const addonDog = document.getElementById('addon-dog');
      const addonEbike = document.getElementById('addon-ebike');
      const addonWinterParking = document.getElementById('addon-winter-parking');

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
      if (addonWinterParking) {
        addonWinterParking.addEventListener('change', (e) => {
          this.state.hasWinterParking = e.target.checked;
          if (this.state.hasWinterParking && !this.state.parkingCarsCount) {
            this.state.parkingCarsCount = 1;
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
          if (!this.state.dateFrom || !this.state.dateTo) {
            this.state.errorMessage = 'Prosíme, vyberte nejprve termín pobytu.';
            this.render();
            this.scrollToErrorMessage();
            return;
          }
          if (!this.state.selectedRoomId) {
            this.state.errorMessage = 'Prosíme, vyberte si nejprve pokoj v rozevírací nabídce v bodu 2.';
            this.render();
            this.scrollToErrorMessage();
            return;
          }
          const start = new Date(this.state.dateFrom);
          const end = new Date(this.state.dateTo);
          const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
          if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
            this.state.errorMessage = 'Prosíme, vyberte platný termín pobytu (Datum odjezdu musí být po datu příjezdu).';
            this.render();
            this.scrollToErrorMessage();
            return;
          }
          const minNociOdeslani = this.minimumNociProVyber(this.state.dateFrom);
          if (diffDays < minNociOdeslani) {
            this.state.errorMessage = minNociOdeslani > 2
              ? `Přes svátky (${popisRozsahu(SVATKY)}) přijímáme pobyty nejméně na ${popisNoci(minNociOdeslani)}. Prosíme zvolte delší termín pobytu.`
              : `Minimální délka pobytu v Hotelu u Můstku jsou ${popisNoci(minNociOdeslani)}. Prosíme zvolte delší termín pobytu.`;
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

      const noteInput = this.container.querySelector('#guest-note');
      if (noteInput) {
        noteInput.addEventListener('input', (e) => {
          this.state.guestNote = e.target.value;
          if (this.state.fieldErrors && this.state.fieldErrors['guest-note']) {
            delete this.state.fieldErrors['guest-note'];
            const errField = noteInput.closest('.form-field');
            if (errField) {
              errField.classList.remove('has-error');
              const popover = errField.querySelector('.field-error-popover');
              if (popover) popover.remove();
            }
          }
        });
      }

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

    const termsOverlay = document.getElementById('terms-modal-overlay');
    if (termsOverlay) {
      termsOverlay.addEventListener('click', (e) => {
        if (e.target === termsOverlay) {
          termsOverlay.classList.remove('is-open');
        }
      });
    }

    const modalCloseBtns = [
      document.getElementById('btn-close-terms-modal'),
      document.getElementById('btn-close-modal-footer')
    ];
    modalCloseBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener('click', () => {
          if (termsOverlay) termsOverlay.classList.remove('is-open');
        });
      }
    });

    // Skrytí upozornění na mimosezónu. Nepřekresluje se celé okno kvůli
    // jedné věci — prvek se jen odstraní, jinak by kalendář poskočil
    // a odroloval se zpátky nahoru.
    const btnSkryjMimoSezonu = document.getElementById('mimo-sezonu-zavrit');
    if (btnSkryjMimoSezonu) {
      btnSkryjMimoSezonu.addEventListener('click', () => {
        this.state.mimoSezonuSkryto = true;
        const blok = btnSkryjMimoSezonu.closest('.booking-mimo-sezonu');
        if (blok) blok.remove();
      });
    }

    const calOverlay = document.getElementById('cal-modal-overlay');
    if (calOverlay) {
      const closeCal = () => {
        this.state.showCalendarModal = false;
        if (!this.hasValidDates()) {
          this.state.selectedRoomId = '';
          if (this.state.pendingRoomId) {
            this.state.errorMessage = 'Termín jste nezvolili, proto jsme výběr pokoje zrušili. Vyberte prosím nejprve termín pobytu.';
            this.state.pendingRoomId = null;
          }
        } else if (this.state.pendingRoomId) {
          this.state.selectedRoomId = this.state.pendingRoomId;
          this.state.pendingRoomId = null;
        }
        this.render();
      };

      const btnCloseCal = document.getElementById('cal-close-btn');
      if (btnCloseCal) btnCloseCal.addEventListener('click', closeCal);

      const btnResetCal = document.getElementById('cal-reset-btn');
      if (btnResetCal) {
        btnResetCal.addEventListener('click', (e) => {
          e.preventDefault();
          this.state.tempDateFrom = null;
          this.state.tempDateTo = null;
          this.state.selectingStep = 1;
          this.render();
        });
      }

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
          // Zákaz se hlídá i tady, nejen vypnutým tlačítkem — atribut
          // disabled jde v prohlížeči obejít a klávesnice ho obchází taky.
          const [rokDnes, mesicDnes] = getTodayDateString().split('-').map(Number);
          if (year < rokDnes || (year === rokDnes && month < mesicDnes)) return;
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
            const start = new Date(this.state.tempDateFrom);
            const end = new Date(this.state.tempDateTo);
            const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            if (diffDays < 2) return;

            // Kontrola, zda v rozsahu [tempDateFrom, tempDateTo) není plně obsazený den
            let curr = new Date(this.state.tempDateFrom + 'T00:00:00');
            const stopDate = new Date(this.state.tempDateTo + 'T00:00:00');
            let maPlnyDen = false;

            while (curr < stopDate) {
              const y = curr.getFullYear();
              const m = String(curr.getMonth() + 1).padStart(2, '0');
              const d = String(curr.getDate()).padStart(2, '0');
              const dStr = `${y}-${m}-${d}`;

              const { obsazeno, celkem } = this.getDayOccupancy(dStr);
              if (celkem > 0 && obsazeno >= celkem) {
                maPlnyDen = true;
                break;
              }
              curr.setDate(curr.getDate() + 1);
            }

            if (maPlnyDen) {
              this.ukazHlaskuVKalendari('V tomto termínu je den, kdy je hotel plně obsazený. Vyberte prosím jiný termín.');
              return;
            }

            this.state.dateFrom = this.state.tempDateFrom;
            this.state.dateTo = this.state.tempDateTo;
          } else if (!this.state.tempDateFrom && !this.state.tempDateTo) {
            // uživatel vynuloval výběr a potvrdil to
            this.state.dateFrom = null;
            this.state.dateTo = null;
          }
          this.state.showCalendarModal = false;

          if (!this.hasValidDates()) {
            this.state.selectedRoomId = '';
            if (this.state.pendingRoomId) {
              this.state.errorMessage = 'Termín jste nezvolili, proto jsme výběr pokoje zrušili. Vyberte prosím nejprve termín pobytu.';
              this.state.pendingRoomId = null;
            }
          } else {
            if (this.state.pendingRoomId) {
              this.state.selectedRoomId = this.state.pendingRoomId;
              this.state.pendingRoomId = null;
            }
            if (this.state.selectedRoomId) {
              const kolize = this.checkReservationOverlap(
                this.state.selectedRoomId, this.state.dateFrom, this.state.dateTo);
              if (kolize) {
                this.state.selectedRoomId = '';
                this.state.errorMessage = 'V novém termínu už není původně zvolený pokoj volný. Vyberte prosím jiný z nabídky.';
              }
            }
          }

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

          // If a full range was already selected, 3rd click automatically resets and sets new arrival date!
          if (this.state.tempDateFrom && this.state.tempDateTo) {
            this.state.tempDateFrom = selectedDate;
            this.state.tempDateTo = null;
            this.state.selectingStep = 2;
          }
          // Else if picking step 1 or no arrival date set
          else if (this.state.selectingStep === 1 || !this.state.tempDateFrom || selectedDate <= this.state.tempDateFrom) {
            this.state.tempDateFrom = selectedDate;
            this.state.tempDateTo = null;
            this.state.selectingStep = 2;
          }
          // Else picking step 2 (departure)
          else if (this.state.selectingStep === 2 && selectedDate > this.state.tempDateFrom) {
            this.state.tempDateTo = selectedDate;
            this.state.selectingStep = 1;
          }

          this.render();
        });
      });
    }
  }
}
