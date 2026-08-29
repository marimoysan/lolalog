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
  locations: string[]; // multiselect among PAIN_LOCATIONS
  note: string;
};

export const MEDICATIONS = ["Ibuprofeno", "Paracetamol", "Metamizol", "Buscapina"] as const;
export type Medication = (typeof MEDICATIONS)[number];

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
  "Grasas",
  "Fritos",
  "Picante",
] as const;

// Shown as a tap-to-reveal hint next to the matching FOOD_TAGS chip (see
// TagCloud's `hints` prop) — not every tag needs one.
export const FOOD_TAG_HINTS: Partial<Record<(typeof FOOD_TAGS)[number], string>> = {
  Gluten:
    "Trigo, cebada, centeno y espelta, y lo hecho con ellos: pan, pasta, bollería, rebozados, cerveza. La avena solo si no está certificada sin gluten.",
};

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
  painEpisodes: PainEpisode[];
  activityLevel: ScaleLevel | null;
  tiredness: ScaleLevel | null;
  mood: ScaleLevel | null;
  sports: SportEntry[];
  period: boolean;
  sex: boolean;
  alcohol: boolean;
  medication: Medication | null;
  // Free text on how the medication worked. Only meaningful while
  // medication is set, but not cleared elsewhere — see toggleMedication in
  // LogForm, which clears it itself when the medication is deselected.
  medicationEffect: string;
  food: FoodLog;
  notes: string;
};

// Fills in fields added to PainEpisode after some entries were already
// saved (locally or pushed to another device via sync) — without this,
// episodes created before a given field existed come back from storage
// missing it (undefined, not just empty), and spreading/iterating that
// throws instead of just being empty. Run on every DailyEntry as it enters
// the app (SQLite read, sync pull) so the rest of the app can trust the
// shape unconditionally.
export function normalizeEntry(entry: DailyEntry): DailyEntry {
  return {
    ...entry,
    painEpisodes: entry.painEpisodes.map((ep) => ({
      ...ep,
      symptoms: ep.symptoms ?? [],
      locations: ep.locations ?? [],
      note: ep.note ?? "",
    })),
    tiredness: entry.tiredness ?? null,
    mood: entry.mood ?? null,
    medication: entry.medication ?? null,
    medicationEffect: entry.medicationEffect ?? "",
  };
}

export function emptyFoodLog(): FoodLog {
  return { quantity: null, quality: null, tags: [] };
}

export function emptyEntry(date: string): DailyEntry {
  return {
    date,
    painLevel: null,
    painEpisodes: [],
    activityLevel: null,
    tiredness: null,
    mood: null,
    sports: [],
    period: false,
    sex: false,
    alcohol: false,
    medication: null,
    medicationEffect: "",
    food: emptyFoodLog(),
    notes: "",
  };
}
