import { NextFunction, Request, Response } from 'express';
import {
  getMerchantDocumentDetails,
  getMerchantDocuments,
  recordMerchantDocument,
  verifyMerchantDocument
} from '../services/kybService';
import {
  MerchantDocumentType,
  RecordMerchantDocumentInput,
  VerifyMerchantDocumentInput
} from '../types/kyb';
import { validateWithSchema, z } from '../utils/validation';

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

function merchantIdFromRequest(req: Request): string {
  return Array.isArray(req.params.merchantId) ? req.params.merchantId[0] : req.params.merchantId;
}

function documentTypeFromRequest(req: Request): MerchantDocumentType {
  return Array.isArray(req.params.documentType)
    ? (req.params.documentType[0] as MerchantDocumentType)
    : (req.params.documentType as MerchantDocumentType);
}

export async function recordMerchantDocumentController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const value = await validateWithSchema(recordDocumentSchema, req.body);
    const document = await recordMerchantDocument(merchantIdFromRequest(req), value);
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
    const documents = await getMerchantDocuments(merchantIdFromRequest(req));
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
      merchantIdFromRequest(req),
      documentTypeFromRequest(req)
    );
    res.status(200).json(document);
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
    const document = await verifyMerchantDocument(
      merchantIdFromRequest(req),
      documentTypeFromRequest(req),
      value
    );
    res.status(200).json(document);
  } catch (error) {
    next(error);
  }
}
