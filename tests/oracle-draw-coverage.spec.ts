import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
const corpus = JSON.parse(readFileSync(new URL('../data/oracle-corpus.json', import.meta.url), 'utf8'));
const ALL_CARDS = corpus.cards;

test('every lower and upper trigram pair resolves to its canonical hexagram', async ({ page }) => {
  await page.goto('/universal-language');
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  const plain = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim();
  for (const card of ALL_CARDS) {
    await dialog.getByRole('button', { name: /1.*Lower/ }).click();
    await dialog.getByRole('button', { name: plain(card.iching.lower_trigram.name), exact: true }).click();
    await dialog.getByRole('button', { name: plain(card.iching.upper_trigram.name), exact: true }).click();
    await expect(dialog.getByText(`Hexagram ${card.number}`, { exact: true })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: card.card_name, exact: true })).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.getByRole('button', { name: 'Draw a card', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await page.screenshot({ path: `test-results/oracle-draw-light-${test.info().project.name}.png` });
  // Method tabs support keyboard navigation without resetting either reading.
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('tab', { name: 'Cast coins' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByText('Hexagram 63', { exact: true })).toBeVisible();
});
