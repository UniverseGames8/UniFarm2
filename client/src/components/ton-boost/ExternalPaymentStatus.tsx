import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ExternalLink, Wallet } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

interface ExternalPaymentStatusProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  transactionId: number;
  paymentLink: string; // Может быть пустой, если использовали TonConnect
  boostName: string;
  onPaymentComplete: () => void;
}

const ExternalPaymentStatus: React.FC<ExternalPaymentStatusProps> = ({
  open,
  onOpenChange,
  userId,
  transactionId,
  paymentLink,
  boostName,
  onPaymentComplete,
}) => {
  const { toast } = useToast();
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [checkCounter, setCheckCounter] = useState(0);
  const isTonConnectPayment = !paymentLink; // Если paymentLink пустой, значит использовали TonConnect
  
  // Запрос на проверку статуса платежа
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['/api/ton-boosts/check-payment', userId, transactionId],
    queryFn: async () => {
      const response = await fetch(`/api/ton-boosts/check-payment?user_id=${userId}&transaction_id=${transactionId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    enabled: open && !paymentProcessed, // Запрос выполняется только когда диалог открыт и платеж не обработан
    refetchInterval: 10000, // Повторный запрос каждые 10 секунд
  });
  
  // Эффект для обработки статуса платежа
  useEffect(() => {
    if (data?.success && data?.data?.status === 'completed') {
      setPaymentProcessed(true);
      toast({
        title: "Платеж подтвержден",
        description: `TON Boost "${boostName}" успешно активирован!`,
      });
      onPaymentComplete();
    }
    
    // Увеличиваем счетчик проверок
    if (open && !paymentProcessed) {
      setCheckCounter(prev => prev + 1);
    }
  }, [data, boostName, onPaymentComplete, toast, open, paymentProcessed]);
  
  // Больше не используем прямые ссылки ton://, всё идет через TonConnect
  const checkTonConnectStatus = () => {
    // Просто вызываем обновление статуса
    refetch();
  };
  
  // Ручное обновление статуса
  const handleCheckStatus = () => {
    refetch();
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-blue-950/90 border-blue-800">
        <DialogHeader>
          <DialogTitle className="text-blue-200">
            {paymentProcessed ? "Платеж подтвержден" : "Ожидание платежа"}
          </DialogTitle>
          <DialogDescription className="text-blue-400">
            {paymentProcessed 
              ? `TON Boost "${boostName}" успешно активирован!` 
              : isTonConnectPayment 
                ? `Проверка платежа через TON Connect для "${boostName}"...` 
                : `Для активации TON Boost "${boostName}" оплатите через внешний TON кошелек`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center my-6 space-y-4">
          {paymentProcessed ? (
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <p className="text-lg font-medium text-blue-200">Платеж успешно обработан</p>
              <p className="text-sm text-blue-400 mt-2">
                Теперь вы будете получать доход от TON Boost
              </p>
            </div>
          ) : (
            <>
              {/* Все платежи идут только через TonConnect */}
              <div className="flex flex-col items-center text-center">
                <Wallet className="h-16 w-16 text-blue-500 mb-4" />
                <p className="text-lg font-medium text-blue-200">Транзакция отправлена через TON Connect</p>
                <p className="text-sm text-blue-400 mt-2">
                  Ожидание подтверждения от блокчейна...
                </p>
              </div>
              
              <div className="text-center mt-4">
                <p className="text-sm text-blue-400 mb-2">
                  Статус транзакции обновится автоматически
                </p>
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-5 w-5 text-blue-400 animate-spin mr-2" />
                    <span className="text-blue-300">Проверка статуса...</span>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-blue-700 text-blue-300"
                    onClick={handleCheckStatus}
                  >
                    Проверить статус сейчас
                  </Button>
                )}
                
                <p className="text-xs text-blue-500 mt-4">
                  Проверок: {checkCounter} 
                  {checkCounter > 10 && " (Если вы уже оплатили, но статус не обновляется, попробуйте перезагрузить страницу)"}
                </p>
              </div>
            </>
          )}
        </div>
        
        <DialogFooter>
          {paymentProcessed ? (
            <Button
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => onOpenChange(false)}
            >
              Закрыть
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
            >
              Отмена
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalPaymentStatus;