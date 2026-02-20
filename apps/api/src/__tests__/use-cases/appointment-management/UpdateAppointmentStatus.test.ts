import { updateAppointmentStatus } from '../../../application/use-cases/appointment-management/UpdateAppointmentStatus';

const mockFindOneAndUpdate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Appointment', () => ({
  Appointment: {
    findOneAndUpdate: (...args: any[]) => mockFindOneAndUpdate(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('updateAppointmentStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should confirm a pending appointment', async () => {
    const confirmed = { _id: 'apt1', status: 'confirmed' };
    mockFindOneAndUpdate.mockResolvedValue(confirmed);

    const result = await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'confirm',
    });

    expect(result.appointment.status).toBe('confirmed');
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'apt1', businessId: 'biz1', status: { $in: ['pending'] } },
      { status: 'confirmed' },
      { new: true },
    );
  });

  it('should check-in from pending or confirmed', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'apt1', status: 'checked_in' });

    const result = await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'check-in',
    });

    expect(result.appointment.status).toBe('checked_in');
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'apt1', businessId: 'biz1', status: { $in: ['pending', 'confirmed'] } },
      { status: 'checked_in' },
      { new: true },
    );
  });

  it('should start service from checked_in', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'apt1', status: 'in_progress' });

    await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'start',
    });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'apt1', businessId: 'biz1', status: { $in: ['checked_in'] } },
      { status: 'in_progress' },
      { new: true },
    );
  });

  it('should complete from checked_in or in_progress', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'apt1', status: 'completed' });

    await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'complete',
    });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'apt1', businessId: 'biz1', status: { $in: ['checked_in', 'in_progress'] } },
      { status: 'completed' },
      { new: true },
    );
  });

  it('should cancel with reason and cancellation metadata', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'apt1', status: 'cancelled' });

    await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'cancel',
      reason: 'Client requested',
    });

    const updateData = mockFindOneAndUpdate.mock.calls[0][1];
    expect(updateData.status).toBe('cancelled');
    expect(updateData.cancellation).toBeDefined();
    expect(updateData.cancellation.cancelledBy).toBe('business');
    expect(updateData.cancellation.reason).toBe('Client requested');
  });

  it('should mark no-show from pending, confirmed or checked_in', async () => {
    mockFindOneAndUpdate.mockResolvedValue({ _id: 'apt1', status: 'no_show' });

    await updateAppointmentStatus({
      appointmentId: 'apt1',
      businessId: 'biz1',
      action: 'no-show',
    });

    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'apt1', businessId: 'biz1', status: { $in: ['pending', 'confirmed', 'checked_in'] } },
      { status: 'no_show' },
      { new: true },
    );
  });

  it('should throw NotFoundError when appointment not found or invalid transition', async () => {
    mockFindOneAndUpdate.mockResolvedValue(null);

    await expect(
      updateAppointmentStatus({ appointmentId: 'x', businessId: 'biz1', action: 'confirm' }),
    ).rejects.toThrow('Appointment not found or already confirmed');
  });
});
