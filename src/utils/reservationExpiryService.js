// Automated Expiration Engine for Unpaid Reservations (3-day Payment Deadline)
import { isSupabaseConfigured, supabase, getStoredReservations, updateStoredReservationStatus, MOCK_ROOMS } from '../lib/supabaseClient.js';
import { sendEmail, generateEmailPaymentExpired } from './emailService.js';
import { calculateReservationPrice } from './pricing.js';

export const UNPAID_PAYMENT_DEADLINE_MS = 3 * 24 * 60 * 60 * 1000; // 3 dny (72 hodin)

/**
 * Checks all active reservations for expired payment deadlines.
 * Automatically cancels reservations exceeding the 3-day limit and dispatches branded cancellation email.
 * Unblocks calendar dates for new guests.
 */
export async function checkAndProcessExpiredUnpaidReservations() {
  console.log('🔍 [EXPIRY CHECK] Running 3-day unpaid reservation expiration audit...');
  let reservations = [];

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .or('status.eq.awaiting_deposit,status.eq.approved_pending_payment');
      
      if (!error && data) {
        reservations = data;
      }
    } catch (err) {
      console.error('Supabase query error in reservation expiry check:', err);
    }
  }

  if (!reservations.length) {
    const local = getStoredReservations();
    reservations = local.filter(r => r.status === 'awaiting_deposit' || r.status === 'approved_pending_payment');
  }

  const now = Date.now();
  const expiredProcessed = [];

  for (const r of reservations) {
    // Determine timestamp when payment instructions were sent
    const sentTimeStr = r.payment_instructions_sent_at || r.approved_at || r.updated_at || r.created_at;
    const sentTime = sentTimeStr ? new Date(sentTimeStr).getTime() : 0;

    if (!sentTime || isNaN(sentTime)) continue;

    const elapsedMs = now - sentTime;

    if (elapsedMs >= UNPAID_PAYMENT_DEADLINE_MS) {
      console.warn(`⏰ [AUTO-EXPIRATION] Reservation ${r.code} (${r.guest_name}) exceeded 3-day payment deadline. Processing auto-cancellation...`);

      const newStatus = 'cancelled_unpaid';
      const cancelledAt = new Date().toISOString();

      // 1. Update in Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('reservations')
            .update({
              status: newStatus,
              cancellation_reason: 'Vypršení 3denní lhůty pro úhradu zálohy',
              cancelled_at: cancelledAt
            })
            .eq('id', r.id || r.code);
        } catch (dbErr) {
          console.error('Failed to update expired status in Supabase:', dbErr);
        }
      }

      // 2. Update in LocalStorage
      r.status = newStatus;
      r.cancellation_reason = 'Vypršení 3denní lhůty pro úhradu zálohy';
      updateStoredReservationStatus(r.id || r.code, newStatus);

      // 3. Dispatch automated cancellation email to guest
      try {
        const room = MOCK_ROOMS.find(m => m.id === r.room_id) || { id: r.room_id, name: r.room_name || 'Pokoj' };
        const emailObj = generateEmailPaymentExpired({ reservation: r, room });
        
        await sendEmail({
          to: r.guest_email,
          subject: emailObj.subject,
          html: emailObj.html,
          type: 'email_payment_expired',
          reservationCode: r.code
        });
        console.log(`📧 Auto-cancellation email dispatched to ${r.guest_email} for reservation ${r.code}`);
      } catch (emailErr) {
        console.error('Failed to send auto-cancellation email:', emailErr);
      }

      expiredProcessed.push(r);
    }
  }

  if (expiredProcessed.length > 0) {
    console.log(`✅ [AUTO-EXPIRATION COMPLETE] Processed ${expiredProcessed.length} expired reservations.`);
  }

  return expiredProcessed;
}
