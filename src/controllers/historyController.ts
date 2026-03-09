import { NextFunction, Request, Response } from 'express';
import { getMerchantHistory } from '../services/historyService';
import { validateUuidParam } from '../utils/validation';

async function merchantIdFromRequest(req: Request): Promise<string> {
  const rawValue = Array.isArray(req.params.merchantId) ? req.params.merchantId[0] : req.params.merchantId;
  return validateUuidParam(rawValue, 'merchantId');
}

export async function listMerchantHistoryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // History is read-only, so the controller simply resolves the merchant id and returns the sequence.
    const items = await getMerchantHistory(await merchantIdFromRequest(req));
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
}
