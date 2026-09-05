const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Monorepo support: this app depends on @sptc/shared, which lives outside
// this app's own node_modules (npm workspaces hoist it to the repo root).\n// Metro needs to be told to watch the workspace root and resolve modules
// from both this app's and the root's node_modules.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

// Resolve @/ path aliases to src/ (mirrors tsconfig paths: "@/*" -> ["src/*"])
config.resolver.alias = {
  '@': path.resolve(projectRoot, 'src'),
};

module.exports = config;

