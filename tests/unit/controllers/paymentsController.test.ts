import { paymentsController } from '../../../src/controllers/paymentsController';
import { authorizeNetService } from '../../../src/services/authorizenetService';
import { transactionService } from '../../../src/services/transactionService';

jest.mock('../../../src/services/authorizenetService');
jest.mock('../../../src/services/transactionService');

function makeReqRes(
  body: any = {},
  headers: Record<string, string> = {},
  user: any = { id: 'u1', email: 'u1@example.com' }
) {
  const req: any = { body, headers, user, path: '/api/payments/purchase' };
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return { req, res };
}

describe('paymentsController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('purchase', () => {
    it('returns 400 when idempotency key missing', async () => {
      const { req, res } = makeReqRes({}, {});
      await paymentsController.purchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('short-circuits duplicate via idempotency cache', async () => {
      (transactionService.checkIdempotency as jest.Mock).mockResolvedValueOnce({
        statusCode: 200,
        response: { ok: true },
      });
      const { req, res } = makeReqRes(
        {
          amount: 100,
          currency: 'USD',
          paymentMethod: {
            cardNumber: '4111111111111111',
            expirationDate: '12-2028',
            cardCode: '123',
          },
        },
        { 'x-idempotency-key': 'k1' }
      );
      await paymentsController.purchase(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    it('validates request body and returns 400 for bad amount', async () => {
      const { req, res } = makeReqRes(
        { amount: -1, currency: 'USD', paymentMethod: {} },
        { 'x-idempotency-key': 'k1' }
      );
      await paymentsController.purchase(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('processes payment successfully', async () => {
      (transactionService.checkIdempotency as jest.Mock).mockResolvedValueOnce(null);
      (transactionService.createTransaction as jest.Mock).mockResolvedValueOnce({ id: 'txn1' });
      (authorizeNetService.purchase as jest.Mock).mockResolvedValueOnce({
        status: 'succeeded',
        transactionId: 'gw1',
        rawResponse: { ok: true },
      });

      const body = {
        amount: 100,
        currency: 'USD',
        paymentMethod: {
          cardNumber: '4111111111111111',
          expirationDate: '12-2028',
          cardCode: '123',
        },
      };
      const { req, res } = makeReqRes(body, { 'x-idempotency-key': 'k1' });
      await paymentsController.purchase(req, res);

      expect(transactionService.updateTransaction).toHaveBeenCalledWith(
        'txn1',
        expect.objectContaining({ status: 'succeeded', authorizeNetTransactionId: 'gw1' })
      );
      expect(transactionService.logPayment).toHaveBeenCalled();
      expect(transactionService.createIdempotencyKey).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 500 when gateway fails and saves idempotency error', async () => {
      (transactionService.checkIdempotency as jest.Mock).mockResolvedValueOnce(null);
      (transactionService.createTransaction as jest.Mock).mockResolvedValueOnce({ id: 'txn1' });
      (authorizeNetService.purchase as jest.Mock).mockRejectedValueOnce(new Error('Gateway down'));

      const body = {
        amount: 100,
        currency: 'USD',
        paymentMethod: {
          cardNumber: '4111111111111111',
          expirationDate: '12-2028',
          cardCode: '123',
        },
      };
      const { req, res } = makeReqRes(body, { 'x-idempotency-key': 'k1' });
      await paymentsController.purchase(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(transactionService.createIdempotencyKey).toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    it('returns 400 missing transactionId', async () => {
      const { req, res } = makeReqRes({});
      await paymentsController.capture(req as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 200 on capture success', async () => {
      (authorizeNetService.capture as jest.Mock).mockResolvedValueOnce({
        status: 'succeeded',
        transactionId: 'gw1',
        rawResponse: {},
      });
      const { req, res } = makeReqRes({ transactionId: 'txn1', amount: 100 });
      await paymentsController.capture(req as any, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(transactionService.updateTransaction).toHaveBeenCalledWith(
        'txn1',
        expect.objectContaining({ status: 'succeeded' })
      );
    });
  });

  describe('void', () => {
    it('returns 200 on void success', async () => {
      (authorizeNetService.void as jest.Mock).mockResolvedValueOnce({
        status: 'succeeded',
        transactionId: 'gw1',
        rawResponse: {},
      });
      const { req, res } = makeReqRes({ transactionId: 'txn1' });
      await paymentsController.void(req as any, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refund', () => {
    it('returns 400 missing fields', async () => {
      const { req, res } = makeReqRes({});
      await paymentsController.refund(req as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 200 on refund success', async () => {
      (authorizeNetService.refund as jest.Mock).mockResolvedValueOnce({
        status: 'succeeded',
        transactionId: 'gw1',
        rawResponse: {},
      });
      const { req, res } = makeReqRes({
        transactionId: 'txn1',
        amount: 100,
        paymentMethod: { last4: '1111' },
      });
      await paymentsController.refund(req as any, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(transactionService.updateTransaction).toHaveBeenCalledWith(
        'txn1',
        expect.objectContaining({ status: 'succeeded' })
      );
    });
  });

  describe('getTransaction', () => {
    it('returns 404 when not found', async () => {
      (transactionService.getTransactionById as jest.Mock).mockResolvedValueOnce(undefined);
      const { req, res } = makeReqRes({}, {}, { id: 'u1' });
      req.params = { id: 'missing' };
      await paymentsController.getTransaction(req as any, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 403 when unauthorized', async () => {
      (transactionService.getTransactionById as jest.Mock).mockResolvedValueOnce({
        id: 'txn1',
        user_id: 'u2',
      });
      const { req, res } = makeReqRes({}, {}, { id: 'u1' });
      req.params = { id: 'txn1' };
      await paymentsController.getTransaction(req as any, res);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('returns 200 when authorized', async () => {
      (transactionService.getTransactionById as jest.Mock).mockResolvedValueOnce({
        id: 'txn1',
        user_id: 'u1',
      });
      const { req, res } = makeReqRes({}, {}, { id: 'u1' });
      req.params = { id: 'txn1' };
      await paymentsController.getTransaction(req as any, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
