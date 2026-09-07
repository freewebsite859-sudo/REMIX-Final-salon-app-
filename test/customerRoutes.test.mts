/**
 * Customer app route catalog + booking-auth guard.
 *
 * Runs without React — pure path parsing / History API helpers.
 */
import assert from 'node:assert/strict';
import {
  CUSTOMER_BOOKINGS,
  CUSTOMER_BOOK_PREFIX,
  CUSTOMER_FAVOURITES,
  CUSTOMER_HOME,
  CUSTOMER_LOGIN,
  CUSTOMER_NOTIFICATIONS,
  CUSTOMER_PROFILE,
  CUSTOMER_REWARDS,
  CUSTOMER_ROUTE_CATALOG,
  CUSTOMER_SEARCH,
  CUSTOMER_SIGNUP,
  customerBookPath,
  customerBookingPath,
  customerRouteToTab,
  customerSalonPath,
  customerSearchPath,
  isProtectedCustomerRoute,
  parseCustomerRoute,
  requireAuthForBooking,
  slugifySalon,
  tabToCustomerPath,
  rememberCustomerReturnPath,
  consumeCustomerReturnPath,
  redirectToCustomerHome,
} from '../src/lib/customerRoutes.ts';

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

// Catalog completeness
const expected = [
  '/customer',
  '/customer/login',
  '/customer/signup',
  '/customer/home',
  '/customer/search',
  '/customer/salon/:salonSlug',
  '/customer/book/:salonId',
  '/customer/bookings',
  '/customer/booking/:bookingId',
  '/customer/rewards',
  '/customer/membership',
  '/customer/favourites',
  '/customer/profile',
  '/customer/settings',
  '/customer/referral',
  '/customer/reviews',
  '/customer/notifications',
];
check(
  'catalog lists every required customer route',
  expected.every((p) => CUSTOMER_ROUTE_CATALOG.includes(p)) &&
    CUSTOMER_ROUTE_CATALOG.length === expected.length,
  `got ${CUSTOMER_ROUTE_CATALOG.length} routes`
);

// Static parses
check('parse /customer/home', parseCustomerRoute(CUSTOMER_HOME).kind === 'home');
check('parse /customer/login', parseCustomerRoute(CUSTOMER_LOGIN).kind === 'login');
check('parse /customer/signup', parseCustomerRoute(CUSTOMER_SIGNUP).kind === 'signup');
check('parse /customer/search', parseCustomerRoute(CUSTOMER_SEARCH).kind === 'search');
check(
  'parse /customer/search?q=spa',
  parseCustomerRoute(CUSTOMER_SEARCH, '?q=spa').query === 'spa'
);
check('parse /customer/bookings', parseCustomerRoute(CUSTOMER_BOOKINGS).kind === 'bookings');
check('parse /customer/favourites', parseCustomerRoute(CUSTOMER_FAVOURITES).kind === 'favourites');
check('parse /customer/profile', parseCustomerRoute(CUSTOMER_PROFILE).kind === 'profile');
check(
  'parse /customer/notifications',
  parseCustomerRoute(CUSTOMER_NOTIFICATIONS).kind === 'notifications'
);

// Dynamic segments
const salonPath = customerSalonPath('glow-studio');
check('salon path shape', salonPath === '/customer/salon/glow-studio', salonPath);
check(
  'parse salon slug',
  parseCustomerRoute(salonPath).kind === 'salon' &&
    parseCustomerRoute(salonPath).salonSlug === 'glow-studio'
);

const bookPath = customerBookPath('salon-42');
check('book path shape', bookPath === '/customer/book/salon-42', bookPath);
check(
  'parse book salonId',
  parseCustomerRoute(bookPath).kind === 'book' &&
    parseCustomerRoute(bookPath).salonId === 'salon-42'
);

const bookingPath = customerBookingPath('bk-99');
check(
  'parse booking id',
  parseCustomerRoute(bookingPath).kind === 'booking' &&
    parseCustomerRoute(bookingPath).bookingId === 'bk-99'
);

check('slugifySalon normalises', slugifySalon('Glow Studio!!') === 'glow-studio');
check(
  'customerSearchPath encodes query',
  customerSearchPath('hair cut') === '/customer/search?q=hair%20cut'
);

