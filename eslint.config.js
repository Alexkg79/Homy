// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  eslintConfigPrettier,
  {
    // Runtime Deno, pas Node/RN : globals et résolution de modules différents
    // (imports esm.sh), pas le projet TS de l'app.
    ignores: ['dist/*', 'supabase/functions/**'],
  },
]);
