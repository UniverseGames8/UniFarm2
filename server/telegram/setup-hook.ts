/**
 * Модуль для налаштування Telegram webhook
 * 
 * Цей модуль відповідає за правильне налаштування webhook для бота,
 * що дозволяє отримувати повідомлення від користувачів Telegram.
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Налаштування для логування
const logEnabled = process.env.TELEGRAM_DEBUG === 'true';
const logDir = path.join(process.cwd(), 'logs');

// Створюємо директорію для логів, якщо потрібно
if (logEnabled && !fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.error('[Telegram] Помилка створення директорії для логів:', err);
  }
}

// Функція для логування
function log(message: string, isError = false): void {
  const timestamp = new Date().toISOString();
  const logPrefix = isError ? '[Telegram ERROR]' : '[Telegram]';
  const logMessage = `${logPrefix} ${message}`;
  
  console[isError ? 'error' : 'log'](logMessage);
  
  if (logEnabled) {
    try {
      const logFile = path.join(logDir, isError ? 'telegram-errors.log' : 'telegram-webhook.log');
      fs.appendFileSync(logFile, `[${timestamp}] ${logMessage}\n`);
    } catch (err) {
      console.error('[Telegram] Помилка запису в лог-файл:', err);
    }
  }
}

/**
 * Налаштовує webhook для бота на вказаний URL
 */
/**
 * Налаштовує Telegram webhook (експортується під двома назвами для сумісності)
 */
interface WebhookResult {
  success: boolean;
  info?: any;
  error?: string;
  message?: string;
}

interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: any;
}

export async function setupTelegramHook(webhookUrl: string): Promise<WebhookResult> {
  return setupWebhook(webhookUrl);
}

export async function setupWebhook(webhookUrl: string): Promise<WebhookResult> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      log('TELEGRAM_BOT_TOKEN не встановлено в змінних середовища', true);
      return {
        success: false,
        error: 'Відсутній токен бота'
      };
    }
    
    if (!webhookUrl) {
      log('Не вказано URL для webhook', true);
      return {
        success: false,
        error: 'Не вказано URL для webhook'
      };
    }
    
    // Перевіряємо, що URL використовує HTTPS
    if (!webhookUrl.startsWith('https://')) {
      log(`URL "${webhookUrl}" не використовує HTTPS, що вимагається для webhook`, true);
      return {
        success: false,
        error: 'URL повинен використовувати HTTPS'
      };
    }
    
    // Спочатку перевіряємо поточний webhook щоб уникнути 429 помилки
    log(`Перевіряємо поточний webhook перед встановленням нового...`);
    
    const currentWebhookInfo = await getWebhookInfo();
    if (currentWebhookInfo.success && currentWebhookInfo.info?.url === webhookUrl) {
      log(`Webhook вже встановлено на ${webhookUrl}, пропускаємо встановлення`);
      return {
        success: true,
        message: 'Webhook вже встановлено на цей URL'
      };
    }
    
    log(`Налаштування webhook на URL: ${webhookUrl}`);
    
    // Формуємо URL для API запиту
    const apiUrl = `https://api.telegram.org/bot${botToken}/setWebhook`;
    
    // Виконуємо запит до Telegram API з повторними спробами
    let retries = 3;
    let lastError: Error | null = null;
    
    while (retries > 0) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            url: webhookUrl,
            drop_pending_updates: true,
            allowed_updates: ['message', 'callback_query']
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json() as TelegramResponse;
        
        if (!result.ok) {
          throw new Error(result.description || 'Unknown error from Telegram API');
        }
        
        log('Webhook успішно налаштовано');
        return getWebhookInfo();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log(`Спроба налаштування webhook не вдалася (залишилось спроб: ${retries - 1}): ${lastError.message}`, true);
        retries--;
        
        if (retries > 0) {
          // Чекаємо перед наступною спробою
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // Якщо всі спроби не вдалися
    log(`Всі спроби налаштування webhook не вдалися. Остання помилка: ${lastError?.message}`, true);
    return {
      success: false,
      error: `Не вдалося налаштувати webhook після кількох спроб: ${lastError?.message}`
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Виникла помилка при налаштуванні webhook: ${errorMessage}`, true);
    return {
      success: false,
      error: `Виникла помилка: ${errorMessage}`
    };
  }
}

/**
 * Отримує інформацію про поточний webhook
 */
export async function getWebhookInfo(): Promise<{ success: boolean; info?: any; error?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      log('TELEGRAM_BOT_TOKEN не встановлено в змінних середовища', true);
      return {
        success: false,
        error: 'Відсутній токен бота'
      };
    }
    
    // Формуємо URL для API запиту
    const apiUrl = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
    
    // Виконуємо запит до Telegram API
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Помилка отримання інформації про webhook: ${response.status} - ${errorText}`, true);
      return {
        success: false,
        error: `Помилка отримання інформації про webhook: ${response.status} - ${errorText}`
      };
    }
    
    const result = await response.json() as TelegramResponse;
    
    if (!result.ok) {
      log(`Telegram API повернув помилку: ${result.description}`, true);
      return {
        success: false,
        error: result.description
      };
    }
    
    log(`Отримано інформацію про webhook: ${JSON.stringify(result.result)}`);
    
    return {
      success: true,
      info: result.result
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Виникла помилка при отриманні інформації про webhook: ${errorMessage}`, true);
    return {
      success: false,
      error: `Виникла помилка: ${errorMessage}`
    };
  }
}

/**
 * Видаляє поточний webhook
 */
export async function deleteWebhook(): Promise<{ success: boolean; error?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      log('TELEGRAM_BOT_TOKEN не встановлено в змінних середовища', true);
      return {
        success: false,
        error: 'Відсутній токен бота'
      };
    }
    
    log('Видалення поточного webhook');
    
    // Формуємо URL для API запиту
    const apiUrl = `https://api.telegram.org/bot${botToken}/deleteWebhook`;
    
    // Виконуємо запит до Telegram API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        drop_pending_updates: true
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Помилка видалення webhook: ${response.status} - ${errorText}`, true);
      return {
        success: false,
        error: `Помилка видалення webhook: ${response.status} - ${errorText}`
      };
    }
    
    const result = await response.json();
    
    if (!result.ok) {
      log(`Telegram API повернув помилку: ${result.description}`, true);
      return {
        success: false,
        error: result.description
      };
    }
    
    log('Webhook успішно видалено');
    
    return {
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Виникла помилка при видаленні webhook: ${errorMessage}`, true);
    return {
      success: false,
      error: `Виникла помилка: ${errorMessage}`
    };
  }
}

