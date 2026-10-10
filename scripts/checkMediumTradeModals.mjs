import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/* Real rendered app, real modal components, deterministic portfolio fixture.
 * No broker credentials, financial mutations, or baseline image promotions.
 */
const ROOT = process.cwd();
const URL = process.env.VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const DIR = path.join(ROOT, 'visual-regression', 'medium-modal-geometry');
await fs.mkdir(DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { checks: [], errors: [] };

const widths = [
  { name: 'small-phone', width: 320, height: 740 },
  { name: 'iphone', width: 390, height: 844 },
  { name: 'large-phone', width: 430, height: 932 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'desktop', width: 1280, height: 900 },
];
const modes = ['buy', 'sell', 'edit'];
const geometryCases = [
  ...widths.flatMap(screen => modes.map(mode => ({screen, mode, scrolled:false}))),
  ...widths.map(screen => ({screen, mode:'edit', scrolled:true})),
];

async function inspect(page, mode, screen, scrolled=false) {
  const dialog = page.locator('.premium-modal.ui-trade-modal');
  await dialog.waitFor({state:'visible'});
  await page.waitForTimeout(120);
  const result = await page.evaluate(() => {
    const el = document.querySelector('.premium-modal.ui-trade-modal');
    const footer = el?.querySelector('.ui-trade-modal-actions');
    if (!el || !footer) throw new Error('Missing real modal or action footer');
    const action = footer.querySelector('button[type="submit"]');
    const submitForm = action?.form?.id ?? null;
    const formSibling = action?.form?.parentElement === footer.parentElement;
    const rect = el.getBoundingClientRect();
    const b = footer.getBoundingClientRect();
    const buttonRects = [...footer.querySelectorAll('button')].map(btn => {
      const r = btn.getBoundingClientRect();
      return { left:r.left,right:r.right,width:r.width,height:r.height };
    });
    const shell = document.querySelector('.ui-trade-modal-backdrop');
    const shellRect = shell?.getBoundingClientRect();
    const viewport = window.visualViewport;
    const visual = {top:viewport?.offsetTop??0,left:viewport?.offsetLeft??0,
      width:viewport?.width??innerWidth,height:viewport?.height??innerHeight};
    const shellStyle = shell?getComputedStyle(shell):null;
    const fields = [...el.querySelectorAll('input,textarea,select,.premium-number-stepper,.premium-form-section,.premium-subpanel')];
    const over = fields.map(node => {
      const r = node.getBoundingClientRect();
      return {label:node.tagName+'.'+node.className?.toString().split(' ').slice(0,2).join('.'),
        left:r.left,right:r.right};
    }).filter(x => x.left < rect.left-2 || x.right > rect.right+2);
    return {
      viewWidth:innerWidth,viewHeight:innerHeight,
      rect:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,height:rect.height},
      shell:shellRect?{top:shellRect.top,bottom:shellRect.bottom,left:shellRect.left,
        right:shellRect.right,height:shellRect.height}:null,
      portalParentIsBody:shell?.parentElement===document.body,
      shellPosition:shellStyle?.position,
      pageScrollY:window.scrollY,
      visual,
      overflow:el.scrollWidth-el.clientWidth,
      documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      fieldOverflows:over.slice(0,6),
      footerPosition:getComputedStyle(footer).position,
      submitForm,formSibling,
      footer:{top:b.top,bottom:b.bottom},
      actionButtons:buttonRects,
      scrollHeight:el.scrollHeight,clientHeight:el.clientHeight
    };
  });
  const violations = [];
  if (result.shellPosition !== 'fixed' || !result.portalParentIsBody)
    violations.push('modal backdrop is not viewport-fixed and portaled to body');
  if (result.shell) {
    const topError=Math.abs(result.shell.top-result.visual.top);
    const heightError=Math.abs(result.shell.height-result.visual.height);
    if(topError>4 || heightError>4)
      violations.push(`backdrop displaced from visible viewport: top=${result.shell.top.toFixed(1)} expected=${result.visual.top.toFixed(1)} heightError=${heightError.toFixed(1)}`);
  }
  if (result.rect.left < -1 || result.rect.right > result.viewWidth + 1)
    violations.push('panel extends beyond viewport');
  if (result.overflow > 1 || result.documentOverflow > 1)
    violations.push(`horizontal overflow panel=${result.overflow}, page=${result.documentOverflow}`);
  if (result.fieldOverflows.length) violations.push(`clipped fields ${JSON.stringify(result.fieldOverflows)}`);
  if (result.footerPosition !== 'sticky') violations.push('footer lost its required sticky positioning');
  if (!result.submitForm || !result.formSibling)
    violations.push('sticky actions must remain bound to their sibling transaction form');
  if (result.actionButtons.some(b => b.width < 65 || b.height < 40))
    violations.push('footer buttons too small');
  // Any dialog with spare vertical room is expected to be centered.
  if (result.scrollHeight <= result.clientHeight + 1 && result.shell) {
    const topGap = result.rect.top-result.shell.top;
    const bottomGap = result.shell.bottom-result.rect.bottom;
    if (Math.abs(topGap-bottomGap)>24)
      violations.push(`short dialog off-center topGap=${topGap.toFixed(0)} bottomGap=${bottomGap.toFixed(0)}`);
  }
  // A persistent footer must be docked both when the dialog opens and after
  // scrolling. This prevents the former "scroll all the way down to save" bug.
  const openingGap = result.rect.bottom-result.footer.bottom;
  if (result.scrollHeight > result.clientHeight + 8 && Math.abs(openingGap)>4)
    violations.push(`sticky footer is not docked at open: bottom gap=${openingGap.toFixed(1)}px`);
  const beforeScrollBottom = result.footer.bottom;
  await dialog.evaluate(el => { el.scrollTop = el.scrollHeight/2; });
  await page.waitForTimeout(80);
  const mid = await dialog.evaluate(el => {
    const r=el.querySelector('.ui-trade-modal-actions').getBoundingClientRect();
    return {bottom:r.bottom,top:r.top,scrollTop:el.scrollTop};
  });
  if (result.scrollHeight > result.clientHeight + 8 && Math.abs(mid.bottom-beforeScrollBottom)>4)
    violations.push(`sticky footer moved while scrolling: ${(mid.bottom-beforeScrollBottom).toFixed(1)}px`);
  await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(80);
  const footerAtEnd = await dialog.evaluate(el => {
    const footer=el.querySelector('.ui-trade-modal-actions');
    const r=footer.getBoundingClientRect(), p=el.getBoundingClientRect();
    const previous=footer.previousElementSibling?.getBoundingClientRect();
    return {footerBottom:r.bottom,panelBottom:p.bottom,previousBottom:previous?.bottom??null,footerTop:r.top,
      gap:p.bottom-r.bottom,footerBackground:getComputedStyle(footer).backgroundImage};
  });
  // The only reported original footer defect: background/form content showed
  // through a band *below* the anchored actions.
  if (Math.abs(footerAtEnd.gap)>4)
    violations.push(`footer leaves exposed band at bottom: ${footerAtEnd.gap.toFixed(1)}px`);
  if (!footerAtEnd.footerBackground.includes('gradient'))
    violations.push('footer must paint an opaque backdrop for scrolled content');
  if (footerAtEnd.previousBottom > footerAtEnd.footerTop + 2)
    violations.push('last field cannot scroll above sticky action footer');
  const suffix=mode+'-'+screen.name+(scrolled?'-after-page-scroll':'');
  await page.screenshot({path:path.join(DIR,suffix+'.png'),animations:'disabled'});
  report.checks.push({mode,viewport:screen.name,scrolled,...result,openingGap,mid,footerAtEnd,violations});
  if (violations.length) report.errors.push(`${suffix}: ${violations.join('; ')}`);
  console.log(`[modal-geometry] ${suffix}: panel=${result.overflow}px page=${result.documentOverflow}px, ${violations.length?'FAIL: '+violations.join('; '):'PASS'}`);
}

