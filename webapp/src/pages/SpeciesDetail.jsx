import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Leaf, Link2, SearchX } from 'lucide-react';
import { fetchPublicPlant } from '../queries/plants';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../context/ToastContext';
import { useDocumentTitle } from '../hooks';

// Decimals arrive as strings ("50.00"); show them as plain numbers.
const cm = (value) => (value == null ? null : `${Number(value)} cm`);

export default function SpeciesDetail() {
  const { qrCode } = useParams();
  const toast = useToast();
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState(null);
  const [chosenPhoto, setChosenPhoto] = useState(null);
  useDocumentTitle(plant ? plant.common_name || plant.scientific_name : 'Species');

  useEffect(() => {
    setPlant(null);
    setChosenPhoto(null);
    setError(null);
    fetchPublicPlant(qrCode).then(setPlant).catch((err) => setError(err));
  }, [qrCode]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied. Anyone with it can open this species page.');
    } catch {
      toast.error('Could not copy the link. Copy it from the address bar instead.');
    }
  }

  if (error) {
    return (
      <div className="container page">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Species catalog', to: '/species' }, { label: 'Not found' }]} />
        <EmptyState
          icon={SearchX}
          title={error.status === 404 ? 'We could not find that species' : 'This page could not load'}
          action={<Link to="/species" className="btn btn-primary">Back to the catalog</Link>}
        >
          {error.status === 404 ? 'It may have been unpublished, or the QR code was not read correctly.' : error.message}
        </EmptyState>
      </div>
    );
  }

  if (!plant) {
    return (
      <div className="container page" aria-busy="true">
        <span className="sr-only" role="status">Loading species…</span>
        <Skeleton width={260} height={14} />
        <div className="detail-grid" style={{ marginTop: 24 }}>
          <Skeleton width="100%" height={380} radius={14} />
          <div><Skeleton width="55%" height={32} /><Skeleton width="35%" height={16} style={{ margin: '12px 0 24px' }} /><Skeleton width="100%" height={120} radius={12} /></div>
        </div>
      </div>
    );
  }

  const name = plant.common_name || plant.scientific_name;
  const facts = [
    ['Family', plant.family],
    ['Genus', plant.genus],
    ['Species', plant.species],
    ['Conservation status', plant.conservation_status],
    ['Height', cm(plant.height_cm)],
    ['Width', cm(plant.width_cm)],
  ].filter(([, value]) => value);

  const sections = [
    ['Appearance', plant.morphological_notes],
    ['Habitat', plant.surrounding_environment],
    ['Ecological role', plant.ecological_role],
    ['Medicinal use', plant.medicinal_use],
    ['Cultural significance', plant.cultural_significance],
  ].filter(([, value]) => value);

  const hasPoint = plant.latitude != null && plant.longitude != null;
  const photos = plant.photos || [];
  const photo = chosenPhoto || (photos[0] && photos[0].photo_url);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Species catalog', to: '/species' }, { label: name }]} />
      <div className="detail-grid">
        <div>
          <div className="specimen-photo detail-photo">
            {photo
              ? <img src={photo} alt={`${name}${plant.common_name ? ` (${plant.scientific_name})` : ''}`} className="specimen-img" />
              : <Leaf size={56} aria-hidden="true" />}
            <span className="id-tag specimen-id">{plant.qr_code}</span>
          </div>
          {photos.length > 1 && (
            <div className="photo-thumbs" role="group" aria-label="Photos">
              {photos.map((ph, i) => (
                <button key={ph.photo_id} type="button" aria-pressed={ph.photo_url === photo} aria-label={`Show photo ${i + 1} of ${photos.length}`} onClick={() => setChosenPhoto(ph.photo_url)}>
                  <img src={ph.photo_url} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="detail-title-row">
            <div>
              <h1 className="page-title">{name}</h1>
              {plant.common_name && <p className="specimen-sci detail-sci">{plant.scientific_name}</p>}
            </div>
            <button type="button" className="btn btn-outline btn-sm" onClick={copyLink}><Link2 size={15} aria-hidden="true" /> Copy link</button>
          </div>

          {facts.length > 0 && (
            <dl className="facts">
              {facts.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          )}

          {sections.map(([title, text]) => (
            <section key={title} className="detail-section">
              <h2>{title}</h2>
              <p>{text}</p>
            </section>
          ))}

          {hasPoint ? (
            <a className="btn btn-outline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${plant.latitude},${plant.longitude}`}>
              <MapPin size={16} aria-hidden="true" /> <span className="coord">{Number(plant.latitude)}, {Number(plant.longitude)}</span>
              <span className="sr-only"> (opens Google Maps in a new tab)</span>
            </a>
          ) : (
            plant.general_location && <p className="detail-location"><MapPin size={16} aria-hidden="true" /> {plant.general_location}</p>
          )}
        </div>
      </div>
    </div>
  );
}
