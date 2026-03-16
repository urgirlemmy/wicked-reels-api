import { supabaseAdmin } from '../supabaseClient.js';

export async function giveSpins(adminId, targetUserId, amount) {
  // Fetch target user
  const { data: target, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, spins')
    .eq('id', targetUserId)
    .single();

  if (fetchError || !target) {
    const err = new Error('User not found.'); err.status = 404; throw err;
  }

  const newSpins = target.spins + amount;

  // Update spins
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ spins: newSpins, updated_at: new Date().toISOString() })
    .eq('id', targetUserId)
    .select()
    .single();

  if (updateError) {
    const err = new Error('Failed to update spins.'); err.status = 500; throw err;
  }

  // Log action
  await supabaseAdmin.from('admin_log').insert({
    admin_id:    adminId,
    action:      'give_spins',
    target_type: 'user',
    target_id:   targetUserId,
    payload:     { amount, spins_before: target.spins, spins_after: newSpins, username: target.username },
  });

  return updated;
}

export async function markClaimed(adminId, claimId) {
  const { data: claim, error: fetchError } = await supabaseAdmin
    .from('claims')
    .select('id, status, user_id, prize_id')
    .eq('id', claimId)
    .single();

  if (fetchError || !claim) {
    const err = new Error('Claim not found.'); err.status = 404; throw err;
  }

  if (claim.status === 'claimed') {
    const err = new Error('Claim already marked as claimed.'); err.status = 409; throw err;
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('claims')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', claimId)
    .select()
    .single();

  if (updateError) {
    const err = new Error('Failed to update claim.'); err.status = 500; throw err;
  }

  // Log action
  await supabaseAdmin.from('admin_log').insert({
    admin_id:    adminId,
    action:      'mark_claimed',
    target_type: 'claim',
    target_id:   claimId,
    payload:     { user_id: claim.user_id, prize_id: claim.prize_id },
  });

  return updated;
}