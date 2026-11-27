/**
 * @file ReportsScreen.jsx
 * @description Reports and analytics screen for periodic spending summaries.
 * @standards SRS Alignment: FR-07, FR-11, FR-34, Section 4.1, Section 7.1
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenStateWrapper from '../components/ScreenStateWrapper';
import { VIEW_STATES, PERIOD_TYPES } from '../../domain/models/schemas';

/**
 * ReportsScreen - Period Summaries
 *
 * @param {object} props
 * @param {object} props.navigation - Navigation prop
 */
export default function ReportsScreen({ navigation }) {
  const [screenState, setScreenState] = useState(VIEW_STATES.SUCCESS);
  const [activePeriod, setActivePeriod] = useState(PERIOD_TYPES.DAILY);

  return (
    <ScreenStateWrapper
      state={screenState}
      loadingLabel="Aggregating period summaries..."
      errorMessage="Failed to generate reports."
      errorDetails="Calculation engine error on summary aggregation."
      onRetry={() => setScreenState(VIEW_STATES.SUCCESS)}
      offlineMessage="Offline Mode: Calculations running on local integer math."
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spending Reports</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector Tabs */}
        <View style={styles.periodTabs}>
          {Object.values(PERIOD_TYPES).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.periodTab,
                activePeriod === period && styles.periodTabActive,
              ]}
              onPress={() => setActivePeriod(period)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activePeriod === period }}
            >
              <Text
                style={[
                  styles.periodTabText,
                  activePeriod === period && styles.periodTabTextActive,
                ]}
              >
                {period}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Dual Subtotals */}
        <View style={styles.reportCard}>
          <Text style={styles.reportPeriodTitle}>
            Summary for {activePeriod.toUpperCase()}
          </Text>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>USD Total:</Text>
            <Text style={styles.summaryValueUSD}>$0.00</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>NIO Total:</Text>
            <Text style={styles.summaryValueNIO}>C$0.00</Text>
          </View>
          <Text style={styles.disclaimerText}>
            Dual currencies are kept strictly isolated without arbitrary conversion.
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
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  periodTabActive: {
    backgroundColor: '#0A84FF',
  },
  periodTabText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  reportCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportPeriodTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  summaryValueUSD: {
    fontSize: 18,
    fontWeight: '700',
    color: '#34D399',
  },
  summaryValueNIO: {
    fontSize: 18,
    fontWeight: '700',
    color: '#60A5FA',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8,
    fontStyle: 'italic',
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
