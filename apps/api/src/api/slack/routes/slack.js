'use strict';

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/slack/commands',
      handler: 'slack.commands',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/slack/events',
      handler: 'slack.events',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/slack/interactions',
      handler: 'slack.interactions',
      config: { auth: false },
    },
  ],
};
