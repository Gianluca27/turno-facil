import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface DeleteStaffInput {
  staffId: string;
  businessId: string;
}

export async function deleteStaff(input: DeleteStaffInput): Promise<void> {
  const { staffId, businessId } = input;

  const staff = await Staff.findOneAndUpdate(
    { _id: staffId, businessId },
    { status: 'deleted' },
    { new: true },
  );

  if (!staff) throw new NotFoundError('Staff member not found');

  logger.info('Staff member deleted (soft)', { staffId, businessId });
}
