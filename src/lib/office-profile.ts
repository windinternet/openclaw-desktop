import type { OfficeProfile } from './types';

export const OFFICE_PROFILE_STORAGE_KEY = 'office-profile';

export const DEFAULT_OFFICE_PROFILE: OfficeProfile = {
  companyName: 'OpenClaw Desktop',
  receptionGreeting: '欢迎来到 OpenClaw 3D Office',
};

export function createDefaultOfficeProfile(instanceName?: string): OfficeProfile {
  const companyName = instanceName?.trim() || DEFAULT_OFFICE_PROFILE.companyName;
  return {
    ...DEFAULT_OFFICE_PROFILE,
    companyName,
  };
}

export function normalizeOfficeProfile(value: unknown): OfficeProfile {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_OFFICE_PROFILE };
  const record = value as Record<string, unknown>;
  const companyName = typeof record.companyName === 'string' ? record.companyName.trim() : '';
  const receptionGreeting = typeof record.receptionGreeting === 'string' ? record.receptionGreeting.trim() : '';

  return {
    ...DEFAULT_OFFICE_PROFILE,
    companyName: companyName || DEFAULT_OFFICE_PROFILE.companyName,
    receptionGreeting: receptionGreeting || DEFAULT_OFFICE_PROFILE.receptionGreeting,
  };
}
