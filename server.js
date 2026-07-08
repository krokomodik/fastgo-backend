require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const pool = require('./db');
const crypto = require('crypto');
const cron = require('node-cron');
const { Expo } = require('expo-server-sdk');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const expo = new Expo();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ================== PUSH-УВЕДОМЛЕНИЯ ==================
async function sendPushNotifications(messages) {
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log('Результаты push:', JSON.stringify(tickets));
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'error') {
          console.error('Ошибка push для токена', chunk[i].to, ':', ticket.message);
        }
      }
    } catch (err) {
      console.error('Ошибка отправки push:', err);
    }
  }
}

async function getUserPushTokens(userId) {
  const res = await pool.query('SELECT token FROM push_tokens WHERE user_id = $1', [userId]);
  return res.rows.map(r => r.token);
}

// Главная страница для банка
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Докуда — доставка еды и посылок</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #FF5722; }
        h2 { color: #333; margin-top: 30px; }
        p, li { font-size: 15px; line-height: 1.6; }
        .contacts { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .payment-logos { display: flex; gap: 15px; align-items: center; margin: 15px 0; }
        .footer { margin-top: 40px; font-size: 12px; color: #888; border-top: 1px solid #ddd; padding-top: 15px; }
      </style>
    </head>
    <body>
      <h1>🚀 Докуда</h1>
      <p><strong>Сервис доставки еды и посылок</strong></p>
      <div class="contacts">
        <h3>Информация о компании</h3>
        <p><strong>ИП Озерская Светлана Александровна</strong></p>
        <p>ИНН: 781106475905 | ОГРНИП: 325470400061712</p>
        <p>📍 Адрес: 188330, Россия, Ленинградская обл., Гатчинский м.о., гп. Сиверский, ул. Лесная, д. 3</p>
        <p>📞 Телефон: +7 921 434-27-66</p>
        <p>📧 Email: <a href="mailto:tkto1537@gmail.com">tkto1537@gmail.com</a></p>
        <p>Страна регистрации: Российская Федерация</p>
      </div>
      <h2>Наши услуги</h2>
      <p><strong>Доставка еды</strong> — от 200 ₽. Среднее время доставки: 30–60 минут.</p>
      <p><strong>Доставка посылок</strong> — от 300 ₽. Стоимость рассчитывается автоматически в приложении.</p>
      <p>Точная цена зависит от расстояния и отображается до подтверждения заказа.</p>
      <h2>Процесс оплаты</h2>
      <ol>
        <li>Оформите заказ в мобильном приложении «Докуда».</li>
        <li>Выберите способ оплаты картой.</li>
        <li>Введите данные карты на защищённой странице банка.</li>
        <li>Подтвердите оплату через SMS-код (3D-Secure).</li>
        <li>Получите уведомление о статусе заказа в приложении.</li>
      </ol>
      <h2>Сроки и способы доставки</h2>
      <p>После оплаты заказа курьер назначается в течение 5–15 минут.</p>
      <p>Доставка осуществляется в день заказа в согласованное время.</p>
      <p>При задержке более 30 минут мы связываемся с клиентом и предлагаем компенсацию.</p>
      <h2>Принимаем к оплате</h2>
      <div class="payment-logos">
        <span>💳 МИР</span>
        <span>💳 Visa</span>
        <span>💳 Mastercard</span>
      </div>
      <p>Логотипы используются на правах официального партнёра платёжных систем.</p>
      <h2>Безопасность платежей</h2>
      <p>Все платежи проходят через защищённое соединение (HTTPS, SSL).</p>
      <p>Мы сотрудничаем с Озон Банком для предотвращения мошеннических операций.</p>
      <p>Данные карт не хранятся на наших серверах — они передаются напрямую в банк в зашифрованном виде.</p>
      <h2>Защита данных</h2>
      <p>Всё соединение с сайтом и приложением защищено протоколом HTTPS (SSL-сертификат).</p>
      <p>Личный кабинет пользователя защищён паролем и токеном доступа.</p>
      <div class="footer">
        <p>© 2026 Докуда. Все права защищены.</p>
        <p>ИП Озерская С.А. | ИНН 781106475905 | ОГРНИП 325470400061712</p>
      </div>
    </body>
    </html>`);
});

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 3000;

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Нет токена' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Неверный токен' });
  }
}

// Валидация ИНН
function validateInn(inn) {
  if (!/^\d{12}$/.test(inn)) return false;
  const coefficients1 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const coefficients2 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const digits = inn.split('').map(Number);
  const n11 = digits.slice(0, 10).reduce((sum, d, i) => sum + d * coefficients1[i], 0) % 11 % 10;
  const n12 = digits.slice(0, 11).reduce((sum, d, i) => sum + d * coefficients2[i], 0) % 11 % 10;
  return n11 === digits[10] && n12 === digits[11];
}

// Регистрация
app.post('/api/register', async (req, res) => {
  const {
    name, phone, email, password, address, role,
    passport_series, passport_number, passport_issued_by, passport_issued_date,
    inn, transport,
    accepted_policy, accepted_agreement,
    photo_passport, photo_face, region_id
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const appStatus = role === 'courier' ? 'pending' : 'approved';
    const result = await pool.query(
      `INSERT INTO users
       (name, phone, email, password, address, role,
        passport_series, passport_number, passport_issued_by, passport_issued_date,
        inn, transport,
        application_status, accepted_policy, accepted_agreement, agreed_at,
        photo_passport, photo_face, region_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING id, name, email, role, application_status`,
      [
        name, phone, email, hashedPassword, address, role || 'client',
        passport_series, passport_number, passport_issued_by, passport_issued_date,
        inn, transport,
        appStatus,
        accepted_policy || false,
        accepted_agreement || false,
        (accepted_policy || accepted_agreement) ? new Date().toISOString() : null,
        photo_passport || null,
        photo_face || null,
        region_id || null
      ]
    );

    const user = result.rows[0];

    if (role === 'courier' && appStatus === 'pending') {
      const admins = await pool.query("SELECT id FROM users WHERE role = 'admin'");
      for (const admin of admins.rows) {
        const tokens = await getUserPushTokens(admin.id);
        if (tokens.length) {
          await sendPushNotifications(tokens.map(token => ({
            to: token,
            sound: 'default',
            title: 'Новая заявка курьера',
            body: `${name} хочет стать курьером`,
            data: { courierId: user.id },
          })));
        }
      }
    }

    if (role === 'courier') {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '365d' }
      );
      return res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          application_status: user.application_status
        }
      });
    }

    res.json({ user });
  } catch (err) {
    console.error('Ошибка регистрации:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Логин (с проверкой блокировки)
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (user.rows.length === 0) return res.status(400).json({ error: 'Пользователь не найден' });
    const u = user.rows[0];
    const valid = await bcrypt.compare(password, u.password);
    if (!valid) return res.status(400).json({ error: 'Неверный пароль' });

    if (u.is_blocked) {
      return res.status(403).json({ error: 'Аккаунт заблокирован', reason: u.block_reason || 'Причина не указана' });
    }

    const token = jwt.sign(
      { id: u.id, email: u.email, role: u.role },
      JWT_SECRET,
      { expiresIn: '365d' }
    );
    res.json({ token, user: { 
      id: u.id, 
      name: u.name, 
      role: u.role,
      application_status: u.application_status || 'approved'
    }});
  } catch (err) {
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

// Сохранение push-токена
app.post('/api/push-token', authenticate, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token обязателен' });
  try {
    await pool.query(
      'INSERT INTO push_tokens (user_id, token) VALUES ($1, $2) ON CONFLICT (token) DO NOTHING',
      [req.user.id, token]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка сохранения push-токена:', e);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание заказа (клиент) – обновлённый для shop/parcel/pvz
app.post('/api/order/create', authenticate, async (req, res) => {
  const {
    type,
    category,
    items,
    max_product_amount,
    delivery_address,
    message_for_courier,
    pickup_address,
    description,
    price,
    delivery_price,
    payment_method,
    pvz_code_image, // base64 для ПВЗ
    pvz_address
  } = req.body;

  if (req.user.role !== 'client') return res.status(403).json({ error: 'Только клиенты могут создавать заказы' });

  try {
    const confirmationCode = Math.floor(1000 + Math.random() * 9000).toString();
    const orderType = type || 'parcel';
    const client = req.user.id;

    const insertResult = await pool.query(
      `INSERT INTO orders
       (client_id, type, category, pickup_address, delivery_address, description, price, status, confirmation_code,
        max_product_amount, message_for_courier, pvz_code_image, pvz_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'new',$8,$9,$10,$11,$12)
       RETURNING *`,
      [client, orderType, category || null, pickup_address || null, delivery_address,
       description || null, price || 500, confirmationCode,
       max_product_amount || null, message_for_courier || null,
       pvz_code_image || null, pvz_address || null]
    );
    const newOrder = insertResult.rows[0];

    if (orderType === 'shop' && items && items.length) {
      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        await pool.query(
          'INSERT INTO order_items (order_id, name, note, sort_order) VALUES ($1,$2,$3,$4)',
          [newOrder.id, it.name, it.note || '', idx]
        );
      }
    }

    io.emit('new_order', newOrder);
    res.json(newOrder);
  } catch (err) {
    console.error('Ошибка создания заказа:', err);
    res.status(500).json({ error: 'Ошибка создания заказа' });
  }
});

// Получить все заказы (фильтр для курьера: история не исчезает, для клиента – рейтинг курьера и отзыв)
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    } else if (req.user.role === 'client') {
      orders = await pool.query(
        `SELECT o.*,
                u.name AS courier_name,
                u.photo_face AS courier_photo,
                COALESCE(
                  (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE courier_id = o.courier_id),
                  0
                ) AS courier_rating,
                (SELECT COUNT(*) FROM reviews WHERE order_id = o.id AND user_id = o.client_id) > 0 AS has_review
         FROM orders o
         LEFT JOIN users u ON u.id = o.courier_id
         WHERE o.client_id = $1
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );
    } else if (req.user.role === 'courier') {
      orders = await pool.query(
        `SELECT o.*, 
           (SELECT json_agg(json_build_object('name', oi.name, 'note', oi.note) ORDER BY oi.sort_order)
            FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o
         WHERE (o.courier_id=$1 OR o.status='paid')
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );
    }
    res.json(orders.rows);
  } catch (err) {
    console.error('Ошибка получения заказов:', err);
    res.status(500).json({ error: 'Ошибка получения заказов' });
  }
});

// Курьер принимает заказ
app.post('/api/order/accept', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Только курьеры' });
  const { order_id } = req.body;
  try {
    const order = await pool.query(
      `UPDATE orders SET courier_id=$1, status=$2 WHERE id=$3 AND (status='new' OR status='paid') RETURNING *`,
      [req.user.id, 'accepted', order_id]
    );
    if (order.rows.length === 0) return res.status(400).json({ error: 'Заказ уже принят' });
    
    const updatedOrder = order.rows[0];
    io.to(`user_${updatedOrder.client_id}`).emit('order_accepted', updatedOrder);
    
    const tokens = await getUserPushTokens(updatedOrder.client_id);
    if (tokens.length) {
      await sendPushNotifications(tokens.map(token => ({
        to: token,
        sound: 'default',
        title: 'Статус заказа',
        body: 'Курьер принял ваш заказ',
        data: { orderId: order_id },
      })));
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error('Ошибка принятия заказа:', err);
    res.status(500).json({ error: 'Ошибка принятия заказа' });
  }
});

// Завершить заказ (с возвратом разницы)
app.post('/api/order/finish', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Только курьеры' });
  const { order_id, confirmation_code, actual_amount, receipt_photo } = req.body;

  if (!order_id) return res.status(400).json({ error: 'order_id обязателен' });

  try {
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND courier_id = $2 AND status = $3',
      [order_id, req.user.id, 'accepted']
    );
    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Заказ не найден или не в статусе accepted' });
    }

    const order = orderResult.rows[0];

    if (order.confirmation_code) {
      if (!confirmation_code || confirmation_code !== order.confirmation_code) {
        return res.status(400).json({ error: 'Неверный код подтверждения' });
      }
    }

    if (order.type === 'shop' && actual_amount !== undefined && actual_amount !== null) {
      await pool.query('UPDATE orders SET actual_amount = $1 WHERE id = $2', [actual_amount, order_id]);
    }

    await pool.query("UPDATE orders SET status = 'delivered', finished_at = NOW() WHERE id = $1", [order_id]);

    io.to(`user_${order.client_id}`).emit('order_delivered', { id: order_id });
    
    const tokens = await getUserPushTokens(order.client_id);
    if (tokens.length) {
      await sendPushNotifications(tokens.map(token => ({
        to: token,
        sound: 'default',
        title: 'Статус заказа',
        body: 'Заказ доставлен',
        data: { orderId: order_id },
      })));
    }

    // Возврат разницы для продуктового заказа
    if (order.type === 'shop' && actual_amount && order.max_product_amount) {
      const diff = order.max_product_amount - parseFloat(actual_amount);
      if (diff > 0 && order.ozon_payment_id) {
        try {
          const accessKey = process.env.OZON_CLIENT_ID;
          const secretKey = process.env.OZON_SECRET_KEY;
          const refundAmount = Math.round(diff * 100).toString();
          const currencyCode = '643';
          const refundExtId = `refund-${order_id}-${Date.now()}`;

          const signRaw = `${refundExtId}${order.ozon_payment_id}${accessKey}${secretKey}`;
          const requestSign = crypto.createHash('sha256').update(signRaw).digest('hex');

          const refundPayload = {
            accessKey,
            paymentId: order.ozon_payment_id,
            extId: refundExtId,
            amount: { currencyCode, value: refundAmount },
            requestSign
          };

          console.log('Запрос возврата:', JSON.stringify(refundPayload));

          const response = await fetch('https://payapi.ozon.ru/v1/refundPayment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(refundPayload)
          });

          if (response.ok) {
            await pool.query('UPDATE orders SET refunded = true WHERE id = $1', [order_id]);
            console.log(`Возврат ${diff}₽ по заказу ${order_id}`);
          } else {
            const errorText = await response.text();
            console.error('Ошибка возврата:', errorText);
          }
        } catch (e) {
          console.error('Ошибка вызова API возврата:', e);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка завершения заказа:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Геолокация курьера
app.post('/api/courier/location', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Только курьеры' });
  const { lat, lng } = req.body;
  try {
    await pool.query('UPDATE couriers SET lat=$1, lng=$2 WHERE user_id=$3', [lat, lng, req.user.id]);
    io.emit('courier_location', { courier_id: req.user.id, lat, lng });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления локации:', err);
    res.status(500).json({ error: 'Ошибка обновления' });
  }
});

// Статус курьера online/offline
app.post('/api/courier/status', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Только курьеры' });
  const { is_online } = req.body;
  try {
    const existing = await pool.query('SELECT id FROM couriers WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO couriers (user_id, is_online, lat, lng) VALUES ($1, $2, 59.9343, 30.3351)', [req.user.id, is_online]);
    } else {
      await pool.query('UPDATE couriers SET is_online = $1 WHERE user_id = $2', [is_online, req.user.id]);
    }
    res.json({ is_online });
  } catch (err) {
    console.error('Ошибка статуса курьера:', err);
    res.status(500).json({ error: 'Ошибка статуса' });
  }
});

// Профиль текущего пользователя (добавлен регион)
app.get('/api/profile', authenticate, async (req, res) => {
  try {
    let user;
    if (req.user.role === 'courier') {
      user = await pool.query(
        `SELECT u.id, u.name, u.phone, u.email, u.address, u.role,
                u.application_status, u.region_id, r.name as region_name,
                c.lat, c.lng, c.transport, c.is_online
         FROM users u
         LEFT JOIN couriers c ON c.user_id = u.id
         LEFT JOIN regions r ON u.region_id = r.id
         WHERE u.id = $1`,
        [req.user.id]
      );
    } else {
      user = await pool.query(
        `SELECT u.id, u.name, u.phone, u.email, u.address, u.role, u.application_status,
                u.region_id, r.name as region_name
         FROM users u
         LEFT JOIN regions r ON u.region_id = r.id
         WHERE u.id=$1`,
        [req.user.id]
      );
    }
    if (user.rows.length === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    const profile = user.rows[0];
    profile.application_status = profile.application_status || 'approved';
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// Обновление профиля (добавлен region_id)
app.put('/api/profile', authenticate, async (req, res) => {
  const { name, address, transport, region_id } = req.body;
  try {
    await pool.query(
      'UPDATE users SET name = COALESCE($1, name), address = COALESCE($2, address), region_id = COALESCE($3, region_id) WHERE id = $4',
      [name, address, region_id, req.user.id]
    );
    if (req.user.role === 'courier' && transport !== undefined) {
      await pool.query('UPDATE couriers SET transport = $1 WHERE user_id = $2', [transport, req.user.id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка обновления профиля:', err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Список онлайн-курьеров
app.get('/api/couriers/online', authenticate, async (req, res) => {
  try {
    const couriers = await pool.query(
      `SELECT u.id, u.name, c.lat, c.lng, c.transport
       FROM couriers c
       JOIN users u ON u.id = c.user_id
       WHERE c.is_online = true AND c.lat IS NOT NULL AND c.lng IS NOT NULL`
    );
    res.json(couriers.rows);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка получения курьеров' });
  }
});

// Баланс курьера (с возмещением расходов)
app.get('/api/courier/balance', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Только курьеры' });
  try {
    const earnings = await pool.query(
      `SELECT o.price, o.actual_amount, o.max_product_amount, o.type
       FROM orders o
       WHERE o.courier_id = $1 AND o.status = 'delivered'`,
      [req.user.id]
    );

    let totalEarned = 0;
    for (const order of earnings.rows) {
      if (order.type === 'shop' && order.actual_amount) {
        const deliveryPrice = order.price - order.max_product_amount;
        totalEarned += parseFloat(order.actual_amount) + 0.9 * deliveryPrice;
      } else {
        totalEarned += 0.9 * (order.price || 0);
      }
    }

    const paid = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payouts WHERE courier_id = $1 AND status = 'completed'",
      [req.user.id]
    );

    const balance = totalEarned - parseFloat(paid.rows[0].total);

    const deliveredCount = await pool.query(
      "SELECT COUNT(*) as count FROM orders WHERE courier_id = $1 AND status = 'delivered'",
      [req.user.id]
    );

    res.json({
      balance: Math.round(balance * 100) / 100,
      total_earned: Math.round(totalEarned * 100) / 100,
      total_paid: Math.round(paid.rows[0].total * 100) / 100,
      delivered: parseInt(deliveredCount.rows[0].count)
    });
  } catch (err) {
    console.error('Ошибка получения баланса:', err);
    res.status(500).json({ error: 'Ошибка баланса' });
  }
});

// Сообщения заказа
app.get('/api/orders/:id/messages', authenticate, async (req, res) => {
  const orderId = req.params.id;
  try {
    const msgs = await pool.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.order_id = $1
       ORDER BY m.created_at ASC`,
      [orderId]
    );
    res.json(msgs.rows);
  } catch (err) {
    console.error('Ошибка загрузки сообщений:', err);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// Сообщения поддержки (персональные)
app.get('/api/orders/0/messages', authenticate, async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Пользователь не определён' });
  }
  try {
    const msgs = await pool.query(
      `SELECT m.id, m.order_id, m.sender_id, m.recipient_id, m.text, m.image,
              m.created_at as time, u.name as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.order_id = 0 AND (m.sender_id = $1 OR m.recipient_id = $1)
       ORDER BY m.created_at ASC`,
      [req.user.id]
    );
    res.json(msgs.rows);
  } catch (err) {
    console.error('Ошибка загрузки сообщений поддержки:', err);
    res.status(500).json({ error: 'Ошибка загрузки сообщений' });
  }
});

// ================== ПОДСКАЗКИ DADATA (с учётом региона) ==================
const fetch = require('node-fetch');
const DADATA_KEY = '8ec245ded8a5eb0c76913ecebbe0699c56545de5';

app.get('/api/suggest', authenticate, async (req, res) => {
  const { text, region } = req.query;
  if (!text || text.length < 2) return res.json({ results: [] });
  try {
    const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
    const body = { query: text, count: 5, language: 'ru' };
    if (region) {
      body.locations = [{ region }];
    }
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_KEY}`
      },
      body: JSON.stringify(body)
    };
    const resp = await fetch(url, options);
    const data = await resp.json();
    const suggestions = (data.suggestions || []).map(s => ({
      title: { text: s.value },
      subtitle: { text: s.data?.region || '' }
    }));
    res.json({ results: suggestions });
  } catch (e) {
    console.error('Ошибка подсказок DaData:', e);
    res.status(500).json({ error: 'Ошибка подсказок' });
  }
});

// ================== РАСЧЁТ ЦЕНЫ (посылка) – динамические тарифы ==================
app.post('/api/calculate-price', authenticate, async (req, res) => {
  const { pickup_address, delivery_address } = req.body;
  if (!pickup_address || !delivery_address) return res.status(400).json({ error: 'Нужны оба адреса' });
  try {
    const basePriceRes = await pool.query("SELECT value FROM settings WHERE key='base_price'");
    const pricePerKmRes = await pool.query("SELECT value FROM settings WHERE key='price_per_km'");
    const basePrice = parseFloat(basePriceRes.rows[0]?.value || '100');
    const pricePerKm = parseFloat(pricePerKmRes.rows[0]?.value || '20');

    const geocode = async (address) => {
      const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${DADATA_KEY}`
        },
        body: JSON.stringify({ query: address, count: 1 })
      };
      const resp = await fetch(url, options);
      const data = await resp.json();
      const first = data.suggestions?.[0];
      if (first && first.data?.geo_lat && first.data?.geo_lon) {
        return { lat: parseFloat(first.data.geo_lat), lng: parseFloat(first.data.geo_lon) };
      }
      return null;
    };
    const [pickup, delivery] = await Promise.all([geocode(pickup_address), geocode(delivery_address)]);
    if (!pickup || !delivery) return res.json({ price: basePrice * 5, distance: '0.0', fixed: true });
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickup.lng},${pickup.lat};${delivery.lng},${delivery.lat}?overview=false`;
    const routeResp = await fetch(osrmUrl);
    const routeData = await routeResp.json();
    if (!routeData.routes || routeData.routes.length === 0) return res.json({ price: basePrice * 5, distance: '0.0', fixed: true });
    const distanceKm = routeData.routes[0].distance / 1000;
    const price = Math.round(basePrice + distanceKm * pricePerKm);
    res.json({ price, distance: distanceKm.toFixed(1) });
  } catch (e) {
    console.error('Ошибка расчёта цены:', e);
    res.json({ price: 500, distance: '0.0', fixed: true });
  }
});

// ================== РАСЧЁТ ДОСТАВКИ ДЛЯ ПРОДУКТОВ – динамические тарифы ==================
app.post('/api/calculate-delivery', authenticate, async (req, res) => {
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: 'Адрес не указан' });
  try {
    const baseRes = await pool.query("SELECT value FROM settings WHERE key='shop_base_price'");
    const perKmRes = await pool.query("SELECT value FROM settings WHERE key='shop_price_per_km'");
    const basePrice = parseFloat(baseRes.rows[0]?.value || '200');
    const pricePerKm = parseFloat(perKmRes.rows[0]?.value || '15');

    const geoUrl = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
    const resp = await fetch(geoUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Token ${DADATA_KEY}` },
      body: JSON.stringify({ query: address, count: 1 })
    });
    const data = await resp.json();
    const first = data.suggestions?.[0];
    if (first && first.data?.geo_lat && first.data?.geo_lon) {
      const { geo_lat, geo_lon } = first.data;
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/30.3351,59.9343;${geo_lon},${geo_lat}?overview=false`;
      const routeResp = await fetch(osrmUrl);
      const routeData = await routeResp.json();
      if (routeData.routes?.length) {
        const distanceKm = routeData.routes[0].distance / 1000;
        const price = Math.round(basePrice + distanceKm * pricePerKm);
        return res.json({ price });
      }
    }
    res.json({ price: basePrice });
  } catch (e) {
    console.error('Ошибка расчёта доставки:', e);
    res.json({ price: 250 });
  }
});

// ================== РАСЧЁТ ДОСТАВКИ ДЛЯ ПВЗ (новый) ==================
app.post('/api/calculate-pvz', authenticate, async (req, res) => {
  const { pvz_address, delivery_address } = req.body;
  if (!pvz_address || !delivery_address) return res.status(400).json({ error: 'Нужны оба адреса' });
  try {
    const baseRes = await pool.query("SELECT value FROM settings WHERE key='pvz_base_price'");
    const perKmRes = await pool.query("SELECT value FROM settings WHERE key='pvz_price_per_km'");
    const basePrice = parseFloat(baseRes.rows[0]?.value || '150');
    const pricePerKm = parseFloat(perKmRes.rows[0]?.value || '15');

    const geocode = async (address) => {
      const url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Token ${DADATA_KEY}`
        },
        body: JSON.stringify({ query: address, count: 1 })
      };
      const resp = await fetch(url, options);
      const data = await resp.json();
      const first = data.suggestions?.[0];
      if (first && first.data?.geo_lat && first.data?.geo_lon) {
        return { lat: parseFloat(first.data.geo_lat), lng: parseFloat(first.data.geo_lon) };
      }
      return null;
    };
    const [pvz, delivery] = await Promise.all([geocode(pvz_address), geocode(delivery_address)]);
    if (!pvz || !delivery) return res.json({ price: basePrice * 3, distance: '0.0', fixed: true });
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pvz.lng},${pvz.lat};${delivery.lng},${delivery.lat}?overview=false`;
    const routeResp = await fetch(osrmUrl);
    const routeData = await routeResp.json();
    if (!routeData.routes || routeData.routes.length === 0) return res.json({ price: basePrice * 3, distance: '0.0', fixed: true });
    const distanceKm = routeData.routes[0].distance / 1000;
    const price = Math.round(basePrice + distanceKm * pricePerKm);
    res.json({ price, distance: distanceKm.toFixed(1) });
  } catch (e) {
    console.error('Ошибка расчёта ПВЗ:', e);
    res.json({ price: 300, distance: '0.0', fixed: true });
  }
});

// ================== ЭКВАЙРИНГ ОЗОН БАНК ==================
function signRequest(values) {
  const fingerprint = values.join('');
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
}

app.post('/api/payment/create', authenticate, async (req, res) => {
  const { orderId, paymentMethod } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Не указан orderId' });

  try {
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
    const order = orderResult.rows[0];

    const accessKey = process.env.OZON_CLIENT_ID;
    const secretKey = process.env.OZON_SECRET_KEY;
    const extId = `dokuda-order-${order.id}-${Date.now()}`;
    const amountValue = Math.round(order.price * 100).toString();

    const requestSign = signRequest([extId, accessKey, secretKey]);

    const payload = {
      accessKey,
      extId,
      amount: { currencyCode: '643', value: amountValue },
      payType: paymentMethod || 'SBP',
      redirectUrl: 'https://fastgo-krokomod.amvera.io/api/payment/return',
      notificationUrl: 'https://fastgo-krokomod.amvera.io/api/payment/ozon-webhook',
      requestSign
    };

    const response = await fetch('https://payapi.ozon.ru/v1/createPayment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Ошибка создания платежа:', errorText);
      return res.status(500).json({ error: 'Не удалось создать платёж' });
    }

    const payment = await response.json();
    console.log('Ответ банка:', JSON.stringify(payment));

    const payLink =
      payment?.paymentDetails?.sbp?.payload ||
      payment?.paymentDetails?.bankCard?.paymentUrl ||
      payment?.order?.item?.payLink ||
      payment?.paymentDetails?.paymentUrl;

    if (!payLink) {
      console.error('Не удалось найти ссылку в ответе:', JSON.stringify(payment));
      return res.status(500).json({ error: 'Ссылка на оплату не получена' });
    }

    await pool.query('UPDATE orders SET payment_id = $1 WHERE id = $2', [extId, order.id]);

    const ozonPaymentId = payment?.paymentDetails?.paymentId;
    if (ozonPaymentId) {
      await pool.query('UPDATE orders SET ozon_payment_id = $1 WHERE id = $2', [ozonPaymentId, order.id]);
    }

    res.json({ paymentUrl: payLink });
  } catch (e) {
    console.error('Ошибка платежа:', e);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Webhook
app.post('/api/payment/ozon-webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Получена нотификация:', JSON.stringify(event));

    const { extTransactionID, amount, currencyCode, status, requestSign: incomingSign } = event;
    const accessKey = process.env.OZON_CLIENT_ID;
    const notificationSecret = process.env.OZON_NOTIFICATION_SECRET;

    const expectedSign = signRequest([
      accessKey, '|||',
      extTransactionID || '', '|',
      amount || '', '|',
      currencyCode || '', '|',
      notificationSecret
    ]);

    if (incomingSign !== expectedSign) {
      console.error('Неверная подпись нотификации');
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      await pool.query(
        'INSERT INTO payment_logs (payment_id, ext_transaction_id, status, amount) VALUES ($1, $2, $3, $4)',
        [event.paymentId || '', extTransactionID || '', status || '', amount || 0]
      );
    } catch (logErr) {
      console.error('Ошибка записи лога платежа:', logErr);
    }

    if (status === 'Completed' && extTransactionID) {
      const orderResult = await pool.query('SELECT * FROM orders WHERE payment_id = $1', [extTransactionID]);
      if (orderResult.rows.length === 0) {
        console.warn('Заказ с payment_id', extTransactionID, 'не найден');
        return res.json({ received: true });
      }
      const order = orderResult.rows[0];
      if (order.status === 'paid' || order.status === 'accepted' || order.status === 'delivered') {
        console.log('Заказ уже оплачен/принят/доставлен, пропускаем');
        return res.json({ received: true });
      }
      await pool.query("UPDATE orders SET status = 'paid' WHERE payment_id = $1", [extTransactionID]);
      console.log(`Заказ с payment_id=${extTransactionID} оплачен`);

      // Push клиенту
      const clientTokens = await getUserPushTokens(order.client_id);
      if (clientTokens.length) {
        await sendPushNotifications(clientTokens.map(token => ({
          to: token,
          sound: 'default',
          title: 'Заказ оплачен',
          body: 'Ищем курьера...',
          data: { orderId: order.id },
        })));
      }

      // Push всем онлайн-курьерам
      const onlineCouriers = await pool.query(
        `SELECT u.id FROM users u JOIN couriers c ON c.user_id = u.id WHERE c.is_online = true`
      );
      for (const courier of onlineCouriers.rows) {
        const tokens = await getUserPushTokens(courier.id);
        if (tokens.length) {
          await sendPushNotifications(tokens.map(token => ({
            to: token,
            sound: 'default',
            title: 'Новый заказ',
            body: `Новый заказ на сумму ${order.price}₽`,
            data: { orderId: order.id },
          })));
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (e) {
    console.error('Ошибка обработки нотификации:', e);
    res.status(500).json({ error: 'Внутренняя ошибка' });
  }
});

// ================== АДМИН‑ЭНДПОИНТЫ ==================
app.get('/api/admin/users', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { search } = req.query;
  try {
    let query = `SELECT id, name, phone, email, address, role, is_blocked, block_reason FROM users WHERE role = 'client'`;
    const params = [];
    if (search) {
      query += ` AND (name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1 OR CAST(id AS TEXT) = $2)`;
      params.push(`%${search}%`, search);
    }
    query += ` ORDER BY id DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения пользователей:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/couriers', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { search } = req.query;
  try {
    let query = `
      SELECT u.id, u.name, u.phone, u.email, u.address,
             u.passport_series, u.passport_number, u.passport_issued_by, u.passport_issued_date,
             u.inn, u.transport, u.is_blocked, u.block_reason,
             c.full_name, c.transport as courier_transport, c.is_online, c.lat, c.lng,
             u.photo_passport, u.photo_face
      FROM users u
      LEFT JOIN couriers c ON c.user_id = u.id
      WHERE u.role = 'courier'
    `;
    const params = [];
    if (search) {
      query += ` AND (u.name ILIKE $1 OR u.phone ILIKE $1 OR u.email ILIKE $1 OR CAST(u.id AS TEXT) = $2)`;
      params.push(`%${search}%`, search);
    }
    query += ` ORDER BY u.id DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка получения курьеров:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/chats', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const senders = await pool.query(
      `SELECT DISTINCT m.sender_id, u.name, u.role,
              (SELECT COUNT(*) FROM messages WHERE order_id = 0 AND sender_id = m.sender_id AND admin_read = false) as unread
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.order_id = 0
       ORDER BY unread DESC, u.name`
    );
    res.json(senders.rows);
  } catch (err) {
    console.error('Ошибка получения чатов:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/chat/:userId', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { userId } = req.params;
  try {
    const msgs = await pool.query(
      `SELECT m.*, u.name as sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.order_id = 0 AND (m.sender_id = $1 OR m.sender_id = $2)
       ORDER BY m.created_at ASC`,
      [userId, req.user.id]
    );
    await pool.query(
      `UPDATE messages SET admin_read = true WHERE order_id = 0 AND sender_id = $1 AND admin_read = false`,
      [userId]
    );
    res.json(msgs.rows);
  } catch (err) {
    console.error('Ошибка получения чата:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/online-count', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const count = await pool.query('SELECT COUNT(*) FROM couriers WHERE is_online = true');
    res.json({ online: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/admin/applications', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query(
      `SELECT id, name, phone, email, address,
              passport_series, passport_number, passport_issued_by, passport_issued_date,
              inn, transport, application_status,
              photo_passport, photo_face
       FROM users
       WHERE role = 'courier' AND application_status = 'pending'
       ORDER BY id DESC`
    );
    const applications = result.rows.map(app => ({
      ...app,
      inn_valid: app.inn ? validateInn(app.inn) : false
    }));
    res.json(applications);
  } catch (err) {
    console.error('Ошибка получения заявок:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/applications/:id/approve', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    await pool.query('UPDATE users SET application_status = $1 WHERE id = $2 AND role = $3', ['approved', id, 'courier']);
    const existing = await pool.query('SELECT id FROM couriers WHERE user_id = $1', [id]);
    if (existing.rows.length === 0) {
      await pool.query('INSERT INTO couriers (user_id, is_online, lat, lng) VALUES ($1, false, 59.9343, 30.3351)', [id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка одобрения заявки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.post('/api/admin/applications/:id/reject', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await pool.query(
      'UPDATE users SET application_status = $1, rejection_reason = $2 WHERE id = $3 AND role = $4',
      ['rejected', reason || '', id, 'courier']
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка отклонения заявки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==================== АДМИНКА: ЗАКАЗЫ ====================
app.get('/api/admin/orders', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { status, search } = req.query;
  let query = 'SELECT * FROM orders';
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(CAST(id AS TEXT) ILIKE $${params.length + 1} OR pickup_address ILIKE $${params.length + 1} OR delivery_address ILIKE $${params.length + 1})`);
    params.push(`%${search}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC LIMIT 200';
  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/orders/:id/status', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/orders/:id/assign', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { courier_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE orders SET courier_id = $1, status = $2 WHERE id = $3 AND status = $4 RETURNING *',
      [courier_id, 'accepted', id, 'new']
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Не удалось назначить курьера' });
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: ФИНАНСЫ ====================
app.get('/api/admin/payments', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query('SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/payments/confirm', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { ext_transaction_id } = req.body;
  try {
    const order = await pool.query('UPDATE orders SET status = $1 WHERE payment_id = $2 RETURNING id', ['paid', ext_transaction_id]);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Заказ не найден' });
    res.json({ success: true, order_id: order.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: ТАРИФЫ (расширенные) ====================
app.get('/api/admin/tariffs', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const base = await pool.query("SELECT value FROM settings WHERE key='base_price'");
    const perkm = await pool.query("SELECT value FROM settings WHERE key='price_per_km'");
    const shopBase = await pool.query("SELECT value FROM settings WHERE key='shop_base_price'");
    const shopPerKm = await pool.query("SELECT value FROM settings WHERE key='shop_price_per_km'");
    const pvzBase = await pool.query("SELECT value FROM settings WHERE key='pvz_base_price'");
    const pvzPerKm = await pool.query("SELECT value FROM settings WHERE key='pvz_price_per_km'");
    res.json({
      base_price: parseFloat(base.rows[0]?.value || '100'),
      price_per_km: parseFloat(perkm.rows[0]?.value || '20'),
      shop_base_price: parseFloat(shopBase.rows[0]?.value || '200'),
      shop_price_per_km: parseFloat(shopPerKm.rows[0]?.value || '15'),
      pvz_base_price: parseFloat(pvzBase.rows[0]?.value || '150'),
      pvz_price_per_km: parseFloat(pvzPerKm.rows[0]?.value || '15')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/tariffs', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { base_price, price_per_km, shop_base_price, shop_price_per_km, pvz_base_price, pvz_price_per_km } = req.body;
  try {
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'base_price'", [base_price.toString()]);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'price_per_km'", [price_per_km.toString()]);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'shop_base_price'", [shop_base_price?.toString() || '200']);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'shop_price_per_km'", [shop_price_per_km?.toString() || '15']);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'pvz_base_price'", [pvz_base_price?.toString() || '150']);
    await pool.query("UPDATE settings SET value = $1 WHERE key = 'pvz_price_per_km'", [pvz_price_per_km?.toString() || '15']);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: КОНТЕНТ ====================
app.get('/api/admin/content', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const keys = ['privacy_policy', 'public_offer', 'agent_agreement'];
    const data = {};
    for (let k of keys) {
      const r = await pool.query('SELECT value FROM settings WHERE key=$1', [k]);
      data[k] = r.rows[0]?.value || '';
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/content', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { key, value } = req.body;
  try {
    await pool.query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2', [key, value]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: РЕГИОНЫ ====================
app.get('/api/admin/regions', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query('SELECT * FROM regions ORDER BY name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/regions', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM regions WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Публичный список регионов
app.get('/api/regions', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM regions ORDER BY name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ==================== АДМИНКА: ОТЗЫВЫ ====================
app.get('/api/admin/reviews', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query('SELECT r.*, u.name AS user_name, c.name AS courier_name FROM reviews r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN users c ON r.courier_id = c.id ORDER BY r.created_at DESC');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/reviews/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM reviews WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: БЛОКИРОВКА ПОЛЬЗОВАТЕЛЕЙ (с причиной) ====================
app.put('/api/admin/users/:id/block', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { blocked, reason } = req.body;
  try {
    await pool.query('UPDATE users SET is_blocked=$1, block_reason=$2 WHERE id=$3', [blocked, reason || null, id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: ЛОГИ ====================
app.get('/api/admin/logs', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query('SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== АДМИНКА: ВЫПЛАТЫ ====================
app.get('/api/admin/payouts', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const days = req.query.days || 14;
  try {
    const result = await pool.query(
      `SELECT p.*, u.name as courier_name, u.phone as courier_phone
       FROM payouts p
       JOIN users u ON u.id = p.courier_id
       WHERE p.created_at > NOW() - INTERVAL '${days} days'
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/payouts/:id/complete', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  try {
    await pool.query("UPDATE payouts SET status = 'completed', processed_at = NOW() WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/payouts/:id/error', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { message } = req.body;
  try {
    await pool.query(
      "UPDATE payouts SET status = 'error', error_message = $1, processed_at = NOW() WHERE id = $2",
      [message, id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================== ВЫПЛАТЫ КУРЬЕРАМ (для приложения курьера) ==================
app.get('/api/courier/payouts', authenticate, async (req, res) => {
  if (req.user.role !== 'courier') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query(
      'SELECT * FROM payouts WHERE courier_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/next-payout', authenticate, async (req, res) => {
  const now = new Date();
  const days = [2, 4, 6];
  const hour = 14;
  const minute = 0;

  let next = new Date(now);
  next.setHours(hour, minute, 0, 0);

  if (days.includes(next.getDay()) && next > now) {
    return res.json({ next_payout: next.toISOString() });
  }

  for (let i = 1; i <= 7; i++) {
    next.setDate(next.getDate() + 1);
    if (days.includes(next.getDay())) {
      next.setHours(hour, minute, 0, 0);
      return res.json({ next_payout: next.toISOString() });
    }
  }
});

// ================== ОТЗЫВЫ ==================
app.post('/api/reviews', authenticate, async (req, res) => {
  const { order_id, rating, comment } = req.body;
  if (!order_id || !rating) return res.status(400).json({ error: 'Нужен order_id и rating' });
  try {
    const order = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND client_id = $2 AND status = $3',
      [order_id, req.user.id, 'delivered']
    );
    if (order.rows.length === 0) return res.status(400).json({ error: 'Нельзя оставить отзыв' });

    const exist = await pool.query(
      'SELECT id FROM reviews WHERE order_id = $1 AND user_id = $2',
      [order_id, req.user.id]
    );
    if (exist.rows.length > 0) return res.status(400).json({ error: 'Вы уже оставили отзыв' });

    await pool.query(
      'INSERT INTO reviews (order_id, user_id, courier_id, rating, comment) VALUES ($1,$2,$3,$4,$5)',
      [order_id, req.user.id, order.rows[0].courier_id, rating, comment || null]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Ошибка создания отзыва:', e);
    res.status(500).json({ error: e.message });
  }
});

// ================== ВЕРИФИКАЦИЯ EMAIL ==================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // использовать SSL
  auth: {
    user: 'dokuda.dostavka@gmail.com',
    pass: 'ymknqnrtowomkvd'   // → пиши без пробелов: ymknqnrx towomkvd // пароль приложения (без пробелов)
  }
});

// Отправить код верификации на email
app.post('/api/send-verification-code', authenticate, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  try {
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    await pool.query(
      'UPDATE users SET verification_code = $1 WHERE id = $2',
      [code, req.user.id]
    );

    await transporter.sendMail({
      from: '"Докуда" <dokuda.dostavka@gmail.com>',
      to: email,
      subject: 'Код подтверждения регистрации',
      text: `Ваш код подтверждения: ${code}`,
      html: `<p>Ваш код подтверждения: <strong>${code}</strong></p>`
    });

    console.log(`Код подтверждения отправлен на ${email}: ${code}`);
    res.json({ success: true, message: 'Код отправлен' });
  } catch (e) {
    console.error('Ошибка отправки кода:', e);
    res.status(500).json({ error: 'Не удалось отправить код' });
  }
});

// ================== ЧЕРЕЗ SOCKET.IO ==================
io.on('connection', (socket) => {
  // логирование отключено

  const token = socket.handshake.query.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
    } catch (err) {
      console.log('Socket auth error:', err.message);
    }
  }

  socket.on('join_room', (orderId) => {
    socket.join(`order_${orderId}`);
  });

  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
  });

  socket.on('send_message', async (data) => {
    const senderId = socket.userId;
    const { order_id, text, image } = data;
    if (!senderId || !order_id || (!text && !image)) return;

    try {
      const user = await pool.query('SELECT name FROM users WHERE id = $1', [senderId]);
      const senderName = user.rows[0]?.name || 'Неизвестный';

      await pool.query(
        'INSERT INTO messages (order_id, sender_id, text, image) VALUES ($1,$2,$3,$4)',
        [order_id, senderId, text || null, image || null]
      );

      io.to(`order_${order_id}`).emit('new_message', {
        sender_id: senderId,
        sender_name: senderName,
        text,
        image,
        time: new Date().toISOString()
      });

      // Push второй стороне
      const order = await pool.query('SELECT client_id, courier_id FROM orders WHERE id = $1', [order_id]);
      if (order.rows.length > 0) {
        const { client_id, courier_id } = order.rows[0];
        const notifyUserId = senderId === client_id ? courier_id : client_id;
        if (notifyUserId) {
          const tokens = await getUserPushTokens(notifyUserId);
          if (tokens.length) {
            await sendPushNotifications(tokens.map(token => ({
              to: token,
              sound: 'default',
              title: 'Новое сообщение',
              body: `${senderName}: ${(text || '[фото]').substring(0, 100)}`,
              data: { orderId: order_id },
            })));
          }
        }
      }
    } catch (err) {
      console.error('Ошибка сохранения сообщения:', err);
    }
  });

  socket.on('join_support', () => {
    socket.join('support');
  });

  socket.on('send_support_message', async (data) => {
    const senderId = socket.userId;
    const { text, image, recipient_id } = data;
    if (!senderId || (!text && !image)) return;

    try {
      const user = await pool.query('SELECT name FROM users WHERE id = $1', [senderId]);
      const senderName = user.rows[0]?.name || 'Неизвестный';
      // Если отправитель не админ, получателем становится админ
      const recId = socket.userRole === 'admin' ? (recipient_id || null) : null;

      await pool.query(
        'INSERT INTO messages (order_id, sender_id, recipient_id, text, image) VALUES (0,$1,$2,$3,$4)',
        [senderId, recId, text || null, image || null]
      );

      const msg = {
        id: Date.now(),
        order_id: 0,
        sender_id: senderId,
        recipient_id: recId,
        text,
        image,
        time: new Date().toISOString(),
        sender_name: senderName
      };

      if (socket.userRole === 'admin' && recId) {
        // Админ ответил конкретному пользователю – отправляем в его комнату и всем админам
        io.to(`user_${recId}`).emit('new_support_message', msg);
        const admins = await pool.query("SELECT id FROM users WHERE role='admin'");
        for (const admin of admins.rows) {
          io.to(`user_${admin.id}`).emit('new_support_message', msg);
        }
        // Push пользователю
        const tokens = await getUserPushTokens(recId);
        if (tokens.length) {
          await sendPushNotifications(tokens.map(t => ({
            to: t,
            sound: 'default',
            title: 'Поддержка',
            body: `${senderName}: ${(text || '[фото]').substring(0, 100)}`,
            data: {}
          })));
        }
      } else {
        // Клиент или курьер пишет в поддержку – отправляем всем админам и ему самому
        const admins = await pool.query("SELECT id FROM users WHERE role='admin'");
        for (const admin of admins.rows) {
          io.to(`user_${admin.id}`).emit('new_support_message', msg);
        }
        socket.emit('new_support_message', msg); // чтобы отправитель сразу увидел своё сообщение
        // Push админам
        for (const admin of admins.rows) {
          const tokens = await getUserPushTokens(admin.id);
          if (tokens.length) {
            await sendPushNotifications(tokens.map(t => ({
              to: t,
              sound: 'default',
              title: 'Новое сообщение в поддержку',
              body: `${senderName}: ${(text || '[фото]').substring(0, 100)}`,
              data: { userId: senderId }
            })));
          }
        }
      }
    } catch (err) {
      console.error('Ошибка отправки сообщения в поддержку:', err);
    }
  });
});

