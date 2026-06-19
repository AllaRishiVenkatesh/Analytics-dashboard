export default function Loader({ label = 'Loading' }) {
  return (
    <div className="loader">
      <span className="loader-spinner" />
      <span>{label}…</span>
    </div>
  );
}
