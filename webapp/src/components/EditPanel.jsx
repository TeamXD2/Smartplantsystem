import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { isExternalBotanist } from '../roles';
import { fetchPlant, updatePlant, uploadPhoto } from '../queries/plants';
import { submitRequest } from '../queries/requests';
import PlantForm from './PlantForm';
import { SkeletonBlock } from './ui/Skeleton';

// Loads the full record, then edits it the way the user's role allows:
//   Internal Botanist / Officer / Admin -> saved straight away (PATCH).
//   External Botanist                   -> an EDIT request for an Officer to review.
// A photo is uploaded immediately in both cases.
export default function EditPanel({ plantId, onDone, onDirtyChange }) {
  const { user } = useAuth();
  const external = isExternalBotanist(user);
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPlant(plantId).then(setPlant).catch((err) => setError(err.message));
  }, [plantId]);

  async function save(changes, imageFile) {
    const hasChanges = Object.keys(changes).length > 0;
    if (hasChanges) {
      if (external) {
        await submitRequest({ plantId, type: 'EDIT', proposedChanges: changes });
      } else {
        await updatePlant(plantId, changes);
      }
    }
    const parts = [];
    if (hasChanges) {
      parts.push(external ? 'Edit request sent. An Officer will review it.' : 'Changes saved.');
    }
    if (imageFile) {
      try {
        await uploadPhoto(plantId, imageFile);
        parts.push('Photo added.');
      } catch (err) {
        parts.push(`The photo could not be uploaded: ${err.message}`);
      }
    }
    onDone(parts.join(' '));
  }

  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!plant) return <SkeletonBlock height={240} />;

  return (
    <div>
      {external && (
        <div className="alert alert-warning">
          External Botanists can't change records directly: your changes are sent to an Officer as an edit request.
        </div>
      )}
      <PlantForm
        mode="edit"
        initial={plant}
        submitLabel={external ? 'Send edit request' : 'Save changes'}
        onSubmit={save}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}
