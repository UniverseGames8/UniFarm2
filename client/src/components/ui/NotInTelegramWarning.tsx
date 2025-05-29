/**
 * Компонент для информирования пользователя о предпочтительном запуске в Telegram
 * Ранее блокировал приложение вне Telegram, теперь просто отключен согласно новому ТЗ
 */
import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

const NotInTelegramWarning: React.FC = () => {
  // Согласно новому ТЗ мы полностью отключаем блокировку UI
  // Компонент всегда возвращает null
  return null;

  // Закомментированный код старой версии, можно восстановить при необходимости
  /*
  const telegramBotUrl = "https://t.me/UniFarming_Bot";
  const miniAppUrl = "https://t.me/UniFarming_Bot/UniFarm";
  
  const handleOpenTelegram = () => {
    window.location.href = telegramBotUrl;
  };
  
  const handleOpenMiniApp = () => {
    window.location.href = miniAppUrl;
  };
  
  return (
    <Card className="w-full max-w-md mx-auto bg-blue-50 text-blue-900 shadow-md mt-4 mb-8">
      <CardHeader className="bg-blue-100 text-center py-2">
        <h3 className="text-md font-medium">Информация</h3>
      </CardHeader>
      
      <CardContent className="pt-3 pb-2">
        <p className="text-sm text-blue-700 mb-2">
          Рекомендуем открывать UniFarm через официальный клиент Telegram для доступа 
          ко всем функциям.
        </p>
        
        <div className="flex items-center my-2">
          <img 
            src="https://telegram.org/img/t_logo.svg" 
            alt="Telegram Logo" 
            className="w-8 h-8 mr-2" 
          />
          <div className="text-left">
            <h4 className="text-sm font-medium">@UniFarming_Bot</h4>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 pt-1 pb-3">
        <Button 
          onClick={() => window.location.href = miniAppUrl}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          Открыть в Telegram
        </Button>
      </CardFooter>
    </Card>
  );
  */
};

export default NotInTelegramWarning;