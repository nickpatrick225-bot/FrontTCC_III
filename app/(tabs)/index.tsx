import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
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
  Beer,
} from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { GOOGLE_PLACES_API_KEY } from '../../config/api';
import { apiService } from '../../services/api';
import { CustomAlertService } from '../../components/CustomAlert';
import type { Place } from '../../types';

type WeatherDisplay = {
  temperature: number;
  isRaining: boolean;
  description: string;
};

// Traduz condição climática para PT-BR (Google Weather API costuma retornar em inglês)
const translateWeather = (text: string): string => {
  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower.includes('clear') || lower.includes('sunny')) return 'Céu limpo';
  if (lower.includes('partly') || lower.includes('partial')) return 'Parcialmente nublado';
  if (lower.includes('cloud')) return 'Nublado';
  if (lower.includes('overcast')) return 'Encoberto';
  if (lower.includes('thunder') || lower.includes('storm')) return 'Tempestade';
  if (lower.includes('shower')) return 'Pancadas de chuva';
  if (lower.includes('light rain') || lower.includes('drizzle')) return 'Chuva leve';
  if (lower.includes('heavy rain')) return 'Chuva forte';
  if (lower.includes('rain')) return 'Chuva';
  if (lower.includes('snow')) return 'Neve';
  if (lower.includes('fog') || lower.includes('mist')) return 'Neblina';
  if (lower.includes('wind')) return 'Ventoso';
  if (lower.includes('hot')) return 'Calor';
  if (lower.includes('cold')) return 'Frio';
  // Caso já esteja em PT, devolve com inicial maiúscula
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

// Lotes de busca: cada lote consulta a API com um conjunto de tipos
// O primeiro lote carrega imediatamente; os demais carregam em sequência conforme o usuário scrolla.
type Batch = {
  id: string;
  label: string;
  types: string[];
  // chave de preferência (se peso < 1, pula esse lote)
  prefKey?: 'praia' | 'parque' | 'museu' | 'restaurante' | 'bar' | 'monumentos';
};

const BUILD_BATCHES = (prefs: Record<string, number>): Batch[] => {
  const batches: Batch[] = [
    { id: 'tourist', label: 'Atrações Turísticas', types: ['tourist_attraction'] },
  ];

  // Cada categoria vira um lote separado, ordenado pela preferência do usuário (maior primeiro)
  const candidates: { batch: Batch; weight: number }[] = [
    { batch: { id: 'beach', label: 'Praias', types: ['beach'], prefKey: 'praia' }, weight: prefs.praia ?? 0 },
    { batch: { id: 'park', label: 'Parques', types: ['park'], prefKey: 'parque' }, weight: prefs.parque ?? 0 },
    { batch: { id: 'museum', label: 'Museus', types: ['museum'], prefKey: 'museu' }, weight: prefs.museu ?? 0 },
    { batch: { id: 'restaurant', label: 'Restaurantes', types: ['restaurant'], prefKey: 'restaurante' }, weight: prefs.restaurante ?? 0 },
    { batch: { id: 'bar', label: 'Bares', types: ['bar', 'pub', 'night_club'], prefKey: 'bar' }, weight: prefs.bar ?? 0 },
    { batch: { id: 'monument', label: 'Monumentos', types: ['monument'], prefKey: 'monumentos' }, weight: prefs.monumentos ?? 0 },
  ];

  // Filtra por peso >= 1 e ordena pelo peso decrescente
  candidates
    .filter(c => c.weight >= 1)
    .sort((a, b) => b.weight - a.weight)
    .forEach(c => batches.push(c.batch));

  return batches;
};

