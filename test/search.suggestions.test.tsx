/**
 * Search bar quick-suggestions harness.
 *
 * Users had to type exact terms into the search bar. These checks drive the
 * REAL HomeTab + ExploreTab search inputs in jsdom and assert that:
 *   1. focusing the search bar opens the quick-search dropdown
 *   2. all 5 main categories + popular search tags are offered click-to-search
 *   3. tapping a category applies the query and filters salons via fuzzy match
 *   4. Explore dropdown closes on selection, Escape and outside click
 *   5. HomeTab quick search submits the query (jumps to Explore results)
 *   6. typing closes the dropdown so it never obstructs autocomplete typing
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { act } from 'react';

import { DEMO_SALONS } from '../src/data/demoCatalog';
import type { UserProfile } from '../src/types';
import { HomeTab } from '../src/components/HomeTab';
import { ExploreTab } from '../src/components/ExploreTab';
import {
  QUICK_SEARCH_CATEGORIES,
  POPULAR_SEARCHES,
} from '../src/lib/searchSuggestions';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const noop = () => {};
const user: UserProfile = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+91 90000 00000',
  avatar: '',
  locationArea: 'Mansarovar',
  city: 'Jaipur',
  loyaltyPoints: 100,
  preferredServices: [],
  genderPreference: 'all',
};

let container: HTMLDivElement;
let root: Root;

async function render(element: React.ReactElement) {
  if (!container) {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  }
  await act(async () => {
    root.render(element);
    await new Promise((r) => setTimeout(r, 100));
  });
}

const getExploreInput = () => container.querySelector('input[type="text"]') as HTMLInputElement;
const getDropdown = () => container.querySelector('#quick-search-dropdown');

const focusExploreInput = async () => {
  await act(async () => {
    getExploreInput()?.focus();
    await new Promise((r) => setTimeout(r, 50));
  });
};

const clickExploreOption = async (label: string) => {
  const btn = [...container.querySelectorAll('#quick-search-dropdown button')].find(
    (b) => b.textContent?.includes(label),
  ) as HTMLButtonElement | undefined;
  await act(async () => {
    btn?.click();
    await new Promise((r) => setTimeout(r, 120));
  });
  return btn;
};

async function run() {
  // -------------------------------------------------------------------
  // ExploreTab: dropdown opens on focus with all quick options
  // -------------------------------------------------------------------
  await render(
    React.createElement(ExploreTab, {
      salons: JSON.parse(JSON.stringify(DEMO_SALONS)),
      currentLocation: 'Jaipur',
      savedSalonIds: [],
      onOpenSalonDetails: noop,
      onBookSalon: noop,
      onToggleSaveSalon: noop,
      onOpenAIAdvisor: noop,
    }),
  );

  check('dropdown is closed before focus', !getDropdown());

  await focusExploreInput();

  const dropdown = getDropdown();
  check('focusing the search bar opens the quick-search dropdown', !!dropdown);

  for (const cat of QUICK_SEARCH_CATEGORIES) {
    const present = !![...(dropdown?.querySelectorAll('button') ?? [])].find((b) =>
      b.textContent?.includes(cat.label),
    );
    check(`dropdown offers "${cat.label}"`, present);
  }

  const popularShown = POPULAR_SEARCHES.filter((term) =>
    dropdown?.textContent?.toLowerCase().includes(term.toLowerCase()),
  ).length;
  check(
    'dropdown shows popular searches tags',
    popularShown >= Math.min(5, POPULAR_SEARCHES.length),
    `${popularShown}/${POPULAR_SEARCHES.length} visible`,
  );

  // -------------------------------------------------------------------
  // Click-to-search: category tap applies query + fuzzy filters results
  // -------------------------------------------------------------------
  const beardBtn = await clickExploreOption('Beard Trim & Shave');
  check('"Beard Trim & Shave" option exists as a clickable button', !!beardBtn);
  check('selecting an option closes the dropdown', !getDropdown());
  check(
    'query is applied to the search input',
    getExploreInput()?.value === 'beard trim shave',
    getExploreInput()?.value,
  );
  check(
    'fuzzy filtering shows the beard trim salon (Premium Hair Studio)',
    container.textContent?.includes('Premium Hair Studio') &&
      !container.textContent?.includes('No Salons Match Your Search'),
  );

  // -------------------------------------------------------------------
  // Dismissal behaviours
  // -------------------------------------------------------------------
  // In a real browser, tapping a dropdown button moves focus off the input;
  // mirror that before re-focusing (jsdom keeps focus on the input).
  await act(async () => {
    getExploreInput()?.blur();
    await new Promise((r) => setTimeout(r, 50));
  });
  await focusExploreInput();
  check('re-focusing reopens the dropdown', !!getDropdown());

  await act(async () => {
    getExploreInput()?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
  });
  check('Escape closes the dropdown', !getDropdown());

  await focusExploreInput();
  await act(async () => {
    document.body.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50));
  });
  check('clicking outside the search bar closes the dropdown', !getDropdown());

  await focusExploreInput();
  await act(async () => {
    const input = getExploreInput();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    setter.call(input, 'hair');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));
  });
  check('typing into the input closes the dropdown', !getDropdown());

  // -------------------------------------------------------------------
  // HomeTab: quick search submits the query
  // -------------------------------------------------------------------
  const submitted: string[] = [];
  root.unmount();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(HomeTab, {
        user,
        salons: JSON.parse(JSON.stringify(DEMO_SALONS)),
        upcomingAppointment: null,
        savedSalonIds: [],
        savedServicesCount: 0,
        onOpenSalonDetails: noop,
        onBookSalon: noop,
        onOpenAppointmentDetails: noop,
        onToggleSaveSalon: noop,
        onOpenQuickNearest: noop,
        onOpenAIAdvisor: noop,
        onSelectCategory: noop,
        onSearchSubmit: (q) => submitted.push(q),
        onSelectSavedTab: noop,
      }),
    );
    await new Promise((r) => setTimeout(r, 200));
  });

  const homeInput = container.querySelector('input[type="text"]') as HTMLInputElement;
  await act(async () => {
    homeInput?.focus();
    await new Promise((r) => setTimeout(r, 50));
  });
  check('HomeTab search focus opens the quick-search dropdown', !!container.querySelector('#home-quick-search-dropdown'));

  const barberBtn = [...container.querySelectorAll('#home-quick-search-dropdown button')].find((b) =>
    b.textContent?.includes("Barber / Men's Grooming"),
  ) as HTMLButtonElement | undefined;
  await act(async () => {
    barberBtn?.click();
    await new Promise((r) => setTimeout(r, 80));
  });
  check(
    "HomeTab tapping \"Barber / Men's Grooming\" submits the fuzzy query",
    submitted.length === 1 && submitted[0] === 'barber men grooming',
    submitted.join(' | '),
  );

  // -------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------
  // Unmount so HomeTab's carousel interval does not keep node alive.
  await act(async () => {
    root.unmount();
    await new Promise((r) => setTimeout(r, 50));
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length > 0 ? 1 : 0);
}

run();
