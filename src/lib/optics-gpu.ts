import type { OpticalMaterial, OpticalQuality, OpticalShape } from "./optics-material";
import { opticsFragment, opticsVertex } from "./optics-shader";

export type LensTile = {
  bounds: DOMRect;
  canvas: CanvasRenderingContext2D;
  material: OpticalMaterial;
  shape: OpticalShape;
  opticalScale: number;
  motion: readonly [number, number, number, number];
  debugView: number;
};

const uniformNames = [
  "backdrop", "backdropSize", "texelScale", "lensOrigin", "lensSize", "geometry",
  "indices", "lighting", "volume", "deformation", "bevel", "turbulence", "circleShape",
  "quality", "diagnostic", "bounceLimit", "opticalScale",
] as const;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate the optical shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  const info = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error(info || "Unable to compile the optical shader.");
}

export function createOpticsGpu(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const program = gl.createProgram();
  if (!program) return null;
  let vertex: WebGLShader | undefined;
  let fragment: WebGLShader | undefined;
  try {
    vertex = compile(gl, gl.VERTEX_SHADER, opticsVertex);
    fragment = compile(gl, gl.FRAGMENT_SHADER, opticsFragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || "Unable to link the optical shader.");
    }
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }

  const texture = gl.createTexture();
  if (!texture) {
    gl.deleteProgram(program);
    return null;
  }
  const locations = new Map(uniformNames.map((name) => [name, gl.getUniformLocation(program, name)]));
  const at = (name: typeof uniformNames[number]) => locations.get(name) ?? null;
  gl.useProgram(program);
  gl.uniform1i(at("backdrop"), 0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const maxSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE));
  let textureWidth = 0;
  let textureHeight = 0;

  return {
    maxSize,
    upload(source: HTMLCanvasElement) {
      // Color samples are decoded to linear light by the sRGB texture.
      if (source.width !== textureWidth || source.height !== textureHeight) {
        textureWidth = source.width;
        textureHeight = source.height;
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      }
      gl.generateMipmap(gl.TEXTURE_2D);
    },
    render(tiles: LensTile[], scene: DOMRect, quality: OpticalQuality, source: HTMLCanvasElement) {
      if (tiles.length === 0) return;
      const pixelBudget = quality === "high" ? 420_000 : 260_000;
      const area = tiles.reduce((sum, tile) => sum + tile.bounds.width * tile.bounds.height, 0);
      const longest = Math.max(...tiles.map(({ bounds }) => Math.max(bounds.width, bounds.height)));
      const stack = tiles.reduce((sum, tile) => sum + tile.bounds.height, 0);
      const scale = Math.min(quality === "high" ? Math.min(devicePixelRatio, 1.5) : 0.85,
        Math.sqrt(pixelBudget / area), (maxSize - tiles.length) / Math.max(stack, longest));
      let atlasWidth = 0;
      let atlasHeight = 0;
      // Stack compact tiles in one drawing buffer and copy them after all draws.
      const packed = tiles.map((tile) => {
        const width = Math.max(1, Math.ceil(tile.bounds.width * scale));
        const height = Math.max(1, Math.ceil(tile.bounds.height * scale));
        const y = atlasHeight;
        atlasHeight += height;
        atlasWidth = Math.max(atlasWidth, width);
        return { ...tile, width, height, y };
      });
      // Bucket sizes to avoid reallocating the buffer for every slider tick.
      const bucket = (value: number) => Math.min(maxSize, Math.ceil(value / 64) * 64);
      if (canvas.width !== bucket(atlasWidth)) canvas.width = bucket(atlasWidth);
      if (canvas.height !== bucket(atlasHeight)) canvas.height = bucket(atlasHeight);
      gl.uniform2f(at("backdropSize"), scene.width, scene.height);
      gl.uniform2f(at("texelScale"), source.width / scene.width, source.height / scene.height);
      gl.uniform1i(at("quality"), quality === "high" ? 1 : 0);
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.SCISSOR_TEST);
      for (const tile of packed) {
        const { bounds, material, shape, debugView, motion } = tile;
        gl.viewport(0, tile.y, tile.width, tile.height);
        gl.scissor(0, tile.y, tile.width, tile.height);
        gl.uniform2f(at("lensOrigin"), bounds.left - scene.left, bounds.top - scene.top);
        gl.uniform2f(at("lensSize"), bounds.width, bounds.height);
        gl.uniform1f(at("opticalScale"), tile.opticalScale);
        gl.uniform4f(at("geometry"), material.shellThickness, material.liquidDepth,
          material.surfaceConvexity, material.rearCurvature);
        gl.uniform4f(at("indices"), material.airIOR, material.glassIOR, material.liquidIOR, 0);
        gl.uniform4f(at("lighting"), material.internalReflectionStrength, material.causticIntensity,
          material.internalDiffusion, material.surfaceRoughness);
        gl.uniform4f(at("volume"), material.transmission, material.liquidAbsorption,
          material.chromaticDispersion, material.cornerSmoothing);
        gl.uniform4f(at("deformation"), ...motion);
        gl.uniform1f(at("bevel"), material.bevelRatio);
        gl.uniform1f(at("turbulence"), motion[3] === 0 ? 0 : material.liquidTurbulence);
        gl.uniform1i(at("circleShape"), shape === "circle" ? 1 : 0);
        gl.uniform1i(at("diagnostic"), debugView);
        gl.uniform1i(at("bounceLimit"), Math.min(4, Math.max(0, Math.floor(material.maxReflectionBounces))));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      for (const tile of packed) {
        const target = tile.canvas.canvas;
        if (target.width !== tile.width) target.width = tile.width;
        if (target.height !== tile.height) target.height = tile.height;
        tile.canvas.globalCompositeOperation = "copy";
        tile.canvas.drawImage(canvas, 0, canvas.height - tile.y - tile.height, tile.width, tile.height,
          0, 0, tile.width, tile.height);
      }
    },
    dispose() {
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    },
  };
}
