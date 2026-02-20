import { updateService } from '../../../application/use-cases/services/UpdateService';

const mockFindOneAndUpdate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Service', () => ({
  Service: {
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('updateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update and return the service', async () => {
    const updatedService = { _id: 'svc1', name: 'Corte Premium', duration: 45, price: 700 };
    mockFindOneAndUpdate.mockResolvedValue(updatedService);

    const result = await updateService({
      serviceId: 'svc1',
      businessId: 'biz1',
      data: { name: 'Corte Premium', price: 700 },
    });

    expect(result.service).toEqual(updatedService);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'svc1', businessId: 'biz1' },
      { $set: { name: 'Corte Premium', price: 700 } },
      { new: true, runValidators: true },
    );
  });

  it('should throw NotFoundError when service not found', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      updateService({ serviceId: 'nonexistent', businessId: 'biz1', data: { name: 'Test' } }),
    ).rejects.toThrow('Service not found');
  });
});
