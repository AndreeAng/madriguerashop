"use client";

import { useEffect, useRef } from "react";

/*
 * Fondo del hero: "tinta líquida". Un campo de ruido fractal deformado
 * (domain warping) en los colores de marca, que se curva hacia el cursor y
 * deja una luz magenta donde está el puntero. WebGL 1 puro, sin librerías.
 *
 * Disciplina:
 *  - Arranca cuando el navegador queda libre, no compite con la carga.
 *  - Renderiza a resolución reducida (es un degradado: se escala sin perder).
 *  - Se pausa fuera de pantalla y con la pestaña oculta.
 *  - Movimiento reducido: dibuja un solo cuadro fijo, sin seguir el cursor.
 *  - Sin WebGL: el canvas no aparece y queda el degradado CSS de abajo.
 *  - Oscurece la zona del texto (izquierda en escritorio, arriba en
 *    vertical) para que el contraste del titular no dependa del cuadro.
 *
 * Además publica la posición del cursor como --mx/--my (-1..1) en la
 * sección, para que el teléfono del hero se incline levemente hacia él.
 */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_portrait;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(u_mouse.x * aspect, u_mouse.y);
  float t = u_time * 0.06;

  vec2 q = vec2(fbm(p * 1.5 + t), fbm(p * 1.5 - t + 4.2));
  float d = distance(p, m);
  vec2 r = vec2(
    fbm(p * 1.35 + 2.0 * q + vec2(1.7, 9.2) + t * 1.3),
    fbm(p * 1.35 + 2.0 * q + vec2(8.3, 2.8) - t * 1.1)
  );
  // El campo se curva hacia el cursor.
  r += (m - p) * 0.5 * exp(-d * 2.0);
  float f = fbm(p * 1.15 + 2.6 * r);

  vec3 ink  = vec3(0.071, 0.063, 0.086);
  vec3 deep = vec3(0.40, 0.03, 0.18);
  vec3 mag  = vec3(0.83, 0.08, 0.35);
  vec3 saf  = vec3(1.0, 0.70, 0.12);

  vec3 col = ink;
  col = mix(col, deep, smoothstep(0.28, 0.62, f));
  col = mix(col, mag, smoothstep(0.50, 0.84, f) * 0.85);
  col = mix(col, saf, smoothstep(0.70, 0.95, r.x * f + 0.18) * 0.6);

  // Curvas de nivel que fluyen con la tinta: la firma del fondo.
  float lines = fract(f * 9.0);
  float ridge = smoothstep(0.06, 0.0, abs(lines - 0.5)) * smoothstep(0.25, 0.55, f);
  col += mix(mag, saf, smoothstep(0.55, 0.85, f)) * ridge * 0.35;

  // Luz que sigue al puntero.
  col += mag * 0.32 * exp(-d * 3.0);

  // Zona del texto más oscura: izquierda en horizontal, arriba en vertical.
  // La columna del texto queda en sombra completa; el color vive del lado
  // del teléfono (derecha en horizontal, abajo en vertical).
  float side = mix(smoothstep(0.42, 0.92, uv.x), smoothstep(0.6, 0.2, uv.y), u_portrait);
  col *= mix(0.4, 1.0, side);
  col *= mix(0.65, 1.0, smoothstep(0.0, 0.3, uv.y));
  // Franja superior más oscura: ahí van el logo y la navegación.
  col *= mix(0.45, 1.0, smoothstep(1.0, 0.84, uv.y));

  // Ruido de 1-2 niveles para que el degradado no haga bandas.
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) * (2.0 / 255.0);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export function HeroShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = canvas?.parentElement;
    if (!canvas || !section) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let running = false;
    let disposed = false;
    const mouse = { x: 0.78, y: 0.62, tx: 0.78, ty: 0.62 };
    const cleanups: Array<() => void> = [];

    const start = () => {
      if (disposed) return;
      const gl = canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
        depth: false,
        powerPreference: "low-power",
        premultipliedAlpha: false,
      });
      if (!gl) return;

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) return;
      const prog = gl.createProgram();
      if (!prog) return;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, "u_res");
      const uTime = gl.getUniformLocation(prog, "u_time");
      const uMouse = gl.getUniformLocation(prog, "u_mouse");
      const uPortrait = gl.getUniformLocation(prog, "u_portrait");

      // Resolución reducida: la mitad en pantallas chicas, 0.6 en grandes.
      const resize = () => {
        const rect = section.getBoundingClientRect();
        const small = rect.width < 768;
        // Tope de ancho: en pantallas 2x el canvas no crece sin límite.
        const maxW = small ? 420 : 960;
        const scale = Math.min(
          (small ? 0.5 : 0.6) * Math.min(window.devicePixelRatio || 1, 1.5),
          maxW / Math.max(1, rect.width),
        );
        canvas.width = Math.max(1, Math.round(rect.width * scale));
        canvas.height = Math.max(1, Math.round(rect.height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uPortrait, rect.width < 1024 ? 1 : 0);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(section);
      cleanups.push(() => ro.disconnect());

      const t0 = performance.now();
      const draw = (now: number) => {
        mouse.x += (mouse.tx - mouse.x) * 0.06;
        mouse.y += (mouse.ty - mouse.y) * 0.06;
        gl.uniform1f(uTime, reduce ? 12 : (now - t0) / 1000);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const loop = (now: number) => {
        if (!running) return;
        draw(now);
        raf = requestAnimationFrame(loop);
      };
      const play = () => {
        if (reduce || running || !visible || document.hidden) return;
        running = true;
        raf = requestAnimationFrame(loop);
      };
      const pause = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      // Primer cuadro y aparición suave sobre el degradado CSS.
      draw(performance.now());
      canvas.dataset.ready = "true";
      play();

      const io = new IntersectionObserver(([e]) => {
        visible = !!e?.isIntersecting;
        if (visible) play();
        else pause();
      });
      io.observe(section);
      cleanups.push(() => io.disconnect());

      const onVis = () => (document.hidden ? pause() : play());
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => document.removeEventListener("visibilitychange", onVis));

      if (!reduce) {
        const onMove = (e: PointerEvent) => {
          const rect = section.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width;
          const y = (e.clientY - rect.top) / rect.height;
          if (y < -0.2 || y > 1.2) return;
          mouse.tx = Math.min(1.1, Math.max(-0.1, x));
          mouse.ty = 1 - Math.min(1.1, Math.max(-0.1, y));
          section.style.setProperty("--mx", (x * 2 - 1).toFixed(3));
          section.style.setProperty("--my", (y * 2 - 1).toFixed(3));
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onMove));
      }

      const onLost = (e: Event) => {
        e.preventDefault();
        pause();
        canvas.dataset.ready = "false";
      };
      canvas.addEventListener("webglcontextlost", onLost);
      cleanups.push(() => canvas.removeEventListener("webglcontextlost", onLost));
      cleanups.push(pause);
    };

    // No competir con la carga de la página.
    const idle =
      "requestIdleCallback" in window
        ? window.requestIdleCallback(start, { timeout: 1500 })
        : globalThis.setTimeout(start, 300);
    return () => {
      disposed = true;
      if ("cancelIdleCallback" in window) window.cancelIdleCallback(idle as number);
      else globalThis.clearTimeout(idle as number);
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="mk-shader pointer-events-none absolute inset-0 size-full"
    />
  );
}
