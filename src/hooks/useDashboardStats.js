import { useMemo } from 'react';
import { calculateDashboardStats } from '../utils/statsUtils';

export default function useDashboardStats({ cases, settings, globalTasks }) {
  const stats = useMemo(() => {
    return calculateDashboardStats(cases, settings, globalTasks);
  }, [cases, settings, globalTasks]);

  return { stats };
}
