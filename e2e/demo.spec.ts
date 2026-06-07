import { test, expect } from '@playwright/test';

// Demo mode bypasses auth and runs the app fully client-side (auth.jsx:
// DEMO_MODE = ... || sessionStorage.px_demo === '1'). We set it before any app
// script runs, then exercise the protected high-value paths.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('px_demo', '1'));
});

test('1-click demo lands on the populated client roadmap', async ({ page }) => {
  await page.goto('/app/');
  // The client portal chrome + a roadmap surface render without signup.
  await expect(page.getByRole('button', { name: /your numbers/i })).toBeVisible();
  await expect(page.getByText(/conversation with/i)).toBeVisible();
});

test('client portal renders on a mobile viewport', async ({ page }) => {
  // "Mobile" is one of the explicitly-protected high-value paths.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/');
  await expect(page.getByRole('button', { name: /your numbers/i })).toBeVisible();
  await expect(page.getByText(/conversation with/i)).toBeVisible();
});

// Regression guard for the C1 fix: a NEWLY-added household member must be able to
// receive a date of birth. The bug was that partial Month/Day/Year picks were
// discarded, so a new member's selects reverted and a DOB could never be set.
test('a newly-added member can be given a date of birth', async ({ page }) => {
  await page.goto('/app/');
  await page.getByRole('button', { name: /your numbers/i }).click();
  await page.getByRole('button', { name: /add person/i }).click();

  const months = page.locator('select[aria-label="Birth month"]');
  const days = page.locator('select[aria-label="Birth day"]');
  const years = page.locator('select[aria-label="Birth year"]');

  // Operate on the just-added member (the last DOB row).
  await months.last().selectOption('6');
  await days.last().selectOption('12');
  await years.last().selectOption('2010');

  // The selections must persist — pre-fix they snapped back to the placeholder.
  await expect(months.last()).toHaveValue('6');
  await expect(days.last()).toHaveValue('12');
  await expect(years.last()).toHaveValue('2010');
});
