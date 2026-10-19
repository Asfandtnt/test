import { CATEGORIES, configured, fetchProducts, renderLayout, productCard, effectivePrice, esc } from "./common.js";

renderLayout();

const grid = document.getElementById("grid");
const featuredGrid = document.getElementById("featured-grid");
const chips = document.getElementById("chips");
const search = document.getElementById("search");
const sort = document.getElementById("sort");

let products = [];
let activeCat = new URLSearchParams(location.search).get("cat") || "All";

if (!configured) {
  document.getElementById("config-notice").innerHTML =
    `<div class="notice">Preview mode: showing sample products. Add your Firebase config in <code>js/firebase-config.js</code> to go live.</div>`;
}

function renderChips() {
  const used = new Set(products.map(p => p.category));
  const cats = ["All", ...CATEGORIES.filter(c => used.has(c)), ...[...used].filter(c => c && !CATEGORIES.includes(c))];
  chips.innerHTML = cats.map(c => `<button class="chip${c === activeCat ? " active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function renderGrid() {
  const q = search.value.trim().toLowerCase();
  let list = products.filter(p =>
    (activeCat === "All" || p.category === activeCat) &&
    (!q || `${p.name} ${p.code} ${p.category} ${p.fabric}`.toLowerCase().includes(q))
  );
  if (sort.value === "low") list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
  if (sort.value === "high") list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
  grid.innerHTML = list.length ? list.map(productCard).join("") : `<div class="empty">No products found.</div>`;
}

chips.addEventListener("click", e => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeCat = btn.dataset.cat;
  renderChips();
  renderGrid();
});
search.addEventListener("input", renderGrid);
sort.addEventListener("change", renderGrid);

try {
  products = await fetchProducts();
  const featured = products.filter(p => p.featured).slice(0, 4);
  const showcase = featured.length ? featured : products.slice(0, 4);
  featuredGrid.innerHTML = showcase.length ? showcase.map(productCard).join("") : `<div class="empty">New arrivals coming soon.</div>`;
  renderChips();
  renderGrid();
} catch (err) {
  console.error(err);
  grid.innerHTML = featuredGrid.innerHTML = `<div class="notice error">Could not load products. Please try again later.</div>`;
}
