import express from 'express';
import { authenticate } from '../middleware/authenticate';
import { registerWebhookSubscriptionController } from '../controllers/webhookController';

export const webhookRouter = express.Router();

// Subscription management is protected because only authenticated operators can register destinations.
webhookRouter.use(authenticate);
webhookRouter.post('/subscriptions', registerWebhookSubscriptionController);
