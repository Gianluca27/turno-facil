/**
 * AuthService unit tests.
 *
 * These test the pure/stateless logic of the service. Database
 * interactions are mocked via jest to avoid needing a running MongoDB.
 */
import jwt from 'jsonwebtoken';

// Mock config before importing AuthService
jest.mock('../../config/index', () => ({
  __esModule: true,
  default: {
    jwt: {
      accessSecret: 'test-access-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '30d',
      issuer: 'turnofacil-test',
      audience: 'turnofacil-app-test',
    },
    security: {
      bcryptRounds: 4, // fast for tests
    },
  },
}));

// Mock database
jest.mock('../../config/database', () => ({
  getRedisClient: () => ({
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
  }),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock User model
const mockUserFindByIdAndUpdate = jest.fn().mockResolvedValue(null);
const mockUserFindOne = jest.fn().mockResolvedValue(null);
const mockUserFindById = jest.fn().mockResolvedValue(null);

jest.mock('../../infrastructure/database/mongodb/models/User', () => ({
  User: {
    findByIdAndUpdate: (...args: any[]) => mockUserFindByIdAndUpdate(...args),
    findOne: (...args: any[]) => mockUserFindOne(...args),
    findById: (...args: any[]) => ({
      select: (fields: string) => mockUserFindById(fields),
    }),
  },
}));

// Mock BusinessUser model
const mockBusinessUserFindByIdAndUpdate = jest.fn().mockResolvedValue(null);
const mockBusinessUserFindOne = jest.fn().mockResolvedValue(null);
const mockBusinessUserFindById = jest.fn().mockResolvedValue(null);

jest.mock('../../infrastructure/database/mongodb/models/BusinessUser', () => ({
  BusinessUser: {
    findByIdAndUpdate: (...args: any[]) => mockBusinessUserFindByIdAndUpdate(...args),
    findOne: (...args: any[]) => mockBusinessUserFindOne(...args),
    findById: (...args: any[]) => ({
      select: (fields: string) => mockBusinessUserFindById(fields),
    }),
  },
}));

// Import after mocks
import { authService } from '../../domain/services/AuthService';

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens for a user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const result = await authService.generateTokens(userId, 'user');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(900);
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should generate valid JWT access token with correct payload', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const result = await authService.generateTokens(userId, 'user');

      const decoded = jwt.verify(result.accessToken, 'test-access-secret', {
        issuer: 'turnofacil-test',
        audience: 'turnofacil-app-test',
      }) as any;

      expect(decoded.sub).toBe(userId);
      expect(decoded.type).toBe('user');
      expect(decoded.jti).toBeDefined();
      expect(decoded.iss).toBe('turnofacil-test');
      expect(decoded.aud).toBe('turnofacil-app-test');
    });

    it('should generate token with business_user type', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const result = await authService.generateTokens(userId, 'business_user');

      const decoded = jwt.verify(result.accessToken, 'test-access-secret', {
        issuer: 'turnofacil-test',
        audience: 'turnofacil-app-test',
      }) as any;

      expect(decoded.type).toBe('business_user');
    });

    it('should save refresh token to User model when type is user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.generateTokens(userId, 'user', 'iPhone14');

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalled();
      expect(mockBusinessUserFindByIdAndUpdate).not.toHaveBeenCalled();

      // First call pushes the token, second call trims to 5
      const firstCall = mockUserFindByIdAndUpdate.mock.calls[0];
      expect(firstCall[0]).toBe(userId);
      expect(firstCall[1].$push.refreshTokens.device).toBe('iPhone14');
    });

    it('should save refresh token to BusinessUser model when type is business_user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.generateTokens(userId, 'business_user');

      expect(mockBusinessUserFindByIdAndUpdate).toHaveBeenCalled();
      // User should not be updated
      expect(mockUserFindByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('revokeToken', () => {
    it('should blacklist token in Redis', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const { accessToken } = await authService.generateTokens(userId, 'user');

      // Should not throw
      await authService.revokeToken(accessToken);
    });

    it('should handle invalid token gracefully', async () => {
      // Should not throw
      await authService.revokeToken('invalid-token');
    });
  });

  describe('revokeAllTokens', () => {
    it('should clear refresh tokens in both User and BusinessUser', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.revokeAllTokens(userId);

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshTokens: [] });
      expect(mockBusinessUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshTokens: [] });
    });
  });

  describe('logout', () => {
    it('should remove specific refresh token for user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.logout(userId, 'some-refresh-token', 'user');

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $pull: { refreshTokens: { token: 'some-refresh-token' } },
      });
    });

    it('should remove all refresh tokens when no specific token provided', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.logout(userId, undefined, 'user');

      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, { refreshTokens: [] });
    });

    it('should target BusinessUser model for business_user type', async () => {
      const userId = '507f1f77bcf86cd799439011';
      await authService.logout(userId, 'some-token', 'business_user');

      expect(mockBusinessUserFindByIdAndUpdate).toHaveBeenCalledWith(userId, {
        $pull: { refreshTokens: { token: 'some-token' } },
      });
      expect(mockUserFindByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should throw BadRequestError when user not found', async () => {
      mockUserFindById.mockResolvedValueOnce(null);

      await expect(
        authService.changePassword('nonexistent', 'old', 'new', 'user'),
      ).rejects.toThrow('User not found');
    });

    it('should throw BadRequestError when no password is set', async () => {
      mockUserFindById.mockResolvedValueOnce({
        password: null,
        comparePassword: jest.fn(),
        save: jest.fn(),
      });

      await expect(
        authService.changePassword('user1', 'old', 'new', 'user'),
      ).rejects.toThrow('No password set');
    });

    it('should throw UnauthorizedError when current password is wrong', async () => {
      mockUserFindById.mockResolvedValueOnce({
        password: 'hashed',
        comparePassword: jest.fn().mockResolvedValue(false),
        save: jest.fn(),
      });

      await expect(
        authService.changePassword('user1', 'wrong', 'new', 'user'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should update password and revoke tokens on success', async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockUser = {
        password: 'hashed',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: mockSave,
      };
      mockUserFindById.mockResolvedValueOnce(mockUser);

      await authService.changePassword('user1', 'correct', 'newpass', 'user');

      expect(mockUser.password).toBe('newpass');
      expect(mockSave).toHaveBeenCalled();
      expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith('user1', { refreshTokens: [] });
    });
  });
});
