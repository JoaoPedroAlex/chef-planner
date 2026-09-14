const http = require('http');
const path = require('path');
const { URL } = require('url');
const sqlite3 = require('sqlite3').verbose();

const HOST = '127.0.0.1';
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'chefops.db');

const samples = [
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
    plates: ['Market starter', 'Bistro fish', 'Pear tart'],
  },
  {
    id: 'sample-2',
    client: 'The Green Room',
    style: 'Vegetarian Menu',
    guests: 12,
    price: 560,
    grocery: 260,
    date: '2026-09-16',
    allergies: 'None',
    address: '17 Herb Lane',
    eventTime: '18:30',
    plates: ['Root garden soup', 'Saffron squash', 'Herb tart'],
  },
  {
    id: 'sample-3',
    client: 'Luna Catering',
    style: 'Seasonal Tasting',
    guests: 20,
    price: 980,
    grocery: 490,
    date: '2026-09-18',
    allergies: 'Nut allergy',
    address: '88 Garden Road',
    eventTime: '20:00',
    plates: ['Garden salad', 'Seasonal main', 'Cedar pear'],
  }
];

const defaultMenus = [
  {
    id: 'menu-1',
    name: 'French Market',
    description: 'A market menu of seasonal kitchen classics.',
    plates: ['Market starter', 'Bistro fish', 'Pear tart'],
    plateCount: 3,
  },
  {
    id: 'menu-2',
    name: 'Vegetarian Menu',
    description: 'A garden-forward vegetarian selection.',
    plates: ['Root garden soup', 'Saffron squash', 'Herb tart'],
    plateCount: 3,
  },
  {
    id: 'menu-3',
    name: 'Seasonal Tasting',
    description: 'Seasonal tasting plates arranged in a concise progression.',
    plates: ['Garden salad', 'Seasonal main', 'Cedar pear'],
    plateCount: 3,
  },
];

const db = new sqlite3.Database(DB_FILE);

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS requests (
          id TEXT PRIMARY KEY,
          client TEXT NOT NULL,
          style TEXT NOT NULL,
          guests INTEGER NOT NULL,
          price REAL NOT NULL,
          grocery REAL NOT NULL,
          date TEXT NOT NULL,
          allergies TEXT,
          address TEXT,
          eventTime TEXT,
          plates TEXT
        )
      `, (createError) => {
        if (createError) {
          reject(createError);
          return;
        }

        db.run(`
          CREATE TABLE IF NOT EXISTS menus (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            plates TEXT NOT NULL,
            plateCount INTEGER NOT NULL DEFAULT 0
          )
        `, (menuCreateError) => {
          if (menuCreateError) {
            reject(menuCreateError);
            return;
          }

          db.run(`
            CREATE TABLE IF NOT EXISTS menu_plates (
              id TEXT PRIMARY KEY,
              menu_id TEXT NOT NULL,
              plateName TEXT NOT NULL,
              plateDescription TEXT,
              FOREIGN KEY(menu_id) REFERENCES menus(id)
            )
          `, (platesCreateError) => {
            if (platesCreateError) {
              reject(platesCreateError);
              return;
            }

            db.all('PRAGMA table_info(menus)', (menuInfoError, menuColumns) => {
              if (menuInfoError) {
                reject(menuInfoError);
                return;
              }

              const menuExisting = new Set(menuColumns.map((column) => column.name));
              if (!menuExisting.has('description')) {
                db.run('ALTER TABLE menus ADD COLUMN description TEXT', (alterDescriptionError) => {
                  if (alterDescriptionError) {
                    reject(alterDescriptionError);
                    return;
                  }
                  continueAfterMenusInfo();
                });
                return;
              }

              if (!menuExisting.has('plateCount')) {
                db.run('ALTER TABLE menus ADD COLUMN plateCount INTEGER NOT NULL DEFAULT 0', (alterMenuError) => {
                  if (alterMenuError) {
                    reject(alterMenuError);
                    return;
                  }
                  continueAfterMenusInfo();
                });
                return;
              }

              continueAfterMenusInfo();
            });
          });
        });

        function continueAfterMenusInfo() {
          db.all('PRAGMA table_info(requests)', (pragmaError, columns) => {
            if (pragmaError) {
              reject(pragmaError);
              return;
            }

            const existing = new Set(columns.map((column) => column.name));
            const missingColumns = [
              'allergies',
              'address',
              'eventTime',
              'plates',
            ].filter((column) => !existing.has(column));

            if (!missingColumns.length) {
              continueAfterTableSetup();
              return;
            }

            addColumn(0);

            function addColumn(index) {
              if (index >= missingColumns.length) {
                continueAfterTableSetup();
                return;
              }

              const columnName = missingColumns[index];
              db.run(`ALTER TABLE requests ADD COLUMN ${columnName} TEXT`, (alterError) => {
                if (alterError) {
                  reject(alterError);
                  return;
                }

                addColumn(index + 1);
              });
            }
          });
        }
      });

      function continueAfterTableSetup() {
        db.run('DROP TABLE IF EXISTS users', (dropError) => {
          if (dropError) {
            reject(dropError);
            return;
          }

          db.get('SELECT COUNT(*) AS count FROM requests', (countError, row) => {
            if (countError) {
              reject(countError);
              return;
            }

            if (row.count === 0) {
              const insertRequests = db.prepare(`
                INSERT INTO requests (id, client, style, guests, price, grocery, date, allergies, address, eventTime, plates)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);

              samples.forEach((item) => {
                insertRequests.run(
                  item.id,
                  item.client,
                  item.style,
                  item.guests,
                  item.price,
                  item.grocery,
                  item.date,
                  item.allergies || '',
                  item.address || '',
                  item.eventTime || '',
                  JSON.stringify(item.plates || [])
                );
              });

              insertRequests.finalize((finalizeError) => {
                if (finalizeError) {
                  reject(finalizeError);
                  return;
                }

                seedMenus();
              });
              return;
            }

            db.get('SELECT COUNT(*) AS count FROM menus', (menuCountError, menuRow) => {
              if (menuCountError) {
                reject(menuCountError);
                return;
              }

              if (menuRow.count === 0) {
                seedMenus();
                return;
              }

              resolve();
            });
          });
        });
      }

      function seedMenus() {
        const insertMenus = db.prepare(`
          INSERT INTO menus (id, name, plates, plateCount)
          VALUES (?, ?, ?, ?)
        `);

        defaultMenus.forEach((menu) => {
          insertMenus.run(menu.id, menu.name, JSON.stringify(menu.plates || []), Number(menu.plateCount || menu.plates.length || 0));
        });

        insertMenus.finalize((menuFinalizeError) => {
          if (menuFinalizeError) {
            reject(menuFinalizeError);
            return;
          }

          resolve();
        });
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : []);
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

