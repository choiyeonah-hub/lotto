import { lazy, Suspense, useEffect } from 'react';
import { HomeScreen, RecordsScreen } from './ui/Home';
import { ReviewScreen } from './ui/Review';
import { useApp } from './store/useApp';

// 3D는 무거우므로 탐험 화면에 들어갈 때만 불러온다
const GameScreen = lazy(() => import('./ui/GameScreen').then((m) => ({ default: m.GameScreen })));

export default function App() {
  const { screen, profile, init, setScreen } = useApp();
  useEffect(() => {
    init();
    // 알림을 눌러 들어오면 바로 복습 화면
    if (new URLSearchParams(location.search).get('review') === '1') setScreen('review');
  }, [init, setScreen]);

  if (!profile || screen === 'home') return <HomeScreen />;
  if (screen === 'records') return <RecordsScreen />;
  if (screen === 'review') return <ReviewScreen />;
  return (
    <Suspense fallback={<div className="loading">탐사선 준비 중…</div>}>
      <GameScreen />
    </Suspense>
  );
}
