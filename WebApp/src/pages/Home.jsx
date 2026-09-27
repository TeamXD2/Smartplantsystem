import { Link } from 'react-router-dom';
import { Smartphone, Sprout, Microscope, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <div className="hero">
        <div className="container">
          <div className="hero-eyebrow">Niah National Park · Field Records</div>
          <h1>Smart Ground-Truthing &amp; Digital Biodiversity System</h1>
          <p>
            Verified plant species records from Niah National Park, maintained by Sarawak Forestry
            Corporation with NeuonAI. Field tagging, QR scanning and GPS capture happen in the
            companion mobile app; this web app is where records are reviewed, published and managed.
          </p>
          <div className="hero-actions">
            <Link to="/species" className="btn btn-primary">Explore Species Catalog</Link>
            <button className="btn btn-outline-light" disabled title="Mobile app coming soon">
              <Smartphone size={17} /> Get the mobile app
            </button>
          </div>
        </div>
      </div>

      <div className="container page">
        <div className="grid grid-3">
          <div className="feature">
            <h3><Sprout size={19} /> For Visitors</h3>
            <p>Scan QR tags on plants in the park with the mobile app to learn about each species on the spot.</p>
          </div>
          <div className="feature">
            <h3><Microscope size={19} /> For Botanists</h3>
            <p>Log in to submit new field observations with photos, taxonomy and GPS coordinates.</p>
          </div>
          <div className="feature">
            <h3><ShieldCheck size={19} /> For Conservation Officers</h3>
            <p>Review, verify and publish submitted species records from the web dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
