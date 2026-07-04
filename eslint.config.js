// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    files: ["babel.config.js"],
    ignores: ["dist/*"],
  },
  // react-hooks/immutability flags Reanimated SharedValue `.value` mutations as illegal.
  // SharedValues are intentionally mutable from the JS thread; this is a known
  // React Compiler / Reanimated incompatibility.
  {
    files: [
      "src/hooks/useBoundingBoxFrame.ts",
      "src/hooks/useCameraCapture.tsx",
      "src/screens/camera/index.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);
