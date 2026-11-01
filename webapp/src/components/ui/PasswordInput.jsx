import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// A password box with a show/hide button. Field passes id and aria-* props to it,
// and they land on the real <input> so the label is attached to the right element.
export default function PasswordInput({ className = 'input', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="password-wrap">
      <input {...props} className={className} type={show ? 'text' : 'password'} />
      <button type="button" className="password-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
