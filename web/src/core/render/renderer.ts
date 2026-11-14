// WebGL2 renderer for frames. Each frame keeps its detector geometry and is placed on a
// north-up view by its own pixel-to-sky matrix. Stretch and color run on the GPU.
// Written with Claude Code (Anthropic) assistance.
import { colorTable } from "../colormaps";
import { halfIsNaN } from "../half";
import type { ColorMap, Stretch } from "../types";

/** Values at or above this mark empty pixels (saturated or missing). The server clips real data below it. */
const EMPTY_HALF = 0x7bff; // largest finite float16, 65504
const EMPTY_FLOAT = 65504;
/** Marks pixels of a summed image that no frame covers. Drawn as outside the image. */
const UNCOVERED_FLOAT = -65504;

const VERTEX = `#version 300 es
// One triangle that covers the whole canvas.
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;

uniform vec2 uCanvas;       // drawing buffer size in pixels
uniform vec2 uViewCenter;   // sky offset (east, north) at the canvas center, arcsec
uniform float uScale;       // arcsec per drawing-buffer pixel

uniform sampler2D uImgA;    // first layer
uniform vec2 uSizeA;        // its size in pixels
uniform vec2 uCenA;         // field center in its pixels
uniform vec4 uInvA;         // sky-to-pixel matrix, row by row
uniform vec2 uShiftA;       // sky offset added before sampling
uniform float uBgA;         // background to subtract
uniform float uGainA;       // scale after subtracting

uniform sampler2D uImgB;    // second layer, for differences and blends
uniform vec2 uSizeB;
uniform vec2 uCenB;
uniform vec4 uInvB;
uniform vec2 uShiftB;
uniform float uBgB;
uniform float uGainB;

uniform sampler2D uImgC;    // third layer, for full color
uniform vec2 uSizeC;
uniform vec2 uCenC;
uniform vec4 uInvC;
uniform vec2 uShiftC;
uniform float uBgC;
uniform float uGainC;

uniform int uMode;          // 0 first layer only, 1 first minus second, 2 blend, 3 red-green-blue
uniform float uMix;         // blend amount for mode 2
uniform int uStretch;       // 0 linear, 1 square root, 2 log, 3 asinh
uniform float uLo;
uniform float uHi;
uniform bool uInvert;
uniform bool uSmooth;
uniform sampler2D uLut;

uniform usampler2D uFlagsA;
uniform bool uShowFlags;
uniform uint uFlagMask;
uniform vec3 uFlagColor;
uniform vec3 uEmptyColor;
uniform vec4 uOutsideColor;

out vec4 outColor;

const float EMPTY = 60000.0;

// Returns (value, state). state 1 is data, 0 is an empty pixel, -1 is outside the frame.
vec2 texel(sampler2D img, vec2 size, ivec2 q) {
  if (q.x < 0 || q.y < 0 || q.x >= int(size.x) || q.y >= int(size.y)) return vec2(0.0, -1.0);
  float v = texelFetch(img, q, 0).r;
  if (v > EMPTY) return vec2(0.0, 0.0);
  if (v < -EMPTY) return vec2(0.0, -1.0);
  return vec2(v, 1.0);
}

vec2 sampleLayer(sampler2D img, vec2 size, vec2 p) {
  vec2 nearest = texel(img, size, ivec2(floor(p + 0.5)));
  if (!uSmooth || nearest.y < 0.5) return nearest;
  // Bilinear over the four neighbors, skipping empty ones.
  vec2 base = floor(p);
  vec2 f = p - base;
  float total = 0.0;
  float weight = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 s = texel(img, size, ivec2(base) + ivec2(i, j));
      float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y);
      if (s.y > 0.5) { total += s.x * w; weight += w; }
    }
  }
  return weight > 0.0 ? vec2(total / weight, 1.0) : nearest;
}

vec2 toPixel(vec2 sky, vec2 cen, vec4 inv, vec2 shift) {
  vec2 s = sky + shift;
  return cen + vec2(inv.x * s.x + inv.y * s.y, inv.z * s.x + inv.w * s.y);
}

float curve(float t) {
  if (uStretch == 1) return sqrt(t);
  if (uStretch == 2) return log(1.0 + 1000.0 * t) / log(1001.0);
  if (uStretch == 3) return asinh(10.0 * t) / asinh(10.0);
  return t;
}

void main() {
  // Sky offset of this fragment. East is to the left, north is up.
  vec2 fromCenter = gl_FragCoord.xy - uCanvas * 0.5;
  vec2 sky = uViewCenter + vec2(-fromCenter.x, fromCenter.y) * uScale;

  vec2 pa = toPixel(sky, uCenA, uInvA, uShiftA);
  vec2 a = sampleLayer(uImgA, uSizeA, pa);

  if (uMode == 3) {
    // Full color: the three layers are red, green, and blue.
    vec2 g = sampleLayer(uImgB, uSizeB, toPixel(sky, uCenB, uInvB, uShiftB));
    vec2 b = sampleLayer(uImgC, uSizeC, toPixel(sky, uCenC, uInvC, uShiftC));
    if (a.y < -0.5 && g.y < -0.5 && b.y < -0.5) { outColor = uOutsideColor; return; }
    // A saturated pixel in any color is a very bright source. Show it white, as a photograph would.
    if (abs(a.y) < 0.5 || abs(g.y) < 0.5 || abs(b.y) < 0.5) { outColor = vec4(uInvert ? vec3(0.0) : vec3(1.0), 1.0); return; }
    vec3 raw = vec3(
      a.y > 0.5 ? (a.x - uBgA) * uGainA : 0.0,
      g.y > 0.5 ? (g.x - uBgB) * uGainB : 0.0,
      b.y > 0.5 ? (b.x - uBgC) * uGainC : 0.0);
    vec3 x = max(raw - uLo, 0.0) / max(uHi - uLo, 1e-12);
    // Stretch the brightness and keep the ratio between the colors, so hue survives the stretch.
    float level = (x.r + x.g + x.b) / 3.0;
    vec3 rgb = level > 0.0 ? x * (curve(clamp(level, 0.0, 1.0)) / level) : vec3(0.0);
    float top = max(rgb.r, max(rgb.g, rgb.b));
    if (top > 1.0) rgb /= top;
    // Very bright sources fade to white instead of staying one flat color.
    rgb = mix(rgb, vec3(1.0), smoothstep(0.8, 3.0, level));
    outColor = vec4(uInvert ? 1.0 - rgb : rgb, 1.0);
    return;
  }
  if (a.y < -0.5) { outColor = uOutsideColor; return; }
  if (a.y < 0.5) { outColor = vec4(uEmptyColor, 1.0); return; }
  float value = (a.x - uBgA) * uGainA;

  if (uMode != 0) {
    vec2 b = sampleLayer(uImgB, uSizeB, toPixel(sky, uCenB, uInvB, uShiftB));
    if (b.y > 0.5) {
      float other = (b.x - uBgB) * uGainB;
      value = uMode == 1 ? value - other : mix(value, other, uMix);
    } else if (uMode == 1) {
      outColor = b.y < -0.5 ? uOutsideColor : vec4(uEmptyColor, 1.0);
      return;
    }
  }

  float t = curve(clamp((value - uLo) / max(uHi - uLo, 1e-12), 0.0, 1.0));
  if (uInvert) t = 1.0 - t;
  vec3 color = texture(uLut, vec2(t, 0.5)).rgb;

  if (uShowFlags) {
    ivec2 q = ivec2(floor(pa + 0.5));
    if ((texelFetch(uFlagsA, q, 0).r & uFlagMask) != 0u) color = mix(color, uFlagColor, 0.55);
  }
  outColor = vec4(color, 1.0);
}`;

