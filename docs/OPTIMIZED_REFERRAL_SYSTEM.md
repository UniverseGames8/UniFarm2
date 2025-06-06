# Оптимизированная реферальная система

В проекте реализована оптимизированная реферальная система, которая значительно повышает производительность и надежность при работе с большими объемами данных и глубокими реферальными структурами. 

## Основные улучшения

1. **Рекурсивные CTE запросы** - использование рекурсивных Common Table Expressions (CTE) в PostgreSQL для эффективного получения всей реферальной структуры за один запрос
2. **Атомарные транзакции** - полная атомарность операций с надежным откатом при ошибках
3. **Пакетная обработка** - оптимизированная обработка балансов и транзакций за счет группировки операций
4. **Оптимальные индексы** - автоматическое создание необходимых индексов для ускорения операций с реферальной системой
5. **Мониторинг производительности** - встроенная система метрик и логирования для анализа производительности

## Компоненты системы

### OptimizedReferralTreeService

Сервис для эффективной работы с реферальными деревьями:

- Получение полной структуры рефералов за один запрос с помощью рекурсивных CTE
- Получение цепочки инвайтеров (вышестоящих пользователей) с указанием уровня
- Агрегация статистики по уровням реферальной структуры

### OptimizedReferralBonusProcessor

Процессор для надежной обработки реферальных вознаграждений:

- Асинхронная очередь начислений с пакетной обработкой
- Атомарные транзакции с автоматическим откатом при сбоях
- Система восстановления после неудачных начислений
- Детальное логирование операций и их результатов

### ReferralSystemIntegrator

Интегратор для плавного перехода между старой и новой системами:

- Единый интерфейс для обоих реализаций
- Переключение между стандартной и оптимизированной версиями
- Параметр `USE_OPTIMIZED_REFERRALS` в .env для управления режимом работы
- API для анализа производительности и состояния системы

## API endpoints

### Получение реферальной структуры

```
GET /api/referrals/tree/optimized
```

Получает дерево рефералов с поддержкой глубоких структур.

### Получение статистики по структуре

```
GET /api/referrals/structure
```

Возвращает агрегированную статистику по реферальной структуре пользователя (количество рефералов по уровням).

### Управление режимом работы

```
POST /api/system/referrals/toggle-optimized
```

Переключает между стандартной и оптимизированной версиями (только для администраторов).

### Получение метрик производительности

```
GET /api/system/referrals/metrics
```

Возвращает метрики производительности системы (только для администраторов).

## Тестирование

Для тестирования системы созданы скрипты:

1. `test-optimized-referrals.js` - Базовое тестирование основных функций системы
2. `test-referral-system.cjs` - Сравнительное тестирование производительности

## Включение оптимизированной системы

По умолчанию система использует стандартную реализацию. Для включения оптимизированной версии необходимо:

1. Установить в файле `.env` параметр `USE_OPTIMIZED_REFERRALS=true`
2. Перезапустить сервер

Или использовать API для переключения во время работы (только для админов):

```
POST /api/system/referrals/toggle-optimized
Content-Type: application/json

{
  "enabled": true
}
```

## Сравнение производительности

| Характеристика | Стандартная система | Оптимизированная система |
|----------------|---------------------|--------------------------|
| Запросы к БД   | O(n) - линейно растет с глубиной дерева | O(1) - один запрос, независимо от глубины |
| Атомарность    | Частичная           | Полная                   |
| Восстановление | Ручное             | Автоматическое           |
| Мониторинг     | Минимальный        | Расширенный              |

## Масштабируемость

Оптимизированная система способна эффективно работать с:

- Реферальными структурами до 20 уровней в глубину
- Большим количеством пользователей на каждом уровне
- Параллельной обработкой большого числа начислений