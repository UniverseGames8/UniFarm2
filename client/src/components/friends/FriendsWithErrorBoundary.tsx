import React from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import Friends from '@/pages/Friends';

/**
 * Компонент-обертка с ErrorBoundary для страницы партнерской программы
 * Отображает состояние ошибки для повышения устойчивости приложения
 */
const FriendsWithErrorBoundary: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackRender={({ error }: { error: Error }) => (
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-red-600">Произошла ошибка при загрузке партнерской программы</h2>
          <p className="text-gray-600">Мы работаем над устранением проблемы. Пожалуйста, попробуйте позже.</p>
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg"
          >
            Обновить страницу
          </button>
        </div>
      )}
    >
      <Friends />
    </ErrorBoundary>
  );
};

export default FriendsWithErrorBoundary;