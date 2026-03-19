import { Router } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import logger from '../utils/logger.js';
import {
  updateUsernameSchema,
  updateEmailSchema,
  updatePasswordSchema,
  deleteAccountSchema,
} from '../schemas/user.schemas.js';

export const router = Router();

// ── GET /users/me ─────────────────────────────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  return res.json({ user: req.user });
});

// ── PATCH /users/me/username ──────────────────────────────────────────────────
router.patch('/me/username', verifyToken, validate(updateUsernameSchema), async (req, res) => {
  const { username, password } = req.body;

  logger.info('Username update requested', { userId: req.user.id, newUsername: username });

  const permanentEmail = `${req.user.id}@naughtyspin.internal`;

  // Use a fresh anon client call — never use supabaseAdmin for signIn
  // as it mutates shared session state
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: permanentEmail,
    password,
  });

  if (signInError) {
    logger.warn('Username update — password verify failed', { userId: req.user.id, error: signInError.message });
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id', 'username')
    .eq('username', username)
    .neq('id', req.user.id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', req.user.id);

  if (error) {
    logger.error('Username update — DB failed', { userId: req.user.id, error: error.message });
    return res.status(500).json({ error: 'Failed to update username.' });
  }

  // Fetch the updated profile separately — avoids maybeSingle() null issue
  const { data: updatedProfile, error: fetchError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', req.user.id)
    .single();

  if (fetchError || !updatedProfile) {
    logger.error('Username update — fetch after update failed', { userId: req.user.id });
    return res.status(500).json({ error: 'Update succeeded but failed to fetch profile.' });
  }

  logger.info('Username updated', { userId: req.user.id, username: updatedProfile.username });
  return res.json({ user: updatedProfile });
});

// ── PATCH /users/me/email ─────────────────────────────────────────────────────
router.patch('/me/email', verifyToken, validate(updateEmailSchema), async (req, res) => {
  const { email, password } = req.body;

  logger.info('Email update requested', { userId: req.user.id });

  // Verify password first
  const permanentEmail = `${req.user.id}@naughtyspin.internal`;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: permanentEmail,
    password,
  });

  if (signInError) {
    // Try signing in with real email in case they already updated it
    if (req.user.email) {
      const { error: realSignInError } = await supabase.auth.signInWithPassword({
        email: req.user.email,
        password,
      });
      if (realSignInError) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
    } else {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
  }

  // Check email not already in profiles
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .neq('id', req.user.id)
    .maybeSingle();

  if (existingProfile) {
    return res.status(409).json({ error: 'Email already in use.' });
  }

  // Check email not already in auth.users
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
  const emailTakenInAuth = authUsers?.users?.some(
    u => u.email === email && u.id !== req.user.id
  );

  if (emailTakenInAuth) {
    return res.status(409).json({ error: 'Email already in use.' });
  }

  // Update auth.users email — this is now the real login email
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
    req.user.id,
    { email }
  );

  if (authError) {
    logger.error('Email update — auth failed', { userId: req.user.id, error: authError.message });
    return res.status(400).json({ error: authError.message });
  }

  // Store in profiles
  const { data: updatedProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({ email, updated_at: new Date().toISOString() })
    .eq('id', req.user.id)
    .select()
    .single();

  if (profileError) {
    logger.error('Email update — profile failed', { userId: req.user.id, error: profileError.message });
    return res.status(500).json({ error: 'Failed to save email.' });
  }

  logger.info('Email updated', { userId: req.user.id });
  return res.json({ ok: true, user: updatedProfile });
});

// ── PATCH /users/me/password ──────────────────────────────────────────────────
router.patch('/me/password', verifyToken, validate(updatePasswordSchema), async (req, res) => {
  const { current_password, new_password } = req.body;

  logger.info('Password update requested', { userId: req.user.id });

  const permanentEmail = `${req.user.id}@naughtyspin.internal`;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: permanentEmail,
    password: current_password,
  });

  if (signInError) {
    logger.warn('Password update — verify failed', { userId: req.user.id, error: signInError.message });
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    req.user.id,
    { password: new_password }
  );

  if (updateError) {
    logger.error('Password update — auth failed', { userId: req.user.id, error: updateError.message });
    return res.status(400).json({ error: updateError.message });
  }

  logger.info('Password updated', { userId: req.user.id });
  return res.json({ ok: true });
});

// ── DELETE /users/me ──────────────────────────────────────────────────────────
router.delete('/me', verifyToken, validate(deleteAccountSchema), async (req, res) => {
  const { password } = req.body;

  logger.info('Account deletion requested', { userId: req.user.id });

  const permanentEmail = `${req.user.id}@naughtyspin.internal`;

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: permanentEmail,
    password,
  });

  if (signInError) {
    logger.warn('Account deletion — password verify failed', { userId: req.user.id, error: signInError.message });
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(req.user.id);

  if (deleteError) {
    logger.error('Account deletion — auth failed', { userId: req.user.id, error: deleteError.message });
    return res.status(500).json({ error: 'Failed to delete account.' });
  }

  logger.info('Account deleted', { userId: req.user.id });
  return res.json({ ok: true });
});