/** An image the renderer can draw: a loaded frame or a summed image. */
export interface Layer {
  /** Cache key for the GPU texture. */
  id: string;
  nx: number;
  ny: number;
  cx: number;
  cy: number;
  m: [number, number, number, number];
  /** Pixel data: float16 bit patterns or float32 values. */
  data: Uint16Array | Float32Array;
  flags?: Uint32Array | null;
  /** Value subtracted before the stretch. */
  bg: number;
  /** Factor applied after subtracting. */
  gain: number;
  /** Sky offset [east, north] in arcseconds added when sampling. */
  shift?: [number, number];
}

export interface DrawOptions {
  /** Sky offset at the canvas center, arcseconds [east, north]. */
  center: [number, number];
  /** Arcseconds per CSS pixel. */
  scale: number;
  stretch: Stretch;
  lo: number;
  hi: number;
  colorMap: ColorMap;
  invert: boolean;
  smooth: boolean;
  showFlags: boolean;
  flagMask: number;
  /** How the layers combine: one alone, first minus second, a blend, or three as red, green, blue. */
  mode?: "single" | "difference" | "blend" | "rgb";
  mix?: number;
  /** Colors as [r, g, b] in 0 to 1. */
  flagColor?: [number, number, number];
  emptyColor?: [number, number, number];
}

