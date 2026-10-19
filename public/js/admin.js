import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, db, configured, CATEGORIES, fetchProducts, esc, money, effectivePrice, toast } from "./common.js";

const $ = id => document.getElementById(id);
const show = (el, on) => el.classList.toggle("hidden", !on);
const note = (el, text, kind = "") => (el.innerHTML = text ? `<div class="notice ${kind}">${esc(text)}</div>` : "");

if (!configured) {
  note($("notice"), "Firebase is not configured yet. Add your project config to public/js/firebase-config.js, then reload this page.", "error");
  throw new Error("Firebase not configured");
}

const auth = getAuth(app);
let products = [];
let orders = [];
let images = [];      // data URLs for the product being edited
let editingId = null;

$("p-cat").innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join("");

// ---------- auth ----------
onAuthStateChanged(auth, async user => {
  note($("notice"), "");
  show($("logout"), !!user);
  if (!user) {
    show($("login-view"), true);
    show($("dash-view"), false);
    return;
  }
  const adminDoc = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  if (!adminDoc || !adminDoc.exists()) {
    show($("login-view"), false);
    show($("dash-view"), false);
    note($("notice"), `Signed in as ${user.email}, but this account is not an admin. In Firestore, create a document admins/${user.uid} (any fields) to grant access.`, "error");
    return;
  }
  show($("login-view"), false);
  show($("dash-view"), true);
  loadAll();
});

$("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  note($("login-msg"), "");
  try {
    await signInWithEmailAndPassword(auth, $("l-email").value.trim(), $("l-pass").value);
  } catch (err) {
    note($("login-msg"), "Sign in failed: check your email and password.", "error");
  }
});
$("logout").onclick = () => signOut(auth);

// ---------- tabs ----------
document.querySelector(".tabs").addEventListener("click", e => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
  document.querySelectorAll("[data-panel]").forEach(p => show(p, p.dataset.panel === tab.dataset.tab));
});

async function loadAll() {
  await Promise.all([loadProducts(), loadOrders(), loadSettings()]);
}

function renderStats() {
  $("st-products").textContent = products.length;
  $("st-stock").textContent = products.filter(p => Number(p.stock) <= 0).length;
  $("st-new").textContent = orders.filter(o => o.status === "new").length;
  $("st-sales").textContent = money(orders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0));
}

// ---------- products ----------
async function loadProducts() {
  products = await fetchProducts();
  renderProducts();
  renderStats();
}

