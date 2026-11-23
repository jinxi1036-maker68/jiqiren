import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_REQUEST_FILE = 'C:/Users/Administrator/.hermes/runs/ldp-task-request.json';
const DEFAULT_SPACE = 'lingju-ldp-production';
const LDP_ORIGIN = 'https://ldp.lingrobotics.com';

const SELECTORS = Object.freeze({
  modal: '.ant-modal',
  taskName: '.ant-modal input[placeholder^="请输入任务名称"]',
  projectTrigger: '.ant-modal .form-row:nth-of-type(2) .ant-select-selector',
  projectValue: '.ant-modal .form-row:nth-of-type(2) .ant-select-selection-item',
  deviceTrigger: '.ant-modal .form-row:nth-of-type(4) .ant-select-selector',
  deviceInput: '.ant-modal .form-row:nth-of-type(4) input[role="combobox"]',
  deviceValue: '.ant-modal .form-row:nth-of-type(4) .ant-select-selection-item',
  collectionHours: '.ant-modal .form-row:nth-of-type(5) input',
  deliveryHours: '.ant-modal .form-row:nth-of-type(6) input',
  sop: '.ant-modal textarea.audit-standard-textarea',
  annotationSwitch: '.ant-modal .form-row:nth-of-type(8) button[role="switch"]',
  primaryButton: '.ant-modal-footer button.ant-btn-primary',
  closeButton: '.ant-modal button[aria-label="Close"]',
  visibleOptions: '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'
});

