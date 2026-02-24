// Invite system types — shared across @reflog/web, @reflog/sync-api, @reflog/cli

export type InviteStatus = "pending" | "consumed" | "expired" | "revoked";

export interface Invite {
  id: string;
  email: string;
  token: string;
  status: InviteStatus;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedByUserId: string | null;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  createdAt: string;
  consent: boolean;
  invited: boolean;
}

export interface BetaConfig {
  key: string;
  value: string;
  updatedAt: string;
}

// API request/response types — per contracts/invite-api.md

export interface InviteVerifyRequest {
  email: string;
}

export interface InviteVerifyResponse {
  status: "valid";
  email: string;
}

export interface InviteConsumeRequest {
  email: string;
}

export interface InviteConsumeResponse {
  status: "consumed";
  email: string;
}

export interface WaitlistJoinRequest {
  email: string;
  consent: true;
}

export interface WaitlistJoinResponse {
  status: "added" | "exists";
  message: string;
}

export interface BetaStatusResponse {
  accepting_signups: boolean;
  waitlist_open: boolean;
}

// Error response types
export interface InviteErrorResponse {
  error: "invite_required" | "beta_full" | "already_consumed" | "consent_required";
  message: string;
}
