// Prism — App shell. Brand, view switch (Advisor ↔ Client), account chip, drawer.

const Topbar = ({ onOpenNumbers }) => {
  const { view, setView } = useView();
  return (
    <header className="px-topbar">
      <div className="px-brand">
        <div className="px-brand-mark"><Icons.Prism size={15} /></div>
        <div>
          <div className="px-brand-name">Prism</div>
          <div className="px-brand-sub">Advisor Workspace</div>
        </div>
      </div>

      <div className="px-viewswitch" role="tablist" aria-label="View">
        <button
          className={view === 'advisor' ? 'is-on' : ''}
          onClick={() => setView('advisor')}
          role="tab" aria-selected={view === 'advisor'}>
          <Icons.TableCol size={13} /> Advisor
        </button>
        <button
          className={view === 'client' ? 'is-on' : ''}
          onClick={() => setView('client')}
          role="tab" aria-selected={view === 'client'}>
          <Icons.Layers size={13} /> Client
        </button>
      </div>

      <div className="px-topright">
        {view === 'client' && (
          <button className="px-btn px-btn-sm px-btn-ghost" onClick={onOpenNumbers}>
            <Icons.Calculator size={12} /> Your numbers
          </button>
        )}
        <button className="px-icon-btn" title="Notifications">
          <Icons.Bell size={14} />
        </button>
        <div className="px-account-chip" title={advisor.email}>
          <div className="px-account-avatar">{advisor.initials}</div>
          <div className="px-account-meta">
            <div className="px-account-name">{view === 'client' ? 'Robert Marsh' : advisor.name}</div>
            <div className="px-account-firm">{view === 'client' ? 'Client view' : advisor.firm}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

function AppInner() {
  const { view } = useView();
  const [isNumbersOpen, setIsNumbersOpen] = React.useState(false);

  return (
    <div className="px-app">
      <Topbar onOpenNumbers={() => setIsNumbersOpen(true)} />
      {view === 'advisor' ? <AdvisorDashboard /> : <ClientPortal onOpenNumbers={() => setIsNumbersOpen(true)} />}
      <NumbersDrawer isOpen={isNumbersOpen} onClose={() => setIsNumbersOpen(false)} />
      <Toast />
    </div>
  );
}

function App() {
  return (
    <ViewProvider>
      <ProfileProvider>
        <TaskProvider>
          <AppInner />
        </TaskProvider>
      </ProfileProvider>
    </ViewProvider>
  );
}

window.App = App;
