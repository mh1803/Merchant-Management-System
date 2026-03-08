import express from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createMerchantController,
  getMerchantController,
  listMerchantsController,
  updateMerchantController
} from '../controllers/merchantController';
import {
  getMerchantDocumentController,
  listMerchantDocumentsController,
  recordMerchantDocumentController,
  verifyMerchantDocumentController
} from '../controllers/kybController';

export const merchantRouter = express.Router();

merchantRouter.use(authenticate);
merchantRouter.post('/', createMerchantController);
merchantRouter.get('/', listMerchantsController);
merchantRouter.get('/:merchantId', getMerchantController);
merchantRouter.patch('/:merchantId', updateMerchantController);
merchantRouter.post('/:merchantId/documents', recordMerchantDocumentController);
merchantRouter.get('/:merchantId/documents', listMerchantDocumentsController);
merchantRouter.get('/:merchantId/documents/:documentType', getMerchantDocumentController);
merchantRouter.patch(
  '/:merchantId/documents/:documentType/verify',
  verifyMerchantDocumentController
);
