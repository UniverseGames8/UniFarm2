import React, { useState } from 'react';
import { useUser } from '@/contexts/userContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { correctApiRequest } from '@/lib/correctApiRequest';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Coins, Wallet, Loader2, Zap, RefreshCcw } from 'lucide-react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import PaymentMethodDialog from './PaymentMethodDialog';
import ExternalPaymentStatus from './ExternalPaymentStatus';
import { 
  sendTonTransaction, 
  createTonTransactionComment,
  isTonWalletConnected,
  isTonPaymentReady
} from '@/services/tonConnectService';
import { formatNumberWithPrecision, getUserIdFromURL } from '@/lib/utils';

// Класс ошибки для неподключенного кошелька
class WalletNotConnectedError extends Error {
  constructor(message: string = 'Wallet not connected') {
    super(message);
    this.name = 'WalletNotConnectedError';
  }
}

// Типы данных для TON Boost-пакетов
interface TonBoostPackage {
  id: number;
  name: string;
  priceTon: string;
  bonusUni: string;
  rateTon: string;
  rateUni: string;
}

interface ExternalPaymentDataType {
  userId: number;
  transactionId: number;
  paymentLink: string;
  boostName: string;
}

const BoostPackagesCard: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tonConnectUI] = useTonConnectUI();
  const { user } = useUser();
  const [selectedBoostId, setSelectedBoostId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState<boolean>(false);
  const [externalPaymentDialogOpen, setExternalPaymentDialogOpen] = useState<boolean>(false);
  const [externalPaymentData, setExternalPaymentData] = useState<ExternalPaymentDataType | null>(null);

  // Получаем список доступных TON Boost-пакетов
  const { data, isLoading: isLoadingPackages } = useQuery({
    queryKey: ['/api/ton-boosts'],
    queryFn: async () => {
      try {
        const response = await correctApiRequest('/api/ton-boosts', 'GET');
        return response.success ? response.data as TonBoostPackage[] : [];
      } catch (error) {
        console.error("Failed to fetch TON Boost packages:", error);
        toast({
          title: "Ошибка",
          description: "Не удалось загрузить TON Boost-пакеты",
          variant: "destructive",
        });
        return [];
      }
    }
  });

  const boostPackages = data || [];

  // ИСПРАВЛЕННЫЙ обработчик клика по буст-пакету
  const handleBoostClick = (boostId: number) => {
    console.log('[DEBUG] Нажата кнопка покупки TON Boost:', {
      boostId,
      tonConnectUI: !!tonConnectUI,
      tonConnectUIWallet: tonConnectUI?.wallet,
      isConnected: isTonWalletConnected(tonConnectUI)
    });

    // Сохраняем ID буста и ВСЕГДА показываем диалог выбора способа оплаты
    setSelectedBoostId(boostId);
    
    // ИСПРАВЛЕНИЕ: Всегда показываем диалог выбора (внутренний/внешний баланс)
    // Пользователь сам выберет подходящий способ оплаты
    setPaymentMethodDialogOpen(true);
  };

  // Обработчик выбора способа оплаты
  const handleSelectPaymentMethod = async (boostId: number, paymentMethod: 'internal_balance' | 'external_wallet') => {
    console.log('[DEBUG] Выбран способ оплаты:', {
      boostId,
      paymentMethod,
      tonConnectAvailable: !!tonConnectUI,
      tonConnectUIWallet: tonConnectUI?.wallet,
      connected: isTonWalletConnected(tonConnectUI)
    });
    
    // Закрываем диалог выбора метода оплаты
    setPaymentMethodDialogOpen(false);
    setIsLoading(true);
    
    try {
      // Получаем ID пользователя
      let userId = user?.id?.toString();
      if (!userId) {
        userId = getUserIdFromURL();
      }
      
      if (!userId) {
        toast({
          title: "Ошибка",
          description: "Не удалось определить ID пользователя",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Находим выбранный пакет
      const selectedPackage = boostPackages.find(p => p.id === boostId);
      if (!selectedPackage) {
        toast({
          title: "Ошибка",
          description: "Выбранный пакет не найден",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (paymentMethod === 'external_wallet') {
        // Проверяем подключение кошелька для внешней оплаты
        if (!isTonWalletConnected(tonConnectUI)) {
          toast({
            title: "Подключите кошелек",
            description: "Для оплаты через внешний кошелек необходимо подключить TON-кошелёк",
            variant: "destructive",
            action: (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => {
                  if (tonConnectUI && typeof tonConnectUI.connectWallet === 'function') {
                    tonConnectUI.connectWallet();
                  }
                }}
              >
                Подключить
              </Button>
            )
          });
          setIsLoading(false);
          return;
        }

        // Отправляем TON транзакцию через подключенный кошелек
        try {
          const transactionComment = createTonTransactionComment(
            Number(userId),
            boostId,
            'ton_boost_purchase'
          );

          const transactionRequest = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
            messages: [
              {
                address: tonConnectUI?.wallet?.account?.address || '',
                amount: (parseFloat(selectedPackage.priceTon) * 1e9).toString(),
                payload: transactionComment
              }
            ]
          };

          console.log('[DEBUG] Отправка транзакции TON:', transactionRequest);
          
          const result = await sendTonTransaction(tonConnectUI, transactionRequest);
          
          if (result?.boc) {
            // Транзакция успешно отправлена
            toast({
              title: "Транзакция отправлена",
              description: "TON Boost будет активирован после подтверждения транзакции",
              variant: "default"
            });

            // Обновляем данные
            queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
            queryClient.invalidateQueries({ queryKey: ['/api/ton-boosts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/user-boosts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
          } else {
            toast({
              title: "Транзакция отменена",
              description: "Транзакция не была выполнена или была отменена в кошельке",
              variant: "default"
            });
          }
        } catch (error: any) {
          console.error("Error sending TON transaction:", error);
          
          if (error instanceof WalletNotConnectedError) {
            toast({
              title: "Кошелек не подключен",
              description: "Пожалуйста, подключите TON-кошелёк, чтобы купить Boost-пакет.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "Ошибка платежа",
              description: "Произошла ошибка при отправке платежа. Пожалуйста, попробуйте снова.",
              variant: "destructive"
            });
          }
        }
      } else {
        // Покупка через внутренний баланс
        try {
          const data = await correctApiRequest('/api/v2/ton-farming/purchase', 'POST', {
            user_id: userId,
            boost_id: boostId,
            payment_method: paymentMethod
          });

          if (data.success) {
            // Обновляем кэш пользователя и связанные данные
            queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
            queryClient.invalidateQueries({ queryKey: ['/api/ton-boosts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/user-boosts'] });
            queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });

            toast({
              title: "TON Boost активирован!",
              description: `${selectedPackage.name} успешно активирован через внутренний баланс`,
              variant: "default"
            });
          } else {
            toast({
              title: "Ошибка покупки",
              description: data.message || "Не удалось активировать TON Boost",
              variant: "destructive"
            });
          }
        } catch (error: any) {
          console.error('Error purchasing TON Boost:', error);
          toast({
            title: "Ошибка",
            description: "Произошла ошибка при покупке TON Boost",
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('Error in handleSelectPaymentMethod:', error);
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при обработке платежа",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingPackages) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            TON Boost Пакеты
          </CardTitle>
          <CardDescription>
            Загрузка доступных пакетов...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                TON Boost Пакеты
              </CardTitle>
              <CardDescription>
                Активируйте TON Boost для увеличения скорости заработка
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/ton-boosts'] });
                queryClient.invalidateQueries({ queryKey: ['/api/v2/ton-farming/boosts'] });
                toast({
                  title: "Данные обновлены",
                  description: "TON Boost пакеты перезагружены",
                  variant: "default"
                });
              }}
              className="flex items-center gap-1"
            >
              <RefreshCcw className="h-4 w-4" />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {boostPackages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Пакеты недоступны
            </div>
          ) : (
            boostPackages.map((pkg, index) => (
              <div key={pkg.id}>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{pkg.name}</div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>💰 Цена: {formatNumberWithPrecision(pkg.priceTon, 2)} TON</div>
                      <div>🎁 Бонус: {formatNumberWithPrecision(pkg.bonusUni, 0)} UNI</div>
                      <div>📈 Доходность TON: {formatNumberWithPrecision(pkg.rateTon, 2)}% в день</div>
                      <div>📈 Доходность UNI: {formatNumberWithPrecision(pkg.rateUni, 2)}% в день</div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleBoostClick(pkg.id)}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    {isLoading && selectedBoostId === pkg.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Wallet className="h-4 w-4 mr-2" />
                    )}
                    Купить
                  </Button>
                </div>
                {index < boostPackages.length - 1 && <Separator className="my-2" />}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Диалог выбора способа оплаты */}
      <PaymentMethodDialog
        isOpen={paymentMethodDialogOpen}
        onClose={() => setPaymentMethodDialogOpen(false)}
        onSelectPaymentMethod={handleSelectPaymentMethod}
        selectedBoostId={selectedBoostId}
        boostPackages={boostPackages}
        tonConnectUI={tonConnectUI}
      />

      {/* Диалог статуса внешнего платежа */}
      <ExternalPaymentStatus
        isOpen={externalPaymentDialogOpen}
        onClose={() => setExternalPaymentDialogOpen(false)}
        paymentData={externalPaymentData}
      />
    </>
  );
};

export default BoostPackagesCard;