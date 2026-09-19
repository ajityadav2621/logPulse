// @ts-check
/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      collapsible: true,
      items: [
        'getting-started/installation',
        'getting-started/first-logs',
      ],
    },
    'architecture',
    'api-reference',
    'websocket-protocol',
    'configuration',
    'deployment',
    'sdks',
    'troubleshooting',
    'changelog',
  ],
};

export default sidebars;
