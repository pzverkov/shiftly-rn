const path = require('node:path');

const expoPreset = require('jest-expo/jest-preset');

// A resolved absolute path: these patterns are regexes tested against resolved
// module paths, so a literal '../api' would never match.
const apiDir = path.resolve(__dirname, '..', 'api') + path.sep;

/**
 * The only non-default here is the api path.
 *
 * shift.contract.test.ts requires the API's rule module directly out of
 * ../api, to test the client's window logic against the real thing rather
 * than a copy of it. That file is plain CommonJS and needs no transform - but
 * jest-expo's babel transform would rewrite it anyway and inject
 * @babel/runtime helpers that cannot resolve from a directory with its own,
 * separate node_modules.
 *
 * Extended rather than replaced, so upgrading jest-expo cannot leave a
 * hand-copied list of RN packages silently out of date.
 */
module.exports = {
  ...expoPreset,
  transformIgnorePatterns: [...expoPreset.transformIgnorePatterns, apiDir],
  setupFiles: ['<rootDir>/jest.setup.js', ...(expoPreset.setupFiles ?? [])],
};
