import { useQuery } from '@tanstack/react-query';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/userContext';

// Определение типов для данных миссий
export enum MissionStatus {
  AVAILABLE = 'available',
  PROCESSING = 'processing',
  COMPLETED = 'completed'
}

// Тип миссии из БД
export interface DbMission {
  id: number;
  type: string;
  title: string;
  description: string;
  reward_uni: string; // В БД это numeric как строка
  is_active: boolean;
}

// Тип для выполненной миссии пользователя
export interface UserMission {
  id: number;
  user_id: number;
  mission_id: number;
  completed_at: string;
}

// Тип миссии для UI
export interface Mission {
  id: number;
  type: string;
  title: string;
  description: string;
  rewardUni: number;
  status: MissionStatus;
  progress?: number; // прогресс выполнения от 0 до 100
  visitStartTime?: number; // время начала выполнения социальной миссии
  verificationAvailable?: boolean; // доступна ли кнопка проверки
}

// Полифилл для Array.prototype.map на случай, если он был переопределен
function safeArrayMap<T, U>(array: T[], callback: (value: T, index: number, array: T[]) => U): U[] {
  if (!array || !Array.isArray(array)) {
    console.warn('[safeArrayMap] Входящий параметр не является массивом:', array);
    return [];
  }
  
  const result: U[] = [];
  for (let i = 0; i < array.length; i++) {
    result.push(callback(array[i], i, array));
  }
  return result;
}

/**
 * Хук для получения данных о миссиях
 */
