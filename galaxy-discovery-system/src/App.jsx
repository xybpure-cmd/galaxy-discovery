import React, { useEffect, useMemo, useState } from 'react';

const STAR_COUNT = 100;
const STORAGE_KEY = 'galaxy-discovery-state-v1';

function buildStar(i) {
  const id = `GD-${String(i + 1).padStart(3, '0')}`;
  const x = 6 + ((i * 37) % 88);
  const y = 8 + ((i * 19) % 82);
  const size = 5 + (i % 4);
  const brightness = (10.4 + (i % 18) * 0.18).toFixed(1);
  const temperature = 4800 + (i % 9) * 180;
  const radius = (0.8 + (i % 7) * 0.12).toFixed(2);
  const hasPlanet = i % 17 === 0 || i % 29 === 0 || i % 31 === 0 || i % 43 === 0;
  const period = hasPlanet ? [3.8, 5.9, 7.4, 9.8][i % 4] : null;
  const depth = hasPlanet ? [0.018, 0.026, 0.033, 0.041][i % 4] : 0;
  const confirmations = hasPlanet ? 1 + (i % 5) : i % 2;
  const signalStrength = hasPlanet ? [72, 81, 88, 93][i % 4] : [14, 21, 27, 33][i % 4];
  return { id, x, y, size, brightness, temperature, radius, hasPlanet, period, depth, confirmations, signalStrength, explored: false, classified: null, notes: '' };
}

function generateStars() {
  return Array.from({ length: STAR_COUNT }, (_, i) => buildStar(i));
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function makeCurve(star) {
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const t = i * 0.45;
    let flux = 1 + 0.003 * Math.sin(i / 5) + 0.0015 * Math.cos(i / 7);
    if (star.hasPlanet && star.period) {
      const phase = t % star.period;
      if (phase < 0.72) flux -= star.depth;
    } else {
      flux += 0.0045 * Math.sin(i / 2.4) + 0.001 * Math.cos(i / 3.3);
    }
    flux += (seededRandom(i * 19 + star.id.length * 7) - 0.5) * 0.0015;
    pts.push({ t, flux });
  }
  return pts;
}

function curveToSvg(points) {
  const fluxes = points.map((p) => p.flux);
  const min = Math.min(...fluxes);
  const max = Math.max(...fluxes);
  return points.map((p, i) => {
    const x = 24 + (i / (points.length - 1)) * 380;
    const y = 24 + ((max - p.flux) / (max - min || 1)) * 132;
    return `${x},${y}`;
  }).join(' ');
}

function aiHints(star) {
  return star.hasPlanet
    ? [
        '这条曲线里是否存在近似重复的下降模式？',
        '每次下降的深度是否大致相近，而不是随机漂移？',
        '这种变化更像有节律的遮挡，还是偶然波动？'
      ]
    : [
        '这些起伏是否真正按固定时间重复出现？',
        '你看到的是稳定的凹口，还是不规则噪声？',
        '如果缺少清晰周期证据，是否应该谨慎标记？'
      ];
}

function rubric(star) {
  return [
    { label: '周期性', value: star.hasPlanet ? '较强' : '较弱' },
    { label: '下降深度稳定性', value: star.hasPlanet ? '较稳定' : '不稳定' },
    { label: '噪声干扰', value: star.hasPlanet ? '中等' : '较明显' }
  ];
}

function leaderboardRows(stars, playerName) {
  const meCandidates = stars.filter((s) => s.classified === 'candidate').length;
  const meExplored = stars.filter((s) => s.explored).length;
  const meScore = meCandidates * 15 + meExplored * 2;
  return [
    { name: playerName || '你', score: meScore, title: '当前探索者' },
    { name: 'NovaScout', score: 126, title: '协作发现者' },
    { name: 'SkyWalker', score: 114, title: '信号侦测者' },
    { name: 'TransitLab', score: 98, title: '新手天文学家' }
  ].sort((a, b) => b.score - a.score);
}

function saveState(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}
function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}
function defaultState() {
  return { playerName: '', stars: generateStars(), reportHistory: [] };
}

