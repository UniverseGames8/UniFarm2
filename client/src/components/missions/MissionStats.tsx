import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { Skeleton } from '@/components/ui/skeleton';

interface MissionStatsData {
  completed: number;
  total: number;
  userPoints: number;
  totalAvailable: number;
}

/**
 * Компонент для отображения статистики по миссиям
 * Показывает прогресс выполнения миссий и количество заработанных баллов
 */
const MissionStats: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/v2/missions/stats'],
    queryFn: async () => {
      const response = await correctApiRequest<{ success: boolean; data: MissionStatsData; message?: string }>(
        '/api/v2/missions/stats',
        'GET'
      );
      
      if (!response.success) {
        throw new Error(response.message || 'Не удалось загрузить статистику миссий');
      }
      
      return response.data;
    },
  });

  const percentage = data ? Math.round((data.completed / Math.max(data.total, 1)) * 100) : 0;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Статистика миссий</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-red-50 dark:bg-red-950 border-red-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Ошибка загрузки статистики</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600 dark:text-red-400">
            {error instanceof Error ? error.message : 'Неизвестная ошибка'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Статистика миссий</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="h-24 w-24">
            <CircularProgressbar
              value={percentage}
              text={`${percentage}%`}
              styles={buildStyles({
                textSize: '22px',
                pathColor: `hsla(var(--primary))`,
                textColor: 'hsla(var(--primary))',
                trailColor: 'hsla(var(--muted))',
              })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{data?.completed || 0}</span> из{' '}
              <span className="font-medium">{data?.total || 0}</span> миссий выполнено
            </p>
            <p className="text-sm">
              Заработано: <span className="font-medium">{data?.userPoints || 0} UNI</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Доступно ещё: <span className="font-medium">{data?.totalAvailable || 0} UNI</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MissionStats;