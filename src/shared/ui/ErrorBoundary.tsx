import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Last-resort screen for a rendering crash.
 *
 * It used to print the raw `error.message` (technical English) and offer a
 * "Réessayer" that re-rendered the very tree that had just thrown, so the
 * click led straight back to the same screen. The details go to the console;
 * the way out is a full reload, which resets the state that caused the crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div role="alert" className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 mb-1">Une erreur est survenue</p>
            <p className="text-xs text-gray-500 mb-4">
              La page n'a pas pu s'afficher. Vos données enregistrées ne sont pas perdues.
            </p>
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
