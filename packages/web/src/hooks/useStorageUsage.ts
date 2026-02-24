import { createContext, useContext } from "react";

export interface StorageUsageContextValue {
  /** Ratio of used storage to quota (0–1), or null if unavailable. */
  usage: number | null;
  /** True when storage usage is at or above 95%. */
  isCritical: boolean;
}

export const StorageUsageContext = createContext<StorageUsageContextValue>({
  usage: null,
  isCritical: false,
});

export function useStorageUsage(): StorageUsageContextValue {
  return useContext(StorageUsageContext);
}
