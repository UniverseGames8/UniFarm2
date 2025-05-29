-- Миграция: добавление поля parent_ref_code в таблицу users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS parent_ref_code TEXT;

-- Создаем индекс для быстрого поиска по parent_ref_code
CREATE INDEX IF NOT EXISTS users_parent_ref_code_idx ON users (parent_ref_code);

-- Добавляем комментарий к колонке для документации
COMMENT ON COLUMN users.parent_ref_code IS 'Реферальный код пригласившего пользователя';