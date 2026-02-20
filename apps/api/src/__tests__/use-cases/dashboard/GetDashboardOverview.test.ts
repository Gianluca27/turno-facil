import { getDashboardOverview } from '../../../application/use-cases/dashboard/GetDashboardOverview';

const mockCountDocuments = jest.fn();
const mockAggregate = jest.fn();
const mockFind = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Appointment', () => ({
  Appointment: {
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
    find: (...args: any[]) => {
      mockFind(...args);
      return {
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      };
    },
    aggregate: (...args: any[]) => mockAggregate(...args),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Transaction', () => ({
  Transaction: {
    aggregate: jest.fn().mockResolvedValue([{ total: 5000 }]),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('getDashboardOverview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(5);
    mockAggregate.mockResolvedValue([{ _id: 1, count: 3 }]);
  });

  it('should return today stats, upcoming, and weekly chart', async () => {
    const result = await getDashboardOverview({ businessId: 'biz1' });

    expect(result.today).toBeDefined();
    expect(result.today.total).toBe(5);
    expect(result.today.completed).toBe(5);
    expect(result.today.cancelled).toBe(5);
    expect(result.today.pending).toBe(5);
    expect(result.upcoming).toBeDefined();
    expect(result.weeklyChart).toBeDefined();
    expect(mockCountDocuments).toHaveBeenCalledTimes(4);
  });

  it('should return zero revenue when no transactions', async () => {
    const { Transaction } = require('../../../infrastructure/database/mongodb/models/Transaction');
    Transaction.aggregate.mockResolvedValueOnce([]);

    const result = await getDashboardOverview({ businessId: 'biz1' });
    expect(result.today.revenue).toBe(0);
  });
});
