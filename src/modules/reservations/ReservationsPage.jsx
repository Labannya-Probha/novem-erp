/* ------------------------------------------------------------------ */
/*  RESERVATIONS PAGE — AEDS v2 unified module page                    */
/* ------------------------------------------------------------------ */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import Breadcrumb from '../../components/layout/Breadcrumb'
import ModuleTabs from '../../components/layout/ModuleTabs'
import { Button } from '../../components/ui/button'
import { PATHS } from '../../app/paths'
import { can } from '../../lib/roles'
import { useReservationTabs } from './hooks/useReservationTabs'
import { useReservationsList } from './hooks/useReservationsList'
import { useReservationPayments } from './hooks/useReservationPayments'
import ReservationKpiStrip from './components/ReservationKpiStrip'
import ReservationsListTab from './tabs/ReservationsListTab'
import BookingCalendarTab from './tabs/BookingCalendarTab'
import AvailabilityTab from './tabs/AvailabilityTab'
import NewReservationTab from './tabs/NewReservationTab'
import ReservationPaymentsTab from './tabs/ReservationPaymentsTab'
import GuestCrmTab from './tabs/GuestCrmTab'
import QuotationsTab from './tabs/QuotationsTab'
import ReservationHistoryTab from './tabs/ReservationHistoryTab'
import ReservationReportsTab from './tabs/ReservationReportsTab'
import { getVisibleReservationTabs } from './reservations.config'

export default function ReservationsPage({
  openReservation,
  startReservation,
  userName,
  isAdmin,
  role,
  privileges,
}) {
  const navigate = useNavigate()
  const visibleTabs = useMemo(
    () => getVisibleReservationTabs({ role, isAdmin, privileges }),
    [isAdmin, privileges, role],
  )
  const { summary: reservationSummary } = useReservationsList()
  const { summary: paymentSummary } = useReservationPayments()
  const { activeTab, setActiveTab } = useReservationTabs({ visibleTabs })

  const tabs = useMemo(() => visibleTabs.map((tab) => {
    if (tab.id === 'list') return { ...tab, badge: reservationSummary.total ?? undefined }
    if (tab.id === 'payments') return { ...tab, badge: paymentSummary.total ?? undefined }
    return tab
  }), [paymentSummary.total, reservationSummary.total, visibleTabs])

  const tabContent = useMemo(() => {
    if (activeTab === 'calendar') {
      return (
        <BookingCalendarTab
          openReservation={openReservation}
          onNewReservation={startReservation}
        />
      )
    }

    if (activeTab === 'availability') {
      return <AvailabilityTab onCreateReservation={startReservation} />
    }

    if (activeTab === 'new') {
      return <NewReservationTab openReservation={openReservation} userName={userName} />
    }

    if (activeTab === 'payments') {
      return <ReservationPaymentsTab userName={userName} isAdmin={isAdmin} />
    }

    if (activeTab === 'guest-crm') {
      return <GuestCrmTab userName={userName} isAdmin={isAdmin} role={role} />
    }

    if (activeTab === 'quotations') {
      return <QuotationsTab onCreateReservation={startReservation} />
    }

    if (activeTab === 'history') {
      return <ReservationHistoryTab />
    }

    if (activeTab === 'reports') {
      return (
        <ReservationReportsTab
          canOpenReportsCenter={can(role, 'reports', privileges)}
          onOpenReportsCenter={() => navigate(PATHS.REPORTS)}
        />
      )
    }

    return <ReservationsListTab openReservation={openReservation} userName={userName} />
  }, [activeTab, isAdmin, navigate, openReservation, privileges, role, startReservation, userName])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reservations"
        subtitle="Unified AEDS v2 shell for reservations, calendar, payments, guest CRM and migration-safe placeholders."
        breadcrumb={<Breadcrumb items={[{ label: 'Modules' }, { label: 'Reservations', current: true }]} />}
        actions={visibleTabs.some((tab) => tab.id === 'new') ? (
          <Button onClick={() => setActiveTab('new')}>New Reservation</Button>
        ) : null}
        kpiStrip={<ReservationKpiStrip />}
        tabs={<ModuleTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />}
      />

      <section id={`module-tab-panel-${activeTab}`} role="tabpanel" aria-labelledby={`module-tab-${activeTab}`}>
        {tabContent}
      </section>
    </div>
  )
}
