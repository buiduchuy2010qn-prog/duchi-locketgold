const crypto = require("crypto");
const { redisMoment } = require("../redis");

const RESULT_TTL_SECONDS = 60 * 60;
const LOCK_TTL_SECONDS = 5 * 60;
const LOCAL_RESULT_TTL_MS = RESULT_TTL_SECONDS * 1000;
const REMOTE_WAIT_MS = 150 * 1000;
const REMOTE_POLL_MS = 800;

const localResults = new Map();
const inFlight = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safePart(value, max = 180) {
  const text = String(value || "").trim();
  if (!text || text.length > max) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(text)) return null;
  return text;
}

function makeKeys(userId, idempotencyKey) {
  const safeUser = safePart(userId, 180);
  const safeId = safePart(idempotencyKey, 180);
  if (!safeUser || !safeId) return null;
  const base = `upload:idem:v1:${safeUser}:${safeId}`;
  return {
    result: `${base}:result`,
    lock: `${base}:lock`,
  };
}

function redisReady() {
  return Boolean(
    redisMoment &&
      redisMoment.isFallback !== true &&
      (redisMoment.isReady === true || redisMoment.isOpen === true),
  );
}

function readLocalResult(key) {
  const entry = localResults.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    localResults.delete(key);
    return null;
  }
  return entry.value;
}

function writeLocalResult(key, value) {
  localResults.set(key, {
    value,
    expiresAt: Date.now() + LOCAL_RESULT_TTL_MS,
  });
}

async function readResult(keys) {
  const local = readLocalResult(keys.result);
  if (local !== null) return local;

  if (!redisReady()) return null;
  try {
    const raw = await redisMoment.get(keys.result);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    writeLocalResult(keys.result, parsed);
    return parsed;
  } catch (error) {
    console.warn("[UploadIdempotency] Redis read failed:", error?.message || error);
    return null;
  }
}

async function writeResult(keys, value) {
  writeLocalResult(keys.result, value);
  if (!redisReady()) return;
  try {
    await redisMoment.set(keys.result, JSON.stringify(value), {
      EX: RESULT_TTL_SECONDS,
    });
  } catch (error) {
    console.warn("[UploadIdempotency] Redis write failed:", error?.message || error);
  }
}

async function acquireRemoteLock(keys, token) {
  if (!redisReady()) return { distributed: false, acquired: true };
  try {
    const result = await redisMoment.set(keys.lock, token, {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return { distributed: true, acquired: result === "OK" };
  } catch (error) {
    console.warn("[UploadIdempotency] Redis lock failed:", error?.message || error);
    return { distributed: false, acquired: true };
  }
}

async function releaseRemoteLock(keys, token, distributed) {
  if (!distributed || !redisReady()) return;
  try {
    const current = await redisMoment.get(keys.lock);
    if (current === token) await redisMoment.del(keys.lock);
  } catch (error) {
    console.warn("[UploadIdempotency] Redis unlock failed:", error?.message || error);
  }
}

async function waitForRemoteResult(keys) {
  const deadline = Date.now() + REMOTE_WAIT_MS;
  while (Date.now() < deadline) {
    const cached = await readResult(keys);
    if (cached !== null) return cached;
    await sleep(REMOTE_POLL_MS);
  }
  return null;
}

/**
 * Execute an upload side effect at most once per user + client upload id.
 * Successful results are replayed to retries so a lost HTTP response does not
 * create a duplicate Locket post. Redis is used across instances when ready;
 * the in-memory path remains a safe single-instance fallback.
 */
async function runIdempotentUpload({ userId, idempotencyKey, work }) {
  if (typeof work !== "function") {
    throw new TypeError("work must be a function");
  }

  const keys = makeKeys(userId, idempotencyKey);
  if (!keys) {
    return { result: await work(), replayed: false, protected: false };
  }

  // Reserve the local key before the first await. Without this placeholder two
  // requests arriving in the same tick could both pass readResult()/lock setup
  // and execute the upload side effect twice when Redis is unavailable.
  const existing = inFlight.get(keys.result);
  if (existing) {
    const shared = await existing;
    return {
      result: shared.result,
      replayed: true,
      protected: true,
    };
  }

  const execution = (async () => {
    const cached = await readResult(keys);
    if (cached !== null) {
      return { result: cached, replayed: true };
    }

    const token =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : crypto.randomBytes(18).toString("hex");
    const remoteLock = await acquireRemoteLock(keys, token);

    if (!remoteLock.acquired) {
      const remoteResult = await waitForRemoteResult(keys);
      if (remoteResult !== null) {
        return { result: remoteResult, replayed: true };
      }

      const error = new Error("UPLOAD_IN_PROGRESS");
      error.status = 425;
      error.statusCode = 425;
      error.code = "UPLOAD_IN_PROGRESS";
      throw error;
    }

    try {
      const value = await work();
      await writeResult(keys, value);
      return { result: value, replayed: false };
    } finally {
      await releaseRemoteLock(keys, token, remoteLock.distributed);
    }
  })();

  inFlight.set(keys.result, execution);
  try {
    const outcome = await execution;
    return {
      result: outcome.result,
      replayed: outcome.replayed,
      protected: true,
    };
  } finally {
    if (inFlight.get(keys.result) === execution) {
      inFlight.delete(keys.result);
    }
  }
}

module.exports = {
  runIdempotentUpload,
  _private: {
    makeKeys,
    localResults,
    inFlight,
    readLocalResult,
  },
};
