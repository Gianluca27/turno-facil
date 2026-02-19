import { timeToMinutes, minutesToTime, formatDate } from '../../../application/use-cases/booking/shared';

describe('Booking shared utilities', () => {
  describe('timeToMinutes', () => {
    it('should convert 00:00 to 0', () => {
      expect(timeToMinutes('00:00')).toBe(0);
    });

    it('should convert 01:30 to 90', () => {
      expect(timeToMinutes('01:30')).toBe(90);
    });

    it('should convert 09:00 to 540', () => {
      expect(timeToMinutes('09:00')).toBe(540);
    });

    it('should convert 12:45 to 765', () => {
      expect(timeToMinutes('12:45')).toBe(765);
    });

    it('should convert 23:59 to 1439', () => {
      expect(timeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('minutesToTime', () => {
    it('should convert 0 to 00:00', () => {
      expect(minutesToTime(0)).toBe('00:00');
    });

    it('should convert 90 to 01:30', () => {
      expect(minutesToTime(90)).toBe('01:30');
    });

    it('should convert 540 to 09:00', () => {
      expect(minutesToTime(540)).toBe('09:00');
    });

    it('should convert 765 to 12:45', () => {
      expect(minutesToTime(765)).toBe('12:45');
    });

    it('should convert 1439 to 23:59', () => {
      expect(minutesToTime(1439)).toBe('23:59');
    });

    it('should pad single digit hours', () => {
      expect(minutesToTime(5)).toBe('00:05');
      expect(minutesToTime(65)).toBe('01:05');
    });
  });

  describe('timeToMinutes and minutesToTime roundtrip', () => {
    const times = ['00:00', '06:30', '09:15', '12:00', '14:45', '18:30', '23:00'];

    it.each(times)('should roundtrip %s correctly', (time) => {
      expect(minutesToTime(timeToMinutes(time))).toBe(time);
    });
  });

  describe('formatDate', () => {
    it('should format date as DD/MM/YYYY', () => {
      const date = new Date('2024-03-15');
      expect(formatDate(date)).toBe('15/03/2024');
    });

    it('should pad single digit day and month', () => {
      const date = new Date('2024-01-05');
      expect(formatDate(date)).toBe('05/01/2024');
    });

    it('should handle December 31st', () => {
      const date = new Date('2024-12-31');
      expect(formatDate(date)).toBe('31/12/2024');
    });
  });
});
