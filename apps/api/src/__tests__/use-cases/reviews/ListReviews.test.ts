import { listReviews } from '../../../application/use-cases/reviews/ListReviews';

const mockFind = jest.fn();
const mockCountDocuments = jest.fn();
const mockAggregate = jest.fn();

jest.mock('../../../infrastructure/database/mongodb/models/Review', () => ({
  Review: {
    find: (...args: any[]) => {
      mockFind(...args);
      return {
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              sort: jest.fn().mockReturnValue({
                skip: jest.fn().mockReturnValue({
                  limit: jest.fn().mockReturnValue({
                    lean: jest.fn().mockResolvedValue([
                      { _id: 'rev1', ratings: { overall: 5 }, comment: 'Excellent' },
                    ]),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    },
    countDocuments: (...args: any[]) => mockCountDocuments(...args),
    aggregate: (...args: any[]) => mockAggregate(...args),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('listReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments
      .mockResolvedValueOnce(10) // total count
      .mockResolvedValueOnce(2); // pending replies
    mockAggregate.mockResolvedValue([{
      totalReviews: 10,
      avgRating: 4.5,
      rating5: 5,
      rating4: 3,
      rating3: 1,
      rating2: 1,
      rating1: 0,
      withReply: 7,
    }]);
  });

  it('should list reviews with stats and pagination', async () => {
    const result = await listReviews({
      businessId: '507f1f77bcf86cd799439011',
      page: 1,
      limit: 20,
    });

    expect(result.reviews).toHaveLength(1);
    expect(result.stats.totalReviews).toBe(10);
    expect(result.stats.avgRating).toBe(4.5);
    expect(result.stats.distribution[5]).toBe(5);
    expect(result.stats.responseRate).toBe(70); // 7/10 * 100
    expect(result.stats.pendingReplies).toBe(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.total).toBe(10);
  });

  it('should filter by rating', async () => {
    mockCountDocuments
      .mockReset()
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    await listReviews({
      businessId: '507f1f77bcf86cd799439011',
      rating: 5,
      page: 1,
      limit: 20,
    });

    const query = mockFind.mock.calls[0][0];
    expect(query['ratings.overall']).toBe(5);
  });
});
