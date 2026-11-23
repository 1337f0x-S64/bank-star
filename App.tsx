import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  initializeDatabase,
  getCipherVersion,
  closeDatabase,
} from './src/data/database/SqlCipherClient';
import { VIEW_STATES } from './src/domain/models/schemas';

export default function App() {
  const [viewState, setViewState] = useState(VIEW_STATES.LOADING);
  const [cipherVersion, setCipherVersion] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initEncryptedStorage() {
      try {
        await initializeDatabase();
        if (isMounted) {
          const version = getCipherVersion();
          setCipherVersion(version);
          setViewState(VIEW_STATES.SUCCESS);
          console.log(`[App] SQLCipher AES-256 active. Runtime PRAGMA cipher_version: ${version}`);
        }
      } catch (error: any) {
        if (isMounted) {
          setErrorMessage(error?.message || 'Database initialization failed.');
          setViewState(VIEW_STATES.ERROR);
          console.error('[App] Fail-Closed Security Lock:', error?.message);
        }
      }
    }

    initEncryptedStorage();

    return () => {
      isMounted = false;
      closeDatabase().catch(() => {});
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      {viewState === VIEW_STATES.LOADING && (
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.title}>Initializing Encrypted Vault</Text>
          <Text style={styles.subtitle}>Verifying SQLCipher & SecureStore Key...</Text>
        </View>
      )}

      {viewState === VIEW_STATES.SUCCESS && (
        <View style={styles.card}>
          <View style={styles.badgeSuccess}>
            <Text style={styles.badgeText}>SQLCipher AES-256 Active</Text>
          </View>
          <Text style={styles.title}>BankStar PFM</Text>
          <Text style={styles.subtitle}>Offline-First Dual-Currency Personal Finance Monitor</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Database Engine:</Text>
            <Text style={styles.infoValue}>SQLCipher (Fail-Closed)</Text>
            <Text style={styles.infoLabel}>PRAGMA cipher_version:</Text>
            <Text style={styles.infoValue}>{cipherVersion || 'Verified'}</Text>
            <Text style={styles.infoLabel}>Key Protection:</Text>
            <Text style={styles.infoValue}>Hardware SecureStore (256-bit)</Text>
          </View>
        </View>
      )}

      {viewState === VIEW_STATES.ERROR && (
        <View style={styles.card}>
          <View style={styles.badgeError}>
            <Text style={styles.badgeText}>Security Guardrail Enforced</Text>
          </View>
          <Text style={styles.title}>Database Access Halted</Text>
          <Text style={styles.errorText}>
            Plaintext SQLite fallback is strictly prohibited by Mobile Systems Constitution (TC-08).
          </Text>
          <Text style={styles.errorDetails}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeSuccess: {
    backgroundColor: '#065F46',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginBottom: 16,
  },
  badgeError: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    marginBottom: 16,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorDetails: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
