const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the server directory from Metro bundler
config.resolver.blockList = [
  /server\/.*/,
];

module.exports = config;
