import { Router } from 'express';
import { paymentsController } from '../controllers/paymentsController';
import { authMiddleware } from '../middleware/auth';
import validator from 'express-validator';

const { body, param } = validator as any;

const router = Router();

// Apply auth middleware to all payment routes
router.use(authMiddleware);

// Process a payment
router.post(
  '/purchase',
  [
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('paymentMethod.cardNumber').isCreditCard(),
    body('paymentMethod.expirationDate').matches(/^(0[1-9]|1[0-2])\/([0-9]{4}|[0-9]{2})$/),
    body('paymentMethod.cardCode').isString().isLength({ min: 3, max: 4 }),
    body('billingAddress').optional().isObject(),
    body('orderDescription').optional().isString(),
  ],
  paymentsController.purchase
);

// Authorize a payment (without capturing)
router.post(
  '/authorize',
  [
    body('amount').isFloat({ gt: 0 }),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('paymentMethod.cardNumber').isCreditCard(),
    body('paymentMethod.expirationDate').matches(/^(0[1-9]|1[0-2])\/([0-9]{4}|[0-9]{2})$/),
    body('paymentMethod.cardCode').isString().isLength({ min: 3, max: 4 }),
    body('billingAddress').optional().isObject(),
    body('orderDescription').optional().isString(),
  ],
  paymentsController.authorize
);

// Capture a previously authorized payment
router.post(
  '/capture',
  [body('transactionId').isString().notEmpty(), body('amount').isFloat({ gt: 0 })],
  paymentsController.capture
);

// Void a transaction
router.post('/void', [body('transactionId').isString().notEmpty()], paymentsController.void);

// Refund a transaction
router.post(
  '/refund',
  [
    body('transactionId').isString().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('paymentMethod').isObject(),
  ],
  paymentsController.refund
);

// Get transaction details
router.get('/transactions/:id', [param('id').isUUID()], paymentsController.getTransaction);

export { router as paymentsRouter };