export default function HomeScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('você');
  const [currentDate, setCurrentDate] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [weather, setWeather] = useState<WeatherDisplay | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [allBatchesLoaded, setAllBatchesLoaded] = useState(false);

  // Mantém os IDs já adicionados para evitar duplicatas
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Guarda hash das preferências da última carga para detectar mudanças
  const lastPrefsHashRef = useRef<string>('');

  // === LOCALIZAÇÃO ===
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        CustomAlertService.warning('Localização desativada', 'Usaremos São Paulo como padrão');
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
      const data: any = await apiService.getWeather(lat, lng);

      const temperature = Math.round(
        data?.temperature?.degrees ??
        data?.temperature ??
        data?.temperatura ??
        0
      );

      const description =
        data?.weatherCondition?.description?.text ??
        data?.description ??
        data?.descricao ??
        '';

      const conditionType: string =
        data?.weatherCondition?.type ??
        data?.weatherCondition ??
        '';

      const isRaining =
        data?.isRaining === true ||
        description.toLowerCase().includes('chuva') ||
        description.toLowerCase().includes('rain') ||
        conditionType.toString().toLowerCase().includes('rain');

      setWeather({
        temperature,
        isRaining,
        description,
      });
    } catch (e) {
      console.log('Erro ao buscar clima:', e);
    }
  };

  // === CARREGA UM LOTE ESPECÍFICO ===
  const fetchBatch = useCallback(
    async (batch: Batch, location: { lat: number; lng: number }, email: string): Promise<Place[]> => {
      const payload = {
        email,
        includedTypes: batch.types,
        maxResultCount: 20, // máximo da Google Places API por chamada
        locationRestriction: {
          circle: {
            center: { latitude: location.lat, longitude: location.lng },
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

      // Marca alguns como patrocinados (~20%) — sorteio só dos IDs, sem mexer na ordem original
      const sponsoredCount = Math.max(1, Math.floor(validPlaces.length * 0.2));
      const idsShuffled = validPlaces.map(p => p.id).sort(() => Math.random() - 0.5);
      const sponsoredIds = new Set(idsShuffled.slice(0, sponsoredCount));
      return validPlaces.map(p => ({ ...p, sponsored: sponsoredIds.has(p.id) }));
    },
    []
  );

  // === CARREGA OS PRIMEIROS LOTES (EM PARALELO) ===
  const loadInitial = useCallback(async () => {
    if (!userLocation) return;

    setInitialLoading(true);
    seenIdsRef.current = new Set();

    try {
      await fetchWeather(userLocation.lat, userLocation.lng);

      const emailRaw = await SecureStore.getItemAsync('userData');
      const email = emailRaw ? JSON.parse(emailRaw).email : '';

      const prefsRaw = await SecureStore.getItemAsync('USER_PREFERENCES');
      const backendPrefs = prefsRaw ? JSON.parse(prefsRaw) : {};

      const prefs = {
        praia: backendPrefs.Praias ?? 3,
        parque: backendPrefs.Parques ?? 3,
        museu: backendPrefs.Museus ?? 3,
        restaurante: backendPrefs.Restaurantes ?? 3,
        bar: backendPrefs.Bares ?? 3,
        monumentos: backendPrefs.MonumentosHistoricos ?? 3,
      };

      const allBatches = BUILD_BATCHES(prefs);
      setBatches(allBatches);
      setCurrentBatchIndex(0);
      setAllBatchesLoaded(false);

      if (allBatches.length === 0) {
        setPlaces([]);
        return;
      }

      // Carrega os primeiros 3 lotes em paralelo para ter variedade desde o início
      const initialBatchCount = Math.min(3, allBatches.length);
      const initialBatches = allBatches.slice(0, initialBatchCount);

      if (__DEV__) console.log('Carregando lotes iniciais:', initialBatches.map(b => b.label).join(', '));

      const batchResults = await Promise.allSettled(
        initialBatches.map(batch => fetchBatch(batch, userLocation, email))
      );

      // Combina resultados de todos os lotes iniciais
      const allNewPlaces: Place[] = [];
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          for (const p of result.value) {
            if (!seenIdsRef.current.has(p.id)) {
              seenIdsRef.current.add(p.id);
              allNewPlaces.push(p);
            }
          }
        }
      }

      // Ordena: abertos primeiro, depois por similaridade
      const sorted = [...allNewPlaces].sort((a, b) => {
        const aOpen = (a as any).isOpenNow !== false ? 1 : 0;
        const bOpen = (b as any).isOpenNow !== false ? 1 : 0;
        if (bOpen !== aOpen) return bOpen - aOpen;
        return (b.similarity ?? 0) - (a.similarity ?? 0);
      });
      setPlaces(sorted);
      setCurrentBatchIndex(initialBatchCount);

      if (initialBatchCount >= allBatches.length) setAllBatchesLoaded(true);
    } catch (e) {
      console.error('Erro ao carregar lotes iniciais:', e);
      CustomAlertService.error('Erro', 'Não foi possível carregar os lugares.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [userLocation, fetchBatch]);

  // === CARREGA PRÓXIMO LOTE (chamado no scroll) ===
  const loadNextBatch = useCallback(async () => {
    if (loadingMore || allBatchesLoaded || !userLocation) return;
    if (currentBatchIndex >= batches.length) {
      setAllBatchesLoaded(true);
      return;
    }

    setLoadingMore(true);

    try {
      const emailRaw = await SecureStore.getItemAsync('userData');
      const email = emailRaw ? JSON.parse(emailRaw).email : '';

      const nextBatch = batches[currentBatchIndex];
      if (__DEV__) console.log('Carregando lote:', nextBatch.label);

      const results = await fetchBatch(nextBatch, userLocation, email);
      const newPlaces = results.filter(p => !seenIdsRef.current.has(p.id));
      newPlaces.forEach(p => seenIdsRef.current.add(p.id));

      // Mescla com a lista atual e reordena: abertos primeiro, depois por similaridade (cosseno).
      setPlaces(prev => {
        const combined = [...prev, ...newPlaces];
        return combined.sort((a, b) => {
          const aOpen = (a as any).isOpenNow !== false ? 1 : 0;
          const bOpen = (b as any).isOpenNow !== false ? 1 : 0;
          if (bOpen !== aOpen) return bOpen - aOpen;
          return (b.similarity ?? 0) - (a.similarity ?? 0);
        });
      });

      const newIndex = currentBatchIndex + 1;
      setCurrentBatchIndex(newIndex);
      if (newIndex >= batches.length) setAllBatchesLoaded(true);
    } catch (e) {
      console.error('Erro ao carregar lote adicional:', e);
      // Avança o índice mesmo com erro para evitar loop infinito
      setCurrentBatchIndex(prev => prev + 1);
      if (currentBatchIndex + 1 >= batches.length) setAllBatchesLoaded(true);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, allBatchesLoaded, userLocation, batches, currentBatchIndex, fetchBatch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadInitial();
  }, [loadInitial]);

  // Recarrega quando a tela ganha foco (ex: ao voltar das preferências)
  // e também quando a localização é detectada pela primeira vez
  useFocusEffect(
    useCallback(() => {
      if (!userLocation) return;

      // Verifica se as preferências mudaram desde a última carga
      (async () => {
        const prefsRaw = await SecureStore.getItemAsync('USER_PREFERENCES');
        const currentHash = prefsRaw || '';

        if (currentHash !== lastPrefsHashRef.current || places.length === 0) {
          lastPrefsHashRef.current = currentHash;
          loadInitial();
        }
      })();
    }, [userLocation, loadInitial])
  );

  // Handler de scroll para carregar mais lugares quando chegar perto do fim
  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);

      // Quando faltar 400px para o fim, dispara a próxima busca
      if (distanceFromBottom < 400 && !loadingMore && !allBatchesLoaded) {
        loadNextBatch();
      }
    },
    [loadingMore, allBatchesLoaded, loadNextBatch]
  );

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

  if (initialLoading && !refreshing) {
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
      <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Navigation size={22} color="#fff" />
            <Text style={styles.headerTitle}>Perto de você, {userName}!</Text>
          </View>

          {weather && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              {weather.isRaining ? <CloudRain size={24} color="#FFF" /> : <Sun size={24} color="#FFF" />}
              <Text style={styles.weatherText}>
                {weather.temperature}°C • {weather.isRaining ? 'Chovendo' : (translateWeather(weather.description) || 'Tempo bom')}
              </Text>
            </View>
          )}

          <Text style={styles.headerDate}>{currentDate}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#40E0D0']} />}
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        {places.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum lugar encontrado</Text>
        ) : (
          <>
            {places.map((item) => (
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
            ))}

            {/* Indicador de carregamento de mais lugares */}
            {loadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#40E0D0" />
                <Text style={styles.loadingMoreText}>
                  Buscando mais lugares
                  {batches[currentBatchIndex] ? ` (${batches[currentBatchIndex].label})` : ''}...
                </Text>
              </View>
            )}

            {/* Mensagem quando todos os lotes foram carregados */}
            {allBatchesLoaded && places.length > 0 && (
              <Text style={styles.endOfListText}>
                Você viu todos os {places.length} lugares próximos 🎉
              </Text>
            )}
          </>
        )}
      </ScrollView>
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
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
  },
  loadingMoreText: { fontSize: 14, color: '#40E0D0', fontWeight: '600' },
  endOfListText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
