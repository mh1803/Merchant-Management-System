import express from 'express';
import { authRouter } from './routes/authRoutes';
import { merchantRouter } from './routes/merchantRoutes';
import { webhookRouter } from './routes/webhookRoutes';
import { notFound } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// The app module wires the HTTP surface only; environment loading and socket binding live elsewhere.
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/merchants', merchantRouter);
app.use('/webhooks', webhookRouter);

// Unknown routes and thrown errors are handled centrally so controllers stay focused on domain logic.
app.use(notFound);
app.use(errorHandler);

export default app;