for (const {screen,mode,scrolled} of geometryCases) {
    let context;
    try {
      context=await browser.newContext({
        viewport:{width:screen.width,height:screen.height},
        isMobile:screen.width<500,hasTouch:screen.width<500,
        deviceScaleFactor:1,reducedMotion:'reduce',timezoneId:'Africa/Cairo'
      });
      const page=await context.newPage();
      page.on('pageerror', e=>report.errors.push(`${mode}-${screen.name} pageerror: ${e.message}`));
      await page.goto(URL,{waitUntil:'networkidle',timeout:45000});
      await page.locator('.ui-bottom-nav, .ui-desktop-tabs').first().waitFor({state:'attached'});
      const holdings=page.locator('.ui-bottom-nav:visible button').filter({hasText:'Holdings'}).first();
      if (await holdings.count()) await holdings.click();
      else await page.locator('.ui-desktop-tabs:visible button').filter({hasText:'Holdings'}).first().click();
      await page.locator('.ui-holdings').waitFor({state:'visible'});
      if(mode==='buy') {
        await page.getByRole('button',{name:'Add trade',exact:true}).first().click();
      } else {
        const holding=page.locator('.ui-holding-main');
        if(scrolled) {
          await holding.last().scrollIntoViewIfNeeded();
          await holding.last().click();
        } else await holding.first().click();
        const button=page.locator('.ui-holding-buttons button').filter({hasText:mode==='sell'?'Sell':'Edit'}).first();
        await button.click();
      }
      await inspect(page,mode,screen,scrolled);
    } catch(e) {
      report.errors.push(`${mode}-${screen.name}: ${e.stack||String(e)}`);
      console.error(`[modal-error] ${mode}-${screen.name}: ${e.message}`);
    } finally {
      await context?.close();
    }
}
await browser.close();
await fs.writeFile(path.join(DIR,'report.json'),JSON.stringify(report,null,2)+'\n');
if (report.errors.length) {
  console.error(`[modal-geometry] FAIL ${report.errors.length} regression(s)`);
  process.exitCode=1;
} else console.log(`[modal-geometry] PASS ${report.checks.length} real-browser modal/viewport states`);
