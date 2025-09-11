import * as AuthorizeNet from 'authorizenet';
import { v4 as uuidv4 } from 'uuid';
import { TransactionStatus } from '../types/database';

export interface SubscriptionInput {
  name: string;
  amount: number;
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount?: number;
  paymentMethodId: string;
  startDate?: Date;
  trialDays?: number;
  totalOccurrences?: number;
  trialAmount?: number;
}

export interface SubscriptionResponse {
  subscriptionId: string;
  status: 'active' | 'canceled' | 'suspended' | 'expired' | 'terminated';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  rawResponse: any;
}

const { APIContracts, APIControllers } = AuthorizeNet as any;
const { CreditCardType, PaymentType, CustomerAddressType, CustomerDataType } = APIContracts;

export interface PaymentRequest {
  amount: number;
  currency: string;
  paymentMethod: {
    cardNumber: string;
    expirationDate: string; // MM/YYYY
    cardCode: string;
  };
  billingAddress?: {
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  orderDescription?: string;
}

export interface PaymentResponse {
  transactionId: string;
  status: TransactionStatus;
  responseCode: string;
  message: string;
  rawResponse: any;
}

export class AuthorizeNetService {
  private apiLoginId: string;
  private transactionKey: string;
  private environment: 'PRODUCTION' | 'SANDBOX';
  private merchantAuthentication: any;

  constructor() {
    this.apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID || '';
    this.transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY || '';
    this.environment = (process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'SANDBOX') as
      | 'PRODUCTION'
      | 'SANDBOX';

    // Credentials will be validated at call-time to support tests that mutate env per-case

    this.merchantAuthentication = new APIContracts.MerchantAuthenticationType();
    this.merchantAuthentication.setName(this.apiLoginId);
    this.merchantAuthentication.setTransactionKey(this.transactionKey);
  }

  private createCustomerPaymentProfile(paymentMethod: PaymentRequest['paymentMethod']) {
    const creditCard = new CreditCardType();
    creditCard.setCardNumber(paymentMethod.cardNumber.replace(/\s+/g, ''));
    creditCard.setExpirationDate(paymentMethod.expirationDate);
    creditCard.setCardCode(paymentMethod.cardCode);

    const paymentType = new PaymentType();
    paymentType.setCreditCard(creditCard);

    return paymentType;
  }

  private createCustomerAddress(billingAddress: NonNullable<PaymentRequest['billingAddress']>) {
    if (!billingAddress) return undefined;

    const address = new CustomerAddressType();
    address.setFirstName(billingAddress.firstName);
    address.setLastName(billingAddress.lastName);
    address.setAddress(billingAddress.address);
    address.setCity(billingAddress.city);
    address.setState(billingAddress.state);
    address.setZip(billingAddress.zip);
    address.setCountry(billingAddress.country);

    return address;
  }

  async purchase(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    this.ensureCredentials();
    return this.processTransaction(paymentRequest, 'authCaptureTransaction');
  }

  async authorize(paymentRequest: PaymentRequest): Promise<PaymentResponse> {
    this.ensureCredentials();
    return this.processTransaction(paymentRequest, 'authOnlyTransaction');
  }

  async capture(transactionId: string, amount: number): Promise<PaymentResponse> {
    this.ensureCredentials();
    const merchantAuthType = new APIContracts.MerchantAuthenticationType();
    merchantAuthType.setName(this.apiLoginId);
    merchantAuthType.setTransactionKey(this.transactionKey);

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType('priorAuthCaptureTransaction');
    transactionRequestType.setRefTransId(transactionId);
    transactionRequestType.setAmount(amount.toString());

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthType);
    createRequest.setTransactionRequest(transactionRequestType);

    return this.executeCreateTransaction(createRequest, 'Transaction processed');
  }

  async void(transactionId: string): Promise<PaymentResponse> {
    this.ensureCredentials();
    const merchantAuthType = new APIContracts.MerchantAuthenticationType();
    merchantAuthType.setName(this.apiLoginId);
    merchantAuthType.setTransactionKey(this.transactionKey);

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType('voidTransaction');
    transactionRequestType.setRefTransId(transactionId);

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthType);
    createRequest.setTransactionRequest(transactionRequestType);

