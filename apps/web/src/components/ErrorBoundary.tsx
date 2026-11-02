import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Lỗi render ứng dụng:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          className="mx-auto max-w-xl px-6 py-20 text-center text-ink"
          role="alert"
        >
          <h1 className="font-heading text-2xl font-semibold">Đã xảy ra lỗi</h1>
          <p className="mt-3 text-muted">
            Trang không thể hiển thị. Hãy tải lại để tiếp tục.
          </p>
          <button
            className="mt-6 min-h-11 rounded-lg bg-primary px-5 font-semibold text-white"
            onClick={() => window.location.reload()}
            type="button"
          >
            Tải lại trang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
