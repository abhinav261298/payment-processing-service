import { Router } from 'express';
import validator from 'express-validator';
import { SubscriptionController } from '../controllers/subscriptionController';
import { validateRequest } from '../middleware/validateRequest';
import { authenticate } from '../middleware/auth';
import { db } from '../db/knex';
import { authorizeNetService } from '../services/authorizenetService';
import { transactionService } from '../services/transactionService';
import SubscriptionService from '../services/subscriptionService';

const router = Router();

const { body, param, query } = validator as any;

// Initialize controller with real services
const subscriptionService = new SubscriptionService(
  db as any,
  authorizeNetService as any,
  transactionService as any
);
const subscriptionController = new SubscriptionController(subscriptionService);

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a new subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - amount
 *               - interval
 *               - paymentMethodId
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the subscription
 *               description:
 *                 type: string
 *                 description: Description of the subscription
 *               amount:
 *                 type: number
 *                 description: Amount to charge for each billing cycle
 *               currency:
 *                 type: string
 *                 default: USD
 *                 description: Currency code (e.g., USD, EUR)
 *               interval:
 *                 type: string
 *                 enum: [day, week, month, year]
 *                 description: Billing interval
 *               intervalCount:
 *                 type: number
 *                 default: 1
 *                 description: Number of intervals between each billing
 *               paymentMethodId:
 *                 type: string
 *                 description: ID of the payment method to use
 *               hasTrial:
 *                 type: boolean
 *                 default: false
 *                 description: Whether the subscription has a trial period
 *               trialDays:
 *                 type: number
 *                 description: Number of days for the trial period
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *     responses:
 *       201:
 *         description: Subscription created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  [
    body('name').isString().notEmpty(),
    body('description').optional().isString(),
    body('amount').isNumeric().toFloat(),
    body('currency').optional().isString().isLength({ min: 3, max: 3 }),
    body('interval').isIn(['day', 'week', 'month', 'year']),
    body('intervalCount').optional().isInt({ min: 1 }).toInt(),
    body('paymentMethodId').isString().notEmpty(),
    body('hasTrial').optional().isBoolean().toBoolean(),
    body('trialDays').optional().isInt({ min: 1 }).toInt(),
    body('metadata').optional().isObject(),
  ],
  validateRequest,
  subscriptionController.createSubscription.bind(subscriptionController)
);

/**
 * @swagger
 * /api/subscriptions/{id}/cancel:
 *   post:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription canceled successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 */
router.post(
  '/:id/cancel',
  authenticate,
  [param('id').isUUID()],
  validateRequest,
  subscriptionController.cancelSubscription.bind(subscriptionController)
);

/**
 * @swagger
 * /api/subscriptions/{id}:
 *   get:
 *     summary: Get subscription details
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *     responses:
 *       200:
 *         description: Subscription details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Subscription not found
 */
router.get(
  '/:id',
  authenticate,
  [param('id').isUUID()],
  validateRequest,
  subscriptionController.getSubscription.bind(subscriptionController)
);

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: List user's subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, canceled, expired, suspended, pending, past_due]
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: List of subscriptions
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  [
    query('status')
      .optional()
      .isIn(['active', 'canceled', 'expired', 'suspended', 'pending', 'past_due']),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
  ],
  validateRequest,
  subscriptionController.listSubscriptions.bind(subscriptionController)
);

export default router;
