import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <header style={{ backgroundColor: '#0b0c0c', borderBottom: '5px solid #ffdd00' }}>
      <div className="mx-auto max-w-screen-xl px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="flex items-center gap-3 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded"
        >
          <span className="text-white text-xl font-bold tracking-tight">CASE COMPASS</span>
          <span
            className="text-xs font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: '#1d70b8', color: '#fff' }}
          >
            BETA
          </span>
        </Link>
        <nav className="flex gap-6 text-sm text-white">
          <Link
            to="/"
            className="underline underline-offset-4 decoration-2 focus:outline-none focus:ring-[3px] focus:ring-[#ffdd00] rounded px-1"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
