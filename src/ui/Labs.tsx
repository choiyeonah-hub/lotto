// 재관찰 실험실 (개념 이해가 부족한 학생 경로): 간단한 실험 후 재도전. 벌점 없음.
import { useEffect, useRef, useState } from 'react';
import { getQuestion } from '../../shared/curriculum';
import type { LabId } from '../../shared/flow';
import { Lumi } from './Answer';

function PumpLab({ onDone }: { onDone: () => void }) {
  const [pumps, setPumps] = useState(0);
  const [squeeze, setSqueeze] = useState(false);
  const [drops, setDrops] = useState<number[]>([]);
  const press = () => {
    setSqueeze(true);
    setPumps((p) => p + 1);
    setDrops((d) => [...d.slice(-6), Date.now()]);
    setTimeout(() => setSqueeze(false), 260);
  };
  const done = pumps >= 4;
  return (
    <div className="lab">
      <h3>🔬 펌프 실험실</h3>
      <p>빨간 주머니(심장)를 <b>눌러서</b> 무슨 일이 생기는지 관찰해 봐. 양쪽의 문(판막)도 잘 봐!</p>
      <svg viewBox="0 0 320 140" className="lab-svg">
        <path d="M10,70 H110" className="pipe" />
        <path d="M210,70 H310" className="pipe" />
        <g className={`valve ${squeeze ? 'closed' : 'open'}`} transform="translate(110 70)"><line x1="0" y1="-14" x2={squeeze ? 0 : 10} y2={squeeze ? 0 : -4} /><line x1="0" y1="14" x2={squeeze ? 0 : 10} y2={squeeze ? 0 : 4} /></g>
        <g className={`valve ${squeeze ? 'open' : 'closed'}`} transform="translate(210 70)"><line x1="0" y1="-14" x2={squeeze ? 10 : 0} y2={squeeze ? -4 : 0} /><line x1="0" y1="14" x2={squeeze ? 10 : 0} y2={squeeze ? 4 : 0} /></g>
        <ellipse cx="160" cy="70" rx={squeeze ? 34 : 48} ry={squeeze ? 30 : 40} className="bulb" />
        {drops.map((t, i) => <circle key={t} className="drop" cx="0" cy="70" r="6" style={{ animationDelay: `${i * 0}ms` }} />)}
        <text x="40" y="45">들어오는 쪽</text>
        <text x="235" y="45">나가는 쪽</text>
      </svg>
      <div className="lab-row">
        <button className="btn primary big" onClick={press}>꾹 누르기 ({pumps}/4)</button>
        {done && <button className="btn big" onClick={onDone}>관찰 끝! 다시 설명하기</button>}
      </div>
      {done && <p className="lab-obs">관찰 메모: 누를 때마다 액체가 <b>한쪽 방향</b>으로 밀려 나갔어. 들어오는 쪽 문은 닫혀서 거꾸로 가지 않았지?</p>}
    </div>
  );
}

function ExchangeLab({ onDone }: { onDone: () => void }) {
  const [given, setGiven] = useState<number[]>([]);
  const cells = [0, 1, 2, 3];
  const done = given.length >= 4;
  return (
    <div className="lab">
      <h3>🔬 산소 배달 실험실</h3>
      <p>허파꽈리 안의 <b>파란 산소 알갱이</b>를 눌러 보라색 적혈구에게 보내 봐. 적혈구 색이 어떻게 변하지?</p>
      <div className="exchange">
        <div className="alveolus">
          <span>허파꽈리 (공기)</span>
          <div className="o2s">
            {cells.map((i) => (
              <button key={i} className={`o2 ${given.includes(i) ? 'used' : ''}`} disabled={given.includes(i)} onClick={() => setGiven((g) => [...g, i])} aria-label="산소 보내기">O₂</button>
            ))}
          </div>
          <div className="co2s">{given.map((i) => <span key={i} className="co2">CO₂</span>)}</div>
        </div>
        <div className="capillary">
          <span>모세혈관 (혈액)</span>
          <div className="rbcs">{cells.map((i) => <i key={i} className={`rbc ${given.includes(i) ? 'red' : ''}`} />)}</div>
        </div>
      </div>
      {done && (
        <>
          <p className="lab-obs">관찰 메모: 산소가 <b>폐에서 혈액으로</b> 들어가자 적혈구가 빨개졌고, 회색 이산화탄소는 혈액에서 <b>폐 쪽으로</b> 나갔어.</p>
          <button className="btn primary big" onClick={onDone}>관찰 끝! 다시 설명하기</button>
        </>
      )}
    </div>
  );
}