interface Texture {
  image: WebGLTexture;
  flags: WebGLTexture | null;
}

const STRETCH_CODE: Record<Stretch, number> = { linear: 0, sqrt: 1, log: 2, asinh: 3 };
const MAX_TEXTURES = 4000;

export class FrameRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private textures = new Map<string, Texture>();
  private lut: WebGLTexture;
  private lutName: ColorMap | null = null;
  private blankFlags: WebGLTexture;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, depth: false, premultipliedAlpha: true });
    if (!gl) throw new Error("This browser does not support WebGL2, which the image viewer needs.");
    this.gl = gl;
    this.program = this.build();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.lut = gl.createTexture()!;
    // A 1x1 empty flags texture keeps the sampler valid for layers without flags.
    this.blankFlags = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.blankFlags);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, 1, 1, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, new Uint32Array(1));
    this.nearest();
  }

  private build(): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader failed: ${gl.getShaderInfoLog(shader)}`);
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program failed: ${gl.getProgramInfoLog(program)}`);
    return program;
  }

  private nearest(): void {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program, name));
    return this.uniforms.get(name)!;
  }

  /** Upload a layer's pixels once and reuse the texture afterwards. */
  private texture(layer: Layer, needFlags: boolean): Texture {
    const gl = this.gl;
    let entry = this.textures.get(layer.id);
    if (!entry) {
      const image = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, image);
      if (layer.data instanceof Uint16Array) {
        // Float16 bits go to the GPU as they are. NaN becomes the empty marker.
        const bits = new Uint16Array(layer.data);
        for (let i = 0; i < bits.length; i++) if (halfIsNaN(bits[i])) bits[i] = EMPTY_HALF;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, layer.nx, layer.ny, 0, gl.RED, gl.HALF_FLOAT, bits);
      } else {
        const values = new Float32Array(layer.data);
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (v !== v) values[i] = UNCOVERED_FLOAT;
          else if (!(Math.abs(v) < 60000)) values[i] = EMPTY_FLOAT;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, layer.nx, layer.ny, 0, gl.RED, gl.FLOAT, values);
      }
      this.nearest();
      entry = { image, flags: null };
      this.textures.set(layer.id, entry);
      this.trim();
    } else {
      // Mark as recently used.
      this.textures.delete(layer.id);
      this.textures.set(layer.id, entry);
    }
    if (needFlags && !entry.flags && layer.flags) {
      entry.flags = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, entry.flags);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32UI, layer.nx, layer.ny, 0, gl.RED_INTEGER, gl.UNSIGNED_INT, layer.flags);
      this.nearest();
    }
    return entry;
  }

  /** Drop the least recently used textures when there are too many. */
  private trim(): void {
    while (this.textures.size > MAX_TEXTURES) {
      const [oldest, entry] = this.textures.entries().next().value!;
      this.gl.deleteTexture(entry.image);
      if (entry.flags) this.gl.deleteTexture(entry.flags);
      this.textures.delete(oldest);
    }
  }

  /** Forget every uploaded image, for example when a new target loads. */
  clear(): void {
    for (const entry of this.textures.values()) {
      this.gl.deleteTexture(entry.image);
      if (entry.flags) this.gl.deleteTexture(entry.flags);
    }
    this.textures.clear();
  }

  private bindLayer(suffix: "A" | "B" | "C", unit: number, layer: Layer, texture: Texture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture.image);
    gl.uniform1i(this.uniform(`uImg${suffix}`), unit);
    gl.uniform2f(this.uniform(`uSize${suffix}`), layer.nx, layer.ny);
    gl.uniform2f(this.uniform(`uCen${suffix}`), layer.cx, layer.cy);
    const [a, b, c, d] = layer.m;
    const det = a * d - b * c;
    gl.uniform4f(this.uniform(`uInv${suffix}`), d / det, -b / det, -c / det, a / det);
    gl.uniform2f(this.uniform(`uShift${suffix}`), layer.shift?.[0] ?? 0, layer.shift?.[1] ?? 0);
    gl.uniform1f(this.uniform(`uBg${suffix}`), layer.bg);
    gl.uniform1f(this.uniform(`uGain${suffix}`), layer.gain);
  }

  /** Draw one layer, or two or three combined. Pass null to clear the canvas. */
  draw(first: Layer | null, options: DrawOptions, second: Layer | null = null, third: Layer | null = null): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!first || !width || !height) return;

    gl.useProgram(this.program);
    const ratio = width / (this.canvas.clientWidth || width);
    gl.uniform2f(this.uniform("uCanvas"), width, height);
    gl.uniform2f(this.uniform("uViewCenter"), options.center[0], options.center[1]);
    gl.uniform1f(this.uniform("uScale"), options.scale / ratio);

    const showFlags = options.showFlags && !!first.flags;
    const textureA = this.texture(first, showFlags);
    this.bindLayer("A", 0, first, textureA);
    this.bindLayer("B", 1, second ?? first, second ? this.texture(second, false) : textureA);
    this.bindLayer("C", 4, third ?? first, third ? this.texture(third, false) : textureA);

    const mode = second ? (options.mode ?? "single") : "single";
    const code = mode === "difference" ? 1 : mode === "blend" ? 2 : mode === "rgb" && third ? 3 : 0;
    gl.uniform1i(this.uniform("uMode"), code);
    gl.uniform1f(this.uniform("uMix"), options.mix ?? 0.5);
    gl.uniform1i(this.uniform("uStretch"), STRETCH_CODE[options.stretch]);
    gl.uniform1f(this.uniform("uLo"), options.lo);
    gl.uniform1f(this.uniform("uHi"), options.hi);
    gl.uniform1i(this.uniform("uInvert"), options.invert ? 1 : 0);
    gl.uniform1i(this.uniform("uSmooth"), options.smooth ? 1 : 0);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lut);
    if (this.lutName !== options.colorMap) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorTable(options.colorMap));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.lutName = options.colorMap;
    }
    gl.uniform1i(this.uniform("uLut"), 2);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, showFlags && textureA.flags ? textureA.flags : this.blankFlags);
    gl.uniform1i(this.uniform("uFlagsA"), 3);
    gl.uniform1i(this.uniform("uShowFlags"), showFlags ? 1 : 0);
    gl.uniform1ui(this.uniform("uFlagMask"), options.flagMask >>> 0);
    const flag = options.flagColor ?? [0.9, 0.2, 0.2];
    const empty = options.emptyColor ?? [0.35, 0.1, 0.45];
    gl.uniform3f(this.uniform("uFlagColor"), flag[0], flag[1], flag[2]);
    gl.uniform3f(this.uniform("uEmptyColor"), empty[0], empty[1], empty[2]);
    gl.uniform4f(this.uniform("uOutsideColor"), 0, 0, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    this.clear();
    this.gl.deleteTexture(this.lut);
    this.gl.deleteTexture(this.blankFlags);
    this.gl.deleteProgram(this.program);
  }
}
