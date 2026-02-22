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

function mapDatabaseError(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  // PostgreSQL error codes:
  // 23505 = unique_violation
  // 23503 = foreign_key_violation
  // 23514 = check_violation
  // 22P02 = invalid_text_representation
  switch (error.code) {
    case '23505':
      return {
        status: 409,
        body: {
          error: 'Conflict: record already exists.',
          details: error.constraint ? { constraint: error.constraint } : null,
        },
      };
    case '23503':
      return {
        status: 409,
        body: {
          error: 'Conflict: record is linked to other data.',
          details: error.constraint ? { constraint: error.constraint } : null,
        },
      };
    case '23514':
    case '22P02':
      return {
        status: 400,
        body: {
          error: 'Invalid request payload.',
          details: error.constraint ? { constraint: error.constraint } : null,
        },
      };
    default:
      return null;
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

  const mappedDatabaseError = mapDatabaseError(error);
  if (mappedDatabaseError) {
    ctx.status = mappedDatabaseError.status;
    ctx.body = mappedDatabaseError.body;
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
