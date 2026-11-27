import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  initializeDatabase,
  getCipherVersion,
  closeDatabase,
} from './src/data/database/SqlCipherClient';
import { VIEW_STATES } from './src/domain/models/schemas';
import AppNavigator from './src/presentation/navigation/AppNavigator';

export default function App() {
  const [viewState, setViewState] = useState<string>(VIEW_STATES.LOADING);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initEncryptedStorage() {
      try {
        await initializeDatabase({ runMigrations: true });
        if (isMounted) {
          const version = getCipherVersion();
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

  if (viewState === VIEW_STATES.LOADING) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.card}>
          <ActivityIndicator size="large" color="#0A84FF" />
          <Text style={styles.title}>Initializing Encrypted Vault</Text>
          <Text style={styles.subtitle}>Verifying SQLCipher & SecureStore Key...</Text>
        </View>
      </View>
    );
  }

  if (viewState === VIEW_STATES.ERROR) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
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
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SafeAreaProvider>
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
