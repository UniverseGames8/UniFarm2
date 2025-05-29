import React, { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import QueryErrorBoundary from '@/components/common/QueryErrorBoundary';

interface UseErrorBoundaryOptions {
  queryKey?: string | any[];
  errorTitle?: string;
  errorDescription?: string;
  resetButtonText?: string;
  fallback?: React.ReactNode;
}

/**
 * Хук для упрощенного использования QueryErrorBoundary с React Query
 * 
 * @param options - Опции для ErrorBoundary
 * @returns Функцию-обертку для оборачивания компонента в ErrorBoundary
 */
export default function useErrorBoundary(options: UseErrorBoundaryOptions = {}) {
  const queryClient = useQueryClient();
  
  // Функция сброса состояния QueryErrorBoundary и инвалидации React Query кэша
  const handleReset = useCallback(() => {
    if (options.queryKey) {
      // Если указан queryKey, инвалидируем данные в кэше
      queryClient.invalidateQueries({ queryKey: Array.isArray(options.queryKey) ? options.queryKey : [options.queryKey] });
    }
  }, [queryClient, options.queryKey]);
  
  // Функция для оборачивания компонента в ErrorBoundary
  const withErrorBoundary = useCallback(
    (children: React.ReactNode) => (
      <QueryErrorBoundary
        onReset={handleReset}
        queryKey={options.queryKey}
        errorTitle={options.errorTitle}
        errorDescription={options.errorDescription}
        resetButtonText={options.resetButtonText}
        fallback={options.fallback}
      >
        {children}
      </QueryErrorBoundary>
    ),
    [handleReset, options]
  );

  return withErrorBoundary;
}