export function Spinner({ size = 24 }) {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <div className="spinner-ring" />
    </div>
  );
}

export function SkeletonLine({ width = '100%' }) {
  return <div className="skeleton-line" style={{ width }} />;
}

export function SkeletonBlock({ lines = 3 }) {
  return (
    <div className="skeleton-block">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="loader-container">
      <Spinner size={32} />
      <p className="loader-text">{text}</p>
    </div>
  );
}
