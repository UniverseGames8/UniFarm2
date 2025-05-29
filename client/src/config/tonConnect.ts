/**
 * Конфигурация TonConnect для подключения к TON-кошелькам
 */

// Манифест для подключения TonConnect
// Используем локальный манифест из /public/tonconnect-manifest.json
export const TONCONNECT_MANIFEST_URL = '/tonconnect-manifest.json';

// Опции для TonConnect UI
export const tonConnectOptions = {
  manifestUrl: TONCONNECT_MANIFEST_URL,
  buttonRootId: 'ton-connect-button'
};