function App() {
  const [appState, setAppState] = useState(defaultState());
  const [started, setStarted] = useState(false);
  const [selectedStar, setSelectedStar] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [activePage, setActivePage] = useState('map');
  const [showIntro, setShowIntro] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [draftNote, setDraftNote] = useState('');

  useEffect(() => {
    const loaded = loadState();
    if (loaded) setAppState(loaded);
  }, []);
  useEffect(() => saveState(appState), [appState]);
  useEffect(() => { if (selectedStar) setDraftNote(selectedStar.notes || ''); }, [selectedStar]);

  const stars = appState.stars;
  const exploredCount = useMemo(() => stars.filter((s) => s.explored).length, [stars]);
  const candidateCount = useMemo(() => stars.filter((s) => s.classified === 'candidate').length, [stars]);
  const rejectedCount = useMemo(() => stars.filter((s) => s.classified === 'none').length, [stars]);
  const collaborativeCount = useMemo(() => stars.filter((s) => s.classified === 'candidate' && s.confirmations >= 3).length, [stars]);
  const badges = useMemo(() => {
    const result = [];
    if (exploredCount >= 1) result.push('新手天文学家');
    if (candidateCount >= 1) result.push('信号侦测者');
    if (collaborativeCount >= 1) result.push('协作发现者');
    if (exploredCount >= 20) result.push('银河巡航员');
    return result;
  }, [exploredCount, candidateCount, collaborativeCount]);
  const leaderboard = useMemo(() => leaderboardRows(stars, appState.playerName), [stars, appState.playerName]);
  const reportStars = stars.filter((s) => s.classified);

  const updateState = (patch) => setAppState((prev) => ({ ...prev, ...patch }));

  const classify = (type) => {
    if (!selectedStar) return;
    const updatedStars = stars.map((s) => s.id === selectedStar.id ? { ...s, explored: true, classified: type, notes: draftNote } : s);
    updateState({ stars: updatedStars });
    setSelectedStar(updatedStars.find((s) => s.id === selectedStar.id));
  };

  const saveNote = () => {
    if (!selectedStar) return;
    const updatedStars = stars.map((s) => s.id === selectedStar.id ? { ...s, notes: draftNote } : s);
    updateState({ stars: updatedStars });
    setSelectedStar(updatedStars.find((s) => s.id === selectedStar.id));
  };

  const generateReport = () => {
    const report = {
      id: `R-${Date.now()}`,
      createdAt: new Date().toLocaleString(),
      exploredCount,
      candidateCount,
      collaborativeCount,
      targets: reportStars.map((s) => ({ id: s.id, classified: s.classified, notes: s.notes })),
    };
    updateState({ reportHistory: [report, ...appState.reportHistory] });
    setReportOpen(true);
  };

  const resetMission = () => {
    const fresh = defaultState();
    setAppState({ ...fresh, playerName: appState.playerName });
    setSelectedStar(null);
    setActivePage('map');
    setReportOpen(false);
  };

  const closeModal = () => setSelectedStar(null);

  if (!started) {
    return <div className="page"><div className="hero card glass">
      <div className="starfield">{stars.slice(0,80).map(star => <span key={star.id} className="tiny-star" style={{left:`${star.x}%`, top:`${star.y}%`, width:star.size, height:star.size}} />)}</div>
      <div className="hero-grid">
        <div>
          <div className="chip">开放给所有人使用的游戏化科研学习平台</div>
          <h1>Galaxy Discovery</h1>
          <p className="lead">在银河中寻找可能存在行星的恒星。观察光变曲线，做出科学判断，参与协作发现，并生成你的研究报告。</p>
          <label className="label">请输入你的探索者名字</label>
          <input className="input" value={appState.playerName} onChange={(e)=>updateState({playerName:e.target.value})} placeholder="例如：阳斌 / Nova Explorer" />
          <div className="row gap mt24">
            <button className="btn primary" onClick={()=>setStarted(true)}>进入系统</button>
            <button className="btn secondary">全球协作探索</button>
          </div>
        </div>
        <div className="card overlay-card">
          <h3>第一版系统包含什么</h3>
          <p className="muted">这已经不是概念图，而是完整的工程化应用原型。</p>
          <ul className="plain-list">
            <li>银河地图自由探索</li>
            <li>一百颗可点击恒星目标</li>
            <li>光变曲线观测与判断</li>
            <li>AI 研究助手引导而不直接给答案</li>
            <li>协作验证提示与个人徽章系统</li>
            <li>自动生成研究报告与个人记录</li>
          </ul>
        </div>
      </div>
    </div></div>;
  }

  return <div className="page">
    <TopNav activePage={activePage} setActivePage={setActivePage} playerName={appState.playerName} resetMission={resetMission} />

    {activePage === 'map' && <div className="layout">
      <div className="card main-card">
        <div className="card-header between">
          <div>
            <h2>银河星图</h2>
            <p className="muted">自由探索恒星目标，寻找可能存在行星的系统</p>
          </div>
          <div className="row wrap gap">
            <span className="chip">已探索 {exploredCount}</span>
            <span className="chip">候选目标 {candidateCount}</span>
            <span className="chip">协作发现 {collaborativeCount}</span>
          </div>
        </div>
        <div className="row between wrap gap mb12">
          <div className="muted small">拖动你的视线，在银河中自由筛选目标恒星</div>
          <div className="row gap wrap">
            <button className="btn secondary small" onClick={() => setZoom((z) => Math.max(0.8, z - 0.1))}>缩小</button>
            <button className="btn secondary small" onClick={() => setZoom((z) => Math.min(1.8, z + 0.1))}>放大</button>
            <button className="btn primary small" onClick={generateReport}>生成研究报告</button>
          </div>
        </div>
        <div className="map-wrap">
          <div className="nebula" />
          <div className="map-surface" style={{ transform: `scale(${zoom})` }}>
            {stars.map((star) => (
              <button key={star.id}
                className={`star ${star.classified === 'candidate' ? 'candidate' : star.classified === 'none' ? 'rejected' : ''}`}
                style={{ left: `${star.x}%`, top: `${star.y}%`, width: 14 + star.size, height: 14 + star.size }}
                title={`${star.id} · 亮度 ${star.brightness}`}
                onClick={() => setSelectedStar(star)}
              />
            ))}
          </div>
        </div>
      </div>
      <RightPanel exploredCount={exploredCount} candidateCount={candidateCount} collaborativeCount={collaborativeCount} badges={badges} leaderboard={leaderboard} stars={stars} setActivePage={setActivePage} />
    </div>}

    {activePage === 'academy' && <AcademyPage />}
    {activePage === 'discoveries' && <DiscoveriesPage stars={stars} setReportOpen={setReportOpen} />}
    {activePage === 'reports' && <ReportsPage reportHistory={appState.reportHistory} />}

    {selectedStar && <div className="modal-backdrop" onClick={closeModal}><div className="modal large" onClick={(e)=>e.stopPropagation()}><StarPanel star={selectedStar} onClassify={classify} draftNote={draftNote} setDraftNote={setDraftNote} saveNote={saveNote} close={closeModal} /></div></div>}

    {reportOpen && <div className="modal-backdrop" onClick={()=>setReportOpen(false)}><div className="modal report" onClick={(e)=>e.stopPropagation()}>
      <div className="modal-header"><h3>我的天文探索报告</h3><button className="icon-btn" onClick={()=>setReportOpen(false)}>×</button></div>
      <div className="report-body">
        <section><h4>研究问题</h4><p>我试图在 Galaxy Discovery 的银河星图中寻找可能存在行星的恒星，并通过光变曲线的周期性亮度下降来判断候选目标。</p></section>
        <section><h4>探索过程</h4><p>本次共探索 {exploredCount} 颗恒星，标记 {candidateCount} 个候选目标，排除 {rejectedCount} 个未发现明确信号的目标。</p></section>
        <section><h4>数据证据</h4>{reportStars.length===0 ? <p>当前尚未形成研究结论。请先进入银河地图探索若干恒星。</p> : reportStars.map(s => <div key={s.id} className="evidence-box"><strong>{s.id}</strong><p>{s.classified === 'candidate' ? '判断为可能存在行星。' : '判断为未发现明确信号。'}</p><p className="muted">亮度等级：{s.brightness}；信号强度：{s.signalStrength}；协作验证计数：{s.confirmations}</p>{s.notes ? <p>研究备注：{s.notes}</p> : null}</div>)}</section>
        <section><h4>研究结论</h4><p>我主要根据曲线中是否存在重复出现的稳定下降模式来识别候选恒星。当前已有 {collaborativeCount} 个目标达到协作验证阈值。这不是一次答题完成，而是一次游戏化科研探索的开始。</p></section>
      </div>
    </div></div>}

    {showIntro && <div className="modal-backdrop" onClick={()=>setShowIntro(false)}><div className="modal intro" onClick={(e)=>e.stopPropagation()}>
      <div className="modal-header"><h3>欢迎进入 Galaxy Discovery</h3><button className="icon-btn" onClick={()=>setShowIntro(false)}>×</button></div>
      <div className="intro-list">
        <p>第一步：进入银河星图，点击任意恒星打开观测窗口。</p>
        <p>第二步：观察光变曲线，判断是否存在稳定、重复出现的亮度下降。</p>
        <p>第三步：结合 AI 助手提示，点击“可能存在行星”或“未发现信号”。</p>
        <p>第四步：持续探索，参与协作验证，并生成一页研究报告。</p>
      </div>
      <div className="row end"><button className="btn primary" onClick={()=>setShowIntro(false)}>我知道了，开始探索</button></div>
    </div></div>}
  </div>;
}

