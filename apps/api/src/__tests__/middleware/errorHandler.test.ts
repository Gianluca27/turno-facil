import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
} from '../../presentation/middleware/errorHandler';

describe('Error classes', () => {
  describe('AppError', () => {
    it('should create with default values', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should create with custom status code', () => {
      const error = new AppError('Custom', 418);
      expect(error.statusCode).toBe(418);
    });

    it('should accept isOperational option', () => {
      const error = new AppError('Fatal', 500, { isOperational: false });
      expect(error.isOperational).toBe(false);
    });

    it('should accept code and details', () => {
      const error = new AppError('With details', 400, {
        code: 'CUSTOM_CODE',
        details: { field: 'email' },
      });
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('BadRequestError', () => {
    it('should default to 400 status', () => {
      const error = new BadRequestError();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Bad request');
    });

    it('should accept custom message', () => {
      const error = new BadRequestError('Invalid email');
      expect(error.message).toBe('Invalid email');
    });

    it('should accept details', () => {
      const error = new BadRequestError('Validation failed', { fields: ['email'] });
      expect(error.details).toEqual({ fields: ['email'] });
    });
  });

  describe('UnauthorizedError', () => {
    it('should default to 401', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should default to 403', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('NotFoundError', () => {
    it('should default to 404', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should accept custom message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should default to 409', () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should default to 422', () => {
      const error = new ValidationError();
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should accept validation details', () => {
      const details = [
        { field: 'email', message: 'Invalid format' },
        { field: 'password', message: 'Too short' },
      ];
      const error = new ValidationError('Validation failed', details);
      expect(error.details).toEqual(details);
    });
  });

  describe('TooManyRequestsError', () => {
    it('should default to 429', () => {
      const error = new TooManyRequestsError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });
  });

  describe('InternalServerError', () => {
    it('should default to 500 and non-operational', () => {
      const error = new InternalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Error hierarchy', () => {
    it('all errors should be instances of AppError', () => {
      expect(new BadRequestError()).toBeInstanceOf(AppError);
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
      expect(new NotFoundError()).toBeInstanceOf(AppError);
      expect(new ConflictError()).toBeInstanceOf(AppError);
      expect(new ValidationError()).toBeInstanceOf(AppError);
      expect(new TooManyRequestsError()).toBeInstanceOf(AppError);
      expect(new InternalServerError()).toBeInstanceOf(AppError);
    });

    it('all errors should be instances of Error', () => {
      expect(new BadRequestError()).toBeInstanceOf(Error);
      expect(new NotFoundError()).toBeInstanceOf(Error);
    });

    it('all operational errors should be catchable with try/catch', () => {
      expect(() => {
        throw new BadRequestError('test');
      }).toThrow('test');
    });
  });
});
