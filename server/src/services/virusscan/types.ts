export interface ScanResult {
  clean: boolean;
  signature?: string;
}

export interface VirusScanner {
  isEnabled(): boolean;
  scanFile(filePath: string): Promise<ScanResult>;
}
