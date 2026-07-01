import RestaurantPOS from 'src/pages/RestaurantPOS.jsx'

export default function PosOrdersTab({ userName, isAdmin, role }) {
  return <RestaurantPOS userName={userName} isAdmin={isAdmin} role={role} />
}

