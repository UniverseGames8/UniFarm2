import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Calendar, CheckCircle, Coins, MessageCircle, UserPlus } from 'lucide-react';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { useUser } from '@/contexts/userContext';
import { useNotification } from '@/contexts/notificationContext';

// Тип миссии из API
interface Mission {
  id: number;
  type: string;
  title: string;
  description: string;
  reward_uni: string;
  is_active: boolean;
}

// Тип для выполненной миссии
interface UserMission {
  id: number;
  user_id: number;
  mission_id: number;
  completed_at: string;
}

// Экспортируем простой компонент списка миссий
export const SimpleMissionsList: React.FC = () => {
  console.log('SimpleMissionsList: компонент отрисовывается');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [completedMissionIds, setCompletedMissionIds] = useState<Record<number, boolean>>({});
  const { userId } = useUser();
  
  console.log('SimpleMissionsList: userId =', userId);

  // Получаем доступ к системе уведомлений
  const { showNotification } = useNotification();

  // Загрузка миссий
  useEffect(() => {
    console.log('SimpleMissionsList: useEffect запущен');
    let isMounted = true;
    
    async function loadMissions() {
      try {
        console.log('SimpleMissionsList: загрузка миссий начата');
        if (isMounted) setLoading(true);
        
        // Загружаем активные миссии
        console.log('SimpleMissionsList: отправка запроса active missions');
        const missionsResponse = await correctApiRequest('/api/v2/missions/active', 'GET');
        console.log('SimpleMissionsList: ответ получен', missionsResponse);
        
        if (!isMounted) return;
        
        if (missionsResponse && missionsResponse.success && Array.isArray(missionsResponse.data)) {
          console.log('SimpleMissionsList: загружены миссии:', missionsResponse.data.length);
          setMissions(missionsResponse.data || []);
        } else {
          console.error('SimpleMissionsList: ошибка формата данных миссий:', missionsResponse);
          setError(true);
          setMissions([]);
        }
        
        // Загружаем выполненные миссии
        console.log('SimpleMissionsList: отправка запроса user missions');
        const userMissionsResponse = await correctApiRequest(`/api/v2/user-missions?user_id=${userId || 1}`, 'GET');
        console.log('SimpleMissionsList: ответ user missions получен', userMissionsResponse);
        
        if (!isMounted) return;
        
        if (userMissionsResponse && userMissionsResponse.success && userMissionsResponse.data) {
          try {
            // Проверяем, что данные это массив
            const userMissionsData = Array.isArray(userMissionsResponse.data) 
              ? userMissionsResponse.data 
              : [];
            
            // Создаем объект для быстрого доступа
            const completedMissions: Record<number, boolean> = {};
            
            // Безопасно обрабатываем каждый элемент
            for (let i = 0; i < userMissionsData.length; i++) {
              const mission = userMissionsData[i];
              if (mission && typeof mission === 'object' && 'mission_id' in mission) {
                completedMissions[mission.mission_id] = true;
              }
            }
            
            console.log('SimpleMissionsList: выполненные миссии (объект):', completedMissions);
            setCompletedMissionIds(completedMissions);
          } catch (formatError) {
            console.error('SimpleMissionsList: ошибка обработки данных выполненных миссий:', formatError);
            setCompletedMissionIds({});
          }
        } else {
          console.error('SimpleMissionsList: ошибка загрузки выполненных миссий:', userMissionsResponse);
          setCompletedMissionIds({});
        }
      } catch (err) {
        console.error('SimpleMissionsList: ошибка загрузки миссий:', err);
        if (isMounted) {
          setError(true);
          setMissions([]);
          setCompletedMissionIds({});
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          console.log('SimpleMissionsList: загрузка миссий завершена');
        }
      }
    }
    
    loadMissions();
    
    // Чистим эффект при размонтировании
    return () => {
      isMounted = false;
    };
  }, [userId]);
  
  // Функция для получения иконки по типу миссии
  const getMissionIcon = (type: string) => {
    switch (type) {
      case 'social': return <MessageCircle className="h-5 w-5 text-blue-400" />;
      case 'invite': return <UserPlus className="h-5 w-5 text-indigo-400" />;
      case 'daily': return <Calendar className="h-5 w-5 text-amber-400" />;
      default: return <Coins className="h-5 w-5 text-purple-400" />;
    }
  };
  
  // Функция для выполнения миссии
  const completeMission = async (missionId: number) => {
    try {
      // Находим миссию по ID для отображения названия в уведомлении
      let missionTitle = `Миссия #${missionId}`;
      for (let i = 0; i < missions.length; i++) {
        if (missions[i].id === missionId) {
          missionTitle = missions[i].title || missionTitle;
          break;
        }
      }
      
      const result = await correctApiRequest('/api/v2/missions/complete', 'POST', {
        user_id: userId || 1,
        mission_id: missionId
      });
      
      if (result && result.success) {
        // Добавляем миссию в список выполненных
        setCompletedMissionIds(prev => ({
          ...prev,
          [missionId]: true
        }));
        
        // Правильно извлекаем награду из ответа API
        let reward = 0;
        if (result.data && typeof result.data === 'object' && 'reward' in result.data) {
          reward = result.data.reward;
        } else if ('reward' in result) {
          reward = result.reward;
        }
        
        // Показываем красивое уведомление вместо alert
        showNotification('success', {
          message: `${missionTitle} выполнена! Награда: ${reward} UNI`
        });
      } else {
        let errorMessage = 'Не удалось выполнить миссию';
        if (result && result.message) {
          errorMessage = result.message;
        } else if (result && result.data && result.data.message) {
          errorMessage = result.data.message;
        }
        
        // Показываем уведомление об ошибке
        showNotification('error', {
          message: `Ошибка: ${errorMessage}`
        });
      }
    } catch (err) {
      console.error('Ошибка выполнения миссии:', err);
      
      // Показываем уведомление об ошибке
      showNotification('error', {
        message: 'Произошла ошибка при выполнении миссии'
      });
    }
  };
  
  // Рендерим компоненты загрузчика
  const renderLoaderCards = () => {
    const loaders = [];
    for (let i = 1; i <= 3; i++) {
      loaders.push(
        <Card key={i} className="w-full opacity-70 animate-pulse">
          <CardHeader className="h-16"></CardHeader>
          <CardContent className="h-20"></CardContent>
          <CardFooter className="h-12"></CardFooter>
        </Card>
      );
    }
    return loaders;
  };
  
  // Отображение загрузки
  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-center text-muted-foreground text-sm mb-4">Загрузка заданий...</div>
        {renderLoaderCards()}
      </div>
    );
  }
  
  // Отображение ошибки
  if (error) {
    return (
      <div className="space-y-4 p-4">
        <Card className="w-full bg-slate-800/70 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-red-400" />
              Не удалось загрузить задания
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Произошла ошибка при загрузке заданий. Пожалуйста, попробуйте позже.
            </p>
            <Button 
              className="mt-4 w-full"
              onClick={() => window.location.reload()}
            >
              Попробовать снова
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Отображение пустого списка
  if (!missions || missions.length === 0) {
    return (
      <div className="space-y-4 p-4">
        <Card className="w-full bg-slate-800/70 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <AlertCircle className="mr-2 h-5 w-5 text-amber-400" />
              Задания не найдены
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              На данный момент доступных заданий нет. Проверьте позже или обновите страницу.
            </p>
            <Button 
              className="mt-4 w-full"
              onClick={() => window.location.reload()}
            >
              Обновить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Рендерим карточки миссий
  const renderMissionCards = () => {
    const cards = [];
    
    for (let i = 0; i < missions.length; i++) {
      const mission = missions[i];
      const isCompleted = !!completedMissionIds[mission.id];
      
      cards.push(
        <Card key={mission.id} className="w-full">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                  {getMissionIcon(mission.type)}
                </div>
                <CardTitle className="text-lg">{mission.title}</CardTitle>
              </div>
              <Badge className={isCompleted ? 'bg-teal-500/70' : 'bg-blue-500'}>
                <span className="flex items-center">
                  {isCompleted ? (
                    <React.Fragment>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Выполнено
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <AlertCircle className="h-4 w-4 mr-1" />
                      Доступно
                    </React.Fragment>
                  )}
                </span>
              </Badge>
            </div>
            <CardDescription className="mt-2">{mission.description}</CardDescription>
          </CardHeader>
          
          <CardFooter className="flex justify-between items-center border-t pt-4">
            <div className="flex items-center">
              <div className="text-purple-300/80 font-medium mr-2">Награда:</div>
              <div className="flex items-center px-2 py-1 bg-purple-900/30 rounded-md">
                <Coins className="h-4 w-4 text-purple-400 mr-1.5" />
                <span className="text-purple-300 font-semibold">
                  {parseFloat(mission.reward_uni)} UNI
                </span>
              </div>
            </div>
            
            {isCompleted ? (
              <Badge variant="outline" className="border-purple-400/60 text-purple-300 px-3 py-1">
                <CheckCircle className="h-4 w-4 mr-1.5" />
                Получено
              </Badge>
            ) : (
              <Button 
                size="sm"
                onClick={() => completeMission(mission.id)}
                className="bg-primary hover:bg-primary/90"
              >
                Выполнить
              </Button>
            )}
          </CardFooter>
        </Card>
      );
    }
    
    return cards;
  };
  
  // Основное отображение списка миссий
  return (
    <div className="space-y-4 p-4">
      {renderMissionCards()}
    </div>
  );
};

export default SimpleMissionsList;