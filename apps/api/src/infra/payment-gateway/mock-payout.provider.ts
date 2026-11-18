import type {
  PayoutProvider,
  PayoutRequest,
  PayoutResult,
} from './payout-provider.js';

export class MockPayoutProvider implements PayoutProvider {
  async executePayout(request: PayoutRequest): Promise<PayoutResult> {
    if (request.toAccountNumber === '0000000000') {
      return {
        status: 'failed',
        reference: `MOCK-${Date.now()}`,
        providerFee: 0,
        failureReason: 'Tài khoản người nhận không tồn tại hoặc bị từ chối.',
      };
    }
    return {
      status: 'succeeded',
      reference: `MOCK-PAYOUT-${Date.now()}`,
      providerFee: 2200,
    };
  }

  async getPayout(payoutId: string): Promise<PayoutResult> {
    return {
      status: 'succeeded',
      reference: payoutId,
      providerFee: 2200,
    };
  }
}
