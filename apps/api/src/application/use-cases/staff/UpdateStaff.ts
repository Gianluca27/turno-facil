import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

export interface UpdateStaffInput {
  staffId: string;
  businessId: string;
  data: {
    profile?: {
      firstName?: string;
      lastName?: string;
      displayName?: string;
      bio?: string;
      specialties?: string[];
    };
    contact?: {
      email?: string;
      phone?: string;
    };
    services?: string[];
  };
}

export interface UpdateStaffResult {
  staff: any;
}

export async function updateStaff(input: UpdateStaffInput): Promise<UpdateStaffResult> {
  const { staffId, businessId, data } = input;

  const staff = await Staff.findOneAndUpdate(
    { _id: staffId, businessId },
    { $set: data },
    { new: true },
  );

  if (!staff) throw new NotFoundError('Staff member not found');

  logger.info('Staff member updated', { staffId, businessId });

  return { staff };
}
