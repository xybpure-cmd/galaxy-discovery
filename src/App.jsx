import { useEffect, useMemo, useState } from 'react';
import { buildFallbackStars } from './fallbackData';

const LOCAL_USER_KEY = 'galaxy-local-user-v2';
const LOCAL_STATE_KEY = 'galaxy-local-progress-v2';

function createLightCurve(seed, hasSignal) {
  const points = [];
  const transitPeriod = 18 + (seed % 9);
  const depth = hasSignal ? 0.03 + ((seed % 4) * 0.008) : 0;
  const baseNoise = hasSignal ? 0.006 : 0.012;

  for (let t = 0; t <= 120; t += 1) {
    const wave = Math.sin((t + seed) / 7) * 0.003;
    const pseudoNoise = ((((t * 17 + seed * 31) % 100) / 100) - 0.5) * baseNoise;
    const phase = (t + seed) % transitPeriod;
    const transit = hasSignal && phase > transitPeriod * 0.42 && phase < transitPeriod * 0.56 ? depth : 0;

    points.push({
      time: t,
      flux: Number((1 + wave + pseudoNoise - transit).toFixed(4)),
    });
  }

  return points;
}

function deriveSignalMetrics(points) {
  const fluxes = points.map((p) => p.flux);
  const minFlux = Math.min(...fluxes);
  const maxFlux = Math.max(...fluxes);
  const avgFlux = fluxes.reduce((sum, f) => sum + f, 0) / fluxes.length;

  const lowPoints = points.filter((p) => p.flux < avgFlux - 0.012);
  const periods = [];
  for (let i = 1; i < lowPoints.length; i += 1) {
    periods.push(lowPoints[i].time - lowPoints[i - 1].time);
  }
  const avgPeriod = periods.length
    ? periods.reduce((sum, p) => sum + p, 0) / periods.length
    : 0;

  return {
    dipDepth: Number(((avgFlux - minFlux) * 100).toFixed(2)),
    noiseLevel: Number(((maxFlux - minFlux) * 100).toFixed(2)),
    periodicity: Number(avgPeriod.toFixed(1)),
  };
}

