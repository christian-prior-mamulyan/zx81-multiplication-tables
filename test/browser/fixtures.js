// Shared test fixtures. The page loads Web Awesome and Font Awesome Pro from their kits. Those are
// third-party and domain-locked, so the tests must not depend on them: every context blocks the
// kit hosts, which tests the page the way it looks when a kit is unreachable. A separate test
// (kits.spec.js) supplies a stand-in kit to test the page with the kit present.
import { expect, test as base } from '@playwright/test';

export const KIT_HOSTS = /^https?:\/\/[^/]*(webawesome|fontawesome)\.com\//;

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(KIT_HOSTS, (route) => route.abort());
    await use(context);
  },
});

export { expect };
