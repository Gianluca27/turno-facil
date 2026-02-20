import { inviteTeamMember } from '../../../application/use-cases/team/InviteTeamMember';

const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockSave = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../infrastructure/database/mongodb/models/User', () => ({
  User: {
    findOne: (...args: any[]) => mockFindOne(...args),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Business', () => ({
  Business: {
    findById: (...args: any[]) => {
      return mockFindById(...args);
    },
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('inviteTeamMember', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an invitation for a new user', async () => {
    mockFindOne.mockResolvedValue(null); // user not found
    mockFindById.mockResolvedValue({
      _id: 'biz1',
      ownerId: { toString: () => 'owner1' },
      team: [],
      pendingInvitations: [],
      save: mockSave,
    });

    const result = await inviteTeamMember({
      businessId: '507f1f77bcf86cd799439011',
      invitedByUserId: '507f1f77bcf86cd799439012',
      email: 'new@test.com',
      role: 'employee',
    });

    expect(result.invitation).toBeDefined();
    expect(result.invitation.email).toBe('new@test.com');
    expect(result.invitation.role).toBe('employee');
    expect(result.invitation.token).toBeUndefined(); // token should be hidden
    expect(mockSave).toHaveBeenCalled();
  });

  it('should throw ConflictError if user is already a member', async () => {
    mockFindOne.mockResolvedValue({ _id: 'user2', toString: () => 'user2' });
    mockFindById.mockResolvedValue({
      _id: 'biz1',
      ownerId: { toString: () => 'owner1' },
      team: [{ userId: { toString: () => 'user2' } }],
      pendingInvitations: [],
      save: mockSave,
    });

    await expect(
      inviteTeamMember({
        businessId: '507f1f77bcf86cd799439011',
        invitedByUserId: '507f1f77bcf86cd799439012',
        email: 'existing@test.com',
        role: 'employee',
      }),
    ).rejects.toThrow('User is already a team member');
  });

  it('should throw NotFoundError when business not found', async () => {
    mockFindOne.mockResolvedValue(null);
    mockFindById.mockResolvedValue(null);

    await expect(
      inviteTeamMember({
        businessId: '507f1f77bcf86cd799439099',
        invitedByUserId: '507f1f77bcf86cd799439012',
        email: 'test@test.com',
        role: 'employee',
      }),
    ).rejects.toThrow('Business not found');
  });
});