function normalizePlatesFromDb(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : String(value).split(',').map((item) => item.trim()).filter(Boolean);
  } catch (error) {
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function allMenus() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, description, plates, plateCount FROM menus ORDER BY name ASC', (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      db.all('SELECT id, menu_id, plateName, plateDescription FROM menu_plates ORDER BY menu_id ASC', (plateError, plateRows) => {
        if (plateError) {
          reject(plateError);
          return;
        }

        const platesByMenu = new Map();
        plateRows.forEach((plateRow) => {
          const current = platesByMenu.get(plateRow.menu_id) || [];
          current.push({
            plateName: String(plateRow.plateName || '').trim(),
            plateDescription: String(plateRow.plateDescription || '').trim(),
          });
          platesByMenu.set(plateRow.menu_id, current);
        });

        resolve(rows.map((row) => {
          const rowsFromTable = platesByMenu.get(row.id) || [];
          const objectPlates = rowsFromTable.length
            ? rowsFromTable
            : normalizePlatesFromDb(row.plates).map((plateName) => ({ plateName, plateDescription: '' }));

          return {
            id: row.id,
            name: row.name,
            description: row.description || '',
            plates: objectPlates,
            plateCount: Number(row.plateCount || objectPlates.length || 0),
          };
        }));
      });
    });
  });
}

