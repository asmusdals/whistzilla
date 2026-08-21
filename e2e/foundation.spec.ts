import { expect, test } from '@playwright/test';

test('plays a complete confirmed contract against bots', async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Whistzilla' })).toBeVisible();
  expect(
    await page.getByLabel('Din hånd').locator('.playing-card').count(),
  ).toBeLessThan(13);
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(13);
  await expect(page.getByLabel('Din melding')).toHaveValue('7-ordinary');

  const playsGood = testInfo.project.name === 'mobile-chromium';
  if (playsGood) {
    await page.getByLabel('Din melding').selectOption('7-good');
  }

  await page.getByRole('button', { name: 'Få et hint' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Coach' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Vis anbefaling' }).click();
  await expect(page.getByText('Anbefalet')).toBeVisible();
  await page.getByRole('button', { name: 'Luk coach' }).click();
  await page.getByRole('button', { name: 'Indstillinger' }).click();
  await page.getByRole('radio', { name: /Avanceret/ }).check();
  await page.getByRole('button', { name: 'Luk indstillinger' }).click();

  await page.getByRole('button', { name: 'Meld', exact: true }).click();

  await expect(page.getByText(/Signe meldte pas/)).toBeVisible({
    timeout: 2_500,
  });

  if (!playsGood) {
    await expect(page.getByText('Vælg trumf')).toBeVisible({
      timeout: 5_000,
    });
    await page.getByRole('button', { name: /Hjerter/ }).click();
  }

  const partnerChoices = page.locator('.choice-controls').getByRole('button');
  await expect(partnerChoices.first()).toBeVisible();
  await partnerChoices.first().click();
  await page.getByRole('button', { name: 'Fortsæt uden bytning' }).click();

  let playableCard = page.locator('.hand-card:not(:disabled)').first();
  await expect(playableCard).toBeVisible({ timeout: 5_000 });
  await playableCard.click();
  await page.getByRole('button', { name: 'Se seneste valg' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Dit seneste valg' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Luk seneste valg' }).click();
  await expect(page.locator('.hand-card:not(:disabled)').first()).toBeVisible({
    timeout: 5_000,
  });
  await page.waitForTimeout(100);
  await page.reload();
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(12);

  for (let card = 1; card < 13; card += 1) {
    playableCard = page.locator('.hand-card:not(:disabled)').first();
    await expect(playableCard).toBeVisible({ timeout: 5_000 });
    await playableCard.click();
  }

  await expect(page.getByText(/Spillet er slut/)).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    page.locator('.primary-button').filter({ hasText: 'Nyt spil' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Spilhistorik' }).click();
  const replay = page.locator('.replay-row').first();
  await expect(replay).toBeVisible({ timeout: 5_000 });
  await replay.click();
  await expect(page.getByLabel('Replay-position')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('completed-game.png'),
    fullPage: true,
  });
});
