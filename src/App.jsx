import { useEffect, useMemo, useState } from 'react';
import { buildFallbackStars } from './fallbackData';

const LOCAL_USER_KEY = 'galaxy-local-user-v2';
const LOCAL_STATE_KEY = 'galaxy-local-progress-v2';

const STAGES = ['observe', 'judge', 'verify', 'report'];
const STAGE_LABELS = {
  observe: '观察',
  judge: '判断',
  verify: '验证',
  report: '报告',
};

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
      consistency: null,
      consistencySample: 0,
    };
  });

  return {
    stars,
    reports: [],
  };
}

function pickMissionPool(stars, poolSize = 12) {
  const shuffled = [...stars].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, poolSize).map((star) => star.id);
}

function App() {
  const [user, setUser] = useState(null);
  const [simState, setSimState] = useState(buildSimulationState);
  const [selectedStarId, setSelectedStarId] = useState(null);
  const [note, setNote] = useState('');
  const [taskMode, setTaskMode] = useState(false);
  const [missionStart, setMissionStart] = useState(null);
  const [missionStarIds, setMissionStarIds] = useState([]);
  const [stageIndex, setStageIndex] = useState(0);

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

  useEffect(() => {
    if (!taskMode || !missionStart) return undefined;

    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [taskMode, missionStart]);

  const selectedStar = useMemo(
    () => simState.stars.find((star) => star.id === selectedStarId) || null,
    [selectedStarId, simState.stars],
  );

  useEffect(() => {
    setNote(selectedStar?.userNote || '');
  }, [selectedStar?.id]);

  const scopedStars = taskMode
    ? simState.stars.filter((star) => missionPoolIds.includes(star.id))
    : simState.stars;

  const progress = useMemo(() => {
    const observed = scopedStars.filter((star) => star.observed).length;
    const candidates = scopedStars.filter((star) => star.userClassification === 'candidate').length;
    const confirmed = scopedStars.filter((star) => star.discoveryConfirmed).length;

    return {
      observed,
      candidates,
      confirmed,
      percent: scopedStars.length ? Math.round((observed / scopedStars.length) * 100) : 0,
    };
  }, [scopedStars]);

  const missionStars = useMemo(
    () => simState.stars.filter((star) => missionStarIds.includes(star.id)),
    [simState.stars, missionStarIds],
  );

  const stage = STAGES[stageIndex];

  const missionRemaining = useMemo(() => {
    if (!missionStart) return 15 * 60;
    const elapsed = Math.floor((Date.now() - missionStart) / 1000);
    return Math.max(0, 15 * 60 - elapsed);
  }, [missionStart, stageIndex, missionStarIds.length, selectedStarId]);

  const allJudged = missionStars.length > 0 && missionStars.every((star) => star.userClassification);

  const aiHint = useMemo(() => {
    if (!selectedStar) return 'AI 助手：你想先观察哪颗星？请说明你选择它的理由。';

    const { periodicity, dipDepth, noiseLevel } = selectedStar.metrics;
    if (stage === 'observe') {
      return `AI 助手：这条曲线在哪些时间段出现明显下降？你会如何记录（周期 ${periodicity}、深度 ${dipDepth}%、噪声 ${noiseLevel}%）？`;
    }
    if (stage === 'judge') {
      return 'AI 助手：你的判断依据是什么？哪些证据支持“可能有行星”，哪些证据支持“只是噪声”？';
    }
    if (stage === 'verify') {
      return 'AI 助手：如果你的判断和他人不一致，最可能是哪一步观察或解释不同？你会如何复核？';
    }
    return 'AI 助手：请把证据链写进报告：你观察到什么、如何判断、如何验证、最后结论是什么？';
  }, [selectedStar, stage]);

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

  function startTaskMode() {
    setTaskMode(true);
    setMissionStart(Date.now());
    setMissionStarIds([]);
    setSelectedStarId(null);
    setStageIndex(0);
  }

  function nextStage() {
    setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
  }

  function openStar(starId) {
    if (taskMode && stage === 'observe' && !missionStarIds.includes(starId) && missionStarIds.length >= 3) {
      return;
    }
    if (taskMode && stage !== 'observe' && !missionStarIds.includes(starId)) {
      return;
    }

    setSelectedStarId(starId);
    if (taskMode && stage === 'observe' && !missionStarIds.includes(starId)) {
      setMissionStarIds((prev) => [...prev, starId]);
    }

    setSimState((prev) => ({
      ...prev,
      stars: prev.stars.map((star) => (star.id === starId ? { ...star, observed: true } : star)),
    }));
  }

  function classifyStar(verdict) {
    if (!selectedStar || stage !== 'judge') return;

    const seed = Number(selectedStar.id.split('-')[1]);
    const baseline = selectedStar.hasSignal ? 70 : 35;
    const confidenceBump = verdict === 'candidate' ? 12 : -8;
    const consistency = Math.max(8, Math.min(96, baseline + confidenceBump + (seed % 11) - 5));

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
          consistency,
          consistencySample: 60 + (seed % 70),
        };
      }),
    }));
  }

  function generateReport() {
    const targets = missionStars.length ? missionStars : simState.stars.filter((star) => star.observed).slice(0, 3);
    const candidateStars = targets.filter((star) => star.userClassification === 'candidate');
    const report = {
      id: `R-${Date.now()}`,
      title: `15分钟科研探索报告 #${simState.reports.length + 1}`,
      createdAt: new Date().toLocaleString(),
      content: `本轮任务在 15 分钟内完成 ${targets.length} 颗恒星探索。观察对象：${targets.map((s) => s.id).join('、') || '暂无'}。判断结果：候选 ${candidateStars.length} 颗。验证阶段中，平均与其他用户一致性为 ${targets.length ? Math.round(targets.reduce((sum, star) => sum + (star.consistency || 0), 0) / targets.length) : 0}% 。`,
      insights: [
        '观察：优先标记重复出现下降段的光变曲线。',
        '判断：结合周期、深度、噪声三项指标给出证据链。',
        '验证：使用其他用户一致性检查主观偏差，再给出最终结论。',
      ],
    };

    setSimState((prev) => ({ ...prev, reports: [report, ...prev.reports] }));
  }

  const latestReport = simState.reports[0];

  useEffect(() => {
    if (taskMode && stage === 'report' && missionStars.length >= 1 && !latestReport?.title.includes('15分钟科研探索报告')) {
      generateReport();
    }
  }, [taskMode, stage]);

  return (
    <div className="app-shell">
      <header className="hero card">
        <h1>Galaxy Discovery · 15分钟科研探索任务</h1>
        <p>面向高中生：在 15 分钟内按“观察→判断→验证→报告”完成一次完整科研体验。</p>
        {!user ? (
          <button onClick={startAnonymous}>进入离线演示舱</button>
        ) : (
          <div className="task-entry">
            <p>欢迎回来，{user.nickname}。当前可切换为“任务模式”。</p>
            <button onClick={startTaskMode}>进入任务模式（15分钟探索）</button>
          </div>
        )}
      </header>

      {user && (
        <>
          <section className="card progress-panel">
            <div className="stats-row">
              <div><strong>{taskMode ? missionPoolIds.length : simState.stars.length}</strong><span>可探索目标</span></div>
              <div><strong>{progress.observed}</strong><span>已观测</span></div>
              <div><strong>{progress.candidates}</strong><span>候选目标</span></div>
              <div><strong>{progress.confirmed}</strong><span>协作确认</span></div>
            </div>
            <div className="progress-track"><div style={{ width: `${progress.percent}%` }} /></div>
            {taskMode ? (
              <div className="mission-flow">
                <p>任务倒计时：{Math.floor(missionRemaining / 60)}:{String(missionRemaining % 60).padStart(2, '0')} · 本轮限选 1-3 颗恒星（已选 {missionStarIds.length}/3）</p>
                <ol>
                  {STAGES.map((stageName, idx) => (
                    <li key={stageName} className={idx === stageIndex ? 'active' : idx < stageIndex ? 'done' : ''}>{STAGE_LABELS[stageName]}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>请先进入任务模式，系统将按流程推进，不再是随意浏览。</p>
            )}
          </section>

          <section className="main-grid">
            <div className="card star-map">
              <h2>任务星图（流程驱动）</h2>
              <p>观察阶段可选择最多 3 颗恒星；后续阶段仅允许查看已选目标。</p>
              <div className="map-canvas">
                {simState.stars.map((star) => {
                  const disabled = taskMode
                    ? (stage !== 'observe' && !missionStarIds.includes(star.id))
                    || (stage === 'observe' && missionStarIds.length >= 3 && !missionStarIds.includes(star.id))
                    : false;

                  return (
                    <button
                      key={star.id}
                      className={`star-dot ${star.discoveryConfirmed ? 'confirmed' : ''} ${selectedStarId === star.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                      style={{ left: `${star.x}%`, top: `${star.y}%` }}
                      onClick={() => openStar(star.id)}
                      title={`${star.id} · ${star.spectralType} 型星`}
                      disabled={disabled}
                    />
                  );
                })}
              </div>
            </div>

            <div className="card observe-panel">
              {!selectedStar ? (
                <p>请从左侧星图选择任务目标，进入当前阶段。</p>
              ) : (
                <>
                  <h3>{selectedStar.id} 观测界面</h3>
                  <p>{selectedStar.spectralType} 型 · 距离 {selectedStar.distanceLy} 光年</p>
                  <svg viewBox="0 0 540 230" className="curve-chart">
                    <polyline points={curvePoints} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
                  </svg>
                  <div className="metrics">
                    <span>周期性估计：{selectedStar.metrics.periodicity}</span>
                    <span>下降深度：{selectedStar.metrics.dipDepth}%</span>
                    <span>噪声范围：{selectedStar.metrics.noiseLevel}%</span>
                  </div>
                  <p className="ai-hint">{aiHint}</p>

                  {stage === 'judge' && (
                    <>
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="写下你的判断依据与证据链..." />
                      <div className="actions">
                        <button onClick={() => classifyStar('candidate')}>我判断：可能存在行星</button>
                        <button className="ghost" onClick={() => classifyStar('none')}>我判断：未发现信号</button>
                      </div>
                    </>
                  )}

                  {stage === 'verify' && selectedStar.consistency !== null && (
                    <div className="consistency-box">
                      其他用户一致性：{selectedStar.consistency}%（样本 {selectedStar.consistencySample} 人）
                    </div>
                  )}
                </>
              )}

              {taskMode && (
                <div className="stage-actions">
                  {stage === 'observe' && <button disabled={missionStarIds.length !== missionTargetCount} onClick={nextStage}>进入判断阶段</button>}
                  {stage === 'judge' && <button disabled={!allJudged} onClick={nextStage}>进入验证阶段</button>}
                  {stage === 'verify' && <button onClick={nextStage}>进入报告阶段</button>}
                </div>
              )}
            </div>
          </section>

          <section className="card report-page">
            <div className="report-head">
              <h2>一页研究报告</h2>
              <button onClick={generateReport}>重新生成报告</button>
            </div>
            {simState.reports.length === 0 ? (
              <p>进入任务模式并完成流程后，系统会自动生成报告。</p>
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
