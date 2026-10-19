# Wali Fabrics

Live at **https://walifabrics.web.app** (admin panel: https://walifabrics.web.app/admin).

An online store for unstitched clothes (lawn, cotton, khaddar, linen, karandi, chiffon and more), with an admin panel. It runs on **Firebase Hosting + Firestore + Firebase Auth** and works on the free Spark plan.

## Features

**Storefront**
- Emerald, ivory and gold theme with a hero section, New Arrivals, category filters, search and sorting
- Product pages with a photo gallery, sale prices, stock status and a WhatsApp order button
- Shopping bag (stored in the browser) and a Cash on Delivery checkout that saves the order to Firestore
- Delivery fee, free-delivery threshold and announcement bar, all editable by the admin

**Admin panel** (`/admin`)
- Email and password sign-in, limited to approved admin accounts
- Add, edit and delete products: name, code, category, pieces, price, sale price, stock, description, up to 4 photos, and a "New Arrival" flag
- Photos are compressed in the browser and stored in Firestore, so you don't need Cloud Storage or the paid Blaze plan
- Orders list with status tracking (new → confirmed → shipped → delivered / cancelled)
- Store settings: WhatsApp, phone, email, delivery fee, announcement
- Dashboard stats

Until Firebase is configured, the site runs in **preview mode** with sample products.

## Deploy to Firebase

1. **Create a project** at https://console.firebase.google.com.
2. **Enable Firestore**: Build → Firestore Database → Create database (production mode).
3. **Enable Auth**: Build → Authentication → Sign-in method → turn on **Email/Password**.
   Then under Users → **Add user**, add the admin's email and password.
4. **Add a web app**: Project settings → General → Your apps → `</>` (Web).
   Copy the config object into `public/js/firebase-config.js`.
5. **Set the project ID** in `.firebaserc` (already set to `walifabrics`).
6. **Install the CLI and deploy**:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy
   ```
   This deploys the site and the Firestore security rules. Your store goes live at `https://<project-id>.web.app`.
7. **Make yourself an admin**: open `https://<project-id>.web.app/admin` and sign in.
   The page will show your **UID**. In the Firestore console, create a collection called `admins`
   with a document whose **ID is that UID** (add any field, e.g. `name: "Owner"`). Reload the admin page.

## Local preview

```bash
npx serve public    # or: firebase serve / python3 -m http.server -d public
```

## Structure

```
public/
  index.html      home + shop
  product.html    product detail
  cart.html       bag + checkout
  admin.html      admin panel
  css/style.css   theme
  js/             app code (firebase-config.js holds your keys)
firestore.rules   public catalogue read; only admins can write; customers can only create orders
firebase.json     hosting + rules config
```

## Notes
- Prices in orders are calculated in the customer's browser. Check each order's total in the admin panel before you confirm it.
- Stock is not reduced automatically when an order comes in. Update stock in the admin panel when you confirm orders.
