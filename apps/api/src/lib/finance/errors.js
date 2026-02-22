class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

function assert(condition, status, message, details = null) {
  if (!condition) {
    throw new HttpError(status, message, details);
  }
}

function handleControllerError(ctx, error) {
  if (error instanceof HttpError) {
    ctx.status = error.status;
    ctx.body = {
      error: error.message,
      details: error.details,
    };
    return;
  }

  strapi.log.error('Unhandled controller error', error);
  ctx.status = 500;
  ctx.body = {
    error: 'Internal server error',
  };
}

module.exports = {
  HttpError,
  assert,
  handleControllerError,
};
