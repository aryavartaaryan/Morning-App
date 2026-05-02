const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Force @google/genai to always use the browser/web build (no Node.js deps)
// The node build imports 'ws', 'google-auth-library' etc. which break Metro.
// The web build only imports 'p-retry' which is pure JS and React Native safe.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@google/genai') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/@google/genai/dist/web/index.mjs'
      ),
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
