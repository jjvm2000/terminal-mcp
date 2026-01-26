import { TerminalSession, TerminalSessionOptions, ScreenshotResult } from "./session.js";
import { RecordingManager } from "../recording/index.js";
import type { RecordingMode, RecordingFormat, RecordingMetadata } from "../recording/index.js";
import { getDefaultRecordDir } from "../utils/platform.js";

export interface TerminalManagerOptions extends TerminalSessionOptions {
  record?: RecordingMode;
  recordDir?: string;
  recordFormat?: RecordingFormat;
  idleTimeLimit?: number;
  maxDuration?: number;
  inactivityTimeout?: number;
}

/**
 * Manages the terminal session lifecycle
 * Currently supports a single session for simplicity
 */
export class TerminalManager {
  private session: TerminalSession | null = null;
  private options: TerminalManagerOptions;
  private recordingManager: RecordingManager;
  private autoRecordingId: string | null = null;

  constructor(options: TerminalManagerOptions = {}) {
    this.options = options;
    this.recordingManager = new RecordingManager({
      mode: options.record ?? 'off',
      outputDir: options.recordDir ?? getDefaultRecordDir(),
      format: options.recordFormat ?? 'v2',
      idleTimeLimit: options.idleTimeLimit ?? 2,
      maxDuration: options.maxDuration ?? 3600,
      inactivityTimeout: options.inactivityTimeout ?? 600,
    });
  }

  /**
   * Get or create the terminal session
   */
  getSession(): TerminalSession {
    if (!this.session || !this.session.isActive()) {
      this.session = new TerminalSession(this.options);

      // Wire up recording hooks
      this.session.onData((data) => this.recordingManager.recordOutputToAll(data));
      this.session.onResize((cols, rows) => this.recordingManager.recordResizeToAll(cols, rows));

      // Start auto-recording if CLI mode !== 'off'
      if (this.options.record && this.options.record !== 'off') {
        this.startAutoRecording();
      }
    }
    return this.session;
  }

  /**
   * Start auto-recording based on CLI options
   */
  private startAutoRecording(): void {
    if (this.autoRecordingId) {
      return; // Already recording
    }

    const recorder = this.recordingManager.createRecording({
      mode: this.options.record,
      outputDir: this.options.recordDir ?? getDefaultRecordDir(),
      format: this.options.recordFormat ?? 'v2',
      idleTimeLimit: this.options.idleTimeLimit ?? 2,
      maxDuration: this.options.maxDuration ?? 3600,
      inactivityTimeout: this.options.inactivityTimeout ?? 600,
    });

    const dimensions = this.session?.getDimensions() ?? { cols: 120, rows: 40 };
    recorder.start(dimensions.cols, dimensions.rows, {
      SHELL: this.options.shell ?? process.env.SHELL,
      TERM: 'xterm-256color',
    });

    this.autoRecordingId = recorder.id;
  }

  /**
   * Get the RecordingManager instance
   */
  getRecordingManager(): RecordingManager {
    return this.recordingManager;
  }

  /**
   * Finalize all recordings and return their metadata
   * Called by the caller when the session exits
   */
  async finalizeRecordings(exitCode: number): Promise<RecordingMetadata[]> {
    return this.recordingManager.finalizeAll(exitCode);
  }

  /**
   * Check if a session exists and is active
   */
  hasActiveSession(): boolean {
    return this.session !== null && this.session.isActive();
  }

  /**
   * Write data to the terminal
   */
  write(data: string): void {
    this.getSession().write(data);
  }

  /**
   * Get terminal content
   */
  getContent(): string {
    return this.getSession().getContent();
  }

  /**
   * Get visible content only
   */
  getVisibleContent(): string {
    return this.getSession().getVisibleContent();
  }

  /**
   * Take a screenshot
   */
  takeScreenshot(): ScreenshotResult {
    return this.getSession().takeScreenshot();
  }

  /**
   * Clear the terminal
   */
  clear(): void {
    this.getSession().clear();
  }

  /**
   * Resize the terminal
   */
  resize(cols: number, rows: number): void {
    this.getSession().resize(cols, rows);
  }

  /**
   * Get terminal dimensions
   */
  getDimensions(): { cols: number; rows: number } {
    return this.getSession().getDimensions();
  }

  /**
   * Dispose of the current session
   */
  dispose(): void {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
  }
}
