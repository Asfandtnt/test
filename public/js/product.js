import { fetchProduct, fetchSettings, renderLayout, priceHtml, imageHtml, addToCart, esc, money, effectivePrice, toast } from "./common.js";

renderLayout();

const root = document.getElementById("product");
const id = new URLSearchParams(location.search).get("id");

const p = id ? await fetchProduct(id).catch(() => null) : null;

if (!p) {
  root.innerHTML = `<div class="empty"><h2>Product not found</h2><a class="btn" href="index.html#shop">Back to shop</a></div>`;
} else {
  document.title = `${p.name} — Wali Fabrics`;
  const images = p.images || [];
  const out = Number(p.stock) <= 0;
  const specs = [
    ["Code", p.code], ["Fabric", p.category], ["Pieces", p.pieces], ["Includes", p.fabric],
    ["Availability", out ? "Sold out" : `In stock (${p.stock})`]
  ].filter(([, v]) => v !== undefined && v !== "");

  root.innerHTML = `
    <div class="product-page">
      <div>
        <div class="gallery-main" id="main-img">${imageHtml(p, 0)}</div>
        ${images.length > 1 ? `<div class="thumbs">${images.map((src, i) =>
          `<button data-i="${i}" class="${i === 0 ? "active" : ""}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="product-info">
        <span class="card-cat">${esc(p.category)}</span>
        <h1>${esc(p.name)}</h1>
        ${priceHtml(p)}
        <ul class="specs">${specs.map(([k, v]) => `<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join("")}</ul>
        <div class="buy-row">
          <div class="qty">
            <button type="button" id="dec" aria-label="Decrease">−</button>
            <input id="qty" type="number" min="1" value="1" aria-label="Quantity">
            <button type="button" id="inc" aria-label="Increase">+</button>
          </div>
          <button class="btn" id="add" ${out ? "disabled" : ""}>${out ? "Sold out" : "Add to bag"}</button>
          <a class="btn btn-outline hidden" id="wa" target="_blank" rel="noopener">Order on WhatsApp</a>
        </div>
        ${p.description ? `<h3>Details</h3><p class="description">${esc(p.description)}</p>` : ""}
      </div>
    </div>`;

  const qty = document.getElementById("qty");
  const max = Math.max(1, Number(p.stock) || 1);
  const clamp = v => Math.min(max, Math.max(1, Number(v) || 1));
  document.getElementById("dec").onclick = () => (qty.value = clamp(+qty.value - 1));
  document.getElementById("inc").onclick = () => (qty.value = clamp(+qty.value + 1));
  qty.onchange = () => (qty.value = clamp(qty.value));
  document.getElementById("add").onclick = () => {
    addToCart(p, clamp(qty.value));
    toast("Added to your bag");
  };

  root.querySelector(".thumbs")?.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    root.querySelectorAll(".thumbs button").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("main-img").innerHTML = imageHtml(p, +btn.dataset.i);
  });

  const s = await fetchSettings();
  if (s.whatsapp && !out) {
    const wa = document.getElementById("wa");
    const text = `Assalam o Alaikum! I'd like to order: ${p.name}${p.code ? ` (${p.code})` : ""} — ${money(effectivePrice(p))}\n${location.href}`;
    wa.href = `https://wa.me/${s.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    wa.classList.remove("hidden");
  }
}
