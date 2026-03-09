import express from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createMerchantController,
  deleteMerchantController,
  getMerchantController,
  listMerchantHistoryController,
  listMerchantsController,
  updateMerchantPricingTierController,
  updateMerchantStatusController,
  updateMerchantController
} from '../controllers/merchantController';
import {
  getMerchantDocumentController,
  listMerchantDocumentVerificationHistoryController,
  listMerchantDocumentsController,
  recordMerchantDocumentController,
  verifyMerchantDocumentController
} from '../controllers/kybController';

export const merchantRouter = express.Router();

// Merchant routes share one auth boundary, then branch into core merchant operations,
// nested KYB document actions, and immutable history reads.
merchantRouter.use(authenticate);
merchantRouter.post('/', createMerchantController);
merchantRouter.get('/', listMerchantsController);
merchantRouter.get('/:merchantId', getMerchantController);
merchantRouter.patch('/:merchantId', updateMerchantController);
merchantRouter.patch('/:merchantId/status', updateMerchantStatusController);
merchantRouter.delete('/:merchantId', deleteMerchantController);
merchantRouter.patch('/:merchantId/pricing-tier', updateMerchantPricingTierController);
merchantRouter.get('/:merchantId/history', listMerchantHistoryController);
merchantRouter.post('/:merchantId/documents', recordMerchantDocumentController);
merchantRouter.get('/:merchantId/documents', listMerchantDocumentsController);
merchantRouter.get('/:merchantId/documents/:documentType', getMerchantDocumentController);
merchantRouter.get(
  '/:merchantId/documents/:documentType/history',
  listMerchantDocumentVerificationHistoryController
);
merchantRouter.patch(
  '/:merchantId/documents/:documentType/verify',
  verifyMerchantDocumentController
);
