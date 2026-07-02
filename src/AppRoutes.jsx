/* ------------------------------------------------------------------ */
/*  APP ROUTES                                                          */
/* ------------------------------------------------------------------ */
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { isModuleEnabled } from './lib/saasModules'
import { firstAccessiblePath } from './app/navigation/helpers'
import { PATHS } from './app/paths'
import { SaasModuleFrame } from './components/saas/SaasModuleFrame.jsx'
import {
  SaasModuleRoute,
  TenantReportsRedirect,
  ReservationModuleRoute,
  FrontOfficeReservationRoute,
} from './routeGuards.jsx'

import Dashboard from './pages/Dashboard.jsx'
import FrontOfficePage from './modules/front-office/FrontOfficePage.jsx'
import ReservationsPage from './modules/reservations/ReservationsPage.jsx'
import HousekeepingHub from './pages/HousekeepingHub.jsx'
import { GuestPosKiosk } from './pages/RestaurantPOS.jsx'
import VerifyBill from './pages/VerifyBill.jsx'
import Facilities from './pages/ServiceBills.jsx'
import InventoryPage from './modules/inventory/InventoryPage.jsx'
import VatCenter from './pages/VatCenter.jsx'
import VATReturn from './pages/VATReturn'
import {
  VoucherEntryPage,
  TrialBalancePage,
  ChartOfAccountsPage,
  FixedAssetsPage,
  OpeningBalancePage,
  TransactionMappingPage,
  VendorPaymentPage,
} from './pages/AccountingHub.jsx'
import {
  HrEmployeeEntryPage,
  HrServiceBookPage,
  HrNomineePage,
  HrLeaveEntryPage,
  HrCompLeavePage,
  HrFestivalLeavePage,
  HrPayrollConfigPage,
  HrPayrollGenPage,
  HrPayrollRegisterPage,
  HrLetterPage,
  HrAttendanceRegisterPage,
  HrEmployeeRegisterPage,
  HrServiceBookRegPage,
  HrIncidentsPage,
  HrCompliancePage,
} from './pages/HrOffice.jsx'
import NightAudit from './pages/NightAudit.jsx'
import ReportsCenterPage from './modules/reports/ReportsCenterPage.jsx'
import Settings from './pages/Settings.jsx'
import MasterDataPage from './modules/master-data/MasterDataPage.jsx'
import TaskManagement from './pages/TaskManagement.jsx'
import TasksPage from './modules/tasks/TasksPage.jsx'
import RestaurantPage from './modules/restaurant/RestaurantPage.jsx'
import PosPrintCenter from './pages/PosPrintCenter.jsx'
import { RESERVATION_TABS, DEFAULT_RESERVATION_TAB } from './modules/reservations/reservations.config'
import { DEFAULT_MASTER_DATA_TAB, MASTER_DATA_LEGACY_TAB_MAP } from './modules/master-data/masterData.config'

const RESERVATION_NAV_BY_TAB = {
  list: 'reservations',
  payments: 'reservations',
  calendar: 'calendar',
  crm: 'crm',
}

const VALID_RESERVATION_TABS = new Set(RESERVATION_TABS.map((tab) => tab.id))

function CmsLegacyRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const legacyEntity = params.get('entity')
  const tab = MASTER_DATA_LEGACY_TAB_MAP[legacyEntity] || DEFAULT_MASTER_DATA_TAB
  const nextParams = new URLSearchParams()
  nextParams.set('tab', tab)
  if (legacyEntity === 'agencies' || legacyEntity === 'shareholders') {
    nextParams.set('entity', legacyEntity)
  }
  return <Navigate to={`${PATHS.MASTER_DATA}?${nextParams.toString()}`} replace />
}

