/**
 * Страница информирования о Telegram Mini App
 * Показывает информацию о приложении без автоматического перенаправления
 */
import { useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from 'wouter';

export default function TelegramRedirect() {
  const telegramAppUrl = "https://t.me/UniFarming_Bot/UniFarm";
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Логируем посещение страницы
    console.log('[TelegramRedirect] Страница открыта, перенаправление отключено');
  }, []);
  
  const handleOpenTelegram = () => {
    window.location.href = telegramAppUrl;
  };
  
  const handleStayOnPage = () => {
    // Перенаправляем на главную страницу
    setLocation('/');
  };
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="bg-blue-600 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold text-center">Telegram Mini App</CardTitle>
          <CardDescription className="text-blue-100 text-center">
            Для полного доступа к функциям рекомендуется открыть в Telegram
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 pb-2">
          <div className="flex items-center justify-center mb-6">
            <img 
              src="https://telegram.org/img/t_logo.svg" 
              alt="Telegram Logo" 
              className="w-16 h-16 mr-4" 
            />
            <div className="text-left">
              <h3 className="font-medium">UniFarm</h3>
              <p className="text-sm text-gray-500">@UniFarming_Bot</p>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Приложение предназначено для работы в Telegram как Mini App. Некоторые функции могут работать ограниченно при использовании вне Telegram.
          </p>
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <p className="text-sm text-yellow-800">
              Примечание: Вы можете продолжить использование приложения в браузере, но для доступа к полному функционалу рекомендуется открыть в Telegram.
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            onClick={handleOpenTelegram} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            Открыть в Telegram
          </Button>
          <Button 
            onClick={handleStayOnPage} 
            variant="outline" 
            className="w-full sm:w-auto"
          >
            Продолжить в браузере
          </Button>
        </CardFooter>
      </Card>
      
      <div className="mt-4 text-center text-sm text-gray-500">
        <p>© 2025 UniFarm - Telegram Mini App для крипто-фарминга</p>
      </div>
    </div>
  );
}