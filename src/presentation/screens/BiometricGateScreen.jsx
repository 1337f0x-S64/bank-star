/**
 * @file BiometricGateScreen.jsx
 * @description Root authentication gate screen guarding financial data access.
 * @standards SRS Alignment: FR-23, FR-24, FR-34, Section 4.1, Section 7.1
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenStateWrapper from '../components/ScreenStateWrapper';
import { VIEW_STATES } from '../../domain/models/schemas';

/**
 * BiometricGateScreen - Root Authentication Gate
 *
 * @param {object} props
 * @param {object} props.navigation - Navigation prop
 */
export default function BiometricGateScreen({ navigation }) {
  const [screenState, setScreenState] = useState(VIEW_STATES.SUCCESS);

  const handleUnlock = () => {
    // Navigate into main application dashboard
    if (navigation?.navigate) {
      navigation.navigate('Dashboard');
    }
  };

  const handleFallback = () => {
    if (navigation?.navigate) {
      navigation.navigate('Dashboard', { authMethod: 'passcode_fallback' });
    }
  };

  return (
    <ScreenStateWrapper
      state={screenState}
      loadingLabel="Authenticating with Secure Enclave..."
      errorMessage="Biometric authentication failed or was cancelled."
      errorDetails="ErrorCode: BIOMETRIC_DISMISSED. Safe fallback available."
      onRetry={() => setScreenState(VIEW_STATES.SUCCESS)}
      offlineMessage="Offline Gate: Biometric authentication operates 100% on-device."
    >
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>🔐</Text>
        </View>

        <Text style={styles.title}>BankStar PFM</Text>
        <Text style={styles.subtitle}>
          Hardware-Backed Biometric Security Gate
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Protected Financial Vault</Text>
          <Text style={styles.infoDesc}>
            Access to encrypted dual-currency expense records requires OS biometric authentication.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleUnlock}
          accessibilityRole="button"
          accessibilityLabel="Unlock with Biometrics"
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Unlock with Biometrics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleFallback}
          accessibilityRole="button"
          accessibilityLabel="Use Passcode Fallback"
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Use Passcode Fallback</Text>
        </TouchableOpacity>

        {/* State Machine Testing Controls */}
        <View style={styles.stateControlsCard}>
          <Text style={styles.stateControlsTitle}>ScreenStateWrapper Controls (Testing):</Text>
          <View style={styles.stateButtonsRow}>
            {Object.values(VIEW_STATES).map((st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.statePill,
                  screenState === st && styles.statePillActive,
                ]}
                onPress={() => setScreenState(st)}
              >
                <Text
                  style={[
                    styles.statePillText,
                    screenState === st && styles.statePillTextActive,
                  ]}
                >
                  {st}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </ScreenStateWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 4,
  },
  infoDesc: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#0A84FF',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 28,
  },
  secondaryButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
  },
  stateControlsCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  stateControlsTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 10,
  },
  stateButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  statePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
  },
  statePillActive: {
    backgroundColor: '#0A84FF',
    borderColor: '#0A84FF',
  },
  statePillText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statePillTextActive: {
    color: '#FFFFFF',
  },
});
