import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { MapPin, Heart, Trash2, Calendar } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ExpoCalendar from 'expo-calendar';
import { FavoritePlace } from '../../types';
import { apiService } from '../../services/api';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const router = useRouter();

  const loadFavorites = async () => {
    try {
      const data = await SecureStore.getItemAsync('MY_FAVORITES_LIST');
      if (data) {
        const list: FavoritePlace[] = JSON.parse(data);
        list.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setFavorites(list);
      } else {
        setFavorites([]);
      }
    } catch (error) {
      console.log('Erro ao carregar favoritos:', error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadFavorites();
    }, [])
  );

  const removeFavorite = async (id: string) => {
    Alert.alert(
      'Remover dos favoritos?',
      'Este local será excluído da sua lista.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            const updated = favorites.filter((item) => item.id !== id);
            await SecureStore.setItemAsync('MY_FAVORITES_LIST', JSON.stringify(updated));
            setFavorites(updated);
            Alert.alert('Removido!', 'Local excluído dos favoritos');
          },
        },
      ]
    );
  };

  const handleLocationPress = (place: FavoritePlace) => {
    router.push({
      pathname: '/location-details',
      params: {
        id: place.id,
        name: place.name,
        location: place.location,
        latitude: place.latitude,
        longitude: place.longitude,
        image: place.image,
        environment: place.environment,
      },
    });
  };

  const parseIcsDate = (str: string): Date => {
    // Format: 20250408T090000Z
    const y = parseInt(str.substring(0, 4));
    const m = parseInt(str.substring(4, 6)) - 1;
    const d = parseInt(str.substring(6, 8));
    const h = parseInt(str.substring(9, 11));
    const min = parseInt(str.substring(11, 13));
    const s = parseInt(str.substring(13, 15));
    return new Date(Date.UTC(y, m, d, h, min, s));
  };

  const handleGenerateItinerary = async () => {
    if (favorites.length === 0) {
      Alert.alert('Sem favoritos', 'Adicione lugares aos favoritos para gerar um roteiro.');
      return;
    }

    setExporting(true);
    try {
      // Request calendar permission
      const { status } = await ExpoCalendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso ao calendário para salvar o roteiro.');
        return;
      }

      const payload = {
        places: favorites.map(f => ({
          placeId: f.id,
          name: f.name,
          address: f.location,
          latitude: parseFloat(f.latitude),
          longitude: parseFloat(f.longitude),
          durationMinutes: 60,
        })),
      };

      const blob = await apiService.exportCalendar(payload);
      const reader = new FileReader();
      const icsText = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
      });

      // Parse .ics and create events in device calendar
      const calendars = await ExpoCalendar.getCalendarsAsync(ExpoCalendar.EntityTypes.EVENT);
      const defaultCalendar = calendars.find(c => c.isPrimary) || calendars[0];

      if (!defaultCalendar) {
        // Fallback: share the file
        const fileUri = FileSystem.cacheDirectory + 'roteiro.ics';
        await FileSystem.writeAsStringAsync(fileUri, icsText);
        await Sharing.shareAsync(fileUri, { mimeType: 'text/calendar', dialogTitle: 'Roteiro FindYourWay' });
        return;
      }

      // Parse VEVENT blocks from ics
      const events = icsText.split('BEGIN:VEVENT').slice(1).map(block => {
        const get = (key: string) => {
          const match = block.match(new RegExp(`${key}:(.+)`));
          return match ? match[1].trim() : '';
        };
        return {
          title: get('SUMMARY').replace(/\\,/g, ',').replace(/\\;/g, ';'),
          location: get('LOCATION').replace(/\\,/g, ',').replace(/\\;/g, ';'),
          notes: get('DESCRIPTION').replace(/\\,/g, ',').replace(/\\;/g, ';'),
          startDate: parseIcsDate(get('DTSTART')),
          endDate: parseIcsDate(get('DTEND')),
        };
      });

      for (const evt of events) {
        await ExpoCalendar.createEventAsync(defaultCalendar.id, {
          title: evt.title,
          location: evt.location,
          notes: evt.notes,
          startDate: evt.startDate,
          endDate: evt.endDate,
          timeZone: 'UTC',
        });
      }

      Alert.alert(
        'Roteiro salvo! 🗓️',
        `${events.length} eventos foram adicionados ao seu calendário.`,
        [{ text: 'Ótimo!' }]
      );

    } catch (error: any) {
      if (!error.message?.includes('premium')) {
        Alert.alert('Erro', 'Não foi possível gerar o roteiro.');
      }
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando favoritos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#40E0D0', '#1E90FF']} style={styles.header}>
        <View style={styles.headerContent}>
          <Heart size={28} color="#fff" fill="#fff" />
          <Text style={styles.headerTitle}>Meus Favoritos</Text>
          {favorites.length > 0 && (
            <TouchableOpacity
              style={[styles.calendarButton, exporting && styles.calendarButtonDisabled]}
              onPress={handleGenerateItinerary}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Calendar size={22} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Heart size={90} color="#ddd" />
            <Text style={styles.emptyTitle}>Nenhum lugar salvo</Text>
            <Text style={styles.emptyDescription}>
              Toque no coração nos locais que você ama para salvá-los aqui!
            </Text>
          </View>
        ) : (
          favorites.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.favoriteCard}
              onPress={() => handleLocationPress(item)}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.cardImage}
                resizeMode="cover"
              />

              <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      removeFavorite(item.id);
                    }}
                  >
                    <Trash2 size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.locationContainer}>
                  <MapPin size={15} color="#666" />
                  <Text style={styles.location} numberOfLines={1}>
                    {item.location.split(',')[0].trim()}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View
                    style={
                      item.environment === 'aberto' ? styles.tagOpen : styles.tagClosed
                    }
                  >
                    <Text
                      style={
                        item.environment === 'aberto'
                          ? styles.tagTextOpen
                          : styles.tagTextClosed
                      }
                    >
                      {item.environment === 'aberto'
                        ? 'Aberto ao ar livre'
                        : 'Ambiente fechado'}
                    </Text>
                  </View>

                  <Text style={styles.savedDate}>
                    Salvo em {new Date(item.savedAt).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#40E0D0', fontWeight: '600' },
  header: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  selectButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#40E0D0',
    alignItems: 'center',
  },
  selectButtonActive: { backgroundColor: '#40E0D0' },
  selectButtonText: { fontSize: 16, fontWeight: '600', color: '#40E0D0' },
  selectButtonTextActive: { color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#666', marginTop: 20 },
  emptyDescription: { fontSize: 16, color: '#999', textAlign: 'center', paddingHorizontal: 40, marginTop: 10 },
  favoriteCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 18,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  cardImage: { width: '100%', height: 180 },
  cardContent: { padding: 18 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  cardTitle: { fontSize: 19, fontWeight: '700', color: '#222', flex: 1, marginRight: 12 },
  removeButton: { backgroundColor: '#ff4444', padding: 10, borderRadius: 30 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  location: { fontSize: 15, color: '#666' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagOpen: { backgroundColor: '#E3FCEC', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30 },
  tagClosed: { backgroundColor: '#FFF4E5', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30 },
  tagTextOpen: { color: '#065F46', fontWeight: '600', fontSize: 13 },
  tagTextClosed: { color: '#FF6D00', fontWeight: '600', fontSize: 13 },
  savedDate: { fontSize: 13, color: '#888', fontStyle: 'italic' },
  exportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FF8C00',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 3,
  },
  exportButtonDisabled: { backgroundColor: '#CCC' },
  exportButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
