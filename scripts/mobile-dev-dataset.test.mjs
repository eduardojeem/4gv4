import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLocalSeedTarget,
  buildSeedSql,
  getMobileDevDataset,
} from './mobile-dev-dataset.mjs';

const TEST_USERS = {
  owner: '10000000-0000-4000-8000-000000000001',
  seller: '10000000-0000-4000-8000-000000000002',
  technician: '10000000-0000-4000-8000-000000000003',
};

test('dataset is a complete, deterministic DEV fixture set', () => {
  const data = getMobileDevDataset();
  assert.equal(data.categories.length, 6);
  assert.equal(data.products.length, 30);
  assert.equal(data.variants.length, 12);
  assert.equal(data.customers.length, 10);
  assert.equal(data.repairs.length, 10);
  assert.equal(data.sales.length, 12);
  assert.equal(data.saleItems.length, 24);
  assert.equal(data.branches.length, 2);
  assert.equal(data.userBranchAssignments.length, 5);
  assert.equal(data.cash.sessions.length, 2);
  assert.equal(data.cash.movements.length, 14);
  assert.equal(data.products.filter((product) => product.visibility === 'public').length, 24);
  assert.equal(data.products.filter((product) => product.visibility === 'hidden').length, 6);
  assert.ok(data.products.filter((product) => product.visibility === 'public').every((product) =>
    !product.has_variants && data.finalBranchInventory.some((inventory) => inventory.product_id === product.id && inventory.stock_quantity > 0)));
  assert.ok(data.products.filter((product) => product.has_variants).every((product) => product.visibility === 'hidden'));
  assert.equal(getMobileDevDataset().organization.marketplace_public, true);
  assert.equal(getMobileDevDataset().organization.storefront_public, true);
  assert.equal(new Set(data.products.map((product) => product.id)).size, 30);
  assert.ok(data.products.every((product) => product.sku.startsWith('DEV-')));
});

test('product fixtures map to generated category images and seed public local URLs', () => {
  const data = getMobileDevDataset();
  const imageAssets = ['celulares.png', 'accesorios.png', 'cargadores.png', 'cables.png', 'audio.png', 'repuestos.png'];
  assert.ok(data.products.every((product) => imageAssets.includes(product.image_asset)));
  assert.deepEqual(new Set(data.products.map((product) => product.image_asset)).size, 6);

  const sql = buildSeedSql(TEST_USERS, {
    productImageBaseUrl: 'http://192.168.1.10:55321/storage/v1/object/public/dev-product-images',
  });
  assert.match(sql, /image_url/);
  for (const imageAsset of imageAssets) {
    assert.ok(sql.includes(`http://192.168.1.10:55321/storage/v1/object/public/dev-product-images/dev-fixtures/products/${imageAsset}`));
  }
  assert.throws(() => buildSeedSql(TEST_USERS, {
    productImageBaseUrl: 'https://cswtugmwazxdktntndpy.supabase.co/storage/v1/object/public/dev-product-images',
  }), /Storage local aislado/);
});

test('cost fixtures keep legitimate zero distinct from unknown and foreign cost unset', () => {
  const data = getMobileDevDataset();
  assert.ok(data.products.some((product) => product.purchase_price === 0));
  assert.ok(data.products.some((product) => product.purchase_price === null));
  assert.ok(data.products.every((product) => product.foreign_purchase_price === null));
  assert.ok(data.variants.every((variant) => variant.purchase_price > 0));
});

test('generated SQL is deterministic, idempotent, and never deletes existing data', () => {
  const sql = buildSeedSql(TEST_USERS);
  assert.equal(sql, buildSeedSql(TEST_USERS));
  assert.match(sql, /ON CONFLICT/);
  assert.doesNotMatch(sql, /\b(DELETE|TRUNCATE|DROP)\b/i);
  assert.match(sql, /marketplace_public[\s\S]{0,200}TRUE, TRUE/i);
  assert.match(sql, /storefront_public/);
  assert.match(sql, /purchase_price[\s\S]*NULL/i);
  assert.match(sql, /'MiTiendaPy Demo'.*'10000000-0000-4000-8000-000000000001'/);
  assert.match(sql, /INSERT INTO public\.user_branch_assignments/);
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM public\.user_branch_assignments WHERE user_id/);
  assert.match(sql, /is_primary IS NOT DISTINCT FROM/);
  assert.doesNotMatch(sql, /INSERT INTO public\.user_branch_assignments[\s\S]{0,500}ON CONFLICT/i);
});

test('seed destination accepts only the verified isolated local stack', () => {
  assert.equal(assertLocalSeedTarget({
    supabaseUrl: 'http://127.0.0.1:55321',
    localProjectId: 'mitiendapy-mobile-dev',
    containerProjectId: 'mitiendapy-mobile-dev',
    databaseHealthy: true,
    remoteReferenceDetected: false,
  }), true);

  for (const supabaseUrl of [
    'https://cswtugmwazxdktntndpy.supabase.co',
    'https://yjrltxeccaoyyvfajafl.supabase.co',
    'http://192.168.0.5:55321',
    'http://localhost:54321',
  ]) {
    assert.throws(() => assertLocalSeedTarget({
      supabaseUrl,
      localProjectId: 'mitiendapy-mobile-dev',
      containerProjectId: 'mitiendapy-mobile-dev',
      databaseHealthy: true,
      remoteReferenceDetected: false,
    }));
  }

  assert.throws(() => assertLocalSeedTarget({
    supabaseUrl: 'http://127.0.0.1:55321',
    localProjectId: 'mitiendapy-mobile-dev',
    containerProjectId: 'unexpected-stack',
    databaseHealthy: true,
    remoteReferenceDetected: false,
  }));
  assert.throws(() => assertLocalSeedTarget({
    supabaseUrl: 'http://127.0.0.1:55321',
    localProjectId: 'mitiendapy-mobile-dev',
    containerProjectId: 'mitiendapy-mobile-dev',
    databaseHealthy: true,
    remoteReferenceDetected: true,
  }));
});
