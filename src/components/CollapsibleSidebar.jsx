import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  DoorOpen,
  Receipt,
  Users,
  BookOpen,
  Settings,
  ChevronRight,
  TrendingUp,
  List,
  Plus,
  DoorClosed,
  Moon,
  FileText,
  CreditCard,
  RefreshCw,
  User,
  Building2,
  Wallet,
  ArrowLeftRight,
  SlidersHorizontal,
  Percent,
  UserPlus,
  LogOut,
} from "lucide-react";

const NAV_SECTIONS = [
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    children: [
      { id: "overview", icon: TrendingUp, label: "Overview", path: "/" },
    ],
  },
  {
    id: "reservations",
    icon: CalendarDays,
    label: "Reservations",
    children: [
      { id: "booking-cal", icon: CalendarDays, label: "Booking Calendar", path: "/booking-calendar" },
      { id: "res-list", icon: List, label: "All Reservations", path: "/reservations" },
      { id: "new-res", icon: Plus, label: "New Reservation", path: "/new-reservation" },
    ],
  },
  {
    id: "frontdesk",
    icon: DoorOpen,
    label: "Front Desk",
    children: [
      { id: "checkin", icon: DoorOpen, label: "Check-In", path: "/check-in" },
      { id: "checkout", icon: DoorClosed, label: "Check-Out", path: "/check-out" },
      { id: "night-audit", icon: Moon, label: "Night Audit", path: "/night-audit" },
    ],
  },
  {
    id: "billing",
    icon: Receipt,
    label: "Billing",
    children: [
      { id: "invoices", icon: FileText, label: "Invoices", path: "/billing" },
      { id: "payments", icon: CreditCard, label: "Payments", path: "/payments" },
      { id: "refunds", icon: RefreshCw, label: "Refunds", path: "/refunds" },
    ],
  },
  {
    id: "crm",
    icon: Users,
    label: "Guest CRM",
    children: [
      { id: "guests", icon: User, label: "Guest Profiles", path: "/crm" },
      { id: "partners", icon: Building2, label: "Agencies & Partners", path: "/partners" },
    ],
  },
  {
    id: "accounting",
    icon: BookOpen,
    label: "Accounting",
    children: [
      { id: "vouchers", icon: FileText, label: "Vouchers", path: "/accounting" },
      { id: "chart-of-accounts", icon: Wallet, label: "Chart of Accounts", path: "/accounts" },
      { id: "tx-mapping", icon: ArrowLeftRight, label: "Transaction Mapping", path: "/tx-mapping" },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    children: [
      { id: "general", icon: SlidersHorizontal, label: "General", path: "/settings" },
      { id: "tax", icon: Percent, label: "Tax Policy", path: "/settings?tab=tax" },
      { id: "staff", icon: UserPlus, label: "Staff & Roles", path: "/settings?tab=staff" },
    ],
  },
];

export default function CollapsibleSidebar({ user, tenant, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine which section contains the current path — open it by default
  const defaultOpen = NAV_SECTIONS
    .filter((s) => s.children.some((c) => location.pathname === c.path))
    .map((s) => s.id);

  const [openSections, setOpenSections] = useState(
    new Set(defaultOpen.length ? defaultOpen : ["reservations"])
  );

  const toggle = (id) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 border-r border-white/5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-medium shrink-0">
          A
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-white/90 leading-tight truncate">
            Aura Stay ERP
          </span>
          <span className="text-[11px] text-white/40 mt-0.5 truncate">
            {tenant?.name ?? "Novem Eco Resort"}
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-white/10">
        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          const SectionIcon = section.icon;

          return (
            <div key={section.id}>
              {/* Section trigger */}
              <button
                onClick={() => toggle(section.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-white/70 hover:bg-white/5 hover:text-white/90 transition-colors"
              >
                <SectionIcon className="h-[15px] w-[15px] shrink-0 text-white/40" />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronRight
                  className={`h-3 w-3 shrink-0 text-white/30 transition-transform duration-200 ${
                    isOpen ? "rotate-90" : ""
                  }`}
                />
              </button>

              {/* Children — CSS-only height transition, no Radix needed */}
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <ul className="ml-[9px] border-l border-white/[0.06] pl-3.5 py-0.5 flex flex-col gap-0.5">
                  {section.children.map((child) => {
                    const ChildIcon = child.icon;
                    const active = isActive(child.path);

                    return (
                      <li key={child.id}>
                        <button
                          onClick={() => navigate(child.path)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                            active
                              ? "bg-indigo-600/20 text-indigo-400 font-medium"
                              : "text-white/50 hover:bg-white/5 hover:text-white/80"
                          }`}
                        >
                          <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                          <span className="flex-1 text-left">{child.label}</span>
                          {child.badge && (
                            <span className="rounded-full bg-indigo-600/25 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 leading-none">
                              {child.badge}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer / User ── */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-t border-white/5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 text-[11px] font-medium shrink-0">
          {user?.initials ?? "AD"}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="text-xs text-white/80 leading-tight truncate">
            {user?.name ?? "Ankur Dutta"}
          </span>
          <span className="text-[10.5px] text-white/35 mt-0.5">
            {user?.role ?? "Manager · Admin"}
          </span>
        </div>
        {onSignOut && (
          <button
            onClick={onSignOut}
            className="p-1 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
