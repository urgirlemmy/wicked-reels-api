import { supabaseAdmin } from '../supabaseClient.js';
import logger from '../utils/logger.js';

export async function verifyToken(req, res, next) {
  logger.info(`${req.method} ${req.path}`);

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      logger.warn('Invalid token', { error: error?.message });
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      logger.warn('Profile not found', { userId: data.user.id });
      return res.status(404).json({ error: 'Profile not found.' });
    }

    req.user = profile;
    next();
  } catch (err) {
    logger.error('Auth exception', { error: err.message });
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    logger.warn('Admin access denied', { userId: req.user?.id });
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}