function renderProducts() {
  const q = $("p-search").value.trim().toLowerCase();
  const list = products.filter(p => !q || `${p.name} ${p.code} ${p.category}`.toLowerCase().includes(q));
  $("product-rows").innerHTML = list.length ? list.map(p => `
    <tr>
      <td>${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="">` : ""}</td>
      <td><b>${esc(p.name)}</b><br><span class="card-meta">${esc(p.code || "")}${p.featured ? " · ★ New arrival" : ""}</span></td>
      <td>${esc(p.category)}<br><span class="card-meta">${esc(p.pieces || "")}</span></td>
      <td>${money(effectivePrice(p))}${effectivePrice(p) < p.price ? `<br><span class="card-meta" style="text-decoration:line-through">${money(p.price)}</span>` : ""}</td>
      <td>${Number(p.stock) <= 0 ? `<span class="status cancelled">Sold out</span>` : esc(p.stock)}</td>
      <td><div class="actions">
        <button class="btn btn-outline btn-sm" data-edit="${esc(p.id)}">Edit</button>
        <button class="btn btn-danger btn-sm" data-del="${esc(p.id)}">Delete</button>
      </div></td>
    </tr>`).join("") : `<tr><td colspan="6" class="empty">No products yet — add your first one.</td></tr>`;
}
$("p-search").addEventListener("input", renderProducts);

$("product-rows").addEventListener("click", async e => {
  const editId = e.target.closest("[data-edit]")?.dataset.edit;
  const delId = e.target.closest("[data-del]")?.dataset.del;
  if (editId) startEdit(products.find(p => p.id === editId));
  if (delId) {
    const p = products.find(x => x.id === delId);
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "products", delId));
    toast("Product deleted");
    if (editingId === delId) resetForm();
    loadProducts();
  }
});

function startEdit(p) {
  editingId = p.id;
  $("form-title").textContent = "Edit product";
  $("p-name").value = p.name || "";
  $("p-code").value = p.code || "";
  if (p.category && !CATEGORIES.includes(p.category)) $("p-cat").insertAdjacentHTML("beforeend", `<option>${esc(p.category)}</option>`);
  $("p-cat").value = p.category || CATEGORIES[0];
  $("p-pieces").value = p.pieces || "3 Piece";
  $("p-stock").value = p.stock ?? 0;
  $("p-price").value = p.price ?? "";
  $("p-sale").value = p.salePrice || "";
  $("p-fabric").value = p.fabric || "";
  $("p-desc").value = p.description || "";
  $("p-featured").checked = !!p.featured;
  images = [...(p.images || [])];
  renderPreviews();
  show($("cancel-edit"), true);
  $("product-form").scrollIntoView({ behavior: "smooth" });
}

function resetForm() {
  editingId = null;
  $("product-form").reset();
  $("form-title").textContent = "Add product";
  images = [];
  renderPreviews();
  show($("cancel-edit"), false);
  note($("form-msg"), "");
}
$("cancel-edit").onclick = resetForm;

function renderPreviews() {
  $("previews").innerHTML = images.map((src, i) =>
    `<div class="pv"><img src="${esc(src)}" alt=""><button type="button" data-rm="${i}" title="Remove">×</button></div>`).join("");
}
$("previews").addEventListener("click", e => {
  const i = e.target.closest("[data-rm]")?.dataset.rm;
  if (i === undefined) return;
  images.splice(+i, 1);
  renderPreviews();
});

// Photos are resized in the browser and stored inside the product document, so
// the store runs on Firebase's free plan without Cloud Storage. Firestore
// documents are capped at 1 MB, so the combined size is kept under ~850 KB.
const MAX_IMAGES = 4;
const MAX_TOTAL = 850 * 1024;

function compress(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

$("p-images").addEventListener("change", async e => {
  const files = [...e.target.files].slice(0, MAX_IMAGES - images.length);
  if (e.target.files.length > files.length) toast(`Only ${MAX_IMAGES} photos per product`);
  for (const f of files) {
    try { images.push(await compress(f, 1000, 0.72)); } catch { toast(`Could not read ${f.name}`); }
  }
  e.target.value = "";
  renderPreviews();
});

const totalSize = arr => arr.reduce((s, x) => s + x.length, 0);

$("product-form").addEventListener("submit", async e => {
  e.preventDefault();
  const btn = $("save-btn");
  const price = Number($("p-price").value);
  const sale = Number($("p-sale").value) || 0;
  if (sale && sale >= price) return note($("form-msg"), "Sale price must be lower than the regular price.", "error");

  // Shrink photos further if they would push the document over the size limit.
  let imgs = images;
  for (const [side, q] of [[800, 0.65], [640, 0.6], [520, 0.55]]) {
    if (totalSize(imgs) <= MAX_TOTAL) break;
    imgs = await Promise.all(imgs.map(async src => {
      const blob = await (await fetch(src)).blob();
      return compress(blob, side, q);
    }));
  }
  if (totalSize(imgs) > MAX_TOTAL) return note($("form-msg"), "Photos are too large — please remove one and try again.", "error");

  const data = {
    name: $("p-name").value.trim(),
    code: $("p-code").value.trim(),
    category: $("p-cat").value,
    pieces: $("p-pieces").value,
    stock: Math.max(0, Math.floor(Number($("p-stock").value) || 0)),
    price,
    salePrice: sale,
    fabric: $("p-fabric").value.trim(),
    description: $("p-desc").value.trim(),
    featured: $("p-featured").checked,
    images: imgs,
    updatedAt: serverTimestamp()
  };

  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    if (editingId) await updateDoc(doc(db, "products", editingId), data);
    else await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
    toast(editingId ? "Product updated" : "Product added");
    resetForm();
    await loadProducts();
  } catch (err) {
    console.error(err);
    note($("form-msg"), "Save failed: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save product";
  }
});

// ---------- orders ----------
const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"];

async function loadOrders() {
  const snap = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
  orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderOrders();
  renderStats();
}

function renderOrders() {
  const f = $("o-filter").value;
  const list = orders.filter(o => !f || o.status === f);
  $("order-list").innerHTML = list.length ? list.map(o => {
    const c = o.customer || {};
    const when = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-PK") : "";
    return `
      <article class="order-card">
        <header>
          <div><b>#${esc(o.id.slice(0, 8).toUpperCase())}</b> <span class="status ${esc(o.status)}">${esc(o.status)}</span><br>
            <span class="card-meta">${esc(when)}</span></div>
          <div style="text-align:right"><b>${money(o.total)}</b><br><span class="card-meta">${esc(o.payment || "COD")} · delivery ${money(o.delivery)}</span></div>
        </header>
        <div><b>${esc(c.name)}</b> · <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a><br>
          ${esc(c.address)}, ${esc(c.city)}${c.notes ? `<br><i>Note: ${esc(c.notes)}</i>` : ""}</div>
        <ul>${(o.items || []).map(i => `<li>${esc(i.name)} ${i.code ? `(${esc(i.code)})` : ""} × ${esc(i.qty)} — ${money(i.price * i.qty)}</li>`).join("")}</ul>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select data-status="${esc(o.id)}" style="max-width:180px">
            ${STATUSES.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}
          </select>
          <button class="btn btn-danger btn-sm" data-del-order="${esc(o.id)}">Delete</button>
        </div>
      </article>`;
  }).join("") : `<div class="empty">No orders${f ? ` with status "${esc(f)}"` : " yet"}.</div>`;
}
$("o-filter").addEventListener("change", renderOrders);

$("order-list").addEventListener("change", async e => {
  const id = e.target.dataset.status;
  if (!id) return;
  await updateDoc(doc(db, "orders", id), { status: e.target.value });
  orders.find(o => o.id === id).status = e.target.value;
  toast("Order status updated");
  renderOrders();
  renderStats();
});
$("order-list").addEventListener("click", async e => {
  const id = e.target.dataset.delOrder;
  if (!id || !confirm("Delete this order permanently?")) return;
  await deleteDoc(doc(db, "orders", id));
  orders = orders.filter(o => o.id !== id);
  renderOrders();
  renderStats();
});

// ---------- settings ----------
async function loadSettings() {
  const snap = await getDoc(doc(db, "settings", "store"));
  const s = snap.exists() ? snap.data() : {};
  $("s-announce").value = s.announcement ?? "Free delivery on orders above Rs. 5,000 · Cash on Delivery across Pakistan";
  $("s-wa").value = s.whatsapp || "";
  $("s-phone").value = s.phone || "";
  $("s-email").value = s.email || "";
  $("s-fee").value = s.deliveryFee ?? 250;
  $("s-free").value = s.freeDeliveryOver ?? 5000;
}

$("settings-form").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await setDoc(doc(db, "settings", "store"), {
      announcement: $("s-announce").value.trim(),
      whatsapp: $("s-wa").value.replace(/\D/g, ""),
      phone: $("s-phone").value.trim(),
      email: $("s-email").value.trim(),
      deliveryFee: Number($("s-fee").value) || 0,
      freeDeliveryOver: Number($("s-free").value) || 0
    });
    note($("settings-msg"), "Settings saved.", "success");
  } catch (err) {
    note($("settings-msg"), "Save failed: " + err.message, "error");
  }
});
