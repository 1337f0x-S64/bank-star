/**
 * @file ExpenseHistoryScreen.jsx
 * @description Chronological expense history list screen.
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
 * ExpenseHistoryScreen - Chronological List View
 *
 * @param {object} props
 * @param {object} props.navigation - Navigation prop
 */
export default function ExpenseHistoryScreen({ navigation }) {
  const [screenState, setScreenState] = useState(VIEW_STATES.SUCCESS);

  return (
    <ScreenStateWrapper
      state={screenState}
      loadingLabel="Loading encrypted expense records..."
      errorMessage="Failed to retrieve expense history."
      errorDetails="Query execution error on expenses repository."
      onRetry={() => setScreenState(VIEW_STATES.SUCCESS)}
      offlineMessage="Offline Mode: Displaying records stored in SQLCipher."
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Expense History</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📝</Text>
          <Text style={styles.emptyTitle}>No Expenses Recorded</Text>
          <Text style={styles.emptySubtitle}>
            Your encrypted expenses will appear here chronologically.
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
  emptyContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
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
