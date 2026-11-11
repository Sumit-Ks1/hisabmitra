import {
  ArrowUpRight,
  BedDouble,
  Building2,
  ChevronDown,
  FileText,
  IndianRupee,
  LayoutGrid,
  Plus,
  ReceiptIndianRupee,
  Settings,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { LogoMark } from "@/components/branding/logo";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Fictional sample data — internally consistent on purpose:          */
/*  48 tenants × ₹6,750 = ₹3,24,000 · 36 paid + 12 pending = 48        */
/*  42 occupied + 8 available = 50 beds                               */
/* ------------------------------------------------------------------ */

const METRICS = [
  { label: "Total Tenants", value: "48", note: "+3 this month", icon: Users, tone: "brand" },
  { label: "Occupied Beds", value: "42", note: "of 50 beds", icon: BedDouble, tone: "ink" },
  { label: "Available Beds", value: "8", note: "Ready to allocate", icon: BedDouble, tone: "success" },
  {
    label: "Monthly Rent Collection",
    value: "₹3,24,000",
    note: "₹2,43,000 received",
    icon: IndianRupee,
    tone: "warm",
  },
] as const;

const REVENUE = [
  { m: "Jun", v: 2.62 },
  { m: "Jul", v: 2.78 },
  { m: "Aug", v: 2.85 },
  { m: "Sep", v: 2.96 },
  { m: "Oct", v: 3.08 },
  { m: "Nov", v: 3.24 },
];

const PAYMENTS = [
  { name: "Priya M.", room: "R-102", amount: "₹7,000", status: "Paid" },
  { name: "Aman K.", room: "R-204", amount: "₹6,500", status: "Pending" },
  { name: "Rohit V.", room: "R-305", amount: "₹6,000", status: "Paid" },
] as const;

const ACTIVITY: { icon: LucideIcon; title: string; meta: string; time: string; tone: string }[] = [
  {
    icon: IndianRupee,
    title: "Rent received",
    meta: "₹7,000 · Priya M. · Room 102",
    time: "2m",
    tone: "bg-success-50 text-success-700",
  },
  {
    icon: UserPlus,
    title: "New tenant onboarded",
    meta: "Karan J. · Bed B · Room 304",
    time: "1h",
    tone: "bg-brand-50 text-brand-700",
  },
  {
    icon: BedDouble,
    title: "Room allocation updated",
    meta: "Room 202 · Bed C now vacant",
    time: "3h",
    tone: "bg-slate-100 text-slate-700",
  },
  {
    icon: Zap,
    title: "Electricity bill recorded",
    meta: "₹18,420 · October · Main meter",
    time: "1d",
    tone: "bg-warm-50 text-warm-800",
  },
];

/** 4 floors × 5 rooms. Floors 1–2: triple sharing, 3–4: double. `v` = vacant beds. */
const FLOORS = [
  { floor: "F1", rooms: [{ n: 101, c: 3, v: 0 }, { n: 102, c: 3, v: 0 }, { n: 103, c: 3, v: 1 }, { n: 104, c: 3, v: 0 }, { n: 105, c: 3, v: 1 }] },
  { floor: "F2", rooms: [{ n: 201, c: 3, v: 0 }, { n: 202, c: 3, v: 1 }, { n: 203, c: 3, v: 0 }, { n: 204, c: 3, v: 2 }, { n: 205, c: 3, v: 0 }] },
  { floor: "F3", rooms: [{ n: 301, c: 2, v: 0 }, { n: 302, c: 2, v: 0 }, { n: 303, c: 2, v: 1 }, { n: 304, c: 2, v: 0 }, { n: 305, c: 2, v: 0 }] },
  { floor: "F4", rooms: [{ n: 401, c: 2, v: 1 }, { n: 402, c: 2, v: 0 }, { n: 403, c: 2, v: 0 }, { n: 404, c: 2, v: 0 }, { n: 405, c: 2, v: 1 }] },
];

const NAV: { icon: LucideIcon; label: string; active?: boolean }[] = [
  { icon: LayoutGrid, label: "Overview", active: true },
  { icon: Users, label: "Tenants" },
  { icon: BedDouble, label: "Rooms & Beds" },
  { icon: ReceiptIndianRupee, label: "Rent" },
  { icon: Zap, label: "Electricity" },
  { icon: FileText, label: "Reports" },
];

const toneMap = {
  brand: "bg-brand-50 text-brand-700",
  ink: "bg-slate-100 text-slate-700",
  success: "bg-success-50 text-success-700",
  warm: "bg-warm-50 text-warm-800",
} as const;

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4", className)}>
      {children}
    </div>
  );
}

function CardTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[0.78rem] font-semibold text-ink">{children}</p>
      {aside}
    </div>
  );
}

function StatusPill({ status }: { status: "Paid" | "Pending" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.62rem] font-semibold",
        status === "Paid" ? "bg-success-50 text-success-700" : "bg-warm-50 text-warm-800",
      )}
    >
      <span
        className={cn("size-1 rounded-full", status === "Paid" ? "bg-success-500" : "bg-warm-400")}
      />
      {status}
    </span>
  );
}