export function useMissionData() {
  const { userId } = useUser();
  const [missions, setMissions] = useState<Mission[]>([]);
  
  // Полифилл для Array.prototype.map, если он был удален или переопределен
  useEffect(() => {
    if (!Array.prototype.map) {
      console.warn('[useMissionData] Array.prototype.map отсутствует, добавляем полифилл');
      // @ts-ignore
      Array.prototype.map = function<T, U>(callback: (value: T, index: number, array: T[]) => U, thisArg?: any): U[] {
        const O = Object(this);
        const len = O.length >>> 0;
        const A = new Array(len);
        for (let k = 0; k < len; k++) {
          if (k in O) {
            A[k] = callback.call(thisArg, O[k], k, O);
          }
        }
        return A;
      };
    }
  }, []);
  
  // Загружаем активные миссии
  const { 
    data: dbMissions, 
    isLoading: missionsLoading, 
    error: missionsError 
  } = useQuery<DbMission[]>({
    queryKey: ['/api/v2/missions/active'],
    queryFn: async () => {
      console.log('🚀 Запрос активных миссий');
      
      try {
        const data = await correctApiRequest('/api/v2/missions/active', 'GET');
        console.log(`📥 Ответ получен через correctApiRequest:`, data);
        
        if (data && data.success) {
          if (Array.isArray(data.data)) {
            console.log(`✅ Получены активные миссии (${data.data.length} шт.)`);
            return data.data;
          } else {
            console.log('⚠️ data.data не является массивом:', data.data);
            return [];
          }
        } else {
          console.log('⚠️ Неожиданный формат данных:', data);
          return [];
        }
      } catch (error) {
        console.error('⚠️ Ошибка запроса:', error);
        return [];
      }
    }
  });
  
  // Загружаем выполненные миссии пользователя
  const { 
    data: userCompletedMissions, 
    isLoading: userMissionsLoading, 
    error: userMissionsError 
  } = useQuery<UserMission[]>({
    queryKey: ['/api/v2/user-missions', userId],
    queryFn: async () => {
      console.log('🚀 Запрос выполненных миссий пользователя ID:', userId);
      
      try {
        const data = await correctApiRequest(`/api/v2/user-missions?user_id=${userId || 1}`, 'GET');
        console.log(`📥 Ответ получен через correctApiRequest:`, data);
        
        if (data && data.success) {
          // Дополнительные проверки и защитные преобразования
          if (Array.isArray(data.data)) {
            console.log(`✅ Получены выполненные миссии (${data.data.length} шт.)`);
            // Глубокая проверка полей каждого элемента
            return safeArrayMap(data.data, (item) => {
              if (item && typeof item === 'object') {
                const typedItem = item as Record<string, any>;
                return {
                  id: typedItem.id || 0,
                  user_id: typedItem.user_id || 0,
                  mission_id: typedItem.mission_id || 0,
                  completed_at: typedItem.completed_at || '',
                };
              }
              // Если элемент не является объектом, возвращаем пустой объект с дефолтными значениями
              return {
                id: 0,
                user_id: 0,
                mission_id: 0,
                completed_at: '',
              };
            });
          } else {
            console.log('⚠️ data.data не является массивом:', data.data);
            return [];
          }
        } else {
          console.log('⚠️ Неожиданный формат данных:', data);
          return [];
        }
      } catch (error) {
        console.error('⚠️ Ошибка запроса:', error);
        return [];
      }
    }
  });
  
  // Объединяем данные о миссиях
  useEffect(() => {
    console.log('useEffect в хуке useMissionData вызван');
    
    // Проверяем корректность данных миссий
    if (!dbMissions || !Array.isArray(dbMissions)) {
      console.log('dbMissions не загружены или не являются массивом');
      setMissions([]);
      return;
    }
    
    // Преобразуем массив выполненных миссий в объект для быстрого поиска
    const completedMissionsById: Record<number, boolean> = {};
    
    // Явно логируем состояние userCompletedMissions для отладки
    console.log('userCompletedMissions состояние:', {
      isUndefined: userCompletedMissions === undefined,
      isNull: userCompletedMissions === null,
      isArray: Array.isArray(userCompletedMissions),
      value: userCompletedMissions
    });
    
    // Проверяем тип и структуру userCompletedMissions перед использованием
    // Убеждаемся что работаем с массивом
    const safeUserMissions = Array.isArray(userCompletedMissions) ? userCompletedMissions : [];
    
    if (safeUserMissions.length > 0) {
      console.log('Обработка массива выполненных миссий:', safeUserMissions.length);
      
      // Безопасно итерируем по массиву и заполняем объект
      for (let i = 0; i < safeUserMissions.length; i++) {
        const mission = safeUserMissions[i];
        if (mission && typeof mission === 'object' && 'mission_id' in mission) {
          completedMissionsById[mission.mission_id] = true;
        }
      }
    } else {
      console.log('Массив выполненных миссий пуст');
    }
    
    // Преобразуем данные для UI с безопасной проверкой и дополнительным логированием
    const mappedMissions: Mission[] = [];
    
    console.log('Начинаем преобразование миссий:', { 
      dbMissions, 
      isArray: Array.isArray(dbMissions),
      length: dbMissions?.length 
    });
    
    if (dbMissions && Array.isArray(dbMissions)) {
      for (let i = 0; i < dbMissions.length; i++) {
        const dbMission = dbMissions[i];
        if (dbMission && typeof dbMission === 'object') {
          const isCompleted = completedMissionsById[dbMission.id] || false;
          
          try {
            mappedMissions.push({
              id: dbMission.id || 0,
              type: dbMission.type || 'unknown',
              title: dbMission.title || 'Без названия',
              description: dbMission.description || 'Нет описания',
              rewardUni: typeof dbMission.reward_uni === 'string' ? 
                parseFloat(dbMission.reward_uni) : 
                (typeof dbMission.reward_uni === 'number' ? dbMission.reward_uni : 0),
              status: isCompleted ? MissionStatus.COMPLETED : MissionStatus.AVAILABLE
            });
          } catch (err) {
            console.error('Ошибка обработки миссии:', err, dbMission);
          }
        }
      }
    } else {
      console.warn('dbMissions не является массивом:', dbMissions);
    }
    
    console.log('Преобразовано миссий:', mappedMissions.length);
    
    console.log('Загружено миссий:', mappedMissions.length);
    setMissions(mappedMissions);
  }, [dbMissions, userCompletedMissions]);
  
  return {
    missions,
    setMissions,
    isLoading: missionsLoading || userMissionsLoading,
    hasError: !!missionsError || !!userMissionsError
  };
}