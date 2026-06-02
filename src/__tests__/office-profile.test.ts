import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFICE_PROFILE, createDefaultOfficeProfile, normalizeOfficeProfile } from '../lib/office-profile';

describe('office profile', () => {
  it('uses the current instance name as the default company name', () => {
    expect(createDefaultOfficeProfile('Deepin Gateway').companyName).toBe('Deepin Gateway');
  });

  it('normalizes missing or invalid profile fields', () => {
    expect(normalizeOfficeProfile({ companyName: '  环闪比特  ' })).toEqual({
      ...DEFAULT_OFFICE_PROFILE,
      companyName: '环闪比特',
    });
    expect(normalizeOfficeProfile({ companyName: '' })).toEqual(DEFAULT_OFFICE_PROFILE);
  });
});
