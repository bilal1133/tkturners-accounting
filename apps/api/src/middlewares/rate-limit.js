'use strict';

function normalizeRule(rule, index) {
  const max = Number(rule.max);
  const windowMs = Number(rule.window_ms);
  const path = typeof rule.path === 'string' ? rule.path : '';

  if (!path || !Number.isFinite(max) || max <= 0 || !Number.isFinite(windowMs) || windowMs <= 0) {
    return null;
  }

  return {
    name: rule.name || `rule-${index + 1}`,
    path,
    match: rule.match === 'exact' ? 'exact' : 'prefix',
    max,
    windowMs,
  };
}

function matchesPath(rule, path) {
  if (rule.match === 'exact') {
    return path === rule.path;
  }
  return path.startsWith(rule.path);
}

function getClientKey(ctx) {
  const forwardedFor = ctx.request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = ctx.request.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  return ctx.request.ip || ctx.ip || 'unknown';
}

module.exports = (config = {}, { strapi }) => {
  const rules = Array.isArray(config.rules)
    ? config.rules.map(normalizeRule).filter(Boolean)
    : [];

  if (rules.length === 0) {
    return async (ctx, next) => next();
  }

  const buckets = new Map();
  let lastSweepAt = Date.now();

  function sweep(now) {
    if (now - lastSweepAt < 60 * 1000) {
      return;
    }

    for (const [key, entry] of buckets.entries()) {
      if (entry.resetAt <= now) {
        buckets.delete(key);
      }
    }

    lastSweepAt = now;
  }

  return async (ctx, next) => {
    const path = ctx.path || '';
    const rule = rules.find((candidate) => matchesPath(candidate, path));
    if (!rule) {
      await next();
      return;
    }

    const now = Date.now();
    sweep(now);

    const clientKey = getClientKey(ctx);
    const bucketKey = `${rule.name}:${clientKey}`;
    const existing = buckets.get(bucketKey);

    let entry = existing;
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + rule.windowMs,
      };
    }

    if (entry.count >= rule.max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      ctx.set('Retry-After', String(retryAfter));
      ctx.status = 429;
      ctx.body = {
        error: 'Too many requests. Please retry later.',
      };
      return;
    }

    entry.count += 1;
    buckets.set(bucketKey, entry);
    await next();
  };
};
