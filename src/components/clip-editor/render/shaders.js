// The preview's shaders (plan P1 and P3, ADM-1199). Each one reproduces the formula of the ffmpeg filter it names
// (ffmpeg 7.1, the production build), per pixel; constants and tables come from ffmpegMath.js.
//
// Conventions, the same in every pass except `present`:
// - A pixel is addressed like ffmpeg addresses it: integer x from the left, integer y from the TOP. Every texture and
//   every framebuffer stores row 0 at the top (textures are uploaded without a flip, framebuffers are written at
//   gl_FragCoord.y = y + 0.5), so texelFetch(tex, ivec2(x, y)) means the same pixel everywhere.
// - Colours are straight (not premultiplied) RGBA in 0..1, as ffmpeg's yuva/gbra planes are.
// - Where a filter works on YUV (unsharp, chromakey, the matte's gray), the conversion is BT.601 limited range
//   (swscale's default for an untagged picture, as the export gets).

export const VERTEX = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp sampler3D;
out vec4 o;
ivec2 pix() { return ivec2(gl_FragCoord.xy); }
vec4 at(sampler2D t, ivec2 p) { ivec2 s = textureSize(t, 0); return texelFetch(t, clamp(p, ivec2(0), s - 1), 0); }
// BT.601 limited range, 8-bit scale (Y 16..235, U/V 16..240).
vec3 toYuv(vec3 c) { return vec3(16.0 + 65.481 * c.r + 128.553 * c.g + 24.966 * c.b,
                                 128.0 - 37.797 * c.r - 74.203 * c.g + 112.0 * c.b,
                                 128.0 + 112.0 * c.r - 93.786 * c.g - 18.214 * c.b); }
vec3 toRgb(vec3 y) { float l = 1.164383562 * (y.x - 16.0); float u = y.y - 128.0, v = y.z - 128.0;
                     return vec3(l + 1.596026786 * v, l - 0.391762290 * u - 0.812967647 * v, l + 2.017232143 * u) / 255.0; }
