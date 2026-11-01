import { router } from "expo-router";
import { File, UploadType } from "expo-file-system";
import { session } from "./session";

// 👉 CHANGE THIS to the IPv4 address of the laptop running Kai's backend.
//    On that laptop: open a terminal, run `ipconfig`, copy "IPv4 Address".
//    Keep ":5000" at the end. "localhost" does NOT work on a phone.
export const API_URL = "http://192.168.1.15:5000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// auth: false = public request with no login token (visitor screens)
type Options = { method?: string; body?: unknown; form?: FormData; auth?: boolean };

// Sends a request to the backend with the login token attached.
export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const useToken = options.auth !== false && !!session.token;
  if (useToken) headers.Authorization = `Bearer ${session.token}`;

  let body: any;
  if (options.form) {
    body = options.form; // don't set Content-Type for photos, fetch does it
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let res: Response;
  try {
    res = await fetch(API_URL + path, { method: options.method ?? "GET", headers, body });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check the backend is running and your phone is on the same Wi-Fi.");
  }

  const data = await res.json().catch(() => ({}));

  // Token expired or account deactivated → back to login
  if (res.status === 401 && useToken) {
    session.token = "";
    session.user = null;
    router.replace("/");
    throw new ApiError(401, "Your session expired. Please log in again.");
  }

  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data as T;
}

// ---- Types matching the backend (see backend/README.md) ----

export type User = {
  user_id: number;
  full_name: string;
  email: string;
  role_name: "Botanist" | "Conservation Officer" | "Admin";
  botanist_type: "Internal" | "External" | null;
};

export type PlantSummary = {
  plant_id: number;
  qr_code: string;
  scientific_name: string;
  common_name?: string | null;
  family?: string | null;
  publication_status?: "Under Research" | "Published";
  cover_photo_url?: string | null;
  registered_by_name?: string;
  created_at?: string;
  full_detail?: boolean;
};

export type PlantList = { plants: PlantSummary[]; total: number; page: number; limit: number };

export type PlantDetail = PlantSummary & {
  genus?: string | null;
  species?: string | null;
  height_cm?: string | null; // decimals come back as strings
  width_cm?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  morphological_notes?: string | null;
  surrounding_environment?: string | null;
  conservation_status?: string | null;
  general_location?: string | null;
  photos?: { photo_id: number; photo_url: string }[];
};

// A Botanist's edit / delete request (GET /api/requests/mine)
export type PlantRequest = {
  request_id: number;
  plant_id: number | null;
  plant_scientific_name_snapshot: string;
  plant_qr_code_snapshot: string;
  request_type: "EDIT" | "DELETE";
  proposed_changes: Record<string, unknown> | null;
  status: "Pending" | "Approved" | "Rejected";
  review_comment?: string | null;
  reviewed_by_name?: string | null;
  requested_at: string;
};

// What a visitor sees (GET /api/public/plants, /api/public/plants/qr/:qr).
// Only published plants; GPS only when an Officer set the location to Public.
export type PublicPlant = {
  qr_code: string;
  scientific_name: string;
  common_name?: string | null;
  family?: string | null;
  genus?: string | null;
  species?: string | null;
  conservation_status?: string | null;
  height_cm?: string | null;
  width_cm?: string | null;
  morphological_notes?: string | null;
  ecological_role?: string | null;
  medicinal_use?: string | null;
  cultural_significance?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  general_location?: string | null;
  cover_photo_url?: string | null;
  photos?: { photo_id: number; photo_url: string }[];
};

// Plant fields a Botanist can fill in or edit on the phone (same names as the website).
export const PLANT_FIELDS = [
  "scientific_name", "common_name", "family", "genus", "species",
  "height_cm", "width_cm", "morphological_notes",
] as const;

export const FIELD_LABELS: Record<string, string> = {
  scientific_name: "Scientific name",
  common_name: "Common name",
  family: "Family",
  genus: "Genus",
  species: "Species",
  height_cm: "Height (cm)",
  width_cm: "Width (cm)",
  morphological_notes: "Description",
  surrounding_environment: "Surrounding environment",
  latitude: "Latitude",
  longitude: "Longitude",
  conservation_status: "Conservation status",
  ecological_role: "Ecological role",
  medicinal_use: "Medicinal use",
  cultural_significance: "Cultural significance",
};

// Uploads one photo for a plant (POST /api/plants/:id/photos, field "photo", max 5 MB).
// Used by Register and by "Add photo" on Plant Details.
// The upload is done natively by expo-file-system (multipart), which is more
// reliable on Android than sending { uri } inside a JavaScript FormData.
export async function uploadPlantPhoto(plantId: number | string, uri: string) {
  const ext = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase();
  const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  let result: { status: number; body: string };
  try {
    result = await new File(uri).upload(`${API_URL}/api/plants/${plantId}/photos`, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: "photo",
      mimeType,
      headers: session.token ? { Authorization: `Bearer ${session.token}` } : {},
    });
  } catch (e: any) {
    throw new ApiError(0, `Upload failed: ${e?.message || "no connection to the server"}`);
  }

  let data: any = {};
  try { data = JSON.parse(result.body); } catch {}
  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(result.status, data.error || `Upload failed (${result.status})`);
  }
  return data;
}
