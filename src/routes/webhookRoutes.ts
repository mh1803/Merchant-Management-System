import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { registerWebhookSubscriptionController } from '../controllers/webhookController';

export const webhookRouter = express.Router();

webhookRouter.use(authenticate);
webhookRouter.post('/subscriptions', registerWebhookSubscriptionController);