function TopNav({ activePage, setActivePage, playerName, resetMission }) {
  const tabs = [
    ['map', '银河地图'],
    ['academy', '新手学院'],
    ['discoveries', '发现中心'],
    ['reports', '研究记录'],
  ];
  return <div className="topnav glass card">
    <div><div className="brand">Galaxy Discovery</div><div className="muted small">探索者：{playerName || '未命名探索者'}</div></div>
    <div className="row wrap gap">{tabs.map(([key,label]) => <button key={key} className={`btn ${activePage===key?'primary':'secondary'}`} onClick={()=>setActivePage(key)}>{label}</button>)}<button className="btn secondary" onClick={resetMission}>重置任务</button></div>
  </div>;
}

function RightPanel({ exploredCount, candidateCount, collaborativeCount, badges, leaderboard, stars, setActivePage }) {
  const hotTargets = stars.filter((s) => s.confirmations >= 3).slice(0, 4);
  return <div className="sidebar">
    <InfoCard title="AI 研究助手" desc="AI 通过提问帮助你做判断，不直接给答案。">
      <ul className="plain-list compact"><li>这条曲线中是否出现了重复的凹口？</li><li>下降深度是否相近，而不是杂乱波动？</li><li>如果下降模式反复出现，是否可能意味着行星凌星？</li></ul>
    </InfoCard>
    <InfoCard title="探索进度" desc="这是你的个人探索档案。">
      <div className="progress"><div className="progress-bar" style={{width:`${exploredCount}%`}} /></div>
      <p>已探索 {exploredCount} / 100 颗恒星</p><p>候选目标 {candidateCount} 个</p><p>协作发现 {collaborativeCount} 个</p>
    </InfoCard>
    <InfoCard title="探索徽章" desc="游戏化科研成就">{badges.length===0 ? <p className="muted">探索第一颗恒星后，这里会点亮你的徽章。</p> : badges.map(b => <div key={b} className="list-item">{b}</div>)}</InfoCard>
    <InfoCard title="热门目标" desc="这些恒星正在接近协作验证阈值">{hotTargets.map(s => <div key={s.id} className="list-item"><strong>{s.id}</strong><span className="muted">协作计数：{s.confirmations}</span></div>)}<button className="btn secondary full" onClick={() => setActivePage('discoveries')}>查看发现中心</button></InfoCard>
    <InfoCard title="排行榜" desc="开放平台中的实时探索者排名">{leaderboard.map((row,idx) => <div key={row.name} className="list-item between"><span>{idx+1}. {row.name}</span><strong>{row.score}</strong></div>)}</InfoCard>
  </div>;
}

