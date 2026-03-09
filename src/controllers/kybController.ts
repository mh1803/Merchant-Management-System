import { NextFunction, Request, Response } from 'express';
import {
  getMerchantDocumentDetails,
  getMerchantDocumentVerificationHistory,
  getMerchantDocuments,
  recordMerchantDocument,
  verifyMerchantDocument
} from '../services/kybService';
import {
  MerchantDocumentType,
  RecordMerchantDocumentInput,
  VerifyMerchantDocumentInput
} from '../types/kyb';
import { validateUuidParam, validateWithSchema, z } from '../utils/validation';

const documentTypes = [
  'bank_account_proof',
  'business_registration',
  'owner_identity_document'
] as const satisfies MerchantDocumentType[];

const recordDocumentSchema = z.object({
  type: z.enum(documentTypes),
  fileName: z.string().trim().min(3)
}) satisfies z.ZodType<RecordMerchantDocumentInput>;

const verifyDocumentSchema = z.object({
  verified: z.boolean()
}) satisfies z.ZodType<VerifyMerchantDocumentInput>;

async function merchantIdFromRequest(req: Request): Promise<string> {
  const rawValue = Array.isArray(req.params.merchantId) ? req.params.merchantId[0] : req.params.merchantId;
  return validateUuidParam(rawValue, 'merchantId');
}

async function documentTypeFromRequest(req: Request): Promise<MerchantDocumentType> {
  const rawValue = Array.isArray(req.params.documentType)
    ? req.params.documentType[0]
    : req.params.documentType;

  return validateWithSchema(z.enum(documentTypes), rawValue);
}

export async function recordMerchantDocumentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await validateWithSchema(recordDocumentSchema, req.body);
    const document = await recordMerchantDocument(await merchantIdFromRequest(req), value);
    res.status(201).json(document);
  } catch (error) {
    next(error);
  }
}

export async function listMerchantDocumentsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const documents = await getMerchantDocuments(await merchantIdFromRequest(req));
    res.status(200).json({ items: documents });
  } catch (error) {
    next(error);
  }
}

export async function getMerchantDocumentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const document = await getMerchantDocumentDetails(
      await merchantIdFromRequest(req),
      await documentTypeFromRequest(req)
    );
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}

export async function listMerchantDocumentVerificationHistoryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const items = await getMerchantDocumentVerificationHistory(
      await merchantIdFromRequest(req),
      await documentTypeFromRequest(req)
    );
    res.status(200).json({ items });
  } catch (error) {
    next(error);
  }
}

export async function verifyMerchantDocumentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await validateWithSchema(verifyDocumentSchema, req.body);
    const actor = res.locals.operator as { id: string; email: string; role: 'admin' | 'operator' };
    const document = await verifyMerchantDocument(
      await merchantIdFromRequest(req),
      await documentTypeFromRequest(req),
      value,
      {
        operatorId: actor.id,
        email: actor.email,
        role: actor.role
      }
    );
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}
