const WINDOW_SECONDS = 60;
const buckets = Array.from({ length: WINDOW_SECONDS }, () => ({ second: 0, requests: 0, errors: 0 }));
const recentErrors = [];
const MAX_RECENT_ERRORS = 40;

function bucketFor(epochSecond) {
  const index = epochSecond % WINDOW_SECONDS;
  const bucket = buckets[index];
  if (bucket.second !== epochSecond) {
    bucket.second = epochSecond;
    bucket.requests = 0;
    bucket.errors = 0;
  }
  return bucket;
}

function safePath(req) {
  const raw = String(req?.originalUrl || req?.url || "/");
  return raw.split("?")[0].slice(0, 240) || "/";
}

function requestTelemetryMiddleware(req, res, next) {
  const startedAt = Date.now();
  res.once("finish", () => {
    const second = Math.floor(Date.now() / 1000);
    const bucket = bucketFor(second);
    bucket.requests += 1;

    const status = Number(res.statusCode || 0);
    if (status >= 500) {
      bucket.errors += 1;
      recentErrors.unshift({
        method: String(req.method || "GET").slice(0, 12),
        path: safePath(req),
        status,
        durationMs: Math.max(0, Date.now() - startedAt),
        at: Date.now(),
      });
      if (recentErrors.length > MAX_RECENT_ERRORS) {
        recentErrors.length = MAX_RECENT_ERRORS;
      }
    }
  });
  next();
}

function getRequestTelemetry() {
  const nowSecond = Math.floor(Date.now() / 1000);
  let requestsPerMinute = 0;
  let errorsLastMinute = 0;
  for (const bucket of buckets) {
    if (nowSecond - bucket.second < WINDOW_SECONDS && nowSecond >= bucket.second) {
      requestsPerMinute += bucket.requests;
      errorsLastMinute += bucket.errors;
    }
  }
  const cutoff = Date.now() - WINDOW_SECONDS * 1000;
  return {
    requestsPerMinute,
    errorsLastMinute,
    recentErrors: recentErrors.filter((item) => item.at >= cutoff).slice(0, 12),
  };
}

module.exports = {
  requestTelemetryMiddleware,
  getRequestTelemetry,
};
