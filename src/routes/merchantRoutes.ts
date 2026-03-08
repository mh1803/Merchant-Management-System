import express from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createMerchantController,
  getMerchantController,
  listMerchantsController,
  updateMerchantController
} from '../controllers/merchantController';

export const merchantRouter = express.Router();

merchantRouter.use(authenticate);
merchantRouter.post('/', createMerchantController);
merchantRouter.get('/', listMerchantsController);
merchantRouter.get('/:merchantId', getMerchantController);
merchantRouter.patch('/:merchantId', updateMerchantController);
