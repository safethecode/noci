import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { renderIcon } from 'noci-icons/core';
import check from 'noci-icons/icons/check';

const documentFor = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Icon tests</title><style>body{color:#1f2328;background:white;font:16px/1.5 sans-serif}button{min-width:44px;min-height:44px}button:focus-visible{outline:2px solid #0969da;outline-offset:2px}.noci-icon{vertical-align:-.125em}</style></head><body><main>${body}</main></body></html>`;

test('decorative SVGs stay out of the accessibility tree', async ({ page }) => {
  await page.setContent(documentFor(`<button type="button">${renderIcon(check, {size:16})} Save</button>`));
  await expect(page.getByRole('button', {name:'Save'})).toHaveCount(1);
  await expect(page.getByRole('img')).toHaveCount(0);
  await expect(page.locator('svg')).toHaveAttribute('focusable','false');
});

test('informative SVGs expose their role and name', async ({ page }) => {
  await page.setContent(documentFor(renderIcon(check,{label:'Completed'})));
  await expect(page.getByRole('img',{name:'Completed'})).toHaveCount(1);
  await expect(page.locator('svg')).not.toHaveAttribute('aria-hidden','true');
});

test('native icon buttons support keyboard activation and visible focus', async ({ page }) => {
  await page.setContent(documentFor(`<button id="save" type="button" aria-label="Save">${renderIcon(check)}</button><p role="status"></p><script>document.querySelector('button').addEventListener('click',()=>{document.querySelector('[role=status]').textContent='Saved'})</script>`));
  const button=page.getByRole('button',{name:'Save'});
  await button.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect(button).toBeFocused();
  expect(await button.evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('solid');
});

test('SVG markup passes automated accessibility checks', async ({ page }) => {
  await page.setContent(documentFor(`<h1>Account status</h1><p>${renderIcon(check,{size:16})} Saved</p>${renderIcon(check,{label:'Completed'})}<button type="button" aria-label="Save">${renderIcon(check,{size:16})}</button>`));
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
});

test('inline icons follow currentColor and retain their size', async ({page})=>{
  await page.setContent(documentFor(`<span style="color:rgb(24,88,150)">${renderIcon(check,{size:16})}</span>`));
  const svg=page.locator('svg');
  expect(await svg.evaluate(el=>getComputedStyle(el).stroke)).toBe('rgb(24, 88, 150)');
  expect(await svg.evaluate(el=>el.getBoundingClientRect().width)).toBe(16);
});
