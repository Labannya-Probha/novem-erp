import TaskManagement from '../../../pages/TaskManagement'

export default function AiTaskerTab({ userName, role, isAdmin }) {
  return <TaskManagement userName={userName} role={role} isAdmin={isAdmin} aiTaskerMode />
}
