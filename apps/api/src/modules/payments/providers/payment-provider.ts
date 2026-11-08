export type CreatePaymentInput = {
  orderCode: number;
  amount: number;
  description: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  returnUrl: string;
  cancelUrl: string;
  expiresAt?: string;
};

export type CreatedPayment = {
  checkoutUrl: string;
  providerRef: string | null;
  qrCode: string | null;
  transferDescription?: string;
};

export type WebhookVerification = {
  signatureValid: boolean;
  dedupeKey: string;
  orderCode: number | null;
  amount: number | null;
  providerRef: string | null;
  success: boolean;
};

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatedPayment>;
  verifyWebhook(rawBody: string): WebhookVerification;
  lookupPayment?(orderCode: number): Promise<{
    orderCode: number;
    amount: number;
    status: string;
    payment: CreatedPayment;
  } | null>;
  cancelPayment?(orderCode: number, reason: string): Promise<void>;
}
