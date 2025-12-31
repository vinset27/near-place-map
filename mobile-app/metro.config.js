const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo Router expects this in some setups; safe default.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];
// Ensure font assets from @expo/vector-icons resolve correctly on iOS/Android.
config.resolver.assetExts = Array.from(new Set([...(config.resolver.assetExts || []), 'ttf', 'otf']));

module.exports = config;



