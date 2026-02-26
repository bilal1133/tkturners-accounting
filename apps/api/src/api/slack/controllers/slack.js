'use strict';

const { handleControllerError } = require('../../../lib/finance/errors');
const {
  handleSlashCommand,
  handleEvents,
  handleInteractions,
} = require('../../../lib/slack/service');

module.exports = {
  async commands(ctx) {
    try {
      await handleSlashCommand(ctx);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async events(ctx) {
    try {
      await handleEvents(ctx);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },

  async interactions(ctx) {
    try {
      await handleInteractions(ctx);
    } catch (error) {
      handleControllerError(ctx, error);
    }
  },
};
