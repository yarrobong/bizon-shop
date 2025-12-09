const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/upload
 * Загрузка файла (только для авторизованных пользователей)
 */
router.post('/upload', requireAuth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  } catch (error) {
    console.error('Ошибка загрузки файла:', error);
    res.status(500).json({ error: 'Ошибка при загрузке файла' });
  }
});

module.exports = router;

