/**
 * Dashboard Layout Component
 */

interface DashboardLayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  tabs: React.ReactNode;
  main: React.ReactNode;
}

export function DashboardLayout({
  header,
  sidebar,
  tabs,
  main,
}: DashboardLayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="flex-shrink-0">{header}</div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="flex-shrink-0 w-80">{sidebar}</div>

        {/* Content area with tabs */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="flex-shrink-0">{tabs}</div>

          {/* Main content */}
          <div className="flex-1 overflow-auto">{main}</div>
        </div>
      </div>
    </div>
  );
}
