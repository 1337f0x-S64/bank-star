/**
 * @file DashboardScreen.jsx
 * @description Home dashboard screen displaying balances and quick navigation.
 * @standards SRS Alignment: FR-03, FR-05, FR-34, Section 4.1, Section 7.1
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
 * DashboardScreen - Application Home Screen
 *
 * @param {object} props
 * @param {object} props.navigation - Navigation prop
 */
export default function DashboardScreen({ navigation }) {
  const [screenState, setScreenState] = useState(VIEW_STATES.SUCCESS);

  return (
    <ScreenStateWrapper
      state={screenState}
      loadingLabel="Calculating dual-currency balances..."
      errorMessage="Failed to load dashboard balances."
      errorDetails="Database lock timeout or schema check failure."
      onRetry={() => setScreenState(VIEW_STATES.SUCCESS)}
      offlineMessage="Offline Mode: Displaying cached local spending records."
    >
      <View style={styles.content}>
        {/* Dual-Currency Balance Cards */}
        <View style={styles.cardsRow}>
          <View style={[styles.balanceCard, styles.usdCard]}>
            <Text style={styles.currencyBadge}>USD</Text>
            <Text style={styles.balanceAmount}>$0.00</Text>
            <Text style={styles.balanceLabel}>Today&apos;s Spending</Text>
          </View>

          <View style={[styles.balanceCard, styles.nioCard]}>
            <Text style={styles.currencyBadge}>NIO</Text>
            <Text style={styles.balanceAmount}>C$0.00</Text>
            <Text style={styles.balanceLabel}>Today&apos;s Spending</Text>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Quick Navigation</Text>

        {/* Navigation Grid */}
        <View style={styles.navGrid}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('ExpenseHistory')}
            accessibilityRole="button"
            accessibilityLabel="Open Expense History"
          >
            <Text style={styles.navItemIcon}>📋</Text>
            <Text style={styles.navItemTitle}>Expense History</Text>
            <Text style={styles.navItemSubtitle}>View & manage entries</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Reports')}
            accessibilityRole="button"
            accessibilityLabel="Open Reports"
          >
            <Text style={styles.navItemIcon}>📊</Text>
            <Text style={styles.navItemTitle}>Reports</Text>
            <Text style={styles.navItemSubtitle}>Period aggregations</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Converter')}
            accessibilityRole="button"
            accessibilityLabel="Open Currency Converter"
          >
            <Text style={styles.navItemIcon}>💱</Text>
            <Text style={styles.navItemTitle}>Converter</Text>
            <Text style={styles.navItemSubtitle}>USD & NIO calculator</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Text style={styles.navItemIcon}>⚙️</Text>
            <Text style={styles.navItemTitle}>Settings</Text>
            <Text style={styles.navItemSubtitle}>Biometrics & security</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.lockButton}
          onPress={() => navigation.navigate('BiometricGate')}
          accessibilityRole="button"
          accessibilityLabel="Lock Application"
        >
          <Text style={styles.lockButtonText}>🔒 Lock Vault</Text>
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
    paddingVertical: 12,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  balanceCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  usdCard: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  nioCard: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  currencyBadge: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  balanceLabel: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  navItem: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  navItemIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  navItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  navItemSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  lockButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  lockButtonText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
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