    return this.executeCreateTransaction(createRequest, 'Transaction voided');
  }

  async refund(
    transactionId: string,
    amount: number,
    paymentRequest: PaymentRequest
  ): Promise<PaymentResponse> {
    this.ensureCredentials();
    const merchantAuthType = new APIContracts.MerchantAuthenticationType();
    merchantAuthType.setName(this.apiLoginId);
    merchantAuthType.setTransactionKey(this.transactionKey);

    const creditCard = new CreditCardType();
    creditCard.setCardNumber(paymentRequest.paymentMethod.cardNumber.replace(/\s+/g, ''));
    creditCard.setExpirationDate(paymentRequest.paymentMethod.expirationDate);

    const paymentType = new PaymentType();
    paymentType.setCreditCard(creditCard);

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType('refundTransaction');
    transactionRequestType.setRefTransId(transactionId);
    transactionRequestType.setAmount(amount.toString());
    transactionRequestType.setPayment(paymentType);

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthType);
    createRequest.setTransactionRequest(transactionRequestType);

    return this.executeCreateTransaction(createRequest, 'Refund processed');
  }

  private async processTransaction(
    paymentRequest: PaymentRequest,
    transactionType: 'authCaptureTransaction' | 'authOnlyTransaction'
  ): Promise<PaymentResponse> {
    const merchantAuthType = new APIContracts.MerchantAuthenticationType();
    merchantAuthType.setName(this.apiLoginId);
    merchantAuthType.setTransactionKey(this.transactionKey);

    const paymentType = this.createCustomerPaymentProfile(paymentRequest.paymentMethod);
    const billingAddress = paymentRequest.billingAddress
      ? this.createCustomerAddress(paymentRequest.billingAddress)
      : undefined;

    const transactionRequestType = new APIContracts.TransactionRequestType();
    transactionRequestType.setTransactionType(transactionType);
    transactionRequestType.setAmount(paymentRequest.amount.toString());
    transactionRequestType.setPayment(paymentType);

    if (billingAddress) {
      transactionRequestType.setBillTo(billingAddress);
    }

    if (paymentRequest.orderDescription) {
      transactionRequestType.setDescription(paymentRequest.orderDescription);
    }

    // Customer information can be set here if available; omitted by default

    const createRequest = new APIContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuthType);
    createRequest.setTransactionRequest(transactionRequestType);
    return this.executeCreateTransaction(createRequest, 'Transaction processed');
  }

  private mapStatus(responseCode: string): TransactionStatus {
    // Map Authorize.net response codes to our transaction status
    switch (responseCode) {
      case '1': // Approved
        return TransactionStatus.COMPLETED;
      case '2': // Declined
        return TransactionStatus.DECLINED;
      case '3': // Error
        return TransactionStatus.FAILED;
      case '4': // Held for Review
        return TransactionStatus.PENDING;
      default:
        return TransactionStatus.FAILED;
    }
  }

  private ensureCredentials() {
    this.apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID || '';
    this.transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY || '';
    if (!this.apiLoginId || !this.transactionKey) {
      throw new Error('Authorize.net credentials not configured');
    }
  }

  private executeCreateTransaction(request: any, defaultMessage: string): Promise<PaymentResponse> {
    return new Promise((resolve, reject) => {
      try {
        const ctrl = new APIControllers.CreateTransactionController(
          (request as any).getJSON ? (request as any).getJSON() : request
        );
        ctrl.execute(() => {
          try {
            const response = ctrl.getResponse();
            const result = response.getTransactionResponse();
            resolve({
              transactionId: result.transId,
              status: this.mapStatus(result.responseCode),
              responseCode: result.responseCode,
              message: result.messages?.[0]?.description || defaultMessage,
              rawResponse: response,
            });
          } catch (err) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

let _authorizeNetService: AuthorizeNetService | null = null;
export function getAuthorizeNetService(): AuthorizeNetService {
  if (!_authorizeNetService) {
    _authorizeNetService = new AuthorizeNetService();
  }
  return _authorizeNetService;
}

// Backward-compatible singleton export
export const authorizeNetService = getAuthorizeNetService();