`

// ── the clip's picture: crop, fitted to the canvas (contain or cover), slow zoom (compositor._crop_fit) ───────────
// For a picture pixel (x, y): its place in the scaled (and, for cover, centre-cropped) image, then in the crop box of
// the source, sampled bilinearly. ffmpeg scales bicubic; this samples bilinear (the same when nothing is scaled).
export const PICTURE = HEAD + `
uniform sampler2D u_src;
uniform vec2 u_srcSize;     // the source's pixel size
uniform vec4 u_crop;        // crop box in source pixels: x, y, w, h
uniform vec2 u_scaled;      // the scaled size of the crop box
uniform vec2 u_off;         // the cover crop's offset in the scaled image
uniform vec2 u_texScale;    // picture texels per logical picture pixel (1 unless the picture was capped)
uniform float u_zoom;       // zoompan factor (1 = none), centred
void main() {
  vec2 p = (vec2(pix()) + 0.5) / u_texScale + u_off;
  vec2 c = u_scaled * 0.5;
  p = c + (p - c) / u_zoom;
  vec2 s = u_crop.xy + p / u_scaled * u_crop.zw;
  o = texture(u_src, s / u_srcSize);
}`

// ── effects on the picture ──────────────────────────────────────────────────────────────────────────────────────
const EFFECT_HEAD = HEAD + `uniform sampler2D u_in;\n`

// vf_vibrance (8-bit, editor_filters.fx_adjust): luma = 0.715158 g + 0.212656 r + 0.072186 b (what the filter does
// with its defaults, checked against ffmpeg on solid colours), balance 1, alternate off.
export const VIBRANCE = EFFECT_HEAD + `
uniform float u_intensity;
void main() {
  vec4 c = at(u_in, pix());
  vec3 q = floor(clamp(c.rgb, 0.0, 1.0) * 255.0 + 0.5) / 255.0;
  float mx = max(q.r, max(q.g, q.b)), mn = min(q.r, min(q.g, q.b));
  float sat = mx - mn;
  float luma = q.g * 0.715158 + q.r * 0.212656 + q.b * 0.072186;
  // cg = 1 + intensity (1 - alternate FFSIGN(intensity) sat), alternate = -1
  float sgn = u_intensity > 0.0 ? 1.0 : -1.0;
  float k = 1.0 + u_intensity * (1.0 + sgn * sat);
  vec3 r = luma + (q - luma) * k;
  o = vec4(clamp(floor(r * 255.0) / 255.0, 0.0, 1.0), c.a);
}`

// colorchannelmixer (8-bit; the saturation matrix of editor_filters.saturation_matrix): each output channel is
// clip(lrint(r m0) + lrint(g m1) + lrint(b m2)), as the filter's per-coefficient tables give.
export const CCM = EFFECT_HEAD + `
uniform vec3 u_r, u_g, u_b;   // rows: the input weights of output red, green, blue
void main() {
  vec4 c = at(u_in, pix());
  vec3 v = floor(clamp(c.rgb, 0.0, 1.0) * 255.0 + 0.5);
  vec3 o3 = vec3(dot(roundEven(v * u_r), vec3(1.0)), dot(roundEven(v * u_g), vec3(1.0)), dot(roundEven(v * u_b), vec3(1.0)));
  o = vec4(clamp(o3, 0.0, 255.0) / 255.0, c.a);
}`

// lutrgb (Adjust) and vf_curves: three 8-bit tables (rows 0, 1, 2 of a 256 x 3 texture: red, green, blue); for
// curves the master curve is already folded in.
export const CURVES = EFFECT_HEAD + `
uniform sampler2D u_tables;
void main() {
  vec4 c = at(u_in, pix());
  ivec3 i = ivec3(clamp(floor(c.rgb * 255.0 + 0.5), 0.0, 255.0));
  o = vec4(texelFetch(u_tables, ivec2(i.r, 0), 0).r, texelFetch(u_tables, ivec2(i.g, 1), 0).r, texelFetch(u_tables, ivec2(i.b, 2), 0).r, c.a);
}`

// vf_huesaturation, 8-bit, one colour range (do_slice_8_0): the integer matrix, weighted by how much the pixel is of
// the chosen colours, mixed with lerpi8 (FAST_DIV255).
export const HUESAT = EFFECT_HEAD + `
uniform int u_m[9];
uniform int u_colors;
uniform float u_strength;
int div255(int x) { return ((x + 128) * 257) >> 16; }
void main() {
  vec4 c = at(u_in, pix());
  ivec3 v = ivec3(clamp(floor(c.rgb * 255.0 + 0.5), 0.0, 255.0));
  int ir = v.r, ig = v.g, ib = v.b;
  int mn = min(ir, min(ig, ib)), mx = max(ir, max(ig, ib));
  int flags = (ir == mx ? 1 : 0) | (ir == mn ? 8 : 0) | (ig == mx ? 4 : 0) | (ig == mn ? 32 : 0) | (ib == mx ? 16 : 0) | (ib == mn ? 2 : 0);
  ivec3 r = v;
  if ((u_colors & flags) != 0) {
    int f = 0;
    if ((u_colors & 1) != 0) f = max(f, ir - max(ig, ib));
    if ((u_colors & 2) != 0) f = max(f, min(ir, ig) - ib);
    if ((u_colors & 4) != 0) f = max(f, ig - max(ir, ib));
    if ((u_colors & 8) != 0) f = max(f, min(ig, ib) - ir);
    if ((u_colors & 16) != 0) f = max(f, ib - max(ir, ig));
    if ((u_colors & 32) != 0) f = max(f, min(ir, ib) - ig);
    f = int(min(float(f) * u_strength, 255.0));
    int nr = (ir * u_m[0] + ig * u_m[3] + ib * u_m[6]) >> 16;
    int ng = (ir * u_m[1] + ig * u_m[4] + ib * u_m[7]) >> 16;
    int nb = (ir * u_m[2] + ig * u_m[5] + ib * u_m[8]) >> 16;
    r = ivec3(ir + div255((nr - ir) * f), ig + div255((ng - ig) * f), ib + div255((nb - ib) * f));
  }
  o = vec4(vec3(clamp(r, 0, 255)) / 255.0, c.a);
}`

// vf_lut3d, tetrahedral interpolation (the filter's default), then mixed with the original by intensity.
export const LUT3D = EFFECT_HEAD + `
uniform sampler3D u_lut;
uniform float u_size;
uniform vec3 u_domain;   // lut3d->scale
uniform float u_intensity;
vec3 L(ivec3 i) { return texelFetch(u_lut, i, 0).rgb; }
void main() {
  vec4 c = at(u_in, pix());
  float mx = u_size - 1.0;
  vec3 s = clamp(clamp(c.rgb, 0.0, 1.0) * u_domain * mx, 0.0, mx);
  ivec3 p = ivec3(s);
  ivec3 n = min(p + 1, ivec3(int(mx)));
  vec3 d = s - vec3(p);
  vec3 c000 = L(p), c111 = L(n), r;
  if (d.r > d.g) {
    if (d.g > d.b) { r = (1.0 - d.r) * c000 + (d.r - d.g) * L(ivec3(n.x, p.y, p.z)) + (d.g - d.b) * L(ivec3(n.x, n.y, p.z)) + d.b * c111; }
    else if (d.r > d.b) { r = (1.0 - d.r) * c000 + (d.r - d.b) * L(ivec3(n.x, p.y, p.z)) + (d.b - d.g) * L(ivec3(n.x, p.y, n.z)) + d.g * c111; }
    else { r = (1.0 - d.b) * c000 + (d.b - d.r) * L(ivec3(p.x, p.y, n.z)) + (d.r - d.g) * L(ivec3(n.x, p.y, n.z)) + d.g * c111; }
  } else {
    if (d.b > d.g) { r = (1.0 - d.b) * c000 + (d.b - d.g) * L(ivec3(p.x, p.y, n.z)) + (d.g - d.r) * L(ivec3(p.x, n.y, n.z)) + d.r * c111; }
    else if (d.b > d.r) { r = (1.0 - d.g) * c000 + (d.g - d.b) * L(ivec3(p.x, n.y, p.z)) + (d.b - d.r) * L(ivec3(p.x, n.y, n.z)) + d.r * c111; }
    else { r = (1.0 - d.g) * c000 + (d.g - d.r) * L(ivec3(p.x, n.y, p.z)) + (d.r - d.b) * L(ivec3(n.x, n.y, p.z)) + d.b * c111; }
  }
  o = vec4(clamp(mix(c.rgb, r, u_intensity), 0.0, 1.0), c.a);
}`

// vf_gblur as one axis of an FIR kernel equal to its recursive filter (ffmpegMath.gblurKernel): edges repeat (the
// recursive filter's boundary scale). planes=7 (as the export): colour only, alpha kept (u_alpha = 0). Run twice:
// horizontal, then vertical.
// u_stride > 1 skips taps (only when playback falls behind; never for an exact frame).
export const GBLUR = EFFECT_HEAD + `
uniform sampler2D u_kernel;   // R32F, width = taps (centre first)
uniform int u_taps;
uniform ivec2 u_dir;
uniform int u_stride;
uniform int u_alpha;
void main() {
  ivec2 p = pix();
  vec4 sum = at(u_in, p) * texelFetch(u_kernel, ivec2(0, 0), 0).r;
  float wsum = texelFetch(u_kernel, ivec2(0, 0), 0).r;
  for (int i = 1; i < 1024; i += 1) {
    int k = i * u_stride;
    if (k >= u_taps) break;
    float w = texelFetch(u_kernel, ivec2(k, 0), 0).r * float(u_stride);
    sum += (at(u_in, p + u_dir * k) + at(u_in, p - u_dir * k)) * w;
    wsum += 2.0 * w;
  }
  vec4 r = u_stride > 1 ? sum / wsum : sum;
  o = u_alpha == 1 ? r : vec4(r.rgb, at(u_in, p).a);
}`

// vf_unsharp, luma only (lx = ly = 5, la = amount, chroma 0): the blur is the filter's cascade of pair sums, a 5 x 5
// binomial kernel (1 4 6 4 1)^2 / 256 with repeated edges; Y' = Y + (Y - blur) * amount; U and V kept.
export const UNSHARP = EFFECT_HEAD + `
uniform float u_amount;
float Y(ivec2 p) { return dot(at(u_in, p).rgb, vec3(65.481, 128.553, 24.966)) + 16.0; }
void main() {
  ivec2 p = pix();
  float k[5] = float[5](1.0, 4.0, 6.0, 4.0, 1.0);
  float b = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) b += k[i + 2] * k[j + 2] * floor(Y(p + ivec2(i, j)) + 0.5);
  b = floor(b / 256.0 + 0.5);
  vec4 c = at(u_in, p);
  float y = floor(Y(p) + 0.5);
  float ny = clamp(y + floor((y - b) * u_amount), 0.0, 255.0);
  o = vec4(clamp(c.rgb + (ny - y) / 219.0, 0.0, 1.0), c.a);
}`

// vf_vignette (forward, dither 0) on 8-bit RGB (editor_filters.fx_vignette): out = trunc(in cos(A d)^4) with
// d = hypot(x - w/2, y - h/2) / hypot(w/2, h/2) (the offsets truncated to integers first), 0 when d > 1; alpha kept.
export const VIGNETTE = EFFECT_HEAD + `
uniform float u_angle;
void main() {
  ivec2 p = pix(); ivec2 s = textureSize(u_in, 0);
  vec2 c = vec2(s) / 2.0;
  float xx = float(int(float(p.x) - c.x)), yy = float(int(float(p.y) - c.y));
  float d = length(vec2(xx, yy)) / length(c);
  float f = 0.0;
  if (d <= 1.0) { float k = cos(u_angle * d); f = (k * k) * (k * k); }
  vec4 col = at(u_in, p);
  vec3 v = floor(clamp(col.rgb, 0.0, 1.0) * 255.0 + 0.5);
  o = vec4(floor(v * f) / 255.0, col.a);
}`

// The mask (editor_filters.mask_expr, drawn by geq on the alpha plane), at integer pixel (X, Y) of a W x H picture:
//   dx = X - x W, dy = Y - y H; a = rotation (degrees, clockwise): px = dx cos a + dy sin a, py = -dx sin a + dy cos a
//   hw = max(w W / 2, 0.5), hh = max(h H / 2, 0.5), F = max(feather min(W, H) / 2, 0.5)
//   rect d = max(|px| - hw, |py| - hh); ellipse d = (hypot(px / hw, py / hh) - 1) min(hw, hh); linear d = py;
//   mirror d = |py| - hh;  m = clamp(0.5 - d / F, 0, 1), inverted when asked;  alpha' = trunc(alpha m) (8-bit)
export const MASK = EFFECT_HEAD + `
uniform int u_shape;          // 0 rect, 1 ellipse, 2 linear, 3 mirror
uniform vec4 u_box;           // x, y, w, h (shares of the picture)
uniform float u_rotation, u_feather;
uniform int u_invert;
void main() {
  ivec2 ip = pix(); vec2 S = vec2(textureSize(u_in, 0));
  vec2 d = vec2(ip) - u_box.xy * S;
  float a = u_rotation * 3.14159265358979 / 180.0;
  float px = d.x * cos(a) + d.y * sin(a), py = -d.x * sin(a) + d.y * cos(a);
  float hw = max(u_box.z * S.x / 2.0, 0.5), hh = max(u_box.w * S.y / 2.0, 0.5);
  float F = max(u_feather * min(S.x, S.y) / 2.0, 0.5);
  float dist;
  if (u_shape == 1) dist = (length(vec2(px / hw, py / hh)) - 1.0) * min(hw, hh);
  else if (u_shape == 2) dist = py;
  else if (u_shape == 3) dist = abs(py) - hh;
  else dist = max(abs(px) - hw, abs(py) - hh);
  float m = clamp(0.5 - dist / F, 0.0, 1.0);
  if (u_invert == 1) m = 1.0 - m;
  vec4 c = at(u_in, ip);
  o = vec4(c.rgb, floor(floor(c.a * 255.0 + 0.5) * m) / 255.0);
}`

// vf_chromakey (8-bit): the mean over the 3 x 3 neighbourhood of sqrt((du^2 + dv^2) / (255^2 * 2)) from the key's U,V
// (pixels' U,V in BT.601 limited range, the key's by RGB_TO_U/V); alpha = clip((diff - similarity) / blend) or a hard
// step; written as 8 bits. ffmpeg REPLACES the alpha plane; here it multiplies (equal when the clip had no alpha).
export const CHROMAKEY = EFFECT_HEAD + `
uniform vec2 u_key;
uniform float u_similarity, u_blend;
void main() {
  ivec2 p = pix(); ivec2 s = textureSize(u_in, 0);
  float diff = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    ivec2 q = p + ivec2(i, j);
    vec2 uv = u_key;
    if (q.x >= 0 && q.y >= 0 && q.x < s.x && q.y < s.y) uv = clamp(floor(toYuv(texelFetch(u_in, q, 0).rgb).yz + 0.5), 0.0, 255.0);
    vec2 d = uv - u_key;
    diff += sqrt((d.x * d.x + d.y * d.y) / (255.0 * 255.0 * 2.0));
  }
  diff /= 9.0;
  float a = u_blend > 0.0001 ? clamp((diff - u_similarity) / u_blend, 0.0, 1.0) : (diff > u_similarity ? 1.0 : 0.0);
  a = floor(a * 255.0) / 255.0;
  vec4 c = at(u_in, p);
  o = vec4(c.rgb, c.a * a);
}`

// vf_despill: spillmap = max(key channel - (other1 * mix + other2 * factor), 0) with factor = (1 - mix)(1 - expand);
// each channel += spillmap * its scale (green screen: green -1; blue screen: blue -1); mixed with the original by the
// registry's spill amount.
export const DESPILL = EFFECT_HEAD + `
uniform int u_blue;
uniform float u_mix, u_expand, u_amount;
void main() {
  vec4 c = at(u_in, pix());
  float factor = (1.0 - u_mix) * (1.0 - u_expand);
  float sp = u_blue == 1 ? max(c.b - (c.r * u_mix + c.g * factor), 0.0) : max(c.g - (c.r * u_mix + c.b * factor), 0.0);
  vec3 r = c.rgb + sp * (u_blue == 1 ? vec3(0.0, 0.0, -1.0) : vec3(0.0, -1.0, 0.0));
  o = vec4(clamp(mix(c.rgb, max(r, 0.0), u_amount), 0.0, 1.0), c.a);
}`

// Background removal (editor_filters.fx_bg_removal): the matte in FULL range, as the export converts it
// (in_range=tv:out_range=pc: m = clamp((Y - 16) * 255 / 219), so Y 16 is 0 and Y 235 is 255), times the clip's alpha,
// an 8-bit blend multiply: a' = a * m / 255 (integer division).
export const MATTE = EFFECT_HEAD + `
uniform sampler2D u_matte;
void main() {
  ivec2 p = pix(); vec4 c = at(u_in, p);
  float ly = floor(toYuv(clamp(at(u_matte, p).rgb, 0.0, 1.0)).x + 0.5);
  float y = clamp(floor((ly - 16.0) * 255.0 / 219.0 + 0.5), 0.0, 255.0);
  float a = floor(c.a * 255.0 + 0.5);
  o = vec4(c.rgb, floor(a * y / 255.0) / 255.0);
}`

// ── turning the picture (compositor.py _transform: pad, fillborders, rotate) ────────────────────────────────────
// The picture, flipped, gets ROTATE_PAD pixels on each side that hold its edge colours with alpha 0, and is turned onto
// a square of side round(hypot(padded w, h)). Output pixel (i, j) reads the padded picture at x = x0 + j s + i c,
// y = y0 + j c - i s (16.16 fixed point, ffmpegMath.rotateSteps), interpolated as interpolate_bilinear8 on each plane
// of the yuva444p picture; where nothing is read, transparent black. With u_yuvOut it writes Y, U, V, A / 255 for the
// SCALE pass; otherwise RGBA.
const YUVA = `
vec4 rgbOf(vec4 v) { return vec4(toRgb(v.xyz), v.w / 255.0); }
ivec4 yuvaOf(vec4 c) { return ivec4(ivec3(floor(toYuv(clamp(c.rgb, 0.0, 1.0)) + 0.5)), int(floor(c.a * 255.0 + 0.5))); }
`
export const ROTATE = HEAD + YUVA + `
uniform sampler2D u_pic;
uniform ivec2 u_picSize;  // the picture, before padding
uniform int u_pad;
uniform ivec2 u_step;     // s, c
uniform ivec2 u_start;    // x0, y0
uniform ivec2 u_flip;
uniform int u_yuvOut;
ivec4 padded(ivec2 q) {
  ivec2 p = q - u_pad;
  bool inside = all(greaterThanEqual(p, ivec2(0))) && all(lessThan(p, u_picSize));
  p = clamp(p, ivec2(0), u_picSize - 1);
  if (u_flip.x == 1) p.x = u_picSize.x - 1 - p.x;
  if (u_flip.y == 1) p.y = u_picSize.y - 1 - p.y;
  ivec4 v = yuvaOf(texelFetch(u_pic, p, 0));
  if (!inside) v.w = 0;
  return v;
}
// ((65536 - fy) s0 + fy s1) >> 32 without 64-bit integers: 65536 s0 + fy (s1 - s0), split into 16-bit halves.
int lerpY(int s0, int s1, int fy) {
  int d = s1 - s0;
  int m = (s0 & 0xFFFF) + fy * (d >> 16);
  uint n = uint(fy) * uint(d & 0xFFFF);
  return (s0 >> 16) + ((m + int(n >> 16u)) >> 16);
}
void main() {
  ivec2 ij = pix();
  int x = u_start.x + ij.y * u_step.x + ij.x * u_step.y;
  int y = u_start.y + ij.y * u_step.y - ij.x * u_step.x;
  int x1 = x >> 16, y1 = y >> 16;
  ivec2 n = u_picSize + 2 * u_pad;
  vec4 v = vec4(16.0, 128.0, 128.0, 0.0);
  if (x1 >= -1 && x1 <= n.x && y1 >= -1 && y1 <= n.y) {
    int ix = clamp(x1, 0, n.x - 1), iy = clamp(y1, 0, n.y - 1);
    int ix1 = min(ix + 1, n.x - 1), iy1 = min(iy + 1, n.y - 1);
    int fx = x & 0xFFFF, fy = y & 0xFFFF;
    ivec4 s0 = (65536 - fx) * padded(ivec2(ix, iy)) + fx * padded(ivec2(ix1, iy));
    ivec4 s1 = (65536 - fx) * padded(ivec2(ix, iy1)) + fx * padded(ivec2(ix1, iy1));
    for (int k = 0; k < 4; k++) v[k] = float(lerpY(s0[k], s1[k], fy));
  }
  o = u_yuvOut == 1 ? v / 255.0 : rgbOf(v);
}`

// ── scaling the picture (compositor.py _transform: scale, swscale bicubic) ─────────────────────────────────────
// Per plane of the yuva444p picture, as ffmpegMath.swsScalePlane: across into 15 bits (sum >> 7), then down with
// rounding (sum + 2^18) >> 19. u_filt (R32F) holds both filters of ffmpegMath.swsFilters: row 0 the first source
// column of each output column, rows 1..taps.x its weights; then one row of first source rows and taps.y rows of
// weights. The input is Y, U, V, A / 255 when u_yuvIn (from ROTATE), else RGBA; the flip applies to the input.
const SWS = `
uniform sampler2D u_filt;
uniform ivec2 u_taps;
int tap(int x, int row) { return int(texelFetch(u_filt, ivec2(x, row), 0).r); }
`
export const SCALE = HEAD + YUVA + SWS + `
uniform sampler2D u_in;
uniform ivec2 u_inSize;
uniform int u_yuvIn;
uniform ivec2 u_flip;
ivec4 at(int x, int y) {
  if (u_flip.x == 1) x = u_inSize.x - 1 - x;
  if (u_flip.y == 1) y = u_inSize.y - 1 - y;
  vec4 c = texelFetch(u_in, ivec2(x, y), 0);
  return u_yuvIn == 1 ? ivec4(floor(c * 255.0 + 0.5)) : yuvaOf(c);
}
void main() {
  ivec2 p = pix();
  int vrow = u_taps.x + 1;
  int hp = tap(p.x, 0), vp = tap(p.y, vrow);
  ivec4 acc = ivec4(64 << 12);
  for (int k = 0; k < u_taps.y; k++) {
    int wv = tap(p.y, vrow + 1 + k);
    if (wv == 0) continue;
    int row = min(vp + k, u_inSize.y - 1);
    ivec4 h = ivec4(0);
    for (int j = 0; j < u_taps.x; j++) {
      int wh = tap(p.x, 1 + j);
      if (wh != 0) h += at(min(hp + j, u_inSize.x - 1), row) * wh;
    }
    acc += min(h >> 7, ivec4(32767)) * wv;
  }
  o = rgbOf(vec4(clamp(acc >> 19, ivec4(0), ivec4(255))));
}`

// ── placing the picture on the full canvas (compositor.py _transform and the overlay) ───────────────────────────
// hflip/vflip → opacity (colorchannelmixer aa) → rotate and scale (the ROTATE and SCALE passes, which hand this pass
// the finished picture) → overlay with the centre at (x W, y H), the corner truncated to a whole pixel (overlay's
// normalize_xy on the 4:4:4 layer). A picture neither turned nor scaled is flipped here. Read backwards for each
// output pixel.
export const PLACE = HEAD + `
uniform sampler2D u_pic;
uniform ivec2 u_picSize;  // the finished picture (pixels)
uniform ivec2 u_origin;   // overlay position (whole pixels)
uniform ivec2 u_flip;     // 1 when flipped
uniform float u_opacity;
void main() {
  ivec2 r = pix() - u_origin;
  vec4 c = vec4(0.0);
  if (all(greaterThanEqual(r, ivec2(0))) && all(lessThan(r, u_picSize))) {
    if (u_flip.x == 1) r.x = u_picSize.x - 1 - r.x;
    if (u_flip.y == 1) r.y = u_picSize.y - 1 - r.y;
    c = texelFetch(u_pic, r, 0);
  }
  o = vec4(c.rgb, c.a * u_opacity);
}`

// The clip over its own layer's background (the blurred copy behind a main-track clip): overlay on a yuva canvas,
// straight alpha: rgb = mix(below, clip, a); alpha = a + below alpha (1 - a).
export const OVER = HEAD + `
uniform sampler2D u_base, u_layer;
void main() {
  ivec2 p = pix();
  vec4 b = texelFetch(u_base, p, 0), l = texelFetch(u_layer, p, 0);
  o = vec4(mix(b.rgb, l.rgb, l.a), l.a + b.a * (1.0 - l.a));
}`

// ── the 20 transitions: vf_xfade.c, per pixel, on two full-canvas pictures; progress falls from 1 to 0 ───────────
export const XFADE_IDS = { crossfade: 0, dissolve: 1, fade_black: 2, fade_white: 3, wipe_left: 4, wipe_right: 5, wipe_up: 6, wipe_down: 7,
  slide_left: 8, slide_right: 9, slide_up: 10, slide_down: 11, smooth_left: 12, smooth_right: 13, circle_open: 14, circle_close: 15,
  radial: 16, pixelize: 17, zoom_in: 18, blur: 19 }
export const XFADE = HEAD + `
uniform sampler2D u_a, u_b;
uniform sampler2D u_noise;   // frand(x, y), computed in float32 on the CPU (ffmpegMath.frandTable)
uniform int u_kind;
uniform float u_progress;
uniform int u_stride;        // hblur only: > 1 skips samples while playback is behind
// mix(a, b, m) = a * m + b * (1 - m), as in vf_xfade.c
vec4 mx(vec4 a, vec4 b, float m) { return a * m + b * (1.0 - m); }
float ss(float e0, float e1, float x) { float t = clamp((x - e0) / (e1 - e0), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
// C's % for a possibly negative left side (GLSL leaves it undefined).
int cmod(int a, int b) { return a >= 0 ? a - (a / b) * b : -((-a) - ((-a) / b) * b); }
vec4 A(ivec2 p) { return texelFetch(u_a, p, 0); }
vec4 B(ivec2 p) { return texelFetch(u_b, p, 0); }
void main() {
  ivec2 p = pix(); ivec2 S = textureSize(u_a, 0);
  int x = p.x, y = p.y, width = S.x, height = S.y;
  float P = u_progress;
  vec4 a = A(p), b = B(p);
  // fadeblack/fadewhite mix towards black/white in YUV (Y 0 or 255, U = V = 128) with alpha 255: in RGB that is
  // (-16/219) or (239/219) on every channel.
  const float BLACK = -16.0 / 219.0, WHITE = 239.0 / 219.0;
  if (u_kind == 0) { o = mx(a, b, P); }
  else if (u_kind == 1) { float sm = texelFetch(u_noise, p, 0).r * 2.0 + P * 2.0 - 1.5; o = sm >= 0.5 ? a : b; }
  else if (u_kind == 2 || u_kind == 3) {
    vec4 bg = vec4(vec3(u_kind == 2 ? BLACK : WHITE), 1.0);
    o = mx(mx(a, bg, ss(0.8, 1.0, P)), mx(bg, b, ss(0.2, 1.0, P)), P);
  }
  else if (u_kind == 4) { int z = int(float(width) * P); o = x > z ? b : a; }
  else if (u_kind == 5) { int z = int(float(width) * (1.0 - P)); o = x > z ? a : b; }
  else if (u_kind == 6) { int z = int(float(height) * P); o = y > z ? b : a; }
  else if (u_kind == 7) { int z = int(float(height) * (1.0 - P)); o = y > z ? a : b; }
  else if (u_kind == 8 || u_kind == 9) {
    int z = u_kind == 8 ? int(-P * float(width)) : int(P * float(width));
    int zx = z + x;
    int zz = cmod(zx, width) + width * (zx < 0 ? 1 : 0);
    o = (zx >= 0 && zx < width) ? B(ivec2(zz, y)) : A(ivec2(zz, y));
  }
  else if (u_kind == 10 || u_kind == 11) {
    int z = u_kind == 10 ? int(-P * float(height)) : int(P * float(height));
    int zy = z + y;
    int zz = cmod(zy, height) + height * (zy < 0 ? 1 : 0);
    o = (zy >= 0 && zy < height) ? B(ivec2(x, zz)) : A(ivec2(x, zz));
  }
  else if (u_kind == 12) { float sm = 1.0 + float(x) / float(width) - P * 2.0; o = mx(b, a, ss(0.0, 1.0, sm)); }
  else if (u_kind == 13) { float w = float(width); float sm = 1.0 + (w - 1.0 - float(x)) / w - P * 2.0; o = mx(b, a, ss(0.0, 1.0, sm)); }
  else if (u_kind == 14 || u_kind == 15) {
    float z = length(vec2(float(width / 2), float(height / 2)));
    float pp = u_kind == 14 ? (P - 0.5) * 3.0 : (1.0 - P - 0.5) * 3.0;
    float sm = length(vec2(float(x - width / 2), float(y - height / 2))) / z + pp;
    o = u_kind == 14 ? mx(a, b, ss(0.0, 1.0, sm)) : mx(b, a, ss(0.0, 1.0, sm));
  }
  else if (u_kind == 16) {
    float sm = atan(float(x - width / 2), float(y - height / 2)) - (P - 0.5) * (3.14159265358979 * 2.5);
    o = mx(b, a, ss(0.0, 1.0, sm));
  }
  else if (u_kind == 17) {
    float d = min(P, 1.0 - P);
    float dist = ceil(d * 50.0) / 50.0;
    float sq = 2.0 * dist * float(min(width, height)) / 20.0;
    int sx = dist > 0.0 ? int(min((floor(float(x) / sq) + 0.5) * sq, float(width - 1))) : x;
    int sy = dist > 0.0 ? int(min((floor(float(y) / sq) + 0.5) * sq, float(height - 1))) : y;
    o = mx(A(ivec2(sx, sy)), B(ivec2(sx, sy)), P);
  }
  else if (u_kind == 18) {
    float w = float(width), h = float(height);
    float zf = ss(0.5, 1.0, P);
    float u = 0.5 + (float(x) / w - 0.5) * zf, v = 0.5 + (float(y) / h - 0.5) * zf;
    ivec2 q = ivec2(int(ceil(u * (w - 1.0))), int(ceil(v * (h - 1.0))));
    o = mx(A(q), b, ss(0.0, 0.5, P));
  }
  else if (u_kind == 19) {
    float prog = P <= 0.5 ? P * 2.0 : (1.0 - P) * 2.0;
    int size = int(1.0 + float(width / 2) * prog);
    int cnt = min(size, width - x);
    vec4 s0 = vec4(0.0), s1 = vec4(0.0);
    int step_ = max(u_stride, 1);
    int n = 0;
    for (int i = 0; i < 4096; i += 1) {
      int k = i * step_;
      if (k >= cnt) break;
      s0 += A(ivec2(x + k, y)); s1 += B(ivec2(x + k, y)); n += 1;
    }
    o = mx(s0 / float(n), s1 / float(n), P);
  }
  else { o = mx(a, b, P); }
}`

// ── a layer over the canvas below with its blend mode (compositor._composite, editor_filters.BLEND_MODES) ─────
// vf_blend in 8-bit RGB with A = the canvas below and B = the layer (blend_modes.c, integer divisions truncate):
//   multiply A*B/255; screen 255-(255-A)(255-B)/255; overlay A<128 ? 2(A*B/255) : 255-2((255-A)(255-B)/255);
//   darken min; lighten max; add min(255, A+B); difference |A-B|; then the layer's alpha a: out = A + (blend - A) a.
// normal is a plain overlay: out = A + (B - A) a.
export const BLEND_IDS = { normal: 0, multiply: 1, screen: 2, overlay: 3, darken: 4, lighten: 5, add: 6, difference: 7 }
export const BLEND = HEAD + `
uniform sampler2D u_base, u_layer;
uniform int u_mode;
int bl(int A, int B) {
  if (u_mode == 1) return (A * B) / 255;
  if (u_mode == 2) return 255 - ((255 - A) * (255 - B)) / 255;
  if (u_mode == 3) return A < 128 ? 2 * ((A * B) / 255) : 255 - 2 * (((255 - A) * (255 - B)) / 255);
  if (u_mode == 4) return min(A, B);
  if (u_mode == 5) return max(A, B);
  if (u_mode == 6) return min(255, A + B);
  if (u_mode == 7) return abs(A - B);
  return B;
}
void main() {
  ivec2 p = pix();
  vec4 b = texelFetch(u_base, p, 0), l = texelFetch(u_layer, p, 0);
  float a = clamp(l.a, 0.0, 1.0);
  if (u_mode == 0) { o = vec4(mix(b.rgb, l.rgb, a), 1.0); return; }
  ivec3 A = ivec3(floor(clamp(b.rgb, 0.0, 1.0) * 255.0 + 0.5)), B = ivec3(floor(clamp(l.rgb, 0.0, 1.0) * 255.0 + 0.5));
  vec3 r = vec3(bl(A.r, B.r), bl(A.g, B.g), bl(A.b, B.b)) / 255.0;
  o = vec4(mix(b.rgb, r, a), 1.0);
}`

export const FILL = HEAD + `
uniform vec4 u_color;
void main() { o = u_color; }`

// The export's 4:4:4 picture made 4:2:0 (the swscale ffmpeg inserts where a yuva444p layer joins the yuv420p canvas,
// bicubic): U and V at each 2 x 2 block, computed as SCALE computes a plane, from the picture's 8-bit BT.601 values.
// Writes U, V / 255. The golden-frame test's model of the export's encode (readPixels, PRESENT).
export const CHROMA_DOWN = HEAD + YUVA + SWS + `
uniform sampler2D u_src;
void main() {
  ivec2 p = pix(), s = textureSize(u_src, 0);
  int vrow = u_taps.x + 1;
  int hp = tap(p.x, 0), vp = tap(p.y, vrow);
  ivec2 acc = ivec2(64 << 12);
  for (int k = 0; k < u_taps.y; k++) {
    int wv = tap(p.y, vrow + 1 + k);
    if (wv == 0) continue;
    int row = min(vp + k, s.y - 1);
    ivec2 h = ivec2(0);
    for (int j = 0; j < u_taps.x; j++) {
      int wh = tap(p.x, 1 + j);
      if (wh != 0) h += yuvaOf(texelFetch(u_src, ivec2(min(hp + j, s.x - 1), row), 0)).yz * wh;
    }
    acc += min(h >> 7, ivec2(32767)) * wv;
  }
  o = vec4(vec2(clamp(acc >> 19, ivec2(0), ivec2(255))) / 255.0, 0.0, 1.0);
}`

// To the screen: the canvas's row 0 is at the bottom, so this pass flips. u_chroma420 imitates the export's yuv420p
// for the golden-frame test: BT.601 limited YUV in 8 bits, the chroma of each 2 x 2 block from CHROMA_DOWN, then
//   1: upsampled bilinearly from centre-sited samples (scale=flags=bilinear+full_chroma_int+accurate_rnd, which is
//      also how browsers decode yuv420p video), or
//   2: repeated over its block (swscale's default yuv420p -> rgb24, what `format=rgb24` gives).
export const CHROMA420 = { off: 0, bilinear: 1, nearest: 2 }
export const PRESENT = HEAD + `
uniform sampler2D u_src, u_chroma;
uniform int u_flip, u_chroma420;
vec2 chromaAt(ivec2 c, ivec2 s) {   // the chroma of 2 x 2 block c, 8-bit
  c = clamp(c, ivec2(0), (s - 1) / 2);
  return floor(texelFetch(u_chroma, c, 0).xy * 255.0 + 0.5);
}
void main() {
  ivec2 s = textureSize(u_src, 0);
  ivec2 p = pix();
  if (u_flip == 1) p.y = s.y - 1 - p.y;
  vec4 c = texelFetch(u_src, p, 0);
  if (u_chroma420 == 2) {
    float y = clamp(floor(toYuv(clamp(c.rgb, 0.0, 1.0)).x + 0.5), 0.0, 255.0);
    c = vec4(clamp(floor(toRgb(vec3(y, chromaAt(p / 2, s))) * 255.0 + 0.5) / 255.0, 0.0, 1.0), 1.0);
  } else if (u_chroma420 == 1) {
    vec2 q = (vec2(p) - 0.5) / 2.0;
    vec2 f = clamp(q - floor(q), 0.0, 1.0);
    if (q.x < 0.0) f.x = 0.0;
    if (q.y < 0.0) f.y = 0.0;
    ivec2 q0 = ivec2(floor(max(q, 0.0)));
    vec2 uv = mix(mix(chromaAt(q0, s), chromaAt(q0 + ivec2(1, 0), s), f.x), mix(chromaAt(q0 + ivec2(0, 1), s), chromaAt(q0 + ivec2(1, 1), s), f.x), f.y);
    float y = clamp(floor(toYuv(clamp(c.rgb, 0.0, 1.0)).x + 0.5), 0.0, 255.0);
    c = vec4(clamp(floor(toRgb(vec3(y, uv)) * 255.0 + 0.5) / 255.0, 0.0, 1.0), 1.0);
  }
  o = vec4(clamp(c.rgb, 0.0, 1.0), 1.0);
}`
