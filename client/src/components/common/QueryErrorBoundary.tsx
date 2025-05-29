import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, ChevronRight } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  queryKey?: string | any[];
  onReset?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  resetButtonText?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Компонент для обработки ошибок в React Query запросах
 * Устанавливает красивую заглушку вместо сломанного компонента
 */
class QueryErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Обновляем состояние, чтобы при следующем рендере показать запасной UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Можно также отправить отчет об ошибке в сервис аналитики
    console.error(`[QueryErrorBoundary] Ошибка в компоненте:`, error);
    console.error(`[QueryErrorBoundary] Информация:`, errorInfo);
  }
  
  handleReset = (): void => {
    // Сбрасываем состояние ошибки
    this.setState({ hasError: false, error: null });
    
    // Вызываем пользовательский обработчик сброса, если он есть
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { 
      children, 
      fallback,
      queryKey,
      errorTitle = 'Произошла ошибка при загрузке данных',
      errorDescription = 'Не удалось загрузить содержимое этого компонента. Попробуйте обновить или вернуться позже.',
      resetButtonText = 'Попробовать снова'
    } = this.props;

    // Если есть ошибка, показываем запасной UI
    if (hasError) {
      // Если передан fallback, используем его
      if (fallback) {
        return fallback;
      }

      // Иначе используем стандартный интерфейс ошибки
      return (
        <div className="relative overflow-hidden rounded-lg border border-destructive/20 p-4 bg-card/30 backdrop-blur-sm shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-tr from-red-500/5 to-orange-500/5 z-0"></div>
          
          <Alert variant="destructive" className="bg-transparent border-destructive/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-medium">{errorTitle}</AlertTitle>
            <AlertDescription className="text-sm text-muted-foreground">
              {errorDescription}
              {error && process.env.NODE_ENV === 'development' && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">Детали ошибки</summary>
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-destructive/10 p-2">
                    {error.message}
                    {'\n'}
                    {error.stack}
                  </pre>
                </details>
              )}
            </AlertDescription>
          </Alert>

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

          {queryKey && process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="opacity-60">Query key: </span>
              <code className="text-[10px] bg-muted p-1 rounded">
                {typeof queryKey === 'string' ? queryKey : JSON.stringify(queryKey)}
              </code>
            </div>
          )}
        </div>
      );
    }

    // Если ошибки нет, рендерим детей как обычно
    return children;
  }
}

export default QueryErrorBoundary;