function buildSimulationState() {
  const stars = buildFallbackStars(72).map((star, index) => {
    const hasSignal = index % 4 === 0 || index % 11 === 0;
    const points = createLightCurve(index + 3, hasSignal);

    return {
      ...star,
      id: `GX-${String(index + 1).padStart(3, '0')}`,
      spectralType: ['F', 'G', 'K', 'M'][index % 4],
      distanceLy: 90 + (index % 20) * 13,
      hasSignal,
      lightCurve: points,
      metrics: deriveSignalMetrics(points),
      userClassification: null,
      observed: false,
      candidateUsers: 0,
      discoveryConfirmed: false,
      userNote: '',
    };
  });

  return {
    stars,
    reports: [],
    achievements: [],
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [simState, setSimState] = useState(buildSimulationState);
  const [selectedStarId, setSelectedStarId] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem(LOCAL_USER_KEY);
    if (savedUser) setUser(JSON.parse(savedUser));

    const savedState = localStorage.getItem(LOCAL_STATE_KEY);
    if (savedState) {
      setSimState((prev) => ({ ...prev, ...JSON.parse(savedState) }));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(simState));
  }, [simState]);

  const selectedStar = useMemo(
    () => simState.stars.find((star) => star.id === selectedStarId) || null,
    [selectedStarId, simState.stars],
  );

  useEffect(() => {
    setNote(selectedStar?.userNote || '');
  }, [selectedStar?.id]);

  const progress = useMemo(() => {
    const observed = simState.stars.filter((star) => star.observed).length;
    const candidates = simState.stars.filter((star) => star.userClassification === 'candidate').length;
    const confirmed = simState.stars.filter((star) => star.discoveryConfirmed).length;

    return {
      observed,
      candidates,
      confirmed,
      percent: Math.round((observed / simState.stars.length) * 100),
    };
  }, [simState.stars]);

  const badges = useMemo(() => {
    const dynamic = [];
    if (progress.observed >= 5) dynamic.push('初级观测员');
    if (progress.observed >= 20) dynamic.push('深空巡天者');
    if (progress.candidates >= 3) dynamic.push('行星猎手');
    if (progress.confirmed >= 1) dynamic.push('协作发现者');
    return dynamic;
  }, [progress]);

  const aiHint = useMemo(() => {
    if (!selectedStar) return '请选择一颗恒星，AI 将提示你如何判断。';

    const { periodicity, dipDepth, noiseLevel } = selectedStar.metrics;
    const periodicHint = periodicity > 6 && periodicity < 28 ? '出现疑似周期性下降。' : '周期性不明显。';
    const depthHint = dipDepth > 2.4 ? '下降深度较清晰，值得关注。' : '下降深度偏浅，可能是噪声。';
    const noiseHint = noiseLevel < 6.5 ? '噪声较低，数据可信度更高。' : '噪声较高，请谨慎判断。';
    return `AI提示：${periodicHint}${depthHint}${noiseHint}`;
  }, [selectedStar]);

  const curvePoints = useMemo(() => {
    if (!selectedStar) return '';
    const fluxes = selectedStar.lightCurve.map((p) => p.flux);
    const min = Math.min(...fluxes);
    const max = Math.max(...fluxes);

    return selectedStar.lightCurve
      .map((point, index) => {
        const x = 28 + (index / (selectedStar.lightCurve.length - 1)) * 480;
        const y = 16 + ((max - point.flux) / (max - min || 1)) * 190;
        return `${x},${y}`;
      })
      .join(' ');
  }, [selectedStar]);

  function startAnonymous() {
    const anonymous = {
      id: `U-${Date.now().toString().slice(-6)}`,
      nickname: `探索者${Math.floor(Math.random() * 1000)}`,
    };
    setUser(anonymous);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(anonymous));
  }

  function openStar(starId) {
    setSelectedStarId(starId);
    setSimState((prev) => ({
      ...prev,
      stars: prev.stars.map((star) => (star.id === starId ? { ...star, observed: true } : star)),
    }));
  }

  function classifyStar(verdict) {
    if (!selectedStar) return;

    setSimState((prev) => ({
      ...prev,
      stars: prev.stars.map((star) => {
        if (star.id !== selectedStar.id) return star;

        const candidateUsers = verdict === 'candidate' ? Math.max(star.candidateUsers + 1, 1) : Math.max(star.candidateUsers - 1, 0);
        const discoveryConfirmed = candidateUsers >= 2;

        return {
          ...star,
          userClassification: verdict,
          userNote: note,
          candidateUsers,
          discoveryConfirmed,
        };
      }),
    }));
  }

  function generateReport() {
    const candidateStars = simState.stars.filter((star) => star.userClassification === 'candidate');
    const report = {
      id: `R-${Date.now()}`,
      title: `银河探索研究报告 #${simState.reports.length + 1}`,
      createdAt: new Date().toLocaleString(),
      content: `本轮完成 ${progress.observed}/${simState.stars.length} 颗目标观测，标注候选 ${candidateStars.length} 颗，协作确认 ${progress.confirmed} 颗。重点候选：${candidateStars
        .slice(0, 5)
        .map((star) => `${star.id}(深度${star.metrics.dipDepth}%)`)
        .join('、') || '暂无'}。`,
      insights: [
        '优先关注周期性下降且噪声较低的目标。',
        '对于深度不足 2% 的曲线，需要更多轮次复核。',
        '建议下一阶段对已确认候选进行连续观测。',
      ],
    };

    setSimState((prev) => ({ ...prev, reports: [report, ...prev.reports] }));
  }

  return (
    <div className="app-shell">
      <header className="hero card">
        <h1>Galaxy Discovery · 科研探索舰桥</h1>
        <p>通过星图巡天、光变判读、AI 引导与报告生成，完成你的小型系外行星发现任务。</p>
        {!user ? (
          <button onClick={startAnonymous}>进入离线演示舱</button>
        ) : (
          <p>欢迎回来，{user.nickname}。当前模式：本地模拟科研训练（无需后端）。</p>
        )}
      </header>

      {user && (
        <>
          <section className="card progress-panel">
            <div className="stats-row">
              <div><strong>{simState.stars.length}</strong><span>可探索目标</span></div>
              <div><strong>{progress.observed}</strong><span>已观测</span></div>
              <div><strong>{progress.candidates}</strong><span>候选目标</span></div>
              <div><strong>{progress.confirmed}</strong><span>协作确认</span></div>
            </div>
            <div className="progress-track"><div style={{ width: `${progress.percent}%` }} /></div>
            <p>探索进度 {progress.percent}% · 成就徽章：{badges.length ? badges.join(' / ') : '继续探索解锁'}</p>
          </section>

          <section className="main-grid">
            <div className="card star-map">
              <h2>银河探索主界面</h2>
              <p>点击任意恒星进入观测界面。金色代表协作确认候选，蓝色代表普通目标。</p>
              <div className="map-canvas">
                {simState.stars.map((star) => (
                  <button
                    key={star.id}
                    className={`star-dot ${star.discoveryConfirmed ? 'confirmed' : ''} ${selectedStarId === star.id ? 'selected' : ''}`}
                    style={{ left: `${star.x}%`, top: `${star.y}%` }}
                    onClick={() => openStar(star.id)}
                    title={`${star.id} · ${star.spectralType} 型星`}
                  />
                ))}
              </div>
            </div>

            <div className="card observe-panel">
              {!selectedStar ? (
                <p>请从左侧星图选择目标，进入观测模式。</p>
              ) : (
                <>
                  <h3>{selectedStar.id} 观测界面</h3>
                  <p>{selectedStar.spectralType} 型 · 距离 {selectedStar.distanceLy} 光年 · 候选计数 {selectedStar.candidateUsers}</p>
                  <svg viewBox="0 0 540 230" className="curve-chart">
                    <polyline points={curvePoints} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
                  </svg>
                  <div className="metrics">
                    <span>周期性估计：{selectedStar.metrics.periodicity}</span>
                    <span>下降深度：{selectedStar.metrics.dipDepth}%</span>
                    <span>噪声范围：{selectedStar.metrics.noiseLevel}%</span>
                  </div>
                  <p className="ai-hint">{aiHint}</p>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="记录你的科研判断依据..." />
                  <div className="actions">
                    <button onClick={() => classifyStar('candidate')}>可能存在行星</button>
                    <button className="ghost" onClick={() => classifyStar('none')}>未发现信号</button>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="card report-page">
            <div className="report-head">
              <h2>研究报告</h2>
              <button onClick={generateReport}>生成一页研究报告</button>
            </div>
            {simState.reports.length === 0 ? (
              <p>还没有报告，完成几次观测并点击生成按钮。</p>
            ) : (
              simState.reports.map((report) => (
                <article key={report.id} className="report-card">
                  <h3>{report.title}</h3>
                  <small>{report.createdAt}</small>
                  <p>{report.content}</p>
                  <ul>
                    {report.insights.map((insight) => <li key={insight}>{insight}</li>)}
                  </ul>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
