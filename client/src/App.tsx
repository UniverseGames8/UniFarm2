import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import sessionRestoreService from '@/services/sessionRestoreService';
import userService from '@/services/userService';
import { registerUserWithTelegram } from '@/services/authService';

interface AppProps {
  // Додайте необхідні пропси тут
}

export const App: React.FC<AppProps> = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [telegramAuthError, setTelegramAuthError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Метод для аутентификации только через guest_id и ref_code
  const authenticateWithTelegram = async () => {
    try {
      setIsLoading(true);
      setTelegramAuthError(null);

      console.log('[App] Начинаем аутентификацию только через guest_id и ref_code');
      
      // Этап 3.1: Проверка наличия реферального кода в URL
      let referrerCode: string | null = null;
      
      try {
        // Получаем реферальный код только из URL параметров
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('ref_code') || urlParams.has('refCode')) {
          const code = urlParams.get('ref_code') || urlParams.get('refCode');
          if (code) {
            referrerCode = code;
            console.log('[App] Обнаружен реферальный код в URL:', referrerCode);
            
            // Сохраняем реферальный код в sessionStorage
            sessionStorage.setItem('referrer_code', referrerCode);
            sessionStorage.setItem('referrer_code_timestamp', Date.now().toString());
          }
        } else {
          console.log('[App] Реферальный код в URL не обнаружен');
          
          // Проверяем сохраненный реферальный код
          const savedRefCode = sessionStorage.getItem('referrer_code');
          if (savedRefCode) {
            console.log('[App] Используем ранее сохраненный реферальный код:', savedRefCode);
            referrerCode = savedRefCode;
          }
        }
      } catch (error) {
        console.error('[App] Ошибка при обработке реферального кода:', error);
      }
      
      // Этап 5.1: Получение или создание гостевого ID
      const guestId = sessionRestoreService.getOrCreateGuestId();
      console.log('[App] Используем guest_id:', guestId);
      
      // Этап 5.2: Проверка существующего пользователя и создание нового при необходимости
      try {
        const existingUser = await userService.getUserByGuestId(guestId);
        
        if (existingUser) {
          console.log('[App] Найден существующий пользователь по guest_id:', existingUser);
          setUserId(existingUser.id);
          
          // Сохраняем guest_id для восстановления сессии
          sessionRestoreService.saveGuestId(guestId);
          
          // Обновляем кэш запросов для получения актуальных данных
          queryClient.invalidateQueries({ queryKey: ['/api/wallet/balance'] });
          queryClient.invalidateQueries({ queryKey: ['/api/me'] });
        } else {
          console.log('[App] Пользователь не найден, регистрируем нового с guest_id');
          
          // Регистрируем пользователя с guest_id и реферальным кодом (если есть)
          const registrationResult = await registerUserWithTelegram(guestId, referrerCode);
          
          if (registrationResult && registrationResult.success) {
            console.log('[App] Пользователь успешно зарегистрирован:', registrationResult);
            
            // Сохраняем данные о новом пользователе
            if (registrationResult.data && registrationResult.data.user_id) {
              const newUserId = registrationResult.data.user_id;
              setUserId(newUserId);
              
              // Сохраняем guest_id для будущего восстановления сессии
              sessionRestoreService.saveGuestId(guestId);
              
              // Устанавливаем статус зарегистрированного пользователя
              console.log('[App] Пользователь успешно идентифицирован и авторизован');
            } else {
              console.error('[App] API вернул успех, но отсутствуют данные пользователя');
              setTelegramAuthError('Ошибка получения ID пользователя');
            }
          } else {
            console.error('[App] Ошибка регистрации пользователя:', registrationResult);
            setTelegramAuthError('Ошибка регистрации пользователя');
          }
        }
      } catch (error) {
        console.error('[App] Ошибка при работе с пользователем:', error);
        setTelegramAuthError('Ошибка доступа к серверу');
      }
    } catch (error) {
      console.error('[App] Общая ошибка аутентификации:', error);
      setTelegramAuthError('Ошибка аутентификации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {isLoading ? (
        <div>Loading...</div>
      ) : telegramAuthError ? (
        <div>Error: {telegramAuthError}</div>
      ) : userId ? (
        <div>Welcome! User ID: {userId}</div>
      ) : (
        <button onClick={authenticateWithTelegram}>Authenticate</button>
      )}
    </div>
  );
};