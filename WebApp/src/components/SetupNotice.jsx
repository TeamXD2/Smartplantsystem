// Shown instead of the app when Supabase hasn't been configured yet, so a
// missing .env file produces a clear message instead of a blank page.
export default function SetupNotice() {
  return (
    <div className="page-narrow">
      <h1 style={{ fontSize: '1.3rem' }}>Supabase isn't configured yet</h1>
      <p>This app needs your Supabase project's URL and publishable key to run.</p>
      <ol style={{ color: 'var(--ink-600)', lineHeight: 1.7 }}>
        <li>Copy <code>.env.example</code> to <code>.env</code> in the project root.</li>
        <li>
          Fill in <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> - find both
          in your Supabase project's <strong>Connect</strong> dialog, or under <strong>Settings &rarr; API Keys</strong>.
        </li>
        <li>Restart the dev server (<code>npm run dev</code>).</li>
      </ol>
    </div>
  );
}
