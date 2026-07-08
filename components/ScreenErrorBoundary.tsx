/**
 * ─── ScreenErrorBoundary ─────────────────────────────────────────────────────
 * Per-screen React error boundary. If a single screen's render tree throws,
 * this catches it and shows a soft "tap to retry" overlay — the rest of the
 * app keeps running. The user is never thrown into a blank white screen.
 *
 * Usage:
 *   Wrap each screen (or the Stack in _layout) with this boundary:
 *   <ScreenErrorBoundary>
 *     <MyScreen />
 *   </ScreenErrorBoundary>
 *
 * When an error is caught:
 *   - Logs to ToastLogger (visible as a crash toast)
 *   - Shows a dark overlay with the error headline
 *   - Tapping "Try again" resets the boundary so the screen can remount
 */

import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { ToastLogger } from '@/lib/toastLogger';

interface Props {
  children: React.ReactNode;
  /** Display name shown in the error overlay (e.g. the screen name) */
  name?: string;
  /**
   * Called after the boundary catches an error.
   * You can use this to log to an external service.
   */
  onError?: (error: Error, info: { componentStack?: string }) => void;
}

interface State {
  hasError: boolean;
  errorMsg: string;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMsg: error?.message ?? String(error),
    };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    const name  = this.props.name ?? 'Screen';
    const stack = info?.componentStack?.slice(0, 300) ?? '';
    ToastLogger.push(
      `💥 ${name} CRASH\n${error?.message ?? String(error)}\n${stack}`,
      'crash'
    );
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.setState({ hasError: false, errorMsg: '' });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const name = this.props.name ?? 'Screen';

    return (
      <View style={s.container}>
        {/* Subtle glow orb */}
        <View style={s.glow} />

        <Text style={s.icon}>🌿</Text>

        <Text style={s.title}>Something went wrong</Text>

        <Text style={s.subtitle}>
          {name} encountered an issue.{'\n'}Your data is safe.
        </Text>

        {/* Collapsible error detail */}
        <ScrollView style={s.detailBox} showsVerticalScrollIndicator={false}>
          <Text style={s.detailText} selectable>
            {this.state.errorMsg}
          </Text>
        </ScrollView>

        <TouchableOpacity onPress={this.reset} style={s.btn} activeOpacity={0.8}>
          <Text style={s.btnText}>↺  Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

/**
 * Functional convenience wrapper — use when you want an inline boundary
 * without writing a class component at the call site.
 */
export function withScreenBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  name?: string
): React.ComponentType<P> {
  return function BoundedScreen(props: P) {
    return (
      <ScreenErrorBoundary name={name ?? WrappedComponent.displayName ?? WrappedComponent.name}>
        <WrappedComponent {...props} />
      </ScreenErrorBoundary>
    );
  };
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05040E',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#1A4D2E',
    opacity: 0.18,
    top: '25%',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  detailBox: {
    maxHeight: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 28,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  detailText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.30)',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  btn: {
    backgroundColor: 'rgba(52,211,153,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  btnText: {
    color: '#34d399',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
});
