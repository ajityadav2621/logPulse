// @ts-check
// LogPulse developer docs — Docusaurus v3 + Redoc (API) + Mermaid (diagrams)
// + local search. Theme follows Vercel's docs conventions: mostly
// black/white/gray, hairline borders, blue accent for links only, light
// default with dark toggle, system type.

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'LogPulse',
  tagline: 'Every log, trace, and alert — one signal.',
  favicon: 'img/favicon.svg',
  url: 'https://docs.logpulse.dev', // TODO(human): set the real public docs URL before deploying
  baseUrl: '/',
  organizationName: 'ajityadav2621',
  projectName: 'logPulse',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  markdown: { mermaid: true },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: 'docs',
          sidebarPath: './sidebars.js',
          breadcrumbs: true,
          editUrl: 'https://github.com/ajityadav2621/logPulse/edit/main/docs-site/',
          showLastUpdateTime: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
    [
      'redocusaurus',
      /** @type {import('redocusaurus').Options} */
      ({
        // Redocusaurus 2.5+ takes a specs array — the old single-spec
        // `spec`/`route` options are silently ignored, which left
        // /api-reference unregistered (404 + broken links at build).
        specs: [
          {
            id: 'api-reference',
            spec: 'openapi.yaml',
            route: '/api-reference',
          },
        ],
        theme: {
          primaryColor: '#0070f3',
          primaryColorDark: '#3291ff',
          // Redoc options passed through — keep the panel layout, it reads
          // better for long specs than the sticky single-column one.
          options: { disableSearch: true, hideHostname: false },
        },
      }),
    ],
  ],

  plugins: [
    [
      '@easyops-cn/docusaurus-search-local',
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        indexPages: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        // Keyboard-first search: opens with ⌘K / Ctrl-K, hint shown in the
        // navbar input, matching the docs top bar convention.
        searchBarShortcut: true,
        searchBarShortcutHint: true,
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'LogPulse',
        logo: { alt: 'LogPulse', src: 'img/logo.svg', srcDark: 'img/logo-dark.svg' },
        items: [
          { to: '/docs/intro', label: 'Docs', position: 'left' },
          { to: '/api-reference', label: 'API', position: 'left' },
          { to: '/docs/changelog', label: 'Changelog', position: 'left' },
          {
            href: 'https://github.com/ajityadav2621/logPulse',
            position: 'right',
            className: 'header-github-link',
            'aria-label': 'GitHub repository',
          },
        ],
      },
      footer: {
        style: 'dark',
        copyright: `Copyright © ${new Date().getFullYear()} LogPulse. MIT licensed.`,
      },
      prism: {
        additionalLanguages: ['go', 'bash', 'json', 'yaml', 'sql'],
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      mermaid: {
        options: {
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        },
      },
      docs: {
        sidebar: { hideable: true, autoCollapseCategories: false },
      },
    }),
};

export default config;
