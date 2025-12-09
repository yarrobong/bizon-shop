const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

// Создаем отдельные роутеры для каждого типа логистики
const purchaseOrdersRouter = express.Router();
const clientsRouter = express.Router();
const buyersRouter = express.Router();
const shipmentsRouter = express.Router();
const distributionRouter = express.Router();
const paymentsRouter = express.Router();

// Все логистические роуты требуют аутентификации
purchaseOrdersRouter.use(requireAuth);
clientsRouter.use(requireAuth);
buyersRouter.use(requireAuth);
shipmentsRouter.use(requireAuth);
distributionRouter.use(requireAuth);
paymentsRouter.use(requireAuth);

// ========== PURCHASE ORDERS ==========

purchaseOrdersRouter.get('/', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT 
        po.OrderID, po.OurOrderNumber, po.BuyerOrderNumber, po.ClientID, po.BuyerID,
        po.OrderDate, po.Description, po.Status, po.Comments,
        c.Name as ClientName, b.Name as BuyerName
      FROM purchaseOrders po
      LEFT JOIN Clients c ON po.ClientID = c.ClientID
      LEFT JOIN Buyers b ON po.BuyerID = b.BuyerID
      ORDER BY po.OrderDate DESC
    `);

    const orders = ordersResult.rows.map(row => ({
      OrderID: row.OrderID,
      OurOrderNumber: row.OurOrderNumber,
      BuyerOrderNumber: row.BuyerOrderNumber,
      ClientID: row.ClientID,
      BuyerID: row.BuyerID,
      OrderDate: row.OrderDate,
      Description: row.Description,
      Status: row.Status,
      Comments: row.Comments,
      ClientName: row.ClientName,
      BuyerName: row.BuyerName
    }));

    res.json(orders);
  } catch (err) {
    console.error('❌ Ошибка при получении заказов:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить заказы', details: err.message });
  }
});

purchaseOrdersRouter.post('/', async (req, res) => {
  const { OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID, OrderDate, Description, Status, Comments } = req.body;

  if (!OurOrderNumber || !ClientID || !BuyerID || !OrderDate) {
    return res.status(400).json({ success: false, message: 'Не все обязательные поля заполнены' });
  }

  try {
    const query = `
      INSERT INTO purchaseOrders (OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID, OrderDate, Description, Status, Comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING OrderID
    `;

    const result = await pool.query(query, [OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID, OrderDate, Description, Status, Comments]);
    res.json({ success: true, OrderID: result.rows[0].OrderID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении заказа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

purchaseOrdersRouter.get('/:id', async (req, res) => {
  const orderId = req.params.id;
  try {
    const orderResult = await pool.query(`
      SELECT OrderID, OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID,
        OrderDate, Description, Status, Comments
      FROM purchaseOrders
      WHERE OrderID = $1
    `, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Заказ не найден' });
    }

    const order = orderResult.rows[0];
    res.json({
      OrderID: order.OrderID,
      OurOrderNumber: order.OurOrderNumber,
      BuyerOrderNumber: order.BuyerOrderNumber,
      ClientID: order.ClientID,
      BuyerID: order.BuyerID,
      OrderDate: order.OrderDate,
      Description: order.Description,
      Status: order.Status,
      Comments: order.Comments
    });
  } catch (err) {
    console.error('❌ Ошибка при получении заказа по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить заказ', details: err.message });
  }
});

purchaseOrdersRouter.put('/:id', async (req, res) => {
  const orderId = req.params.id;
  const { OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID, OrderDate, Description, Status, Comments } = req.body;

  try {
    const query = `
      UPDATE purchaseOrders 
      SET OurOrderNumber = $1, BuyerOrderNumber = $2, ClientID = $3, BuyerID = $4, OrderDate = $5, Description = $6, Status = $7, Comments = $8
      WHERE OrderID = $9
    `;

    await pool.query(query, [OurOrderNumber, BuyerOrderNumber, ClientID, BuyerID, OrderDate, Description, Status, Comments, orderId]);
    res.json({ success: true, message: 'Заказ обновлен успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении заказа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

purchaseOrdersRouter.delete('/:id', async (req, res) => {
  const orderId = req.params.id;
  try {
    await pool.query('DELETE FROM purchaseOrders WHERE OrderID = $1', [orderId]);
    res.json({ success: true, message: 'Заказ удален успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении заказа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

purchaseOrdersRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT po.OrderID, po.OurOrderNumber, po.BuyerOrderNumber, po.ClientID, po.BuyerID,
        po.OrderDate, po.Description, po.Status, po.Comments,
        c.Name as ClientName, b.Name as BuyerName
      FROM purchaseOrders po
      LEFT JOIN Clients c ON po.ClientID = c.ClientID
      LEFT JOIN Buyers b ON po.BuyerID = b.BuyerID
      WHERE po.OurOrderNumber ILIKE $1 OR c.Name ILIKE $1
      ORDER BY po.OrderDate DESC
    `, [`%${query}%`]);

    const orders = searchResult.rows.map(row => ({
      OrderID: row.OrderID,
      OurOrderNumber: row.OurOrderNumber,
      BuyerOrderNumber: row.BuyerOrderNumber,
      ClientID: row.ClientID,
      BuyerID: row.BuyerID,
      OrderDate: row.OrderDate,
      Description: row.Description,
      Status: row.Status,
      Comments: row.Comments,
      ClientName: row.ClientName,
      BuyerName: row.BuyerName
    }));

    res.json(orders);
  } catch (err) {
    console.error('❌ Ошибка при поиске заказов:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

// ========== CLIENTS ==========

clientsRouter.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT clientid, name, contact, address, notes
      FROM clients
      ORDER BY name
    `);

    const clients = rows.map(r => ({
      ClientID: r.clientid,
      Name: r.name,
      Contact: r.contact,
      Address: r.address,
      Notes: r.notes
    }));

    res.json(clients);
  } catch (err) {
    console.error('❌ Ошибка при получении клиентов:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить клиентов', details: err.message });
  }
});

clientsRouter.post('/', async (req, res) => {
  const { Name, Contact, Address, Notes } = req.body;

  if (!Name) {
    return res.status(400).json({ success: false, message: 'Имя клиента обязательно' });
  }

  try {
    const query = `
      INSERT INTO clients (Name, Contact, Address, Notes)
      VALUES ($1, $2, $3, $4)
      RETURNING ClientID
    `;

    const result = await pool.query(query, [Name, Contact, Address, Notes]);
    res.json({ success: true, ClientID: result.rows[0].ClientID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении клиента:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

clientsRouter.get('/:id', async (req, res) => {
  const clientId = Number(req.params.id);
  if (!clientId || isNaN(clientId)) {
    return res.status(400).json({ success: false, message: 'Некорректный ID клиента' });
  }

  try {
    const clientResult = await pool.query(
      'SELECT clientid, name, contact, address, notes FROM clients WHERE clientid = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Клиент не найден' });
    }

    const client = clientResult.rows[0];
    res.json({
      ClientID: client.clientid,
      Name: client.name,
      Contact: client.contact,
      Address: client.address,
      Notes: client.notes
    });
  } catch (err) {
    console.error('❌ Ошибка при получении клиента по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить клиента', details: err.message });
  }
});

clientsRouter.put('/:id', async (req, res) => {
  const clientId = Number(req.params.id);
  const { Name, Contact, Address, Notes } = req.body;

  if (!clientId || isNaN(clientId)) {
    return res.status(400).json({ success: false, message: 'Некорректный ID клиента' });
  }

  try {
    const query = `
      UPDATE clients 
      SET name = $1, contact = $2, address = $3, notes = $4
      WHERE clientid = $5
    `;

    await pool.query(query, [Name, Contact, Address, Notes, clientId]);
    res.json({ success: true, message: 'Клиент обновлен успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении клиента:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

clientsRouter.delete('/:id', async (req, res) => {
  const clientId = req.params.id;
  try {
    await pool.query('DELETE FROM clients WHERE ClientID = $1', [clientId]);
    res.json({ success: true, message: 'Клиент удален успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении клиента:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

clientsRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT ClientID, Name, Contact, Address, Notes
      FROM clients
      WHERE Name ILIKE $1 OR Contact ILIKE $1
      ORDER BY Name
    `, [`%${query}%`]);

    const clients = searchResult.rows.map(row => ({
      ClientID: row.ClientID,
      Name: row.Name,
      Contact: row.Contact,
      Address: row.Address,
      Notes: row.Notes
    }));

    res.json(clients);
  } catch (err) {
    console.error('❌ Ошибка при поиске клиентов:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

// ========== BUYERS ==========

buyersRouter.get('/', async (req, res) => {
  try {
    const buyersResult = await pool.query(`
      SELECT buyerid, name, contact, notes
      FROM buyers
      ORDER BY name
    `);

    const buyers = buyersResult.rows.map(row => ({
      BuyerID: row.buyerid,
      Name: row.name,
      Contact: row.contact,
      Notes: row.notes
    }));

    res.json(buyers);
  } catch (err) {
    console.error('❌ Ошибка при получении покупателей:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить покупателей', details: err.message });
  }
});

buyersRouter.post('/', async (req, res) => {
  const { Name, Contact, Notes } = req.body;

  if (!Name) {
    return res.status(400).json({ success: false, message: 'Имя покупателя обязательно' });
  }

  try {
    const query = `
      INSERT INTO buyers (Name, Contact, Notes)
      VALUES ($1, $2, $3)
      RETURNING BuyerID
    `;

    const result = await pool.query(query, [Name, Contact, Notes]);
    res.json({ success: true, BuyerID: result.rows[0].BuyerID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении покупателя:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

buyersRouter.get('/:id', async (req, res) => {
  const buyerId = Number(req.params.id);
  if (!buyerId || isNaN(buyerId)) {
    return res.status(400).json({ success: false, message: 'Некорректный ID покупателя' });
  }

  try {
    const buyerResult = await pool.query(
      'SELECT buyerid, name, contact, notes FROM buyers WHERE buyerid = $1',
      [buyerId]
    );

    if (buyerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Покупатель не найден' });
    }

    const buyer = buyerResult.rows[0];
    res.json({
      BuyerID: buyer.buyerid,
      Name: buyer.name,
      Contact: buyer.contact,
      Notes: buyer.notes
    });
  } catch (err) {
    console.error('❌ Ошибка при получении покупателя по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить покупателя', details: err.message });
  }
});

buyersRouter.put('/:id', async (req, res) => {
  const buyerId = req.params.id;
  const { Name, Contact, Notes } = req.body;

  try {
    const query = `
      UPDATE buyers 
      SET name = $1, contact = $2, notes = $3
      WHERE buyerID = $4
    `;

    await pool.query(query, [Name, Contact, Notes, buyerId]);
    res.json({ success: true, message: 'Покупатель обновлен успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении покупателя:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

buyersRouter.delete('/:id', async (req, res) => {
  const buyerId = req.params.id;
  try {
    await pool.query('DELETE FROM buyers WHERE BuyerID = $1', [buyerId]);
    res.json({ success: true, message: 'Покупатель удален успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении покупателя:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

buyersRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT BuyerID, Name, Contact, Notes
      FROM buyers
      WHERE Name ILIKE $1 OR Contact ILIKE $1
      ORDER BY Name
    `, [`%${query}%`]);

    const buyers = searchResult.rows.map(row => ({
      BuyerID: row.BuyerID,
      Name: row.Name,
      Contact: row.Contact,
      Notes: row.Notes
    }));

    res.json(buyers);
  } catch (err) {
    console.error('❌ Ошибка при поиске покупателей:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

// ========== SHIPMENTS ==========

shipmentsRouter.get('/', async (req, res) => {
  try {
    const shipmentsResult = await pool.query(`
      SELECT 
        s.ShipmentID, s.OrderID, s.ShipmentNumber, s.TrackingNumber,
        s.DepartureDate, s.ArrivalDate, s.ShipmentStatus, s.DeliveryCost,
        s.PaymentStatus, s.PaymentDate, s.Comments,
        po.OurOrderNumber as OrderNumber
      FROM shipments s
      LEFT JOIN PurchaseOrders po ON s.OrderID = po.OrderID
      ORDER BY s.DepartureDate DESC
    `);

    const shipments = shipmentsResult.rows.map(row => ({
      ShipmentID: row.ShipmentID,
      OrderID: row.OrderID,
      ShipmentNumber: row.ShipmentNumber,
      TrackingNumber: row.TrackingNumber,
      DepartureDate: row.DepartureDate,
      ArrivalDate: row.ArrivalDate,
      ShipmentStatus: row.ShipmentStatus,
      DeliveryCost: parseFloat(row.DeliveryCost) || null,
      PaymentStatus: row.PaymentStatus,
      PaymentDate: row.PaymentDate,
      Comments: row.Comments,
      OrderNumber: row.OrderNumber
    }));

    res.json(shipments);
  } catch (err) {
    console.error('❌ Ошибка при получении отгрузок:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить отгрузки', details: err.message });
  }
});

shipmentsRouter.post('/', async (req, res) => {
  const { OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments } = req.body;

  if (!OrderID) {
    return res.status(400).json({ success: false, message: 'ID заказа обязателен' });
  }

  try {
    const query = `
      INSERT INTO shipments (OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING ShipmentID
    `;

    const result = await pool.query(query, [OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments]);
    res.json({ success: true, ShipmentID: result.rows[0].ShipmentID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении отгрузки:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

shipmentsRouter.get('/:id', async (req, res) => {
  const shipmentId = req.params.id;
  try {
    const shipmentResult = await pool.query(
      'SELECT ShipmentID, OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments FROM shipments WHERE ShipmentID = $1',
      [shipmentId]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Отгрузка не найдена' });
    }

    const shipment = shipmentResult.rows[0];
    res.json({
      ShipmentID: shipment.ShipmentID,
      OrderID: shipment.OrderID,
      ShipmentNumber: shipment.ShipmentNumber,
      TrackingNumber: shipment.TrackingNumber,
      DepartureDate: shipment.DepartureDate,
      ArrivalDate: shipment.ArrivalDate,
      ShipmentStatus: shipment.ShipmentStatus,
      DeliveryCost: parseFloat(shipment.DeliveryCost) || null,
      PaymentStatus: shipment.PaymentStatus,
      PaymentDate: shipment.PaymentDate,
      Comments: shipment.Comments
    });
  } catch (err) {
    console.error('❌ Ошибка при получении отгрузки по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить отгрузку', details: err.message });
  }
});

shipmentsRouter.put('/:id', async (req, res) => {
  const shipmentId = req.params.id;
  const { OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments } = req.body;

  try {
    const query = `
      UPDATE shipments 
      SET OrderID = $1, ShipmentNumber = $2, TrackingNumber = $3, DepartureDate = $4, ArrivalDate = $5, ShipmentStatus = $6, DeliveryCost = $7, PaymentStatus = $8, PaymentDate = $9, Comments = $10
      WHERE ShipmentID = $11
    `;

    await pool.query(query, [OrderID, ShipmentNumber, TrackingNumber, DepartureDate, ArrivalDate, ShipmentStatus, DeliveryCost, PaymentStatus, PaymentDate, Comments, shipmentId]);
    res.json({ success: true, message: 'Отгрузка обновлена успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении отгрузки:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

shipmentsRouter.delete('/:id', async (req, res) => {
  const shipmentId = req.params.id;
  try {
    await pool.query('DELETE FROM shipments WHERE ShipmentID = $1', [shipmentId]);
    res.json({ success: true, message: 'Отгрузка удалена успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении отгрузки:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

shipmentsRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT 
        s.ShipmentID, s.OrderID, s.ShipmentNumber, s.TrackingNumber,
        s.DepartureDate, s.ArrivalDate, s.ShipmentStatus, s.DeliveryCost,
        s.PaymentStatus, s.PaymentDate, s.Comments,
        po.OurOrderNumber as OrderNumber
      FROM shipments s
      LEFT JOIN PurchaseOrders po ON s.OrderID = po.OrderID
      WHERE s.ShipmentNumber ILIKE $1 OR s.TrackingNumber ILIKE $1 OR po.OurOrderNumber ILIKE $1
      ORDER BY s.DepartureDate DESC
    `, [`%${query}%`]);

    const shipments = searchResult.rows.map(row => ({
      ShipmentID: row.ShipmentID,
      OrderID: row.OrderID,
      ShipmentNumber: row.ShipmentNumber,
      TrackingNumber: row.TrackingNumber,
      DepartureDate: row.DepartureDate,
      ArrivalDate: row.ArrivalDate,
      ShipmentStatus: row.ShipmentStatus,
      DeliveryCost: parseFloat(row.DeliveryCost) || null,
      PaymentStatus: row.PaymentStatus,
      PaymentDate: row.PaymentDate,
      Comments: row.Comments,
      OrderNumber: row.OrderNumber
    }));

    res.json(shipments);
  } catch (err) {
    console.error('❌ Ошибка при поиске отгрузок:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

// ========== DISTRIBUTION ==========

distributionRouter.get('/', async (req, res) => {
  try {
    const distributionResult = await pool.query(`
      SELECT 
        d.DistributionID, d.ShipmentID, d.ClientID, d.Address,
        d.ItemDescription, d.Quantity, d.DeliveryCost, d.PaymentStatus, d.Status,
        c.Name as ClientName, s.ShipmentNumber
      FROM distribution d
      LEFT JOIN Clients c ON d.ClientID = c.ClientID
      LEFT JOIN Shipments s ON d.ShipmentID = s.ShipmentID
      ORDER BY d.DistributionID DESC
    `);

    const distribution = distributionResult.rows.map(row => ({
      DistributionID: row.DistributionID,
      ShipmentID: row.ShipmentID,
      ClientID: row.ClientID,
      Address: row.Address,
      ItemDescription: row.ItemDescription,
      Quantity: row.Quantity,
      DeliveryCost: parseFloat(row.DeliveryCost) || null,
      PaymentStatus: row.PaymentStatus,
      Status: row.Status,
      ClientName: row.ClientName,
      ShipmentNumber: row.ShipmentNumber
    }));

    res.json(distribution);
  } catch (err) {
    console.error('❌ Ошибка при получении распределений:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить распределения', details: err.message });
  }
});

distributionRouter.post('/', async (req, res) => {
  const { ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status } = req.body;

  if (!ShipmentID || !ClientID || !Address) {
    return res.status(400).json({ success: false, message: 'Не все обязательные поля заполнены' });
  }

  try {
    const query = `
      INSERT INTO distribution (ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING DistributionID
    `;

    const result = await pool.query(query, [ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status]);
    res.json({ success: true, DistributionID: result.rows[0].DistributionID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении распределения:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

distributionRouter.get('/:id', async (req, res) => {
  const distributionId = req.params.id;
  try {
    const distributionResult = await pool.query(
      'SELECT DistributionID, ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status FROM distribution WHERE DistributionID = $1',
      [distributionId]
    );

    if (distributionResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Распределение не найдено' });
    }

    const distribution = distributionResult.rows[0];
    res.json({
      DistributionID: distribution.DistributionID,
      ShipmentID: distribution.ShipmentID,
      ClientID: distribution.ClientID,
      Address: distribution.Address,
      ItemDescription: distribution.ItemDescription,
      Quantity: distribution.Quantity,
      DeliveryCost: parseFloat(distribution.DeliveryCost) || null,
      PaymentStatus: distribution.PaymentStatus,
      Status: distribution.Status
    });
  } catch (err) {
    console.error('❌ Ошибка при получении распределения по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить распределение', details: err.message });
  }
});

distributionRouter.put('/:id', async (req, res) => {
  const distributionId = req.params.id;
  const { ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status } = req.body;

  try {
    const query = `
      UPDATE distribution 
      SET ShipmentID = $1, ClientID = $2, Address = $3, ItemDescription = $4, Quantity = $5, DeliveryCost = $6, PaymentStatus = $7, Status = $8
      WHERE DistributionID = $9
    `;

    await pool.query(query, [ShipmentID, ClientID, Address, ItemDescription, Quantity, DeliveryCost, PaymentStatus, Status, distributionId]);
    res.json({ success: true, message: 'Распределение обновлено успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении распределения:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

distributionRouter.delete('/:id', async (req, res) => {
  const distributionId = req.params.id;
  try {
    await pool.query('DELETE FROM distribution WHERE DistributionID = $1', [distributionId]);
    res.json({ success: true, message: 'Распределение удалено успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении распределения:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

distributionRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT 
        d.DistributionID, d.ShipmentID, d.ClientID, d.Address,
        d.ItemDescription, d.Quantity, d.DeliveryCost, d.PaymentStatus, d.Status,
        c.Name as ClientName, s.ShipmentNumber
      FROM distribution d
      LEFT JOIN Clients c ON d.ClientID = c.ClientID
      LEFT JOIN Shipments s ON d.ShipmentID = s.ShipmentID
      WHERE d.Address ILIKE $1 OR c.Name ILIKE $1 OR d.ItemDescription ILIKE $1
      ORDER BY d.DistributionID DESC
    `, [`%${query}%`]);

    const distribution = searchResult.rows.map(row => ({
      DistributionID: row.DistributionID,
      ShipmentID: row.ShipmentID,
      ClientID: row.ClientID,
      Address: row.Address,
      ItemDescription: row.ItemDescription,
      Quantity: row.Quantity,
      DeliveryCost: parseFloat(row.DeliveryCost) || null,
      PaymentStatus: row.PaymentStatus,
      Status: row.Status,
      ClientName: row.ClientName,
      ShipmentNumber: row.ShipmentNumber
    }));

    res.json(distribution);
  } catch (err) {
    console.error('❌ Ошибка при поиске распределений:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

// ========== PAYMENTS ==========

paymentsRouter.get('/', async (req, res) => {
  try {
    const paymentsResult = await pool.query(
      'SELECT PaymentID, RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes FROM payments ORDER BY PaymentDate DESC'
    );

    const payments = paymentsResult.rows.map(row => ({
      PaymentID: row.PaymentID,
      RelatedOrderID: row.RelatedOrderID,
      RelatedShipmentID: row.RelatedShipmentID,
      RelatedDistributionID: row.RelatedDistributionID,
      Amount: parseFloat(row.Amount),
      Currency: row.Currency,
      PaymentDate: row.PaymentDate,
      PaymentType: row.PaymentType,
      Direction: row.Direction,
      Notes: row.Notes
    }));

    res.json(payments);
  } catch (err) {
    console.error('❌ Ошибка при получении платежей:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить платежи', details: err.message });
  }
});

paymentsRouter.post('/', async (req, res) => {
  const { RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes } = req.body;

  if (!Amount || Amount <= 0) {
    return res.status(400).json({ success: false, message: 'Сумма платежа обязательна и должна быть положительной' });
  }

  try {
    const query = `
      INSERT INTO payments (RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING PaymentID
    `;

    const result = await pool.query(query, [RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes]);
    res.json({ success: true, PaymentID: result.rows[0].PaymentID });
  } catch (err) {
    console.error('❌ Ошибка при добавлении платежа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

paymentsRouter.get('/:id', async (req, res) => {
  const paymentId = req.params.id;
  try {
    const paymentResult = await pool.query(
      'SELECT PaymentID, RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes FROM payments WHERE PaymentID = $1',
      [paymentId]
    );

    if (paymentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Платеж не найден' });
    }

    const payment = paymentResult.rows[0];
    res.json({
      PaymentID: payment.PaymentID,
      RelatedOrderID: payment.RelatedOrderID,
      RelatedShipmentID: payment.RelatedShipmentID,
      RelatedDistributionID: payment.RelatedDistributionID,
      Amount: parseFloat(payment.Amount),
      Currency: payment.Currency,
      PaymentDate: payment.PaymentDate,
      PaymentType: payment.PaymentType,
      Direction: payment.Direction,
      Notes: payment.Notes
    });
  } catch (err) {
    console.error('❌ Ошибка при получении платежа по ID:', err);
    res.status(500).json({ success: false, message: 'Не удалось загрузить платеж', details: err.message });
  }
});

paymentsRouter.put('/:id', async (req, res) => {
  const paymentId = req.params.id;
  const { RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes } = req.body;

  try {
    const query = `
      UPDATE payments 
      SET RelatedOrderID = $1, RelatedShipmentID = $2, RelatedDistributionID = $3, Amount = $4, Currency = $5, PaymentDate = $6, PaymentType = $7, Direction = $8, Notes = $9
      WHERE PaymentID = $10
    `;

    await pool.query(query, [RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes, paymentId]);
    res.json({ success: true, message: 'Платеж обновлен успешно' });
  } catch (err) {
    console.error('❌ Ошибка при обновлении платежа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

paymentsRouter.delete('/:id', async (req, res) => {
  const paymentId = req.params.id;
  try {
    await pool.query('DELETE FROM payments WHERE PaymentID = $1', [paymentId]);
    res.json({ success: true, message: 'Платеж удален успешно' });
  } catch (err) {
    console.error('❌ Ошибка при удалении платежа:', err);
    res.status(500).json({ success: false, message: 'Ошибка базы данных', details: err.message });
  }
});

paymentsRouter.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  try {
    const searchResult = await pool.query(`
      SELECT PaymentID, RelatedOrderID, RelatedShipmentID, RelatedDistributionID, Amount, Currency, PaymentDate, PaymentType, Direction, Notes
      FROM Payments
      WHERE Amount::text ILIKE $1 OR Notes ILIKE $1 OR PaymentType ILIKE $1
      ORDER BY PaymentDate DESC
    `, [`%${query}%`]);

    const payments = searchResult.rows.map(row => ({
      PaymentID: row.PaymentID,
      RelatedOrderID: row.RelatedOrderID,
      RelatedShipmentID: row.RelatedShipmentID,
      RelatedDistributionID: row.RelatedDistributionID,
      Amount: parseFloat(row.Amount),
      Currency: row.Currency,
      PaymentDate: row.PaymentDate,
      PaymentType: row.PaymentType,
      Direction: row.Direction,
      Notes: row.Notes
    }));

    res.json(payments);
  } catch (err) {
    console.error('❌ Ошибка при поиске платежей:', err);
    res.status(500).json({ success: false, message: 'Не удалось выполнить поиск', details: err.message });
  }
});

module.exports = {
  purchaseOrders: purchaseOrdersRouter,
  clients: clientsRouter,
  buyers: buyersRouter,
  shipments: shipmentsRouter,
  distribution: distributionRouter,
  payments: paymentsRouter
};
