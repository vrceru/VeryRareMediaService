export interface ArchiveExtractor {
  /** Extensions this extractor handles, lowercase, including the dot (e.g. ".zip"). */
  readonly extensions: string[];
  extract(archivePath: string, destinationDir: string): Promise<string[]>;
}
