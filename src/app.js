import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { router as authRouter }   from './routers/auth.js';
import { router as usersRouter }  from './routers/users.js';
import { router as prizesRouter } from './routers/prizes.js';
import { router as spinsRouter }  from './routers/spins.js';
import { router as adminRouter }  from './routers/admin.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use('/auth',   authRouter);
app.use('/users',  usersRouter);
app.use('/prizes', prizesRouter);
app.use('/spins',  spinsRouter);
app.use('/admin',  adminRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler — must be last
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🎰 Naughty Spin API running on http://localhost:${config.port}`);
});