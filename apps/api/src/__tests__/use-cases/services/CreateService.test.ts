import { createService } from '../../../application/use-cases/services/CreateService';

const mockServiceSave = jest.fn().mockResolvedValue(undefined);
const mockStaffUpdateMany = jest.fn().mockResolvedValue({ modifiedCount: 2 });
const mockBusinessFindById = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Service', () => ({
  Service: jest.fn().mockImplementation((data: any) => ({
    ...data,
    _id: 'svc1',
    save: mockServiceSave,
  })),
}));

jest.mock('../../../infrastructure/database/mongodb/models/Business', () => ({
  Business: {
    findById: (...args: any[]) => mockBusinessFindById(...args),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Staff', () => ({
  Staff: {
    updateMany: (...args: any[]) => mockStaffUpdateMany(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('createService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a service and return it', async () => {
    mockBusinessFindById.mockResolvedValue({ _id: 'biz1', status: 'active' });

    const result = await createService({
      businessId: 'biz1',
      name: 'Corte de pelo',
      duration: 30,
      price: 500,
    });

    expect(result.service).toBeDefined();
    expect(result.service.name).toBe('Corte de pelo');
    expect(result.service.businessId).toBe('biz1');
    expect(result.service.status).toBe('active');
    expect(mockServiceSave).toHaveBeenCalled();
  });

  it('should throw NotFoundError when business not found', async () => {
    mockBusinessFindById.mockResolvedValue(null);

    await expect(
      createService({ businessId: 'nonexistent', name: 'Test', duration: 30, price: 100 }),
    ).rejects.toThrow('Business not found');
  });

  it('should assign service to staff when staffIds provided', async () => {
    mockBusinessFindById.mockResolvedValue({ _id: 'biz1' });

    await createService({
      businessId: 'biz1',
      name: 'Manicura',
      duration: 45,
      price: 800,
      staffIds: ['staff1', 'staff2'],
    });

    expect(mockStaffUpdateMany).toHaveBeenCalledWith(
      { _id: { $in: ['staff1', 'staff2'] }, businessId: 'biz1' },
      { $addToSet: { services: 'svc1' } },
    );
  });

  it('should not assign staff when no staffIds provided', async () => {
    mockBusinessFindById.mockResolvedValue({ _id: 'biz1' });

    await createService({
      businessId: 'biz1',
      name: 'Corte',
      duration: 30,
      price: 500,
    });

    expect(mockStaffUpdateMany).not.toHaveBeenCalled();
  });
});
