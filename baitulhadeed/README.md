# Bait-ul-Hadeed Building Material (بیت الحدید بلڈنگ میٹیریل)

A one-page Urdu website for Bait-ul-Hadeed Building Material, Pasrur Road, Daska,
built from the shop's inauguration invitation (دعوتِ افتتاح). It's a static site on Firebase Hosting.

## Deploy to Firebase

1. Create a project at https://console.firebase.google.com (for example `baitulhadeed`).
2. If you picked a different project ID, put it in `.firebaserc`.
3. From this folder:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only hosting
   ```
   The site goes live at `https://<project-id>.web.app`.

## Local preview

```bash
npx serve public    # or: python3 -m http.server -d public
```

## Structure

```
public/
  index.html             the whole site (Urdu, right-to-left)
  assets/invitation.jpg  the invitation card
  assets/logo.jpg        logo cropped from the card
firebase.json            hosting config
```
