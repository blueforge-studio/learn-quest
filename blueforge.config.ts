/**
 * BlueForge project config — learn-quest meta-repo with 36 sub-repos
 * across language quests, life quests, school quests, and platform packages.
 */
export default {
  project: {
    name: 'learn-quest',
    displayName: 'Learn Quest',
    scope: '@learn-quest',
    category: 'tool',
    tags: ['learning', 'education', 'quests'],
  },
  apps: {
    // Platform packages
    'lq-core': { path: 'lq-core', type: 'library', deployable: false },
    'lq-operations': { path: 'lq-operations', type: 'library', deployable: false },
    'lq-site': { path: 'lq-site', type: 'next' },
    'lq-tools': { path: 'lq-tools', type: 'library', deployable: false },
    'books-platform': { path: 'books-platform', type: 'next' },
    'lingua-quest': { path: 'lingua-quest', type: 'next' },

    // lang-quest — language learning repos
    'lang-quest/lq-african': { path: 'lang-quest/lq-african', type: 'app' },
    'lang-quest/lq-balkan': { path: 'lang-quest/lq-balkan', type: 'app' },
    'lang-quest/lq-celtic': { path: 'lang-quest/lq-celtic', type: 'app' },
    'lang-quest/lq-east-asian': { path: 'lang-quest/lq-east-asian', type: 'app' },
    'lang-quest/lq-english': { path: 'lang-quest/lq-english', type: 'app' },
    'lang-quest/lq-germanic': { path: 'lang-quest/lq-germanic', type: 'app' },
    'lang-quest/lq-middle-eastern': { path: 'lang-quest/lq-middle-eastern', type: 'app' },
    'lang-quest/lq-nordic': { path: 'lang-quest/lq-nordic', type: 'app' },
    'lang-quest/lq-romance': { path: 'lang-quest/lq-romance', type: 'app' },
    'lang-quest/lq-slavic': { path: 'lang-quest/lq-slavic', type: 'app' },
    'lang-quest/lq-south-asian': { path: 'lang-quest/lq-south-asian', type: 'app' },
    'lang-quest/lq-southeast-asian': { path: 'lang-quest/lq-southeast-asian', type: 'app' },
    'lang-quest/lq-uralic': { path: 'lang-quest/lq-uralic', type: 'app' },
    'lang-quest/lq-west-slavic': { path: 'lang-quest/lq-west-slavic', type: 'app' },

    // life-quest — life skills repos
    'life-quest/lq-cooking': { path: 'life-quest/lq-cooking', type: 'app' },
    'life-quest/lq-economics': { path: 'life-quest/lq-economics', type: 'app' },
    'life-quest/lq-engineering': { path: 'life-quest/lq-engineering', type: 'app' },
    'life-quest/lq-finance': { path: 'life-quest/lq-finance', type: 'app' },
    'life-quest/lq-health': { path: 'life-quest/lq-health', type: 'app' },
    'life-quest/lq-law': { path: 'life-quest/lq-law', type: 'app' },
    'life-quest/lq-media': { path: 'life-quest/lq-media', type: 'app' },
    'life-quest/lq-philosophy': { path: 'life-quest/lq-philosophy', type: 'app' },
    'life-quest/lq-psychology': { path: 'life-quest/lq-psychology', type: 'app' },
    'life-quest/lq-tech': { path: 'life-quest/lq-tech', type: 'app' },

    // school-quest — school subject repos
    'school-quest/lq-geography': { path: 'school-quest/lq-geography', type: 'app' },
    'school-quest/lq-history': { path: 'school-quest/lq-history', type: 'app' },
    'school-quest/lq-math': { path: 'school-quest/lq-math', type: 'app' },
    'school-quest/lq-reading': { path: 'school-quest/lq-reading', type: 'app' },
    'school-quest/lq-science': { path: 'school-quest/lq-science', type: 'app' },
    'school-quest/lq-writing': { path: 'school-quest/lq-writing', type: 'app' },
  },
} as const;
