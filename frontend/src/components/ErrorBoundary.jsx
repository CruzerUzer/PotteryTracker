import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '20px',
          textAlign: 'center',
          backgroundColor: 'var(--color-background, #f5f5f5)',
          color: 'var(--color-text-primary, #333)'
        }}>
          <div style={{
            maxWidth: '500px',
            padding: '40px',
            backgroundColor: 'var(--color-surface, white)',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <h1 style={{
              fontSize: '24px',
              marginBottom: '16px',
              color: 'var(--color-text-primary, #333)'
            }}>
              Something went wrong
            </h1>
            <p style={{
              marginBottom: '24px',
              color: 'var(--color-text-secondary, #666)',
              lineHeight: '1.6'
            }}>
              An unexpected error occurred. Please try reloading the page or going back to the home page.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                marginBottom: '24px',
                textAlign: 'left',
                padding: '12px',
                backgroundColor: 'var(--color-error-bg, #fee)',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: 'var(--color-error, #c00)'
                }}>
                  Error Details
                </summary>
                <pre style={{
                  marginTop: '12px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'var(--color-primary, #4a90d9)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: 'var(--color-primary, #4a90d9)',
                  border: '1px solid var(--color-primary, #4a90d9)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
