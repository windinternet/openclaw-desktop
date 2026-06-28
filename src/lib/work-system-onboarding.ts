export const WORK_SYSTEM_ONBOARDING_ROUTE = '/?onboarding=work-system';
export const WORK_SYSTEM_ONBOARDING_ANCHOR = 'work-system-onboarding';

export function isWorkSystemOnboardingSearch(search: string): boolean {
  return new URLSearchParams(search).get('onboarding') === 'work-system';
}
