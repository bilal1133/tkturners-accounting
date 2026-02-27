const configuredOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

module.exports = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'global::rate-limit',
    config: {
      rules: [
        {
          name: 'auth-local',
          path: '/api/auth/local',
          match: 'exact',
          max: Number(process.env.RATE_LIMIT_AUTH_MAX || 10),
          window_ms: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS || 15 * 60 * 1000),
        },
        {
          name: 'slack-webhooks',
          path: '/api/slack/',
          match: 'prefix',
          max: Number(process.env.RATE_LIMIT_SLACK_MAX || 120),
          window_ms: Number(process.env.RATE_LIMIT_SLACK_WINDOW_MS || 60 * 1000),
        },
      ],
    },
  },
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: configuredOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Cron-Secret'],
      credentials: true,
      maxAge: 600,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '2mb',
      jsonLimit: '2mb',
      textLimit: '2mb',
      formidable: {
        maxFileSize: 250 * 1024 * 1024,
      },
      patchKoa: true,
      includeUnparsed: true,
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
