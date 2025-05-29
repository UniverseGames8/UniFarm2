import React from 'react';
import MissionsListWithErrorBoundary from '@/components/missions/MissionsListWithErrorBoundary';
import MissionStatsWithErrorBoundary from '@/components/missions/MissionStatsWithErrorBoundary';

/**
 * Компонент страницы миссий
 * Использует компоненты с оберткой ErrorBoundary для повышения устойчивости
 */
const Missions: React.FC = () => {
  console.log('Rendering Missions page (v2)');
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-white mb-4">Выполняй задания — получай UNI</h1>
      
      {/* Статистика миссий с ErrorBoundary */}
      <MissionStatsWithErrorBoundary />
      
      {/* Список миссий с ErrorBoundary */}
      <MissionsListWithErrorBoundary />
    </div>
  );
};

export default Missions;
