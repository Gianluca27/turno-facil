import mongoose from 'mongoose';
import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface CashMovementInput {
  businessId: string;
  userId: string;
  type: 'in' | 'out';
  amount: number;
  reason: string;
  notes?: string;
}

export interface CashMovementResult {
  movement: {
    type: 'in' | 'out';
    amount: number;
    reason: string;
    notes?: string;
    recordedAt: Date;
    recordedBy: mongoose.Types.ObjectId;
  };
}

export async function cashMovement(input: CashMovementInput): Promise<CashMovementResult> {
  const { businessId, userId, type, amount, reason, notes } = input;

  const register = await CashRegister.findOne({
    businessId,
    status: 'open',
  });

  if (!register) {
    throw new NotFoundError('No open cash register found');
  }

  const movement = {
    type,
    amount,
    reason,
    notes,
    recordedAt: new Date(),
    recordedBy: new mongoose.Types.ObjectId(userId),
  };

  register.movements.push(movement);
  await register.save();

  logger.info('Cash movement recorded', {
    registerId: register._id,
    businessId,
    type,
    amount,
    reason,
  });

  return { movement };
}
