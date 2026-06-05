CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password TEXT,
  address TEXT,
  role TEXT DEFAULT 'client'
);

CREATE TABLE couriers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  full_name TEXT,
  passport TEXT,
  photo TEXT,
  transport TEXT,
  is_online BOOLEAN DEFAULT false,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES users(id),
  courier_id INTEGER REFERENCES users(id),
  status TEXT DEFAULT 'new',
  price INTEGER,
  pickup_address TEXT,
  delivery_address TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  sender_id INTEGER REFERENCES users(id),
  text TEXT,
  admin_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO orders (id, client_id, pickup_address, delivery_address, description, price, status)
VALUES (0, 1, 'support', 'support', 'Чат поддержки', 0, 'support')
ON CONFLICT (id) DO NOTHING;