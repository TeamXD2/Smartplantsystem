import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';

// A published species in the public catalog and on the home page.
export default function SpecimenCard({ plant }) {
  const name = plant.common_name || plant.scientific_name;
  return (
    <Link to={`/species/${encodeURIComponent(plant.qr_code)}`} className="specimen-card">
      <div className="specimen-photo">
        {plant.cover_photo_url
          ? <img src={plant.cover_photo_url} alt="" className="specimen-img" loading="lazy" />
          : <Leaf size={34} aria-hidden="true" />}
        <span className="id-tag specimen-id">{plant.qr_code}</span>
      </div>
      <div className="specimen-body">
        <div className="specimen-common">{name}</div>
        {plant.common_name && <div className="specimen-sci">{plant.scientific_name}</div>}
        {(plant.family || plant.general_location) && (
          <div className="specimen-meta">{[plant.family, plant.general_location].filter(Boolean).join(' · ')}</div>
        )}
      </div>
    </Link>
  );
}
