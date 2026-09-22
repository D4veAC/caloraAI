const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calora-test-'));
process.env.CALORA_DATA_DIR = dataDir;
process.env.CALORA_WEBHOOK_TOKEN = 'test-webhook-secret';
process.env.CALORA_USERS_JSON = JSON.stringify([
  { id: 'dave', name: 'Dave', password: 'dave-pass', profile: { bb: 70, tb: 175, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' } },
  { id: 'alex', name: 'Alex', password: 'alex-pass', profile: { bb: 60, tb: 165, age: 28, sex: 'female', activity: 'light', goal: 'maintain' } },
  { id: 'admin', name: 'Admin', password: 'admin-pass', role: 'ADMIN', profile: { bb: 70, tb: 175, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain' } }
]);

const { server, store, ensurePlan } = require('../server.js');

async function login(baseUrl, username, password) {
  const response = await fetch(`${baseUrl}/api/session`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
  });
  assert.equal(response.status, 200);
  return response.headers.get('set-cookie').split(';')[0];
}

test('API validates nutrition data and isolates each user', async t => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.close();
    store.db.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const daveCookie = await login(baseUrl, 'Dave', 'dave-pass');
  const alexCookie = await login(baseUrl, 'Alex', 'alex-pass');
  const adminCookie = await login(baseUrl, 'Admin', 'admin-pass');

  const entry = { id: 'meal-1', meal: 'Rice and chicken', category: 'lunch', kcal: 500, protein: 35, carbs: 55, fat: 12 };
  const created = await fetch(`${baseUrl}/api/food`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: daveCookie }, body: JSON.stringify(entry)
  });
  assert.equal(created.status, 201);

  const duplicate = await fetch(`${baseUrl}/api/food`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: daveCookie }, body: JSON.stringify(entry)
  });
  assert.equal(duplicate.status, 409);

  const invalid = await fetch(`${baseUrl}/api/food`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: daveCookie }, body: JSON.stringify({ meal: 'Invalid', kcal: -1 })
  });
  assert.equal(invalid.status, 400);

  const daveFoods = await fetch(`${baseUrl}/api/food`, { headers: { Cookie: daveCookie } }).then(response => response.json());
  const alexFoods = await fetch(`${baseUrl}/api/food`, { headers: { Cookie: alexCookie } }).then(response => response.json());
  assert.equal(daveFoods.length, 1);
  assert.equal(alexFoods.length, 0);

  const crossUserEdit = await fetch(`${baseUrl}/api/food/${entry.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: alexCookie }, body: JSON.stringify({ ...entry, kcal: 1 })
  });
  assert.equal(crossUserEdit.status, 404);

  const profileUpdate = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: daveCookie },
    body: JSON.stringify({ bb: 82, tb: 180, age: 34, sex: 'male', activity: 'active', goal: 'lose' })
  });
  assert.equal(profileUpdate.status, 200);
  const daveProfile = await fetch(`${baseUrl}/api/profile`, { headers: { Cookie: daveCookie } }).then(response => response.json());
  const alexProfile = await fetch(`${baseUrl}/api/profile`, { headers: { Cookie: alexCookie } }).then(response => response.json());
  assert.equal(daveProfile.bb, 82);
  assert.equal(alexProfile.bb, 60);

  assert.equal((await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Cookie: daveCookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/dashboard`, { headers: { Cookie: adminCookie } })).status, 200);

  const bindTokenResponse = await fetch(`${baseUrl}/api/telegram/bind-token`, { method: 'POST', headers: { Cookie: daveCookie } });
  const bindPayload = await bindTokenResponse.json();
  const bindToken = bindPayload.startPayload.slice(5);
  assert.match(bindPayload.deepLink, /^https:\/\/t\.me\/Calor4_bot\?start=bind_/);
  const bindTtlMinutes = (new Date(bindPayload.expiresAt) - Date.now()) / 60_000;
  assert.ok(bindTtlMinutes > 29 && bindTtlMinutes <= 30);
  const bindHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer test-webhook-secret' };
  assert.equal((await fetch(`${baseUrl}/api/telegram/bind`, { method: 'POST', headers: bindHeaders, body: JSON.stringify({ token: bindToken, telegramUserId: '111' }) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/telegram/bind`, { method: 'POST', headers: bindHeaders, body: JSON.stringify({ token: bindToken, telegramUserId: '111' }) })).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/telegram/bind`, { method: 'POST', headers: bindHeaders, body: JSON.stringify({ token: 'random', telegramUserId: '222' }) })).status, 400);

  const alexBindResponse = await fetch(`${baseUrl}/api/telegram/bind-token`, { method: 'POST', headers: { Cookie: alexCookie } });
  const alexBindToken = (await alexBindResponse.json()).startPayload.slice(5);
  assert.equal((await fetch(`${baseUrl}/api/telegram/bind`, { method: 'POST', headers: bindHeaders, body: JSON.stringify({ token: alexBindToken, telegramUserId: '111' }) })).status, 409);

  const expired = 'expired-token';
  store.createBindToken('alex', crypto.createHash('sha256').update(expired).digest('hex'), new Date(Date.now() - 1000).toISOString());
  assert.equal((await fetch(`${baseUrl}/api/telegram/bind`, { method: 'POST', headers: bindHeaders, body: JSON.stringify({ token: expired, telegramUserId: '333' }) })).status, 400);

  const activity = { id: 'activity-1', provider: 'MANUAL', providerActivityId: 'provider-1', activityType: 'RUN', name: 'Run', startedAt: new Date().toISOString(), durationSeconds: 1800, estimatedEnergyKcal: 300, dataQuality: 'ESTIMATED' };
  store.insertActivity('dave', activity);
  store.insertActivity('dave', activity);
  assert.equal(store.listActivities('dave').filter(item => item.providerActivityId === 'provider-1').length, 1);

  const lockedAt = new Date('2030-01-01T21:00:00');
  const lockedPlan = await ensurePlan('dave', lockedAt);
  store.insertFood('dave', { ...entry, id: 'late-food', source: 'MANUAL', sugar: 0, sodium: 0, confidence: null, createdAt: '2030-01-01T22:00:00.000Z' });
  const unchangedPlan = await ensurePlan('dave', lockedAt);
  assert.equal(lockedPlan.status, 'LOCKED');
  assert.equal(unchangedPlan.generatedAt, lockedPlan.generatedAt);

  assert.equal((await fetch(`${baseUrl}/api/food`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/food`, { headers: { Authorization: 'Bearer test-webhook-secret', 'X-Calora-User': 'dave' } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/server.js`)).status, 404);
});
