import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Инструмент для тестирования Telegram initData
 * Позволяет делать запросы к API для проверки валидации initData
 */
export default function TelegramValidationTool() {
  const [initData, setInitData] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Настройки для валидации
  const [skipSignatureCheck, setSkipSignatureCheck] = useState<boolean>(false);
  const [requireUserId, setRequireUserId] = useState<boolean>(false);
  const [maxAgeHours, setMaxAgeHours] = useState<number>(48);
  const [allowFallbackId, setAllowFallbackId] = useState<boolean>(true);
  
  // Получаем initData из localStorage или Telegram WebApp
  const getTelegramInitData = () => {
    // Проверяем Telegram WebApp
    if (window.Telegram?.WebApp?.initData) {
      setInitData(window.Telegram.WebApp.initData);
      return;
    }
    
    // Пробуем получить из localStorage
    try {
      const savedData = localStorage.getItem('telegramInitData');
      if (savedData) {
        setInitData(savedData);
      }
    } catch (e) {
      console.error('Ошибка при получении данных из localStorage:', e);
    }
  };
  
  // Отправляем запрос на проверку
  const validateInitData = async () => {
    if (!initData.trim()) {
      setError('Необходимо ввести initData для проверки');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Опции для валидации
      const options = {
        skipSignatureCheck,
        requireUserId,
        maxAgeSeconds: maxAgeHours * 3600,
        allowFallbackId,
        verboseLogging: true
      };
      
      // Отправляем запрос
      const response = await fetch('/api/telegram/validate-init-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          initData,
          options
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResult(data.data);
      } else {
        setError(data.message || 'Ошибка при валидации');
        setResult(null);
      }
    } catch (e) {
      setError(`Ошибка при отправке запроса: ${e instanceof Error ? e.message : String(e)}`);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Инструмент валидации Telegram initData</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Левая колонка: Ввод данных */}
        <Card>
          <CardHeader>
            <CardTitle>Ввод initData</CardTitle>
            <CardDescription>
              Введите данные initData из Telegram WebApp или используйте автоматически полученные
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <Button 
                onClick={getTelegramInitData} 
                variant="outline"
                className="w-full mb-2"
              >
                Получить initData из Telegram WebApp
              </Button>
              
              <Label htmlFor="initData">Данные initData:</Label>
              <Textarea 
                id="initData"
                placeholder="Вставьте данные initData здесь..."
                value={initData}
                onChange={(e) => setInitData(e.target.value)}
                className="min-h-[200px]"
              />
              
              <Separator className="my-2" />
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Настройки валидации</h3>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="skipSignature">Пропустить проверку подписи</Label>
                    <p className="text-xs text-muted-foreground">
                      Игнорировать несоответствие хеша подписи
                    </p>
                  </div>
                  <Switch 
                    id="skipSignature"
                    checked={skipSignatureCheck}
                    onCheckedChange={setSkipSignatureCheck}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requireUserId">Требовать наличие userId</Label>
                    <p className="text-xs text-muted-foreground">
                      Валидация не пройдет без ID пользователя
                    </p>
                  </div>
                  <Switch 
                    id="requireUserId"
                    checked={requireUserId}
                    onCheckedChange={setRequireUserId}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allowFallbackId">Разрешить ID=1</Label>
                    <p className="text-xs text-muted-foreground">
                      Разрешить использование тестового ID=1
                    </p>
                  </div>
                  <Switch 
                    id="allowFallbackId"
                    checked={allowFallbackId}
                    onCheckedChange={setAllowFallbackId}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label htmlFor="maxAge">Максимальный возраст (часов)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="maxAge"
                      type="number" 
                      value={maxAgeHours}
                      onChange={(e) => setMaxAgeHours(Number(e.target.value))}
                      min={1}
                      max={168}
                    />
                    <span className="text-sm">часов</span>
                  </div>
                </div>
                
                <Button 
                  onClick={validateInitData} 
                  className="w-full mt-4"
                  disabled={isLoading || !initData.trim()}
                >
                  {isLoading ? 'Проверка...' : 'Проверить initData'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Правая колонка: Результаты */}
        <Card>
          <CardHeader>
            <CardTitle>Результаты валидации</CardTitle>
            <CardDescription>
              Результаты проверки initData и полученные данные
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Ошибка</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {result && (
              <div className="space-y-4">
                <div className="bg-primary/10 p-4 rounded-md">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${result.isValid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <h3 className="font-medium">Статус: {result.isValid ? 'Валидно' : 'Невалидно'}</h3>
                  </div>
                  
                  {result.userId && (
                    <p className="text-sm">ID пользователя: <span className="font-medium">{result.userId}</span></p>
                  )}
                  
                  {result.username && (
                    <p className="text-sm">Имя пользователя: <span className="font-medium">{result.username}</span></p>
                  )}
                  
                  {result.startParam && (
                    <p className="text-sm">Параметр start: <span className="font-medium">{result.startParam}</span></p>
                  )}
                </div>
                
                {result.errors && result.errors.length > 0 && (
                  <div className="bg-destructive/10 p-4 rounded-md">
                    <h3 className="font-medium mb-2">Ошибки валидации:</h3>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {result.errors.map((err: string, index: number) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="bg-muted p-4 rounded-md">
                  <h3 className="font-medium mb-2">Технические детали:</h3>
                  <div className="text-sm space-y-1">
                    <p>Токен бота: {result.botTokenAvailable ? 'Доступен' : 'Отсутствует'}</p>
                    {result.botTokenLength && <p>Длина токена: {result.botTokenLength} символов</p>}
                    <p>Длина initData: {result.rawInitDataLength} символов</p>
                    <p>Настройки:</p>
                    <pre className="bg-background p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(result.options, null, 2)}
                    </pre>
                  </div>
                </div>
                
                <div className="mt-4">
                  <details>
                    <summary className="cursor-pointer font-medium">Полный ответ сервера</summary>
                    <pre className="bg-background p-4 rounded mt-2 text-xs overflow-auto max-h-[400px]">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
                </div>
              </div>
            )}
            
            {!result && !error && (
              <div className="text-center text-muted-foreground py-12">
                Введите initData и нажмите "Проверить" для просмотра результатов
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}