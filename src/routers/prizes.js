import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { validate } from '../middleware/validate.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';
import { createPrizeSchema, updatePrizeSchema } from '../schemas/prize.schemas.js';

export const router = Router();

// ── GET /prizes ───────────────────────────────────────────────────────────────
// Public — anyone can fetch the active prize pool
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('prizes')
    .select('id, code, full_name, emoji, rarity, weight, is_active')
    .eq('is_active', true)
    .order('weight', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch prizes.' });
  }

  return res.json({ prizes: data });
});

app.get('/test-db', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('prizes')
    .select('count')
    .single();
  res.json({ data, error });
});

// ── GET /prizes/all ───────────────────────────────────────────────────────────
// Admin only — includes inactive prizes
router.get('/all', verifyToken, requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('prizes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch prizes.' });
  }

  return res.json({ prizes: data });
});

// ── POST /prizes ──────────────────────────────────────────────────────────────
// Admin only — create a new prize
router.post('/', verifyToken, requireAdmin, validate(createPrizeSchema), async (req, res) => {
  const { code, full_name, emoji, rarity, weight } = req.body;

  // Check code is not already taken
  const { data: existing } = await supabaseAdmin
    .from('prizes')
    .select('id')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: `Prize code ${code} already exists.` });
  }

  const { data, error } = await supabaseAdmin
    .from('prizes')
    .insert({
      code: code.toUpperCase(),
      full_name,
      emoji,
      rarity,
      weight,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to create prize.' });
  }

  // Log admin action
  await supabaseAdmin.from('admin_log').insert({
    admin_id:    req.user.id,
    action:      'add_prize',
    target_type: 'prize',
    target_id:   data.id,
    payload:     { code, full_name, rarity, weight },
  });

  return res.status(201).json({ prize: data });
});

// ── PATCH /prizes/:id ─────────────────────────────────────────────────────────
// Admin only — update a prize
router.patch('/:id', verifyToken, requireAdmin, validate(updatePrizeSchema), async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('prizes')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Prize not found.' });
  }

  // Log admin action
  await supabaseAdmin.from('admin_log').insert({
    admin_id:    req.user.id,
    action:      'update_prize',
    target_type: 'prize',
    target_id:   id,
    payload:     req.body,
  });

  return res.json({ prize: data });
});

// ── DELETE /prizes/:id ────────────────────────────────────────────────────────
// Admin only — soft delete (sets is_active = false)
// Hard delete is intentionally avoided to preserve spin_history references
router.delete('/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabaseAdmin
    .from('prizes')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Prize not found.' });
  }

  // Log admin action
  await supabaseAdmin.from('admin_log').insert({
    admin_id:    req.user.id,
    action:      'remove_prize',
    target_type: 'prize',
    target_id:   id,
    payload:     { code: data.code },
  });

  return res.json({ ok: true, prize: data });
});