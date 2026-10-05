# Manual QA checklist (owner-executed)

Automated tests cover pricing, VAT, installment release, concurrency, payments (mocked gateway), authorisation, uploads and Excel. The following need real devices, accounts or keys.

## Paystack (test mode, real test keys)
- [ ] Settings > Paystack: save test keys, "Save and test key" succeeds; webhook URL set in the Paystack dashboard.
- [ ] Pay an order with a test card: order becomes PAID after the callback; the same payment is not credited twice if the webhook also fires.
- [ ] Abandon a payment: order stays unpaid; retry from the order page works.

## Bank transfer
- [ ] Customer uploads proof (JPG/PDF); Finance approves; order status and balances update.
- [ ] Reject and Query show the reason to the customer.

## Installment
- [ ] Order an eligible vehicle: price = outright + 10%, VAT shown, threshold shown.
- [ ] Verified payments below the threshold keep RELEASE BLOCKED; at the threshold it becomes RELEASE ELIGIBLE.

## PWA and installation
- [ ] Chrome Android and Chrome/Edge desktop: native install prompt, NOT NOW is respected for 14 days.
- [ ] Safari iPhone: Share > Add to Home Screen instructions appear; app opens standalone.
- [ ] Firefox and Samsung Internet: appropriate message, site works normally.
- [ ] Airplane mode: branded offline page; payment/checkout pages are not served from cache.

## 3D and fallbacks
- [ ] Hero shows the 3D car on a powerful desktop, the static artwork on phones/Save-Data/reduced-motion, and the site works with WebGL disabled and service workers disabled.

## Responsive and accessibility
- [ ] 320, 375, 768, 1024, 1440, 1920, 2560 px and 4K: no horizontal scroll or clipped text.
- [ ] Keyboard-only: skip link, menus, forms, checkout steps and admin tables are operable with visible focus.
- [ ] Screen reader pass on checkout and the order page.

## Content and compliance
- [ ] Legal pages reviewed by counsel; privacy and cookie wording approved.
- [ ] SCUML and NDPC registrations considered; KYC process agreed for high-value sales.
