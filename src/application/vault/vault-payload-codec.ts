import type { VaultPayload } from '../../domain/models';

/**
 * Validates and serializes the versioned logical payload at the application boundary.
 * Concrete schema and migration logic belongs in an adapter, not in the manager.
 */
export interface VaultPayloadCodec {
  encode(payload: VaultPayload): Uint8Array;
  decode(bytes: Uint8Array): VaultPayload;
}
