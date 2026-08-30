/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'logic-runs-in-the-browser',
      comment:
        'core, geometry and commands all execute inside the browser tab, so they must not ' +
        'reach for Node built-ins. Bundlers stub these out silently and the failure only ' +
        'shows up at runtime.',
      severity: 'error',
      from: { path: '^packages/(core|geometry|commands)/src' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'logic-has-no-renderer',
      comment:
        'The library packages stay free of React, three.js and the DOM. That is what keeps ' +
        'them testable without a browser and the renderer cheap to replace.',
      severity: 'error',
      from: { path: '^packages/(core|geometry|commands)/src' },
      to: { path: 'node_modules/(react|react-dom|three|@react-three)' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts)$'] },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: [
        '\\.test\\.ts$',
        '(^|/)dist/',
        '\\.config\\.ts$',
        '^packages/(typescript|vitest)-config/',
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.depcruise.json' },
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] },
  },
}
