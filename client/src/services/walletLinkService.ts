/**
 * Сервис для привязки адреса TON-кошелька к пользователю
 */
import { getWalletAddress, isWalletConnected } from './tonConnectService';

// Проверка был ли уже отправлен адрес на сервер
let isAddressSent = false;

/**
 * Отправляет запрос на привязку TON-адреса к пользователю
 * @returns Promise с результатом запроса
 */
export async function linkWalletAddress(): Promise<{ success: boolean; message: string }> {
  try {
    // Проверяем подключен ли кошелек
    if (!isWalletConnected()) {
      console.log('[WalletLinkService] Wallet not connected, cannot link address');
      return { 
        success: false, 
        message: 'Кошелек не подключен'
      };
    }

    // Получаем адрес кошелька
    const walletAddress = getWalletAddress();
    if (!walletAddress) {
      console.log('[WalletLinkService] Failed to get wallet address');
      return { 
        success: false, 
        message: 'Не удалось получить адрес кошелька'
      };
    }

    console.log(`[WalletLinkService] Linking wallet address: ${walletAddress}`);

    // Отправляем запрос на привязку адреса к пользователю
    const response = await fetch('/api/v2/wallet/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('[WalletLinkService] Wallet address linked successfully:', result);
      isAddressSent = true; // Помечаем, что адрес был отправлен
      return { 
        success: true, 
        message: 'Адрес кошелька успешно привязан'
      };
    } else {
      console.error('[WalletLinkService] Failed to link wallet address:', result);
      return { 
        success: false, 
        message: result.message || 'Произошла ошибка при привязке адреса кошелька'
      };
    }
  } catch (error) {
    console.error('[WalletLinkService] Error linking wallet address:', error);
    return { 
      success: false, 
      message: 'Произошла ошибка при привязке адреса кошелька'
    };
  }
}

/**
 * Проверяет, был ли отправлен адрес на сервер
 * @returns true, если адрес был отправлен
 */
export function isWalletAddressSent(): boolean {
  return isAddressSent;
}

/**
 * Сбрасывает флаг отправки адреса
 */
export function resetWalletAddressSent(): void {
  isAddressSent = false;
}