function InfoCard({ title, desc, children }) {
  return <div className="card glass"><h3>{title}</h3><p className="muted small">{desc}</p><div className="stack">{children}</div></div>;
}

function AcademyPage() {
  const lessons = [
    ['第一课：什么是光变曲线', '光变曲线是恒星亮度随时间变化的图像。真正重要的不是曲线低不低，而是它是否出现重复、稳定、可解释的凹口。'],
    ['第二课：怎样判断可能有行星', '通常看三件事：是否周期性重复、下降深度是否相近、信号是否明显区别于噪声。满足这些条件时，可以标记为候选目标。'],
    ['第三课：为什么需要协作验证', '一名用户的判断可能受偏差影响。多名探索者独立关注同一目标，更接近真实科研中的重复验证逻辑。']
  ];
  return <div className="grid3">{lessons.map(([t,c]) => <div className="card glass" key={t}><h3>{t}</h3><p>{c}</p></div>)}</div>;
}

function DiscoveriesPage({ stars, setReportOpen }) {
  const collaborative = stars.filter((s) => s.confirmations >= 3);
  const myTargets = stars.filter((s) => s.classified === 'candidate');
  return <div className="grid2">
    <div className="card glass"><h3>协作发现中心</h3><p className="muted small">多名探索者正在共同关注这些目标</p><div className="stack">{collaborative.slice(0,10).map(s => <div key={s.id} className="list-item"><strong>{s.id}</strong><span>协作验证计数：{s.confirmations} · 信号强度：{s.signalStrength}</span></div>)}</div></div>
    <div className="card glass"><h3>我的候选目标</h3><p className="muted small">这是你个人探索形成的研究线索</p><div className="stack">{myTargets.length===0 ? <p>你还没有标记候选目标。先回到银河地图完成探索。</p> : myTargets.map(s => <div key={s.id} className="list-item"><strong>{s.id}</strong><span>亮度等级：{s.brightness} · 协作计数：{s.confirmations}</span>{s.notes ? <span>研究备注：{s.notes}</span> : null}</div>)}<button className="btn primary" onClick={() => setReportOpen(true)}>查看研究报告</button></div></div>
  </div>;
}

