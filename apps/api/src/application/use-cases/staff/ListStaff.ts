import { Staff } from '../../../infrastructure/database/mongodb/models/Staff.js';

export interface ListStaffInput {
  businessId: string;
}

export interface ListStaffResult {
  staff: any[];
}

export async function listStaff(input: ListStaffInput): Promise<ListStaffResult> {
  const staff = await Staff.find({
    businessId: input.businessId,
    status: { $ne: 'deleted' },
  })
    .populate('services', 'name')
    .sort({ order: 1, 'profile.firstName': 1 });

  return { staff };
}
