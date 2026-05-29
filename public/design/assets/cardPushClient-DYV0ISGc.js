import{C as $t,P as _t,E as Rt,F as Dt}from"./main-BXWK_7Q8.js";import{r as Ht,c as Z,b as Lt}from"./cardConnection-DmJ7TENo.js";const Ut=`
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
`;function kt(t){try{return{fn:new Function("index","x","y","t","time","pixelCount","palette","beat","beatSin","params","stripId","stripProgress","bass","mid","hi",`${Ut}
{
${t}
}`),error:null}}catch(n){return{fn:null,error:n.message}}}function wt(t,n,r,o,e,s,a,i,u,d,y,v,g,M=0,C=0,P=0){try{const x=t(n,r,o,e,s,a,i,u,d,y,v||0,g||0,M,C,P);if(Array.isArray(x)){const b=x.some(G=>Math.abs(G)>1)?1:255;return{r:A(Math.round((x[0]??0)*b)),g:A(Math.round((x[1]??0)*b)),b:A(Math.round((x[2]??0)*b))}}return!x||typeof x!="object"?{r:0,g:0,b:0}:{r:A(Math.round(x.r??0)),g:A(Math.round(x.g??0)),b:A(Math.round(x.b??0))}}catch{return{r:35,g:0,b:0}}}function A(t){return Number.isFinite(t)?t<0?0:t>255?255:t:0}const Ot="lw_custom_patterns";function Gt(t){return t||(typeof localStorage<"u"?localStorage:null)}function Jt(t,n,r){const o=Gt(r);if(!o)return n;try{const e=o.getItem(t);return e?JSON.parse(e):n}catch{return n}}function Yt(t={}){const n=Jt(Ot,[],t.storage);return Array.isArray(n)?n:[]}function Xt(t={}){return[...$t,...Yt(t)]}function Tt(t,n={}){return Xt(n).find(r=>r.id===t)||null}function It(t,n,r=.5,o=.5){const e=t-r,s=n-o;return{r:Math.sqrt(e*e+s*s),a:Math.atan2(s,e)}}function Ct(t,n,r=.5,o=.5){return{x:r+Math.cos(n)*t,y:o+Math.sin(n)*t}}const T=Math.PI*2,Nt=1e-6;function B(t){return Math.max(0,Math.min(1,t))}function Vt(t,n,r){return Math.max(Nt,...[[0,0],[1,0],[0,1],[1,1]].map(([e,s])=>Math.abs((e-t.x1)*n+(s-t.y1)*r)))}function zt(t,n){return{x:t,y:n>.5?1-n:n}}function Wt(t,n){return{x:t>.5?1-t:t,y:n}}function Kt(t,n){return{x:t>.5?1-t:t,y:n>.5?1-n:n}}function Qt(t,n,r={}){const o=r.axis||{x1:.5,y1:0,x2:.5,y2:1},e=r.mode||"fold",s=o.x2-o.x1,a=o.y2-o.y1,i=Math.sqrt(s*s+a*a);if(i<Nt)return{x:t,y:n,side:0};const u=s/i,d=a/i,y=-d,v=u,g=(t-o.x1)*y+(n-o.y1)*v,M=Vt(o,y,v),C=B(((t-o.x1)*u+(n-o.y1)*d)/i),P=(x,b={})=>({x:B(x/M),y:C,progress:B(x/M),side:g,...b});return e==="reflect"||e==="fold"?P(Math.abs(g)):e==="split"?P(Math.abs(g),{split:!0}):{x:t,y:n,side:g}}function Zt(t,n,r,o=0,e=0,s=0){const{r:a,a:i}=It(t,n),u=T/r,y=((i+o*T+e*s*T)%T+T)%T%u;return Ct(a,y)}function Bt(t,n,r,o=0){const{r:e,a:s}=It(t,n),a=T/r,i=((s+o*T)%T+T)%T;let u=i%a;return Math.floor(i/a)%2===1&&(u=a-u),Ct(e,u)}function jt(t,n,r,o=0){if(!r||!r.enabled||r.type==="none")return{x:t,y:n};const{type:e,count:s=8,slices:a=6,phase:i=0,twist:u=0,guide:d}=r;switch(e){case"mirror-h":return zt(t,n);case"mirror-v":return Wt(t,n);case"mirror-hv":return Kt(t,n);case"guide-mirror":return Qt(t,n,d);case"radial":return Zt(t,n,s,i,u,o);case"kaleido":return Bt(t,n,a,i);default:return{x:t,y:n}}}function tn(t){const n=parseInt(String(t).replace("#",""),16);return Number.isFinite(n)?{r:(n>>16&255)/255,g:(n>>8&255)/255,b:(n&255)/255}:{r:0,g:0,b:0}}function k(t,n,r){t/=255,n/=255,r/=255;const o=Math.max(t,n,r),e=Math.min(t,n,r);let s,a,i=(o+e)/2;if(o===e)s=a=0;else{const u=o-e;switch(a=i>.5?u/(2-o-e):u/(o+e),o){case t:s=((n-r)/u+(n<r?6:0))/6;break;case n:s=((r-t)/u+2)/6;break;default:s=((t-n)/u+4)/6}}return[s*360,a,i]}function rt(t,n,r){if(t=(t%360+360)%360/360,n===0){const a=Math.round(r*255);return[a,a,a]}const o=r<.5?r*(1+n):r+n-r*n,e=2*r-o,s=(a,i,u)=>(u<0&&(u+=1),u>1&&(u-=1),u<1/6?a+(i-a)*6*u:u<1/2?i:u<2/3?a+(i-a)*(2/3-u)*6:a);return[s(e,o,t+1/3),s(e,o,t),s(e,o,t-1/3)].map(a=>Math.round(a*255))}function dn(t,n=2.2){if(!t)return null;const r=new Uint8Array(256);for(let o=0;o<256;o++)r[o]=Math.round(Math.pow(o/255,n)*255);return r}function Pt(t){const n=Tt(t);return n?kt(n.code).fn:null}function nn(t=_t){return t.map(tn)}function j(t,n={}){var s;const r=Rt[t]||[],o=r.length>0?r:Dt(((s=Tt(t))==null?void 0:s.code)||"");return{...Object.fromEntries(o.map(a=>[a.name,a.value])),...n}}const tt=Math.PI*2;function E(t){return Math.max(0,Math.min(1,Number.isFinite(t)?t:0))}function rn(t,n,r=0){const o=t-.5,e=n-.5;return Math.sqrt(o*o+e*e)<1e-4?E(r):(Math.atan2(e,o)+tt)%tt/tt}function on(t,n){return n<=1?0:Math.max(0,Math.min(n-1,Math.round(E(t)*(n-1))))}function N(t,n,r){return t+(n-t)*r}function en(t,n,r){const o=(n-t+540)%360-180;return t+o*r}function an(t,n,r,o){const e=E((o==null?void 0:o.colorMix)??0);if(e<=0)return{r:t,g:n,b:r};const[s,a,i]=k(t,n,r),[u,d,y]=k(o.color.r,o.color.g,o.color.b),v=en(s,u,e*.62),g=E(N(a,d,e*.5)),M=E(N(i,y,e*.16)),[C,P,x]=rt(v,g,M);return{r:C,g:P,b:x}}function sn(t,n="smooth"){const r=E(t);return n==="linear"?r:n==="ease-in"?r*r:n==="ease-out"?1-(1-r)*(1-r):r*r*(3-2*r)}function St(t,n={r:255,g:255,b:255}){const r=String(t||"").replace("#","").trim();if(!/^[0-9a-f]{6}$/i.test(r))return n;const o=parseInt(r,16);return{r:o>>16&255,g:o>>8&255,b:o&255}}function cn(t={},n=0){const r=t.__journey;if(!(r!=null&&r.enabled))return null;const o=Math.max(1,Number(r.duration)||24),e=(n/o%1+1)%1,s=r.loop==="pingpong"?e<.5?e*2:2-e*2:e,a=sn(s,r.easing||"smooth"),i=Array.isArray(r.colorStops)&&r.colorStops.length>=2?r.colorStops:["#ffd000","#ff7a18","#fff5d6"],u=r.loop==="pingpong"?a*(i.length-1):a*i.length,d=r.loop==="pingpong"?Math.min(i.length-2,Math.max(0,Math.floor(u))):Math.floor(u)%i.length,y=r.loop==="pingpong"?Math.min(i.length-1,d+1):(d+1)%i.length,v=u-Math.floor(u),g=St(i[d]),M=St(i[y],g);return{progress:a,speed:N(Number(r.speedStart)||1,Number(r.speedEnd)||1,a),saturation:N(r.saturationStart==null?1:Number(r.saturationStart),r.saturationEnd==null?1:Number(r.saturationEnd),a),colorMix:E(r.colorMix==null?0:Number(r.colorMix)),color:{r:N(g.r,M.r,v),g:N(g.g,M.g,v),b:N(g.b,M.b,v)}}}function mn({t=0,strips:n=[],patternId:r="aurora",activeFn:o=null,blendPatternId:e=null,blendFn:s=null,blendAmount:a=0,blendType:i="crossfade",params:u={},paletteNorm:d=nn(),bpm:y=120,masterSpeed:v=1,masterBrightness:g=1,masterSaturation:M=1,masterHueShift:C=0,gammaLUT:P=null,symSettings:x=null,audioBands:b=null,normBounds:G=null,perStripFns:Et=new Map,patternParamsById:et={}}){const J=n.filter(f=>f&&!f.hidden),at=J.flatMap(f=>f.pts||[]),L=G||un(at),Y=at.length,Ft=o||Pt(r),st=s||(e?Pt(e):null),$=j(r,u),qt=e?j(e,et[e]||{}):$,X=new Map([[r,$]]);for(const f of J)f.patternId&&!X.has(f.patternId)&&X.set(f.patternId,j(f.patternId,et[f.patternId]||{}));const w=cn($,t),V=t*y/60%1,it=Math.sin(V*Math.PI),ct=(b==null?void 0:b.bass)??0,ut=(b==null?void 0:b.mid)??0,ft=(b==null?void 0:b.hi)??0,lt=[],ht=[];let pt=0;for(const f of J){const z=t*v*((w==null?void 0:w.speed)??1)*(f.speed??1),xt=z/65.536%1,dt=(f.patternId?Et.get(f.patternId):null)??Ft,At=f.patternId&&X.get(f.patternId)||$,W=[];let mt=0,gt=0,Mt=0;for(const q of f.pts||[]){let _=(q.x-L.minX)/L.range,R=(q.y-L.minY)/L.range,bt=0,yt=!1,U=q.p,K=pt;if(x!=null&&x.enabled){const c=jt(_,R,x,t);_=c.x,R=c.y,bt=c.side||0,yt=!!c.split,U=Number.isFinite(c.progress)?c.progress:rn(_,R,q.p),K=on(U,Y)}let l=0,h=0,p=0;if(dt){const c=wt(dt,K,_,R,z,xt,Y,d,V,it,At,f.id,U,ct,ut,ft);if(l=c.r,h=c.g,p=c.b,st&&a>0){const m=wt(st,K,_,R,z,xt,Y,d,V,it,qt,f.id,U,ct,ut,ft);if(i==="fade-black"){const S=a<.5?1-a*2:0,I=a>.5?(a-.5)*2:0;l=c.r*S+m.r*I,h=c.g*S+m.g*I,p=c.b*S+m.b*I}else if(i==="dissolve"){const S=1-a,I=a;l=Math.min(255,c.r*S+m.r*I+c.r*m.r*a/255),h=Math.min(255,c.g*S+m.g*I+c.g*m.g*a/255),p=Math.min(255,c.b*S+m.b*I+c.b*m.b*a/255)}else l=c.r*(1-a)+m.r*a,h=c.g*(1-a)+m.g*a,p=c.b*(1-a)+m.b*a}}const Q=(f.brightness??1)*g;if(l*=Q,h*=Q,p*=Q,(w==null?void 0:w.colorMix)>0){const c=an(l,h,p,w);l=c.r,h=c.g,p=c.b}if(w&&w.saturation<.999){const c=.299*l+.587*h+.114*p;l=c+(l-c)*w.saturation,h=c+(h-c)*w.saturation,p=c+(p-c)*w.saturation}if(M<.999){const c=.299*l+.587*h+.114*p;l=c+(l-c)*M,h=c+(h-c)*M,p=c+(p-c)*M}if(yt){const[c,m,S]=k(l,h,p),I=bt>=0?28:-28;[l,h,p]=rt(c+I,m,S)}if(l=nt(l),h=nt(h),p=nt(p),P&&(l=P[Math.round(l)],h=P[Math.round(h)],p=P[Math.round(p)]),f.hueShift||C){const[c,m,S]=k(l,h,p);[l,h,p]=rt(c+(f.hueShift||0)+C,m,S)}const vt={r:Math.round(l),g:Math.round(h),b:Math.round(p)};lt.push(vt),W.push({x:q.x,y:q.y,...vt}),mt+=l,gt+=h,Mt+=p,pt++}const F=W.length;ht.push({id:f.id,leds:W,avgR:F?Math.round(mt/F):0,avgG:F?Math.round(gt/F):0,avgB:F?Math.round(Mt/F):0,spacing:f.spacing})}return{pixels:lt,stripFrames:ht}}function un(t){if(!t.length)return{minX:0,minY:0,range:1};let n=1/0,r=-1/0,o=1/0,e=-1/0;for(const s of t)s.x<n&&(n=s.x),s.x>r&&(r=s.x),s.y<o&&(o=s.y),s.y>e&&(e=s.y);return{minX:n,minY:o,range:Math.max(r-n,e-o,.001)}}function nt(t){return Number.isFinite(t)?t<0?0:t>255?255:t:0}const O=(t,n,r)=>Math.max(n,Math.min(r,t));function ot(t={}){return{r:Math.max(0,Math.min(255,Math.round(Number(t.r??t.avgR??0)||0))),g:Math.max(0,Math.min(255,Math.round(Number(t.g??t.avgG??0)||0))),b:Math.max(0,Math.min(255,Math.round(Number(t.b??t.avgB??0)||0)))}}function H(t={}){const{r:n,g:r,b:o}=ot(t);return O(Math.max(n,r,o)/255,0,1)}function fn(t={},{selected:n=!1}={}){const r=H(t),o=n?.035:0;return O(.075+r*.115+o,.06,n?.22:.18)}function gn(t={},{selected:n=!1}={}){const r=H(t);if(r<=.015)return 0;const o=n?.12:0;return O(.28+r*.42+o,.3,n?.86:.74)}function Mn(t={}){const n=H(t);return n<=.015?0:O(.05+n*.1,.05,.16)}function bn(t={}){const n=H(t),r=fn(t).toFixed(3);if(n<=.015)return`rgba(70, 90, 118, ${r})`;const{r:o,g:e,b:s}=ot(t);return`rgba(${o}, ${e}, ${s}, ${r})`}function yn(t={},n="oklch(58% 0.035 240)"){if(H(t)<=.015)return n;const{r,g:o,b:e}=ot(t);return`rgb(${r} ${o} ${e})`}function ln(){return Ht()}class D extends Error{constructor(n,r,o){super(r),this.reason=n,o instanceof Error&&(this.cause=o)}}function hn(){return!Lt(typeof window<"u"?window.location.protocol:"https:")}async function vn(t,n={}){const r=n.host||ln(),o=`${Z(r)}/api/config`,e=JSON.stringify(t.config||t),s=new AbortController,a=setTimeout(()=>s.abort(),n.timeoutMs||6e3);try{const i=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:e,signal:s.signal});if(!i.ok){const u=await i.text().catch(()=>"");throw new D("http",`card returned ${i.status}: ${u||"no body"}`)}return await i.json().catch(()=>({ok:!0}))}catch(i){throw i instanceof D?i:hn()?new D("mixed-content","Browser blocked the connection (mixed content). Use the copy-paste fallback or open the designer over plain HTTP.",i):i&&i.name==="AbortError"?new D("offline",`Timed out reaching ${Z(r)}`,i):new D("offline",`Could not reach ${Z(r)}`,i)}finally{clearTimeout(a)}}export{D as C,fn as a,dn as b,Pt as c,gn as d,j as e,bn as f,ln as g,Mn as h,yn as l,nn as n,vn as p,mn as r};
