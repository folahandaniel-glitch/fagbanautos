# Admin guide

Sign in at `/admin/login` (the small "Backend" link in the website footer goes there). New staff accounts use a one-time password and must set their own at first sign-in. Turn on two-factor authentication under **Profile**.

## Roles

Super Admin (everything) plus ten staff roles: Inventory, Sales, Finance, Customer Relations, Marketing, Content and SEO, Trade-in and Swap, Auto Care, Imports, Technical. The menu only shows what your role may open, and the server refuses anything else. Manage staff under **Staff and roles** (Super Admin only).

## Daily tasks

| Task | Where |
|---|---|
| Verify a bank transfer | Payments > filter "Awaiting verification" > view proof > Approve, Query or Reject. Payments at or above the two-person threshold need a second, different approver. |
| Release a vehicle | Orders > order > Update status. If the 90% threshold is not met the server refuses. Only the Super Admin can override, with a written reason. |
| Add or edit a vehicle/part | Inventory > Add / Edit. Photos can be uploaded or linked; real photos replace the generated placeholders. |
| Bulk upload stock | Excel import: download the template, fill it, upload, review the preview, import. |
| Approve a VAT exemption | VAT > pending requests. |
| Update a booking, import, trade-in, swap, finance application or lead | the matching item in the menu; the customer is notified in-app. |
| Change your password, email or 2FA | Click "Password and security" in the top bar (Profile). Each staff member changes their own; the Super Admin can also reset another staff member's password under Staff and roles. |
| Change business information | System settings (phone, email, address, social, branding, PWA, SEO, VAT, installment, payments). Changes are versioned and audited. |
| Add or change a bank account | System settings > Bank accounts. Add as many as you like; every active account is shown to customers. Only the Super Admin can change them; every change is audited. |
| Connect Paystack | System settings > Paystack: paste the public and secret keys, choose Test or Live, tick Enable, press "Save and test key", then set the webhook URL shown on that page in your Paystack dashboard. The secret is stored encrypted and never shown again. |
| Download an invoice, receipt or statement | Orders > order > Documents (also on the customer's order page). |
| Add a division | Divisions > Create. It appears in the switcher and footer immediately. |
| Edit pages, FAQs, menu, banners, coupons | Content (CMS). |
| Reports and Excel exports | Reports and exports. |

## Financial authority (Super Admin only)

VAT settings, installment rules, bank accounts, Paystack credentials, refund settings, global pricing, payment-status override and vehicle-release override. Every one of these is audited with before/after values and (for overrides) a mandatory reason.

## Things to do before launch

Replace placeholder bank accounts, add Paystack keys, enter real contact details, replace demo stock, have the legal pages reviewed. See `docs/DEPLOYMENT.md`.

## Photos, SKUs and website wording

- **SKU, inventory ID and stock number** are generated automatically (`VEH-000001`, `PRT-`, `ACC-`, `TEC-`, `SVC-`, `FAG-INV-000001`, `STK-2026-0001`). Type your own in the field to override.
- **Photos:** open a product, scroll to *Photos*. Upload several at once (they are shrunk in the browser and saved as compressed WebP, max 1600 px), add from a link, reorder, set the main photo, edit alt text and credit, or delete. New listings get licensed photos from Wikimedia Commons automatically (credits are stored and shown on the product page); where no suitable photo exists a category illustration is used and the item is flagged *needs image*. Always check automatic photos suit the product.
- **Website wording:** *Homepage and page text* (Settings) edits the hero, section titles, finance panel, trust cards and every main page heading and intro. Content editors can change wording without access to financial settings.
- **Sample listings:** items marked demo hide their "demo" labels (`site.showDemoLabels`) and cannot be bought online (`catalogue.allowDemoPurchases` off); customers see an *Enquire on WhatsApp* button instead. Replace or archive them as real stock arrives.
- **Passwords:** every password field has a Show/Hide button.

## Carousel and About page
- **Admin > Carousel:** add, reorder, hide or delete slides (picture upload, headline, tag, button text and link). With no slides, the site fills the banner with featured cars and accessories. Turn it on/off and set the speed in Settings > Homepage text.
- **Admin > About and team:** add portraits and wording for the founders and any other people. Use "Create the founder cards" the first time. The story and headings are in Settings > Page text. All of this needs the `content:edit` permission, so it can be given to an assigned admin.
