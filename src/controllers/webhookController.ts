import Joi from 'joi';
import { NextFunction, Request, Response } from 'express';
import { registerWebhookSubscription } from '../services/webhookService';
import { RegisterWebhookSubscriptionInput } from '../types/webhook';

const registerWebhookSubscriptionSchema = Joi.object<RegisterWebhookSubscriptionInput>({
  url: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  secret: Joi.string().min(8).required()
});

export async function registerWebhookSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await registerWebhookSubscriptionSchema.validateAsync(req.body, {
      abortEarly: false
    });
    const subscription = await registerWebhookSubscription(value);
    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
}
