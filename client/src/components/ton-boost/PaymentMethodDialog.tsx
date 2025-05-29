import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, CreditCard } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { useUser } from '@/contexts/userContext';
// Обновлено: используем tonConnectService вместо simpleTonTransaction
import { 
  isTonWalletConnected, 
  isTonPaymentReady, 
  sendTonTransaction,
  createTonTransactionComment 
} from '@/services/tonConnectService';

interface PaymentMethodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boostId: number | null;
  boostName: string;
  boostPriceTon: string; // Добавляем цену буста в TON
  onSelectPaymentMethod: (boostId: number, method: 'internal_balance' | 'external_wallet') => void;
}

const PaymentMethodDialog: React.FC<PaymentMethodDialogProps> = ({
  open,
  onOpenChange,
  boostId,
  boostName,
  boostPriceTon,
  onSelectPaymentMethod,
}) => {
  const { toast } = useToast();
  const [tonConnectUI] = useTonConnectUI();
  const { userId } = useUser();

  const handleSelectMethod = async (method: 'internal_balance' | 'external_wallet') => {
    // Проверяем и логируем статус userId
    console.log("[DEBUG] PaymentMethodDialog - handleSelectMethod: userId текущего пользователя =", userId);
    
    // Убедимся, что boostPriceTon всегда имеет значение, используя дефолтную цену при null
    if (boostPriceTon === null || boostPriceTon === undefined) {
      const defaultPrices: Record<number, string> = { 1: "1", 2: "5", 3: "15", 4: "25" };
      // Безопасный доступ с проверкой, чтобы избежать ошибки "null cannot be used as index type"
      let defaultPrice = "1";
      if (boostId !== null && typeof boostId === 'number') {
        defaultPrice = defaultPrices[boostId] || "1";
      }
      boostPriceTon = defaultPrice;
    }
    
    // Отправка TON транзакции без использования Buffer или @ton/core
    if (method === 'external_wallet' && boostId !== null) {
      try {
        // Закрываем диалог перед вызовом
        onOpenChange(false);
        
        // Проверяем наличие tonConnectUI
        if (!tonConnectUI) {
          toast({
            title: "Ошибка подключения кошелька",
            description: "TonConnect не инициализирован. Перезагрузите приложение.",
            variant: "destructive"
          });
          return;
        }
        
        // Получаем данные для транзакции из хука useUser
        // userId уже получен из useUser() в начале компонента
        const comment = createTonTransactionComment(userId || 0, boostId);
        
        // ТЗ: Вычисляем nanoAmount и логируем её
        const tonAmount = parseFloat(boostPriceTon);
        if (isNaN(tonAmount)) {
          console.error("[ERROR] Невалидная цена пакета:", boostPriceTon);
          toast({
            title: "Ошибка платежа",
            description: "Некорректная сумма для платежа. Пожалуйста, попробуйте снова.",
            variant: "destructive"
          });
          return;
        }
        
        const nanoAmount = BigInt(tonAmount * 1e9).toString();
        console.log("✅ nanoAmount:", nanoAmount);
        
        // Вызываем sendTonTransaction с проверенной суммой
        // Используем nanoAmount вместо boostPriceTon для передачи точной суммы в sendTonTransaction
        const result = await sendTonTransaction(tonConnectUI, String(tonAmount), comment);
        
        console.log("[TON] Результат транзакции:", result);
        
        if (result && result.status === 'success') {
          toast({
            title: "Транзакция отправлена",
            description: "Платеж успешно отправлен в блокчейн TON",
          });
        } else {
          toast({
            title: "Транзакция отменена",
            description: "Вы отменили транзакцию или произошла ошибка",
            variant: "default"
          });
        }
      } catch (error) {
        console.error("[TEST ERROR] Ошибка при тестовом вызове sendTonTransaction:", error);
        toast({
          title: "Ошибка теста",
          description: `Не удалось вызвать sendTransaction: ${error}`,
          variant: "destructive"
        });
      }
      return;
    }
    
    // ОРИГИНАЛЬНЫЙ КОД (НЕ ВЫПОЛНЯЕТСЯ В ТЕСТОВОМ РЕЖИМЕ)
    if (boostId !== null) {
      // Если выбран внешний кошелек, проверяем подключение TonConnect
      if (method === 'external_wallet') {
        if (!tonConnectUI) {
          console.error('[ERROR] tonConnectUI not initialized in PaymentMethodDialog');
          toast({
            title: "Ошибка инициализации",
            description: "Произошла ошибка инициализации TonConnect. Пожалуйста, обновите страницу и попробуйте снова.",
            variant: "destructive"
          });
          onOpenChange(false);
          return;
        }
        
        // УДАЛЕНО ПО ТЗ: Временно убираем проверку готовности
        // const isReady = isTonPaymentReady(tonConnectUI);
        // if (!isReady) { ... }
      }
      
      onSelectPaymentMethod(boostId, method);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-blue-950/90 border-blue-800">
        <DialogHeader>
          <DialogTitle className="text-blue-200">Выберите способ оплаты</DialogTitle>
          <DialogDescription className="text-blue-400">
            Для активации TON Boost "{boostName}" выберите удобный способ оплаты
          </DialogDescription>
        </DialogHeader>
        
        {/* Debug info для разработки */}
        <div className="text-xs text-slate-500 mb-2">
          DEBUG: BoostID={boostId}, TonConnectReady={isTonPaymentReady(tonConnectUI) ? "Да" : "Нет"}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-32 space-y-2 border-blue-600 hover:bg-blue-800/30 hover:text-blue-200"
            onClick={() => handleSelectMethod('internal_balance')}
          >
            <CreditCard className="h-10 w-10 text-blue-400" />
            <span className="text-base">Внутренний баланс</span>
            <span className="text-xs text-blue-400">Использовать TON с баланса приложения</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center h-32 space-y-2 border-blue-600 hover:bg-blue-800/30 hover:text-blue-200"
            onClick={() => handleSelectMethod('external_wallet')}
          >
            <Wallet className="h-10 w-10 text-blue-400" />
            <span className="text-base">Внешний кошелек</span>
            <span className="text-xs text-blue-400">Оплатить с помощью TON кошелька</span>
          </Button>
        </div>
        
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
          >
            Отмена
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentMethodDialog;