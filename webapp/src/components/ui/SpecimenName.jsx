// How a plant is named everywhere in the app: common name, scientific name in
// italics, and its QR code ID as a small tag (like the label on the plant itself).
export default function SpecimenName({ common, scientific, qr, size = 'md' }) {
  return (
    <div className={`specimen-name specimen-name-${size}`}>
      <div className="sn-main">{common || scientific}</div>
      {common && <div className="sn-sci">{scientific}</div>}
      {qr && <span className="id-tag">{qr}</span>}
    </div>
  );
}