// Просмотр push-токенов (только для админа)
app.get('/api/admin/push-tokens', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const result = await pool.query(
      `SELECT pt.id, pt.user_id, u.name, u.role, 
              substring(pt.token, 1, 20) || '...' as token_preview, 
              pt.created_at
       FROM push_tokens pt
       JOIN users u ON u.id = pt.user_id
       ORDER BY pt.created_at DESC`
    );
    res.json({ count: result.rows.length, tokens: result.rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Получить полный push-токен по user_id (только для админа)
app.get('/api/admin/push-token-full', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Укажите ?user_id=' });
  try {
    const result = await pool.query(
      'SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [user_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Токен не найден' });
    res.json({ token: result.rows[0].token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Тестовая отправка push на конкретный токен (только для админа)
app.get('/api/admin/test-push-single', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Укажите ?token=ExponentPushToken[...]' });
  try {
    await sendPushNotifications([{
      to: token,
      sound: 'default',
      title: 'Тестовое уведомление',
      body: 'Если видите это — push работает!',
    }]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/clear-old-push-tokens', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { newToken } = req.body;
  try {
    await pool.query('DELETE FROM push_tokens WHERE token != $1', [newToken]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Прямой тест FCM v1 (использует переменную FCM_KEY_BASE64)
app.get('/api/admin/test-fcm-direct', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Укажите ?token=ExponentPushToken[...]' });

  try {
    const base64key = process.env.FCM_KEY_BASE64;
    if (!base64key) return res.status(500).json({ error: 'Переменная FCM_KEY_BASE64 не задана' });

    const jsonString = Buffer.from(base64key, 'base64').toString('utf-8');
    const key = JSON.parse(jsonString);

    const { GoogleAuth } = require('google-auth-library');
    const auth = new GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    const message = {
      message: {
        token: token.replace(/^ExponentPushToken\[|\]$/g, ''),
        notification: {
          title: 'Прямой тест с сервера',
          body: 'Если видите это — доставка работает!',
        },
      },
    };

    const response = await fetch(
      'https://fcm.googleapis.com/v1/projects/dokudapush/messages:send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    const data = await response.json();
    console.log('FCM Direct ответ:', JSON.stringify(data));
    res.json(data);
  } catch (e) {
    console.error('Ошибка прямого FCM теста:', e);
    res.status(500).json({ error: e.message });
  }
});

// ================== АВТОМАТИЧЕСКИЕ ВЫПЛАТЫ (CRON) ==================
async function processAutoPayouts() {
  try {
    const couriers = await pool.query(
      "SELECT id FROM users WHERE role = 'courier' AND application_status = 'approved'"
    );

    for (const courier of couriers.rows) {
      const courierId = courier.id;

      const lastPayout = await pool.query(
        "SELECT period_end FROM payouts WHERE courier_id = $1 AND status = 'completed' ORDER BY period_end DESC LIMIT 1",
        [courierId]
      );
      let periodStart = '1970-01-01';
      if (lastPayout.rows.length > 0 && lastPayout.rows[0].period_end) {
        periodStart = new Date(new Date(lastPayout.rows[0].period_end).getTime() + 1000).toISOString();
      }

      const periodEnd = new Date().toISOString();

      const orders = await pool.query(
        `SELECT o.price, o.actual_amount, o.max_product_amount, o.type
         FROM orders o
         WHERE o.courier_id = $1 AND o.status = 'delivered'
           AND o.finished_at > $2 AND o.finished_at <= $3`,
        [courierId, periodStart, periodEnd]
      );

      let totalAmount = 0;
      for (const order of orders.rows) {
        if (order.type === 'shop' && order.actual_amount) {
          const deliveryPrice = order.price - order.max_product_amount;
          totalAmount += parseFloat(order.actual_amount) + 0.9 * deliveryPrice;
        } else {
          totalAmount += 0.9 * (order.price || 0);
        }
      }

      if (totalAmount > 0) {
        await pool.query(
          `INSERT INTO payouts (courier_id, amount, status, period_start, period_end)
           VALUES ($1, $2, 'pending', $3, $4)`,
          [courierId, totalAmount, periodStart, periodEnd]
        );
        console.log(`Создана выплата ${totalAmount}₽ для курьера ${courierId}`);
      }
    }
  } catch (e) {
    console.error('Ошибка автоматических выплат:', e);
  }
}

cron.schedule('0 11 * * 2,4,6', () => {
  console.log('Запуск автоматических выплат по расписанию');
  processAutoPayouts();
}, {
  timezone: "Europe/Moscow"
});

// ================== АВТОМАТИЧЕСКАЯ МИГРАЦИЯ ПРИ СТАРТЕ ==================
async function runMigrations() {
  const fs = require('fs');
  const { Client } = require('pg');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
  });

  try {
    await client.connect();

    try {
      const sql = fs.readFileSync('./migrations.sql', 'utf8');
      await client.query(sql);
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_series TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_issued_by TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_issued_date DATE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS inn TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS transport TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'approved';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_policy BOOLEAN DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_agreement BOOLEAN DEFAULT false;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
      `);
      console.log('Поля для заявок курьеров готовы');
      console.log('Миграции успешно выполнены');
    } catch (err) {
      if (err.code === '42P07') {
        console.log('Таблицы уже существуют, пропускаем миграцию');
      } else {
        console.error('Ошибка миграции:', err.message);
      }
    }

    try {
      await client.query(`
        INSERT INTO orders (id, client_id, pickup_address, delivery_address, description, price, status)
        VALUES (0, 1, 'support', 'support', 'Чат поддержки', 0, 'support')
        ON CONFLICT (id) DO NOTHING;
      `);
      console.log('Заказ id=0 готов');

      try {
        await client.query(`
          ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_series TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_number TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_issued_by TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_issued_date DATE;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS inn TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS transport TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'approved';
          ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_policy BOOLEAN DEFAULT false;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_agreement BOOLEAN DEFAULT false;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS agreed_at TIMESTAMPTZ;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
          ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason TEXT;
        `);
        console.log('Поля для заявок курьеров готовы');
      } catch (e) {
        console.error('Ошибка при добавлении полей заявок:', e.message);
      }
    } catch (e) {
      console.error('Не удалось добавить заказ id=0:', e.message);
    }

    try {
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id TEXT;`);
      console.log('Колонка payment_id добавлена');
    } catch (e) {
      console.error('Ошибка добавления payment_id:', e.message);
    }

    try {
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmation_code TEXT;`);
      console.log('Колонка confirmation_code добавлена');
    } catch (e) {
      console.error('Ошибка добавления confirmation_code:', e.message);
    }

    try {
      await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;`);
      console.log('Колонка finished_at добавлена');
    } catch (e) {
      console.error('Ошибка добавления finished_at:', e.message);
    }

    // Новые поля для ПВЗ
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pvz_code_image TEXT;`);
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS pvz_address TEXT;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        name TEXT NOT NULL,
        note TEXT DEFAULT '',
        sort_order INTEGER
      );
    `);

    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'parcel';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS category TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS max_product_amount INTEGER;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS actual_amount NUMERIC;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS message_for_courier TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS ozon_payment_id TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT false;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      INSERT INTO settings (key, value) VALUES ('base_price', '100') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('price_per_km', '20') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('shop_base_price', '200') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('shop_price_per_km', '15') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('pvz_base_price', '150') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('pvz_price_per_km', '15') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('privacy_policy', '') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('public_offer', '') ON CONFLICT (key) DO NOTHING;
      INSERT INTO settings (key, value) VALUES ('agent_agreement', '') ON CONFLICT (key) DO NOTHING;
    `);

    // Таблица регионов
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );
      INSERT INTO regions (name) VALUES ('Санкт-Петербург') ON CONFLICT (name) DO NOTHING;
    `);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS region_id INTEGER REFERENCES regions(id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        user_id INTEGER REFERENCES users(id),
        courier_id INTEGER REFERENCES users(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_logs (
        id SERIAL PRIMARY KEY,
        payment_id TEXT,
        ext_transaction_id TEXT,
        status TEXT,
        amount NUMERIC,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        courier_id INTEGER REFERENCES users(id),
        amount NUMERIC NOT NULL,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','error')),
        error_message TEXT,
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      );
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_passport TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_face TEXT;`);

    // Добавляем поля для чата (recipient_id и image в messages)
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id INTEGER REFERENCES users(id);`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image TEXT;`);

    // Поля для верификации email
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code TEXT;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        token TEXT NOT NULL UNIQUE,
        platform TEXT DEFAULT 'android',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('Все миграции выполнены');
  } finally {
    await client.end();
  }
}

runMigrations().then(() => {
  server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});