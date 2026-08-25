// Lets Node import Vite-style static assets (.jpg/.png/.css) during tests.
const ASSET = /\.(jpg|jpeg|png|webp|svg|gif|css)$/i;
export async function load(url, context, nextLoad) {
  if (ASSET.test(new URL(url).pathname)) {
    return { format: 'module', shortCircuit: true, source: 'export default "test-asset";' };
  }
  return nextLoad(url, context);
}
