import React, { useEffect } from 'react';
import { MissionsList } from '@/components/missions/MissionsList';
import { useQueryClient } from '@tanstack/react-query';

// Специальная версия страницы миссий для навигации через меню
// Использует основной компонент MissionsList
const MissionsNavMenu: React.FC = () => {
  console.log('Rendering MissionsNavMenu - Специальная версия для навигации через меню (v3)');
  const queryClient = useQueryClient();
  
  // Сбрасываем кеш при навигации через меню
  useEffect(() => {
    console.log('MissionsNavMenu mounted - использует стандартный MissionsList');
    
    // Инвалидируем кеш для уверенности в свежести данных
    queryClient.invalidateQueries({
      queryKey: ['/api/missions/active']
    });
    queryClient.invalidateQueries({
      queryKey: ['/api/user_missions']
    });
    
    // Очистка при размонтировании
    return () => {
      console.log('MissionsNavMenu unmounted - очищаем ресурсы');
    };
  }, [queryClient]);
  
  // Используем стандартный MissionsList
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold text-white mb-4">Выполняй задания — получай UNI</h1>
      <MissionsList />
    </div>
  );
};

export default MissionsNavMenu;