/**
 * Sign-up Date of Birth (DOB) — mandatory for customers.
 *
 * Covers:
 *  - `validateDateOfBirth` rules (required / invalid / future / min age)
 *  - the `/customer/signup` form: DOB input exists, is required for the
 *    customer role, blocks submission when empty, and clears once filled.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import {
  validateDateOfBirth,
  calculateAge,
  maxDobInputValue,
  MIN_SIGNUP_AGE,
} from '../src/lib/dobValidation.ts';
import { AuthPage } from '../src/components/auth/AuthPage.tsx';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail = '') {
  if (cond) {
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
  } else {
    console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

const host = document.createElement('div');
document.body.appendChild(host);
const root: Root = createRoot(host);

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}

function byId(id: string): HTMLElement | null {
  return document.getElementById(id) || host.querySelector(`[id="${id}"]`);
}

async function typeInto(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error('input target missing');
  const w = window as unknown as { HTMLInputElement: typeof HTMLInputElement };
  const setter = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(el, value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

async function submitForm() {
  const form = host.querySelector('form');
  if (!form) throw new Error('signup form missing');
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
}

async function run() {
  // ---------------------------------------------------------------------
  // 1. Pure validation rules
  // ---------------------------------------------------------------------
  const today = new Date(2026, 8, 8); // 2026-09-08

  check('empty DOB is rejected when required', validateDateOfBirth('', { today }) !== null);
  check(
    'empty DOB allowed when not required',
    validateDateOfBirth('', { required: false, today }) === null
  );
  check('garbage DOB rejected', validateDateOfBirth('not-a-date', { today }) !== null);
  check('impossible calendar date rejected', validateDateOfBirth('1995-02-30', { today }) !== null);
  check('future DOB rejected', validateDateOfBirth('2030-01-01', { today }) !== null);
  check(
    'under-age DOB rejected',
    (validateDateOfBirth('2020-01-01', { today }) || '').includes(String(MIN_SIGNUP_AGE))
  );
  check('valid adult DOB accepted', validateDateOfBirth('1995-05-15', { today }) === null);
  check('age calculated correctly', calculateAge('1995-05-15', today) === 31);
  check(
    'max selectable date is today minus min age',
    maxDobInputValue(today) === `${today.getFullYear() - MIN_SIGNUP_AGE}-09-08`
  );

  // ---------------------------------------------------------------------
  // 2. Sign-up form wiring
  // ---------------------------------------------------------------------
  let authSuccessCalls = 0;
  await render(
    <AuthPage initialMode="signup" onAuthSuccess={() => { authSuccessCalls += 1; }} />
  );

  const dobInput = byId('signup-dob') as HTMLInputElement | null;
  check('DOB field rendered on the sign-up form', Boolean(dobInput));
  check('DOB field is a date picker', dobInput?.getAttribute('type') === 'date');
  check('DOB field is required for customers', dobInput?.required === true);
  check(
    'DOB field is marked required for assistive tech',
    dobInput?.getAttribute('aria-required') === 'true'
  );
  check('DOB field caps the max selectable date', Boolean(dobInput?.getAttribute('max')));

  // Fill everything EXCEPT the DOB → submission must be blocked.
  await typeInto(byId('signup-fullname') as HTMLInputElement, 'Ananya Sharma');
  await typeInto(byId('signup-mobile') as HTMLInputElement, '9829012345');
  await typeInto(byId('auth-email') as HTMLInputElement, 'ananya@example.com');
  await typeInto(byId('auth-password') as HTMLInputElement, 'SuperSecret123');
  await typeInto(byId('signup-confirm-password') as HTMLInputElement, 'SuperSecret123');
  await submitForm();

  const bodyAfterEmptyDob = host.textContent || '';
  check(
    'submitting without DOB shows the required error',
    bodyAfterEmptyDob.includes('Date of birth is required.')
  );
  check('signup did not proceed without DOB', authSuccessCalls === 0);

  // An under-age DOB is rejected too.
  await typeInto(dobInput, '2020-01-01');
  await submitForm();
  check(
    'under-age DOB blocked in the form',
    (host.textContent || '').includes(`at least ${MIN_SIGNUP_AGE} years old`)
  );

  // A valid DOB clears the field error.
  await typeInto(dobInput, '1995-05-15');
  check(
    'valid DOB clears the DOB error message',
    !(host.textContent || '').includes('Date of birth is required.') &&
      !(host.textContent || '').includes(`at least ${MIN_SIGNUP_AGE} years old`)
  );
  check('age preview shown for a valid DOB', (host.textContent || '').includes('Age '));

  console.log(`\n${passed}/${passed + failed} signup DOB checks passed`);
  await act(async () => {
    root.unmount();
  });
  process.exit(failed > 0 ? 1 : 0);
}

void run();
