/**
 * @file SettingsScreen.jsx
 * @description Settings screen displaying security disclosures, currency preference, and biometrics toggle.
 * @standards SRS Alignment: FR-23, FR-34, Section 4.1, Section 7.1
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenStateWrapper from '../components/ScreenStateWrapper';
import { VIEW_STATES } from '../../domain/models/schemas';

/**
 * SettingsScreen - Application Configuration
 *
 * @param {object} props
 * @param {object} props.navigation - Navigation prop
 */
export default function SettingsScreen({ navigation }) {
  const [screenState, setScreenState] = useState(VIEW_STATES.SUCCESS);
  const [biometricsEnabled, setBiometricsEnabled] = useState(true);

  return (
    <ScreenStateWrapper
      state={screenState}
      loadingLabel="Loading application settings..."
      errorMessage="Failed to load settings."
      errorDetails="Could not read preferences from app_settings table."
      onRetry={() => setScreenState(VIEW_STATES.SUCCESS)}
      offlineMessage="Offline Mode: Preferences saved locally."
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Security Settings Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security & Privacy</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Biometric Unlock</Text>
              <Text style={styles.settingDesc}>Require Face ID / Fingerprint on launch</Text>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: '#334155', true: '#0A84FF' }}
              thumbColor={biometricsEnabled ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>Database Encryption</Text>
              <Text style={styles.settingDesc}>SQLCipher AES-256 (Fail-Closed)</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </View>
        </View>

        {/* Academic Disclosure Card */}
        <View style={styles.disclosureCard}>
          <Text style={styles.disclosureTitle}>Local-Only Data Notice</Text>
          <Text style={styles.disclosureText}>
            This application operates 100% offline and does not use cloud servers or account sync.
            Uninstalling the app permanently erases local records.
          </Text>
        </View>

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
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  backButton: {
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  activeBadge: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 14,
  },
  disclosureCard: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  disclosureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#38BDF8',
    marginBottom: 6,
  },
  disclosureText: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  stateControlsCard: {
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