function ExerciseLab({ onDone }: { onDone: () => void }) {
  const [speed, setSpeed] = useState(0);
  const [tried, setTried] = useState(new Set<number>([0]));
  const need = [20, 45, 70, 95][speed];
  const bpm = [70, 95, 125, 160][speed];
  const labels = ['가만히 서 있기', '걷기', '뛰기', '전력 달리기'];
  const beatRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = beatRef.current;
    if (el) el.style.animationDuration = `${60 / bpm}s`;
  }, [bpm]);
  return (
    <div className="lab">
      <h3>🔬 달리기 실험실</h3>
      <p>달리기 속도를 바꾸며 <b>근육의 산소 필요량</b>과 <b>심장 박동</b>을 비교해 봐.</p>
      <input type="range" min={0} max={3} step={1} value={speed} onChange={(e) => { const v = Number(e.target.value); setSpeed(v); setTried((t) => new Set(t).add(v)); }} aria-label="달리기 속도" />
      <div className="lab-speed">{labels[speed]}</div>
      <div className="bars">
        <div><span>근육의 산소 필요량</span><div className="bar"><i style={{ width: `${need}%` }} /></div></div>
        <div><span>심장 박동 <b>{bpm}</b>회/분 <span ref={beatRef} className="beat">❤</span></span><div className="bar heart"><i style={{ width: `${(bpm / 170) * 100}%` }} /></div></div>
      </div>
      {tried.size >= 3 && (
        <>
          <p className="lab-obs">관찰 메모: 빨리 달릴수록 두 막대가 <b>함께</b> 길어졌어. 둘은 어떤 관계일까?</p>
          <button className="btn primary big" onClick={onDone}>관찰 끝! 다시 설명하기</button>
        </>
      )}
    </div>
  );
}

export function LabOverlay({ lab, onDone }: { lab: LabId; onDone: () => void }) {
  return (
    <div className="overlay-card lab-card" data-testid={`lab-${lab}`}>
      <div className="lab-intro"><Lumi mood="happy" size={44} /><p>괜찮아! 진짜 과학자도 여러 번 관찰해. 실험실에서 직접 확인해 보자.</p></div>
      {lab === 'pump' && <PumpLab onDone={onDone} />}
      {lab === 'exchange' && <ExchangeLab onDone={onDone} />}
      {lab === 'exercise' && <ExerciseLab onDone={onDone} />}
    </div>
  );
}

/** 실험 후에도 어려워하면 함께 빈칸을 채우며 정리하고 진행한다. */
export function ScaffoldOverlay({ questionId, onDone }: { questionId: string; onDone: () => void }) {
  const q = getQuestion(questionId);
  const sc = q.scaffold!;
  const [picked, setPicked] = useState<(string | null)[]>(sc.blanks.map(() => null));
  const allRight = picked.every((p, i) => p === sc.blanks[i].answer);
  const parts = sc.sentence.split('[ ]');
  return (
    <div className="overlay-card scaffold" data-testid="scaffold">
      <div className="lab-intro"><Lumi mood="happy" size={44} /><p>우리 같이 정리해 보자! 빈칸에 알맞은 말을 골라 봐.</p></div>
      <p className="sc-sentence">
        {parts.map((part, i) => (
          <span key={i}>{part}{i < sc.blanks.length && <b className={`blank ${picked[i] ? (picked[i] === sc.blanks[i].answer ? 'ok' : 'no') : ''}`}>{picked[i] ?? '　?　'}</b>}</span>
        ))}
      </p>
      {sc.blanks.map((b, i) => (
        <div className="sc-options" key={i}>
          <span>빈칸 {i + 1}:</span>
          {b.options.map((o) => (
            <button key={o} className={`chip ${picked[i] === o ? 'sel' : ''}`} onClick={() => setPicked((p) => p.map((x, j) => (j === i ? o : x)))}>{o}</button>
          ))}
        </div>
      ))}
      {picked.some((p, i) => p && p !== sc.blanks[i].answer) && <p className="ap-hint">💡 실험실에서 본 장면을 떠올려 다시 골라 봐!</p>}
      {allRight && (
        <>
          <p className="lab-obs">완성! 이 문장을 소리 내어 한 번 읽어 보자. 다음 복습 때 네 말로 다시 설명하게 될 거야.</p>
          <button className="btn primary big" onClick={onDone}>다음 탐사로</button>
        </>
      )}
    </div>
  );
}
