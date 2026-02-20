import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';
import { NotFoundError } from '../../../presentation/middleware/errorHandler.js';

export interface GetStaffInput {
  staffId: string;
  businessId: string;
}

export interface GetStaffResult {
  staff: any;
}

export async function getStaff(input: GetStaffInput): Promise<GetStaffResult> {
  const staff = await Staff.findOne({
    _id: input.staffId,
    businessId: input.businessId,
  }).populate('services', 'name duration price');

  if (!staff) throw new NotFoundError('Staff member not found');

  return { staff };
}
