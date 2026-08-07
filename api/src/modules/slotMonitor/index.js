const slotMonitorRoutes = require("./routes");
const { startSlotMonitorWorker: startCoreSlotMonitorWorker } = require("./service");
const { startTelegramBotPolling } = require("./telegramBot");

function startSlotMonitorWorker() {
  const workerStarted = startCoreSlotMonitorWorker();
  startTelegramBotPolling();
  return workerStarted;
}

module.exports = {
  slotMonitorRoutes,
  startSlotMonitorWorker,
};
