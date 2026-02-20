import { getFinancialSummary } from '../../../application/use-cases/finances/GetFinancialSummary';

jest.mock('../../../infrastructure/database/mongodb/models/Transaction', () => ({
  Transaction: {
    aggregate: jest.fn()
      .mockResolvedValueOnce([ // current period
        { _id: 'payment', total: 10000, count: 20 },
        { _id: 'expense', total: 3000, count: 5 },
      ])
      .mockResolvedValueOnce([ // previous period
        { _id: 'payment', total: 8000, count: 15 },
        { _id: 'expense', total: 2500, count: 4 },
      ]),
  },
}));

jest.mock('../../../infrastructure/database/mongodb/models/Appointment', () => ({
  Appointment: {
    aggregate: jest.fn()
      .mockResolvedValueOnce([{ total: 12000, count: 25, tips: 500 }]) // appointments revenue
      .mockResolvedValueOnce([{ total: 1500, count: 3 }]), // pending
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('getFinancialSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return financial summary with period comparison', async () => {
    const result = await getFinancialSummary({ businessId: '507f1f77bcf86cd799439011', period: 'month' });

    expect(result.period).toBe('month');
    expect(result.summary.income.current).toBe(10000);
    expect(result.summary.expenses.current).toBe(3000);
    expect(result.summary.profit.current).toBe(7000); // 10000 - 3000 - 0 refunds
    expect(result.appointments.revenue).toBe(12000);
    expect(result.appointments.count).toBe(25);
    expect(result.appointments.tips).toBe(500);
    expect(result.appointments.averageTicket).toBe(480); // 12000 / 25
    expect(result.pending.deposits).toBe(1500);
  });

  it('should handle week period', async () => {
    const { Transaction } = require('../../../infrastructure/database/mongodb/models/Transaction');
    Transaction.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const { Appointment } = require('../../../infrastructure/database/mongodb/models/Appointment');
    Appointment.aggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await getFinancialSummary({ businessId: '507f1f77bcf86cd799439011', period: 'week' });

    expect(result.period).toBe('week');
    expect(result.summary.income.current).toBe(0);
    expect(result.appointments.averageTicket).toBe(0);
  });
});
