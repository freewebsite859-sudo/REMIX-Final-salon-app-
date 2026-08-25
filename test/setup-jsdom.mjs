import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:3000/',
  pretendToBeVisual: true,
});
const g = globalThis;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
Object.defineProperty(g, 'location', {
  value: dom.window.location,
  configurable: true,
  writable: true,
});
g.history = dom.window.history;
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.PopStateEvent = dom.window.PopStateEvent;
g.MutationObserver = dom.window.MutationObserver;
g.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
g.cancelAnimationFrame = (id) => clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = true;
g.atob = (s) => Buffer.from(s, 'base64').toString('binary');
g.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

// Seed public Supabase env for integration tests when a real .env is absent.
// The harness stubs all HTTP calls, so this only needs to be non-empty and
// non-privileged; using an anon-shaped JWT keeps the production guard active.
process.env.VITE_SUPABASE_URL ||= 'https://qwaehqsmodekbgvnaavz.supabase.co';
process.env.VITE_SUPABASE_STORAGE_KEY ||= 'nexora.auth.qwaehqsmodekbgvnaavz';
process.env.VITE_SUPABASE_ANON_KEY ||= [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
  'eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwicmVmIjoicXdhZWhxc21vZGVrYmd2bmFhdnoifQ',
  'signature',
].join('.');
