// Lets the export code ask the frame viewer for a picture of any step of the sequence.
// The viewer registers itself here while it is on the page.
// Written with Claude Code (Anthropic) assistance.

export interface CaptureSource {
  /** Draw one step of the sequence and return it as a canvas, with the overlay and a caption. */
  renderStep(index: number): HTMLCanvasElement | null;
}

let source: CaptureSource | null = null;

/** Called by the frame viewer when it appears, and with null when it goes away. */
export function registerCapture(next: CaptureSource | null): void {
  source = next;
}

/** A picture of one step of the sequence, or null when no viewer is on the page. */
export function captureStep(index: number): HTMLCanvasElement | null {
  return source ? source.renderStep(index) : null;
}
