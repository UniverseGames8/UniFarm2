import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, AlertCircle, Trash, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const AdminPage: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState<string>(
    `https://${window.location.hostname}/api/telegram/webhook`
  );
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);
  const [isSettingCommands, setIsSettingCommands] = useState(false);
  const [isDeletingWebhook, setIsDeletingWebhook] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  const { toast } = useToast();

  // Получить информацию о текущем webhook
  const getWebhookInfo = async () => {
    setIsLoading(true);
    setAlertMessage(null);
    
    try {
      const response = await fetch('/api/telegram/webhook-info');
      const result = await response.json();
      
      if (result.success) {
        setWebhookInfo(result.data);
        toast({
          title: "Информация о webhook получена",
          description: "Текущие настройки webhook загружены",
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: `Ошибка получения информации: ${result.error}`
        });
      }
    } catch (error) {
      setAlertMessage({
        type: 'error',
        message: `Ошибка запроса: ${(error as Error).message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Установить webhook
  const setWebhook = async () => {
    setIsSettingWebhook(true);
    setAlertMessage(null);
    
    try {
      const response = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webhookUrl })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: 'Webhook успешно установлен!'
        });
        toast({
          title: "Webhook установлен",
          description: `Webhook установлен на ${webhookUrl}`,
        });
        getWebhookInfo(); // Обновляем информацию
      } else {
        setAlertMessage({
          type: 'error',
          message: `Ошибка установки webhook: ${result.error}`
        });
      }
    } catch (error) {
      setAlertMessage({
        type: 'error',
        message: `Ошибка запроса: ${(error as Error).message}`
      });
    } finally {
      setIsSettingWebhook(false);
    }
  };

  // Удалить webhook
  const deleteWebhook = async () => {
    setIsDeletingWebhook(true);
    setAlertMessage(null);
    
    try {
      const response = await fetch('/api/telegram/delete-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: 'Webhook успешно удален!'
        });
        toast({
          title: "Webhook удалён",
          description: "Webhook был успешно удалён",
        });
        setWebhookInfo(null);
      } else {
        setAlertMessage({
          type: 'error',
          message: `Ошибка удаления webhook: ${result.error}`
        });
      }
    } catch (error) {
      setAlertMessage({
        type: 'error',
        message: `Ошибка запроса: ${(error as Error).message}`
      });
    } finally {
      setIsDeletingWebhook(false);
    }
  };

  // Установить команды для бота
  const setCommands = async () => {
    setIsSettingCommands(true);
    setAlertMessage(null);
    
    try {
      const response = await fetch('/api/telegram/set-commands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAlertMessage({
          type: 'success',
          message: 'Команды бота успешно настроены!'
        });
        toast({
          title: "Команды настроены",
          description: "Команды бота успешно обновлены",
        });
      } else {
        setAlertMessage({
          type: 'error',
          message: `Ошибка настройки команд: ${result.error}`
        });
      }
    } catch (error) {
      setAlertMessage({
        type: 'error',
        message: `Ошибка запроса: ${(error as Error).message}`
      });
    } finally {
      setIsSettingCommands(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Администрирование Telegram-бота</h1>
      
      {alertMessage && (
        <Alert variant={alertMessage.type === 'success' ? 'default' : 'destructive'} className="mb-6">
          {alertMessage.type === 'success' ? <CheckCircle className="h-4 w-4 mr-2" /> : <AlertCircle className="h-4 w-4 mr-2" />}
          <AlertTitle>{alertMessage.type === 'success' ? 'Успех' : 'Ошибка'}</AlertTitle>
          <AlertDescription>{alertMessage.message}</AlertDescription>
        </Alert>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Управление webhook */}
        <Card>
          <CardHeader>
            <CardTitle>Настройка Webhook</CardTitle>
            <CardDescription>
              Настройте webhook для получения сообщений от пользователей Telegram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <label htmlFor="webhook-url" className="block text-sm font-medium mb-2">
                URL для webhook
              </label>
              <Input
                id="webhook-url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-domain.com/api/telegram/webhook"
                className="mb-4"
              />
              
              <div className="flex gap-2">
                <Button onClick={setWebhook} disabled={isSettingWebhook}>
                  {isSettingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Установить webhook
                </Button>
                
                <Button variant="outline" onClick={deleteWebhook} disabled={isDeletingWebhook}>
                  {isDeletingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash className="mr-2 h-4 w-4" />
                  Удалить webhook
                </Button>
                
                <Button variant="secondary" onClick={getWebhookInfo} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Проверить статус
                </Button>
              </div>
            </div>
            
            {webhookInfo && (
              <div className="mt-4 p-4 border rounded-md bg-muted">
                <h3 className="font-medium mb-2">Текущие настройки webhook:</h3>
                <div className="text-sm">
                  <p>URL: <span className="font-mono">{webhookInfo.url || 'не установлен'}</span></p>
                  <p>Ожидающие обновления: {webhookInfo.pending_update_count}</p>
                  <p>Максимальные соединения: {webhookInfo.max_connections}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Настройка команд */}
        <Card>
          <CardHeader>
            <CardTitle>Команды бота</CardTitle>
            <CardDescription>
              Настроить меню команд для бота
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">
              Настройка добавит стандартный набор команд для бота: 
              <span className="font-mono block mt-2">
                /start - Запуск бота и приветствие<br />
                /ping - Проверить работу бота<br />
                /info - Показать мою информацию<br />
                /refcode - Получить мой реферальный код<br />
                /app - Открыть приложение UniFarm
              </span>
            </p>
            
            <Button onClick={setCommands} disabled={isSettingCommands}>
              {isSettingCommands && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Settings className="mr-2 h-4 w-4" />
              Установить команды
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPage;