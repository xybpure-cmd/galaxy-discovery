import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '未知错误' };
  }

  componentDidCatch(error) {
    console.error('Root render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page">
          <div className="card">
            <h1>Galaxy Discovery</h1>
            <p>页面加载遇到问题，但系统在线。请刷新页面重试。</p>
            <p className="error">错误信息：{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootNode = document.getElementById('root');

if (!rootNode) {
  throw new Error('Root node #root not found');
}

ReactDOM.createRoot(rootNode).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
