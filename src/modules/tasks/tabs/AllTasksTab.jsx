import TaskManagement from '../../../pages/TaskManagement'

export default function AllTasksTab({ userName, role, isAdmin }) {
  return <TaskManagement userName={userName} role={role} isAdmin={isAdmin} />
}
