// 직접 만든 셰이더 재질: 반투명 혈관 벽(흐름 무늬), 유기 조직(심장·허파꽈리·근육), 기체 입자.
import * as THREE from 'three';

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

export function makeVesselMaterial(opts: { length: number; o2From: number; o2To: number; capillary: boolean; chamber: boolean }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uBeat: { value: 0 },
      uLength: { value: opts.length },
      uO2: { value: new THREE.Vector2(opts.o2From, opts.o2To) },
      uCap: { value: opts.capillary ? 1 : 0 },
      uChamber: { value: opts.chamber ? 1 : 0 },
      uLow: { value: new THREE.Color('#5a4fd6') },
      uHigh: { value: new THREE.Color('#ff3b62') },
      uHighlight: { value: 0 },
    },
    vertexShader: /* glsl */ `
      uniform float uBeat; uniform float uChamber;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vUv = uv;
        vec3 p = position + normal * uBeat * mix(0.06, 0.25, uChamber);
        vec4 wp = modelMatrix * vec4(p,1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime; uniform float uFlow; uniform float uLength; uniform vec2 uO2; uniform float uCap; uniform float uChamber;
      uniform vec3 uLow; uniform vec3 uHigh; uniform float uHighlight;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float k = uCap > 0.5 ? smoothstep(0.3, 0.7, vUv.x) : vUv.x;
        float o2 = mix(uO2.x, uO2.y, k);
        vec3 base = mix(uLow, uHigh, o2);
        float along = vUv.x * uLength;
        // 흐름 방향으로 움직이는 물결 무늬 (혈류 방향 표시)
        float band = smoothstep(0.55, 1.0, sin((along - uFlow) * 1.4) * 0.5 + 0.5);
        float chev = smoothstep(0.82, 1.0, sin((along - uFlow * 1.0) * 0.6 - abs(vUv.y - 0.5) * 6.0) * 0.5 + 0.5);
        // 유기적인 조직 무늬
        float n = snoise(vec3(along * 0.35, vUv.y * 6.0, uTime * 0.15)) * 0.5 + 0.5;
        float veins = smoothstep(0.47, 0.5, n) * (1.0 - smoothstep(0.5, 0.53, n));
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        vec3 col = base * (0.55 + 0.45 * n) + vec3(1.0, 0.85, 0.9) * veins * 0.45 + base * band * 0.35 + vec3(1.0) * chev * 0.12;
        col += vec3(1.0, 0.95, 0.7) * uHighlight * 0.35;
        float alpha = 0.16 + rim * 0.62 + veins * 0.2 + band * 0.06 + uChamber * 0.05;
        gl_FragColor = vec4(col * (0.75 + rim * 0.9), clamp(alpha, 0.0, 0.92));
      }`,
  });
}

/** 심장·허파꽈리·근육 공용 유기 재질. 인스턴스 메시도 지원. */
export function makeOrganicMaterial(opts: { color: string; rim: string; opacity: number; noiseAmp: number; striation?: number; side?: THREE.Side }) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: opts.side ?? THREE.FrontSide,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uColor: { value: new THREE.Color(opts.color) },
      uRim: { value: new THREE.Color(opts.rim) },
      uOpacity: { value: opts.opacity },
      uNoise: { value: opts.noiseAmp },
      uStri: { value: opts.striation ?? 0 },
      uGlow: { value: 0 },
    },
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime; uniform float uPulse; uniform float uNoise;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vNoise;
      void main(){
        vec3 p = position;
        float n = snoise(p * 1.7 + vec3(0.0, uTime * 0.2, 0.0));
        vNoise = n;
        p += normal * n * uNoise;
        p *= 1.0 - uPulse;
        vL = position;
        vec4 lp = vec4(p, 1.0);
        vec3 nn = normal;
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp;
          nn = mat3(instanceMatrix) * nn;
        #endif
        vec4 wp = modelMatrix * lp;
        vN = normalize(mat3(modelMatrix) * nn);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform vec3 uRim; uniform float uOpacity; uniform float uStri; uniform float uGlow; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying vec3 vL; varying float vNoise;
      void main(){
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(1.0 - facing, 2.0);
        float stri = uStri > 0.0 ? (0.75 + 0.25 * sin(vL.y * uStri)) : 1.0;
        vec3 col = mix(uColor * (0.7 + 0.3 * vNoise), uRim, rim) * stri;
        col += uRim * uGlow * 0.5;
        float a = uOpacity * (0.35 + rim * 0.9);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
      }`,
  });
}

/** 기체 교환 입자 (O2: 하늘색, CO2: 회황색) — a 에서 b 로 반복 이동 */
export function makeGasMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aFrom; attribute vec3 aTo; attribute float aSeed; attribute float aKind;
      uniform float uTime; uniform float uBoost; uniform float uPixel;
      varying float vKind; varying float vFade;
      void main(){
        float speed = 0.18 + 0.25 * uBoost;
        float t = fract(uTime * speed + aSeed);
        vec3 p = mix(aFrom, aTo, smoothstep(0.0, 1.0, t));
        p += vec3(sin(aSeed * 40.0 + uTime), cos(aSeed * 30.0 + uTime * 1.3), sin(aSeed * 20.0 - uTime)) * 0.25;
        vKind = aKind;
        vFade = sin(t * 3.14159) * (0.35 + 0.65 * uBoost);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (aKind > 0.5 ? 120.0 : 150.0) * uPixel / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vKind; varying float vFade;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = vKind > 0.5 ? vec3(0.85, 0.75, 0.5) : vec3(0.55, 0.95, 1.0);
        gl_FragColor = vec4(col * (0.6 + a), a * vFade);
      }`,
  });
}
