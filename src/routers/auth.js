import { Router } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.schemas.js';
import logger from '../utils/logger.js';

export const router = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  const { username, password } = req.body;

  // Check username not taken in profiles
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  // Step 1 — Sign up with a temporary placeholder email
  // We use a random placeholder because we don't have the UUID yet
  const tempEmail = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}@naughtyspin.internal`;

  const { data, error } = await supabase.auth.signUp({
    email: tempEmail,
    password,
    options: { data: { username } }
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? 'Registration failed.' });
  }

  const userId = data.user.id;

  // Step 2 — Update auth email to UUID-based permanent email
  // This is now the stable identity — never changes even if username changes
  const permanentEmail = `${userId}@naughtyspin.internal`;

  const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    { email: permanentEmail }
  );

  if (updateEmailError) {
    // Clean up the auth user if we can't set the permanent email
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }

  // Step 3 — Wait for trigger to create profile
  await new Promise(r => setTimeout(r, 500));

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    // Trigger may have failed — create profile manually
    const { data: manualProfile, error: manualError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: userId, username })
      .select()
      .single();

    if (manualError || !manualProfile) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Profile creation failed. Please try again.' });
    }

    return res.status(201).json({
      access_token: data.session?.access_token ?? null,
      token_type: 'bearer',
      user: manualProfile,
    });
  }

  return res.status(201).json({
    access_token: data.session?.access_token ?? null,
    token_type: 'bearer',
    user: profile,
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, username, email')
    .eq('username', username)
    .maybeSingle();

  if (!profile) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Use real email if available, otherwise fall back to synthetic
  const loginEmail = profile.email ?? `${profile.id}@naughtyspin.internal`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password,
  });

  if (error || !data.user || !data.session) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const { data: fullProfile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  return res.json({
    access_token: data.session.access_token,
    token_type: 'bearer',
    user: fullProfile,
  });
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try { await supabase.auth.signOut(); } catch (_) { }
  return res.json({ ok: true });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  // Look up profile
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('username', username)
    .maybeSingle();

  // Always return success to avoid username enumeration
  if (!profile || !profile.email) {
    return res.json({ ok: true });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
  });

  if (error) {
    logger.error('Forgot password — reset email failed', { error: error.message });
  }

  // Always return success regardless — security best practice
  return res.json({ ok: true });
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { access_token, refresh_token, new_password } = req.body;

  if (!access_token || !refresh_token || !new_password) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  try {
    // Set the session using the tokens from the reset link
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError || !sessionData.user) {
      logger.warn('Reset password — invalid session tokens', { error: sessionError?.message });
      return res.status(401).json({ error: 'Invalid or expired reset link.' });
    }

    // Update password using admin client
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      sessionData.user.id,
      { password: new_password }
    );

    if (updateError) {
      logger.error('Reset password — update failed', { error: updateError.message });
      return res.status(400).json({ error: updateError.message });
    }

    logger.info('Password reset successful', { userId: sessionData.user.id });
    return res.json({ ok: true });
  } catch (err) {
    logger.error('Reset password — exception', { error: err.message });
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});