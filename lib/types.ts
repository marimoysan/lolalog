export type PainLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type ScaleLevel = 1 | 2 | 3 | 4 | 5;

export const PAIN_LOCATIONS = [
  "Delante arriba",
  "Delante abajo",
  "Lateral",
  "Espalda",
] as const;

export const SPORT_TYPES = [
  "Fútbol",
  "Correr",
  "Pádel",
  "Escalada",
  "Kayak",
  "Hiking",
  "Natación",
  "Otros",
] as const;
export type SportType = (typeof SPORT_TYPES)[number];

export type SportEntry = {
  id: string;
  type: SportType;
  intensity: ScaleLevel | null;
};

export const PAIN_EPISODE_TRIGGERS = [
  "Caminando",
  "Recién despertada",
  "De pie",
  "Sentada",
  "Otro",
] as const;
export type PainEpisodeTrigger = (typeof PAIN_EPISODE_TRIGGERS)[number];

export const PAIN_EPISODE_SYMPTOMS = [
  "Ardor",
  "Dolor fuerte",
  "Molestia",
  "Otros",
] as const;

export type PainEpisode = {
  id: string;
  timestamp: string; // ISO 8601, set when the episode is added
  trigger: PainEpisodeTrigger | null;
  symptoms: string[];
  note: string;
};

export type FoodQuantity = "poco" | "normal" | "mucho";
export type FoodQuality = "unhealthy" | "medium" | "healthy";

export const FOOD_TAGS = [
  "Carne",
  "Pescado",
  "Verduras",
  "Fruta",
  "Legumbres",
  "Pasta",
  "Arroz",
  "Cereales",
  "Lácteos",
  "Gluten",
  "Azúcar/dulces",
  "Fritos",
  "Picante",
  "Alcohol",
  "Cafeína",
  "Ultraprocesados",
] as const;

export type FoodLog = {
  quantity: FoodQuantity | null;
  quality: FoodQuality | null;
  tags: string[];
};

export type DailyEntry = {
  date: string; // "YYYY-MM-DD"
  // null = not answered (e.g. a retrospective log for activity/sport where
  // pain wasn't recalled), distinct from 0 = explicitly "no pain".
  painLevel: PainLevel | null;
  painLocations: string[];
  painEpisodes: PainEpisode[];
  activityLevel: ScaleLevel | null;
  lieDownNeed: ScaleLevel | null;
  sports: SportEntry[];
  period: boolean;
  sex: boolean;
  food: FoodLog;
  notes: string;
};

export function emptyFoodLog(): FoodLog {
  return { quantity: null, quality: null, tags: [] };
}

export function emptyEntry(date: string): DailyEntry {
  return {
    date,
    painLevel: null,
    painLocations: [],
    painEpisodes: [],
    activityLevel: null,
    lieDownNeed: null,
    sports: [],
    period: false,
    sex: false,
    food: emptyFoodLog(),
    notes: "",
  };
}
