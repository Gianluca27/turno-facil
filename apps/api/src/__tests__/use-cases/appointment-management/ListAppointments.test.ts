import { listAppointments } from '../../../application/use-cases/appointment-management/ListAppointments';

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Appointment', () => ({
  Appointment: {
    find: (...args: any[]) => {
      mockFind(...args);
      return {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            sort: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([
                  { _id: 'apt1', status: 'confirmed', startTime: '10:00' },
                ]),
              }),
            }),
          }),
        }),
      };
    },
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
  },
}));

describe('listAppointments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(1);
  });

  it('should list appointments with pagination', async () => {
    const result = await listAppointments({
      businessId: 'biz1',
      page: 1,
      limit: 50,
    });

    expect(result.appointments).toHaveLength(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(1);
    expect(mockFind).toHaveBeenCalledWith({ businessId: 'biz1' });
  });

  it('should filter by specific date', async () => {
    await listAppointments({
      businessId: 'biz1',
      date: '2026-03-15',
      page: 1,
      limit: 50,
    });

    const callArgs = mockFind.mock.calls[0][0];
    expect(callArgs.businessId).toBe('biz1');
    expect(callArgs.date.$gte).toBeInstanceOf(Date);
    expect(callArgs.date.$lt).toBeInstanceOf(Date);
  });

  it('should filter by date range', async () => {
    await listAppointments({
      businessId: 'biz1',
      from: '2026-03-01',
      to: '2026-03-31',
      page: 1,
      limit: 50,
    });

    const callArgs = mockFind.mock.calls[0][0];
    expect(callArgs.date.$gte).toBeInstanceOf(Date);
    expect(callArgs.date.$lte).toBeInstanceOf(Date);
  });

  it('should filter by staffId and status', async () => {
    await listAppointments({
      businessId: 'biz1',
      staffId: 'staff1',
      status: 'confirmed',
      page: 1,
      limit: 50,
    });

    const callArgs = mockFind.mock.calls[0][0];
    expect(callArgs.staffId).toBe('staff1');
    expect(callArgs.status).toBe('confirmed');
  });
});
