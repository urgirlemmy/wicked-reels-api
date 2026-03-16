import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { giveSpinsSchema } from '../schemas/admin.schemas.js';
import { spinHistoryQuerySchema } from '../schemas/spin.schemas.js';
import { giveSpins, markClaimed } from '../services/adminService.js';

export const router = Router();

// All admin routes require auth + admin role
router.use(verifyToken, requireAdmin);

// ── GET /admin/users ──────────────────────────────────────────────────────────
// List all users
router.get('/users', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, spins, is_admin, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }

  return res.json({ users: data });
});

// ── POST /admin/give-spins ────────────────────────────────────────────────────
// Give spins to a user
router.post('/give-spins', validate(giveSpinsSchema), async (req, res) => {
  const { user_id, amount } = req.body;
  const updated = await giveSpins(req.user.id, user_id, amount);
  return res.json({ ok: true, user: updated });
});

// ── GET /admin/claims ─────────────────────────────────────────────────────────
// List all claims with optional status filter
router.get('/claims', validateQuery(spinHistoryQuerySchema), async (req, res) => {
  const { limit, offset } = req.query;
  const { status } = req.query;

  let query = supabaseAdmin
    .from('claims')
    .select(`
      id,
      status,
      claimed_at,
      created_at,
      profiles (id, username),
      prizes (id, code, full_name, emoji)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch claims.' });
  }

  return res.json({ claims: data, total: count, limit, offset });
});

// ── PATCH /admin/claims/:id/claim ─────────────────────────────────────────────
// Mark a claim as claimed
router.patch('/claims/:id/claim', async (req, res) => {
  const updated = await markClaimed(req.user.id, req.params.id);
  return res.json({ ok: true, claim: updated });
});

// ── GET /admin/log ────────────────────────────────────────────────────────────
// Fetch admin activity log
router.get('/log', validateQuery(spinHistoryQuerySchema), async (req, res) => {
  const { limit, offset } = req.query;

  const { data, error, count } = await supabaseAdmin
    .from('admin_log')
    .select(`
      id,
      action,
      target_type,
      target_id,
      payload,
      created_at,
      profiles (id, username)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch admin log.' });
  }

  return res.json({ log: data, total: count, limit, offset });
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────
// Overview stats for the dashboard
router.get('/stats', async (req, res) => {
  const [
    { count: totalUsers },
    { count: totalSpins },
    { count: totalPrizes },
    { count: unclaimedCount },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('spin_history').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('prizes').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabaseAdmin.from('claims').select('*', { count: 'exact', head: true }).eq('status', 'unclaimed'),
  ]);

  // Total spins remaining across all users
  const { data: spinsData } = await supabaseAdmin
    .from('profiles')
    .select('spins');

  const totalSpinsRemaining = spinsData?.reduce((sum, u) => sum + u.spins, 0) ?? 0;

  return res.json({
    stats: {
      total_users:           totalUsers,
      total_spins_performed: totalSpins,
      active_prizes:         totalPrizes,
      unclaimed_prizes:      unclaimedCount,
      total_spins_remaining: totalSpinsRemaining,
    }
  });
});