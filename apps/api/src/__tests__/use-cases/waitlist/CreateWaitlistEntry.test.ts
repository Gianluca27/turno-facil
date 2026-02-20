import { createWaitlistEntry } from '../../../application/use-cases/waitlist/CreateWaitlistEntry';

const mockWaitlistSave = jest.fn().mockResolvedValue(undefined);
const mockWaitlistFindOne = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Waitlist', () => ({
  Waitlist: Object.assign(
    jest.fn().mockImplementation((data: any) => ({
      ...data,
      _id: 'wl1',
      save: mockWaitlistSave,
    })),
    {
      findOne: (...args: any[]) => mockWaitlistFindOne(...args),
    },
  ),
}));

jest.mock('../../../infrastructure/database/mongodb/models/User', () => ({
  User: {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'client1', profile: { firstName: 'Test' } }),
    }),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Service', () => ({
  Service: {
    find: jest.fn().mockResolvedValue([{ _id: 'svc1' }]),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Staff', () => ({
  Staff: {
    findOne: jest.fn().mockResolvedValue({ _id: 'staff1' }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('createWaitlistEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWaitlistFindOne.mockResolvedValue(null); // no duplicate
  });

  it('should create a waitlist entry with default expiry', async () => {
    const result = await createWaitlistEntry({
      businessId: 'biz1',
      clientId: 'client1',
      preferences: { services: ['svc1'] },
    });

    expect(result.entry).toBeDefined();
    expect(result.entry.businessId).toBe('biz1');
    expect(result.entry.clientId).toBe('client1');
    expect(result.entry.status).toBe('active');
    expect(result.entry.priority).toBe('normal');
    expect(mockWaitlistSave).toHaveBeenCalled();
  });

  it('should throw ConflictError for duplicate entry', async () => {
    mockWaitlistFindOne.mockResolvedValue({ _id: 'existing' });

    await expect(
      createWaitlistEntry({
        businessId: 'biz1',
        clientId: 'client1',
        preferences: { services: ['svc1'] },
      }),
    ).rejects.toThrow('Client already has a waitlist entry for this service');
  });

  it('should throw NotFoundError when client not found', async () => {
    const { User } = require('../../../infrastructure/database/mongodb/models/User');
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(
      createWaitlistEntry({
        businessId: 'biz1',
        clientId: 'nonexistent',
        preferences: { services: ['svc1'] },
      }),
    ).rejects.toThrow('Client not found');
  });
});
