import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, MapPin, Thermometer, Heart, Navigation, Clock } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { FavoritePlace, HorarioIdeal } from '../types';
import { apiService } from '../services/api';

const { width } = Dimensions.get('window');

// Mock de avaliações
const mockReviews = [
  {
    id: '1',
    userName: 'Maria Silva',
    avatar: 'https://i.pravatar.cc/150?img=1',
    rating: 5,
    date: '2 dias atrás',
    comment: 'Lugar incrível! A vista é maravilhosa e o atendimento foi excelente. Super recomendo!',
  },
  {
    id: '2',
    userName: 'João Santos',
    avatar: 'https://i.pravatar.cc/150?img=12',
    rating: 4,
    date: '1 semana atrás',
    comment: 'Muito bom, mas estava um pouco cheio quando visitei. Vale a pena ir em horários alternativos.',
  },
  {
    id: '3',
    userName: 'Ana Costa',
    avatar: 'https://i.pravatar.cc/150?img=5',
    rating: 5,
    date: '2 semanas atrás',
    comment: 'Perfeito para passar o dia com a família. As crianças adoraram!',
  },
];

const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Text key={i} style={styles.star}>
      {i < rating ? '⭐' : '☆'}
    </Text>
  ));
};

export default function LocationDetailsScreen() {
  const params = useLocalSearchParams();
  const [isSaved, setIsSaved] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [horarios, setHorarios] = useState<HorarioIdeal[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [showHorarios, setShowHorarios] = useState(false);

  const placeId = params.id as string; // ← ID único do lugar
  const latitude = parseFloat(params.latitude as string);
  const longitude = parseFloat(params.longitude as string);
  const name = params.name as string;
  const location = params.location as string;
  const image = params.image as string;
  const environment = params.environment as string;

  // CARREGA SE JÁ ESTÁ SALVO NOS FAVORITOS
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync(`favorite_${placeId}`);
      if (saved === 'true') setIsSaved(true);
    })();
  }, [placeId]);

  // SALVA/REMOVE DOS FAVORITOS
