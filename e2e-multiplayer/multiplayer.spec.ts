import { expect, test } from '@playwright/test';

test('two people join a named table, start with bots, and chat', async ({
  browser,
}) => {
  const first = await browser.newPage();
  const second = await browser.newPage();
  await first.goto('/multiplayer');
  await first.getByLabel('Dit gamertag').fill('Asmus');
  await first.getByLabel('Bordets navn').fill('Testbord 123');
  await first.getByRole('button', { name: 'Opret bord' }).click();
  await expect(
    first.getByRole('heading', { name: 'Testbord 123' }),
  ).toBeVisible();
  const roomUrl = first.url();
  await second.goto(roomUrl);
  await second.getByLabel('Dit gamertag').fill('Layla');
  await second.getByRole('button', { name: 'Deltag' }).click();
  await expect(
    second.getByRole('heading', { name: 'Testbord 123' }),
  ).toBeVisible();
  await expect(second.getByText('Asmus', { exact: true })).toBeVisible();
  await expect(second.locator('.human-seat')).toContainText('Layla');
  await expect(first.getByRole('region', { name: 'Whistbord' })).toBeVisible();
  await first.getByRole('button', { name: 'Start spillet' }).click();
  await expect(first.getByText('Budrunde', { exact: true })).toBeVisible();
  await expect(first.getByLabel('Meldingstype')).toBeVisible();
  await expect(first.locator('.hand-card .playing-card')).toHaveCount(13);
  await expect(second.getByText('Budrunde', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await second.getByText('Chat').click();
  await second.getByLabel('Skriv besked').fill('Hej!');
  await second.getByRole('button', { name: 'Send' }).click();
  await expect(first.locator('.multi-chat summary')).toContainText(
    '1 beskeder',
    { timeout: 10_000 },
  );
  await first.getByText('Chat').click();
  await expect(first.getByText('Hej!')).toBeVisible();
  await first.reload();
  await expect(first.getByText('Budrunde', { exact: true })).toBeVisible();
  await first.close();
  await second.close();
});
