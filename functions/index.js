const {setGlobalOptions} = require("firebase-functions");
const {onCall} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

setGlobalOptions({maxInstances: 10});

/**
 * Basic Cloud Function health check.
 */
exports.healthCheck = onCall((request) => {
  const uid = request.auth ? request.auth.uid : null;

  logger.info("Health check called.", {
    uid: uid,
  });

  return {
    success: true,
    message: "Firebase Cloud Functions is working.",
    uid: uid,
  };
});
