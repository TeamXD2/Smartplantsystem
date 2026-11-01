// IoT monitoring (Conservation Officer / Admin). The ESP32 boards send readings
// to the backend themselves; the web app only reads them.
import { api } from '../api';

export function fetchSensors() {
  return api('/api/iot/sensors');
}

// changes: { name, latitude, longitude, location_note, plant_id }
export function updateSensor(id, changes) {
  return api(`/api/iot/sensors/${id}`, { method: 'PATCH', body: changes });
}

export function fetchReadings(sensorId, hours = 24) {
  return api('/api/iot/readings', { params: { sensor_id: sensorId, hours } });
}

export function fetchAlerts({ status = 'open', page = 1, limit = 20 } = {}) {
  return api('/api/iot/alerts', { params: { status, page, limit } });
}

export function acknowledgeAlert(id) {
  return api(`/api/iot/alerts/${id}/acknowledge`, { method: 'PATCH' });
}
