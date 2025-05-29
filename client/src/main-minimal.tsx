// МИНИМАЛЬНАЯ ВЕРСИЯ MAIN.TSX ДЛЯ ДИАГНОСТИКИ
console.log('🔬 MINIMAL: JavaScript загружается!');

// Только самые базовые импорты
import { createRoot } from "react-dom/client";

console.log('🔬 MINIMAL: React импортирован успешно');

// Минимальный компонент без сложных зависимостей
function MinimalApp() {
  return (
    <div style={{
      color: 'white',
      background: 'green', 
      padding: '20px',
      fontSize: '24px',
      textAlign: 'center'
    }}>
      🎯 МИНИМАЛЬНАЯ ВЕРСИЯ РАБОТАЕТ!
      <br/>
      Время: {new Date().toLocaleTimeString()}
    </div>
  );
}

console.log('🔬 MINIMAL: Компонент создан');

// Безопасный рендеринг
function render() {
  try {
    console.log('🔬 MINIMAL: Начинаем рендеринг...');
    
    const rootElement = document.getElementById("root");
    if (rootElement) {
      console.log('🔬 MINIMAL: Root элемент найден');
      const root = createRoot(rootElement);
      root.render(<MinimalApp />);
      console.log('🔬 MINIMAL: ✅ Рендеринг завершён успешно!');
    } else {
      console.error('🔬 MINIMAL: ❌ Root элемент не найден');
    }
  } catch (error) {
    console.error('🔬 MINIMAL: ❌ Ошибка рендеринга:', error);
  }
}

// Запуск
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}

console.log('🔬 MINIMAL: Скрипт выполнен до конца');