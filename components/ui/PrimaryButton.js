import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useNotaTheme } from '../theme';

export default function PrimaryButton({ title, loading, disabled, style, onPress }) {
  const { theme } = useNotaTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      style={[styles.button, (loading || disabled) ? styles.buttonDisabled : null, style]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      {loading ? <ActivityIndicator color={theme.buttonText} /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
  button: {
    backgroundColor: theme.button,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: theme.muted,
  },
  text: {
    color: theme.buttonText,
    fontSize: 16,
    fontWeight: '700',
  },
  });
}