/**
 * Встановлює текст та URL для кнопки меню бота
 */
export async function setMenuButton(text: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken) {
      log('TELEGRAM_BOT_TOKEN не встановлено в змінних середовища', true);
      return {
        success: false,
        error: 'Відсутній токен бота'
      };
    }
    
    if (!text || !url) {
      log('Не вказано текст або URL для кнопки меню', true);
      return {
        success: false,
        error: 'Не вказано текст або URL для кнопки меню'
      };
    }
    
    log(`Налаштування кнопки меню з текстом "${text}" та URL "${url}"`);
    
    try {
      // Спочатку пробуємо метод setChatMenuButton (новий API)
      // Формуємо URL для API запиту
      const apiUrl = `https://api.telegram.org/bot${botToken}/setChatMenuButton`;
      
      // Виконуємо запит до Telegram API
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menu_button: {
            type: 'web_app',
            text: text,
            web_app: {
              url: url
            }
          }
        })
      });
      
      if (!response.ok) {
        // Якщо setChatMenuButton не спрацював, пробуємо застарілий метод setMenuButton
        log(`Метод setChatMenuButton повернув помилку, пробуємо альтернативний метод...`);
        
        const oldApiUrl = `https://api.telegram.org/bot${botToken}/setMenuButton`;
        const oldResponse = await fetch(oldApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: text,
              web_app: {
                url: url
              }
            }
          })
        });
        
        if (!oldResponse.ok) {
          const errorText = await oldResponse.text();
          log(`Помилка при використанні альтернативного методу: ${oldResponse.status} - ${errorText}`, true);
          // Не повертаємо помилку, оскільки це не критично для роботи
          log('Продовжуємо роботу без налаштування кнопки меню');
          return {
            success: true,
            error: 'Налаштування кнопки меню пропущено'
          };
        }
        
        const oldResult = await oldResponse.json();
        
        if (!oldResult.ok) {
          log(`Telegram API повернув помилку для альтернативного методу: ${oldResult.description}`, true);
          // Не критично для роботи додатку
          return {
            success: true,
            error: 'Налаштування кнопки меню пропущено'
          };
        }
        
        log('Кнопка меню успішно налаштована через альтернативний метод');
        return { success: true };
      }
      
      const result = await response.json();
      
      if (!result.ok) {
        log(`Telegram API повернув помилку: ${result.description}`, true);
        // Не критично для роботи
        return {
          success: true,
          error: 'Налаштування кнопки меню пропущено'
        };
      }
      
      log('Кнопка меню успішно налаштована');
      
      return {
        success: true
      };
    } catch (apiError) {
      // Ігноруємо помилки налаштування кнопки меню, оскільки це не критично для роботи додатку
      log(`Помилка API при налаштуванні кнопки меню: ${apiError instanceof Error ? apiError.message : String(apiError)}`, true);
      return {
        success: true,
        error: 'Налаштування кнопки меню пропущено через помилку API'
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Виникла помилка при налаштуванні кнопки меню: ${errorMessage}`, true);
    // Не критично для роботи
    return {
      success: true,
      error: `Пропущено: ${errorMessage}`
    };
  }
}