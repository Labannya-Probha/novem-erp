/* ------------------------------------------------------------------ */
/*  FRONT OFFICE PAGE — AEDS v2 unified module page                   */
/* ------------------------------------------------------------------ */
import PageHeader from '../../components/layout/PageHeader'
import ModuleTabs from '../../components/layout/ModuleTabs'
import { useFrontOfficeTabs } from './hooks/useFrontOfficeTabs'
import { FRONT_OFFICE_TABS } from './frontOffice.config'
import InHouseGuestsTab from './tabs/InHouseGuestsTab'
import RoomBoardTab from './tabs/RoomBoardTab'
import ServiceBillsTab from './tabs/ServiceBillsTab'
import NightAuditTab from './tabs/NightAuditTab'

export default function FrontOfficePage({
  openReservation,
  userName,
  role,
  isAdmin,
  company,
}) {
  const { activeTab, setActiveTab } = useFrontOfficeTabs()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Front Office"
        breadcrumb={[{ label: 'Front Office', current: true }]}
        tabs={
          <ModuleTabs
            tabs={FRONT_OFFICE_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        }
      />

      <div
        id={`module-tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`module-tab-${activeTab}`}
      >
        {activeTab === 'in-house' && (
          <InHouseGuestsTab
            openReservation={openReservation}
            userName={userName}
            role={role}
            isAdmin={isAdmin}
            company={company}
          />
        )}
        {activeTab === 'room-board' && (
          <RoomBoardTab
            openReservation={openReservation}
            userName={userName}
            role={role}
            isAdmin={isAdmin}
            company={company}
          />
        )}
        {activeTab === 'service-bills' && (
          <ServiceBillsTab userName={userName} isAdmin={isAdmin} />
        )}
        {activeTab === 'night-audit' && (
          <NightAuditTab userName={userName} isAdmin={isAdmin} role={role} />
        )}
      </div>
    </div>
  )
}
