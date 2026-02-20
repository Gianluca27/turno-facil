import { CashRegister } from '../../../infrastructure/database/mongodb/models/CashRegister.js';
import { ConflictError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface OpenCashRegisterInput {
  businessId: string;
  userId: string;
  initialAmount: number;
  notes?: string;
}

export interface OpenCashRegisterResult {
  register: any;
}

export async function openCashRegister(input: OpenCashRegisterInput): Promise<OpenCashRegisterResult> {
  const { businessId, userId, initialAmount, notes } = input;

  // Check if there's already an open register
  const existingOpen = await CashRegister.findOne({
    businessId,
    status: 'open',
  });

  if (existingOpen) {
    throw new ConflictError('There is already an open cash register. Please close it first.');
  }

  const register = new CashRegister({
    businessId,
    openedAt: new Date(),
    openedBy: userId,
    initialAmount,
    status: 'open',
    movements: [],
    notes,
  });

  await register.save();

  logger.info('Cash register opened', {
    registerId: register._id,
    businessId,
    initialAmount,
  });

  return { register };
}
