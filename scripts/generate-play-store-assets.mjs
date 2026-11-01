import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { openBrowser } from '../videos/scripts/browser.mjs';

const OUT_PUBLIC = join(process.cwd(), 'public', 'play-store');
const OUT_MOBILE = join(process.cwd(), 'mobile', 'assets', 'play-store');

mkdirSync(OUT_PUBLIC, { recursive: true });
mkdirSync(OUT_MOBILE, { recursive: true });

// Read logo as base64
const logoLightB64 = readFileSync(join(process.cwd(), 'public', 'branding', 'mitiendapy-horizontal-dark.png')).toString('base64');
const iconB64 = readFileSync(join(process.cwd(), 'mobile', 'assets', 'images', 'icon.png')).toString('base64');

async function launchBrowser() {
  return openBrowser();
}

// 1. Generate 512x512 Icon
async function generateIcon() {
  console.log('Generating 512x512 App Icon...');
  const iconPath = join(OUT_PUBLIC, '01-icono-512x512.png');
  await sharp(join(process.cwd(), 'mobile', 'assets', 'images', 'icon.png'))
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(iconPath);
  copyFileSync(iconPath, join(OUT_MOBILE, '01-icono-512x512.png'));
  console.log('✓ 01-icono-512x512.png created');
}

// 2. Generate Feature Graphic 1024x500
async function generateFeatureGraphic(browser) {
  console.log('Generating 1024x500 Feature Graphic...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 500, deviceScaleFactor: 1 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    width: 1024px;
    height: 500px;
    background: radial-gradient(circle at 75% 30%, rgba(37, 99, 235, 0.4) 0%, transparent 60%),
                radial-gradient(circle at 20% 80%, rgba(34, 211, 238, 0.25) 0%, transparent 50%),
                linear-gradient(135deg, #090e17 0%, #0d1b2a 45%, #12233f 100%);
    color: #ffffff;
    display: flex;
    overflow: hidden;
    position: relative;
  }
  .bg-grid {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }
  .left-content {
    flex: 1.15;
    padding: 48px 32px 48px 56px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    z-index: 10;
  }
  .logo-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }
  .logo-img {
    height: 44px;
    object-fit: contain;
  }
  .country-badge {
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: #38bdf8;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  h1 {
    font-size: 38px;
    font-weight: 900;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin-bottom: 12px;
    background: linear-gradient(180deg, #FFFFFF 0%, #CBD5E1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .highlight {
    background: linear-gradient(90deg, #38BDF8 0%, #60A5FA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p.desc {
    font-size: 16px;
    color: #94A3B8;
    line-height: 1.45;
    margin-bottom: 24px;
    max-width: 480px;
  }
  .badges-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    max-width: 490px;
  }
  .badge {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(8px);
    border-radius: 10px;
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #E2E8F0;
  }
  .badge svg {
    width: 16px;
    height: 16px;
    color: #38BDF8;
    flex-shrink: 0;
  }
  .right-mockup {
    flex: 0.85;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .phone-frame {
    width: 270px;
    height: 480px;
    background: #0f172a;
    border-radius: 36px;
    border: 4px solid #334155;
    box-shadow: -20px 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.2);
    transform: rotate(4deg) translateY(25px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }
  .phone-notch {
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px 16px;
    background: #0f172a;
  }
  .phone-camera {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #1e293b;
  }
  .phone-screen {
    flex: 1;
    background: #F8FAFC;
    color: #0F172A;
    padding: 12px;
    display: flex;
    flex-direction: column;
  }
  .screen-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .pos-title {
    font-size: 13px;
    font-weight: 800;
    color: #0F172A;
  }
  .pos-chip {
    background: #DCFCE7;
    color: #166534;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
  }
  .item-card {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 6px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .item-name { font-size: 11px; font-weight: 700; color: #1E293B; }
  .item-price { font-size: 11px; font-weight: 800; color: #2563EB; }
  .cart-box {
    margin-top: auto;
    background: #FFFFFF;
    border: 1px solid #CBD5E1;
    border-radius: 12px;
    padding: 10px;
  }
  .cart-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .cart-total-label { font-size: 11px; color: #64748B; font-weight: 600; }
  .cart-total-val { font-size: 14px; font-weight: 900; color: #0F172A; }
  .pay-btn {
    background: #2563EB;
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    padding: 8px;
    border-radius: 8px;
  }
  .floating-pill {
    position: absolute;
    bottom: 40px;
    left: 20px;
    background: #0f172a;
    border: 1px solid #38bdf8;
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    z-index: 20;
    transform: rotate(-3deg);
  }
</style>
</head>
<body>
  <div class="bg-grid"></div>

  <div class="left-content">
    <div class="logo-row">
      <img src="data:image/png;base64,${logoLightB64}" class="logo-img" alt="Mi Tienda" />
      <span class="country-badge">🇵🇾 Paraguay</span>
    </div>
    <h1>Tu negocio en tu bolsillo con <span class="highlight">POS e Inventario</span></h1>
    <p class="desc">Punto de venta rápido, control de stock en tiempo real, arqueo de caja diario y cobros con QR Bancard y transferencias.</p>

    <div class="badges-grid">
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
        <span>Punto de Venta (POS)</span>
      </div>
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        <span>Control de Stock y SKU</span>
      </div>
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <span>Arqueo y Cierre de Caja</span>
      </div>
      <div class="badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <span>Cobros con QR y Tarjeta</span>
      </div>
    </div>
  </div>

  <div class="right-mockup">
    <div class="phone-frame">
      <div class="phone-notch"><div class="phone-camera"></div></div>
      <div class="phone-screen">
        <div class="screen-header">
          <span class="pos-title">Mi Tienda POS</span>
          <span class="pos-chip">● Caja Abierta</span>
        </div>
        <div class="item-card">
          <div>
            <div class="item-name">Café Molido 250g</div>
            <div style="font-size: 10px; color: #64748B;">Cant: 1</div>
          </div>
          <div class="item-price">Gs. 28.000</div>
        </div>
        <div class="item-card">
          <div>
            <div class="item-name">Yerba Especial 500g</div>
            <div style="font-size: 10px; color: #64748B;">Cant: 1</div>
          </div>
          <div class="item-price">Gs. 14.500</div>
        </div>
        <div class="item-card">
          <div>
            <div class="item-name">Cargador Rápido 25W</div>
            <div style="font-size: 10px; color: #64748B;">Cant: 1</div>
          </div>
          <div class="item-price">Gs. 65.000</div>
        </div>
        <div class="cart-box">
          <div class="cart-total-row">
            <span class="cart-total-label">Total a cobrar</span>
            <span class="cart-total-val">Gs. 107.500</span>
          </div>
          <div class="pay-btn">Cobrar Gs. 107.500</div>
        </div>
      </div>
    </div>
    <div class="floating-pill">
      <span style="color: #22C55E;">✓</span> Cobro inmediato con QR & Efectivo
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const featurePath = join(OUT_PUBLIC, '02-imagen-destacada-1024x500.png');
  await page.screenshot({ path: featurePath, type: 'png' });
  copyFileSync(featurePath, join(OUT_MOBILE, '02-imagen-destacada-1024x500.png'));
  await page.close();
  console.log('✓ 02-imagen-destacada-1024x500.png created');
}

// 3. Generate Screenshot 1: POS (1080x2400)
async function generateScreenshotPOS(browser) {
  console.log('Generating Screenshot 1: POS (1080x2400)...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 2400, deviceScaleFactor: 1 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    width: 1080px;
    height: 2400px;
    background: #0B1120;
    color: #F8FAFC;
    display: flex;
    flex-direction: column;
    padding: 60px 48px;
    overflow: hidden;
    position: relative;
  }
  .header-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 36px;
    padding: 48px 44px;
    text-align: center;
    margin-bottom: 50px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  }
  .tag {
    display: inline-block;
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: #38bdf8;
    font-size: 20px;
    font-weight: 800;
    padding: 8px 24px;
    border-radius: 30px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 16px;
    color: #FFFFFF;
  }
  p.sub {
    font-size: 26px;
    color: #94A3B8;
    line-height: 1.4;
  }
  .mockup-container {
    flex: 1;
    background: #F8FAFC;
    border-radius: 56px;
    border: 8px solid #334155;
    box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #0F172A;
  }
  .status-bar {
    height: 60px;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    color: #0F172A;
    background: #F8FAFC;
  }
  .app-bar {
    padding: 20px 36px;
    background: #FFFFFF;
    border-bottom: 1px solid #E2E8F0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .branch-info h2 { font-size: 28px; font-weight: 900; color: #0F172A; }
  .branch-info span { font-size: 18px; color: #16A34A; font-weight: 700; }
  .pos-body {
    flex: 1;
    padding: 30px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .search-row {
    display: flex;
    gap: 16px;
  }
  .search-box {
    flex: 1;
    background: #FFFFFF;
    border: 2px solid #CBD5E1;
    border-radius: 20px;
    padding: 18px 24px;
    font-size: 22px;
    color: #64748B;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .scan-btn {
    background: #2563EB;
    border-radius: 20px;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  .categories-row {
    display: flex;
    gap: 12px;
    overflow: hidden;
  }
  .cat-pill {
    padding: 14px 26px;
    border-radius: 16px;
    font-size: 20px;
    font-weight: 700;
    white-space: nowrap;
  }
  .cat-pill.active { background: #2563EB; color: white; }
  .cat-pill.inactive { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; }
  .product-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .prod-card {
    background: #FFFFFF;
    border: 2px solid #E2E8F0;
    border-radius: 24px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
  }
  .prod-badge {
    align-self: flex-start;
    background: #EFF6FF;
    color: #2563EB;
    font-size: 15px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 8px;
    margin-bottom: 12px;
  }
  .prod-title { font-size: 23px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
  .prod-meta { font-size: 17px; color: #64748B; margin-bottom: 16px; }
  .prod-price { font-size: 26px; font-weight: 900; color: #2563EB; }
  .bottom-sheet {
    background: #FFFFFF;
    border-top: 2px solid #E2E8F0;
    padding: 32px 36px 40px;
    box-shadow: 0 -10px 30px rgba(0,0,0,0.06);
  }
  .cart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .cart-items-count { font-size: 22px; font-weight: 800; color: #0F172A; }
  .cart-total-big { font-size: 38px; font-weight: 900; color: #2563EB; }
  .methods-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }
  .method-chip {
    background: #F1F5F9;
    border: 1px solid #CBD5E1;
    border-radius: 14px;
    padding: 12px 6px;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    color: #334155;
  }
  .method-chip.selected {
    background: #EFF6FF;
    border-color: #2563EB;
    color: #2563EB;
  }
  .pay-button-big {
    background: linear-gradient(90deg, #2563EB 0%, #1D4ED8 100%);
    color: #FFFFFF;
    font-size: 26px;
    font-weight: 800;
    text-align: center;
    padding: 24px;
    border-radius: 20px;
    box-shadow: 0 10px 25px rgba(37, 99, 235, 0.35);
  }
</style>
</head>
<body>
  <div class="header-card">
    <div class="tag">PUNTO DE VENTA MÓVIL</div>
    <h1>Cobrá en segundos en tu mostrador</h1>
    <p class="sub">Efectivo con vuelto, tarjetas, transferencias SIPAP y QR Bancard</p>
  </div>

  <div class="mockup-container">
    <div class="status-bar">
      <span>09:41</span>
      <span>📶 5G 🔋 100%</span>
    </div>
    <div class="app-bar">
      <div class="branch-info">
        <h2>Sucursal Central Asunción</h2>
        <span>● Turno Mañana Abierto</span>
      </div>
      <img src="data:image/png;base64,${iconB64}" style="width: 48px; height: 48px; border-radius: 12px;" />
    </div>

    <div class="pos-body">
      <div class="search-row">
        <div class="search-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>Buscar por nombre o código...</span>
        </div>
        <div class="scan-btn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"></path><path d="M17 3h2a2 2 0 0 1 2 2v2"></path><path d="M21 17v2a2 2 0 0 1-2 2h-2"></path><path d="M7 21H5a2 2 0 0 1-2-2v-2"></path><line x1="7" y1="12" x2="17" y2="12"></line></svg>
        </div>
      </div>

      <div class="categories-row">
        <div class="cat-pill active">★ Frecuentes</div>
        <div class="cat-pill inactive">Bebidas</div>
        <div class="cat-pill inactive">Almacén</div>
        <div class="cat-pill inactive">Tecnología</div>
      </div>

      <div class="product-grid">
        <div class="prod-card" style="border-color: #2563EB; background: #F8FAFC;">
          <div>
            <div class="prod-badge" style="background: #2563EB; color: white;">2 en carrito</div>
            <div class="prod-title">Coca Cola 500ml Retornable</div>
            <div class="prod-meta">Stock: 48 un. • Bebidas</div>
          </div>
          <div class="prod-price">Gs. 6.000</div>
        </div>

        <div class="prod-card" style="border-color: #2563EB; background: #F8FAFC;">
          <div>
            <div class="prod-badge" style="background: #2563EB; color: white;">1 en carrito</div>
            <div class="prod-title">Café Molido Especial 250g</div>
            <div class="prod-meta">Stock: 14 un. • Almacén</div>
          </div>
          <div class="prod-price">Gs. 28.000</div>
        </div>

        <div class="prod-card" style="border-color: #2563EB; background: #F8FAFC;">
          <div>
            <div class="prod-badge" style="background: #2563EB; color: white;">1 en carrito</div>
            <div class="prod-title">Yerba Mate Tradicional 500g</div>
            <div class="prod-meta">Stock: 32 un. • Almacén</div>
          </div>
          <div class="prod-price">Gs. 14.500</div>
        </div>

        <div class="prod-card">
          <div>
            <div class="prod-badge">Stock disponible</div>
            <div class="prod-title">Cargador Rápido USB-C 25W</div>
            <div class="prod-meta">Stock: 8 un. • Accesorios</div>
          </div>
          <div class="prod-price">Gs. 65.000</div>
        </div>
      </div>
    </div>

    <div class="bottom-sheet">
      <div class="cart-header">
        <div>
          <div class="cart-items-count">🛒 4 productos seleccionados</div>
          <div style="font-size: 16px; color: #64748B; margin-top: 4px;">Cliente: Consumidor Final</div>
        </div>
        <div class="cart-total-big">Gs. 54.500</div>
      </div>

      <div class="methods-row">
        <div class="method-chip selected">💵 Efectivo</div>
        <div class="method-chip">📱 QR Bancard</div>
        <div class="method-chip">💳 Tarjeta</div>
        <div class="method-chip">🔄 Transferencia</div>
      </div>

      <div class="pay-button-big">
        Confirmar y Cobrar Gs. 54.500
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const posPath = join(OUT_PUBLIC, '03-captura-celular-pos-1080x2400.png');
  await page.screenshot({ path: posPath, type: 'png' });
  copyFileSync(posPath, join(OUT_MOBILE, '03-captura-celular-pos-1080x2400.png'));
  await page.close();
  console.log('✓ 03-captura-celular-pos-1080x2400.png created');
}

// 4. Generate Screenshot 2: Inventario (1080x2400)
async function generateScreenshotInventario(browser) {
  console.log('Generating Screenshot 2: Inventario (1080x2400)...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 2400, deviceScaleFactor: 1 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    width: 1080px;
    height: 2400px;
    background: #0B1120;
    color: #F8FAFC;
    display: flex;
    flex-direction: column;
    padding: 60px 48px;
    overflow: hidden;
    position: relative;
  }
  .header-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 36px;
    padding: 48px 44px;
    text-align: center;
    margin-bottom: 50px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  }
  .tag {
    display: inline-block;
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: #38bdf8;
    font-size: 20px;
    font-weight: 800;
    padding: 8px 24px;
    border-radius: 30px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 16px;
    color: #FFFFFF;
  }
  p.sub {
    font-size: 26px;
    color: #94A3B8;
    line-height: 1.4;
  }
  .mockup-container {
    flex: 1;
    background: #F8FAFC;
    border-radius: 56px;
    border: 8px solid #334155;
    box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #0F172A;
    position: relative;
  }
  .status-bar {
    height: 60px;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    color: #0F172A;
    background: #F8FAFC;
  }
  .app-bar {
    padding: 20px 36px;
    background: #FFFFFF;
    border-bottom: 1px solid #E2E8F0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .inventory-body {
    flex: 1;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .stats-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .stat-card {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 18px;
    padding: 16px;
    text-align: center;
  }
  .stat-num { font-size: 26px; font-weight: 900; color: #0F172A; }
  .stat-lbl { font-size: 14px; color: #64748B; font-weight: 600; margin-top: 4px; }
  .filters-row {
    display: flex;
    gap: 10px;
    overflow: hidden;
  }
  .filter-btn {
    padding: 12px 20px;
    border-radius: 14px;
    font-size: 18px;
    font-weight: 700;
    white-space: nowrap;
  }
  .filter-btn.active { background: #2563EB; color: white; }
  .filter-btn.inactive { background: #FFFFFF; border: 1px solid #CBD5E1; color: #475569; }
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .item-row {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 20px;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  }
  .item-left h3 { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 6px; }
  .item-meta { font-size: 16px; color: #64748B; display: flex; gap: 14px; }
  .badge-stock {
    font-size: 14px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 8px;
    display: inline-block;
  }
  .badge-in { background: #DCFCE7; color: #166534; }
  .badge-low { background: #FEF3C7; color: #92400E; }
  .badge-out { background: #FEE2E2; color: #991B1B; }
  .item-right { text-align: right; }
  .item-price-main { font-size: 24px; font-weight: 900; color: #2563EB; }
  .item-cost { font-size: 15px; color: #94A3B8; margin-top: 4px; }
  .fab {
    position: absolute;
    bottom: 40px;
    right: 40px;
    background: #2563EB;
    color: white;
    font-size: 22px;
    font-weight: 800;
    padding: 18px 32px;
    border-radius: 40px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 30px rgba(37, 99, 235, 0.4);
  }
</style>
</head>
<body>
  <div class="header-card">
    <div class="tag">CONTROL DE INVENTARIO</div>
    <h1>Stock actualizado al instante con alertas</h1>
    <p class="sub">Control de existencias, aviso de reposición y escaneo de código de barras</p>
  </div>

  <div class="mockup-container">
    <div class="status-bar">
      <span>09:41</span>
      <span>📶 5G 🔋 100%</span>
    </div>
    <div class="app-bar">
      <div>
        <h2 style="font-size: 28px; font-weight: 900;">Catálogo de Productos</h2>
        <span style="font-size: 18px; color: #64748B;">148 artículos registrados</span>
      </div>
      <img src="data:image/png;base64,${iconB64}" style="width: 48px; height: 48px; border-radius: 12px;" />
    </div>

    <div class="inventory-body">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-num" style="color: #16A34A;">141</div>
          <div class="stat-lbl">En Stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: #D97706;">5</div>
          <div class="stat-lbl">Bajo Stock</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: #DC2626;">2</div>
          <div class="stat-lbl">Agotados</div>
        </div>
      </div>

      <div class="filters-row">
        <div class="filter-btn active">Todos (148)</div>
        <div class="filter-btn inactive">⚠️ Bajo Stock (5)</div>
        <div class="filter-btn inactive">🚫 Sin Stock (2)</div>
        <div class="filter-btn inactive">🏷️ Ofertas (12)</div>
      </div>

      <div class="items-list">
        <div class="item-row">
          <div class="item-left">
            <h3>Cargador Rápido USB-C 25W</h3>
            <div class="item-meta">
              <span class="badge-stock badge-low">⚠️ Quedan 3 un. (Mín: 5)</span>
              <span>SKU: ELEC-0042</span>
            </div>
          </div>
          <div class="item-right">
            <div class="item-price-main">Gs. 65.000</div>
            <div class="item-cost">Costo: Gs. 35.000</div>
          </div>
        </div>

        <div class="item-row">
          <div class="item-left">
            <h3>Aceite de Oliva Extra Virgen 500ml</h3>
            <div class="item-meta">
              <span class="badge-stock badge-in">✓ 24 un. en stock</span>
              <span>SKU: ALM-0118</span>
            </div>
          </div>
          <div class="item-right">
            <div class="item-price-main">Gs. 42.000</div>
            <div class="item-cost">Costo: Gs. 28.000</div>
          </div>
        </div>

        <div class="item-row">
          <div class="item-left">
            <h3>Yerba Mate Tradicional 1kg</h3>
            <div class="item-meta">
              <span class="badge-stock badge-in">✓ 40 un. en stock</span>
              <span>SKU: ALM-0089</span>
            </div>
          </div>
          <div class="item-right">
            <div class="item-price-main">Gs. 26.500</div>
            <div class="item-cost">Costo: Gs. 18.000</div>
          </div>
        </div>

        <div class="item-row">
          <div class="item-left">
            <h3>Funda Silicona Antigolpes</h3>
            <div class="item-meta">
              <span class="badge-stock badge-out">🚫 0 un. (Agotado)</span>
              <span>SKU: ACC-0305</span>
            </div>
          </div>
          <div class="item-right">
            <div class="item-price-main">Gs. 25.000</div>
            <div class="item-cost">Costo: Gs. 12.000</div>
          </div>
        </div>
      </div>
    </div>

    <div class="fab">
      <span style="font-size: 26px;">+</span> Cargar Producto
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const invPath = join(OUT_PUBLIC, '04-captura-celular-inventario-1080x2400.png');
  await page.screenshot({ path: invPath, type: 'png' });
  copyFileSync(invPath, join(OUT_MOBILE, '04-captura-celular-inventario-1080x2400.png'));
  await page.close();
  console.log('✓ 04-captura-celular-inventario-1080x2400.png created');
}

// 5. Generate Screenshot 3: Caja (1080x2400)
async function generateScreenshotCaja(browser) {
  console.log('Generating Screenshot 3: Caja (1080x2400)...');
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 2400, deviceScaleFactor: 1 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    width: 1080px;
    height: 2400px;
    background: #0B1120;
    color: #F8FAFC;
    display: flex;
    flex-direction: column;
    padding: 60px 48px;
    overflow: hidden;
    position: relative;
  }
  .header-card {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 36px;
    padding: 48px 44px;
    text-align: center;
    margin-bottom: 50px;
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  }
  .tag {
    display: inline-block;
    background: rgba(34, 211, 238, 0.15);
    border: 1px solid rgba(34, 211, 238, 0.35);
    color: #38bdf8;
    font-size: 20px;
    font-weight: 800;
    padding: 8px 24px;
    border-radius: 30px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  h1 {
    font-size: 52px;
    font-weight: 900;
    line-height: 1.15;
    margin-bottom: 16px;
    color: #FFFFFF;
  }
  p.sub {
    font-size: 26px;
    color: #94A3B8;
    line-height: 1.4;
  }
  .mockup-container {
    flex: 1;
    background: #F8FAFC;
    border-radius: 56px;
    border: 8px solid #334155;
    box-shadow: 0 30px 80px rgba(0,0,0,0.6);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    color: #0F172A;
  }
  .status-bar {
    height: 60px;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    color: #0F172A;
    background: #F8FAFC;
  }
  .app-bar {
    padding: 20px 36px;
    background: #FFFFFF;
    border-bottom: 1px solid #E2E8F0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .caja-body {
    flex: 1;
    padding: 28px 36px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .hero-balance {
    background: linear-gradient(135deg, #0F172A 0%, #1E3A8A 100%);
    border-radius: 28px;
    padding: 32px;
    color: #FFFFFF;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.2);
  }
  .balance-lbl { font-size: 18px; font-weight: 700; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase; }
  .balance-val { font-size: 52px; font-weight: 900; color: #FFFFFF; margin: 8px 0 24px; }
  .breakdown-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 16px;
  }
  .break-item { text-align: center; }
  .break-item .num { font-size: 20px; font-weight: 800; color: #FFFFFF; }
  .break-item .name { font-size: 14px; color: #CBD5E1; margin-top: 4px; }
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .action-btn {
    background: #FFFFFF;
    border: 2px solid #E2E8F0;
    border-radius: 20px;
    padding: 20px;
    text-align: center;
    font-size: 18px;
    font-weight: 800;
    color: #0F172A;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .action-btn.green { border-color: #BBF7D0; color: #166534; background: #F0FDF4; }
  .action-btn.red { border-color: #FECACA; color: #991B1B; background: #FEF2F2; }
  .movements-section h3 {
    font-size: 24px;
    font-weight: 900;
    color: #0F172A;
    margin-bottom: 14px;
  }
  .movements-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .movement-card {
    background: #FFFFFF;
    border: 1px solid #E2E8F0;
    border-radius: 18px;
    padding: 18px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .mov-title { font-size: 20px; font-weight: 800; color: #0F172A; margin-bottom: 4px; }
  .mov-meta { font-size: 15px; color: #64748B; }
  .mov-amount { font-size: 24px; font-weight: 900; }
  .mov-amount.plus { color: #16A34A; }
  .mov-amount.minus { color: #DC2626; }
  .bottom-box {
    background: #FFFFFF;
    border-top: 2px solid #E2E8F0;
    padding: 24px 36px 36px;
  }
  .close-cash-btn {
    background: #0F172A;
    color: #FFFFFF;
    font-size: 24px;
    font-weight: 800;
    text-align: center;
    padding: 22px;
    border-radius: 20px;
  }
</style>
</head>
<body>
  <div class="header-card">
    <div class="tag">CONTROL Y CUADRE DE CAJA</div>
    <h1>Arqueo diario transparente y sin diferencias</h1>
    <p class="sub">Apertura, cierre, balance por medio de pago y registro de cada guaraní</p>
  </div>

  <div class="mockup-container">
    <div class="status-bar">
      <span>09:41</span>
      <span>📶 5G 🔋 100%</span>
    </div>
    <div class="app-bar">
      <div>
        <h2 style="font-size: 28px; font-weight: 900;">Caja Registradora</h2>
        <span style="font-size: 18px; color: #16A34A; font-weight: 700;">● Turno Mañana Abierto</span>
      </div>
      <img src="data:image/png;base64,${iconB64}" style="width: 48px; height: 48px; border-radius: 12px;" />
    </div>

    <div class="caja-body">
      <div class="hero-balance">
        <div class="balance-lbl">Saldo Total en Caja</div>
        <div class="balance-val">Gs. 2.845.000</div>
        <div class="breakdown-row">
          <div class="break-item">
            <div class="num">Gs. 1.620.000</div>
            <div class="name">💵 Efectivo</div>
          </div>
          <div class="break-item">
            <div class="num">Gs. 850.000</div>
            <div class="name">📱 QR Bancard</div>
          </div>
          <div class="break-item">
            <div class="num">Gs. 375.000</div>
            <div class="name">💳 Tarjetas</div>
          </div>
        </div>
      </div>

      <div class="actions-grid">
        <div class="action-btn green">
          <span style="font-size: 28px;">📥</span>
          <span>+ Ingreso</span>
        </div>
        <div class="action-btn red">
          <span style="font-size: 28px;">📤</span>
          <span>− Egreso</span>
        </div>
        <div class="action-btn">
          <span style="font-size: 28px;">🪙</span>
          <span>Arqueo</span>
        </div>
      </div>

      <div class="movements-section">
        <h3>Últimos Movimientos del Turno</h3>
        <div class="movements-list">
          <div class="movement-card">
            <div>
              <div class="mov-title">Venta POS #1289</div>
              <div class="mov-meta">11:24 • Efectivo en caja</div>
            </div>
            <div class="mov-amount plus">+ Gs. 54.500</div>
          </div>

          <div class="movement-card">
            <div>
              <div class="mov-title">Venta POS #1288</div>
              <div class="mov-meta">11:15 • QR Bancard acreditado</div>
            </div>
            <div class="mov-amount plus">+ Gs. 120.000</div>
          </div>

          <div class="movement-card">
            <div>
              <div class="mov-title">Egreso: Insumos de Limpieza</div>
              <div class="mov-meta">10:48 • Comprobante #0492</div>
            </div>
            <div class="mov-amount minus">− Gs. 35.000</div>
          </div>

          <div class="movement-card">
            <div>
              <div class="mov-title">Apertura de Caja</div>
              <div class="mov-meta">08:00 • Fondo inicial de cambio</div>
            </div>
            <div class="mov-amount" style="color: #2563EB;">Gs. 300.000</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-box">
      <div class="close-cash-btn">
        Cerrar Caja & Imprimir Arqueo
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'load' });
  const cajaPath = join(OUT_PUBLIC, '05-captura-celular-caja-1080x2400.png');
  await page.screenshot({ path: cajaPath, type: 'png' });
  copyFileSync(cajaPath, join(OUT_MOBILE, '05-captura-celular-caja-1080x2400.png'));
  await page.close();
  console.log('✓ 05-captura-celular-caja-1080x2400.png created');
}

async function main() {
  await generateIcon();
  const browser = await launchBrowser();
  try {
    await generateFeatureGraphic(browser);
    await generateScreenshotPOS(browser);
    await generateScreenshotInventario(browser);
    await generateScreenshotCaja(browser);
  } finally {
    await browser.close();
  }
  console.log('\nAll Google Play Store assets successfully generated!');
}

main().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
