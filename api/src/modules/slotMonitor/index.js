const slotMonitorRoutes = require("./routes");
const { startSlotMonitorWorker } = require("./service");

module.exports = {
  slotMonitorRoutes,
  startSlotMonitorWorker,
};
