import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ArrowRight, User, Heart, Star } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as SecureStore from 'expo-secure-store';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiService } from '../../services/api';

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

export default function SettingsScreen() {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<'preferences' | 'profile'>('preferences');
  const [realPreferences, setRealPreferences] = useState<Record<string, number>>({});
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [planoAtivo, setPlanoAtivo] = useState<string>('free');

  const loadPreferences = useCallback(async () => {
    try {
      const saved = await SecureStore.getItemAsync('USER_PREFERENCES');
      if (!saved) return;

      const backendPrefs = JSON.parse(saved);

      const newReal: Record<string, number> = {};
      const newSlider: Record<string, number> = {};

      preferenceCategories.forEach(cat => {
        const value = backendPrefs[cat.backendKey] ?? 3;
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
        setPlanoAtivo(userData.planoAtivo || 'free');
      }
    } catch (error) {
      console.log('Erro ao carregar plano:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPreferences();
      loadUserPlan();
    }, [loadPreferences, loadUserPlan])
  );

  const savePreferences = async () => {
    if (saving) return;
    setSaving(true);

    try {
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (!userDataRaw) {
        Alert.alert('Erro', 'Usuário não encontrado.');
        return;
      }

      const userData = JSON.parse(userDataRaw);

      const updatedPreferences: Record<string, number> = {};
      preferenceCategories.forEach(cat => {
        updatedPreferences[cat.backendKey] = realPreferences[cat.key] ?? 3;
      });

      const payload: Record<string, unknown> = {
        nome: userData.nome,
        email: userData.email,
        numeroCelular: userData.numerocelular || userData.numeroCelular || '',
        dataNascimento: userData.datanascimento || userData.dataNascimento || '',
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

      Alert.alert('Sucesso!', 'Preferências salvas! Os lugares serão atualizados na tela inicial.', [
        { text: 'OK' }
      ]);

    } catch (error) {
      console.error('Erro ao salvar:', error);
      Alert.alert('Erro', 'Não foi possível salvar. Tente novamente.');
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

          <TouchableOpacity style={styles.headerButton} onPress={toggleView}>
            <ArrowRight size={24} color="#fff" />
          </TouchableOpacity>
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
  headerButton: { padding: 8 },
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