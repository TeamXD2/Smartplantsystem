import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Smartphone, Microscope, ShieldCheck, QrCode } from 'lucide-react';
import { fetchPublicPlants } from '../queries/plants';
import SpecimenCard from '../components/SpecimenCard';
import { useDocumentTitle } from '../hooks';

// How a plant gets from the forest to a visitor's phone. It is a real sequence,
// so it is laid out as one.
const STEPS = [
  { icon: Microscope, who: 'Botanists', text: 'Tag a plant in the field with the mobile app: photo, taxonomy and GPS position, all under a QR code.' },
  { icon: ShieldCheck, who: 'Conservation Officers', text: 'Review, verify and publish the record from the web dashboard, and decide how much of its location visitors may see.' },
  { icon: QrCode, who: 'Visitors', text: 'Scan the QR tag on the plant in the park, or search the catalog, to learn about the species on the spot.' },
];

export default function Home() {
  useDocumentTitle('');
  const [latest, setLatest] = useState([]);

  useEffect(() => {
    fetchPublicPlants({ limit: 4 }).then((d) => setLatest(d.plants)).catch(() => setLatest([]));
  }, []);

  return (
    <div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <h1 id="hero-title">RimbaTag</h1>
          <p className="hero-lead">Smart Ground-Truthing &amp; Digital Biodiversity System</p>
          <p className="hero-text">
            Verified plant species records from Niah National Park, maintained by Sarawak Forestry
            Corporation with NeuonAI. Field tagging, QR scanning and GPS capture happen in the
            companion mobile app; this web app is where records are reviewed, published and managed.
          </p>
          <div className="hero-actions">
            <Link to="/species" className="btn btn-primary btn-lg">Explore the species catalog <ArrowRight size={18} aria-hidden="true" /></Link>
            <button type="button" className="btn btn-outline-light btn-lg" disabled title="Mobile app coming soon">
              <Smartphone size={18} aria-hidden="true" /> Mobile app coming soon
            </button>
          </div>
        </div>
        <span className="hero-credit">Great Cave, Niah National Park</span>
      </section>

      <section className="container page home-flow" aria-labelledby="flow-title">
        <h2 id="flow-title" className="section-heading">From the forest to your phone</h2>
        <ol className="steps">
          {STEPS.map((s, i) => (
            <li key={s.who} className="step">
              <span className="step-num" aria-hidden="true">{i + 1}</span>
              <div>
                <h3><s.icon size={18} aria-hidden="true" /> {s.who}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {latest.length > 0 && (
        <section className="container page home-latest" aria-labelledby="latest-title">
          <div className="section-row">
            <h2 id="latest-title" className="section-heading">Recently published</h2>
            <Link to="/species" className="link-arrow">Browse all species <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <div className="grid grid-4">
            {latest.map((p) => <SpecimenCard key={p.qr_code} plant={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