// Tab mapping
check('home tab path', tabToCustomerPath('home') === CUSTOMER_HOME);
check('search tab path', tabToCustomerPath('search') === CUSTOMER_SEARCH);
check('bookings tab path', tabToCustomerPath('bookings') === CUSTOMER_BOOKINGS);
check('rewards tab path', tabToCustomerPath('rewards') === CUSTOMER_REWARDS);
check('saved tab path', tabToCustomerPath('saved') === CUSTOMER_FAVOURITES);
check('profile tab path', tabToCustomerPath('profile') === CUSTOMER_PROFILE);
check(
  'book route maps to home tab',
  customerRouteToTab(parseCustomerRoute(bookPath)) === 'home'
);
check(
  'bookings route maps to bookings tab',
  customerRouteToTab(parseCustomerRoute(CUSTOMER_BOOKINGS)) === 'bookings'
);
check(
  'search route maps to search tab',
  customerRouteToTab(parseCustomerRoute(CUSTOMER_SEARCH)) === 'search'
);
check(
  'rewards route maps to rewards tab',
  customerRouteToTab(parseCustomerRoute(CUSTOMER_REWARDS)) === 'rewards'
);

// Protection
check('book is protected', isProtectedCustomerRoute(parseCustomerRoute(bookPath)));
check('bookings is protected', isProtectedCustomerRoute(parseCustomerRoute(CUSTOMER_BOOKINGS)));
check('home is public', !isProtectedCustomerRoute(parseCustomerRoute(CUSTOMER_HOME)));
check('search is public', !isProtectedCustomerRoute(parseCustomerRoute(CUSTOMER_SEARCH)));
check('salon is public', !isProtectedCustomerRoute(parseCustomerRoute(salonPath)));

// Return-path + booking auth guard (jsdom-free sessionStorage shim)
const store = new Map<string, string>();
(globalThis as { sessionStorage?: Storage }).sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k)! : null),
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

// Minimal window/history for redirect helpers
const historyStack: string[] = ['/customer/home'];
(globalThis as { window?: unknown }).window = {
  location: {
    get pathname() {
      const u = historyStack[historyStack.length - 1] || '/';
      return u.split('?')[0];
    },
    get search() {
      const u = historyStack[historyStack.length - 1] || '/';
      const i = u.indexOf('?');
      return i >= 0 ? u.slice(i) : '';
    },
  },
  history: {
    replaceState: (_s: unknown, _t: string, url: string) => {
      historyStack[historyStack.length - 1] = url;
    },
    pushState: (_s: unknown, _t: string, url: string) => {
      historyStack.push(url);
    },
  },
  dispatchEvent: () => true,
};

rememberCustomerReturnPath(bookPath);
check(
  'remember return path stores book URL',
  store.get('nexora-customer-return-path') === bookPath
);

const redirected = requireAuthForBooking(false, bookPath);
check('requireAuthForBooking redirects when logged out', redirected === true);
check(
  'requireAuthForBooking lands on /customer/login',
  historyStack[historyStack.length - 1].startsWith(CUSTOMER_LOGIN),
  historyStack[historyStack.length - 1]
);

// Authenticated booking does not redirect
historyStack.push('/customer/home');
const noRedirect = requireAuthForBooking(true, bookPath);
check('requireAuthForBooking is no-op when authenticated', noRedirect === false);

// After login, home redirect consumes the return path
store.set('nexora-customer-return-path', bookPath);
redirectToCustomerHome({ replace: true });
check(
  'post-login lands on stashed book path',
  historyStack[historyStack.length - 1] === bookPath,
  historyStack[historyStack.length - 1]
);
check('return path consumed', consumeCustomerReturnPath() === null);

// Constants sanity
check('CUSTOMER_BOOK_PREFIX', CUSTOMER_BOOK_PREFIX === '/customer/book/');
check('CUSTOMER_HOME', CUSTOMER_HOME === '/customer/home');
check('CUSTOMER_LOGIN', CUSTOMER_LOGIN === '/customer/login');
check('CUSTOMER_SIGNUP', CUSTOMER_SIGNUP === '/customer/signup');

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error('Failures:', failed.map((f) => f.name).join(', '));
  process.exit(1);
}
process.exit(0);
