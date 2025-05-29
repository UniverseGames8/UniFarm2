import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import MissionStats from '@/components/missions/MissionStats';

/**
 * Компонент-обертка с ErrorBoundary для статистики миссий
 * Отображает состояние ошибки для повышения устойчивости приложения
 */
const MissionStatsWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackRender={({ error }: { error: Error }) => (
        <div className="p-4 border border-red-300 rounded-md bg-red-50 text-red-500">
          <p className="font-medium">Ошибка при загрузке статистики миссий</p>
          <p className="text-sm">{error?.message || 'Неизвестная ошибка'}</p>
        </div>
      )}
    >
      <MissionStats />
    </ErrorBoundary>
  );
};

export default MissionStatsWithErrorBoundary;