export default function AppRoutes({
  role, isAdmin, userName, userId, company, privileges, modulesEnabled, loadCompany,
  openReservation, openFrontOfficeReservation, startReservation, navigate,
}) {
  const location = useLocation()
  const reservationTab = new URLSearchParams(location.search).get('tab')
  const safeReservationTab = VALID_RESERVATION_TABS.has(reservationTab)
    ? reservationTab
    : DEFAULT_RESERVATION_TAB
  const reservationNavId = RESERVATION_NAV_BY_TAB[safeReservationTab]

  return (
    <Routes>
      <Route path={PATHS.ROOT} element={<Navigate to={PATHS.FRONT_OFFICE} replace />} />

      {/* Front Office — unified AEDS v2 module page */}
      <Route path={PATHS.FRONT_OFFICE} element={
        <SaasModuleRoute moduleId="frontoffice" role={role} navId="dashboard" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <FrontOfficePage openReservation={openFrontOfficeReservation} userName={userName} role={role} isAdmin={isAdmin} company={company} privileges={privileges} />
        </SaasModuleRoute>
      } />

      {/* Dashboard / frontoffice legacy routes */}
      <Route path={PATHS.DASHBOARD} element={<Navigate to={PATHS.FRONT_OFFICE} replace />} />
      <Route path={PATHS.FRONTOFFICE} element={
        <SaasModuleRoute moduleId="frontoffice" role={role} navId="dashboard" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <Dashboard openReservation={openFrontOfficeReservation} userName={userName} role={role} isAdmin={isAdmin} company={company} />
        </SaasModuleRoute>
      } />

      {/* Reservations — unified tab page */}
      <Route path={PATHS.RESERVATIONS} element={
        <SaasModuleRoute moduleId="reservations" role={role} navId={reservationNavId} privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <ReservationsPage
            openReservation={openReservation}
            startReservation={startReservation}
            userName={userName}
            isAdmin={isAdmin}
            role={role}
          />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.RESERVATION_DETAIL} element={
        <SaasModuleRoute moduleId="reservations" role={role} navId="reservations" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <ReservationModuleRoute userName={userName} role={role} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.FRONTOFFICE_RESERVATION_DETAIL} element={
        <SaasModuleRoute moduleId="frontoffice" role={role} navId="dashboard" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <FrontOfficeReservationRoute userName={userName} role={role} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />

      {/* Legacy routes — redirect to unified tab page for backward compatibility */}
      <Route path={PATHS.RESERVATION_PAYMENTS} element={<Navigate to={`${PATHS.RESERVATIONS}?tab=payments`} replace />} />
      <Route path={PATHS.CRM} element={<Navigate to={`${PATHS.RESERVATIONS}?tab=crm`} replace />} />
      <Route path={PATHS.CALENDAR} element={<Navigate to={`${PATHS.RESERVATIONS}?tab=calendar`} replace />} />

      {/* Front Office */}
      <Route path={PATHS.NIGHTAUDIT} element={
        <SaasModuleRoute moduleId="nightaudit" role={role} navId="nightaudit" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <NightAudit userName={userName} isAdmin={isAdmin} role={role} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.HOUSEKEEPING} element={
        <SaasModuleRoute moduleId="housekeeping" role={role} navId="housekeeping" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <HousekeepingHub userName={userName} role={role} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.FACILITIES} element={
        <SaasModuleRoute moduleId="facilities" role={role} navId="facilities" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <Facilities userName={userName} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />

      {/* Restaurant */}
      <Route path={PATHS.RESTAURANT} element={
        <SaasModuleRoute moduleId="pos" role={role} navId="pos" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <RestaurantPage userName={userName} role={role} isAdmin={isAdmin} modulesEnabled={modulesEnabled} company={company} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.POS} element={
        <SaasModuleRoute moduleId="pos" role={role} navId="pos" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <Navigate to={`${PATHS.RESTAURANT}?tab=pos`} replace />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.POS_PRINT_CENTER} element={
        <SaasModuleRoute moduleId="pos" role={role} navId="pos" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <PosPrintCenter company={company} userName={userName} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.GUEST_KIOSK} element={<GuestPosKiosk />} />
      <Route path={PATHS.VERIFY_BILL} element={<VerifyBill />} />
      <Route path={PATHS.MENU_MANAGEMENT} element={
        (isModuleEnabled('menu-management', modulesEnabled, role) && (isAdmin || role === 'SUPERUSER' || role === 'RESTAURANT'))
          ? <SaasModuleFrame moduleId="pos" company={company} role={role} userName={userName}><Navigate to={`${PATHS.RESTAURANT}?tab=menu`} replace /></SaasModuleFrame>
          : <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
      } />

      {/* Inventory */}
      <Route path={PATHS.INVENTORY} element={
        <SaasModuleRoute moduleId="inventory" role={role} navId="inventory" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <InventoryPage userName={userName} role={role} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.CONSUMPTION} element={
        <SaasModuleRoute moduleId="consumption" role={role} navId="inventory" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <Navigate to={`${PATHS.INVENTORY}?tab=consumption`} replace />
        </SaasModuleRoute>
      } />

      {/* Accounting — separate routes per section */}
      <Route path={PATHS.VAT} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="vat" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <VatCenter userName={userName} company={company} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.VAT_RETURN} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <VATReturn />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING} element={<Navigate to={PATHS.ACCOUNTING_VOUCHER} replace />} />
      <Route path={PATHS.ACCOUNTING_VOUCHER} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <VoucherEntryPage userName={userName} isAdmin={isAdmin} role={role} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_TRIAL} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <TrialBalancePage />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_COA} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <ChartOfAccountsPage isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_ASSETS} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <FixedAssetsPage userName={userName} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_OPENING} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <OpeningBalancePage userName={userName} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_TX_MAP} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <TransactionMappingPage userName={userName} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.ACCOUNTING_VENDOR_PAYMENTS} element={
        <SaasModuleRoute moduleId="accounting" role={role} navId="accounting" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <VendorPaymentPage role={role} />
        </SaasModuleRoute>
      } />

      {/* HR & Payroll */}
      <Route path="/hr" element={<Navigate to="/hr/employee-entry" replace />} />
      <Route path="/hr/employee-entry"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrEmployeeEntryPage      userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/service-book"        element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrServiceBookPage         userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/nominee"             element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrNomineePage             userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/leave-entry"         element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLeaveEntryPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/comp-leave"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrCompLeavePage           userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/festival-leave"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrFestivalLeavePage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/payroll-config"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollConfigPage       userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/payroll-gen"         element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollGenPage          userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/payroll-register"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrPayrollRegisterPage     userName={userName} role={role} isAdmin={isAdmin} company={company} /></SaasModuleRoute>} />
      <Route path="/hr/offer-letter"        element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="OFFER_LETTER"        company={company} /></SaasModuleRoute>} />
      <Route path="/hr/appointment-letter"  element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="APPOINTMENT"        company={company} /></SaasModuleRoute>} />
      <Route path="/hr/joining-letter"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="JOINING"            company={company} /></SaasModuleRoute>} />
      <Route path="/hr/confirmation-letter" element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="CONFIRMATION"       company={company} /></SaasModuleRoute>} />
      <Route path="/hr/increment-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SALARY_INCREMENT"   company={company} /></SaasModuleRoute>} />
      <Route path="/hr/promotion-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="PROMOTION"          company={company} /></SaasModuleRoute>} />
      <Route path="/hr/objection-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="OBJECTION"          company={company} /></SaasModuleRoute>} />
      <Route path="/hr/show-cause"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SHOW_CAUSE"         company={company} /></SaasModuleRoute>} />
      <Route path="/hr/warning-letter"      element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="WARNING"            company={company} /></SaasModuleRoute>} />
      <Route path="/hr/dismissal-letter"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="RELIEVING"          company={company} /></SaasModuleRoute>} />
      <Route path="/hr/noc"                 element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="NOC"                company={company} /></SaasModuleRoute>} />
      <Route path="/hr/experience-cert"     element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="EXP_CERT"           company={company} /></SaasModuleRoute>} />
      <Route path="/hr/employment-cert"     element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="SALARY_CERT"        company={company} /></SaasModuleRoute>} />
      <Route path="/hr/final-payment"       element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrLetterPage type="FINAL_PAYMENT"      company={company} /></SaasModuleRoute>} />
      <Route path="/hr/attendance-register" element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrAttendanceRegisterPage flash={(m)=>m} /></SaasModuleRoute>} />
      <Route path="/hr/employee-register"   element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrEmployeeRegisterPage   role={role} /></SaasModuleRoute>} />
      <Route path="/hr/service-book-reg"    element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrServiceBookRegPage      userName={userName} /></SaasModuleRoute>} />
      <Route path="/hr/incidents"           element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrIncidentsPage           userName={userName} flash={(m)=>m} /></SaasModuleRoute>} />
      <Route path="/hr/compliance"          element={<SaasModuleRoute moduleId="hr" role={role} navId="hr" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}><HrCompliancePage          role={role} /></SaasModuleRoute>} />

      {/* Reports */}
      <Route path={PATHS.REPORTS_CASED_ALIAS} caseSensitive element={<Navigate to={PATHS.REPORTS} replace />} />
      <Route path={PATHS.TENANT_REPORTS_CASED_ALIAS} caseSensitive element={<TenantReportsRedirect />} />
      <Route path={PATHS.NIGHT_AUDIT_REPORTS} element={<Navigate to={`${PATHS.REPORTS}?category=hotel-operations&report=NIGHT-AUDIT`} replace />} />
      <Route path={PATHS.TENANT_REPORTS} element={
        <SaasModuleRoute moduleId="reports" role={role} navId="reports" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <ReportsCenterPage userName={userName} userId={userId} role={role} company={company} />
        </SaasModuleRoute>
      } />
      <Route path={PATHS.REPORTS} element={
        <SaasModuleRoute moduleId="reports" role={role} navId="reports" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <ReportsCenterPage userName={userName} userId={userId} role={role} company={company} />
        </SaasModuleRoute>
      } />

      {/* Tasks — unified module */}
      <Route path={PATHS.TASKS} element={
        <SaasModuleRoute moduleId="tasks" role={role} navId="tasks" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <TasksPage userName={userName} role={role} isAdmin={isAdmin} />
        </SaasModuleRoute>
      } />
      {/* /ai-tasker → redirect to /tasks?tab=ai (old URL still works) */}
      <Route path={PATHS.AI_TASKER} element={<Navigate to={`${PATHS.TASKS}?tab=ai`} replace />} />

      {/* System — superuser only */}
      <Route path={PATHS.MASTER_DATA} element={
        role === 'SUPERUSER'
          ? (
            <SaasModuleFrame moduleId="settings" company={company} role={role} userName={userName}>
              <MasterDataPage role={role} isAdmin={isAdmin} />
            </SaasModuleFrame>
          )
          : <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
      } />
      <Route path={PATHS.CMS} element={
        role === 'SUPERUSER'
          ? <CmsLegacyRedirect />
          : <Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />
      } />
      <Route path={PATHS.SETTINGS} element={
        <SaasModuleRoute moduleId="settings" role={role} navId="settings" privileges={privileges} modulesEnabled={modulesEnabled} company={company} userName={userName}>
          <Settings userName={userName} role={role} isAdmin={isAdmin} reloadCompany={loadCompany} />
        </SaasModuleRoute>
      } />

      <Route path="*" element={<Navigate to={firstAccessiblePath(role, privileges, modulesEnabled)} replace />} />
    </Routes>
  )
}
