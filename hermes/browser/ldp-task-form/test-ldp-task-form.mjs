import assert from 'node:assert/strict';
import { validateRequest } from './ldp-task-form.mjs';

const valid = {
  taskName: '稳定性验证', project: '示例项目', device: 'DEVICE-001', sop: '1. 示例步骤',
  collectionHours: 6, deliveryHours: 6, openAnnotation: true, submit: false
};

const normalized = validateRequest(valid);
assert.equal(normalized.collectionHours, '6');
assert.equal(normalized.submit, false);
assert.equal(normalized.spaceName, 'lingju-ldp-production');
assert.throws(() => validateRequest({ ...valid, taskName: '' }), /MISSING_TASKNAME/);
assert.throws(() => validateRequest({ ...valid, taskName: '一'.repeat(21) }), /TASK_NAME_TOO_LONG/);
assert.throws(() => validateRequest({ ...valid, submit: true }), /SUBMIT_REQUIRES_WRITE_AUTHORIZATION/);
assert.equal(validateRequest({ ...valid, submit: true, writeAuthorized: true }).submit, true);
console.log('LDP_TASK_FORM_UNIT_TESTS_OK');

