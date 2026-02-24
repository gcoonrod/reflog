// Sync API types — shared across @reflog/web, @reflog/sync-api, @reflog/cli

export interface SyncRecord {
  id: string;
  recordType: "entry" | "setting";
  encryptedPayload: string;
  isTombstone?: boolean;
  deviceId: string;
  version?: number;
  updatedAt?: string;
}

export interface PushRequest {
  changes: SyncRecord[];
  deviceId: string;
  lastPullTimestamp: string;
}

export interface PushResponse {
  accepted: number;
  conflicts: SyncRecord[];
  serverTimestamp: string;
}

export interface PullResponse {
  changes: SyncRecord[];
  hasMore: boolean;
  cursor?: string;
  serverTimestamp: string;
}

export interface DeviceRegistration {
  name: string;
}

export interface Device {
  id: string;
  name: string;
  registeredAt: string;
  lastSeenAt: string;
}

export interface AccountUsage {
  storageUsedBytes: number;
  storageQuotaBytes: number;
  recordCount: number;
  deviceCount: number;
}

export interface ExportResponse {
  records: SyncRecord[];
  exportedAt: string;
}

export interface QuotaExceededError {
  error: "storage_quota_exceeded";
  storageUsedBytes: number;
  storageQuotaBytes: number;
  message: string;
}

export type SyncStatus =
  | "synced"
  | "syncing"
  | "offline"
  | "error"
  | "initial-sync";
