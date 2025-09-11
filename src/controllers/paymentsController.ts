import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authorizeNetService } from '../services/authorizenetService';
import { transactionService } from '../services/transactionService';
import { TransactionStatus } from '../types/database';

// Use Express.Request as augmented by auth middleware for req.user

export const paymentsController = {
  async purchase(req: Request, res: Response) {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    // Check for idempotency key
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: 'Idempotency-Key header is required',
      });
    }

    // Check if this is a duplicate request
    const existingResponse = await transactionService.checkIdempotency(idempotencyKey, req.path);

    if (existingResponse) {
      return res.status(existingResponse.statusCode).json(existingResponse.response);
    }

    try {
      const { amount, currency, paymentMethod, billingAddress, orderDescription } = req.body;

      // Input validation
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
        });
      }

      if (!currency || typeof currency !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Invalid currency',
        });
      }

      if (
        !paymentMethod ||
        !paymentMethod.cardNumber ||
        !paymentMethod.expirationDate ||
        !paymentMethod.cardCode
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment method',
        });
      }

      // Create a correlation ID for tracing
      const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

      // Create transaction record in our database
      const transaction = await transactionService.createTransaction({
        userId: req.user!.id,
        amount,
        currency,
        status: TransactionStatus.PENDING,
        authorizeNetTransactionId: null,
        correlationId,
        metadata: {
          paymentMethod: {
            last4: paymentMethod.cardNumber.slice(-4),
            expDate: paymentMethod.expirationDate,
          },
          orderDescription,
        },
      });

      // Process payment with Authorize.net
      const paymentResponse = await authorizeNetService.purchase({
        amount,
        currency,
        paymentMethod,
        billingAddress,
        orderDescription,
      });

      // Update transaction with payment gateway response
      await transactionService.updateTransaction(transaction.id, {
        status: paymentResponse.status,
        authorizeNetTransactionId: paymentResponse.transactionId,
        metadata: {
          gatewayResponse: paymentResponse.rawResponse,
        },
      });

      // Log the payment
      await transactionService.logPayment(transaction.id, paymentResponse.rawResponse, 'purchase');

      // Save the response for idempotency
      const responseData = {
        success: paymentResponse.status === TransactionStatus.COMPLETED,
        data: {
          transactionId: transaction.id,
          amount,
          currency,
          status: paymentResponse.status,
          gatewayTransactionId: paymentResponse.transactionId,
        },
      };

      await transactionService.createIdempotencyKey(
        idempotencyKey,
        req.path,
        req.body,
        responseData,
        paymentResponse.status === TransactionStatus.COMPLETED ? 200 : 400
      );

      // Return the response
      return res
        .status(paymentResponse.status === TransactionStatus.COMPLETED ? 200 : 400)
        .json(responseData);
    } catch (error) {
      console.error('Payment processing error:', error);

      // Save error response for idempotency
      const errorResponse = {
        success: false,
        error: 'Payment processing failed',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      };

      try {
        await transactionService.createIdempotencyKey(
          idempotencyKey,
          req.path,
          req.body,
          errorResponse,
          500
        );
      } catch (err) {
        console.error('Failed to save idempotency key:', err);
      }

      return res.status(500).json(errorResponse);
    }
  },

  async authorize(req: Request, res: Response) {
    // Similar implementation to purchase but with authorize instead of purchase
    // ...
  },

  async capture(req: Request, res: Response) {
    try {
      const { transactionId, amount } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required',
        });
      }

      // Process capture with Authorize.net
      const captureResponse = await authorizeNetService.capture(transactionId, amount);

      // Update transaction in our database
      await transactionService.updateTransaction(transactionId, {
        status: captureResponse.status,
      });

      // Log the capture
      await transactionService.logPayment(transactionId, captureResponse.rawResponse, 'capture');

      return res.status(200).json({
        success: captureResponse.status === TransactionStatus.COMPLETED,
        data: {
          transactionId,
          status: captureResponse.status,
          gatewayTransactionId: captureResponse.transactionId,
        },
      });
    } catch (error) {
      console.error('Capture error:', error);
      return res.status(500).json({
        success: false,
        error: 'Capture failed',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      });
    }
  },

  async void(req: Request, res: Response) {
    try {
      const { transactionId } = req.body;

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID is required',
        });
      }

      // Process void with Authorize.net
      const voidResponse = await authorizeNetService.void(transactionId);

      // Update transaction in our database
      await transactionService.updateTransaction(transactionId, {
        status: voidResponse.status,
      });

      // Log the void
      await transactionService.logPayment(transactionId, voidResponse.rawResponse, 'void');

      return res.status(200).json({
        success: voidResponse.status === TransactionStatus.COMPLETED,
        data: {
          transactionId,
          status: voidResponse.status,
          gatewayTransactionId: voidResponse.transactionId,
        },
      });
    } catch (error) {
      console.error('Void error:', error);
      return res.status(500).json({
        success: false,
        error: 'Void failed',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      });
    }
  },

  async refund(req: Request, res: Response) {
    try {
      const { transactionId, amount, paymentMethod } = req.body;

      if (!transactionId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'Transaction ID and amount are required',
        });
      }

      // Process refund with Authorize.net
      const refundResponse = await authorizeNetService.refund(transactionId, amount, {
        amount,
        currency: req.body.currency || 'USD',
        paymentMethod,
      });

      // Update transaction in our database
      await transactionService.updateTransaction(transactionId, {
        status: refundResponse.status,
      });

      // Log the refund
      await transactionService.logPayment(transactionId, refundResponse.rawResponse, 'refund');

      return res.status(200).json({
        success: refundResponse.status === TransactionStatus.COMPLETED,
        data: {
          transactionId,
          amount,
          status: refundResponse.status,
          gatewayTransactionId: refundResponse.transactionId,
        },
      });
    } catch (error) {
      console.error('Refund error:', error);
      return res.status(500).json({
        success: false,
        error: 'Refund failed',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      });
    }
  },

  async getTransaction(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const transaction = await transactionService.getTransactionById(id);

      if (!transaction) {
        return res.status(404).json({
          success: false,
          error: 'Transaction not found',
        });
      }

      // Ensure the user has access to this transaction
      if (transaction.user_id !== req.user?.id) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this transaction',
        });
      }

      return res.status(200).json({
        success: true,
        data: transaction,
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve transaction',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      });
    }
  },
};
