const { runIdempotentUpload } = require("../utils/uploadIdempotency");

function getClientUploadId(req) {
  const header = req.get?.("Idempotency-Key") || req.headers?.["idempotency-key"];
  const bodyValue = req.body?.clientUploadId;
  const value = String(header || bodyValue || "").trim();
  return value || null;
}

function captureSuccessfulResponse(res, next) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const originalJson = res.json.bind(res);
    res.json = (value) => {
      const statusCode = Number(res.statusCode || 200);

      // Resolve as soon as the controller has a successful result, before the
      // network socket confirms delivery. If the client disconnects right here,
      // a retry can still replay the success instead of creating another post.
      if (!settled && statusCode >= 200 && statusCode < 300) {
        settled = true;
        resolve({ statusCode, body: value });
      }

      return originalJson(value);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      const statusCode = Number(res.statusCode || 200);
      const error = new Error("UPLOAD_DOWNSTREAM_RESPONSE_SENT");
      error.code = "UPLOAD_DOWNSTREAM_RESPONSE_SENT";
      error.downstreamResponseSent = true;
      error.status = statusCode;
      reject(error);
    };

    const close = () => {
      if (settled || res.writableFinished) return;
      settled = true;
      const error = new Error("UPLOAD_CONNECTION_CLOSED");
      error.code = "UPLOAD_CONNECTION_CLOSED";
      error.downstreamResponseSent = res.headersSent;
      reject(error);
    };

    res.once("finish", finish);
    res.once("close", close);

    try {
      next();
    } catch (error) {
      settled = true;
      reject(error);
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
