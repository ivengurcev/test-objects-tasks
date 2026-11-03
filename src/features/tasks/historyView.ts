export function shouldShowEmptyHistory(loading: boolean, hasError: boolean, eventCount: number): boolean {
  return !loading && !hasError && eventCount === 0;
}
