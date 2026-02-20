import { blockClient, unblockClient, toggleVip } from '../../../application/use-cases/clients/UpdateClientRelation';

const mockFindOneAndUpdate = jest.fn();
const mockFindOne = jest.fn();
const mockFindByIdAndUpdate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/ClientBusinessRelation', () => ({
  ClientBusinessRelation: {
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
    findOne: (...args: any[]) => mockFindOne(...args),
    findByIdAndUpdate: (...args: any[]) => mockFindByIdAndUpdate(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('blockClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should block a client with reason', async () => {
    const blocked = { _id: 'rel1', isBlocked: true, blockedReason: 'No-show repeat' };
    mockFindOneAndUpdate.mockResolvedValue(blocked);

    const result = await blockClient({
      clientRelationId: 'rel1',
      businessId: 'biz1',
      reason: 'No-show repeat',
    });

    expect(result.client.isBlocked).toBe(true);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'rel1', businessId: 'biz1' },
      expect.objectContaining({ isBlocked: true, blockedReason: 'No-show repeat' }),
      { new: true },
    );
  });

  it('should throw NotFoundError when client not found', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      blockClient({ clientRelationId: 'x', businessId: 'biz1' }),
    ).rejects.toThrow('Client not found');
  });
});

describe('unblockClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should unblock a client', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'rel1', isBlocked: false });

    const result = await unblockClient({ clientRelationId: 'rel1', businessId: 'biz1' });

    expect(result.client.isBlocked).toBe(false);
  });
});

describe('toggleVip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add VIP tag when not present', async () => {
    mockFindOne.mockResolvedValue({ _id: 'rel1', clientInfo: { tags: [] } });
    mockFindByIdAndUpdate.mockResolvedValue({ _id: 'rel1', clientInfo: { tags: ['VIP'] } });

    const result = await toggleVip({ clientRelationId: 'rel1', businessId: 'biz1' });

    expect(result.isVip).toBe(true);
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      'rel1',
      { $addToSet: { 'clientInfo.tags': 'VIP' } },
      { new: true },
    );
  });

  it('should remove VIP tag when present', async () => {
    mockFindOne.mockResolvedValue({ _id: 'rel1', clientInfo: { tags: ['VIP', 'regular'] } });
    mockFindByIdAndUpdate.mockResolvedValue({ _id: 'rel1', clientInfo: { tags: ['regular'] } });

    const result = await toggleVip({ clientRelationId: 'rel1', businessId: 'biz1' });

    expect(result.isVip).toBe(false);
    expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
      'rel1',
      { $pull: { 'clientInfo.tags': 'VIP' } },
      { new: true },
    );
  });

  it('should throw NotFoundError when client not found', async () => {
    mockFindOne.mockResolvedValue(null);

    await expect(
      toggleVip({ clientRelationId: 'x', businessId: 'biz1' }),
    ).rejects.toThrow('Client not found');
  });
});
