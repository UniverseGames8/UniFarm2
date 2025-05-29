import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function WebhookSetup() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  
  // Получаем URL-адрес текущего хоста
  const apiHost = window.location.origin;
  const webhookUrl = `${apiHost}/api/telegram/webhook`;
  
  // Шаблон токена для примера в UI (формат обозначения, не реальные данные)
  // Реальный токен никогда не должен отображаться в UI
  const sampleToken = '123456789:EXAMPLE_TOKEN_FORMAT_NOT_REAL';
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('URL скопирован в буфер обмена');
    });
  };
  
  return (
    <div className="container py-10 max-w-2xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Настройка Telegram Webhook</CardTitle>
          <CardDescription>
            Используйте эту страницу для настройки webhook вашего Telegram бота.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-1">URL для webhook:</h3>
              <div className="flex items-center gap-2">
                <code className="bg-muted p-2 rounded text-sm flex-1 overflow-auto">
                  {webhookUrl}
                </code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl)}
                >
                  Копировать
                </Button>
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-1">Инструкция по настройке:</h3>
              <ol className="list-decimal ml-5 space-y-2 text-sm">
                <li>
                  Скопируйте URL webhook (указан выше)
                </li>
                <li>
                  Откройте в браузере ссылку:
                  <div className="my-2">
                    <code className="bg-muted p-2 rounded text-xs block overflow-auto break-all">
                      https://api.telegram.org/bot<span className="text-primary font-bold">YOUR_BOT_TOKEN</span>/setWebhook?url=<span className="text-primary font-bold">YOUR_WEBHOOK_URL</span>
                    </code>
                  </div>
                </li>
                <li>
                  Замените <span className="font-bold">YOUR_BOT_TOKEN</span> на токен вашего бота
                </li>
                <li>
                  Замените <span className="font-bold">YOUR_WEBHOOK_URL</span> на скопированный URL webhook
                </li>
                <li>
                  Пример (не работает, используйте свой токен):
                  <div className="my-2">
                    <code className="bg-muted p-2 rounded text-xs block overflow-auto break-all">
                      https://api.telegram.org/bot{sampleToken}/setWebhook?url={encodeURIComponent(webhookUrl)}
                    </code>
                  </div>
                </li>
                <li>
                  Если всё настроено правильно, вы увидите ответ:
                  <div className="my-2">
                    <code className="bg-muted p-2 rounded text-xs block">
                      {"{"}"ok":true,"result":true,"description":"Webhook was set"{"}"}
                    </code>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button 
              variant="outline"
              onClick={() => {
                window.open(`https://t.me/${process.env.VITE_BOT_USERNAME || 'your_bot'}`, '_blank');
              }}
            >
              Открыть бота
            </Button>
            <Button 
              variant="outline"
              onClick={() => {
                window.open('https://core.telegram.org/bots/webhooks', '_blank');
              }}
            >
              Документация
            </Button>
          </div>
          
          {status === 'success' && (
            <Alert variant="default" className="bg-green-50 border-green-300">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Успешно!</AlertTitle>
              <AlertDescription className="text-green-700">
                {message}
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ошибка</AlertTitle>
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
          )}
        </CardFooter>
      </Card>
      
      {webhookInfo && (
        <Card>
          <CardHeader>
            <CardTitle>Информация о текущем webhook</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-xs overflow-auto">
              {JSON.stringify(webhookInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}