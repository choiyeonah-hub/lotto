// 오른쪽 위 반투명 인체 지도. 탐사선 위치를 매 프레임 DOM으로 직접 갱신한다(리렌더 없음).
// 색 = 산소량(빨강 많음 / 보라 적음), 선 모양 = 동맥(실선) · 정맥(점선) · 모세혈관(가는 선).
import { useEffect, useRef, useState } from 'react';
import { ship } from '../game/runtime';
import { o2At, SEG, SEGMENTS, type SegmentId } from '../game/world';

const HIGH = '#ff4d6d';
const LOW = '#7b7bff';

function strokeFor(id: SegmentId) {
  const d = SEG[id];
  if (d.o2[0] !== d.o2[1]) return `url(#grad-${id})`;
  return d.o2[0] > 0.5 ? HIGH : LOW;
}

export function BodyMap({ visited, target, compact, children }: { visited: SegmentId[]; target: SegmentId; compact: boolean; children?: React.ReactNode }) {
  const paths = useRef<Partial<Record<SegmentId, SVGPathElement | null>>>({});
  const dot = useRef<SVGGElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(!compact);

  useEffect(() => {
    let raf = 0;
    let lastSeg = '';
    const loop = () => {
      const el = paths.current[ship.seg];
      if (el && dot.current) {
        const L = el.getTotalLength();
        const p = el.getPointAtLength(Math.min(1, Math.max(0, ship.t)) * L);
        dot.current.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        const o2 = o2At(SEG[ship.seg], ship.t);
        dot.current.querySelector('circle.core')?.setAttribute('fill', o2 > 0.5 ? HIGH : LOW);
      }
      if (label.current && lastSeg !== ship.seg) {
        lastSeg = ship.seg;
        const d = SEG[ship.seg];
        label.current.textContent = `현재: ${d.name} · ${d.kindLabel}`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const targetSeg = SEG[target];
  return (
    <div className={`bodymap ${open ? 'open' : 'closed'}`} data-testid="bodymap">
      <button className="bodymap-toggle" onClick={() => setOpen((o) => !o)} aria-label="지도 크기 바꾸기">{open ? '－' : '🗺'}</button>
      <svg viewBox="0 0 160 240" role="img" aria-label="인체 위치 지도">
        <defs>
          {SEGMENTS.filter((s) => s.o2[0] !== s.o2[1]).map((s) => (
            <linearGradient key={s.id} id={`grad-${s.id}`} gradientUnits="objectBoundingBox" x1="0" x2="1">
              <stop offset="0" stopColor={s.o2[0] > 0.5 ? HIGH : LOW} />
              <stop offset="1" stopColor={s.o2[1] > 0.5 ? HIGH : LOW} />
            </linearGradient>
          ))}
          <marker id="arrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#fff" opacity="0.85" />
          </marker>
        </defs>
        {/* 몸 실루엣 */}
        <g className="silhouette">
          <circle cx="80" cy="26" r="16" />
          <path d="M58,48 Q80,40 102,48 L112,64 Q118,90 114,120 L110,150 Q108,160 104,166 L98,232 L86,232 L82,170 L78,170 L74,232 L62,232 L56,166 Q52,160 50,150 L46,120 Q42,90 48,64 Z" />
          <path d="M48,64 L34,120 L30,150 L36,152 L44,124 L54,90" />
          <path d="M112,64 L126,120 L130,150 L124,152 L116,124 L106,90" />
        </g>
        {/* 폐 */}
        <g className="organ lung">
          <path d="M70,70 Q50,72 46,100 Q46,116 62,114 Q72,110 72,90 Z" />
          <path d="M90,70 Q110,72 114,100 Q114,116 98,114 Q88,110 88,90 Z" />
          <text x="50" y="68">폐</text>
        </g>
        {/* 심장 */}
        <g className="organ heart">
          <path d="M85,90 C79,84 70,88 72,97 C74,105 84,110 86,113 C90,108 99,104 99,96 C99,88 90,85 85,90 Z" />
          <line x1="85" y1="90" x2="86" y2="112" className="septum" />
          <text x="101" y="96">심장</text>
        </g>
        <g className="organ muscle">
          <ellipse cx="72" cy="214" rx="11" ry="14" />
          <text x="86" y="220">근육</text>
        </g>
        {/* 혈관 경로 */}
        {SEGMENTS.map((s) => {
          const seen = visited.includes(s.id);
          const dash = s.kind === 'vein' ? '3 2.2' : undefined;
          return (
            <g key={s.id} className={`route ${seen ? 'seen' : 'unseen'} ${s.kind}`}>
              <path d={s.map} stroke={strokeFor(s.id)} strokeWidth={s.kind === 'capillary' ? 1.6 : 2.6} strokeDasharray={dash} fill="none" />
              <path
                ref={(el) => { paths.current[s.id] = el; }}
                d={s.map}
                className="flow"
                fill="none"
                stroke="#fff"
                strokeWidth={0.9}
                markerMid="url(#arrow)"
              />
            </g>
          );
        })}
        {/* 다음 목적지 */}
        <NextMarker id={targetSeg.id} paths={paths} />
        <g ref={dot} className="ship-dot">
          <circle r="6" className="halo" />
          <circle r="3.2" className="core" />
        </g>
      </svg>
      {children}
      {open && (
        <div className="bodymap-info">
          <div ref={label} className="bodymap-current" />
          <div className="legend">
            <span><i style={{ background: HIGH }} />산소 많음</span>
            <span><i style={{ background: LOW }} />산소 적음</span>
            <span><b className="solid" />동맥: 심장에서 나감</span>
            <span><b className="dashed" />정맥: 심장으로 들어옴</span>
          </div>
        </div>
      )}
    </div>
  );
}

function NextMarker({ id, paths }: { id: SegmentId; paths: React.MutableRefObject<Partial<Record<SegmentId, SVGPathElement | null>>> }) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = paths.current[id];
    if (!el) return;
    const p = el.getPointAtLength(el.getTotalLength() * 0.5);
    setPt({ x: p.x, y: p.y });
  }, [id, paths]);
  if (!pt) return null;
  return (
    <g className="next-marker" transform={`translate(${pt.x} ${pt.y})`}>
      <circle r="7" />
      <text y="-10">목적지</text>
    </g>
  );
}
