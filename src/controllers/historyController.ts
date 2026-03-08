import { NextFunction, Request, Response } from 'express';
import { getMerchantHistory } from '../services/historyService';

function merchantIdFromRequest(req: Request): string {
  return Array.isArray(req.params.merchantId) ? req.params.merchantId[0] : req.params.merchantId;
}

export async function listMerchantHistoryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await getMerchantHistory(merchantIdFromRequest(req));
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
}
