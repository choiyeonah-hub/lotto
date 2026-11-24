// 브라우저 음성 인식(Web Speech API, ko-KR). 녹음 파일을 만들거나 저장하지 않는다.
// 주의: Chrome 등은 인식을 위해 음성을 브라우저 제조사 서버로 보낼 수 있다(브라우저 정책).

interface SR extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;

function ctor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupported = () => typeof window !== 'undefined' && !!ctor();

export interface Listening { stop(): void }

export function listen(handlers: { onText: (text: string, final: boolean) => void; onError: (msg: string) => void; onEnd: () => void }): Listening | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = 'ko-KR';
  rec.interimResults = true;
  rec.continuous = true; // 천천히 말해도 끊기지 않게
  rec.maxAlternatives = 1;
  let finalText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + ' ';
      else interim += r[0].transcript;
    }
    handlers.onText((finalText + interim).trim(), interim === '');
  };
  rec.onerror = (e) => {
    const msg: Record<string, string> = {
      'not-allowed': '마이크 사용이 허용되지 않았어요. 글자로 답해도 괜찮아요!',
      'no-speech': '목소리가 들리지 않았어요. 다시 눌러 말해 보거나 글자로 답해 줘.',
      network: '음성 인식 서버에 연결하지 못했어요. 글자로 답해 줘.',
      'audio-capture': '마이크를 찾지 못했어요. 글자로 답해 줘.',
    };
    handlers.onError(msg[e.error] ?? '음성 인식에 문제가 생겼어요. 글자로 답해 줘.');
  };
  rec.onend = handlers.onEnd;
  try {
    rec.start();
  } catch {
    handlers.onError('음성 인식을 시작하지 못했어요. 글자로 답해 줘.');
    return null;
  }
  return { stop: () => rec.stop() };
}

/** 안내 캐릭터 대사를 읽어 준다 (지원 시) */
export function speak(text: string, enabled: boolean) {
  if (!enabled || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[⚠🔍🏔🏅🆕]/gu, ''));
    u.lang = 'ko-KR';
    u.rate = 1.05;
    u.pitch = 1.15;
    window.speechSynthesis.speak(u);
  } catch {
    /* 무시 */
  }
}
