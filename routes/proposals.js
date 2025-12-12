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
generateProposalRouter.post('/', async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:15',message:'HTML generation route entry',data:{hasBody:!!req.body,bodyKeys:req.body?Object.keys(req.body):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const { manager_name, manager_contact, customer_name, proposal_title, proposal_text, selected_products } = req.body;

  if (!manager_name || !manager_contact || !customer_name || !selected_products) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:19',message:'Missing required fields',data:{manager_name:!!manager_name,manager_contact:!!manager_contact,customer_name:!!customer_name,selected_products:!!selected_products},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
  }

  let selectedProductsArray = [];
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:24',message:'Before parsing selected_products',data:{selected_products_type:typeof selected_products,selected_products_length:selected_products?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    selectedProductsArray = JSON.parse(selected_products);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:25',message:'After parsing selected_products',data:{isArray:Array.isArray(selectedProductsArray),arrayLength:selectedProductsArray?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!Array.isArray(selectedProductsArray)) {
      throw new Error('selected_products не является массивом');
    }
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:29',message:'Parse error',data:{error:e.message,errorType:e.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:41',message:'Before generateProposalHTML call',data:{productsCount:selectedProductsArray.length,total},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const proposalHTML = await generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProductsArray, total);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:42',message:'After generateProposalHTML call',data:{htmlLength:proposalHTML?.length,htmlType:typeof proposalHTML},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    res.send(proposalHTML);
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:44',message:'Error generating HTML',data:{error:error.message,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Ошибка при генерации HTML КП:', error);
    res.status(500).json({ error: 'Ошибка при генерации коммерческого предложения' });
  }
});

/**
 * POST /generate_proposal_pdf
 * Генерация PDF коммерческого предложения
 */
generateProposalPdfRouter.post('/', async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:77',message:'PDF generation route entry',data:{hasBody:!!req.body,bodyKeys:req.body?Object.keys(req.body):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  const { manager_name, manager_contact, customer_name, proposal_title, proposal_text, selected_products } = req.body;

  if (!manager_name || !manager_contact || !customer_name || !selected_products) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:80',message:'Missing required fields in PDF route',data:{manager_name:!!manager_name,manager_contact:!!manager_contact,customer_name:!!customer_name,selected_products:!!selected_products},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    return res.status(400).json({ error: 'Отсутствуют обязательные поля' });
  }

  let selectedProductsArray = [];
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:86',message:'Before parsing selected_products in PDF route',data:{selected_products_type:typeof selected_products,selected_products_length:selected_products?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    selectedProductsArray = JSON.parse(selected_products);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:87',message:'After parsing selected_products in PDF route',data:{isArray:Array.isArray(selectedProductsArray),arrayLength:selectedProductsArray?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!Array.isArray(selectedProductsArray)) {
      throw new Error('selected_products не является массивом');
    }
  } catch (e) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:91',message:'Parse error in PDF route',data:{error:e.message,errorType:e.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:103',message:'Before generateProposalHTML call in PDF route',data:{productsCount:selectedProductsArray.length,total,generateProposalHTMLType:typeof generateProposalHTML},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const proposalHTML = await generateProposalHTML(manager_name, manager_contact, customer_name, proposal_title, proposal_text, selectedProductsArray, total);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:104',message:'After generateProposalHTML call in PDF route',data:{htmlLength:proposalHTML?.length,htmlType:typeof proposalHTML,isFunction:typeof proposalHTML==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:106',message:'Before puppeteer launch',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:109',message:'After puppeteer launch',data:{browserConnected:!!browser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const page = await browser.newPage();

    await page.setViewport({ width: 2480, height: 3508 });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:112',message:'Before setContent',data:{htmlLength:proposalHTML?.length,htmlType:typeof proposalHTML},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    await page.setContent(proposalHTML, { waitUntil: 'networkidle0' });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:113',message:'After setContent',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:126',message:'After PDF generation',data:{pdfBufferLength:pdfBuffer?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/4d774403-cac7-4ac6-8987-7810186c8a1f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'routes/proposals.js:120',message:'Error generating PDF',data:{error:error.message,errorStack:error.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Ошибка при генерации PDF:', error);
    res.status(500).json({ error: 'Ошибка при генерации PDF' });
  }
});

module.exports = {
  generateProposal: generateProposalRouter,
  generateProposalPdf: generateProposalPdfRouter
};