function ReportsPage({ reportHistory }) {
  return <div className="card glass"><h3>研究记录档案</h3><p className="muted small">系统自动保存你生成过的研究报告</p><div className="stack">{reportHistory.length===0 ? <p>你还没有生成过报告。完成探索后，报告会出现在这里。</p> : reportHistory.map(r => <div key={r.id} className="list-item"><strong>报告编号：{r.id}</strong><span>生成时间：{r.createdAt}</span><span>探索目标数：{r.exploredCount} · 候选目标数：{r.candidateCount} · 协作发现数：{r.collaborativeCount}</span></div>)}</div></div>;
}

function StarPanel({ star, onClassify, draftNote, setDraftNote, saveNote, close }) {
  const points = makeCurve(star);
  const polyline = curveToSvg(points);
  const hints = aiHints(star);
  const collaborative = star.classified === 'candidate' && star.confirmations >= 3;
  return <div>
    <div className="modal-header"><div><h3>{star.id}</h3><p className="muted small">观察这颗恒星的亮度变化，判断是否可能存在行星。</p></div><button className="icon-btn" onClick={close}>×</button></div>
    <div className="grid2 panel-grid">
      <div className="stack">
        <div className="card panel-card"><div className="between mb12"><span className="muted small">光变曲线</span><span className="chip">信号强度 {star.signalStrength}</span></div>
          <svg viewBox="0 0 440 188" className="curve-svg">
            <line x1="24" y1="158" x2="404" y2="158" stroke="#64748b" strokeWidth="1" />
            <line x1="24" y1="24" x2="24" y2="158" stroke="#64748b" strokeWidth="1" />
            <polyline fill="none" stroke="#f8fafc" strokeWidth="3" points={polyline} />
            <text x="30" y="18" fill="#94a3b8" fontSize="10">亮度</text>
            <text x="370" y="176" fill="#94a3b8" fontSize="10">时间</text>
          </svg>
        </div>
        <div className="card panel-card"><h4>研究判断</h4><p className="muted small">先看证据，再做标记。</p><div className="row wrap gap mt12"><button className="btn primary" onClick={() => onClassify('candidate')}>可能存在行星</button><button className="btn secondary" onClick={() => onClassify('none')}>未发现信号</button></div><textarea className="textarea mt12" value={draftNote} onChange={(e)=>setDraftNote(e.target.value)} placeholder="写下你的判断依据，例如：曲线中出现近似固定周期的亮度下降。" /><div className="row gap mt12"><button className="btn secondary" onClick={saveNote}>保存研究备注</button></div>{star.classified && <div className="notice mt12">你的判断已记录。继续探索更多恒星，可能会接近新的发现。</div>}</div>
      </div>
      <div className="stack">
        <div className="card panel-card"><h4>AI 研究助手</h4><p className="muted small">AI 通过提问引导你观察，不直接给出答案。</p><div className="stack mt12">{hints.map(h => <div key={h} className="hint-box">{h}</div>)}</div></div>
        <div className="card panel-card"><h4>观测信息</h4><div className="stack mt12"><div>目标编号：{star.id}</div><div>亮度等级：{star.brightness}</div><div>表面温度：{star.temperature} K</div><div>恒星半径：{star.radius} R☉</div><div>协作验证计数：{star.confirmations}</div></div></div>
        <div className="card panel-card"><h4>判断参考</h4><div className="stack mt12">{rubric(star).map(r => <div key={r.label} className="list-item between"><span>{r.label}</span><span className="muted">{r.value}</span></div>)}</div></div>
        {collaborative && <div className="card discover-box"><strong>潜在协作发现</strong><p>多名探索者独立关注了同一目标。你参与了这次潜在发现。</p></div>}
      </div>
    </div>
  </div>;
}

export default App;
