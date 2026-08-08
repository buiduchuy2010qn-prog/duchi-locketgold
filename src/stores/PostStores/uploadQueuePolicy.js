export const UPLOAD_QUEUE_ERROR = Object.freeze({
  OFFLINE: "OFFLINE",
  NETWORK: "NETWORK_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  SERVER: "SERVER_ERROR",
  MEDIA_EXPIRED: "MEDIA_EXPIRED",
  INVALID_RESPONSE: "INVALID_UPLOAD_RESPONSE",
  FAILED: "UPLOAD_FAILED",
});

export const MAX_UPLOAD_AUTO_RETRY = 2;
export const RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

const NETWORK_ERROR_CODES = new Set([
  "ECONNABORTED",
  "ECONNRESET",
  "ERR_NETWORK",
  "ETIMEDOUT",
]);

export function classifyUploadFailure(error, { online = true } = {}) {
  const status = Number(error?.response?.status || 0);
  const code = String(error?.code || "").toUpperCase();

  if (error?.message === "INVALID_UPLOAD_RESPONSE") {
    return {
      code: UPLOAD_QUEUE_ERROR.INVALID_RESPONSE,
      autoRetry: false,
      resumeOnReconnect: false,
    };
  }

  if (status === 404) {
    return {
      code: UPLOAD_QUEUE_ERROR.MEDIA_EXPIRED,
      autoRetry: false,
      resumeOnReconnect: false,
    };
  }

  if (status === 429) {
    return {
      code: UPLOAD_QUEUE_ERROR.RATE_LIMITED,
      autoRetry: false,
      resumeOnReconnect: false,
    };
  }

  if (!online) {
    return {
      code: UPLOAD_QUEUE_ERROR.OFFLINE,
      autoRetry: false,
      resumeOnReconnect: true,
    };
  }

  if (!status && (NETWORK_ERROR_CODES.has(code) || !error?.response)) {
    return {
      code: UPLOAD_QUEUE_ERROR.NETWORK,
      autoRetry: true,
      resumeOnReconnect: true,
    };
  }

  if (status === 408 || status === 425 || status >= 500) {
    return {
      code: UPLOAD_QUEUE_ERROR.SERVER,
      autoRetry: true,
      resumeOnReconnect: false,
    };
  }

  return {
    code: UPLOAD_QUEUE_ERROR.FAILED,
    autoRetry: false,
    resumeOnReconnect: false,
  };
}

export function shouldResumeAfterReconnect(item, queueSessionId) {
  return Boolean(
    item?.queueSessionId &&
      item.queueSessionId === queueSessionId &&
      (item.errorCode === UPLOAD_QUEUE_ERROR.OFFLINE ||
        item.errorCode === UPLOAD_QUEUE_ERROR.NETWORK),
  );
}

export function rateLimitCooldownRemaining(item, now = Date.now()) {
  if (item?.errorCode !== UPLOAD_QUEUE_ERROR.RATE_LIMITED) return 0;
  const lastAttempt = Date.parse(item?.lastTried || item?.createdAt || "");
  if (!Number.isFinite(lastAttempt)) return RATE_LIMIT_COOLDOWN_MS;
  return Math.max(0, RATE_LIMIT_COOLDOWN_MS - (now - lastAttempt));
}
