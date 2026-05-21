import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, MapPin, Thermometer, Heart, Navigation, Clock, Calendar } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCalendar from 'expo-calendar';
import { FavoritePlace, HorarioIdeal, WeatherData, PlaceDetails } from '../types';
import { apiService } from '../services/api';
import { CustomAlertService } from '../components/CustomAlert';

const renderStars = (rating: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Text key={i} style={styles.star}>
      {i < rating ? '⭐' : '☆'}
    </Text>
  ));
};

// Traduz condição climática para PT-BR
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
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export default function LocationDetailsScreen() {
  const params = useLocalSearchParams();
  const [isSaved, setIsSaved] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [horarios, setHorarios] = useState<HorarioIdeal[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [showHorarios, setShowHorarios] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [savingCalendar, setSavingCalendar] = useState<string | null>(null);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Estados do seletor de data/hora para o calendário
  const [pickerHorario, setPickerHorario] = useState<HorarioIdeal | null>(null);
  const [pickerDate, setPickerDate] = useState<Date>(new Date());
  const [pickerHour, setPickerHour] = useState<number>(15);
  const [pickerMinute, setPickerMinute] = useState<number>(0);

  const placeId = params.id as string;
  const latitude = parseFloat(params.latitude as string);
  const longitude = parseFloat(params.longitude as string);
  const name = params.name as string;
  const location = params.location as string;
  const image = params.image as string;
  const environment = params.environment as string;

  // Carrega temperatura atual do lugar
  useEffect(() => {
    (async () => {
      try {
        setLoadingWeather(true);
        const data = await apiService.getWeather(latitude, longitude);
        setWeather(data);
      } catch (error) {
        console.log('Erro ao carregar clima:', error);
      } finally {
        setLoadingWeather(false);
      }
    })();
  }, [latitude, longitude]);

  // Carrega rating + reviews reais do Google Places
  useEffect(() => {
    (async () => {
      try {
        setLoadingDetails(true);
        const data = await apiService.getPlaceDetails(placeId);
        setPlaceDetails(data);
      } catch (error) {
        console.log('Erro ao carregar reviews:', error);
        setPlaceDetails(null);
      } finally {
        setLoadingDetails(false);
      }
    })();
  }, [placeId]);

  // Verifica se está nos favoritos
  useEffect(() => {
    (async () => {
      const currentJson = await SecureStore.getItemAsync('MY_FAVORITES_LIST');
      if (currentJson) {
        const list: FavoritePlace[] = JSON.parse(currentJson);
        setIsSaved(list.some(item => item.id === placeId));
      }
    })();
  }, [placeId]);

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
            environment: environment === 'aberto' ? 'aberto' : 'fechado',
            savedAt: new Date().toISOString(),
          });
          await SecureStore.setItemAsync('MY_FAVORITES_LIST', JSON.stringify(list));
          CustomAlertService.success('Salvo!', `${name} adicionado aos favoritos`);
        }
      } else {
        list = list.filter(item => item.id !== placeId);
        await SecureStore.setItemAsync('MY_FAVORITES_LIST', JSON.stringify(list));
        CustomAlertService.info('Removido', `${name} saiu dos favoritos`);
      }
    } catch (error) {
      CustomAlertService.error('Erro', 'Não foi possível salvar');
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
      CustomAlertService.warning('Localização', 'Ative o GPS para traçar a rota!');
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
      .catch(() => CustomAlertService.error('Erro', 'Não foi possível abrir o app de mapas'));
  };

  const fetchHorariosIdeais = async () => {
    if (loadingHorarios) return;
    setLoadingHorarios(true);
    try {
      const data = await apiService.getHorariosIdeais(placeId);
      setHorarios(data);
      setShowHorarios(true);
    } catch (error: any) {
      if (!error.message?.includes('premium')) {
        CustomAlertService.error('Erro', 'Não foi possível carregar os horários ideais.');
      }
    } finally {
      setLoadingHorarios(false);
    }
  };

  // Salva no calendário a data/hora escolhida pelo usuário no modal seletor
  const saveToCalendarWithDate = async (chosenStart: Date, horario: HorarioIdeal) => {
    if (savingCalendar) return;
    setSavingCalendar(horario.horario);

    try {
      // Pede permissão de calendário
      const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        CustomAlertService.warning('Permissão necessária', 'Permita o acesso ao calendário para salvar o horário.');
        return;
      }

      // Pega o calendário padrão do usuário
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(c => c.isPrimary && c.allowsModifications)
        || calendars.find(c => c.allowsModifications)
        || calendars[0];

      if (!defaultCalendar) {
        CustomAlertService.error('Erro', 'Nenhum calendário disponível no dispositivo.');
        return;
      }

      if (isNaN(chosenStart.getTime())) {
        CustomAlertService.error('Erro', 'Data inválida.');
        return;
      }

      const endDate = new Date(chosenStart.getTime() + 60 * 60 * 1000); // 1h de duração

      await ExpoCalendar.createEventAsync(defaultCalendar.id, {
        title: `Visita: ${name}`,
        location: location,
        notes: `Horário ideal de visita.\n${horario.condicaoClimatica}${horario.recomendado ? '\n✓ Recomendado pelo FindYourWay' : ''}`,
        startDate: chosenStart,
        endDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      CustomAlertService.success('Salvo no calendário! 🗓️',
        `Visita a ${name} agendada para ${chosenStart.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`,
        [{ text: 'Ótimo!' }]
      );
    } catch (error) {
      console.error('Erro ao salvar no calendário:', error);
      CustomAlertService.error('Erro', 'Não foi possível salvar no calendário.');
    } finally {
      setSavingCalendar(null);
      setPickerHorario(null);
    }
  };

  // Abre o seletor de data/hora para um horário específico
  const openCalendarPicker = (horario: HorarioIdeal) => {
    setPickerHorario(horario);

    // Sugestão inicial: tenta extrair hora do texto do horário ("Manhã (09:00)" → 9h)
    const now = new Date();
    const timeMatch = (horario.horario || '').match(/(\d{1,2})[:h](\d{2})/);
    const suggested = new Date(now);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = parseInt(timeMatch[2], 10);
      suggested.setHours(h, m, 0, 0);
    } else {
      suggested.setHours(15, 0, 0, 0);
    }
    if (suggested.getTime() <= now.getTime()) {
      suggested.setDate(suggested.getDate() + 1);
    }

    setPickerDate(suggested);
    setPickerHour(suggested.getHours());
    setPickerMinute(suggested.getMinutes());
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

          {/* Nota geral do Google */}
          {placeDetails?.rating !== undefined && placeDetails?.rating !== null && (
            <View style={styles.ratingRow}>
              <Text style={styles.ratingValue}>{placeDetails.rating.toFixed(1)}</Text>
              <View style={styles.ratingStars}>{renderStars(Math.round(placeDetails.rating))}</View>
              {placeDetails.userRatingCount !== undefined && placeDetails.userRatingCount !== null && (
                <Text style={styles.ratingCount}>
                  ({placeDetails.userRatingCount.toLocaleString('pt-BR')} avaliações)
                </Text>
              )}
            </View>
          )}

          <View style={styles.infoRow}>
            <MapPin size={18} color="#666" />
            <Text style={styles.infoText}>{location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Thermometer size={18} color="#FFA500" />
            {loadingWeather ? (
              <Text style={styles.infoText}>Carregando temperatura...</Text>
            ) : weather ? (
              <Text style={styles.infoText}>
                {Math.round(weather.temperature?.degrees ?? weather.temperatura ?? 0)}°{weather.temperature?.unit === 'FAHRENHEIT' ? 'F' : 'C'}
                {(() => {
                  const desc = translateWeather(weather.weatherCondition?.description?.text ?? weather.descricao ?? '');
                  if (desc) return ` • ${desc}`;
                  if (environment === 'aberto') return ' • Aberto ao ar livre';
                  if (environment === 'fechado') return ' • Ambiente fechado';
                  return '';
                })()}
              </Text>
            ) : (
              <Text style={styles.infoText}>
                Temperatura indisponível
                {environment === 'aberto' ? ' • Aberto ao ar livre' : environment === 'fechado' ? ' • Ambiente fechado' : ''}
              </Text>
            )}
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
            <>
              <Text style={styles.horariosHint}>
                Toque em um horário para escolher data e hora 📅
              </Text>
              <View style={styles.horariosList}>
                {horarios.map((h, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.horarioItem, h.recomendado && styles.horarioRecomendado]}
                    onPress={() => openCalendarPicker(h)}
                    disabled={savingCalendar !== null}
                  >
                    <View style={styles.horarioMainInfo}>
                      <Text style={styles.horarioTime}>{h.horario}</Text>
                      {h.condicaoClimatica ? <Text style={styles.horarioClima}>{h.condicaoClimatica}</Text> : null}
                      {h.recomendado && <Text style={styles.horarioTag}>✓ Recomendado</Text>}
                    </View>
                    <View style={styles.horarioCalendarIcon}>
                      {savingCalendar === h.horario ? (
                        <ActivityIndicator size="small" color="#40E0D0" />
                      ) : (
                        <Calendar size={20} color="#40E0D0" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {showHorarios && horarios.length === 0 && (
            <Text style={styles.horariosEmpty}>Nenhum horário disponível no momento.</Text>
          )}
        </View>

        <View style={styles.commentsCard}>
          <View style={styles.commentsHeader}>
            <Text style={styles.sectionTitleNoPad}>Avaliações</Text>
            {placeDetails?.rating !== undefined && placeDetails?.rating !== null && (
              <View style={styles.commentsHeaderRight}>
                <Text style={styles.commentsHeaderRating}>⭐ {placeDetails.rating.toFixed(1)}</Text>
                {placeDetails.userRatingCount ? (
                  <Text style={styles.commentsHeaderCount}>
                    {placeDetails.userRatingCount.toLocaleString('pt-BR')} no Google
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          {loadingDetails ? (
            <View style={styles.reviewsLoading}>
              <ActivityIndicator color="#40E0D0" />
              <Text style={styles.reviewsLoadingText}>Carregando avaliações do Google...</Text>
            </View>
          ) : placeDetails?.reviews && placeDetails.reviews.length > 0 ? (
            placeDetails.reviews.map((review, index) => (
              <View key={`${review.authorName}-${index}`} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  {review.authorPhotoUri ? (
                    <Image source={{ uri: review.authorPhotoUri }} style={styles.reviewAvatar} />
                  ) : (
                    <View style={[styles.reviewAvatar, styles.reviewAvatarFallback]}>
                      <Text style={styles.reviewAvatarFallbackText}>
                        {review.authorName?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.reviewHeaderText}>
                    <Text style={styles.reviewUserName} numberOfLines={1}>
                      {review.authorName || 'Anônimo'}
                    </Text>
                    <View style={styles.reviewStars}>{renderStars(review.rating || 0)}</View>
                  </View>
                  {review.relativeTime ? (
                    <Text style={styles.reviewDate} numberOfLines={1}>
                      {review.relativeTime}
                    </Text>
                  ) : null}
                </View>
                {review.text ? (
                  <Text style={styles.reviewComment}>{review.text}</Text>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyReviews}>Nenhuma avaliação disponível para este lugar.</Text>
          )}
        </View>
      </ScrollView>

      {/* Modal seletor de data/hora para o calendário */}
      <Modal
        visible={pickerHorario !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerHorario(null)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Quando você quer ir?</Text>
            <Text style={styles.pickerSubtitle} numberOfLines={1}>{name}</Text>

            {/* Datas (próximos 14 dias) */}
            <Text style={styles.pickerSectionLabel}>Data</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={Array.from({ length: 14 }, (_, i) => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                d.setDate(d.getDate() + i);
                return d;
              })}
              keyExtractor={(d) => d.toISOString()}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              renderItem={({ item }) => {
                const isSelected = item.toDateString() === pickerDate.toDateString();
                const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
                const diaNome = dias[item.getDay()];
                const diaNum = item.getDate();
                const isToday = item.toDateString() === new Date().toDateString();
                const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                const isTomorrow = item.toDateString() === tomorrow.toDateString();
                return (
                  <TouchableOpacity
                    style={[styles.dateChip, isSelected && styles.dateChipSelected]}
                    onPress={() => setPickerDate(item)}
                  >
                    <Text style={[styles.dateChipDayName, isSelected && styles.dateChipTextSelected]}>
                      {isToday ? 'Hoje' : isTomorrow ? 'Amanhã' : diaNome}
                    </Text>
                    <Text style={[styles.dateChipDayNum, isSelected && styles.dateChipTextSelected]}>
                      {diaNum}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Horas */}
            <Text style={[styles.pickerSectionLabel, { marginTop: 16 }]}>Horário</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Hora</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {Array.from({ length: 17 }, (_, i) => i + 7).map((h) => (
                    <TouchableOpacity
                      key={h}
                      style={[styles.timeOption, pickerHour === h && styles.timeOptionSelected]}
                      onPress={() => setPickerHour(h)}
                    >
                      <Text style={[styles.timeOptionText, pickerHour === h && styles.timeOptionTextSelected]}>
                        {h.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <Text style={styles.timeColon}>:</Text>

              <View style={styles.timeColumn}>
                <Text style={styles.timeColumnLabel}>Minutos</Text>
                <ScrollView style={styles.timeScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {[0, 15, 30, 45].map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.timeOption, pickerMinute === m && styles.timeOptionSelected]}
                      onPress={() => setPickerMinute(m)}
                    >
                      <Text style={[styles.timeOptionText, pickerMinute === m && styles.timeOptionTextSelected]}>
                        {m.toString().padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Botões */}
            <View style={styles.pickerActions}>
              <TouchableOpacity
                style={styles.pickerCancel}
                onPress={() => setPickerHorario(null)}
                disabled={savingCalendar !== null}
              >
                <Text style={styles.pickerCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerConfirm, savingCalendar && styles.pickerConfirmDisabled]}
                disabled={savingCalendar !== null}
                onPress={() => {
                  if (!pickerHorario) return;
                  const finalDate = new Date(pickerDate);
                  finalDate.setHours(pickerHour, pickerMinute, 0, 0);
                  saveToCalendarWithDate(finalDate, pickerHorario);
                }}
              >
                {savingCalendar ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.pickerConfirmText}>Salvar no Calendário</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  infoText: { fontSize: 15, color: '#555', flex: 1 },
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
  commentsCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 20, paddingHorizontal: 20, paddingBottom: 20, borderRadius: 16, elevation: 3 },
  reviewItem: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  reviewAvatarFallback: { backgroundColor: '#40E0D0', justifyContent: 'center', alignItems: 'center' },
  reviewAvatarFallbackText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  reviewHeaderText: { flex: 1 },
  reviewUserName: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 4 },
  reviewStars: { flexDirection: 'row', gap: 2 },
  star: { fontSize: 14 },
  reviewDate: { fontSize: 12, color: '#999', maxWidth: 100, textAlign: 'right' },
  reviewComment: { fontSize: 14, color: '#555', lineHeight: 20 },
  reviewsLoading: { paddingVertical: 24, alignItems: 'center', gap: 12 },
  reviewsLoadingText: { fontSize: 13, color: '#666' },
  emptyReviews: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 20 },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 12,
  },
  commentsHeaderRight: { alignItems: 'flex-end' },
  commentsHeaderRating: { fontSize: 16, fontWeight: '700', color: '#333' },
  commentsHeaderCount: { fontSize: 11, color: '#999', marginTop: 2 },
  sectionTitleNoPad: { fontSize: 18, fontWeight: '700', color: '#333' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  ratingValue: { fontSize: 22, fontWeight: '800', color: '#222' },
  ratingStars: { flexDirection: 'row', gap: 1 },
  ratingCount: { fontSize: 13, color: '#666', marginLeft: 4 },
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
  horariosHint: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 12, marginBottom: 4, fontStyle: 'italic' },
  horariosList: { marginTop: 8 },
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
  horarioMainInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  horarioTime: { fontSize: 15, fontWeight: '700', color: '#333' },
  horarioClima: { fontSize: 13, color: '#666', flex: 1 },
  horarioTag: { fontSize: 12, fontWeight: '600', color: '#40E0D0' },
  horarioCalendarIcon: { padding: 8, backgroundColor: '#E0F7F5', borderRadius: 20 },
  horariosEmpty: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 16 },

  // Picker de data/hora
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 12,
  },
  pickerTitle: { fontSize: 20, fontWeight: '800', color: '#222', textAlign: 'center' },
  pickerSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginTop: 4, marginBottom: 18 },
  pickerSectionLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 8 },
  dateChip: {
    width: 60,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: { backgroundColor: '#40E0D0' },
  dateChipDayName: { fontSize: 11, fontWeight: '700', color: '#666' },
  dateChipDayNum: { fontSize: 18, fontWeight: '800', color: '#222', marginTop: 2 },
  dateChipTextSelected: { color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 },
  timeColumn: { width: 80, alignItems: 'center' },
  timeColumnLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6 },
  timeScroll: { height: 132, width: '100%' },
  timeOption: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  timeOptionSelected: { backgroundColor: '#E0F7F5' },
  timeOptionText: { fontSize: 17, color: '#666', fontWeight: '600' },
  timeOptionTextSelected: { color: '#40E0D0', fontWeight: '800' },
  timeColon: { fontSize: 24, fontWeight: '800', color: '#40E0D0', marginTop: 14 },
  pickerActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  pickerCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  pickerCancelText: { color: '#666', fontSize: 15, fontWeight: '700' },
  pickerConfirm: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#40E0D0',
    alignItems: 'center',
  },
  pickerConfirmDisabled: { backgroundColor: '#A0E5DC' },
  pickerConfirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