export function validateRequest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('REQUEST_MUST_BE_OBJECT');
  for (const key of ['taskName', 'project', 'device', 'sop']) {
    if (typeof input[key] !== 'string' || !input[key].trim()) throw new Error(`MISSING_${key.toUpperCase()}`);
  }
  if (input.taskName.trim().length > 20) throw new Error('TASK_NAME_TOO_LONG');
  for (const key of ['collectionHours', 'deliveryHours']) {
    const value = Number(input[key]);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_${key.toUpperCase()}`);
  }
  if (input.submit === true && input.writeAuthorized !== true) throw new Error('SUBMIT_REQUIRES_WRITE_AUTHORIZATION');
  return {
    taskName: input.taskName.trim(), project: input.project.trim(), device: input.device.trim(), sop: input.sop.trim(),
    collectionHours: String(Number(input.collectionHours)), deliveryHours: String(Number(input.deliveryHours)),
    openAnnotation: input.openAnnotation !== false, submit: input.submit === true,
    writeAuthorized: input.writeAuthorized === true, discardAfterPrepare: input.discardAfterPrepare !== false,
    spaceName: (input.spaceName || DEFAULT_SPACE).trim()
  };
}

const css = (locator) => `loc=css:${locator}`;

async function waitUntil(page, read, accept, timeoutMs = 8000, intervalMs = 150) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeoutMs) {
    last = await read();
    if (accept(last)) return last;
    await page.waitForTimeout(intervalMs);
  }
  throw new Error(`WAIT_TIMEOUT:${JSON.stringify(last)}`);
}

const isModalOpen = (page) => page.evaluate((selector) => Boolean(document.querySelector(selector)), SELECTORS.modal);

async function bringIntoView(page, selector) {
  const found = await page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) return false;
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    return true;
  }, selector);
  if (!found) throw new Error(`ELEMENT_NOT_FOUND:${selector}`);
  await page.waitForTimeout(200);
}

async function openCleanTaskDialog(page) {
  if (await isModalOpen(page)) {
    await dismissDropdown(page);
    await page.click(css(SELECTORS.closeButton));
    await waitUntil(page, () => isModalOpen(page), (open) => !open);
  }
  await page.click('text=新建任务');
  await waitUntil(page, () => isModalOpen(page), Boolean);
}

async function readVisibleOptions(page) {
  return page.evaluate((selector) => [...document.querySelectorAll(selector)]
    .filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    }).map((node) => node.innerText.trim()), SELECTORS.visibleOptions);
}

async function openDropdownCount(page) {
  return page.evaluate(() => [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')]
    .filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    }).length);
}

async function dismissDropdown(page) {
  await page.waitForTimeout(150);
  if (await openDropdownCount(page)) await page.click(css('.ant-modal-title'));
  await waitUntil(page, () => openDropdownCount(page), (count) => count === 0, 4000);
  await page.waitForTimeout(200);
}

async function clickUniqueOption(page, expected, mode = 'contains') {
  const isMatch = (text) => mode === 'exact' ? text === expected : text.includes(expected);
  const options = await waitUntil(page, () => readVisibleOptions(page), (items) => items.filter(isMatch).length === 1);
  const matches = options.filter(isMatch);
  if (matches.length !== 1) throw new Error(`OPTION_NOT_UNIQUE:${matches.length}`);
  const targetText = matches[0];
  await page.evaluate(({ selector, targetText }) => {
    for (const node of document.querySelectorAll(selector)) {
      node.removeAttribute('data-hermes-target');
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const visible = style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      if (visible && node.innerText.trim() === targetText) node.setAttribute('data-hermes-target', 'true');
    }
  }, { selector: SELECTORS.visibleOptions, targetText });
  await page.click(css(`${SELECTORS.visibleOptions}[data-hermes-target="true"]`));
}

const selectedText = (page, selector) => page.evaluate((target) => document.querySelector(target)?.innerText?.trim() || '', selector);

async function selectProject(page, expected) {
  await bringIntoView(page, SELECTORS.projectTrigger);
  await page.click(css(SELECTORS.projectTrigger));
  await clickUniqueOption(page, expected, 'exact');
  const selected = await waitUntil(page, () => selectedText(page, SELECTORS.projectValue), (value) => value === expected);
  await dismissDropdown(page);
  return selected;
}

async function selectDevice(page, expected) {
  await bringIntoView(page, SELECTORS.deviceTrigger);
  await page.click(css(SELECTORS.deviceTrigger));
  await page.fill(css(SELECTORS.deviceInput), expected);
  await clickUniqueOption(page, expected, 'contains');
  const selected = await waitUntil(page, () => selectedText(page, SELECTORS.deviceValue), (value) => value.includes(expected));
  await dismissDropdown(page);
  return selected;
}

async function setSwitch(page, selector, enabled) {
  const read = () => page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) return null;
    return node.getAttribute('aria-checked') === 'true' || node.classList.contains('ant-switch-checked');
  }, selector);
  const current = await read();
  if (current === null) throw new Error('ANNOTATION_SWITCH_NOT_FOUND');
  if (current !== enabled) await page.click(css(selector));
  return waitUntil(page, read, (value) => value === enabled);
}

async function readForm(page) {
  return page.evaluate((selectors) => {
    const value = (selector) => document.querySelector(selector)?.value ?? '';
    const text = (selector) => document.querySelector(selector)?.innerText?.trim() ?? '';
    const toggle = document.querySelector(selectors.annotationSwitch);
    return {
      taskName: value(selectors.taskName), project: text(selectors.projectValue), device: text(selectors.deviceValue),
      collectionHours: value(selectors.collectionHours), deliveryHours: value(selectors.deliveryHours), sop: value(selectors.sop),
      openAnnotation: toggle ? toggle.getAttribute('aria-checked') === 'true' || toggle.classList.contains('ant-switch-checked') : null
    };
  }, SELECTORS);
}

function assertPrepared(actual, expected) {
  const mismatches = [];
  for (const key of ['taskName', 'project', 'sop', 'openAnnotation']) {
    if (actual[key] !== expected[key]) mismatches.push(key);
  }
  for (const key of ['collectionHours', 'deliveryHours']) {
    if (Number(actual[key]) !== Number(expected[key])) mismatches.push(key);
  }
  if (!actual.device.includes(expected.device)) mismatches.push('device');
  if (mismatches.length) throw new Error(`PREFLIGHT_MISMATCH:${mismatches.join(',')}`);
}

async function prepare(page, request) {
  await bringIntoView(page, SELECTORS.taskName);
  await page.fill(css(SELECTORS.taskName), request.taskName);
  await selectProject(page, request.project);
  await selectDevice(page, request.device);
  await bringIntoView(page, SELECTORS.collectionHours);
  await page.fill(css(SELECTORS.collectionHours), request.collectionHours);
  await bringIntoView(page, SELECTORS.deliveryHours);
  await page.fill(css(SELECTORS.deliveryHours), request.deliveryHours);
  await bringIntoView(page, SELECTORS.sop);
  await page.fill(css(SELECTORS.sop), request.sop);
  await bringIntoView(page, SELECTORS.annotationSwitch);
  await setSwitch(page, SELECTORS.annotationSwitch, request.openAnnotation);
  const actual = await readForm(page);
  assertPrepared(actual, request);
  return actual;
}

async function submitOnce(page, request) {
  await page.click(css(SELECTORS.primaryButton));
  let dialogClosed = false;
  try {
    await waitUntil(page, () => isModalOpen(page), (open) => !open, 12000);
    dialogClosed = true;
  } catch { dialogClosed = false; }
  await page.waitForTimeout(800);
  const visibleInList = await page.evaluate((taskName) => document.body.innerText.includes(taskName), request.taskName);
  return {
    submittedOnce: true, dialogClosed, visibleInCurrentList: visibleInList,
    outcome: dialogClosed && visibleInList ? 'confirmed_visible' : 'unknown_query_once_do_not_resubmit'
  };
}

export async function runLdpTaskForm(input, runtime = globalThis) {
  const request = validateRequest(input);
  if (typeof runtime.taskSpace !== 'function') throw new Error('EGO_TASKSPACE_API_MISSING');
  const task = await runtime.taskSpace(request.spaceName);
  const pages = await task.pages();
  const page = pages[0] ?? await task.newPage();
  const currentUrl = await page.url();
  if (!currentUrl.startsWith(`${LDP_ORIGIN}/data-collection`)) await page.goto(`${LDP_ORIGIN}/data-collection`);
  const finalUrl = await page.url();
  if (!finalUrl.startsWith(LDP_ORIGIN) || finalUrl.includes('/login')) throw new Error('LDP_LOGIN_REQUIRED_OR_WRONG_ORIGIN');
  await openCleanTaskDialog(page);
  const prepared = await prepare(page, request);
  const receipt = {
    mode: request.submit ? 'submit_once' : 'dry_run', taskSpace: request.spaceName,
    preflight: {
      taskName: prepared.taskName === request.taskName, project: prepared.project === request.project,
      device: prepared.device.includes(request.device), collectionHours: Number(prepared.collectionHours) === Number(request.collectionHours),
      deliveryHours: Number(prepared.deliveryHours) === Number(request.deliveryHours), sop: prepared.sop === request.sop,
      openAnnotation: prepared.openAnnotation === request.openAnnotation
    }
  };
  if (request.submit) receipt.result = await submitOnce(page, request);
  else if (request.discardAfterPrepare) {
    await page.click(css(SELECTORS.closeButton));
    await waitUntil(page, () => isModalOpen(page), (open) => !open);
    receipt.result = { submittedOnce: false, discarded: true };
  } else receipt.result = { submittedOnce: false, leftOpenForHumanReview: true };
  return receipt;
}

async function loadRequest(source) {
  const requestUrl = source?.startsWith('file:') ? new URL(source) : pathToFileURL(source || DEFAULT_REQUEST_FILE);
  return JSON.parse(await readFile(fileURLToPath(requestUrl), 'utf8'));
}

if (typeof globalThis.taskSpace === 'function' && globalThis.__LDP_TASK_FORM_NO_AUTORUN__ !== true) {
  const input = await loadRequest(globalThis.__LDP_TASK_REQUEST_FILE__);
  console.log(JSON.stringify(await runLdpTaskForm(input, globalThis)));
}

