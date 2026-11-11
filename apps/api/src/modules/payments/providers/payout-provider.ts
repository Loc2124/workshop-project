export interface PayoutRequest {
  transferId: string;
  amount: number;
  description: string;
  toBin: string;
  toAccountNumber: string;
  accountHolderName?: string;
}

export interface PayoutResult {
  status: 'succeeded' | 'processing' | 'failed';
  reference: string;
  providerFee: number;
  failureReason?: string;
}

export interface PayoutProvider {
  executePayout(request: PayoutRequest): Promise<PayoutResult>;
  getPayout(payoutId: string): Promise<PayoutResult>;
}
