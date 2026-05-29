import{C as Et,P as _t,E as Ct,F as Rt}from"./main--GNk1VIa.js";const $t=`
// ── Color ────────────────────────────────────────────────────────────────

/** Convert HSV to { r, g, b }. All inputs 0–1. */
function hsv(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), tt = v * (1 - (1 - f) * s);
  const c = [[v,tt,p],[q,v,p],[p,v,tt],[p,q,v],[tt,p,v],[v,p,q]][i % 6];
  return { r: _c(c[0]), g: _c(c[1]), b: _c(c[2]) };
}

/** Convert RGB (0–1 each) to { r, g, b } 0–255. */
function rgb(r, g, b) { return { r: _c(r), g: _c(g), b: _c(b) }; }

function _c(v) { return Math.round(v < 0 ? 0 : v > 1 ? 255 : v * 255); }

// ── Waves (all return 0–1) ────────────────────────────────────────────────

/** Sine wave. x: 0–1 = one full cycle. */
function wave(x)              { return (Math.sin(x * 6.28318) + 1) * 0.5; }

/** Triangle wave. */
function triangle(x)          { x = fract(x); return x < 0.5 ? x * 2 : 2 - x * 2; }

/** Square wave. duty 0–1 controls pulse width (default 0.5). */
function square(x, duty)      { return fract(x) < (duty === undefined ? 0.5 : duty) ? 1 : 0; }

// ── Math ─────────────────────────────────────────────────────────────────

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t)  { return a + (b - a) * t; }
function fract(x)        { return x - Math.floor(x); }
function abs(x)          { return x < 0 ? -x : x; }
function floor(x)        { return Math.floor(x); }
function ceil(x)         { return Math.ceil(x); }
function int(x)          { return Math.floor(x); }
function float(x)        { return +x; }
function min(a, b)       { return a < b ? a : b; }
function max(a, b)       { return a > b ? a : b; }
function pow(a, b)       { return Math.pow(a, b); }
function sqrt(x)         { return Math.sqrt(x); }
function exp(x)          { return Math.exp(x); }
function log(x)          { return Math.log(x); }
function tan(x)              { return Math.tan(x); }
function atan2(y, x)         { return Math.atan2(y, x); }
function round(x)            { return Math.round(x); }
/** Map x from [inMin,inMax] to [outMin,outMax]. */
function map(x, inMin, inMax, outMin, outMax) {
  return outMin + (x - inMin) / (inMax - inMin) * (outMax - outMin);
}
/** GLSL-style step: 0 when x < edge, otherwise 1. */
function step(edge, x) { return x < edge ? 0 : 1; }
/** Hermite smoothstep, output 0–1. */
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Alias for lerp. Supports numbers and RGB arrays. */
function mix(a, b, t) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.map((v, i) => v + ((b[i] || 0) - v) * t);
  }
  return a + (b - a) * t;
}
function mod(a, b) { return ((a % b) + b) % b; }
function vec2(x, y) { return { x, y }; }
function length(v) { return sqrt((v.x || 0) * (v.x || 0) + (v.y || 0) * (v.y || 0)); }
function distance(x1, y1, x2, y2) {
  const dx = x1 - x2, dy = y1 - y2;
  return sqrt(dx * dx + dy * dy);
}
const PI  = Math.PI;
const TAU = Math.PI * 2;
const TWO_PI = TAU;
function sin(x)          { return Math.sin(x); }
function cos(x)          { return Math.cos(x); }

// ── Noise ─────────────────────────────────────────────────────────────────

/**
 * Smooth value noise, returns 0–1.
 * noise(x) — 1D.  noise(x, y) — 2D.
 */
function noise(x, y) {
  y = (y == null) ? 0 : +y;
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi,        yf = y - yi;
  function fade(t) { return t * t * (3 - 2 * t); }
  function h(nx, ny) {
    const n = Math.sin(nx * 127.1 + ny * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  const sx = fade(xf), sy = fade(yf);
  return lerp(lerp(h(xi, yi), h(xi+1, yi), sx),
              lerp(h(xi, yi+1), h(xi+1, yi+1), sx), sy);
}

/**
 * Deterministic pseudo-random 0–1 from a numeric seed.
 */
function randomF(seed) {
  const n = Math.sin(seed * 127.1) * 43758.5453;
  return n - Math.floor(n);
}

// ── Advanced Math ─────────────────────────────────────────────────────────

/** Pingpong wave: 0→1→0. Equivalent to triangle but symmetric alias. */
function ping(x) { x = fract(x); return x < 0.5 ? x * 2 : 2 - x * 2; }

/** Ease-in power curve. p=2 is quadratic, p=3 cubic. */
function easeIn(t, p)  { return pow(clamp(t, 0, 1), p || 2); }

/** Ease-out power curve. */
function easeOut(t, p) { return 1 - pow(1 - clamp(t, 0, 1), p || 2); }

/** Ease-in-out: smooth S-curve with configurable power. */
function easeInOut(t, p) { t = clamp(t,0,1); return t < 0.5 ? pow(t*2,p||2)*0.5 : 1-pow((1-t)*2,p||2)*0.5; }

/** Remap x from [a,b] to [0,1] clamped. */
function norm(x, a, b) { return clamp((x - a) / (b - a), 0, 1); }

// ── Polar ─────────────────────────────────────────────────────────────────

/**
 * Convert (x,y) to polar coords around center (cx,cy).
 * Returns { r: radius, a: angle 0–1 }.
 * cx/cy default to 0.5 (artwork center).
 */
function polar(px, py, cx, cy) {
  const dx = px - (cx == null ? 0.5 : cx);
  const dy = py - (cy == null ? 0.5 : cy);
  return { r: sqrt(dx*dx + dy*dy), a: fract(atan2(dy, dx) / TAU + 0.5) };
}

// ── Noise ─────────────────────────────────────────────────────────────────

/**
 * Fractal Brownian Motion — stacks oct octaves of value noise.
 * Returns 0-1. More octaves = richer organic texture.
 * fbm(x, y) = 2D with 4 octaves.  fbm(x, y, 6) = 6 octaves.
 */
function fbm(x, y, oct) {
  let v = 0, amp = 0.5, freq = 1;
  const n = oct || 4;
  for (let i = 0; i < n; i++) {
    v += noise(x * freq, (y || 0) * freq) * amp;
    freq *= 2.0; amp *= 0.5;
  }
  return v;
}

// ── Palette ───────────────────────────────────────────────────────────────

/**
 * Sample the palette at normalized position t (0–1), interpolating
 * smoothly between swatches.  Returns { r, g, b } with values 0–255.
 */
function samplePalette(t) {
  t = fract(t < 0 ? t + 1 : t);
  const last = palette.length - 1;
  const pos  = t * last;
  const i    = floor(pos);
  const f    = pos - i;
  const a    = palette[i];
  const b2   = palette[i >= last ? last : i + 1];
  return { r: lerp(a.r, b2.r, f) * 255, g: lerp(a.g, b2.g, f) * 255, b: lerp(a.b, b2.b, f) * 255 };
}
`;function Dt(t){try{return{fn:new Function("index","x","y","t","time","pixelCount","palette","beat","beatSin","params","stripId","stripProgress","bass","mid","hi",`${$t}
{
${t}
}`),error:null}}catch(n){return{fn:null,error:n.message}}}function yt(t,n,r,e,o,s,a,u,c,m,y,v,g,M=0,N=0,P=0){try{const x=t(n,r,e,o,s,a,u,c,m,y,v||0,g||0,M,N,P);if(Array.isArray(x)){const b=x.some(O=>Math.abs(O)>1)?1:255;return{r:_(Math.round((x[0]??0)*b)),g:_(Math.round((x[1]??0)*b)),b:_(Math.round((x[2]??0)*b))}}return!x||typeof x!="object"?{r:0,g:0,b:0}:{r:_(Math.round(x.r??0)),g:_(Math.round(x.g??0)),b:_(Math.round(x.b??0))}}catch{return{r:35,g:0,b:0}}}function _(t){return Number.isFinite(t)?t<0?0:t>255?255:t:0}const Lt="lw_custom_patterns";function Ut(t){return t||(typeof localStorage<"u"?localStorage:null)}function Ht(t,n,r){const e=Ut(r);if(!e)return n;try{const o=e.getItem(t);return o?JSON.parse(o):n}catch{return n}}function Gt(t={}){const n=Ht(Lt,[],t.storage);return Array.isArray(n)?n:[]}function Ot(t={}){return[...Et,...Gt(t)]}function Pt(t,n={}){return Ot(n).find(r=>r.id===t)||null}function St(t,n,r=.5,e=.5){const o=t-r,s=n-e;return{r:Math.sqrt(o*o+s*s),a:Math.atan2(s,o)}}function It(t,n,r=.5,e=.5){return{x:r+Math.cos(n)*t,y:e+Math.sin(n)*t}}const I=Math.PI*2,Ft=1e-6;function Q(t){return Math.max(0,Math.min(1,t))}function kt(t,n,r){return Math.max(Ft,...[[0,0],[1,0],[0,1],[1,1]].map(([o,s])=>Math.abs((o-t.x1)*n+(s-t.y1)*r)))}function Jt(t,n){return{x:t,y:n>.5?1-n:n}}function Yt(t,n){return{x:t>.5?1-t:t,y:n}}function Xt(t,n){return{x:t>.5?1-t:t,y:n>.5?1-n:n}}function Vt(t,n,r={}){const e=r.axis||{x1:.5,y1:0,x2:.5,y2:1},o=r.mode||"fold",s=e.x2-e.x1,a=e.y2-e.y1,u=Math.sqrt(s*s+a*a);if(u<Ft)return{x:t,y:n,side:0};const c=s/u,m=a/u,y=-m,v=c,g=(t-e.x1)*y+(n-e.y1)*v,M=kt(e,y,v),N=Q(((t-e.x1)*c+(n-e.y1)*m)/u),P=(x,b={})=>({x:Q(x/M),y:N,progress:Q(x/M),side:g,...b});return o==="reflect"||o==="fold"?P(Math.abs(g)):o==="split"?P(Math.abs(g),{split:!0}):{x:t,y:n,side:g}}function zt(t,n,r,e=0,o=0,s=0){const{r:a,a:u}=St(t,n),c=I/r,y=((u+e*I+o*s*I)%I+I)%I%c;return It(a,y)}function Wt(t,n,r,e=0){const{r:o,a:s}=St(t,n),a=I/r,u=((s+e*I)%I+I)%I;let c=u%a;return Math.floor(u/a)%2===1&&(c=a-c),It(o,c)}function Kt(t,n,r,e=0){if(!r||!r.enabled||r.type==="none")return{x:t,y:n};const{type:o,count:s=8,slices:a=6,phase:u=0,twist:c=0,guide:m}=r;switch(o){case"mirror-h":return Jt(t,n);case"mirror-v":return Yt(t,n);case"mirror-hv":return Xt(t,n);case"guide-mirror":return Vt(t,n,m);case"radial":return zt(t,n,s,u,c,e);case"kaleido":return Wt(t,n,a,u);default:return{x:t,y:n}}}function Qt(t){const n=parseInt(String(t).replace("#",""),16);return Number.isFinite(n)?{r:(n>>16&255)/255,g:(n>>8&255)/255,b:(n&255)/255}:{r:0,g:0,b:0}}function H(t,n,r){t/=255,n/=255,r/=255;const e=Math.max(t,n,r),o=Math.min(t,n,r);let s,a,u=(e+o)/2;if(e===o)s=a=0;else{const c=e-o;switch(a=u>.5?c/(2-e-o):c/(e+o),e){case t:s=((n-r)/c+(n<r?6:0))/6;break;case n:s=((r-t)/c+2)/6;break;default:s=((t-n)/c+4)/6}}return[s*360,a,u]}function tt(t,n,r){if(t=(t%360+360)%360/360,n===0){const a=Math.round(r*255);return[a,a,a]}const e=r<.5?r*(1+n):r+n-r*n,o=2*r-e,s=(a,u,c)=>(c<0&&(c+=1),c>1&&(c-=1),c<1/6?a+(u-a)*6*c:c<1/2?u:c<2/3?a+(u-a)*(2/3-c)*6:a);return[s(o,e,t+1/3),s(o,e,t),s(o,e,t-1/3)].map(a=>Math.round(a*255))}function cn(t,n=2.2){if(!t)return null;const r=new Uint8Array(256);for(let e=0;e<256;e++)r[e]=Math.round(Math.pow(e/255,n)*255);return r}function vt(t){const n=Pt(t);return n?Dt(n.code).fn:null}function Zt(t=_t){return t.map(Qt)}function Z(t,n={}){var s;const r=Ct[t]||[],e=r.length>0?r:Rt(((s=Pt(t))==null?void 0:s.code)||"");return{...Object.fromEntries(e.map(a=>[a.name,a.value])),...n}}const B=Math.PI*2;function T(t){return Math.max(0,Math.min(1,Number.isFinite(t)?t:0))}function Bt(t,n,r=0){const e=t-.5,o=n-.5;return Math.sqrt(e*e+o*o)<1e-4?T(r):(Math.atan2(o,e)+B)%B/B}function jt(t,n){return n<=1?0:Math.max(0,Math.min(n-1,Math.round(T(t)*(n-1))))}function q(t,n,r){return t+(n-t)*r}function tn(t,n,r){const e=(n-t+540)%360-180;return t+e*r}function nn(t,n,r,e){const o=T((e==null?void 0:e.colorMix)??0);if(o<=0)return{r:t,g:n,b:r};const[s,a,u]=H(t,n,r),[c,m,y]=H(e.color.r,e.color.g,e.color.b),v=tn(s,c,o*.62),g=T(q(a,m,o*.5)),M=T(q(u,y,o*.16)),[N,P,x]=tt(v,g,M);return{r:N,g:P,b:x}}function rn(t,n="smooth"){const r=T(t);return n==="linear"?r:n==="ease-in"?r*r:n==="ease-out"?1-(1-r)*(1-r):r*r*(3-2*r)}function wt(t,n={r:255,g:255,b:255}){const r=String(t||"").replace("#","").trim();if(!/^[0-9a-f]{6}$/i.test(r))return n;const e=parseInt(r,16);return{r:e>>16&255,g:e>>8&255,b:e&255}}function en(t={},n=0){const r=t.__journey;if(!(r!=null&&r.enabled))return null;const e=Math.max(1,Number(r.duration)||24),o=(n/e%1+1)%1,s=r.loop==="pingpong"?o<.5?o*2:2-o*2:o,a=rn(s,r.easing||"smooth"),u=Array.isArray(r.colorStops)&&r.colorStops.length>=2?r.colorStops:["#ffd000","#ff7a18","#fff5d6"],c=r.loop==="pingpong"?a*(u.length-1):a*u.length,m=r.loop==="pingpong"?Math.min(u.length-2,Math.max(0,Math.floor(c))):Math.floor(c)%u.length,y=r.loop==="pingpong"?Math.min(u.length-1,m+1):(m+1)%u.length,v=c-Math.floor(c),g=wt(u[m]),M=wt(u[y],g);return{progress:a,speed:q(Number(r.speedStart)||1,Number(r.speedEnd)||1,a),saturation:q(r.saturationStart==null?1:Number(r.saturationStart),r.saturationEnd==null?1:Number(r.saturationEnd),a),colorMix:T(r.colorMix==null?0:Number(r.colorMix)),color:{r:q(g.r,M.r,v),g:q(g.g,M.g,v),b:q(g.b,M.b,v)}}}function un({t=0,strips:n=[],patternId:r="aurora",activeFn:e=null,blendPatternId:o=null,blendFn:s=null,blendAmount:a=0,blendType:u="crossfade",params:c={},paletteNorm:m=Zt(),bpm:y=120,masterSpeed:v=1,masterBrightness:g=1,masterSaturation:M=1,masterHueShift:N=0,gammaLUT:P=null,symSettings:x=null,audioBands:b=null,normBounds:O=null,perStripFns:Nt=new Map,patternParamsById:rt={}}){const k=n.filter(f=>f&&!f.hidden),et=k.flatMap(f=>f.pts||[]),L=O||on(et),J=et.length,qt=e||vt(r),ot=s||(o?vt(o):null),C=Z(r,c),Tt=o?Z(o,rt[o]||{}):C,Y=new Map([[r,C]]);for(const f of k)f.patternId&&!Y.has(f.patternId)&&Y.set(f.patternId,Z(f.patternId,rt[f.patternId]||{}));const w=en(C,t),X=t*y/60%1,at=Math.sin(X*Math.PI),st=(b==null?void 0:b.bass)??0,it=(b==null?void 0:b.mid)??0,ct=(b==null?void 0:b.hi)??0,ut=[],ft=[];let lt=0;for(const f of k){const V=t*v*((w==null?void 0:w.speed)??1)*(f.speed??1),pt=V/65.536%1,ht=(f.patternId?Nt.get(f.patternId):null)??qt,At=f.patternId&&Y.get(f.patternId)||C,z=[];let xt=0,mt=0,dt=0;for(const E of f.pts||[]){let R=(E.x-L.minX)/L.range,$=(E.y-L.minY)/L.range,gt=0,Mt=!1,U=E.p,W=lt;if(x!=null&&x.enabled){const i=Kt(R,$,x,t);R=i.x,$=i.y,gt=i.side||0,Mt=!!i.split,U=Number.isFinite(i.progress)?i.progress:Bt(R,$,E.p),W=jt(U,J)}let l=0,p=0,h=0;if(ht){const i=yt(ht,W,R,$,V,pt,J,m,X,at,At,f.id,U,st,it,ct);if(l=i.r,p=i.g,h=i.b,ot&&a>0){const d=yt(ot,W,R,$,V,pt,J,m,X,at,Tt,f.id,U,st,it,ct);if(u==="fade-black"){const S=a<.5?1-a*2:0,F=a>.5?(a-.5)*2:0;l=i.r*S+d.r*F,p=i.g*S+d.g*F,h=i.b*S+d.b*F}else if(u==="dissolve"){const S=1-a,F=a;l=Math.min(255,i.r*S+d.r*F+i.r*d.r*a/255),p=Math.min(255,i.g*S+d.g*F+i.g*d.g*a/255),h=Math.min(255,i.b*S+d.b*F+i.b*d.b*a/255)}else l=i.r*(1-a)+d.r*a,p=i.g*(1-a)+d.g*a,h=i.b*(1-a)+d.b*a}}const K=(f.brightness??1)*g;if(l*=K,p*=K,h*=K,(w==null?void 0:w.colorMix)>0){const i=nn(l,p,h,w);l=i.r,p=i.g,h=i.b}if(w&&w.saturation<.999){const i=.299*l+.587*p+.114*h;l=i+(l-i)*w.saturation,p=i+(p-i)*w.saturation,h=i+(h-i)*w.saturation}if(M<.999){const i=.299*l+.587*p+.114*h;l=i+(l-i)*M,p=i+(p-i)*M,h=i+(h-i)*M}if(Mt){const[i,d,S]=H(l,p,h),F=gt>=0?28:-28;[l,p,h]=tt(i+F,d,S)}if(l=j(l),p=j(p),h=j(h),P&&(l=P[Math.round(l)],p=P[Math.round(p)],h=P[Math.round(h)]),f.hueShift||N){const[i,d,S]=H(l,p,h);[l,p,h]=tt(i+(f.hueShift||0)+N,d,S)}const bt={r:Math.round(l),g:Math.round(p),b:Math.round(h)};ut.push(bt),z.push({x:E.x,y:E.y,...bt}),xt+=l,mt+=p,dt+=h,lt++}const A=z.length;ft.push({id:f.id,leds:z,avgR:A?Math.round(xt/A):0,avgG:A?Math.round(mt/A):0,avgB:A?Math.round(dt/A):0,spacing:f.spacing})}return{pixels:ut,stripFrames:ft}}function on(t){if(!t.length)return{minX:0,minY:0,range:1};let n=1/0,r=-1/0,e=1/0,o=-1/0;for(const s of t)s.x<n&&(n=s.x),s.x>r&&(r=s.x),s.y<e&&(e=s.y),s.y>o&&(o=s.y);return{minX:n,minY:e,range:Math.max(r-n,o-e,.001)}}function j(t){return Number.isFinite(t)?t<0?0:t>255?255:t:0}const G=(t,n,r)=>Math.max(n,Math.min(r,t));function nt(t={}){return{r:Math.max(0,Math.min(255,Math.round(Number(t.r??t.avgR??0)||0))),g:Math.max(0,Math.min(255,Math.round(Number(t.g??t.avgG??0)||0))),b:Math.max(0,Math.min(255,Math.round(Number(t.b??t.avgB??0)||0)))}}function D(t={}){const{r:n,g:r,b:e}=nt(t);return G(Math.max(n,r,e)/255,0,1)}function an(t={},{selected:n=!1}={}){const r=D(t),e=n?.035:0;return G(.075+r*.115+e,.06,n?.22:.18)}function fn(t={},{selected:n=!1}={}){const r=D(t);if(r<=.015)return 0;const e=n?.12:0;return G(.28+r*.42+e,.3,n?.86:.74)}function ln(t={}){const n=D(t);return n<=.015?0:G(.05+n*.1,.05,.16)}function pn(t={}){const n=D(t),r=an(t).toFixed(3);if(n<=.015)return`rgba(70, 90, 118, ${r})`;const{r:e,g:o,b:s}=nt(t);return`rgba(${e}, ${o}, ${s}, ${r})`}function hn(t={},n="oklch(58% 0.035 240)"){if(D(t)<=.015)return n;const{r,g:e,b:o}=nt(t);return`rgb(${r} ${e} ${o})`}export{an as a,cn as b,vt as c,fn as d,Z as e,pn as f,ln as g,hn as l,Zt as n,un as r};
