import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import webhookRoutes from '@/routes/webhooks';
import mlAuthRoutes from '@/routes/mlAuth';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Mount webhook routes
app.use('/webhook', webhookRoutes);

// Mercado Livre OAuth routes (API prefix)
app.use('/api', mlAuthRoutes);

export default app;
