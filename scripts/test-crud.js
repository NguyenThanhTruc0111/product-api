const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const baseUrl = process.env.API_URL || 'http://localhost:3000';
const pid = `CI-${randomUUID()}`;
const path = `/api/products/${pid}`;

async function request(method, path, expectedStatus, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });

  const data = await response.json();

  assert.equal(
    response.status,
    expectedStatus,
    `${method} ${path}: ${JSON.stringify(data)}`
  );

  return data;
}

async function test() {
  const health = await request('GET', '/health', 200);
  assert.equal(health.status, 'healthy');
  assert.equal(health.mongodb, 'connected');
  console.log('PASS: Health check');

  const product = {
    pid,
    pname: 'CI Product',
    price: 100000,
    quantity: 10
  };

  try {
    const created = await request(
      'POST', '/api/products', 201, product
    );

    for (const key of Object.keys(product)) {
      assert.equal(created[key], product[key]);
    }
    console.log('PASS: Create product');

    const found = await request('GET', path, 200);
    for (const key of Object.keys(product)) {
      assert.equal(found[key], product[key]);
    }

    const list = await request('GET', '/api/products', 200);
    assert.ok(Array.isArray(list));
    assert.ok(list.some(item => item.pid === pid));
    console.log('PASS: Read product and list');

    const updatedData = {
      pid,
      pname: 'CI Product Updated',
      price: 150000,
      quantity: 20
    };

    await request('PUT', path, 200, updatedData);

    const updated = await request('GET', path, 200);
    for (const key of Object.keys(updatedData)) {
      assert.equal(updated[key], updatedData[key]);
    }
    console.log('PASS: Update product');

    await request('DELETE', path, 200);
    await request('GET', path, 404);
    console.log('PASS: Delete product');

    console.log('All CRUD tests passed');
  } finally {
    await fetch(`${baseUrl}${path}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000)
    }).catch(() => {});
  }
}

test().catch(err => {
  console.error('FAIL:', err.message);
  process.exitCode = 1;
});