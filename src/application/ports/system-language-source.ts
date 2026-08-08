export interface SystemLanguageSource {
  read(): readonly string[];
  subscribe(listener: () => void): () => void;
}
