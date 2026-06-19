export default function StatusDot({ active }) {
  return (
    <span
      className={`status-dot${active ? ' status-dot--live' : ''}`}
      title={active ? 'Active in the last 5 minutes' : 'Idle'}
    />
  );
}
