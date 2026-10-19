import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const CATEGORIES = ["Lawn", "Cotton", "Khaddar", "Linen", "Karandi", "Chiffon", "Silk", "Wash & Wear"];

// When the config still holds placeholders the site runs on sample data so the
// design can be previewed before Firebase is set up.
export const configured = !String(firebaseConfig.apiKey).startsWith("YOUR_");
export const app = configured ? initializeApp(firebaseConfig) : null;
export const db = configured ? getFirestore(app) : null;

const DEMO_PRODUCTS = [
  { id: "demo-1", name: "Gulnar Embroidered Lawn", code: "WF-101", category: "Lawn", pieces: "3 Piece", price: 6490, salePrice: 5490, stock: 12, featured: true, fabric: "Lawn shirt, chiffon dupatta, cambric trouser", description: "Embroidered lawn front with printed back and sleeves.\nShirt 3.0m · Dupatta 2.5m · Trouser 2.5m" },
  { id: "demo-2", name: "Noor Printed Cotton", code: "WF-102", category: "Cotton", pieces: "2 Piece", price: 3990, salePrice: 0, stock: 20, featured: true, fabric: "Cotton shirt and trouser", description: "Soft breathable cotton for everyday wear." },
  { id: "demo-3", name: "Shehnai Winter Khaddar", code: "WF-103", category: "Khaddar", pieces: "3 Piece", price: 5790, salePrice: 0, stock: 0, featured: true, fabric: "Khaddar shirt, wool shawl, khaddar trouser", description: "Warm khaddar with digital print." },
  { id: "demo-4", name: "Zarlish Pure Linen", code: "WF-104", category: "Linen", pieces: "3 Piece", price: 7250, salePrice: 6490, stock: 8, featured: true, fabric: "Linen shirt, linen dupatta, dyed trouser", description: "Premium linen with a fine hand feel." },
  { id: "demo-5", name: "Mehr Karandi Classic", code: "WF-105", category: "Karandi", pieces: "3 Piece", price: 6990, salePrice: 0, stock: 5, featured: false, fabric: "Karandi shirt, karandi dupatta, trouser", description: "Classic karandi suit for winter." },
  { id: "demo-6", name: "Rooh Chiffon Festive", code: "WF-106", category: "Chiffon", pieces: "3 Piece", price: 12500, salePrice: 10990, stock: 4, featured: false, fabric: "Embroidered chiffon shirt, net dupatta, silk trouser", description: "Festive chiffon with hand-finished embroidery." }
].map((p, i) => ({ ...p, images: [], createdAt: { seconds: 1700000000 - i } }));

const DEFAULT_SETTINGS = { whatsapp: "", phone: "", email: "", deliveryFee: 250, freeDeliveryOver: 5000, announcement: "Free delivery on orders above Rs. 5,000 · Cash on Delivery across Pakistan" };

