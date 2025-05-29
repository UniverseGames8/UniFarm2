import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { formatNumberWithPrecision, getUserIdFromURL } from '@/lib/utils';

// Интерфейс для активного TON Boost депозита
interface TonBoostDeposit {
  id: number;
  user_id: number;
  ton_amount: string;
  boost_package_id: number;
  rate_ton_per_second: string;
  rate_uni_per_second: string;
  accumulated_ton: string;
  created_at: string;
  last_updated_at: string;
  is_active: boolean;
  bonus_uni: string;
}

const ActiveTonBoostsCard: React.FC = () => {
  // Получаем ID пользователя
  const userId = getUserIdFromURL() || '1';
  
  // Получаем активные буст-пакеты
  const { data: activeTonBoosts, isLoading: isLoadingBoosts } = useQuery<{ success: boolean, data: TonBoostDeposit[] }>({
    queryKey: [`/api/ton-boosts/active?user_id=${userId}`],
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  return (
    <Card className="w-full shadow-md mb-6 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg text-blue-400">
              Активные TON Boost-пакеты
            </CardTitle>
            <CardDescription className="text-blue-300/70">
              {activeTonBoosts?.data?.length || 0} активных депозитов
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoadingBoosts ? (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
          </div>
        ) : activeTonBoosts?.data?.length === 0 ? (
          <div className="text-center py-4 text-foreground opacity-70">
            <p>У вас нет активных TON Boost-пакетов</p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900/20 space-y-3 pr-1">
            {activeTonBoosts?.data?.map((boost) => {
              // Расчет дохода в день
              const secondsInDay = 24 * 60 * 60;
              const dailyIncome = parseFloat(boost.rate_ton_per_second) * secondsInDay;
              
              // Лог доходности TON буста
              console.log(`[ActiveTonBoost] ID: ${boost.id}, Package: ${boost.boost_package_id}, Rate: ${boost.rate_ton_per_second}/sec, Daily: ${dailyIncome}`);
              
              return (
                <div key={boost.id} className="bg-blue-900/20 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-blue-300">TON Boost #{boost.id}</span>
                    <span className="text-sm bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded">
                      {formatNumberWithPrecision(parseFloat(boost.ton_amount), 2)} TON
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-400/80">В сутки:</span>
                      <span className="text-blue-300">
                        {formatNumberWithPrecision(dailyIncome, 5)} TON
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400/80">В секунду:</span>
                      <span className="text-blue-300">
                        {formatNumberWithPrecision(parseFloat(boost.rate_ton_per_second), 8)} TON
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400/80">Получено UNI:</span>
                      <span className="text-purple-300">
                        {formatNumberWithPrecision(parseFloat(boost.bonus_uni), 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400/80">Накоплено:</span>
                      <span className="text-blue-300">
                        {formatNumberWithPrecision(parseFloat(boost.accumulated_ton), 8)} TON
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveTonBoostsCard;