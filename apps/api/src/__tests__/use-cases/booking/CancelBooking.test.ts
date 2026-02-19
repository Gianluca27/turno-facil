import { cancelBooking } from '../../../application/use-cases/booking/CancelBooking';

// Mock models
const mockAppointmentFindOne = jest.fn();
const mockUserFindByIdAndUpdate = jest.fn().mockResolvedValue(null);

jest.mock('../../../infrastructure/database/mongodb/models/Appointment', () => ({
  Appointment: {
    findOne: (...args: any[]) => mockAppointmentFindOne(...args),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/User', () => ({
  User: {
    findByIdAndUpdate: (...args: any[]) => mockUserFindByIdAndUpdate(...args),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Business', () => ({
  Business: {},
}));

jest.mock('../../../domain/services/NotificationService', () => ({
  notificationService: {
    cancelReminders: jest.fn().mockResolvedValue(undefined),
    sendBookingCancellation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function createMockAppointment(overrides: Record<string, any> = {}) {
  const base = {
    _id: 'apt1',
    clientId: 'user1',
    status: 'confirmed',
    startDateTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
    pricing: {
      deposit: 500,
      depositPaid: true,
      total: 2000,
    },
    cancellation: null,
    save: jest.fn().mockResolvedValue(undefined),
    businessId: {
      _id: { toString: () => 'biz1' },
      bookingConfig: {
        cancellationPolicy: {
          allowCancellation: true,
          hoursBeforeAppointment: 24,
          penaltyType: 'percentage',
          penaltyAmount: 50,
        },
      },
      ...overrides.business,
    },
    ...overrides,
  };
  return base;
}

describe('cancelBooking', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw NotFoundError when appointment not found', async () => {
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(null),
    });

    await expect(
      cancelBooking({ appointmentId: 'nonexistent', userId: 'user1' }),
    ).rejects.toThrow('Booking not found or cannot be cancelled');
  });

  it('should apply percentage penalty for late cancellation', async () => {
    // Appointment in 2 hours but policy requires 24h notice
    const apt = createMockAppointment();
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    const result = await cancelBooking({
      appointmentId: 'apt1',
      userId: 'user1',
      reason: 'Changed plans',
    });

    // 50% penalty on 500 deposit = 250 penalty, 250 refund
    expect(result.penaltyApplied).toBe(true);
    expect(result.refundAmount).toBe(250);
    expect(apt.status).toBe('cancelled');
    expect(apt.save).toHaveBeenCalled();
  });

  it('should apply fixed penalty for late cancellation', async () => {
    const apt = createMockAppointment({
      business: {
        bookingConfig: {
          cancellationPolicy: {
            allowCancellation: true,
            hoursBeforeAppointment: 24,
            penaltyType: 'fixed',
            penaltyAmount: 200,
          },
        },
      },
    });
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    const result = await cancelBooking({
      appointmentId: 'apt1',
      userId: 'user1',
    });

    // Fixed 200 penalty on 500 deposit = 300 refund
    expect(result.penaltyApplied).toBe(true);
    expect(result.refundAmount).toBe(300);
  });

  it('should not apply penalty when penaltyType is none', async () => {
    const apt = createMockAppointment({
      business: {
        bookingConfig: {
          cancellationPolicy: {
            allowCancellation: true,
            hoursBeforeAppointment: 24,
            penaltyType: 'none',
            penaltyAmount: 0,
          },
        },
      },
    });
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    const result = await cancelBooking({
      appointmentId: 'apt1',
      userId: 'user1',
    });

    expect(result.penaltyApplied).toBe(false);
    expect(result.refundAmount).toBe(500); // Full deposit refund
  });

  it('should give full refund when cancelled with enough notice', async () => {
    // Appointment in 48 hours, policy requires 24h
    const apt = createMockAppointment({
      startDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    const result = await cancelBooking({
      appointmentId: 'apt1',
      userId: 'user1',
    });

    expect(result.penaltyApplied).toBe(false);
    expect(result.refundAmount).toBe(500); // Full deposit
  });

  it('should cap fixed penalty at deposit amount', async () => {
    const apt = createMockAppointment({
      pricing: { deposit: 100, depositPaid: true, total: 1000 },
      business: {
        bookingConfig: {
          cancellationPolicy: {
            allowCancellation: true,
            hoursBeforeAppointment: 24,
            penaltyType: 'fixed',
            penaltyAmount: 500, // More than deposit
          },
        },
      },
    });
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    const result = await cancelBooking({
      appointmentId: 'apt1',
      userId: 'user1',
    });

    // Fixed penalty capped at deposit (100)
    expect(result.refundAmount).toBe(0);
    expect(result.penaltyApplied).toBe(true);
  });

  it('should update user cancellation stats', async () => {
    const apt = createMockAppointment({
      startDateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });
    mockAppointmentFindOne.mockReturnValueOnce({
      populate: jest.fn().mockResolvedValue(apt),
    });

    await cancelBooking({ appointmentId: 'apt1', userId: 'user1' });

    expect(mockUserFindByIdAndUpdate).toHaveBeenCalledWith('user1', {
      $inc: { 'stats.cancelledAppointments': 1 },
    });
  });
});
