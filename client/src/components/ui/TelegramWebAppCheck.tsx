/**
 * Компонент для проверки запуска приложения в Telegram Mini App
 * Проверка отключена для прямого доступа через браузер
 */
import React from 'react';

interface TelegramWebAppCheckProps {
  children: React.ReactNode;
}

export default function TelegramWebAppCheck({ children }: TelegramWebAppCheckProps) {
  // Отключаем проверку Telegram - показываем содержимое приложения в любом случае
  return <>{children}</>;
}