import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Thermometer,
  Navigation,
  Sun,
  CloudRain,
  Building2,
  Utensils,
  Trees,
  Church,
  MapPinned,
  Beer,
} from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import { apiService } from '../../services/api';
import type { Place, WeatherData } from '../../types';

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('você');
  const [currentDate, setCurrentDate] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // === SIMULAÇÃO ===
  const [isRainSimulation, setIsRainSimulation] = useState(false);
  const [showRainModal, setShowRainModal] = useState(false);
  const [prioritizeClosed, setPrioritizeClosed] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // === LOCALIZAÇÃO ===
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Localização desativada', 'Usaremos São Paulo como padrão');
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  // === NOME + DATA ===
  useEffect(() => {
    const loadUser = async () => {
      const data = await SecureStore.getItemAsync('userData');
      if (data) {
        const user = JSON.parse(data);
        setUserName(user.nome?.split(' ')[0] || 'você');
      }

      const hoje = new Date();
      const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const d = String(hoje.getDate()).padStart(2, '0');
      const m = String(hoje.getMonth() + 1).padStart(2, '0');
      setCurrentDate(`${dias[hoje.getDay()]}, ${d}/${m}/${hoje.getFullYear()}`);
    };
    loadUser();
  }, []);

  // === CLIMA ===
  const fetchWeather = async (lat: number, lng: number) => {
    try {
      const data = await apiService.getWeather(lat, lng);
      setWeather({
        temperature: Math.round(data.temperature || 0),
        isRaining: data.isRaining === true || (data.description?.toLowerCase().includes('chuva') ?? false),
        description: data.description || '',
      });
    } catch (e) {
      console.log('Erro ao buscar clima:', e);
    }
  };

  // === CARREGA LUGARES ===
  const loadPlaces = useCallback(
    async (isPullToRefresh = false) => {
      if (!isPullToRefresh) setLoading(true);
      setRefreshing(true);

      try {
        if (!userLocation) return;

        await fetchWeather(userLocation.lat, userLocation.lng);

        const emailRaw = await SecureStore.getItemAsync('userData');
        const email = emailRaw ? JSON.parse(emailRaw).email : '';

        const prefsRaw = await SecureStore.getItemAsync('USER_PREFERENCES');
        const backendPrefs = prefsRaw ? JSON.parse(prefsRaw) : {};

        if (__DEV__) {
          console.log('Preferências brutas:', backendPrefs);
        }

        const prefs = {
          praia:       backendPrefs.Praias ?? 3,
          parque:      backendPrefs.Parques ?? 3,
          museu:       backendPrefs.Museus ?? 3,
          restaurante: backendPrefs.Restaurantes ?? 3,
          bar:         backendPrefs.Bares ?? 3,
          monumentos:  backendPrefs.MonumentosHistoricos ?? 3,
        };

        if (__DEV__) {
          console.log('Preferências mapeadas:', prefs);
        }

        // === AGORA BARES FUNCIONAM 100% ===
        const finalTypes = [
          'tourist_attraction',
          ...(prefs.praia >= 1 ? ['beach'] : []),
          ...(prefs.parque >= 1 ? ['park'] : []),
          ...(prefs.museu >= 1 ? ['museum'] : []),
          ...(prefs.restaurante >= 1 ? ['restaurant'] : []),
          ...(prefs.bar >= 1 ? ['bar', 'pub', 'night_club'] : []),
          ...(prefs.monumentos >= 1 ? ['monument'] : []),
        ];

        const safeTypes = finalTypes.length > 0 
          ? finalTypes.slice(0, 6) 
          : ['tourist_attraction'];

        if (__DEV__) {
          console.log('Tipos enviados à API:', safeTypes);
        }

        const payload = {
          email,
          includedTypes: safeTypes,
          maxResultCount: 15,
          locationRestriction: {
            circle: {
              center: { latitude: userLocation.lat, longitude: userLocation.lng },
              radius: 50000,
            },
          },
        };

        const rawData = await apiService.searchAndClassify(payload);

        const validPlaces: Place[] = (rawData || [])
          .map((p: any): Place | null => {
            if (!p || !p.id) return null;
            const env = typeof p.environment === 'string' ? p.environment.trim().toLowerCase() : '';
            if (env !== 'aberto' && env !== 'fechado') return null;

            return {
              id: p.id,
              displayName: p.displayName || 'Nome indisponível',
              formattedAddress: p.formattedAddress || '',
              latitude: p.latitude || 0,
              longitude: p.longitude || 0,
              photoName: p.photoName || null,
              environment: env as 'aberto' | 'fechado',
              similarity: p.similarity ?? 0,
              types: Array.isArray(p.types) ? p.types : [],
            };
          })
          .filter((p): p is Place => p !== null);

        // Marca ~20% dos lugares aleatoriamente como patrocinados (mock)
        const sponsoredCount = Math.max(1, Math.floor(validPlaces.length * 0.2));
        const shuffled = [...validPlaces].sort(() => Math.random() - 0.5);
        const sponsoredIds = new Set(shuffled.slice(0, sponsoredCount).map(p => p.id));
        const placesWithSponsored = validPlaces.map(p => ({
          ...p,
          sponsored: sponsoredIds.has(p.id),
        }));

        setPlaces(placesWithSponsored);
      } catch (e) {
        console.error('Erro ao carregar lugares:', e);
        setPlaces([]);
        Alert.alert('Erro', 'Não foi possível carregar os lugares.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userLocation]
  );

  const onRefresh = useCallback(() => loadPlaces(true), [loadPlaces]);

  useEffect(() => {
    if (userLocation) loadPlaces();
  }, [userLocation, loadPlaces]);

  const handleLocationPress = (place: Place) => {
    router.push({
      pathname: '/location-details',
      params: {
        id: place.id,
        name: place.displayName,
        location: place.formattedAddress,
        latitude: place.latitude,
        longitude: place.longitude,
        environment: place.environment,
        image: place.photoName
          ? `https://places.googleapis.com/v1/${place.photoName}/media?key=${GOOGLE_PLACES_API_KEY}&maxHeightPx=800`
          : 'https://images.pexels.com/photos/346529/pexels-photo-346529.jpeg',
      },
    });
  };

  // ÍCONE E LABEL PARA BARES
  const getTypeIcon = (types: string[]) => {
    if (types.some(t => t.includes('bar') || t.includes('pub') || t.includes('night_club'))) 
      return <Beer size={14} color="#FF6B00" />;
    if (types.some(t => t.includes('restaurant') || t.includes('food'))) 
      return <Utensils size={14} color="#666" />;
    if (types.some(t => t.includes('park'))) 
      return <Trees size={14} color="#228B22" />;
    if (types.some(t => t.includes('museum'))) 
      return <Church size={14} color="#4B0082" />;
    if (types.some(t => t.includes('beach'))) 
      return <Sun size={14} color="#FFD700" />;
    if (types.some(t => t.includes('monument') || t.includes('point_of_interest'))) 
      return <Church size={14} color="#8B5A2B" />;
    return null;
  };

  const getMainTypeLabel = (types: string[]) => {
    if (types.some(t => t.includes('bar') || t.includes('pub') || t.includes('night_club'))) 
      return 'Bar';
    if (types.some(t => t.includes('restaurant'))) return 'Restaurante';
    if (types.some(t => t.includes('park'))) return 'Parque';
    if (types.some(t => t.includes('museum'))) return 'Museu';
    if (types.some(t => t.includes('beach'))) return 'Praia';
    if (types.some(t => t.includes('monument') || t.includes('point_of_interest'))) return 'Monumento';
    if (types.some(t => t.includes('tourist_attraction'))) return 'Atração';
    return 'Local';
  };

  const sortedPlaces = [...places].sort((a, b) => {
    if (!prioritizeClosed) return 0;
    if (a.environment === 'fechado' && b.environment === 'aberto') return -1;
    if (a.environment === 'aberto' && b.environment === 'fechado') return 1;
    return 0;
  });

  const toggleRainSimulation = () => {
    if (isRainSimulation) {
      setIsRainSimulation(false);
      setShowRainModal(false);
      setPrioritizeClosed(false);
    } else {
      setIsRainSimulation(true);
      setShowRainModal(true);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size={72} color="#40E0D0" />
        <Text style={styles.loadingText}>
          {userLocation ? 'Buscando os melhores lugares...' : 'Detectando sua localização...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* BOTÕES DEV */}
      {__DEV__ && (
        <View style={styles.devButtons}>
          <TouchableOpacity
            style={[styles.devButtonRain, isRainSimulation && { backgroundColor: '#4CAF50' }]}
            onPress={toggleRainSimulation}
          >
            <CloudRain size={18} color="#FFF" />
            <Text style={styles.devButtonText}>
              {isRainSimulation ? 'Sol' : 'Chuva'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.devButtonLocation}
            onPress={() => setShowLocationModal(true)}
          >
            <MapPinned size={18} color="#FFF" />
            <Text style={styles.devButtonText}>Local</Text>
          </TouchableOpacity>
        </View>
      )}

      <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Navigation size={22} color="#fff" />
            <Text style={styles.headerTitle}>Perto de você, {userName}!</Text>
          </View>

          {weather && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {(weather.isRaining || isRainSimulation) ? <CloudRain size={24} color="#FFF" /> : <Sun size={24} color="#FFF" />}
              <Text style={styles.weatherText}>
                {weather.temperature}°C • {(weather.isRaining || isRainSimulation) ? 'Chovendo' : 'Tempo bom'}
              </Text>
            </View>
          )}

          <Text style={styles.headerDate}>{currentDate}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#40E0D0']} />}
      >
        {sortedPlaces.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum lugar encontrado</Text>
        ) : (
          sortedPlaces.map((item) => (
            <TouchableOpacity key={item.id} style={styles.recommendationCard} onPress={() => handleLocationPress(item)}>
              <Image
                source={{
                  uri: item.photoName
                    ? `https://places.googleapis.com/v1/${item.photoName}/media?key=${GOOGLE_PLACES_API_KEY}&maxHeightPx=800`
                    : 'https://images.pexels.com/photos/346529/pexels-photo-346529.jpeg',
                }}
                style={styles.cardImage}
                resizeMode="cover"
              />
              {/* Selo de patrocinado */}
              {item.sponsored && (
                <View style={styles.sponsoredBadge}>
                  <Text style={styles.sponsoredText}>⭐ Patrocinado</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.displayName}</Text>
                    <View style={styles.typeContainer}>
                      {getTypeIcon(item.types)}
                      <Text style={styles.typeLabel}>{getMainTypeLabel(item.types)}</Text>
                    </View>
                  </View>
                  <View style={styles.temperatureContainer}>
                    <Thermometer size={16} color="#FFA500" />
                    <Text style={styles.temperature}>
                      {weather ? `~${weather.temperature}°C` : '...'}
                    </Text>
                  </View>
                </View>

                <View style={styles.locationContainer}>
                  <MapPin size={12} color="#666" />
                  <Text style={styles.location}>{item.formattedAddress.split(',')[0]}</Text>
                </View>

                <View style={styles.environmentContainer}>
                  {item.environment === 'aberto' ? (
                    <Sun size={16} color="#10B981" />
                  ) : (
                    <Building2 size={16} color="#EF4444" />
                  )}
                  <Text style={styles.environmentText}>
                    {item.environment === 'aberto' ? 'Aberto ao ar livre' : 'Ambiente fechado'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* MODAIS */}
      <Modal visible={showRainModal && isRainSimulation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <CloudRain size={48} color="#FF6D00" />
            <Text style={styles.modalTitle}>Está chovendo!</Text>
            <Text style={styles.rainText}>Quer priorizar lugares com ambiente fechado?</Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 20 }}>
              <TouchableOpacity style={styles.rainButtonNo} onPress={() => setShowRainModal(false)}>
                <Text style={styles.rainButtonText}>Tudo bem</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rainButtonYes}
                onPress={() => {
                  setPrioritizeClosed(true);
                  setShowRainModal(false);
                  Alert.alert('Priorizando', 'Lugares fechados no topo!');
                }}
              >
                <Text style={styles.rainButtonYesText}>Sim, priorizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showLocationModal} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Simular Localização</Text>
              <Text style={styles.modalSubtitle}>Digite latitude e longitude</Text>
              <TextInput style={styles.input} placeholder="Ex: -22.9711" value={manualLat} onChangeText={setManualLat} keyboardType="default" />
              <TextInput style={styles.input} placeholder="Ex: -43.1848" value={manualLng} onChangeText={setManualLng} keyboardType="default" />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={styles.modalButtonCancel} onPress={() => { setShowLocationModal(false); setManualLat(''); setManualLng(''); }}>
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalButtonConfirm}
                  onPress={() => {
                    const lat = parseFloat(manualLat);
                    const lng = parseFloat(manualLng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                      setUserLocation({ lat, lng });
                      setShowLocationModal(false);
                      Alert.alert('Localização simulada!', `Agora em ${lat}, ${lng}`);
                      setManualLat('');
                      setManualLng('');
                    } else {
                      Alert.alert('Erro', 'Digite valores válidos');
                    }
                  }}
                >
                  <Text style={styles.modalButtonConfirmText}>Aplicar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  headerContent: { alignItems: 'center' },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff' },
  weatherText: { fontSize: 16, color: '#fff', fontWeight: '500' },
  headerDate: { fontSize: 14, color: '#fff', opacity: 0.9, marginTop: 4 },
  content: { flex: 1, padding: 16 },
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  cardImage: { width: '100%', height: 170 },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#222' },
  typeContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  typeLabel: { fontSize: 13, color: '#666', fontWeight: '500' },
  temperatureContainer: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  temperature: { fontSize: 14, fontWeight: '600', color: '#333' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  location: { fontSize: 13, color: '#666' },
  environmentContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  environmentText: { fontSize: 13, color: '#444', fontWeight: '500' },
  sponsoredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },
  sponsoredText: { fontSize: 11, fontWeight: '700', color: '#5D4200' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', paddingHorizontal: 40 },
  loadingText: { fontSize: 18, color: '#40E0D0', marginTop: 24, textAlign: 'center', fontWeight: '600' },
  emptyText: { textAlign: 'center', marginTop: 60, fontSize: 17, color: '#666', fontWeight: '500' },
  devButtons: { position: 'absolute', top: 50, right: 16, gap: 10, zIndex: 999 },
  devButtonRain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF5722',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  devButtonLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2196F3',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  devButtonText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#FFF',
    width: '85%',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  rainText: { fontSize: 16, color: '#E65100', textAlign: 'center', marginVertical: 12, fontWeight: '600' },
  rainButtonNo: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 25 },
  rainButtonYes: { paddingVertical: 10, paddingHorizontal: 24, backgroundColor: '#FF9800', borderRadius: 25 },
  rainButtonText: { color: '#666', fontSize: 14 },
  rainButtonYesText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#F9F9F9',
  },
  modalButtonCancel: { flex: 1, paddingVertical: 14, backgroundColor: '#EEE', borderRadius: 12, alignItems: 'center' },
  modalButtonConfirm: { flex: 1, paddingVertical: 14, backgroundColor: '#40E0D0', borderRadius: 12, alignItems: 'center' },
  modalButtonText: { color: '#666', fontWeight: '600' },
  modalButtonConfirmText: { color: '#FFF', fontWeight: '600' },
});
