import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
register('./asset-loader.mjs', pathToFileURL('./test/'));
