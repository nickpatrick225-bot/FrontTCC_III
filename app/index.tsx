import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../services/api';
import { CustomAlertService } from '../components/CustomAlert';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      CustomAlertService.warning('Atenção', 'Digite seu e-mail para continuar');
      return;
    }

    if (!password) {
      CustomAlertService.warning('Atenção', 'Digite sua senha para continuar');
      return;
    }

    setLoading(true);

    try {
      const loginResponse = await apiService.login(email.trim(), password);
      await SecureStore.setItemAsync('authToken', loginResponse.token);
      // Salva senha para permitir re-login automático ao ativar premium
      await SecureStore.setItemAsync('userPassword', password);

      const userData = await apiService.getUser(email.trim());

      // Salva todos os dados do usuário (normaliza as chaves para camelCase)
      const normalizedUserData = {
        id: userData.Id ?? userData.id,
        nome: userData.Nome ?? userData.nome,
        email: userData.Email ?? userData.email,
        numeroCelular: userData.NumeroCelular ?? userData.numeroCelular ?? userData.numerocelular ?? '',
        dataNascimento: userData.DataNascimento ?? userData.dataNascimento ?? userData.datanascimento ?? null,
        preferencias: userData.Preferencias ?? userData.preferencias ?? {},
        orcamento: userData.Orcamento ?? userData.orcamento ?? 0,
        planoAtivo: userData.PlanoAtivo ?? userData.planoAtivo ?? userData.planoativo ?? 'free',
        loggedIn: true,
        loginTime: new Date().toISOString(),
      };

      await SecureStore.setItemAsync('userData', JSON.stringify(normalizedUserData));

      if (normalizedUserData.preferencias) {
        await SecureStore.setItemAsync('USER_PREFERENCES', JSON.stringify(normalizedUserData.preferencias));
      }

      // Sucesso!
      CustomAlertService.success(
        'Login realizado!',
        `Bem-vindo de volta, ${normalizedUserData.nome.split(' ')[0]}!`,
        [{
          text: 'Vamos lá!',
          onPress: () => router.replace('/(tabs)')
        }]
      );

    } catch (error: any) {
      console.error('Erro no login:', error);
      if (error.message?.includes('401') || error.message?.includes('Sessão expirada')) {
        CustomAlertService.error('Erro de login', 'Email ou senha incorretos');
      } else if (error.message?.includes('conexão') || error.message?.includes('internet')) {
        CustomAlertService.error('Sem conexão', 'Verifique sua internet e tente novamente');
      } else {
        CustomAlertService.error('Erro de login', 'Email ou senha incorretos');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Formulário */}
            <View style={styles.formContainer}>
              {/* E-mail */}
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

              {/* Senha */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    placeholderTextColor="#999"
                    editable={true}
                  />
                </View>
              </View>

              {/* Botão Entrar */}
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Entrar</Text>
                )}
              </TouchableOpacity>

              {/* Esqueci minha senha */}
              <TouchableOpacity
                style={styles.forgotButton}
                onPress={() => router.push('/forgot-password')}
                disabled={loading}
              >
                <Text style={styles.forgotButtonText}>Esqueci minha senha</Text>
              </TouchableOpacity>

              {/* Link para cadastro */}
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => router.push('/register')}
                disabled={loading}
              >
                <Text style={styles.registerButtonText}>
                  Ainda não tem conta? <Text style={styles.registerLink}>Cadastre-se</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 30 },
  logoIcon: {
    width: 360,
    height: 360,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: { width: 360, height: 360 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#fff', fontStyle: 'italic' },
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
  inputContainer: { marginBottom: 20 },
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
  loginButton: {
    backgroundColor: '#40E0D0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  loginButtonDisabled: { backgroundColor: '#999' },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  forgotButton: { alignItems: 'center', marginBottom: 20 },
  forgotButtonText: { color: '#40E0D0', fontSize: 14, fontWeight: '600' },
  registerButton: { alignItems: 'center' },
  registerButtonText: { color: '#666', fontSize: 14 },
  registerLink: { color: '#40E0D0', fontWeight: '600' },
});
