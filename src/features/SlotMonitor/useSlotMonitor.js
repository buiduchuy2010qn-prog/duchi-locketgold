import { useContext } from 'react';
import { SlotMonitorContext } from './SlotMonitorProvider';

export const useSlotMonitor = () => {
  const context = useContext(SlotMonitorContext);
  
  if (!context) {
    throw new Error('useSlotMonitor must be used within a SlotMonitorProvider');
  }
  
  return context;
};
