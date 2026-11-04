export type CreatePaymentInput = {
  orderCode: number;
  amount: number;
  description: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  returnUrl: string;
  cancelUrl: string;
};

export type CreatedPayment = {
  checkoutUrl: string;
  providerRef: string | null;
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
}
