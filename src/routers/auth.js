import { Router } from 'express';
import { supabase, supabaseAdmin } from '../supabaseClient.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.schemas.js';

export const router = Router();

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', validate(registerSchema), async (req, res) => {
  const { username, password } = req.body;

  // Check username is not taken
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'Username already taken.' });
  }

  const syntheticEmail = `${username.toLowerCase()}@naughtyspin.internal`;

  const { data, error } = await supabase.auth.signUp({
    email: syntheticEmail,
    password,
    options: { data: { username } }
  });

  if (error || !data.user) {
    return res.status(400).json({ error: error?.message ?? 'Registration failed.' });
  }

  // Wait for trigger to create profile
  await new Promise(r => setTimeout(r, 500));

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) {
    return res.status(500).json({ error: 'Profile creation failed. Try logging in.' });
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

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .maybeSingle();

  if (!profile) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const syntheticEmail = `${username.toLowerCase()}@naughtyspin.internal`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email: syntheticEmail,
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
  try { await supabase.auth.signOut(); } catch (_) {}
  return res.json({ ok: true });
});