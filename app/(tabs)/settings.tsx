import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, User, Heart, Star, Trash2 } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiService } from '../../services/api';
import { CustomAlertService } from '../../components/CustomAlert';

const preferenceCategories = [
  { label: 'Praias:',           key: 'beaches',     backendKey: 'Praias' },
  { label: 'Parques:',          key: 'parks',       backendKey: 'Parques' },
  { label: 'Museus:',           key: 'museums',     backendKey: 'Museus' },
  { label: 'Restaurantes:',     key: 'restaurants', backendKey: 'Restaurantes' },
  { label: 'Monumentos Históricos:', key: 'monuments', backendKey: 'MonumentosHistoricos' },
  { label: 'Bares:',            key: 'bars',        backendKey: 'Bares' },
];

const toSlider = (value: number) => Math.round((value / 5) * 100);
const fromSlider = (value: number) => Math.round((value / 100) * 5);

// Componente ProfileView
function ProfileView() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [nome, setNome] = useState('');
  const [celular, setCelular] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (userDataRaw) {
        const data = JSON.parse(userDataRaw);
        setUserData(data);
        setNome(data.nome || '');
        setCelular(data.numeroCelular || data.numerocelular || '');
        // Formata data de nascimento para DD/MM/AAAA (sem horas)
        const rawDate = data.dataNascimento || data.datanascimento || '';
        if (rawDate && rawDate.includes('T')) {
          // ISO format: "2000-05-15T00:00:00Z" → "15/05/2000"
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const dd = String(d.getUTCDate()).padStart(2, '0');
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const yyyy = d.getUTCFullYear();
            setDataNascimento(`${dd}/${mm}/${yyyy}`);
          } else {
            setDataNascimento(rawDate);
          }
        } else if (rawDate && rawDate.includes('-') && !rawDate.includes('/')) {
          // Formato "2000-05-15" → "15/05/2000"
          const parts = rawDate.split('-');
          if (parts.length === 3) {
            setDataNascimento(`${parts[2]}/${parts[1]}/${parts[0]}`);
          } else {
            setDataNascimento(rawDate);
          }
        } else {
          setDataNascimento(rawDate);
        }
        setOrcamento(String(data.orcamento || 0));
      }
    } catch (error) {
      console.log('Erro ao carregar dados do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      if (!userData?.email) {
        CustomAlertService.error('Erro', 'Email do usuário não encontrado.');
        return;
      }

      // Converte data de nascimento para formato ISO se existir
      let dataNascimentoISO: string | null = null;
      if (dataNascimento) {
        // Tenta converter DD/MM/AAAA para ISO
        const parts = dataNascimento.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          dataNascimentoISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`;
        }
      }

      const payload = {
        nome,
        email: userData.email,
        numeroCelular: celular,
        dataNascimento: dataNascimentoISO,
        orcamento: parseFloat(orcamento) || 0,
      };

      await apiService.updateUser(userData.email, payload);

      // Atualiza cache local
      const updatedUserData = { ...userData, ...payload };
      await SecureStore.setItemAsync('userData', JSON.stringify(updatedUserData));
      setUserData(updatedUserData);

      CustomAlertService.success('Sucesso!', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      CustomAlertService.error('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    CustomAlertService.warning('Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!userData?.email) return;

              await apiService.deleteUser(userData.email);

              // Limpa todos os dados locais
              await SecureStore.deleteItemAsync('userToken');
              await SecureStore.deleteItemAsync('userData');
              await SecureStore.deleteItemAsync('USER_PREFERENCES');
              await SecureStore.deleteItemAsync('cachedPlaces');
              await SecureStore.deleteItemAsync('cachedPlacesTime');

              CustomAlertService.success('Conta Excluída', 'Sua conta foi excluída com sucesso.', [
                { text: 'OK', onPress: () => router.replace('/') }
              ]);
            } catch (error) {
              console.error('Erro ao excluir conta:', error);
              CustomAlertService.error('Erro', 'Não foi possível excluir a conta. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={profileStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#40E0D0" />
      </View>
    );
  }

  return (
    <View style={profileStyles.container}>
      <View style={profileStyles.field}>
        <Text style={profileStyles.label}>Nome</Text>
        <TextInput
          style={profileStyles.input}
          value={nome}
          onChangeText={setNome}
          placeholder="Seu nome"
          placeholderTextColor="#999"
        />
      </View>

      <View style={profileStyles.field}>
        <Text style={profileStyles.label}>Email</Text>
        <TextInput
          style={[profileStyles.input, profileStyles.inputDisabled]}
          value={userData?.email || ''}
          editable={false}
          placeholderTextColor="#999"
        />
        <Text style={profileStyles.hint}>O email não pode ser alterado</Text>
      </View>

      <View style={profileStyles.field}>
        <Text style={profileStyles.label}>Celular</Text>
        <TextInput
          style={profileStyles.input}
          value={celular}
          onChangeText={setCelular}
          placeholder="(00) 00000-0000"
          keyboardType="phone-pad"
          placeholderTextColor="#999"
        />
      </View>

      <View style={profileStyles.field}>
        <Text style={profileStyles.label}>Data de Nascimento</Text>
        <TextInput
          style={profileStyles.input}
          value={dataNascimento}
          onChangeText={(t) => {
            let cleaned = t.replace(/\D/g, '');
            if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
            let masked = '';
            if (cleaned.length > 0) masked = cleaned.slice(0, 2);
            if (cleaned.length > 2) masked += '/' + cleaned.slice(2, 4);
            if (cleaned.length > 4) masked += '/' + cleaned.slice(4, 8);
            setDataNascimento(masked);
          }}
          placeholder="DD/MM/AAAA"
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>

      <View style={profileStyles.field}>
        <Text style={profileStyles.label}>Orçamento (R$)</Text>
        <TextInput
          style={profileStyles.input}
          value={orcamento}
          onChangeText={setOrcamento}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#999"
        />
      </View>

      <TouchableOpacity
        style={[profileStyles.saveButton, saving && profileStyles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={profileStyles.saveButtonText}>Salvar Alterações</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={profileStyles.deleteButton}
        onPress={handleDeleteAccount}
      >
        <Trash2 size={20} color="#FF3B30" />
        <Text style={profileStyles.deleteButtonText}>Excluir Conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const profileStyles = StyleSheet.create({
  container: { paddingBottom: 40 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  field: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  inputDisabled: { backgroundColor: '#F5F5F5', color: '#999' },
  hint: { fontSize: 12, color: '#999', marginTop: 4 },
  saveButton: {
    backgroundColor: '#40E0D0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    elevation: 6,
  },
  saveButtonDisabled: { backgroundColor: '#999' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  deleteButtonText: { color: '#FF3B30', fontSize: 16, fontWeight: '600' },
});

export default function SettingsScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'preferences' | 'profile'>('preferences');
  const [realPreferences, setRealPreferences] = useState<Record<string, number>>({});
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [planoAtivo, setPlanoAtivo] = useState<string>('free');

  const loadPreferences = useCallback(async () => {
    try {
      // Primeiro tenta buscar do banco via API para garantir dados atualizados
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (!userDataRaw) return;

      const userData = JSON.parse(userDataRaw);

      // Tenta buscar dados frescos da API
      let backendPrefs: Record<string, number> | null = null;
      try {
        const freshUser = await apiService.getUser(userData.email);
        if (freshUser) {
          // Normaliza campos (Newtonsoft retorna PascalCase)
          const prefs = (freshUser as any).Preferencias ?? (freshUser as any).preferencias;
          const plano = (freshUser as any).PlanoAtivo ?? (freshUser as any).planoAtivo ?? (freshUser as any).planoativo ?? 'free';

          if (prefs) {
            backendPrefs = prefs;
            await SecureStore.setItemAsync('USER_PREFERENCES', JSON.stringify(prefs));
          }

          // Atualiza o plano no userData local
          const updatedUserData = { ...userData, planoAtivo: plano };
          await SecureStore.setItemAsync('userData', JSON.stringify(updatedUserData));
          setPlanoAtivo(plano);
        }
      } catch {
        // Se falhar, usa o cache local
        const saved = await SecureStore.getItemAsync('USER_PREFERENCES');
        if (saved) {
          backendPrefs = JSON.parse(saved);
        } else if (userData.preferencias) {
          backendPrefs = userData.preferencias;
        }
      }

      if (!backendPrefs) return;

      const newReal: Record<string, number> = {};
      const newSlider: Record<string, number> = {};

      preferenceCategories.forEach(cat => {
        const value = backendPrefs![cat.backendKey] ?? 3;
        newReal[cat.key] = value;
        newSlider[cat.key] = toSlider(value);
      });

      setRealPreferences(newReal);
      setSliderValues(newSlider);
    } catch (error) {
      console.log('Erro ao carregar preferências:', error);
    }
  }, []);

  const loadUserPlan = useCallback(async () => {
    try {
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (userDataRaw) {
        const userData = JSON.parse(userDataRaw);
        // Suporta tanto camelCase quanto lowercase (variações do backend)
        const plano = userData.planoAtivo || userData.planoativo || userData.PlanoAtivo || 'free';
        setPlanoAtivo(plano);
      }
    } catch (error) {
      console.log('Erro ao carregar plano:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
    }, [loadPreferences])
  );

  const savePreferences = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (!userDataRaw) {
        CustomAlertService.error('Erro', 'Usuário não encontrado.');
        return;
      }

      const userData = JSON.parse(userDataRaw);

      const updatedPreferences: Record<string, number> = {};
      preferenceCategories.forEach(cat => {
        updatedPreferences[cat.backendKey] = realPreferences[cat.key] ?? 3;
      });

      // Converte data de nascimento para null se estiver vazia
      const dataNascimentoValue = userData.datanascimento || userData.dataNascimento;
      const dataNascimentoISO = dataNascimentoValue ? 
        (typeof dataNascimentoValue === 'string' ? dataNascimentoValue : null) : 
        null;

      const payload: Record<string, unknown> = {
        nome: userData.nome,
        email: userData.email,
        numeroCelular: userData.numerocelular || userData.numeroCelular || '',
        dataNascimento: dataNascimentoISO,
        preferencias: updatedPreferences,
        orcamento: userData.orcamento || 0,
      };

      await apiService.updateUser(userData.email, payload);

      // Atualiza cache local
      await SecureStore.setItemAsync('USER_PREFERENCES', JSON.stringify(updatedPreferences));
      const updatedUserData = { ...userData, preferencias: updatedPreferences };
      await SecureStore.setItemAsync('userData', JSON.stringify(updatedUserData));

      // AQUI LIMPA O CACHE DOS LUGARES PRA RECALCULAR COM AS NOVAS PREFERÊNCIAS
      await SecureStore.deleteItemAsync('cachedPlaces');
      await SecureStore.deleteItemAsync('cachedPlacesTime');

      CustomAlertService.success('Sucesso!', 'Preferências salvas! Os lugares serão atualizados na tela inicial.', [
        { text: 'OK' }
      ]);

    } catch (error) {
      console.error('Erro ao salvar:', error);
      CustomAlertService.error('Erro', 'Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: string, sliderValue: number) => {
    const newValue = fromSlider(sliderValue);
    setRealPreferences(prev => ({ ...prev, [key]: newValue }));
    setSliderValues(prev => ({ ...prev, [key]: sliderValue }));
  };

  const toggleView = () => {
    setCurrentView(prev => prev === 'preferences' ? 'profile' : 'preferences');
  };

  const renderPreferences = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {preferenceCategories.map(cat => (
        <View key={cat.key} style={styles.preferenceItem}>
          <View style={styles.preferenceHeader}>
            <Text style={styles.preferenceLabel}>{cat.label}</Text>
            <Text style={styles.preferenceValue}>
              {realPreferences[cat.key] ?? 3} de 5
            </Text>
          </View>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={100}
            value={sliderValues[cat.key] ?? 60}
            onValueChange={v => updatePreference(cat.key, v)}
            minimumTrackTintColor="#40E0D0"
            maximumTrackTintColor="#ddd"
            thumbTintColor="#40E0D0"
          />

          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>Menos</Text>
            <Text style={styles.sliderLabel}>Mais</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={savePreferences}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>Salvar Preferências</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <ProfileView />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {currentView === 'profile' && (
              <TouchableOpacity style={styles.backButton} onPress={toggleView}>
                <ArrowLeft size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.headerCenter}>
            {currentView === 'preferences' ? <Heart size={24} color="#fff" /> : <User size={24} color="#fff" />}
            <Text style={styles.headerTitle}>
              {currentView === 'preferences' ? 'Minhas Preferências' : 'Meu Perfil'}
            </Text>
          </View>

          {currentView === 'preferences' ? (
            <TouchableOpacity style={styles.headerButton} onPress={toggleView}>
              <ArrowRight size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerButton} />
          )}
        </View>
      </LinearGradient>

      <View style={styles.planBadgeContainer}>
        <View style={[styles.planBadge, planoAtivo === 'premium' ? styles.planBadgePremium : styles.planBadgeFree]}>
          <Text style={[styles.planBadgeText, planoAtivo === 'premium' ? styles.planBadgeTextPremium : styles.planBadgeTextFree]}>
            {planoAtivo === 'premium' ? '⭐ Premium' : 'Free'}
          </Text>
        </View>
        {planoAtivo !== 'premium' && (
          <TouchableOpacity
            style={styles.upgradeBadge}
            onPress={() => router.push('/premium')}
          >
            <Star size={14} color="#fff" fill="#fff" />
            <Text style={styles.upgradeBadgeText}>Seja Premium</Text>
          </TouchableOpacity>
        )}
      </View>

      {currentView === 'preferences' ? renderPreferences() : renderProfile()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { width: 40 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  backButton: { padding: 8 },
  headerButton: { width: 40, padding: 8, alignItems: 'flex-end' },
  content: { flex: 1, padding: 20 },
  preferenceItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
  },
  preferenceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  preferenceLabel: { fontSize: 17, fontWeight: '600', color: '#333' },
  preferenceValue: { fontSize: 17, fontWeight: '700', color: '#40E0D0' },
  slider: { width: '100%', height: 50 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  sliderLabel: { fontSize: 13, color: '#888' },
  saveButton: {
    backgroundColor: '#40E0D0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    elevation: 6,
  },
  saveButtonDisabled: { backgroundColor: '#999' },
  saveButtonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  planBadgeContainer: { alignItems: 'center', marginTop: -12, marginBottom: 4, zIndex: 1 },
  planBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 } },
  planBadgePremium: { backgroundColor: '#FFD700' },
  planBadgeFree: { backgroundColor: '#E0E0E0' },
  planBadgeText: { fontSize: 13, fontWeight: '700' },
  planBadgeTextPremium: { color: '#5D4200' },
  planBadgeTextFree: { color: '#666' },
  upgradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF8C00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    elevation: 3,
  },
  upgradeBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});