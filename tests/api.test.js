const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

const server = require('../server');
const baseUrl = 'http://127.0.0.1:3000/api/requests';

function request(method, url, payload) {
  return new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : undefined;
    const parsed = new URL(url);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : [],
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

test('GET /api/requests serves seeded request rows', async () => {
  const resp = await request('GET', baseUrl);
  assert.equal(resp.status, 200);
  assert.ok(Array.isArray(resp.body), 'expected an array response');
  assert.equal(resp.body.length, 3, 'expected three seeded requests');
});

test('GET /api/menus serves seeded menu rows', async () => {
  const resp = await request('GET', 'http://127.0.0.1:3000/api/menus');
  assert.equal(resp.status, 200);
  assert.ok(Array.isArray(resp.body), 'expected an array response');
  assert.equal(resp.body.length, 3, 'expected three seeded menus');
  assert.equal(resp.body[0].name, 'French Market');
  assert.ok(Array.isArray(resp.body[0].plates));
});

test('PUT /api/menus persists an updated menu array', async () => {
  const before = await request('GET', 'http://127.0.0.1:3000/api/menus');
  const incoming = [
    {
      id: 'menu-1',
      name: 'French Market',
      plates: ['Market starter', 'Bistro fish', 'Pear tart'],
    },
    {
      id: 'menu-new',
      name: 'Ocean Feast',
      plates: ['Sea salad', 'Cedar fish'],
    },
  ];

  const resp = await request('PUT', 'http://127.0.0.1:3000/api/menus', incoming);
  assert.equal(resp.status, 200);
  assert.equal(resp.body.length, 2);
  assert.equal(resp.body[1].name, 'Ocean Feast');
  assert.deepEqual(resp.body[1].plates, ['Sea salad', 'Cedar fish']);

  const after = await request('GET', 'http://127.0.0.1:3000/api/menus');
  assert.equal(after.status, 200);
  assert.equal(after.body.length, 2);
  assert.equal(after.body[1].name, 'Ocean Feast');

  await request('PUT', 'http://127.0.0.1:3000/api/menus', before.body);
});

test('PUT /api/menus accepts an explicit user-written plate count', async () => {
  const before = await request('GET', 'http://127.0.0.1:3000/api/menus');
  const incoming = [
    {
      id: 'menu-1',
      name: 'French Market',
      plates: ['Market starter', 'Bistro fish', 'Pear tart'],
      plateCount: 8,
    },
  ];

  const resp = await request('PUT', 'http://127.0.0.1:3000/api/menus', incoming);
  assert.equal(resp.status, 200);
  assert.equal(resp.body.length, 1);
  assert.equal(resp.body[0].plateCount, 8);

  const after = await request('GET', 'http://127.0.0.1:3000/api/menus');
  assert.equal(after.status, 200);
  assert.equal(after.body.length, 1);
  assert.equal(after.body[0].plateCount, 8);

  await request('PUT', 'http://127.0.0.1:3000/api/menus', before.body);
});

test('PUT /api/requests normalizes paragraph plate import into cleaned plate names', async () => {
  const before = await request('GET', baseUrl);
  const incoming = [
    {
      id: 'sample-request-para-clean',
      client: 'Paragraph Client',
      style: 'French Market',
      guests: 8,
      price: 420,
      grocery: 180,
      date: '2026-09-14',
      allergies: 'None',
      address: '21 Market Street',
      eventTime: '19:00',
      plates: 'A personal expression of my love for Greece\nPortugal\nJordan and the Levant.\nThis menu is not only about flavours. It is a story of culture',
    },
  ];

  const resp = await request('PUT', baseUrl, incoming);
  assert.equal(resp.status, 200);
  assert.equal(resp.body.length, 1);
  assert.ok(Array.isArray(resp.body[0].plates));
  assert.ok(resp.body[0].plates.length >= 4);
  assert.equal(resp.body[0].plates[0], 'A personal expression of my love for Greece');
  assert.ok(!resp.body[0].plates.some((plate) => /This menu is not only about flavours/.test(plate)));

  await request('PUT', baseUrl, before.body);
});

test('PUT /api/requests persists an updated request array', async () => {
  const before = await request('GET', baseUrl);
  const incoming = [
    {
      id: 'sample-1',
      client: 'Savory Table',
      style: 'French Market',
      guests: 8,
      price: 420,
      grocery: 180,
      date: '2026-09-14',
      allergies: 'Shellfish allergy',
      address: '21 Market Street',
      eventTime: '19:00',
    },
    {
      id: 'sample-4',
      client: 'Test Kitchen',
      style: 'Private Dining',
      guests: 10,
      price: 640,
      grocery: 210,
      date: '2026-09-21',
      allergies: 'None',
      address: '12 Chef Lane',
      eventTime: '20:30',
    },
  ];

  const resp = await request('PUT', baseUrl, incoming);
  assert.equal(resp.status, 200);
  assert.equal(resp.body.length, 2);
  assert.equal(resp.body[0].allergies, 'Shellfish allergy');
  assert.equal(resp.body[0].address, '21 Market Street');
  assert.equal(resp.body[0].eventTime, '19:00');

  const after = await request('GET', baseUrl);
  assert.equal(after.status, 200);
  assert.equal(after.body.length, 2);
  assert.equal(after.body[1].client, 'Test Kitchen');

  await request('PUT', baseUrl, before.body);
});