function replaceMenus(items) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM menu_plates', (deletePlateError) => {
        if (deletePlateError) {
          reject(deletePlateError);
          return;
        }

        db.run('DELETE FROM menus', (deleteError) => {
          if (deleteError) {
            reject(deleteError);
            return;
          }

          const menuStatement = db.prepare(`
            INSERT INTO menus (id, name, description, plates, plateCount)
            VALUES (?, ?, ?, ?, ?)
          `);

          const plateStatement = db.prepare(`
            INSERT INTO menu_plates (id, menu_id, plateName, plateDescription)
            VALUES (?, ?, ?, ?)
          `);

          items.forEach((item) => {
            const menuId = item.id || `menu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
            const rawPlates = Array.isArray(item.plates)
              ? item.plates
              : typeof item.plates === 'string'
                ? String(item.plates).split(',').map((plate) => plate.trim()).filter(Boolean)
                : [];

            const plates = rawPlates.map((plate) => {
              if (typeof plate === 'string') {
                return { plateName: String(plate || '').trim(), plateDescription: '' };
              }

              if (plate && typeof plate === 'object') {
                return {
                  plateName: String(plate.plateName || plate.name || plate.title || '').trim(),
                  plateDescription: String(plate.plateDescription || plate.description || '').trim(),
                };
              }

              return { plateName: '', plateDescription: '' };
            }).filter((plate) => plate.plateName);

            const plateNames = plates.map((plate) => plate.plateName);

            menuStatement.run(
              menuId,
              String(item.name || '').trim(),
              String(item.description || '').trim(),
              JSON.stringify(plateNames),
              Number(item.plateCount || plateNames.length || 0),
            );

            plates.forEach((plate, idx) => {
              plateStatement.run(
                `menu-plate-${menuId}-${idx}-${Date.now().toString(36)}`,
                menuId,
                plate.plateName,
                plate.plateDescription || ''
              );
            });
          });

          menuStatement.finalize((insertError) => {
            if (insertError) {
              reject(insertError);
              return;
            }

            plateStatement.finalize((plateInsertError) => {
              if (plateInsertError) {
                reject(plateInsertError);
                return;
              }
              resolve(items);
            });
          });
        });
      });
    });
  });
}

function allRequests() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, client, style, guests, price, grocery, date, allergies, address, eventTime, plates FROM requests ORDER BY date ASC', (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows.map((row) => ({
        ...row,
        plates: normalizePlatesFromDb(row.plates),
      })));
    });
  });
}

function replaceRequests(items) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM requests', (deleteError) => {
        if (deleteError) {
          reject(deleteError);
          return;
        }

        const statement = db.prepare(`
          INSERT INTO requests (id, client, style, guests, price, grocery, date, allergies, address, eventTime, plates)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        items.forEach((item) => {
          statement.run(
            item.id || `request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            item.client,
            item.style,
            Number(item.guests),
            Number(item.price),
            Number(item.grocery),
            item.date,
            item.allergies || '',
            item.address || '',
            item.eventTime || '',
            JSON.stringify(Array.isArray(item.plates) ? item.plates : []),
          );
        });

        statement.finalize((insertError) => {
          if (insertError) {
            reject(insertError);
            return;
          }
          resolve(items);
        });
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (requestUrl.pathname === '/api/menus' && req.method === 'GET') {
    try {
      const rows = await allMenus();
      sendJson(res, 200, rows);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Unable to read menus.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/menus' && req.method === 'PUT') {
    try {
      const source = await readBody(req);
      if (!Array.isArray(source)) {
        sendJson(res, 400, { error: 'Request body must be an array of menus.' });
        return;
      }

      const normalized = source.map((item) => {
        const plates = Array.isArray(item.plates)
          ? item.plates.map((plate) => {
              if (typeof plate === 'string') {
                return String(plate || '').trim();
              }

              if (plate && typeof plate === 'object') {
                return String(plate.plateName || plate.name || '').trim();
              }

              return '';
            }).filter(Boolean)
          : typeof item.plates === 'string'
            ? item.plates.split(',').map((plate) => plate.trim()).filter(Boolean)
            : [];

        return {
          ...item,
          id: item.id || `menu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
          name: String(item.name || '').trim(),
          description: String(item.description || '').trim(),
          plates,
          plateCount: Number(item.plateCount || plates.length || 0),
        };
      });

      const saved = await replaceMenus(normalized);
      sendJson(res, 200, saved);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to save menus.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/requests' && req.method === 'GET') {
    try {
      const rows = await allRequests();
      sendJson(res, 200, rows);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Unable to read requests.' });
    }
    return;
  }

  if (requestUrl.pathname === '/api/requests' && req.method === 'PUT') {
    try {
      const source = await readBody(req);
      if (!Array.isArray(source)) {
        sendJson(res, 400, { error: 'Request body must be an array of requests.' });
        return;
      }

      const normalized = source.map((item) => ({
        ...item,
        id: item.id || `request-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        client: String(item.client || '').trim(),
        style: String(item.style || '').trim(),
        guests: Number(item.guests || 0),
        date: item.date || new Date().toISOString().slice(0, 10),
        price: Number(item.price || 0),
        grocery: Number(item.grocery || 0),
        allergies: String(item.allergies || '').trim(),
        address: String(item.address || '').trim(),
        eventTime: String(item.eventTime || '').trim(),
        plates: Array.isArray(item.plates)
          ? item.plates.map((plate) => String(plate || '').trim()).filter(Boolean)
          : typeof item.plates === 'string'
            ? item.plates.split(',').map((plate) => plate.trim()).filter(Boolean)
            : [],
      }));

      const saved = await replaceRequests(normalized);
      sendJson(res, 200, saved);
    } catch (error) {
      sendJson(res, 400, { error: error.message || 'Unable to save requests.' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

initDb()
  .then(() => {
    if (require.main === module) {
      server.listen(PORT, HOST, () => {
        console.log(`ChefOps Planner API listening on http://${HOST}:${PORT}`);
      });
    }
  })
  .catch((error) => {
    console.error('Unable to initialize request database:', error);
    process.exit(1);
  });

module.exports = server;
