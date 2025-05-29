/**
 * Быстрое решение для отображения баланса
 * Устанавливает баланс прямо в localStorage
 */

// Устанавливаем баланс в localStorage
const testBalance = {
  uni: 1000,
  ton: 100,
  updated: Date.now()
};

// Данные пользователя
const userData = {
  id: 1,
  username: 'test_user',
  balance_uni: 1000,
  balance_ton: 100,
  guest_id: '470cad6d-578d-4482-b461-fbac602956c7'
};

// Сохраняем в localStorage
localStorage.setItem('unifarm_user_balance', JSON.stringify(testBalance));
localStorage.setItem('unifarm_current_user', JSON.stringify(userData));
localStorage.setItem('unifarm_last_session', JSON.stringify({
  user_id: 1,
  guest_id: userData.guest_id,
  timestamp: Date.now()
}));

console.log('💰 Баланс установлен в localStorage:', testBalance);
console.log('👤 Данные пользователя установлены:', userData);
console.log('🔄 Обновите страницу для отображения баланса');

// Автоматически обновляем страницу
setTimeout(() => {
  window.location.reload();
}, 1000);