/**
 * @file ScreenStateWrapper.test.js
 * @description Unit tests for ScreenStateWrapper state machine and orientation safety.
 * @standards SRS Alignment: FR-34, Section 4.1, Section 7.1
 */

import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import ScreenStateWrapper from '../../../src/presentation/components/ScreenStateWrapper';
import { VIEW_STATES } from '../../../src/domain/models/schemas';

describe('ScreenStateWrapper (FR-34, Explicit Screen States)', () => {
  it('renders LOADING state with activity indicator and accessible label', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper
          state={VIEW_STATES.LOADING}
          loadingLabel="Loading test data..."
        >
          <Text>Success Content</Text>
        </ScreenStateWrapper>
      );
    });

    const root = tree.root;
    const loadingView = root.findByProps({ testID: 'screen-state-loading' });
    expect(loadingView).toBeTruthy();
    expect(loadingView.props.accessibilityRole).toBe('progressbar');
    expect(loadingView.props.accessibilityLabel).toBe('Loading test data...');

    const loadingText = root.findByProps({ children: 'Loading test data...' });
    expect(loadingText).toBeTruthy();
  });

  it('renders SUCCESS state displaying child content', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper state={VIEW_STATES.SUCCESS}>
          <Text>Financial Dashboard Content</Text>
        </ScreenStateWrapper>
      );
    });

    const root = tree.root;
    const successView = root.findByProps({ testID: 'screen-state-success' });
    expect(successView).toBeTruthy();

    const childText = root.findByProps({ children: 'Financial Dashboard Content' });
    expect(childText).toBeTruthy();
  });

  it('renders ERROR state with error message, details, and functional retry button', () => {
    const onRetryMock = jest.fn();
    let tree;

    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper
          state={VIEW_STATES.ERROR}
          errorMessage="Database lock failure"
          errorDetails="SQLITE_BUSY: database is locked"
          onRetry={onRetryMock}
        >
          <Text>Content</Text>
        </ScreenStateWrapper>
      );
    });

    const root = tree.root;
    const errorView = root.findByProps({ testID: 'screen-state-error' });
    expect(errorView).toBeTruthy();

    const errorMsg = root.findByProps({ children: 'Database lock failure' });
    expect(errorMsg).toBeTruthy();

    const errorDetails = root.findByProps({ children: 'SQLITE_BUSY: database is locked' });
    expect(errorDetails).toBeTruthy();

    const retryButton = root.findByProps({ accessibilityLabel: 'Retry action' });
    expect(retryButton).toBeTruthy();

    act(() => {
      retryButton.props.onPress();
    });
    expect(onRetryMock).toHaveBeenCalledTimes(1);
  });

  it('renders OFFLINE state with prominent offline banner indicator and content', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper
          state={VIEW_STATES.OFFLINE}
          offlineMessage="You are currently offline. Running on local cache."
        >
          <Text>Offline Available Data</Text>
        </ScreenStateWrapper>
      );
    });

    const root = tree.root;
    const offlineView = root.findByProps({ testID: 'screen-state-offline' });
    expect(offlineView).toBeTruthy();

    const banner = root.findByProps({ testID: 'offline-banner' });
    expect(banner).toBeTruthy();

    const bannerText = root.findByProps({ children: 'You are currently offline. Running on local cache.' });
    expect(bannerText).toBeTruthy();

    const childText = root.findByProps({ children: 'Offline Available Data' });
    expect(childText).toBeTruthy();
  });

  it('displays offline banner when isOffline prop is true in SUCCESS state', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper state={VIEW_STATES.SUCCESS} isOffline={true}>
          <Text>Cached Content</Text>
        </ScreenStateWrapper>
      );
    });

    const root = tree.root;
    const banner = root.findByProps({ testID: 'offline-banner' });
    expect(banner).toBeTruthy();

    const childText = root.findByProps({ children: 'Cached Content' });
    expect(childText).toBeTruthy();
  });

  it('toggles cleanly between all 4 states on re-render without errors', () => {
    let tree;
    act(() => {
      tree = renderer.create(
        <ScreenStateWrapper state={VIEW_STATES.LOADING} loadingLabel="State 1">
          <Text>Content</Text>
        </ScreenStateWrapper>
      );
    });
    expect(tree.root.findByProps({ testID: 'screen-state-loading' })).toBeTruthy();

    // Toggle to SUCCESS
    act(() => {
      tree.update(
        <ScreenStateWrapper state={VIEW_STATES.SUCCESS}>
          <Text>Content</Text>
        </ScreenStateWrapper>
      );
    });
    expect(tree.root.findByProps({ testID: 'screen-state-success' })).toBeTruthy();

    // Toggle to ERROR
    act(() => {
      tree.update(
        <ScreenStateWrapper state={VIEW_STATES.ERROR} errorMessage="State 3 Error">
          <Text>Content</Text>
        </ScreenStateWrapper>
      );
    });
    expect(tree.root.findByProps({ testID: 'screen-state-error' })).toBeTruthy();

    // Toggle to OFFLINE
    act(() => {
      tree.update(
        <ScreenStateWrapper state={VIEW_STATES.OFFLINE}>
          <Text>Content</Text>
        </ScreenStateWrapper>
      );
    });
    expect(tree.root.findByProps({ testID: 'screen-state-offline' })).toBeTruthy();
  });
});
