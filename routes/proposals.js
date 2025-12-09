const express = require('express');
const puppeteer = require('puppeteer');
const { generateProposalHTML } = require('../public/js/proposalGenerator');

// Создаем два отдельных роутера для разных путей
const generateProposalRouter = express.Router();
const generateProposalPdfRouter = express.Router();

// Роутеры публичные - не требуют аутентификации

/**
 * POST /generate_proposal
 * Обработать форму и отобразить результат КП
 */
generateProposalRouter.post('/', (req, res) => {
  const { manager_name, manager_contact, customer_name, proposal_title, proposal_text, selected_products } = req.body;

  if (!manager_name || !manager_contact || !customer_name || !selected_products) {
    return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
  }

  let selectedProductsArray = [];
  try {
    selectedProductsArray = JSON.parse(selected_products);
    if (!Array.isArray(selectedProductsArray)) {
      throw new Error('selected_products не является массивом');
    }
  } catch (e) {
    console.error('Ошибка парсинга selected_products:', e);
    return res.status(400).json({ error: 'Неверный формат данных товаров' });
  }

  let total = 0;
  for (const item of selectedProductsArray) {
    const itemPrice = parseFloat(item.product.price) || 0;
    const itemQuantity = parseInt(item.quantity) || 0;
    total += itemPrice * itemQuantity;
  }

  const proposalHTML = generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProductsArray, total);
  res.send(proposalHTML);
});

/**
 * POST /generate_proposal_pdf
 * Генерация PDF коммерческого предложения
 */
generateProposalPdfRouter.post('/', async (req, res) => {
  const { manager_name, manager_contact, customer_name, proposal_title, proposal_text, selected_products } = req.body;

  if (!manager_name || !manager_contact || !customer_name || !selected_products) {
    return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
  }

  let selectedProductsArray = [];
  try {
    selectedProductsArray = JSON.parse(selected_products);
    if (!Array.isArray(selectedProductsArray)) {
      throw new Error('selected_products не является массивом');
    }
  } catch (e) {
    console.error('Ошибка парсинга selected_products:', e);
    return res.status(400).json({ error: 'Неверный формат данных товаров' });
  }

  let total = 0;
  for (const item of selectedProductsArray) {
    const itemPrice = parseFloat(item.product.price) || 0;
    const itemQuantity = parseInt(item.quantity) || 0;
    total += itemPrice * itemQuantity;
  }

  try {
    const proposalHTML = await generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProductsArray, total);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setViewport({ width: 2480, height: 3508 });
    await page.setContent(proposalHTML, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm'
      }
    });

    await browser.close();

    function sanitizeFilename(name) {
      return name
        .replace(/\s+/g, '_')
        .replace(/[^\w\u0400-\u04FF\u00C0-\u017F.-]/g, '_')
        .replace(/[^a-zA-Z0-9_.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .trim();
    }

    const safeCustomerName = sanitizeFilename(customer_name || 'client');
    const filename = `kommercheskoe_predlozhenie_${safeCustomerName}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Ошибка при генерации PDF:', error);
    res.status(500).json({ error: 'Ошибка при генерации PDF' });
  }
});

module.exports = {
  generateProposal: generateProposalRouter,
  generateProposalPdf: generateProposalPdfRouter
};
