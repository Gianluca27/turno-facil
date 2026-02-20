import { deleteService } from '../../../application/use-cases/services/DeleteService';

const mockFindOneAndUpdate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Service', () => ({
  Service: {
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('deleteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should soft-delete the service by setting status to deleted', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'svc1', status: 'deleted' });

    await deleteService({ serviceId: 'svc1', businessId: 'biz1' });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'svc1', businessId: 'biz1' },
      { status: 'deleted' },
      { new: true },
    );
  });

  it('should throw NotFoundError when service not found', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      deleteService({ serviceId: 'nonexistent', businessId: 'biz1' }),
    ).rejects.toThrow('Service not found');
  });
});
