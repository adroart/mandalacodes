import { useCallback, useEffect, useState } from 'react';
import { getReadings, subscribeReadings, type ReadingEntry } from './store';
export function useReadingJournal() {
  const [entries, setEntries] = useState<ReadingEntry[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(() => {
    try { setEntries(getReadings()); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Your journal could not be opened.'); }
  }, []);
  useEffect(() => { refresh(); return subscribeReadings(refresh); }, [refresh]);
  return {entries, error, refresh};
}
