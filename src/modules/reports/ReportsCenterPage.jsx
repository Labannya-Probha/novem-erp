import ReportViewer from './components/ReportViewer'

export default function ReportsCenterPage({ userName, userId, role, company }) {
  return <ReportViewer userName={userName} userId={userId} role={role} company={company} />
}
