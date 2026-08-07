import { useContext } from "react";
import { SlotMonitorContext } from "./SlotMonitorProvider";

export function useSlotMonitor() {
  const context = useContext(SlotMonitorContext);
  if (!context) {
    throw new Error("useSlotMonitor must be used inside SlotMonitorProvider");
  }
  return context;
}
