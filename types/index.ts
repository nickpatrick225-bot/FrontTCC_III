export type FavoritePlace = {
  id: string;
  name: string;
  location: string;
  latitude: string;
  longitude: string;
  image: string;
  environment: 'aberto' | 'fechado';
  savedAt: string;
};

export type Place = {
  id: string;
  displayName: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  photoName: string | null;
  environment: 'aberto' | 'fechado';
  similarity: number;
  types: string[];
  sponsored?: boolean;
};

export type UserData = {
  id: number;
  nome: string;
  email: string;
  numerocelular?: string;
  datanascimento?: string;
  preferencias: Record<string, number>;
  orcamento: number;
  planoAtivo: string;
};

export type LoginResponse = {
  token: string;
  expiration: string;
};

export type WeatherData = {
  // Formato da Google Weather API
  temperature?: {
    degrees: number;
    unit: string;
  };
  feelsLikeTemperature?: {
    degrees: number;
    unit: string;
  };
  weatherCondition?: {
    description?: {
      text: string;
    };
    type?: string;
  };
  // Campos legados (caso a API retorne formato customizado)
  temperatura?: number;
  descricao?: string;
  isRaining?: boolean;
};

export type HorarioIdeal = {
  horario: string;
  condicaoClimatica: string;
  recomendado: boolean;
};

export type PlaceReview = {
  authorName: string;
  authorPhotoUri?: string;
  rating: number;
  relativeTime?: string;
  text: string;
  language?: string;
  publishTime?: string;
};

export type PlaceDetails = {
  id: string;
  rating?: number;
  userRatingCount?: number;
  reviews: PlaceReview[];
};
