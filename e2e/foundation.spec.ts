import { expect, test } from '@playwright/test';

test('plays a complete confirmed contract against bots', async ({
  page,
}, testInfo) => {
  test.setTimeout(45_000);
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Whistzilla' })).toBeVisible();
  await page.getByRole('link', { name: /Training/ }).click();
  expect(
    await page.getByLabel('Din hånd').locator('.playing-card').count(),
  ).toBeLessThan(13);
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(13);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByLabel('Meldingstype')).toHaveValue('ordinary');
  await expect(page.getByLabel('Meldingsniveau')).toHaveValue('7');

  const playsGood = testInfo.project.name === 'mobile-chromium';
  if (playsGood) {
    await page.getByLabel('Meldingstype').selectOption('good');
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

  const firstPlayable = page
    .locator('.hand-card[aria-label^="Spil"]:not(:disabled)')
    .first();
  for (let setupStep = 0; setupStep < 20; setupStep += 1) {
    if (await firstPlayable.isVisible()) break;
    const pass = page.getByRole('button', { name: 'Pas', exact: true });
    const choice = page.locator('.choice-controls').getByRole('button').first();
    const skip = page.getByRole('button', {
      name: 'Fortsæt uden bytning',
    });
    const revealVip = page.getByRole('button', {
      name: 'Vend næste bytter',
    });
    if (await pass.isVisible()) await pass.click();
    else if (await choice.isVisible()) await choice.click();
    else if (await skip.isVisible()) await skip.click();
    else if (await revealVip.isVisible()) await revealVip.click();
    else await page.waitForTimeout(250);
  }

  let playableCard = page
    .locator('.hand-card[aria-label^="Spil"]:not(:disabled)')
    .first();
  await expect(playableCard).toBeVisible({ timeout: 5_000 });
  await expect(page.getByLabel('Spilvejledning')).toBeVisible();
  await expect(page.getByText(/Din tur/)).toBeVisible();
  await playableCard.click();
  await expect(
    page.getByLabel('Seneste stik').locator('.playing-card'),
  ).toHaveCount(4, { timeout: 5_000 });
  await expect(page.getByLabel('Sidste stik')).toContainText('vandt med');
  await expect(page.locator('.trick-card-winner')).toHaveCount(1);
  await page.getByRole('button', { name: 'Se seneste valg' }).click();
  await expect(
    page.getByRole('complementary', { name: 'Dit seneste valg' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Luk seneste valg' }).click();
  await expect(
    page.locator('.hand-card[aria-label^="Spil"]:not(:disabled)').first(),
  ).toBeVisible({ timeout: 5_000 });
  await page.waitForTimeout(100);
  await page.reload();
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(12);

  for (let card = 1; card < 13; card += 1) {
    playableCard = page
      .locator('.hand-card[aria-label^="Spil"]:not(:disabled)')
      .first();
    const finished = page.getByText(/Spillet er slut/);
    await expect
      .poll(
        async () =>
          (await finished.isVisible()) || (await playableCard.isVisible()),
        { timeout: 5_000 },
      )
      .toBe(true);
    if (await finished.isVisible()) break;
    await playableCard.click();
  }

  await expect(page.getByText(/Spillet er slut/)).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    page.locator('.primary-button').filter({ hasText: 'Næste spil' }),
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
  await page.getByRole('button', { name: 'Luk historik' }).click();
  await page.getByRole('button', { name: 'Næste spil' }).click();
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(13);
  await expect(page.getByLabel('Samlet regnskab')).toContainText('Runde 2');
});

test('plays a no-trump super laydown with only the declarer hand open', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium');
  test.setTimeout(45_000);
  await page.goto('/');
  await page.getByRole('link', { name: /Training/ }).click();
  await expect(
    page.getByLabel('Din hånd').locator('.playing-card'),
  ).toHaveCount(13);
  await page.getByLabel('Meldingstype').selectOption('super-laydown');
  await expect(page.getByLabel('Meldingsniveau')).toBeDisabled();
  await page.getByRole('button', { name: 'Meld', exact: true }).click();
  await page.getByRole('button', { name: 'Fortsæt uden bytning' }).click({
    timeout: 5_000,
  });
  await expect(page.getByLabel('Åbne hænder')).toBeVisible();
  await expect(
    page.getByLabel('Åbne hænder').locator('.open-hand'),
  ).toHaveCount(1);
  await expect(page.getByLabel('Åbne hænder')).toContainText('Dig');

  for (let decision = 0; decision < 13; decision += 1) {
    const playable = page
      .locator('.hand-card[aria-label^="Spil"]:not(:disabled)')
      .first();
    const finished = page.getByText(/Spillet er slut/);
    await expect
      .poll(
        async () =>
          (await finished.isVisible()) || (await playable.isVisible()),
        { timeout: 5_000 },
      )
      .toBe(true);
    if (await finished.isVisible()) break;
    await playable.click();
  }

  await expect(page.getByText(/Spillet er slut/)).toBeVisible({
    timeout: 5_000,
  });
});
