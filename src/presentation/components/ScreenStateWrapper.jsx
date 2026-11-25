/**
 * @file ScreenStateWrapper.jsx
 * @description Standard reusable screen state machine wrapper for reactive MVVM screens.
 * @standards SRS Alignment: FR-34 (Explicit Screen States), Section 4.1, Section 7.1
 * @states
 *   - LOADING: Activity indicator and accessible loading label.
 *   - SUCCESS: Screen content view (children).
 *   - ERROR: Clear error message and functional retry button.
 *   - OFFLINE: Prominent visual offline banner indicator.
 * @orientation Supports portrait and landscape without crashing.
 */

import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { VIEW_STATES } from '../../domain/models/schemas';

/**
 * Reusable Screen State Machine Wrapper component.
 *
 * @param {object} props
 * @param {string} props.state - Current state from VIEW_STATES ('loading', 'success', 'error', 'offline')
 * @param {React.ReactNode} props.children - Main screen content rendered in SUCCESS and OFFLINE states
 * @param {string} [props.loadingLabel='Loading data, please wait...'] - Accessible label for loading state
 * @param {string} [props.errorMessage='An unexpected error occurred.'] - Error message displayed in error state
 * @param {string} [props.errorDetails] - Optional technical error details
 * @param {() => void} [props.onRetry] - Callback invoked when user taps retry button in error state
 * @param {string} [props.offlineMessage='Offline Mode: Operating with encrypted local database.'] - Offline banner text
 * @param {boolean} [props.isOffline=false] - Whether device is offline while in SUCCESS state
 * @param {boolean} [props.scrollable=true] - Whether to wrap content in a responsive ScrollView
 * @param {object} [props.contentContainerStyle] - Optional style for content container
 * @param {object} [props.style] - Optional wrapper style
 */
export default function ScreenStateWrapper({
  state = VIEW_STATES.SUCCESS,
  children,
  loadingLabel = 'Loading data, please wait...',
  errorMessage = 'An unexpected error occurred.',
  errorDetails,
  onRetry,
  offlineMessage = 'Offline Mode: Operating with encrypted local database.',
  isOffline = false,
  scrollable = true,
  contentContainerStyle,
  style,
}) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const showOfflineBanner = state === VIEW_STATES.OFFLINE || isOffline;

  // Render LOADING State
  if (state === VIEW_STATES.LOADING) {
    return (
      <View
        style={[styles.container, styles.centerContent, style]}
        testID="screen-state-loading"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={loadingLabel}
      >
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText} accessibilityRole="text">
          {loadingLabel}
        </Text>
      </View>
    );
  }

  // Render ERROR State
  if (state === VIEW_STATES.ERROR) {
    return (
      <View
        style={[styles.container, styles.centerContent, style]}
        testID="screen-state-error"
      >
        <View style={[styles.errorCard, isLandscape && styles.errorCardLandscape]}>
          <View style={styles.errorIconContainer}>
            <Text style={styles.errorIconText}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage} accessibilityRole="alert">
            {errorMessage}
          </Text>
          {errorDetails ? (
            <Text style={styles.errorDetails} numberOfLines={3}>
              {errorDetails}
            </Text>
          ) : null}
          {onRetry ? (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Retry action"
              accessibilityHint="Attempts to reload the screen data"
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  // Render SUCCESS / OFFLINE Content
  const content = (
    <View
      style={[
        styles.contentContainer,
        contentContainerStyle,
        isLandscape && styles.contentContainerLandscape,
      ]}
      testID={showOfflineBanner ? 'screen-state-offline' : 'screen-state-success'}
    >
      {showOfflineBanner && (
        <View
          style={styles.offlineBanner}
          testID="offline-banner"
          accessibilityRole="alert"
          accessibilityLabel={offlineMessage}
        >
          <Text style={styles.offlineIcon}>📡</Text>
          <Text style={styles.offlineText}>{offlineMessage}</Text>
        </View>
      )}
      {children}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView
        style={[styles.container, style]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="screen-state-scrollview"
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.container, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  contentContainerLandscape: {
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    color: '#94A3B8',
    textAlign: 'center',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#CA8A04',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  offlineIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  offlineText: {
    flex: 1,
    color: '#FEF08A',
    fontSize: 13,
    fontWeight: '600',
  },
  errorCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  errorCardLandscape: {
    maxWidth: 500,
    padding: 20,
  },
  errorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7F1D1D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  errorIconText: {
    fontSize: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetails: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
