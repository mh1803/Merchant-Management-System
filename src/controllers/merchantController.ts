import { NextFunction, Request, Response } from 'express';
import { listMerchantHistoryController } from './historyController';
import {
  addMerchant,
  changeMerchantPricingTier,
  editMerchant,
  getMerchantDetails,
  removeMerchant,
  searchMerchants
} from '../services/merchantService';
import {
  CreateMerchantInput,
  MerchantFilters,
  MerchantPricingTier,
  MerchantStatus,
  UpdateMerchantPricingTierInput,
  UpdateMerchantInput
} from '../types/merchant';
import { validateUuidParam, validateWithSchema, z } from '../utils/validation';

const statusValues = ['Pending KYB', 'Active', 'Suspended'] as const satisfies MerchantStatus[];
const pricingTierValues = ['standard', 'premium', 'enterprise'] as const satisfies MerchantPricingTier[];

const createMerchantSchema = z.object({
  name: z.string().trim().min(2),
  category: z.string().trim().min(2),
  city: z.string().trim().min(2),
  contactEmail: z.string().email(),
  pricingTier: z.enum(pricingTierValues).optional()
}).strict() satisfies z.ZodType<CreateMerchantInput>;

const updateMerchantSchema = z.object({
  name: z.string().trim().min(2).optional(),
  category: z.string().trim().min(2).optional(),
  city: z.string().trim().min(2).optional(),
  contactEmail: z.string().email().optional(),
  status: z.enum(statusValues).optional()
})
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  }) satisfies z.ZodType<UpdateMerchantInput>;

const listMerchantSchema = z.object({
  status: z.enum(statusValues).optional(),
  city: z.string().trim().optional(),
  category: z.string().trim().optional(),
  pricingTier: z.enum(pricingTierValues).optional(),
  q: z.string().trim().optional()
}) satisfies z.ZodType<MerchantFilters>;

const updatePricingTierSchema = z.object({
  pricingTier: z.enum(pricingTierValues)
}) satisfies z.ZodType<UpdateMerchantPricingTierInput>;

async function merchantIdFromRequest(req: Request): Promise<string> {
  const rawValue = Array.isArray(req.params.merchantId)
    ? req.params.merchantId[0]
    : req.params.merchantId;
  return validateUuidParam(rawValue, 'merchantId');
}

export async function createMerchantController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Controllers stay thin: validate shape, collect route context, and delegate all business
    // decisions to the service layer.
    const value = await validateWithSchema(createMerchantSchema, req.body);
    const merchant = await addMerchant(value);
    res.status(201).json(merchant);
  } catch (error) {
    next(error);
  }
}

export async function listMerchantsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Query params are validated here so service code receives normalized optional filters.
    const value = await validateWithSchema(listMerchantSchema, req.query);
    const merchants = await searchMerchants(value);
    res.status(200).json({ items: merchants });
  } catch (error) {
    next(error);
  }
}

export async function getMerchantController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const merchantId = Array.isArray(req.params.merchantId)
      ? req.params.merchantId[0]
      : req.params.merchantId;
    const merchant = await getMerchantDetails(await validateUuidParam(merchantId, 'merchantId'));
    res.status(200).json(merchant);
  } catch (error) {
    next(error);
  }
}

export async function updateMerchantController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await validateWithSchema(updateMerchantSchema, req.body);
    const merchantId = await merchantIdFromRequest(req);
    // Auth middleware attaches the acting operator once so controllers do not need to re-parse tokens.
    const actor = res.locals.operator as { id: string; email: string; role: 'admin' | 'operator' };
    const merchant = await editMerchant(merchantId, value, {
      operatorId: actor.id,
      email: actor.email,
      role: actor.role
    });
    res.status(200).json(merchant);
  } catch (error) {
    next(error);
  }
}

export async function updateMerchantPricingTierController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await validateWithSchema(updatePricingTierSchema, req.body);
    const merchantId = await merchantIdFromRequest(req);
    const actor = res.locals.operator as { id: string; email: string; role: 'admin' | 'operator' };
    const merchant = await changeMerchantPricingTier(merchantId, value, {
      operatorId: actor.id,
      email: actor.email,
      role: actor.role
    });
    res.status(200).json(merchant);
  } catch (error) {
    next(error);
  }
}

export async function deleteMerchantController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const merchantId = await merchantIdFromRequest(req);
    const actor = res.locals.operator as { id: string; email: string; role: 'admin' | 'operator' };
    const result = await removeMerchant(merchantId, {
      operatorId: actor.id,
      email: actor.email,
      role: actor.role
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export { listMerchantHistoryController };
