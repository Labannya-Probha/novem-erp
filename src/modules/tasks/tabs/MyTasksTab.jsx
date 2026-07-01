import TaskManagement from '../../../pages/TaskManagement'

export default function MyTasksTab({ userName, role, isAdmin }) {
  return <TaskManagement userName={userName} role={role} isAdmin={isAdmin} filterUser={userName} />
}
