export interface VaultInvalidationChannel {
  readonly publish: () => void;
  readonly subscribe: (listener: () => void) => () => void;
}
