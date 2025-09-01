module.exports = {
  presets: ['babel-preset-expo'],
  plugins: [
    ['react-native-worklets-core/plugin'],
    // NOTE: Reanimated plugin must be listed last
    'react-native-reanimated/plugin',
  ],
};
