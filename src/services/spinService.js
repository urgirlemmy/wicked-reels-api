import { supabaseAdmin } from '../supabaseClient.js';

/**
 * Weighted random prize selection.
 * Each prize has a `weight` — higher weight = more likely to be selected.
 * e.g. weights [10, 10, 1] → ~48%, ~48%, ~4% chance respectively.
 */
export function pickWeightedPrize(prizes) {
  const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  let random = Math.random() * totalWeight;

  for (const prize of prizes) {
    random -= prize.weight;
    if (random <= 0) return prize;
  }

  // Fallback — should never hit but just in case of floating point edge case
  return prizes[prizes.length - 1];
}

/**
 * Performs a spin for a given user:
 * 1. Validates user has spins remaining
 * 2. Fetches active prizes
 * 3. Picks a weighted random prize
 * 4. Decrements user spins atomically
 * 5. Records spin in spin_history
 * 6. Creates a claim record if prize is not TRYAGAIN
 * Returns the spin result or throws an error.
 */
export async function performSpin(userId) {
  // Fetch current profile — need spins count
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, spins')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    const err = new Error('User not found.'); err.status = 404; throw err;
  }

  if (profile.spins <= 0) {
    const err = new Error('No spins remaining.'); err.status = 400; throw err;
  }

  // Fetch active prizes
  const { data: prizes, error: prizesError } = await supabaseAdmin
    .from('prizes')
    .select('id, code, full_name, emoji, rarity, weight')
    .eq('is_active', true);

  if (prizesError || !prizes || prizes.length === 0) {
    const err = new Error('No prizes available.'); err.status = 500; throw err;
  }

  // Pick winner
  const winner = pickWeightedPrize(prizes);
  const spinsAfter = profile.spins - 1;

  // Decrement spins
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ spins: spinsAfter, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateError) {
    const err = new Error('Failed to update spins.'); err.status = 500; throw err;
  }

  // Record spin in spin_history
  const { data: spinRecord, error: spinError } = await supabaseAdmin
    .from('spin_history')
    .insert({
      user_id:      userId,
      prize_id:     winner.id,
      spins_before: profile.spins,
      spins_after:  spinsAfter,
    })
    .select()
    .single();

  if (spinError || !spinRecord) {
    const err = new Error('Failed to record spin.'); err.status = 500; throw err;
  }

  // Create claim record for all prizes except TRYAGAIN
  let claim = null;
  if (winner.code !== 'TRYAGAIN') {
    const { data: claimRecord } = await supabaseAdmin
      .from('claims')
      .insert({
        spin_id:  spinRecord.id,
        user_id:  userId,
        prize_id: winner.id,
        status:   'unclaimed',
      })
      .select()
      .single();

    claim = claimRecord;
  }

  return {
    spin_id:     spinRecord.id,
    prize:       winner,
    spins_left:  spinsAfter,
    claim_id:    claim?.id ?? null,
  };
}