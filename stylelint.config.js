// Stylelint: the standard config plus the rules that keep the CSS reusable.
// Rules marked "warning" are tightened to errors when the stylesheets move to design tokens
// and prefixed classes (see the plan, phase 3).
export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['public/**', 'build/**', 'node_modules/**', 'src/emulator/zx81/**', 'packages/*/vendor/**'],
  rules: {
    'selector-max-id': [0, { severity: 'warning' }],
    'declaration-no-important': [true, { severity: 'warning' }],
    'selector-max-specificity': ['0,3,1', { severity: 'warning' }],
    'property-no-vendor-prefix': [true, { ignoreProperties: ['user-select'] }], // Safari still needs -webkit-user-select
    'selector-class-pattern': null, // classes are checked for the zx- prefix in phase 3
    'custom-property-pattern': null,
    'no-descending-specificity': null,
  },
};
