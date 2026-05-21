import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, Lock, KeyRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../services/api';

type Step = 'email' | 'code' | 'newPassword' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Passo 1: enviar código por e-mail real
  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Atenção', 'Digite seu e-mail');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Atenção', 'Digite um e-mail válido');
      return;
    }

    setLoading(true);
    try {
      await apiService.forgotPassword(email.trim().toLowerCase());

      Alert.alert(
        'Código enviado!',
        `Se o e-mail estiver cadastrado, você receberá um código de recuperação em ${email}.`,
        [{ text: 'OK', onPress: () => setStep('code') }]
      );
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar o código. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Passo 2: validar código via API
  const handleValidateCode = async () => {
    if (!code.trim()) {
      Alert.alert('Atenção', 'Digite o código recebido');
      return;
    }

    setLoading(true);
    try {
      await apiService.verifyCode(email.trim().toLowerCase(), code.trim());
      setStep('newPassword');
    } catch (error: any) {
      Alert.alert('Código inválido', error.message || 'O código digitado não confere ou expirou. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Passo 3: redefinir senha via API (com código)
  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Atenção', 'Preencha os dois campos de senha');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Atenção', 'As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      await apiService.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      setStep('success');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível redefinir a senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'email':
        return (
          <>
            <Text style={styles.stepTitle}>Recuperar senha</Text>
            <Text style={styles.stepSubtitle}>
              Digite seu e-mail cadastrado e enviaremos um código de verificação.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Mail size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Seu e-mail"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, loading && styles.actionButtonDisabled]}
              onPress={handleSendCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Enviar código</Text>
              )}
            </TouchableOpacity>
          </>
        );

      case 'code':
        return (
          <>
            <Text style={styles.stepTitle}>Verificar código</Text>
            <Text style={styles.stepSubtitle}>
              Digite o código de 6 dígitos enviado para {email}.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <KeyRound size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleValidateCode}>
              <Text style={styles.actionButtonText}>Verificar código</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resendButton} onPress={() => setStep('email')}>
              <Text style={styles.resendText}>Reenviar código</Text>
            </TouchableOpacity>
          </>
        );

      case 'newPassword':
        return (
          <>
            <Text style={styles.stepTitle}>Nova senha</Text>
            <Text style={styles.stepSubtitle}>
              Escolha uma nova senha para sua conta.
            </Text>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Lock size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar nova senha"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, loading && styles.actionButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>Redefinir senha</Text>
              )}
            </TouchableOpacity>
          </>
        );

      case 'success':
        return (
          <>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.stepTitle}>Senha redefinida!</Text>
            <Text style={styles.stepSubtitle}>
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </Text>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.actionButtonText}>Ir para o login</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  // Indicador de progresso
  const steps: Step[] = ['email', 'code', 'newPassword', 'success'];
  const currentIndex = steps.indexOf(step);

  return (
    <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { paddingTop: insets.top + 20 }]}>

            {/* Header com botão voltar */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <ArrowLeft size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Recuperar senha</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Indicador de passos */}
            <View style={styles.stepsIndicator}>
              {[0, 1, 2].map(i => (
                <View
                  key={i}
                  style={[
                    styles.stepDot,
                    i <= currentIndex ? styles.stepDotActive : styles.stepDotInactive,
                  ]}
                />
              ))}
            </View>

            {/* Card do formulário */}
            <View style={styles.formContainer}>
              {renderStep()}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 32, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  stepsIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  stepDotActive: { backgroundColor: '#fff' },
  stepDotInactive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  formContainer: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  inputContainer: { marginBottom: 16 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 16, color: '#333' },
  codeInput: { letterSpacing: 8, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  actionButton: {
    backgroundColor: '#40E0D0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  actionButtonDisabled: { backgroundColor: '#aaa' },
  actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendButton: { alignItems: 'center', paddingVertical: 8 },
  resendText: { color: '#40E0D0', fontSize: 14, fontWeight: '600' },
  successIcon: { alignItems: 'center', marginBottom: 16 },
  successEmoji: { fontSize: 56 },
});
