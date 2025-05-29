import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';
import { invalidateQueryWithUserId } from '@/lib/queryClient';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  resetButtonText?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Глобальный компонент ErrorBoundary для React-приложения
 * Отлавливает и обрабатывает ошибки в дочерних компонентах,
 * предотвращая "падение" всего приложения
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Обновляем состояние, чтобы при следующем рендере показать fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Логируем ошибку в консоль
    console.error('[ErrorBoundary] Перехвачена ошибка в компоненте:', error, errorInfo);
    
    // Сохраняем информацию об ошибке для отображения
    this.setState({
      errorInfo
    });
    
    // Здесь можно реализовать отправку ошибки в систему мониторинга
    // или выполнить другие действия по обработке ошибки
  }
  
  handleReset = (): void => {
    try {
      // Сбрасываем состояние ошибки, чтобы попытаться восстановить работу
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
      
      // Если передан обработчик сброса, вызываем его
      if (this.props.onReset) {
        this.props.onReset();
      }
      
      // Всегда обновляем ключевые данные приложения при сбросе ошибки
      try {
        // Обновляем основные данные пользователя в кэше React Query
        invalidateQueryWithUserId('/api/v2/me', [
          '/api/v2/wallet/balance',
          '/api/v2/transactions'
        ]);
      } catch (queryError) {
        console.error('[ErrorBoundary] Ошибка при обновлении кэша запросов:', queryError);
      }
    } catch (resetError) {
      console.error('[ErrorBoundary] Ошибка при сбросе состояния:', resetError);
    }
  };

  render(): ReactNode {
    // Если есть ошибка, показываем запасной UI
    if (this.state.hasError) {
      // Если передан кастомный fallback, используем его
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Получаем тексты из props или используем дефолтные
      const errorTitle = this.props.errorTitle || 'Что-то пошло не так';
      const errorDescription = this.props.errorDescription || 'Возникла ошибка при отображении этого компонента.';
      const resetButtonText = this.props.resetButtonText || 'Попробовать снова';
      
      // Современный стилизованный fallback UI, используя компоненты ShadCN
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-medium">{errorTitle}</AlertTitle>
          <AlertDescription className="mt-2">
            {errorDescription}
            
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer">Детали ошибки</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded bg-destructive/10 p-2">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </AlertDescription>
          
          <div className="flex justify-end mt-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={this.handleReset}
              className="text-xs gap-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RefreshCw className="h-3 w-3" />
              {resetButtonText}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </Alert>
      );
    }

    // Если ошибки нет, рендерим дочерние компоненты
    return this.props.children;
  }
}

export default ErrorBoundary;