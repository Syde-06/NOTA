import { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAppContext } from '../contexts/AppContext';
import FormInput from './ui/FormInput';
import PrimaryButton from './ui/PrimaryButton';

const LOGIN_DELAY_MS = 2000;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const { login, signUp } = useAppContext();

  const fieldErrors = useMemo(() => {
    const errors = {};

    if (isSignUp && !name.trim()) {
      errors.name = 'Full name is required.';
    }

    if (!email.trim()) {
      errors.email = 'Email is required.';
    } else if (!isValidEmail(email.trim())) {
      errors.email = 'Enter a valid email address.';
    }

    if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    return errors;
  }, [email, isSignUp, name, password]);

  const handleSignUp = async () => {
    setHasSubmitted(true);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);
    setSubmitError('');
    await wait(LOGIN_DELAY_MS);

    const { error } = await signUp({ name, email, password });
    if (error) {
      setSubmitError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    Alert.alert(
      'Account Created!',
      'Check your email to confirm your account, then sign in.',
      [{ text: 'OK', onPress: () => switchMode() }]
    );
  };

  const handleSignIn = async () => {
    setHasSubmitted(true);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setLoading(true);
    setSubmitError('');
    await wait(LOGIN_DELAY_MS);

    const { error } = await login({ email, password });
    if (error) {
      setSubmitError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setSubmitError('');
    setName('');
    setEmail('');
    setPassword('');
    setTouched({});
    setHasSubmitted(false);
  };

  const shouldShowError = (field) => hasSubmitted || touched[field];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoMark}>
              <Text style={styles.logoN}>N</Text>
            </View>
            <Text style={styles.logoText}>NOTA</Text>
            <Text style={styles.tagline}>
              Highlights → Structure → Knowledge
            </Text>
          </View>

          {/* Color dots decoration */}
          <View style={styles.colorRow}>
            {['#FF3B30', '#FFCC00', '#34C759', '#007AFF', '#AF52DE'].map(
              (c, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: c }]} />
              )
            )}
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isSignUp ? 'Create Account' : 'Welcome back'}
            </Text>

            {submitError !== '' && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            )}

            {isSignUp && (
              <FormInput
                label="Full Name"
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                error={shouldShowError('name') ? fieldErrors.name : ''}
              />
            )}
            <FormInput
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              error={shouldShowError('email') ? fieldErrors.email : ''}
            />
            <FormInput
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              error={shouldShowError('password') ? fieldErrors.password : ''}
            />

            <PrimaryButton
              title={isSignUp ? 'Create Account' : 'Sign In'}
              onPress={isSignUp ? handleSignUp : handleSignIn}
              loading={loading}
            />

            {!isSignUp && (
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.orText}>or continue with</Text>
            <View style={styles.line} />
          </View>

          {/* Social */}
          <View style={styles.socialRow}>
            {['G', 'A'].map((icon, i) => (
              <TouchableOpacity key={i} style={styles.socialBtn}>
                <Text style={styles.socialIcon}>{icon}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Toggle */}
          <TouchableOpacity style={styles.toggleRow} onPress={switchMode}>
            <Text style={styles.toggleText}>
              {isSignUp ? 'Already have an account? ' : 'New to NOTA? '}
              <Text style={styles.toggleLink}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
          <Text style={styles.tagline}>Gonzales, Sydney</Text>
          <Text style={styles.tagline}>Genova, Jaren</Text>
          <Text style={styles.tagline}>Padilla, Marc Joel</Text>
          <Text style={styles.tagline}>Test Email: test@example.com</Text>
          <Text style={styles.tagline}>Test Password: 123456</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F7' },
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  logoN: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1 },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: 6,
  },
  tagline: { fontSize: 12, color: '#8E8E93', marginTop: 4, letterSpacing: 0.5 },
  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FFF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  errorText: { color: '#FF3B30', fontSize: 13, lineHeight: 18 },
  forgotBtn: { alignItems: 'center', marginTop: 14 },
  forgotText: { color: '#007AFF', fontSize: 14 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  orText: { color: '#8E8E93', fontSize: 13, marginHorizontal: 12 },
  socialRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  socialBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  socialIcon: { fontSize: 18, fontWeight: '700', color: '#1C1C1E' },
  toggleRow: { marginTop: 4 },
  toggleText: { fontSize: 14, color: '#8E8E93' },
  toggleLink: { color: '#007AFF', fontWeight: '600' },
});
