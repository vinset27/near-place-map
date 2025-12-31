module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // SDK 50+: expo-router/babel is deprecated; babel-preset-expo already includes what's needed.
    plugins: [],
  };
};


