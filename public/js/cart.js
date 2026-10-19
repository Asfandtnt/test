import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, configured, fetchSettings, renderLayout, getCart, saveCart, money, esc } from "./common.js";

renderLayout();

const list = document.getElementById("cart-items");
const panel = document.getElementById("checkout-panel");
const form = document.getElementById("checkout");
const msg = document.getElementById("checkout-msg");
const settings = await fetchSettings();

function totals(items) {
  const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  const free = settings.freeDeliveryOver > 0 && sub >= settings.freeDeliveryOver;
  const delivery = items.length && !free ? Number(settings.deliveryFee) || 0 : 0;
  return { sub, delivery, total: sub + delivery };
}

function render() {
  const items = getCart();
  if (!items.length) {
    list.innerHTML = `<div class="empty"><p>Your bag is empty.</p><a class="btn" href="index.html#shop">Continue shopping</a></div>`;
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  list.innerHTML = items.map((i, idx) => `
    <div class="cart-item">
      ${i.image ? `<img src="${esc(i.image)}" alt="">` : `<div class="placeholder-img">${esc(i.category)}</div>`}
      <div>
        <h4><a href="product.html?id=${encodeURIComponent(i.id)}">${esc(i.name)}</a></h4>
        <div class="card-meta">${esc(i.code)} · ${money(i.price)}</div>
        <div class="qty" style="margin-top:8px">
          <button data-act="dec" data-idx="${idx}" aria-label="Decrease">−</button>
          <input value="${i.qty}" readonly aria-label="Quantity">
          <button data-act="inc" data-idx="${idx}" aria-label="Increase">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:600">${money(i.price * i.qty)}</div>
        <button class="link-btn" data-act="rm" data-idx="${idx}">Remove</button>
      </div>
    </div>`).join("");
  const t = totals(items);
  document.getElementById("sum-sub").textContent = money(t.sub);
  document.getElementById("sum-del").textContent = t.delivery ? money(t.delivery) : "Free";
  document.getElementById("sum-total").textContent = money(t.total);
}

list.addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const items = getCart();
  const i = items[+btn.dataset.idx];
  if (!i) return;
  if (btn.dataset.act === "inc") i.qty++;
  if (btn.dataset.act === "dec") i.qty = Math.max(1, i.qty - 1);
  if (btn.dataset.act === "rm") items.splice(+btn.dataset.idx, 1);
  saveCart(items);
  render();
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const items = getCart();
  if (!items.length) return;
  const val = id => document.getElementById(id).value.trim();
  const customer = { name: val("c-name"), phone: val("c-phone"), city: val("c-city"), address: val("c-address"), notes: val("c-notes") };
  const t = totals(items);
  const btn = document.getElementById("place");

  if (!configured) {
    msg.innerHTML = `<div class="notice">Preview mode: connect Firebase to accept real orders.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Placing order…";
  try {
    const ref = await addDoc(collection(db, "orders"), {
      customer,
      items: items.map(({ id, name, code, price, qty }) => ({ id, name, code, price, qty })),
      subtotal: t.sub,
      delivery: t.delivery,
      total: t.total,
      payment: "COD",
      status: "new",
      createdAt: serverTimestamp()
    });
    saveCart([]);
    const orderNo = ref.id.slice(0, 8).toUpperCase();
    const wa = settings.whatsapp
      ? `<p><a class="btn btn-outline btn-sm" target="_blank" rel="noopener" href="https://wa.me/${settings.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi Wali Fabrics, I just placed order #${orderNo}.`)}">Confirm on WhatsApp</a></p>`
      : "";
    document.querySelector(".cart-layout").innerHTML = `
      <section class="panel" style="grid-column:1/-1;text-align:center;padding:48px 24px">
        <h2 style="color:var(--emerald)">Thank you, ${esc(customer.name)}!</h2>
        <p>Your order <b>#${orderNo}</b> has been placed. We will call you on ${esc(customer.phone)} to confirm.</p>
        <p>Amount payable on delivery: <b>${money(t.total)}</b></p>
        ${wa}
        <a class="btn" href="index.html">Continue shopping</a>
      </section>`;
  } catch (err) {
    console.error(err);
    msg.innerHTML = `<div class="notice error">Could not place your order. Please try again.</div>`;
    btn.disabled = false;
    btn.textContent = "Place Order";
  }
});

render();
