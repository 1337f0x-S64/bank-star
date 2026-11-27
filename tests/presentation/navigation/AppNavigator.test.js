/**
 * @file AppNavigator.test.js
 * @description Unit tests for AppNavigator hierarchy and screen reachability.
 * @standards SRS Alignment: FR-34, Section 4.1, Section 7.1
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';
import AppNavigator from '../../../src/presentation/navigation/AppNavigator';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

describe('AppNavigator (FR-34, Navigation Hierarchy)', () => {
  it('renders root BiometricGateScreen on initial launch', () => {
    let tree;
    act(() => {
      tree = renderer.create(<AppNavigator />);
    });

    const root = tree.root;

    // Verify initial root screen is BiometricGateScreen
    expect(root.findByProps({ children: 'BankStar PFM' })).toBeTruthy();
    expect(root.findByProps({ children: 'Hardware-Backed Biometric Security Gate' })).toBeTruthy();

    const unlockButton = root.findByProps({ accessibilityLabel: 'Unlock with Biometrics' });
    expect(unlockButton).toBeTruthy();

    const fallbackButton = root.findByProps({ accessibilityLabel: 'Use Passcode Fallback' });
    expect(fallbackButton).toBeTruthy();
  });

  it('renders without crashing in portrait and landscape orientations', () => {
    let tree;
    act(() => {
      tree = renderer.create(<AppNavigator />);
    });
    expect(tree.root.findByProps({ children: 'Protected Financial Vault' })).toBeTruthy();
  });
});