export async function fetchProducts() {
  if (!configured) return DEMO_PRODUCTS;
  const snap = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function fetchProduct(id) {
  if (!configured) return DEMO_PRODUCTS.find(p => p.id === id) || null;
  const snap = await getDoc(doc(db, "products", id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

let settingsPromise;
export function fetchSettings() {
  if (!settingsPromise) {
    settingsPromise = (async () => {
      if (!configured) return DEFAULT_SETTINGS;
      try {
        const snap = await getDoc(doc(db, "settings", "store"));
        return { ...DEFAULT_SETTINGS, ...(snap.exists() ? snap.data() : {}) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    })();
  }
  return settingsPromise;
}

// ---------- helpers ----------
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function money(n) {
  return "Rs. " + Math.round(Number(n) || 0).toLocaleString("en-PK");
}
export function effectivePrice(p) {
  return p.salePrice > 0 && p.salePrice < p.price ? p.salePrice : p.price;
}
export function priceHtml(p) {
  const now = effectivePrice(p);
  const was = now < p.price ? `<span class="was">${money(p.price)}</span>` : "";
  return `<div class="price"><span class="now">${money(now)}</span>${was}</div>`;
}
export function imageHtml(p, idx = 0) {
  const src = p.images && p.images[idx];
  return src
    ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy">`
    : `<div class="placeholder-img">${esc(p.category || "Wali Fabrics")}</div>`;
}
export function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2400);
}

// ---------- cart (localStorage) ----------
const CART_KEY = "wf_cart";
export function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; }
}
export function saveCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  updateCartCount();
}
export function addToCart(p, qty = 1) {
  const items = getCart();
  const existing = items.find(i => i.id === p.id);
  const max = Number(p.stock) || 99;
  if (existing) existing.qty = Math.min(existing.qty + qty, max);
  else items.push({ id: p.id, name: p.name, code: p.code || "", price: effectivePrice(p), image: (p.images && p.images[0]) || "", category: p.category || "", qty: Math.min(qty, max) });
  saveCart(items);
}
export function updateCartCount() {
  const n = getCart().reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll(".cart-count").forEach(el => (el.textContent = n));
}

// ---------- layout ----------
export async function renderLayout() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  if (header) {
    header.outerHTML = `
      <div class="announce" id="announce"></div>
      <header class="site-header">
        <div class="container">
          <a href="index.html" class="brand"><span class="brand-name">Wali Fabrics</span><span class="brand-tag">Unstitched Collection</span></a>
          <nav class="nav">
            <a href="index.html" class="nav-hide">Home</a>
            <a href="index.html#shop">Shop</a>
            <a href="index.html#contact" class="nav-hide">Contact</a>
            <a href="cart.html" class="cart-link">Bag <span class="cart-count">0</span></a>
          </nav>
        </div>
      </header>`;
  }
  if (footer) {
    footer.outerHTML = `
      <footer class="site-footer" id="contact">
        <div class="container">
          <div class="cols">
            <div>
              <div class="brand-name" style="font-family:var(--serif);font-size:1.8rem;font-weight:700">Wali Fabrics</div>
              <p>Premium unstitched lawn, cotton, khaddar, linen and festive fabrics — delivered to your door with Cash on Delivery.</p>
            </div>
            <div>
              <h4>Shop</h4>
              <ul>${CATEGORIES.slice(0, 5).map(c => `<li><a href="index.html?cat=${encodeURIComponent(c)}#shop">${c}</a></li>`).join("")}</ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul id="footer-contact"><li>Cash on Delivery nationwide</li></ul>
            </div>
          </div>
          <div class="copy">© ${new Date().getFullYear()} Wali Fabrics. All rights reserved.</div>
        </div>
      </footer>`;
  }
  updateCartCount();

  const s = await fetchSettings();
  const announce = document.getElementById("announce");
  if (announce) {
    if (s.announcement) announce.textContent = s.announcement;
    else announce.remove();
  }
  const contact = document.getElementById("footer-contact");
  if (contact) {
    const rows = [];
    if (s.phone) rows.push(`<li>📞 <a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></li>`);
    if (s.whatsapp) rows.push(`<li>💬 <a href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp us</a></li>`);
    if (s.email) rows.push(`<li>✉️ <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>`);
    rows.push("<li>Cash on Delivery nationwide</li>");
    contact.innerHTML = rows.join("");
  }
}

export function productCard(p) {
  const out = Number(p.stock) <= 0;
  const onSale = effectivePrice(p) < p.price;
  const badge = out ? `<span class="badge out">Sold out</span>` : onSale ? `<span class="badge">Sale</span>` : "";
  return `
    <a class="card" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="card-media">${imageHtml(p)}${badge}</div>
      <div class="card-body">
        <span class="card-cat">${esc(p.category)}</span>
        <h3 class="card-title">${esc(p.name)}</h3>
        <span class="card-meta">${esc(p.pieces || "")}${p.code ? " · " + esc(p.code) : ""}</span>
        ${priceHtml(p)}
      </div>
    </a>`;
}
