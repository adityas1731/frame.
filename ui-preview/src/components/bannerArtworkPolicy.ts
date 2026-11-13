/** Explicit choices win. Provider artwork only fills missing or unreadable server artwork. */
export function useProviderBanner(explicit: boolean, serverAvailable: boolean, serverWidth: number) {
  return explicit || !serverAvailable || serverWidth === 0;
}
