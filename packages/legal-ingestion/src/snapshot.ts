// @phli/legal-ingestion — immutable acquisition snapshots
// Gate 3. See docs/gates/gate-3/02_SOURCE_SNAPSHOTS.md
//
// Every retrieval is an acquisition event. Snapshots are content-addressed and
// append-only. A new hash never overwrites an old snapshot and never creates a
// legal version: version changes require identity and legal analysis.

import type { AcquisitionRecord } from "./acquisition";
import { sha256 } from "./store";

export interface AcquisitionEvent {
  eventId: string;
  sourceId: string;
  requestedUrl: string;
  finalUrl: string;
  redirectChain: string[];
  retrievedAt: string;
  httpStatus: number | null;
  mimeType: string | null;
  declaredContentLength: number | null;
  receivedBytes: number;
  sha256: string;
  etag: string | null;
  lastModified: string | null;
  softwareVersion: string;
  authorizationState: string;
  outcome: "ACQUIRED" | "REJECTED" | "FAILED";
  reason?: string | null;
}

export type ChangeClass =
  | "IDENTICAL_BYTES"
  | "TEXT_EQUIVALENT"
  | "CONTENT_CHANGED"
  | "UNKNOWN";

export interface SnapshotComparison {
  previousHash: string;
  currentHash: string;
  changeClass: ChangeClass;
  requiresLegalReview: boolean;
  note: string;
}

export class SnapshotStore {
  readonly events: AcquisitionEvent[] = [];
  private readonly bytes = new Map<string, Uint8Array>();
  private readonly textByHash = new Map<string, string>();

  /** Record an acquisition event. The same hash is stored once. */
  record(
    event: Omit<AcquisitionEvent, "eventId" | "sha256" | "receivedBytes"> & {
      bytes: Uint8Array;
      text?: string;
    },
  ): AcquisitionEvent {
    const hash = sha256(event.bytes);
    const eventId = `acq_${hash.slice(0, 12)}_${this.events.length + 1}`;
    if (!this.bytes.has(hash))
      this.bytes.set(hash, new Uint8Array(event.bytes));
    if (event.text !== undefined) this.textByHash.set(hash, event.text);
    const recorded: AcquisitionEvent = {
      eventId,
      sourceId: event.sourceId,
      requestedUrl: event.requestedUrl,
      finalUrl: event.finalUrl,
      redirectChain: event.redirectChain,
      retrievedAt: event.retrievedAt,
      httpStatus: event.httpStatus,
      mimeType: event.mimeType,
      declaredContentLength: event.declaredContentLength,
      receivedBytes: event.bytes.length,
      sha256: hash,
      etag: event.etag,
      lastModified: event.lastModified,
      softwareVersion: event.softwareVersion,
      authorizationState: event.authorizationState,
      outcome: event.outcome,
      reason: event.reason ?? null,
    };
    this.events.push(recorded);
    return recorded;
  }

  /** Snapshot bytes are immutable and never replaced. */
  get(hash: string): Uint8Array | undefined {
    const stored = this.bytes.get(hash);
    return stored ? new Uint8Array(stored) : undefined;
  }

  /** Compare a new retrieval against the latest event for the same source+URL. */
  compareLatest(
    sourceId: string,
    requestedUrl: string,
    newBytes: Uint8Array,
    newText?: string,
  ): SnapshotComparison | null {
    const previous = [...this.events]
      .reverse()
      .find(
        (event) =>
          event.sourceId === sourceId && event.requestedUrl === requestedUrl,
      );
    if (!previous) return null;
    const currentHash = sha256(newBytes);
    if (currentHash === previous.sha256) {
      return {
        previousHash: previous.sha256,
        currentHash,
        changeClass: "IDENTICAL_BYTES",
        requiresLegalReview: false,
        note: "Same bytes as the previous snapshot.",
      };
    }
    const previousText = this.textByHash.get(previous.sha256);
    const nextText = newText ?? this.textByHash.get(currentHash);
    if (previousText !== undefined && nextText !== undefined) {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      if (normalize(previousText) === normalize(nextText)) {
        return {
          previousHash: previous.sha256,
          currentHash,
          changeClass: "TEXT_EQUIVALENT",
          requiresLegalReview: false,
          note: "Bytes differ but normalized text is equivalent; likely formatting or metadata.",
        };
      }
      return {
        previousHash: previous.sha256,
        currentHash,
        changeClass: "CONTENT_CHANGED",
        requiresLegalReview: true,
        note: "Normalized text differs. Do not create or alter a legal version without identity review.",
      };
    }
    return {
      previousHash: previous.sha256,
      currentHash,
      changeClass: "UNKNOWN",
      requiresLegalReview: true,
      note: "No text available to compare. Manual review required.",
    };
  }

  /** Build a snapshot manifest entry without any legal-version claim. */
  toManifestEntry(event: AcquisitionEvent) {
    return {
      event_id: event.eventId,
      source_id: event.sourceId,
      requested_url: event.requestedUrl,
      final_url: event.finalUrl,
      redirect_chain: event.redirectChain,
      retrieved_at: event.retrievedAt,
      http_status: event.httpStatus,
      mime_type: event.mimeType,
      declared_content_length: event.declaredContentLength,
      received_bytes: event.receivedBytes,
      sha256: event.sha256,
      etag: event.etag,
      last_modified: event.lastModified,
      software_version: event.softwareVersion,
      authorization_state: event.authorizationState,
      outcome: event.outcome,
      reason: event.reason,
      legal_version_created: false,
    };
  }
}

/** Combine an acquisition record with a snapshot event (no field is inferred). */
export function linkAcquisitionToSnapshot(
  acquisition: AcquisitionRecord,
  event: AcquisitionEvent,
): { documentId: string; eventId: string; hashMatches: boolean } {
  return {
    documentId: acquisition.internalDocumentId,
    eventId: event.eventId,
    hashMatches: acquisition.sha256 === event.sha256,
  };
}
