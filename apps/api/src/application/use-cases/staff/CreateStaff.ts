import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { logger } from '../../../utils/logger.js';

export interface CreateStaffInput {
  businessId: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName?: string;
    bio?: string;
    specialties?: string[];
  };
  contact?: {
    email?: string;
    phone?: string;
  };
  services?: string[];
}

export interface CreateStaffResult {
  staff: any;
}

export async function createStaff(input: CreateStaffInput): Promise<CreateStaffResult> {
  const { businessId, ...data } = input;

  const staff = new Staff({
    ...data,
    businessId,
    schedule: { useBusinessSchedule: true, custom: [] },
    status: 'active',
  });

  await staff.save();

  logger.info('Staff member created', { staffId: staff._id, businessId });

  return { staff };
}
