import { Link, NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  const navCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium px-4 py-2 rounded-xl transition-all duration-200 ${
      isActive
        ? "bg-brand-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]"
        : "text-slate-300 hover:text-white hover:bg-slate-800/50"
    }`;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0a0f1c]">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-700/50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-slate-100 text-xl tracking-tight hover:text-brand-400 transition-colors">
            <svg className="w-7 h-7 text-brand-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zM18 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
            </svg>
            ELD Planner
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={navCls}>
              New Trip
            </NavLink>
            <NavLink to="/trips" className={navCls}>
              Trip History
            </NavLink>
            <div className="w-px h-6 bg-slate-700 mx-2"></div>
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0 cursor-pointer hover:bg-brand-500/30 transition-colors">
                JS
              </div>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full relative z-10 flex flex-col">
        <Outlet />
      </main>

      <footer className="py-6 mt-auto text-center text-xs text-slate-500/70 border-t border-slate-700/30 glass-panel relative z-20">
        ELD Trip Planner · FMCSA 70 hr / 8 day rules · OSRM + Nominatim
      </footer>
    </div>
  );
}
