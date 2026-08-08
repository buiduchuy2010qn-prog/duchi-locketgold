const { runIdempotentUpload } = require("../utils/uploadIdempotency");

const DOWNSTREAM_TIMEOUT_MS = 4 * 60 * 1000;

function getClientUploadId(req) {
  const header = req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"];
  const bodyValue = req.body?.clientUploadId;
  const value = String(header || bodyValue || "").trim();
  return value || null;
}

function captureSuccessfulResponse(res, next) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      const error = new Error("UPLOAD_DOWNSTREAM_TIMEOUT");
      error.code = "UPLOAD_DOWNSTREAM_TIMEOUT";
      error.status = 504;
      reject(error);
    }, DOWNSTREAM_TIMEOUT_MS);

    const settleSuccess = (statusCode, body) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ statusCode, body });
    };

    const settleFailure = (statusCode, code = "UPLOAD_DOWNSTREAM_RESPONSE_SENT") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const error = new Error(code);
      error.code = code;
      error.downstreamResponseSent = true;
      error.status = statusCode;
      reject(error);
    };

    const originalJson = res.json.bind(res);
    res.json = (value) => {
      const statusCode = Number(res.statusCode || 200);

      // Settle from the controller result itself, not socket delivery. A mobile
      // connection can disappear after Locket accepted the post but before the
      // HTTP response reaches the browser; that success still must be cached.
      if (statusCode >= 200 && statusCode < 300) {
        settleSuccess(statusCode, value);
      } else {
        settleFailure(statusCode);
      }

      return originalJson(value);
    };

    const finish = () => {
      if (settled) return;
      const statusCode = Number(res.statusCode || 200);
      // postMomentV2 is JSON. A non-JSON finish is not safe to cache as success.
      settleFailure(statusCode);
    };

    // Do not release the idempotency lock on `close`: the controller may still
    // be processing after the client drops its socket. Its later res.json call
    // can still cache the successful side effect for the retry.
    res.once("finish", finish);

    try {
      next();
    } catch (error) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(error);
      }
    }
  });
}

/**
 * Protect POST /postMomentV2 against duplicate side effects caused by
 * double-taps, network retries, gateway timeouts or token-refresh retries.
 * A successful JSON response is replayed for the same user + clientUploadId.
 */
async function uploadIdempotency(req, res, next) {
  const clientUploadId = getClientUploadId(req);
  const userId = req.user?.localId;

  if (!clientUploadId || !userId) {
    next();
    return;
  }

  try {
    const outcome = await runIdempotentUpload({
      userId,
      idempotencyKey: clientUploadId,
      work: () => captureSuccessfulResponse(res, next),
    });

    // The first request already wrote its own response. Only retries need a
    // replay after the original request has completed.
    if (outcome.replayed && !res.headersSent) {
      const statusCode = Number(outcome.result?.statusCode || 200);
      return res.status(statusCode).json(
        outcome.result?.body ?? {
          success: true,
        },
      );
    }
  } catch (error) {
    if (error?.downstreamResponseSent || res.headersSent) return;

    if (error?.code === "UPLOAD_IN_PROGRESS") {
      return res.status(425).json({
        success: false,
        code: "UPLOAD_IN_PROGRESS",
        message: "Bài đăng trước vẫn đang được xử lý. Hệ thống sẽ tự thử lại.",
      });
    }

    next(error);
  }
}

module.exports = { uploadIdempotency, getClientUploadId };
