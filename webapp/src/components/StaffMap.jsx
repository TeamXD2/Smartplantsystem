import { useEffect, useState } from 'react';
import PlantMap from './PlantMap';
import { fetchPlants, fetchAllPages } from '../queries/plants';
import { fetchSensors } from '../queries/iot';

// Distribution map for staff: every plant with GPS (exact position, whatever the
// public visibility setting) plus the IoT sensors.
export default function StaffMap() {
  const [plants, setPlants] = useState([]);
  const [sensors, setSensors] = useState([]);
  const [show, setShow] = useState({ published: true, research: true, sensor: true });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAllPages(fetchPlants).then(setPlants).catch((err) => setError(err.message));
    fetchSensors().then((d) => setSensors(d.sensors)).catch(() => setSensors([])); // IoT tables may not exist yet
  }, []);

  const points = [
    ...plants.map((p) => ({
      id: `p${p.plant_id}`,
      lat: p.latitude == null ? NaN : Number(p.latitude),
      lng: p.longitude == null ? NaN : Number(p.longitude),
      title: p.common_name || p.scientific_name,
      subtitle: `${p.scientific_name} · ${p.publication_status}`,
      kind: p.publication_status === 'Published' ? 'published' : 'research',
    })),
    ...sensors.map((s) => ({
      id: `s${s.sensor_id}`,
      lat: s.latitude == null ? NaN : Number(s.latitude),
      lng: s.longitude == null ? NaN : Number(s.longitude),
      title: s.name || s.device_code,
      subtitle: `IoT sensor ${s.device_code}`,
      kind: 'sensor',
    })),
  ].filter((p) => show[p.kind]);

  const withGps = plants.filter((p) => p.latitude != null).length;
  const legend = [
    ['published', 'Published plants'],
    ['research', 'Under Research'],
    ['sensor', 'IoT sensors'],
  ];

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="map-legend">
        {legend.map(([kind, label]) => (
          <label key={kind} className={`legend-chip ${show[kind] ? 'on' : ''}`}>
            <input type="checkbox" checked={show[kind]} onChange={() => setShow((s) => ({ ...s, [kind]: !s[kind] }))} />
            <span className={`legend-dot ${kind}`} /> {label}
          </label>
        ))}
        <span className="muted map-count">{withGps} of {plants.length} plants have GPS</span>
      </div>
      <PlantMap points={points} />
    </div>
  );
}
