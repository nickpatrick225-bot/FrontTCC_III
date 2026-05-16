import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Star, Check, Zap, Clock, Calendar } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { apiService } from '../services/api';

export default function PremiumScreen() {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubscribe = async () => {
    setProcessing(true);
    setProgress(0);

    // Simula processamento de pagamento (3 segundos)
    const totalMs = 3000;
    const intervalMs = 100;
    let elapsed = 0;

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        elapsed += intervalMs;
        setProgress(Math.min(elapsed / totalMs, 1));
        if (elapsed >= totalMs) {
          clearInterval(interval);
          resolve();
        }
      }, intervalMs);
    });

    try {
      const userDataRaw = await SecureStore.getItemAsync('userData');
      if (!userDataRaw) {
        Alert.alert('Erro', 'Usuário não encontrado. Faça login novamente.');
        setProcessing(false);
        return;
      }

      const userData = JSON.parse(userDataRaw);
      await apiService.updatePlan(userData.email, 'premium');

      // Atualiza dados locais
      userData.planoAtivo = 'premium';
      await SecureStore.setItemAsync('userData', JSON.stringify(userData));

      // Re-login para atualizar o token JWT com o novo plano
      Alert.alert(
        'Parabéns! 🎉',
        'Você agora é um usuário Premium! Aproveite os horários ideais e a exportação de calendário.',
        [{ text: 'Vamos lá!', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Erro ao ativar premium:', error);
      Alert.alert('Erro', 'Não foi possível ativar o plano premium. Tente novamente.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#5D4200" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Seja Premium</Text>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconContainer}>
          <Star size={60} color="#FFD700" fill="#FFD700" />
        </View>

        <Text style={styles.title}>FindYourWay Premium</Text>
        <Text style={styles.subtitle}>
          Desbloqueie funcionalidades exclusivas para otimizar suas viagens
        </Text>

        <View style={styles.featuresCard}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Clock size={22} color="#FF8C00" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Horários Ideais</Text>
              <Text style={styles.featureDesc}>
                Descubra os melhores horários para visitar cada lugar, cruzando clima e funcionamento
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Calendar size={22} color="#FF8C00" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Exportar Calendário</Text>
              <Text style={styles.featureDesc}>
                Exporte seu roteiro para Google Calendar, Apple Calendar ou Outlook
              </Text>
            </View>
          </View>

          <View style={styles.separator} />

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Zap size={22} color="#FF8C00" />
            </View>
            <View style={styles.featureText}>
              <Text style={styles.featureName}>Acesso Prioritário</Text>
              <Text style={styles.featureDesc}>
                Novas funcionalidades premium serão adicionadas em breve
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Plano Premium</Text>
          <Text style={styles.price}>R$ 9,90<Text style={styles.pricePeriod}>/mês</Text></Text>
        </View>

        {processing ? (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.processingText}>Processando pagamento...</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.subscribeButton} onPress={handleSubscribe}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.subscribeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Star size={20} color="#fff" fill="#fff" />
              <Text style={styles.subscribeText}>Assinar Premium</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF5' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#5D4200' },
  scrollContent: { padding: 24, alignItems: 'center' },
  iconContainer: { marginTop: 10, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#333', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#777', textAlign: 'center', marginTop: 8, marginBottom: 30, paddingHorizontal: 20 },
  featuresCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    marginBottom: 24,
  },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF4E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  featureText: { flex: 1 },
  featureName: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 4 },
  featureDesc: { fontSize: 13, color: '#888', lineHeight: 18 },
  separator: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 4 },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  priceLabel: { fontSize: 14, color: '#888', fontWeight: '600', marginBottom: 4 },
  price: { fontSize: 36, fontWeight: '800', color: '#333' },
  pricePeriod: { fontSize: 16, fontWeight: '500', color: '#888' },
  subscribeButton: { width: '100%', borderRadius: 14, overflow: 'hidden', elevation: 6, marginBottom: 30 },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  subscribeText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  processingContainer: { alignItems: 'center', paddingVertical: 30, width: '100%' },
  processingText: { fontSize: 16, color: '#888', marginTop: 16, marginBottom: 16 },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
});
