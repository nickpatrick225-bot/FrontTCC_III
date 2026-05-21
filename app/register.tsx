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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { User, Mail, Lock, Phone, Calendar } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiService } from '../services/api';
import { CustomAlertService } from '../components/CustomAlert';
import { parseDateBR } from '../utils/date';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    confirmPassword: '',
    numeroCelular: '',
    dataNascimento: '', // formato: DD/MM/YYYY
  });

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegister = async () => {
    // Validações básicas
    if (!formData.nome.trim() || !formData.email.trim() || !formData.senha || !formData.confirmPassword || !formData.numeroCelular.trim() || !formData.dataNascimento) {
      CustomAlertService.error('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (formData.senha !== formData.confirmPassword) {
      CustomAlertService.error('Erro', 'As senhas não coincidem');
      return;
    }

    if (formData.senha.length < 6) {
      CustomAlertService.error('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }

    // Validar e converter data DD/MM/YYYY para ISO
    const parsedDate = parseDateBR(formData.dataNascimento);
    if (!parsedDate) {
      CustomAlertService.error('Erro', 'Data de nascimento inválida. Use o formato DD/MM/AAAA.');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        nome: formData.nome.trim(),
        email: formData.email.trim().toLowerCase(),
        senha: formData.senha,
        numeroCelular: formData.numeroCelular.trim(),
        dataNascimento: parsedDate.toISOString(),
        orcamento: 1500,
        preferencias: {
          Bares: 0,
          Museus: 0,
          Praias: 0,
          Parques: 0,
          Restaurantes: 0,
          MonumentosHistoricos: 0,
        },
      };

      await apiService.register(payload);

      CustomAlertService.success('Sucesso!',
        'Sua conta foi criada com sucesso!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      if (error.message?.includes('conexão') || error.message?.includes('internet')) {
        CustomAlertService.error('Erro de conexão', 'Verifique sua internet e tente novamente');
      } else {
        CustomAlertService.error('Erro no cadastro', error.message || 'Tente novamente mais tarde');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <User size={40} color="#fff" />
              </View>
              <Text style={styles.logoText}>FindYourWay</Text>
            </View>

            <View style={styles.formContainer}>
              {/* Nome */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <User size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Nome completo"
                    value={formData.nome}
                    onChangeText={(t) => updateField('nome', t)}
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Mail size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="E-mail"
                    value={formData.email}
                    onChangeText={(t) => updateField('email', t)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Celular */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Phone size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="+55 47 99999-9999"
                    value={formData.numeroCelular}
                    onChangeText={(t) => updateField('numeroCelular', t)}
                    keyboardType="phone-pad"
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Data de Nascimento */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Calendar size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="DD/MM/yyyy"
                    value={formData.dataNascimento}
                    onChangeText={(t) => updateField('dataNascimento', t)}
                    keyboardType="numbers-and-punctuation"
                    placeholderTextColor="#999"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* Senha */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Senha (mínimo 6 caracteres)"
                    value={formData.senha}
                    onChangeText={(t) => updateField('senha', t)}
                    secureTextEntry
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              {/* Confirmar senha */}
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmar senha"
                    value={formData.confirmPassword}
                    onChangeText={(t) => updateField('confirmPassword', t)}
                    secureTextEntry
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Criar conta</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginLink} onPress={() => router.back()} disabled={loading}>
                <Text style={styles.loginLinkText}>
                  Já tem conta? <Text style={styles.linkText}>Faça login</Text>
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
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
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
  registerButton: {
    backgroundColor: '#40E0D0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  registerButtonDisabled: {
    backgroundColor: '#aaa',
  },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginLink: { alignItems: 'center' },
  loginLinkText: { color: '#666', fontSize: 14 },
  linkText: { color: '#40E0D0', fontWeight: '600' },
});
