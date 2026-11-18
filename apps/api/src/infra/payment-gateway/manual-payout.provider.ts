import type {
  PayoutProvider,
  PayoutRequest,
  PayoutResult,
} from './payout-provider.js';

export class ManualPayoutProvider implements PayoutProvider {
  async executePayout(request: PayoutRequest): Promise<PayoutResult> {
    return {
      status: 'processing',
      reference: `MANUAL-${request.transferId.slice(0, 8)}`,
      providerFee: 0,
    };
  }

  async getPayout(payoutId: string): Promise<PayoutResult> {
    return {
      status: 'processing',
      reference: payoutId,
      providerFee: 0,
    };
  }
}
