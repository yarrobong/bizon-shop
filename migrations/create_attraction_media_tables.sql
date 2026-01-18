-- Создание таблиц для изображений и видео аттракционов

-- Таблица для изображений аттракционов
CREATE TABLE IF NOT EXISTS attraction_images (
    id SERIAL PRIMARY KEY,
    attraction_id INTEGER NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для видео аттракционов
CREATE TABLE IF NOT EXISTS attraction_videos (
    id SERIAL PRIMARY KEY,
    attraction_id INTEGER NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_attraction_images_attraction_id ON attraction_images(attraction_id);
CREATE INDEX IF NOT EXISTS idx_attraction_videos_attraction_id ON attraction_videos(attraction_id);
CREATE INDEX IF NOT EXISTS idx_attraction_images_primary ON attraction_images(attraction_id, is_primary) WHERE is_primary = true;
CREATE INDEX IF NOT EXISTS idx_attraction_videos_primary ON attraction_videos(attraction_id, is_primary) WHERE is_primary = true;

-- Комментарии для документации
COMMENT ON TABLE attraction_images IS 'Изображения для VR аттракционов';
COMMENT ON TABLE attraction_videos IS 'Видео для VR аттракционов';
