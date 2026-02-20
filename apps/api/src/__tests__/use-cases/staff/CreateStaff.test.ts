import { createStaff } from '../../../application/use-cases/staff/CreateStaff';

const mockStaffSave = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../infrastructure/database/mongodb/models/Staff', () => ({
  Staff: jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'staff1',
    save: mockStaffSave,
  })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('createStaff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a staff member with default schedule', async () => {
    const result = await createStaff({
      businessId: 'biz1',
      profile: { firstName: 'María', lastName: 'González' },
    });

    expect(result.staff).toBeDefined();
    expect(result.staff.profile.firstName).toBe('María');
    expect(result.staff.businessId).toBe('biz1');
    expect(result.staff.status).toBe('active');
    expect(result.staff.schedule).toEqual({ useBusinessSchedule: true, custom: [] });
    expect(mockStaffSave).toHaveBeenCalled();
  });

  it('should create staff with contact and services', async () => {
    const result = await createStaff({
      businessId: 'biz1',
      profile: { firstName: 'Juan', lastName: 'Pérez', bio: 'Estilista senior' },
      contact: { email: 'juan@test.com', phone: '+5491155554444' },
      services: ['svc1', 'svc2'],
    });

    expect(result.staff.contact.email).toBe('juan@test.com');
    expect(result.staff.services).toEqual(['svc1', 'svc2']);
  });
});
