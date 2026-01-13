-- Создание таблицы для хранения сессий
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

-- Индекс для быстрого поиска по session_id
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Индекс для очистки истекших сессий
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Индекс для поиска сессий пользователя
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Комментарии к таблице
COMMENT ON TABLE sessions IS 'Таблица для хранения активных сессий администраторов';
COMMENT ON COLUMN sessions.session_id IS 'Уникальный идентификатор сессии (64 символа hex)';
COMMENT ON COLUMN sessions.user_id IS 'ID пользователя из таблицы admin_users';
COMMENT ON COLUMN sessions.username IS 'Имя пользователя (для быстрого доступа без JOIN)';
COMMENT ON COLUMN sessions.created_at IS 'Время создания сессии';
COMMENT ON COLUMN sessions.last_activity IS 'Время последней активности (обновляется при каждом запросе)';
COMMENT ON COLUMN sessions.expires_at IS 'Время истечения сессии';
