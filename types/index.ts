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
  temperature: number;
  isRaining: boolean;
  description: string;
};

export type HorarioIdeal = {
  horario: string;
  condicaoClimatica: string;
  recomendado: boolean;
};
