import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { verifyToken } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { spinHistoryQuerySchema } from '../schemas/spin.schemas.js';
import { performSpin } from '../services/spinService.js';

export const router = Router();

// ── POST /spins/perform ───────────────────────────────────────────────────────
// Authenticated — perform a spin
router.post('/perform', verifyToken, async (req, res) => {
  const result = await performSpin(req.user.id);
  return res.json(result);
});

// ── GET /spins/history ────────────────────────────────────────────────────────
// Authenticated — get current user's spin history
router.get('/history', verifyToken, validateQuery(spinHistoryQuerySchema), async (req, res) => {
  const { limit, offset } = req.query;

  const { data, error, count } = await supabaseAdmin
    .from('spin_history')
    .select(`
      id,
      spins_before,
      spins_after,
      spun_at,
      prizes (
        id,
        code,
        full_name,
        emoji,
        rarity
      )
    `, { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('spun_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch spin history.' });
  }

  return res.json({
    spins: data,
    total: count,
    limit,
    offset,
  });
});

// ── GET /spins/claims ─────────────────────────────────────────────────────────
// Authenticated — get current user's claims
router.get('/claims', verifyToken, validateQuery(spinHistoryQuerySchema), async (req, res) => {
  const { limit, offset } = req.query;

  const { data, error, count } = await supabaseAdmin
    .from('claims')
    .select(`
      spin_id,
      id,
      status,
      claimed_at,
      created_at,
      prizes (
        id,
        code,
        full_name,
        emoji,
        rarity
      )
    `, { count: 'exact' })
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch claims.' });
  }

  return res.json({
    claims: data,
    total: count,
    limit,
    offset,
  });
});