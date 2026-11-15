// Type declarations for the two libraries that ship none.
// Aladin Lite: the engine wraps the few calls it uses in views/SkyMap.tsx and views/BlinkLayer.tsx.
// Written with Claude Code (Anthropic) assistance.
declare module "aladin-lite" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const A: any;
  export default A;
}

// gifenc: only the calls used in export/export.ts and export/gifcolor.ts are declared.
declare module "gifenc" {
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options?: { palette?: number[][]; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
    /** The bytes written so far, without a copy. */
    bytesView(): Uint8Array;
  };
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, options?: { format?: string }): number[][];
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: number[][], format?: string): Uint8Array;
}
