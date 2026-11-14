CREATE TABLE IF NOT EXISTS orders (
  order_ref TEXT PRIMARY KEY,
  checkout_session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount_total INTEGER NOT NULL,
  email TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relay_id TEXT NOT NULL,
  relay_name TEXT NOT NULL,
  relay_address TEXT NOT NULL,
  relay_postal_code TEXT NOT NULL,
  relay_city TEXT NOT NULL,
  relay_type TEXT NOT NULL,
  shipping_option_code TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS shipments (
  order_ref TEXT NOT NULL,
  parcel_number TEXT NOT NULL,
  status TEXT NOT NULL,
  sendcloud_id TEXT,
  tracking_number TEXT,
  tracking_url TEXT,
  label_url TEXT,
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  PRIMARY KEY(order_ref, parcel_number),
  FOREIGN KEY(order_ref) REFERENCES orders(order_ref)
);
CREATE INDEX IF NOT EXISTS orders_status_created ON orders(status, created_at);
