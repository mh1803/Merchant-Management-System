import Joi from 'joi';
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

const statusValues: MerchantStatus[] = ['Pending KYB', 'Active', 'Suspended'];
const pricingTierValues: MerchantPricingTier[] = ['standard', 'premium', 'enterprise'];

const createMerchantSchema = Joi.object<CreateMerchantInput>({
  name: Joi.string().trim().min(2).required(),
  category: Joi.string().trim().min(2).required(),
  city: Joi.string().trim().min(2).required(),
  contactEmail: Joi.string().email().required(),
  pricingTier: Joi.string()
    .valid(...pricingTierValues)
    .optional()
});

const updateMerchantSchema = Joi.object<UpdateMerchantInput>({
  name: Joi.string().trim().min(2).optional(),
  category: Joi.string().trim().min(2).optional(),
  city: Joi.string().trim().min(2).optional(),
  contactEmail: Joi.string().email().optional(),
  status: Joi.string()
    .valid(...statusValues)
    .optional()
}).min(1);

const listMerchantSchema = Joi.object<MerchantFilters>({
  status: Joi.string()
    .valid(...statusValues)
    .optional(),
  city: Joi.string().trim().optional(),
  category: Joi.string().trim().optional(),
  q: Joi.string().trim().optional()
});

const updatePricingTierSchema = Joi.object<UpdateMerchantPricingTierInput>({
  pricingTier: Joi.string()
    .valid(...pricingTierValues)
    .required()
});

export async function createMerchantController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await createMerchantSchema.validateAsync(req.body, { abortEarly: false });
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
    const value = await listMerchantSchema.validateAsync(req.query, { abortEarly: false });
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
    const merchant = await getMerchantDetails(merchantId);
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
    const value = await updateMerchantSchema.validateAsync(req.body, { abortEarly: false });
    const merchantId = Array.isArray(req.params.merchantId)
      ? req.params.merchantId[0]
      : req.params.merchantId;
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
    const value = await updatePricingTierSchema.validateAsync(req.body, { abortEarly: false });
    const merchantId = Array.isArray(req.params.merchantId)
      ? req.params.merchantId[0]
      : req.params.merchantId;
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
    const merchantId = Array.isArray(req.params.merchantId)
      ? req.params.merchantId[0]
      : req.params.merchantId;
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
