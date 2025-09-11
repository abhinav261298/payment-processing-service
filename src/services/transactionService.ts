import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/knex';
import { TransactionStatus, Transaction } from '../types/database';

export interface CreateTransactionParams {
  userId: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  authorizeNetTransactionId: string | null;
  correlationId: string;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionParams {
  status?: TransactionStatus;
  authorizeNetTransactionId?: string;
  metadata?: Record<string, any>;
}

export class TransactionService {
  async createTransaction(params: CreateTransactionParams): Promise<Transaction> {
    const [transaction] = await db('transactions')
      .insert({
        id: uuidv4(),
        user_id: params.userId,
        amount: params.amount,
        currency: params.currency,
        status: params.status,
        authorize_net_transaction_id: params.authorizeNetTransactionId,
        correlation_id: params.correlationId,
        metadata: params.metadata || {},
      })
      .returning('*');

    return transaction;
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    return db('transactions').where({ id }).first();
  }

  async getTransactionByAuthorizeNetId(authorizeNetId: string): Promise<Transaction | undefined> {
    return db('transactions').where({ authorize_net_transaction_id: authorizeNetId }).first();
  }

  async updateTransaction(
    id: string,
    updates: UpdateTransactionParams
  ): Promise<Transaction | undefined> {
    const updateData: any = {
      updated_at: db.fn.now(),
    };

    if (updates.status) updateData.status = updates.status;
    if (updates.authorizeNetTransactionId) {
      updateData.authorize_net_transaction_id = updates.authorizeNetTransactionId;
    }
    if (updates.metadata) {
      updateData.metadata = db.raw('metadata || ?', [JSON.stringify(updates.metadata)]);
    }

    const [updatedTransaction] = await db('transactions')
      .where({ id })
      .update(updateData)
      .returning('*');

    return updatedTransaction;
  }

  async logPayment(
    transactionId: string,
    gatewayResponse: Record<string, any>,
    action: string
  ): Promise<void> {
    await db('payment_logs').insert({
      id: uuidv4(),
      transaction_id: transactionId,
      action,
      gateway_response: gatewayResponse,
      created_at: new Date(),
    });
  }

  async checkIdempotency(
    idempotencyKey: string,
    requestPath: string
  ): Promise<{ response: any; statusCode: number } | null> {
    const record = await db('idempotency_keys')
      .where({ key: idempotencyKey, request_path: requestPath })
      .andWhere('expires_at', '>', new Date())
      .first();

    if (!record) {
      return null;
    }

    return {
      response: record.response,
      statusCode: record.status_code,
    };
  }

  async createIdempotencyKey(
    key: string,
    requestPath: string,
    requestParams: Record<string, any>,
    response: any,
    statusCode: number
  ): Promise<void> {
    // Set expiration to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await db('idempotency_keys').insert({
      id: uuidv4(),
      key,
      request_path: requestPath,
      request_params: requestParams,
      response,
      status_code: statusCode,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }
}

export const transactionService = new TransactionService();
