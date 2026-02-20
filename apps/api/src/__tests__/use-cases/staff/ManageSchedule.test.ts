import { updateSchedule, addException, assignServices } from '../../../application/use-cases/staff/ManageSchedule';

const mockFindOneAndUpdate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Staff', () => ({
  Staff: {
    findOneAndUpdate: (...args: any[]) => {
      const result = mockFindOneAndUpdate(...args);
      return { populate: jest.fn().mockReturnValue(result), ...result, then: result.then?.bind(result) };
    },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('updateSchedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update staff schedule', async () => {
    const updatedStaff = { _id: 'staff1', schedule: { useBusinessSchedule: false, custom: [{ day: 1, from: '09:00', to: '18:00' }] } };
    mockFindOneAndUpdate.mockResolvedValue(updatedStaff);

    const result = await updateSchedule({
      staffId: 'staff1',
      businessId: 'biz1',
      useBusinessSchedule: false,
      custom: [{ day: 1, from: '09:00', to: '18:00' }],
    });

    expect(result.staff).toEqual(updatedStaff);
  });

  it('should throw NotFoundError when staff not found', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      updateSchedule({ staffId: 'nonexistent', businessId: 'biz1', useBusinessSchedule: true }),
    ).rejects.toThrow('Staff member not found');
  });
});

describe('addException', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add schedule exception', async () => {
    const updatedStaff = { _id: 'staff1', exceptions: [{ startDate: new Date(), endDate: new Date(), type: 'vacation' }] };
    mockFindOneAndUpdate.mockResolvedValue(updatedStaff);

    const result = await addException({
      staffId: 'staff1',
      businessId: 'biz1',
      startDate: '2026-03-01',
      endDate: '2026-03-05',
      type: 'vacation',
      reason: 'Family vacation',
    });

    expect(result.staff).toBeDefined();
  });

  it('should throw NotFoundError when staff not found', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      addException({ staffId: 'x', businessId: 'biz1', startDate: '2026-01-01', endDate: '2026-01-02', type: 'vacation' }),
    ).rejects.toThrow('Staff member not found');
  });
});