export function DashboardPreview({ className }: { className?: string }) {
  // Chart axis runs ₹2.0L → ₹3.5L so the month-on-month trend is readable.
  const floor = 2;
  const max = 3.5;

  return (
    <figure className={cn("relative", className)}>
      {/* Visible honesty label */}
      <figcaption className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-[0.6rem] font-medium uppercase tracking-[0.14em] text-slate-500 shadow-soft sm:text-[0.65rem]">
        Illustrative product preview
        <span className="sr-only">
          {" "}
          — a mock-up of the planned HisabMitra owner dashboard using fictional sample data.
        </span>
      </figcaption>

      <div
        aria-hidden
        className="relative overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-white shadow-float ring-1 ring-slate-900/[0.03] sm:rounded-[1.5rem]"
      >
        {/* Window chrome */}
        <div className="flex h-10 items-center gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
          </div>
          <div className="mx-auto flex h-6 max-w-[16rem] flex-1 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[0.65rem] text-slate-400">
            <LogoMark className="size-3" />
            <span className="truncate">HisabMitra · Owner dashboard</span>
          </div>
          <span className="hidden font-mono text-[0.6rem] uppercase tracking-widest text-slate-400 sm:block">
            Sample data
          </span>
        </div>

        <div className="flex max-sm:max-h-[57rem] max-sm:overflow-hidden">
          {/* Sidebar */}
          <aside className="hidden w-52 shrink-0 flex-col border-r border-slate-200/80 bg-slate-50/50 p-3 lg:flex">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <LogoMark className="size-6" />
              <span className="text-[0.8rem] font-semibold text-ink">HisabMitra</span>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                <Building2 className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.7rem] font-semibold text-ink">Demo Residency</span>
                <span className="block text-[0.6rem] text-slate-500">Lucknow · 50 beds</span>
              </span>
              <ChevronDown className="size-3.5 text-slate-400" />
            </div>

            <nav className="mt-4 flex flex-col gap-0.5">
              {NAV.map(({ icon: Icon, label, active }) => (
                <span
                  key={label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.72rem] font-medium",
                    active ? "bg-white text-ink shadow-soft ring-1 ring-slate-200/80" : "text-slate-500",
                  )}
                >
                  <Icon className={cn("size-3.5", active && "text-brand-600")} />
                  {label}
                </span>
              ))}
            </nav>

            <div className="mt-auto space-y-2 pt-6">
              <div className="rounded-lg border border-dashed border-slate-300 p-2.5">
                <p className="text-[0.62rem] font-medium text-slate-500">Properties</p>
                <p className="mt-0.5 text-[0.72rem] font-semibold text-ink">3 PGs · 1 dashboard</p>
              </div>
              <span className="flex items-center gap-2.5 px-2.5 py-1.5 text-[0.72rem] font-medium text-slate-500">
                <Settings className="size-3.5" />
                Settings
              </span>
            </div>
          </aside>

          {/* Main */}
          <div className="min-w-0 flex-1 bg-canvas/60 p-3 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-medium text-slate-500">Demo Residency · November 2026</p>
                <p className="text-base font-semibold tracking-tight text-ink sm:text-lg">Overview</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[0.7rem] font-medium text-slate-600 sm:inline-flex">
                  Nov 2026 <ChevronDown className="size-3" />
                </span>
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ink px-3 text-[0.7rem] font-medium text-white">
                  <Plus className="size-3.5" /> Add tenant
                </span>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
              {METRICS.map(({ label, value, note, icon: Icon, tone }) => (
                <Card key={label} className="flex flex-col gap-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[0.66rem] font-medium leading-tight text-slate-500">{label}</p>
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", toneMap[tone])}>
                      <Icon className="size-3.5" />
                    </span>
                  </div>
                  <p className="text-lg font-semibold tracking-tight text-ink tabular-nums sm:text-[1.35rem]">
                    {value}
                  </p>
                  <p className="text-[0.62rem] font-medium text-slate-500">{note}</p>
                </Card>
              ))}
            </div>

            {/* Row 2 */}
            <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:gap-3 md:grid-cols-[1.55fr_1fr]">
              <Card className="flex flex-col">
                <CardTitle
                  aside={
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success-50 px-1.5 py-0.5 text-[0.6rem] font-semibold text-success-700">
                      <ArrowUpRight className="size-3" /> 5.2%
                    </span>
                  }
                >
                  Monthly rent collection
                </CardTitle>
                <div className="relative min-h-36 flex-1 sm:min-h-40">
                  {/* gridlines */}
                  <div className="absolute inset-0 flex flex-col justify-between pb-5">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="border-t border-dashed border-slate-200" />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
                    {REVENUE.map(({ m, v }, i) => {
                      const last = i === REVENUE.length - 1;
                      return (
                        <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                          <div className="relative flex w-full flex-1 items-end justify-center">
                            <div
                              className={cn(
                                "relative w-full max-w-9 origin-bottom rounded-t-md motion-safe:animate-grow-y",
                                last ? "bg-brand-500" : "bg-brand-200/70",
                              )}
                              style={{ height: `${((v - floor) / (max - floor)) * 100}%`, animationDelay: `${300 + i * 70}ms` }}
                            >
                              {last && (
                                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[0.58rem] font-semibold text-white">
                                  ₹3.24L
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={cn("text-[0.6rem] font-medium", last ? "text-ink" : "text-slate-400")}>
                            {m}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <Card>
                <CardTitle aside={<span className="text-[0.6rem] font-medium text-slate-400">Nov 2026</span>}>
                  Payment status
                </CardTitle>
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 42 42" className="size-20 shrink-0 -rotate-90 sm:size-[5.5rem]">
                    <circle cx="21" cy="21" r="15.915" fill="none" stroke="#FDEEC4" strokeWidth="5" />
                    <circle
                      cx="21"
                      cy="21"
                      r="15.915"
                      fill="none"
                      stroke="#16A36A"
                      strokeWidth="5"
                      strokeDasharray="75 25"
                      strokeLinecap="round"
                    />
                    <text
                      x="21"
                      y="21"
                      transform="rotate(90 21 21)"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-ink text-[0.5rem] font-semibold"
                    >
                      75%
                    </text>
                  </svg>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[0.68rem] text-slate-600">
                        <span className="size-2 rounded-sm bg-success-500" /> Paid
                      </span>
                      <span className="text-[0.72rem] font-semibold text-ink tabular-nums">36 tenants</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[0.68rem] text-slate-600">
                        <span className="size-2 rounded-sm bg-warm-400" /> Pending
                      </span>
                      <span className="text-[0.72rem] font-semibold text-ink tabular-nums">12 tenants</span>
                    </div>
                  </div>
                </div>
                <ul className="mt-3.5 divide-y divide-slate-100 border-t border-slate-100">
                  {PAYMENTS.map((p) => (
                    <li key={p.name} className="flex items-center gap-2 py-2 text-[0.66rem]">
                      <span className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-[0.55rem] font-semibold text-slate-600">
                        {p.name[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {p.name} <span className="font-normal text-slate-400">· {p.room}</span>
                      </span>
                      <span className="font-medium text-slate-600 tabular-nums">{p.amount}</span>
                      <StatusPill status={p.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* Row 3 */}
            <div className="mt-2.5 grid gap-2.5 sm:mt-3 sm:gap-3 md:grid-cols-[1.55fr_1fr]">
              <Card>
                <CardTitle
                  aside={
                    <span className="flex items-center gap-2.5 text-[0.6rem] font-medium text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-[3px] bg-brand-500" /> Occupied
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="size-2 rounded-[3px] border border-success-500 bg-success-50" /> Available
                      </span>
                    </span>
                  }
                >
                  Room occupancy
                </CardTitle>
                <div className="flex flex-col gap-1.5">
                  {FLOORS.map(({ floor, rooms }) => (
                    <div key={floor} className="flex items-center gap-2">
                      <span className="w-4 shrink-0 font-mono text-[0.58rem] text-slate-400">{floor}</span>
                      <div className="grid flex-1 grid-cols-5 gap-1.5">
                        {rooms.map((r) => (
                          <div
                            key={r.n}
                            className="flex flex-col gap-1 rounded-md border border-slate-200/80 bg-slate-50/60 px-1.5 py-1"
                          >
                            <span className="text-[0.55rem] font-medium text-slate-500 tabular-nums">{r.n}</span>
                            <span className="flex gap-0.5">
                              {Array.from({ length: r.c }, (_, b) => (
                                <span
                                  key={b}
                                  className={cn(
                                    "h-1.5 flex-1 rounded-[2px] sm:h-2",
                                    b < r.c - r.v ? "bg-brand-500" : "border border-success-500 bg-success-50",
                                  )}
                                />
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[0.65rem]">
                  <span className="text-slate-500">Occupancy</span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full w-[84%] rounded-full bg-brand-500" />
                    </span>
                    <span className="font-semibold text-ink tabular-nums">84%</span>
                  </span>
                </div>
              </Card>

              <Card>
                <CardTitle
                  aside={
                    <span className="flex items-center gap-1 text-[0.6rem] font-medium text-slate-400">
                      <span className="size-1.5 rounded-full bg-success-500 motion-safe:animate-pulse-dot" />
                      Live
                    </span>
                  }
                >
                  Recent activity
                </CardTitle>
                <ul className="flex flex-col gap-3">
                  {ACTIVITY.map(({ icon: Icon, title, meta, time, tone }) => (
                    <li key={title} className="flex items-start gap-2.5">
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tone)}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.7rem] font-semibold text-ink">{title}</span>
                        <span className="block truncate text-[0.62rem] text-slate-500">{meta}</span>
                      </span>
                      <span className="shrink-0 text-[0.58rem] text-slate-400 tabular-nums">{time}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </div>

        {/* Mobile fade-out so the long mock-up ends gracefully */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-white via-white/80 to-transparent sm:hidden" />
      </div>
    </figure>
  );
}
