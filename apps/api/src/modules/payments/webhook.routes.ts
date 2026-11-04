import { Router, type Request } from 'express';
import { AppError } from '../../errors/app-error.js';
import { loadConfig } from '../../config.js';
import { receivePaymentWebhook } from './payments.service.js';

const router = Router();

function getRawBody(request: Request): string {
  if (!Buffer.isBuffer(request.body)) {
    throw new AppError(400, 'BAD_REQUEST', 'Nội dung webhook không hợp lệ.');
  }
  return request.body.toString('utf8');
}

router.post('/payos', async (request, response) => {
  if (loadConfig().PAYMENT_PROVIDER !== 'payos') {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy webhook.');
  }
  const result = await receivePaymentWebhook('payos', getRawBody(request));
  if (result.result === 'invalid_signature') {
    throw new AppError(400, 'BAD_REQUEST', 'Chữ ký webhook không hợp lệ.');
  }
  response.status(200).json({ error: 0, message: 'Ok', data: null });
});

router.post('/mock', async (request, response) => {
  const config = loadConfig();
  if (config.NODE_ENV === 'production' || config.PAYMENT_PROVIDER !== 'mock') {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy webhook.');
  }
  const result = await receivePaymentWebhook('mock', getRawBody(request));
  if (result.result === 'invalid_signature') {
    throw new AppError(400, 'BAD_REQUEST', 'Chữ ký webhook không hợp lệ.');
  }
  response.status(200).json({ error: 0, message: 'Ok', data: null });
});

export default router;
