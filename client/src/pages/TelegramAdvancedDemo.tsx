/**
 * ЭТАП 3: Демонстрационная страница для всех улучшенных функций Telegram WebApp
 * 
 * Показывает практическое использование:
 * 1. CloudStorage API - сохранение/загрузка настроек
 * 2. SendData API - отправка данных в бот
 * 3. Централизованная обработка ошибок
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TelegramAdvanced } from '../services/telegramAdvancedService';
import TelegramCloseButton from '../components/telegram/TelegramCloseButton';
import ForceRefreshButton from '../components/telegram/ForceRefreshButton';

const TelegramAdvancedDemo: React.FC = () => {
  // ЭТАП 3: Состояние для демонстрации CloudStorage
  const [userSettings, setUserSettings] = useState({
    language: 'ru',
    theme: 'auto',
    notifications: true,
    currency: 'UNI'
  });
  
  // ЭТАП 3: Состояние для демонстрации SendData
  const [sendDataDemo, setSendDataDemo] = useState({
    selectedBoost: '',
    farmingAmount: 100,
    lastAction: ''
  });
  
  // ЭТАП 3: Состояние сервисов
  const [serviceStatus, setServiceStatus] = useState<any>(null);
  const [lastOperation, setLastOperation] = useState<string>('');

  // ЭТАП 3: Загрузка начальных данных
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      console.log('[ADVANCED DEMO] 📊 Загрузка начальных данных...');
      
      // Загружаем настройки
      const settings = await TelegramAdvanced.loadSettings();
      if (settings) {
        setUserSettings({
          language: settings.language || 'ru',
          theme: settings.theme || 'auto',
          notifications: settings.farmingNotifications !== false,
          currency: settings.preferredCurrency || 'UNI'
        });
      }
      
      // Получаем статус сервисов
      const status = TelegramAdvanced.getStatus();
      setServiceStatus(status);
      
      setLastOperation('Данные загружены');
    } catch (error) {
      console.error('[ADVANCED DEMO] ❌ Ошибка загрузки:', error);
      setLastOperation('Ошибка загрузки данных');
    }
  };

  // ЭТАП 3: Обработчики для CloudStorage
  const handleSaveSettings = async () => {
    try {
      console.log('[ADVANCED DEMO] 💾 Сохранение настроек:', userSettings);
      
      const success = await TelegramAdvanced.saveSettings({
        language: userSettings.language,
        theme: userSettings.theme as 'light' | 'dark' | 'auto',
        farmingNotifications: userSettings.notifications,
        preferredCurrency: userSettings.currency as 'UNI' | 'TON'
      });
      
      if (success) {
        setLastOperation('Настройки сохранены в CloudStorage');
      } else {
        setLastOperation('Ошибка сохранения (используется localStorage)');
      }
    } catch (error) {
      setLastOperation('Критическая ошибка сохранения');
    }
  };

  const handleLoadSettings = async () => {
    try {
      console.log('[ADVANCED DEMO] 📖 Загрузка настроек...');
      
      const settings = await TelegramAdvanced.loadSettings();
      if (settings) {
        setUserSettings({
          language: settings.language || 'ru',
          theme: settings.theme || 'auto',
          notifications: settings.farmingNotifications !== false,
          currency: settings.preferredCurrency || 'UNI'
        });
        setLastOperation('Настройки загружены из CloudStorage');
      } else {
        setLastOperation('Настройки не найдены');
      }
    } catch (error) {
      setLastOperation('Ошибка загрузки настроек');
    }
  };

  // ЭТАП 3: Обработчики для SendData
  const handleSendBoostSelection = async () => {
    try {
      console.log('[ADVANCED DEMO] 🚀 Отправка выбора буста...');
      
      const boostData = {
        type: 'boost_selection',
        boostId: sendDataDemo.selectedBoost,
        userId: 1, // Демо ID
        timestamp: Date.now()
      };
      
      const success = await TelegramAdvanced.sendToBot(boostData);
      
      if (success) {
        setLastOperation(`Выбор буста "${sendDataDemo.selectedBoost}" отправлен в бот`);
      } else {
        setLastOperation('SendData API недоступен');
      }
    } catch (error) {
      setLastOperation('Ошибка отправки данных');
    }
  };

  const handleSendFarmingResult = async () => {
    try {
      console.log('[ADVANCED DEMO] 🌱 Отправка результата фарминга...');
      
      const success = await TelegramAdvanced.sendUtils.farmingStarted(1, sendDataDemo.farmingAmount);
      
      if (success) {
        setLastOperation(`Фарминг ${sendDataDemo.farmingAmount} UNI отправлен в бот`);
      } else {
        setLastOperation('SendData API недоступен');
      }
    } catch (error) {
      setLastOperation('Ошибка отправки фарминга');
    }
  };

  // ЭТАП 3: Обновление статуса сервисов
  const refreshServiceStatus = () => {
    const status = TelegramAdvanced.getStatus();
    setServiceStatus(status);
    setLastOperation('Статус сервисов обновлен');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Telegram Advanced Features Demo</h1>
      
      {/* ЭТАП 3: Статус сервисов */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📊 Статус сервисов</CardTitle>
          <CardDescription>Текущее состояние всех Telegram WebApp сервисов</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className={`text-2xl mb-2 ${serviceStatus?.advanced?.features?.cloudStorage ? 'text-green-500' : 'text-red-500'}`}>
                {serviceStatus?.advanced?.features?.cloudStorage ? '✅' : '❌'}
              </div>
              <p className="text-sm font-semibold">CloudStorage</p>
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.advanced?.features?.cloudStorage ? 'Доступно' : 'Недоступно'}
              </p>
            </div>
            <div className="text-center">
              <div className={`text-2xl mb-2 ${serviceStatus?.advanced?.features?.sendData ? 'text-green-500' : 'text-red-500'}`}>
                {serviceStatus?.advanced?.features?.sendData ? '✅' : '❌'}
              </div>
              <p className="text-sm font-semibold">SendData</p>
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.advanced?.features?.sendData ? 'Доступно' : 'Недоступно'}
              </p>
            </div>
            <div className="text-center">
              <div className={`text-2xl mb-2 ${serviceStatus?.advanced?.features?.errorHandling ? 'text-green-500' : 'text-red-500'}`}>
                {serviceStatus?.advanced?.features?.errorHandling ? '✅' : '❌'}
              </div>
              <p className="text-sm font-semibold">Error Handling</p>
              <p className="text-xs text-muted-foreground">
                {serviceStatus?.advanced?.features?.errorHandling ? 'Активно' : 'Неактивно'}
              </p>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Последняя операция: <span className="font-semibold">{lastOperation || 'Нет операций'}</span>
            </div>
            <Button onClick={refreshServiceStatus} variant="outline" size="sm">
              🔄 Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ЭТАП 3: CloudStorage Demo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>☁️ CloudStorage API</CardTitle>
          <CardDescription>Сохранение и загрузка пользовательских настроек</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="language">Язык</Label>
              <Select value={userSettings.language} onValueChange={(value) => 
                setUserSettings(prev => ({...prev, language: value}))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="uk">Українська</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="theme">Тема</Label>
              <Select value={userSettings.theme} onValueChange={(value) => 
                setUserSettings(prev => ({...prev, theme: value}))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Светлая</SelectItem>
                  <SelectItem value="dark">Темная</SelectItem>
                  <SelectItem value="auto">Авто</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button onClick={handleSaveSettings} variant="default">
              💾 Сохранить настройки
            </Button>
            <Button onClick={handleLoadSettings} variant="outline">
              📖 Загрузить настройки
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ЭТАП 3: SendData Demo */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📤 SendData API</CardTitle>
          <CardDescription>Отправка данных в Telegram-бот</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="boost">Выбор буста</Label>
              <Select value={sendDataDemo.selectedBoost} onValueChange={(value) => 
                setSendDataDemo(prev => ({...prev, selectedBoost: value}))
              }>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите буст" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="speed_boost">Speed Boost</SelectItem>
                  <SelectItem value="double_boost">Double Boost</SelectItem>
                  <SelectItem value="mega_boost">Mega Boost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="farming">Количество фарминга</Label>
              <Input
                type="number"
                value={sendDataDemo.farmingAmount}
                onChange={(e) => setSendDataDemo(prev => ({
                  ...prev, 
                  farmingAmount: parseInt(e.target.value) || 0
                }))}
                placeholder="100"
              />
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              onClick={handleSendBoostSelection} 
              variant="default"
              disabled={!sendDataDemo.selectedBoost}
            >
              🚀 Отправить выбор буста
            </Button>
            <Button onClick={handleSendFarmingResult} variant="outline">
              🌱 Отправить результат фарминга
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ЭТАП 3: Инструкции */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>📝 Инструкции по тестированию</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>CloudStorage:</strong> Измените настройки и нажмите "Сохранить". 
              Настройки сохранятся в Telegram CloudStorage или localStorage как fallback.
            </div>
            <div>
              <strong>SendData:</strong> Выберите буст или укажите количество фарминга и отправьте данные. 
              Если приложение запущено в Telegram, данные будут отправлены боту.
            </div>
            <div>
              <strong>Error Handling:</strong> Все ошибки логируются в консоль в формате [TG ERROR] method — message.
            </div>
            <div className="text-muted-foreground">
              <strong>Логи:</strong> Откройте консоль браузера для просмотра всех операций и ошибок.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ФИНАЛЬНОЕ ЗАВЕРШЕНИЕ: Кнопка закрытия Telegram Mini App */}
      <Card>
        <CardHeader>
          <CardTitle>🚪 Закрытие приложения</CardTitle>
          <CardDescription>
            Корректное завершение работы Telegram Mini App
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>При нажатии на кнопку ниже будет вызван официальный метод Telegram.WebApp.close().</p>
              <p>В консоли появится лог: <code>[TG CLOSE CLICKED]</code></p>
            </div>
            
            <div className="flex justify-center space-x-4">
              <ForceRefreshButton 
                variant="secondary" 
                size="lg" 
                showIcon={true}
              />
              <TelegramCloseButton 
                variant="destructive" 
                size="lg" 
                showIcon={true}
              />
            </div>
            
            <div className="text-xs text-muted-foreground text-center">
              <strong>Примечание:</strong> Если приложение запущено не в Telegram, 
              кнопка выполнит fallback навигацию назад в браузере.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TelegramAdvancedDemo;