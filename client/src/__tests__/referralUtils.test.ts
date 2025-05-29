import { buildReferralLink } from '../utils/referralUtils';

describe('referralUtils', () => {
  describe('buildReferralLink', () => {
    it('should return empty string when refCode is undefined', () => {
      expect(buildReferralLink(undefined)).toBe('');
    });

    it('should return empty string when refCode is null', () => {
      expect(buildReferralLink(null)).toBe('');
    });

    it('should return empty string when refCode is empty string', () => {
      expect(buildReferralLink('')).toBe('');
    });

    it('should correctly format the link with a valid refCode', () => {
      const refCode = 'ABC123456789';
      const expectedLink = `https://t.me/UniFarming_Bot?start=${refCode}`;
      expect(buildReferralLink(refCode)).toBe(expectedLink);
    });
    
    it('should work with numeric refCode values', () => {
      const refCode = '123456789012';
      const expectedLink = `https://t.me/UniFarming_Bot?start=${refCode}`;
      expect(buildReferralLink(refCode)).toBe(expectedLink);
    });
  });
});