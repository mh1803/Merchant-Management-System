import { NextFunction, Request, Response } from 'express';
import { registerWebhookSubscription } from '../services/webhookService';
import { RegisterWebhookSubscriptionInput } from '../types/webhook';
import { validateWithSchema, z } from '../utils/validation';

const registerWebhookSubscriptionSchema = z.object({
  url: z.string().url().refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
    message: 'Invalid URL'
  }),
  secret: z.string().min(8)
}) satisfies z.ZodType<RegisterWebhookSubscriptionInput>;

export async function registerWebhookSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Subscription registration is the only public webhook-management action in this assignment.
    const value = await validateWithSchema(registerWebhookSubscriptionSchema, req.body);
    const subscription = await registerWebhookSubscription(value);
    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
}
