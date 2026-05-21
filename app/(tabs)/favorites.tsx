import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { MapPin, Heart, Trash2 } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { FavoritePlace } from '../../types';

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [loading, setLoading] = useState(true);
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
});
