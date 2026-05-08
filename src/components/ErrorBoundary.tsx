import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: ReactNode;
}

/**
 * Top-level error boundary. Without this, an unhandled render-time
 * error lands users on a blank white page with no recovery path.
 * On error we log to console (Vercel/browser captures it) and show
 * a Hebrew-RTL fallback with a "reload" affordance.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Lazy Finance error boundary caught:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        className="min-h-screen bg-background flex items-center justify-center p-4"
      >
        <div className="max-w-sm w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div
            className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
            style={{ background: 'rgba(244,63,94,0.12)' }}
          >
            <AlertTriangle className="w-7 h-7" style={{ color: '#f43f5e' }} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-foreground">משהו השתבש</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              הייתה תקלה בלתי-צפויה. הנתונים שלך בטוחים — תוכל לרענן ולהמשיך.
            </p>
          </div>
          {this.state.error && (
            <details className="text-right text-[11px] text-muted-foreground/70 bg-secondary/50 rounded-lg p-2">
              <summary className="cursor-pointer">פרטים טכניים</summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px]">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleReload}
            className="w-full py-3 rounded-xl font-bold text-white transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #be123c, #f43f5e)',
              boxShadow: '0 2px 12px rgba(244,63,94,0.35)',
            }}
          >
            <RotateCcw className="w-4 h-4 inline ml-2" />
            רענן את האפליקציה
          </button>
        </div>
      </div>
    );
  }
}
