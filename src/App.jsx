import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { buildFallbackStars } from './fallbackData';

const LOCAL_USER_KEY = 'galaxy-user-id-v1';

function App() {
  const [user, setUser] = useState(null);
  const [stars, setStars] = useState(buildFallbackStars());
  const [selectedStar, setSelectedStar] = useState(null);
  const [lightCurve, setLightCurve] = useState([]);
  const [reports, setReports] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiReady, setApiReady] = useState(false);

  const candidates = useMemo(() => stars.filter((s) => s.userClassification === 'candidate').length, [stars]);
  const discoveries = useMemo(() => stars.filter((s) => s.discoveryConfirmed).length, [stars]);

  useEffect(() => {
    const saved = localStorage.getItem(LOCAL_USER_KEY);
    if (saved) {
      setUser({ id: Number(saved), nickname: `探索者#${saved}` });
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      loadStars();
      loadReports(user.id);
    }
  }, [user?.id]);

  async function loadStars() {
    try {
      setLoading(true);
      setError('');
      const data = await api.getStars();
      setStars(data.stars || []);
      setApiReady(true);
    } catch (err) {
      setApiReady(false);
      setError(`后端暂时不可用，已切换离线演示模式：${err.message}`);
      setStars((prev) => (prev.length > 0 ? prev : buildFallbackStars()));
    } finally {
      setLoading(false);
    }
  }

  async function loadReports(userId) {
    try {
      const data = await api.getReportHistory(userId);
      setReports(data.reports || []);
    } catch (_) {
      setReports([]);
    }
  }

  async function startAnonymous() {
    setError('');
    try {
      const data = await api.createAnonymousUser();
      localStorage.setItem(LOCAL_USER_KEY, String(data.user.id));
      setUser(data.user);
      setApiReady(true);
    } catch (err) {
      setUser({ id: -1, nickname: '匿名探索者(离线)' });
      setApiReady(false);
      setError(`后端未连接，已进入离线演示模式：${err.message}`);
    }
  }

  async function login(formData) {
    const nickname = formData.get('nickname')?.toString().trim();
    const email = formData.get('email')?.toString().trim();
    if (!nickname && !email) {
      setError('请至少填写昵称或邮箱。');
      return;
    }

    setError('');
    try {
      const data = await api.login({ nickname, email });
      localStorage.setItem(LOCAL_USER_KEY, String(data.user.id));
      setUser(data.user);
      setApiReady(true);
    } catch (err) {
      setUser({ id: -1, nickname: nickname || email || '离线探索者' });
      setApiReady(false);
      setError(`后端未连接，已进入离线演示模式：${err.message}`);
    }
  }

  async function openStar(star) {
    setSelectedStar(star);
    setNote(star.userNote || '');
    if (!apiReady) {
      const points = Array.from({ length: 72 }, (_, i) => ({
        t: +(i * 0.45).toFixed(2),
        flux: +(1 + 0.003 * Math.sin(i / 5) + 0.002 * Math.cos(i / 7)).toFixed(5),
      }));
      setLightCurve(points);
      return;
    }
    try {
      const data = await api.getLightCurve(star.id);
      setLightCurve(data.points || []);
    } catch (err) {
      setError(`光变曲线加载失败：${err.message}`);
      setLightCurve([]);
    }
  }

  async function submitClassification(verdict) {
    if (!selectedStar || !user?.id) return;

    if (!apiReady || user.id < 0) {
      const updated = stars.map((s) =>
        s.id === selectedStar.id
          ? { ...s, userClassification: verdict, userNote: note }
          : s
      );
      setStars(updated);
      setSelectedStar(updated.find((s) => s.id === selectedStar.id) || null);
      setError('离线演示模式下，判断只保存在当前页面，不会同步到服务器。');
      return;
    }

    try {
      await api.submitClassification({
        userId: user.id,
        starId: selectedStar.id,
        verdict,
        notes: note,
      });
      await loadStars();
      const validation = await api.getValidation(selectedStar.id);
      setSelectedStar((prev) => ({ ...prev, ...validation.star }));
    } catch (err) {
      setError(`提交失败：${err.message}`);
    }
  }

  async function generateReport() {
    if (!user?.id) return;

    if (!apiReady || user.id < 0) {
      const report = {
        id: `offline-${Date.now()}`,
        title: '离线演示报告',
        content: `离线模式：已浏览 ${stars.length} 颗恒星，标记 ${candidates} 个候选目标。`,
      };
      setReports((prev) => [report, ...prev]);
      setError('当前为离线演示模式，报告未写入服务器。');
      return;
    }

    try {
      const data = await api.generateReport({ userId: user.id });
      setReports((prev) => [data.report, ...prev]);
    } catch (err) {
      setError(`报告生成失败：${err.message}`);
    }
  }

  const points = useMemo(() => {
    if (!lightCurve.length) return '';
    const fluxes = lightCurve.map((p) => p.flux);
    const min = Math.min(...fluxes);
    const max = Math.max(...fluxes);
    return lightCurve
      .map((p, i) => {
        const x = 20 + (i / (lightCurve.length - 1)) * 380;
        const y = 20 + ((max - p.flux) / (max - min || 1)) * 160;
        return `${x},${y}`;
      })
      .join(' ');
  }, [lightCurve]);

  return (
    <div className="page">
      <h1>Galaxy Discovery</h1>
      <p>一个开放给所有人使用的游戏化科研学习平台。</p>

      {!apiReady && (
        <div className="card warning">
          <strong>演示模式</strong>
          <p>后端还没连上，页面仍可正常显示与体验，不会黑屏。</p>
        </div>
      )}

      {!user ? (
        <div className="card">
          <h2>先进入系统</h2>
          <button onClick={startAnonymous}>匿名开始探索</button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              login(new FormData(e.currentTarget));
            }}
          >
            <input name="nickname" placeholder="昵称（可选）" />
            <input name="email" placeholder="邮箱（可选）" />
            <button type="submit">登录 / 创建用户</button>
          </form>
        </div>
      ) : (
        <>
          <div className="stats">
            <span>恒星总数：{stars.length}</span>
            <span>我的候选：{candidates}</span>
            <span>协作发现：{discoveries}</span>
            <button onClick={generateReport}>生成研究报告</button>
          </div>

          {error && <p className="error">{error}</p>}
          {loading && <p>加载中...</p>}

          <div className="layout">
            <div className="card map">
              {stars.map((star) => (
                <button
                  key={star.id}
                  className={`star ${star.discoveryConfirmed ? 'discovery' : ''}`}
                  style={{ left: `${star.x}%`, top: `${star.y}%` }}
                  onClick={() => openStar(star)}
                  title={star.id}
                />
              ))}
            </div>

            <div className="card panel">
              {!selectedStar ? (
                <p>点击星图中的恒星查看光变曲线。</p>
              ) : (
                <>
                  <h3>{selectedStar.id}</h3>
                  <p>协作候选人数：{selectedStar.candidateUsers || 0}</p>
                  <svg viewBox="0 0 420 200" className="curve">
                    <polyline points={points} fill="none" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="写下你的判断依据"
                  />
                  <div className="actions">
                    <button onClick={() => submitClassification('candidate')}>可能有行星</button>
                    <button onClick={() => submitClassification('none')}>未发现信号</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h2>报告历史</h2>
            {reports.length === 0 ? (
              <p>还没有报告，先点击“生成研究报告”。</p>
            ) : (
              reports.map((r) => (
                <div key={r.id} className="report">
                  <strong>{r.title}</strong>
                  <p>{r.content}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
