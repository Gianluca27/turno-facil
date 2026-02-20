import { openCashRegister } from '../../../application/use-cases/pos/OpenCashRegister';

const mockSave = jest.fn().mockResolvedValue(undefined);
const mockFindOne = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/CashRegister', () => ({
  CashRegister: Object.assign(
    jest.fn().mockImplementation((data: any) => ({
      ...data,
      _id: 'reg1',
      save: mockSave,
    })),
    {
      findOne: (...args: any[]) => mockFindOne(...args),
    },
  ),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('openCashRegister', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should open a cash register', async () => {
    mockFindOne.mockResolvedValue(null); // no open register

    const result = await openCashRegister({
      businessId: 'biz1',
      userId: 'user1',
      initialAmount: 5000,
      notes: 'Opening shift',
    });

    expect(result.register).toBeDefined();
    expect(result.register.businessId).toBe('biz1');
    expect(result.register.initialAmount).toBe(5000);
    expect(result.register.status).toBe('open');
    expect(mockSave).toHaveBeenCalled();
  });

  it('should throw ConflictError if register already open', async () => {
    mockFindOne.mockResolvedValue({ _id: 'existing', status: 'open' });

    await expect(
      openCashRegister({
        businessId: 'biz1',
        userId: 'user1',
        initialAmount: 5000,
      }),
    ).rejects.toThrow('There is already an open cash register');
  });
});
