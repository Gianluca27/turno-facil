import { listClients } from '../../../application/use-cases/clients/ListClients';

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/ClientBusinessRelation', () => ({
  ClientBusinessRelation: {
    find: (...args: any[]) => {
      mockFind(...args);
      return {
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue([
                { _id: 'rel1', clientId: { profile: { firstName: 'Test' } } },
              ]),
            }),
          }),
        }),
      };
    },
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
  },
}));

describe('listClients', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(1);
  });

  it('should list clients with pagination', async () => {
    const result = await listClients({
      businessId: 'biz1',
      page: 1,
      limit: 20,
    });

    expect(result.clients).toHaveLength(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(1);
    expect(mockFind).toHaveBeenCalledWith({ businessId: 'biz1' });
  });

  it('should filter by VIP segment', async () => {
    await listClients({
      businessId: 'biz1',
      segment: 'vip',
      page: 1,
      limit: 20,
    });

    expect(mockFind).toHaveBeenCalledWith({ businessId: 'biz1', 'clientInfo.tags': 'VIP' });
  });

  it('should filter by blocked segment', async () => {
    await listClients({
      businessId: 'biz1',
      segment: 'blocked',
      page: 1,
      limit: 20,
    });

    expect(mockFind).toHaveBeenCalledWith({ businessId: 'biz1', isBlocked: true });
  });

  it('should filter by inactive segment', async () => {
    await listClients({
      businessId: 'biz1',
      segment: 'inactive',
      page: 1,
      limit: 20,
    });

    const callArgs = mockFind.mock.calls[0][0];
    expect(callArgs.businessId).toBe('biz1');
    expect(callArgs['stats.lastVisit']).toBeDefined();
    expect(callArgs['stats.lastVisit'].$lt).toBeInstanceOf(Date);
  });
});
