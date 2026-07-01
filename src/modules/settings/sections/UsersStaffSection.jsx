import StaffCard from '../../../components/settings/StaffCard'

export default function UsersStaffSection({ isAdminPlus, isSuperuser, userName }) {
  return <StaffCard isAdminPlus={isAdminPlus} isSuperuser={isSuperuser} currentUserName={userName} />
}