const toggleFavorite = async () => {
  const newState = !isSaved;
  setIsSaved(newState);

  try {
    const currentJson = await SecureStore.getItemAsync('MY_FAVORITES_LIST');
    let list: FavoritePlace[] = currentJson ? JSON.parse(currentJson) : [];

    if (newState) {
      const exists = list.some(item => item.id === placeId);
      if (!exists) {
        list.push({
          id: placeId,
          name,
          location,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          image,
          environment,
          savedAt: new Date().toISOString(),
        });
        await SecureStore.setItemAsync('MY_FAVORITES_LIST', JSON.stringify(list));
        Alert.alert('Salvo!', `${name} adicionado aos favoritos`);
      }
    } else {
      list = list.filter(item => item.id !== placeId);
      await SecureStore.setItemAsync('MY_FAVORITES_LIST', JSON.stringify(list));
      Alert.alert('Removido', `${name} saiu dos favoritos`);
    }
  } catch (error) {
    Alert.alert('Erro', 'Não foi possível salvar');
  }
};

  // Localização do usuário (pra traçar rota)
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  const openMaps = () => {
    if (!userLocation) {
      Alert.alert('Localização', 'Ative o GPS para traçar a rota!');
      return;
    }

    const url = Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d`,
      android: `google.navigation:q=${latitude},${longitude}&mode=d`,
    });

    Linking.canOpenURL(url!)
      .then((supported) => {
        if (supported) Linking.openURL(url!);
        else Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
      })
      .catch(() => Alert.alert('Erro', 'Não foi possível abrir o app de mapas'));
  };

  const fetchHorariosIdeais = async () => {
    if (loadingHorarios) return;
    setLoadingHorarios(true);
    try {
      const data = await apiService.getHorariosIdeais(placeId);
      setHorarios(data);
      setShowHorarios(true);
    } catch (error: any) {
      // 403 is already handled by apiService (shows premium Alert)
      if (!error.message?.includes('premium')) {
        Alert.alert('Erro', 'Não foi possível carregar os horários ideais.');
      }
    } finally {
      setLoadingHorarios(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {name}
          </Text>
          <TouchableOpacity style={styles.saveButton} onPress={toggleFavorite}>
            <Heart
              size={26}
              color="#fff"
              fill={isSaved ? '#FF4444' : 'transparent'}
              strokeWidth={isSaved ? 0 : 2}
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Image source={{ uri: image }} style={styles.heroImage} resizeMode="cover" />

        <View style={styles.infoCard}>
          <Text style={styles.placeName}>{name}</Text>

          <View style={styles.infoRow}>
            <MapPin size={18} color="#666" />
            <Text style={styles.infoText}>{location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Thermometer size={18} color="#FFA500" />
            <Text style={styles.infoText}>
              Temperatura atual • {environment === 'aberto' ? 'Aberto ao ar livre' : 'Ambiente fechado'}
            </Text>
          </View>
        </View>

        <View style={styles.mapCard}>
          <Text style={styles.sectionTitle}>Localização</Text>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
          >
            <Marker coordinate={{ latitude, longitude }} title={name} />
          </MapView>

          <TouchableOpacity style={styles.directionsButton} onPress={openMaps}>
            <Navigation size={20} color="#fff" />
            <Text style={styles.directionsText}>Traçar Rota Agora</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.horariosCard}>
          <TouchableOpacity
            style={[styles.horariosButton, loadingHorarios && styles.horariosButtonDisabled]}
            onPress={fetchHorariosIdeais}
            disabled={loadingHorarios}
          >
            {loadingHorarios ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Clock size={20} color="#fff" />
                <Text style={styles.horariosButtonText}>Horários Ideais</Text>
              </>
            )}
          </TouchableOpacity>

          {showHorarios && horarios.length > 0 && (
            <View style={styles.horariosList}>
              {horarios.map((h, index) => (
                <View key={index} style={[styles.horarioItem, h.recomendado && styles.horarioRecomendado]}>
                  <Text style={styles.horarioTime}>{h.horario}</Text>
                  <Text style={styles.horarioClima}>{h.condicaoClimatica}</Text>
                  {h.recomendado && <Text style={styles.horarioTag}>✓ Recomendado</Text>}
                </View>
              ))}
            </View>
          )}

          {showHorarios && horarios.length === 0 && (
            <Text style={styles.horariosEmpty}>Nenhum horário disponível no momento.</Text>
          )}
        </View>

        <View style={styles.commentsCard}>
          <Text style={styles.sectionTitle}>Avaliações</Text>
          {mockReviews.map((review) => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Image source={{ uri: review.avatar }} style={styles.reviewAvatar} />
                <View style={styles.reviewHeaderText}>
                  <Text style={styles.reviewUserName}>{review.userName}</Text>
                  <View style={styles.reviewStars}>{renderStars(review.rating)}</View>
                </View>
                <Text style={styles.reviewDate}>{review.date}</Text>
              </View>
              <Text style={styles.reviewComment}>{review.comment}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faff' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 19, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center', marginRight: 40 },
  saveButton: { padding: 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30 },
  heroImage: { width: '100%', height: 240 },
  infoCard: { backgroundColor: '#fff', margin: 16, marginBottom: 8, padding: 20, borderRadius: 16, elevation: 3 },
  placeName: { fontSize: 26, fontWeight: '800', color: '#222', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  infoText: { fontSize: 15, color: '#555' },
  mapCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 16, overflow: 'hidden', elevation: 3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', padding: 16, paddingBottom: 8 },
  map: { width: '100%', height: 200 },
  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#40E0D0',
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  directionsText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  commentsCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 16, elevation: 3 },
  emptyReviews: { fontSize: 15, color: '#999', textAlign: 'center', paddingVertical: 20 },
  reviewItem: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  reviewHeaderText: { flex: 1 },
  reviewUserName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 14 },
  reviewDate: { fontSize: 12, color: '#999' },
  reviewComment: { fontSize: 14, color: '#555', lineHeight: 20 },
  horariosCard: { marginHorizontal: 16, marginBottom: 8 },
  horariosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
  },
  horariosButtonDisabled: { backgroundColor: '#CCC' },
  horariosButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  horariosList: { marginTop: 12 },
  horarioItem: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
  },
  horarioRecomendado: { borderLeftWidth: 4, borderLeftColor: '#40E0D0' },
  horarioTime: { fontSize: 15, fontWeight: '700', color: '#333' },
  horarioClima: { fontSize: 13, color: '#666', flex: 1, marginHorizontal: 10 },
  horarioTag: { fontSize: 12, fontWeight: '600', color: '#40E0D0' },
  horariosEmpty: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 16 },
});