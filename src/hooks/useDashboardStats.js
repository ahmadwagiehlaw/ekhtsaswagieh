import { useMemo } from 'react';
import { calculateDashboardStats } from '../utils/statsUtils';

export default function useDashboardStats({ cases, settings, globalTasks }) { // globalTasks kept in props for backward compat but not passed to stats
  const stats = useMemo(() => {
    return calculateDashboardStats(cases, settings);
  }, [cases, settings]);

  return { stats };
}
