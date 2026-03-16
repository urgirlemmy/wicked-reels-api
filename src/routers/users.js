import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
} from '../schemas/user.schemas.js';

export const router = Router();

// ── GET /users/me ─────────────────────────────────────────────────────────────
// Authenticated — get current user profile
router.get('/me', verifyToken, async (req, res) => {
  return res.json({ user: req.user });
});

// ── PATCH /users/me/username ──────────────────────────────────────────────────
// Authenticated — update username
router.patch('/me/username', verifyToken, validate(updateUsernameSchema), async (req, res) => {
  const { username } = req.body;

  // Check not taken
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', req.user.id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: 'Failed to update username.' });
  }

  return res.json({ user: data });
});

// ── PATCH /users/me/email ─────────────────────────────────────────────────────
// Authenticated — update email
router.patch('/me/email', verifyToken, validate(updateEmailSchema), async (req, res) => {
  const { email } = req.body;

  // Update in Supabase Auth
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    req.user.id,
    { email }
  );

  if (authError) {
    return res.status(400).json({ error: authError.message });
  }

  return res.json({ ok: true, email });
});

// ── PATCH /users/me/password ──────────────────────────────────────────────────
// Authenticated — update password
router.patch('/me/password', verifyToken, validate(updatePasswordSchema), async (req, res) => {
  const { current_password, new_password } = req.body;

  // Verify current password by attempting sign in
  const syntheticEmail = `${req.user.username.toLowerCase()}@naughtyspin.internal`;

  const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email:    syntheticEmail,
    password: current_password,
  });

  if (signInError) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  // Update password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    req.user.id,
    { password: new_password }
  );

  if (updateError) {
    return res.status(400).json({ error: updateError.message });
  }

  return res.json({ ok: true });
});

// ── DELETE /users/me ──────────────────────────────────────────────────────────
// Authenticated — delete account
router.delete('/me', verifyToken, validate(deleteAccountSchema), async (req, res) => {
  const { password } = req.body;

  // Verify password first
  const syntheticEmail = `${req.user.username.toLowerCase()}@naughtyspin.internal`;

  const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
    email:    syntheticEmail,
    password,
  });

  if (signInError) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  // Delete from Supabase Auth — cascades to profiles via ON DELETE CASCADE
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
    req.user.id
  );

  if (deleteError) {
    return res.status(500).json({ error: 'Failed to delete account.' });
  }

  return res.json({ ok: true });
});