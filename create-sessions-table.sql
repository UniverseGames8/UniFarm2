-- Скрипт для создания таблицы sessions для хранения сессий
-- Может использоваться для ручного создания таблицы, если автоматическое создание не работает

-- Создаем таблицу sessions, если она не существует
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

-- Создаем индекс для быстрого поиска по времени истечения
CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);

-- Предоставляем примеры SQL-запросов для управления сессиями

-- Пример очистки всех устаревших сессий
-- DELETE FROM sessions WHERE expire < NOW();

-- Пример просмотра всех активных сессий
-- SELECT sid, sess->'user'->'id' as user_id, expire FROM sessions WHERE expire > NOW();

-- Пример удаления всех сессий конкретного пользователя
-- DELETE FROM sessions WHERE sess->'user'->'id' = '123';