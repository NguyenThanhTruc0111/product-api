require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const Product = require('./Product');

const app = express();

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        mongodb: 'disconnected'
      });
    }

    await mongoose.connection.db.admin().ping();

    res.status(200).json({
      status: 'healthy',
      mongodb: 'connected'
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      mongodb: 'unavailable'
    });
  }
});

// Chỉ lấy bốn trường dữ liệu của Product.
function productData(body) {
  return {
    pid: body.pid,
    pname: body.pname,
    price: body.price,
    quantity: body.quantity
  };
}

// Chuyển lỗi từ các API đến phần xử lý lỗi.
function handle(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// CREATE: Thêm sản phẩm.
app.post('/api/products', handle(async (req, res) => {
  const product = await Product.create(productData(req.body));
  res.status(201).json(product);
}));

// READ: Lấy danh sách sản phẩm.
app.get('/api/products', handle(async (req, res) => {
  const products = await Product.find();
  res.json(products);
}));

// READ: Lấy sản phẩm theo pid.
app.get('/api/products/:pid', handle(async (req, res) => {
  const product = await Product.findOne({ pid: req.params.pid });

  if (!product) {
    return res.status(404).json({
      message: 'Product not found'
    });
  }

  res.json(product);
}));

// UPDATE: Cập nhật sản phẩm theo pid.
app.put('/api/products/:pid', handle(async (req, res) => {
  const product = await Product.findOne({ pid: req.params.pid });

  if (!product) {
    return res.status(404).json({
      message: 'Product not found'
    });
  }

  product.set(productData(req.body));
  await product.save();

  res.json(product);
}));

// DELETE: Xóa sản phẩm theo pid.
app.delete('/api/products/:pid', handle(async (req, res) => {
  const product = await Product.findOneAndDelete({
    pid: req.params.pid
  });

  if (!product) {
    return res.status(404).json({
      message: 'Product not found'
    });
  }

  res.json({ message: 'Product deleted' });
}));

// Xử lý lỗi.
app.use((err, req, res, next) => {
  console.error(err.message);

  if (err.code === 11000) {
    return res.status(409).json({
      message: 'Product pid already exists'
    });
  }

  if (err.name === 'ValidationError' || err.status === 400) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: 'Internal server error' });
});

// Kết nối MongoDB thành công rồi mới mở cổng API.
async function start() {
  if (!process.env.MONGODB_URI || !process.env.PORT) {
    throw new Error('Missing MONGODB_URI or PORT in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await Product.init();

  console.log('MongoDB connected');

  app.listen(Number(process.env.PORT), '0.0.0.0', () => {
    console.log(`Product API running on port ${process.env.PORT}`);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err.message);
  process.exit(1);
});