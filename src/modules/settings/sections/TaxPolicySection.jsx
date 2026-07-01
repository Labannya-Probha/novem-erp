import TaxPolicyCard from '../../../components/settings/TaxPolicyCard'

export default function TaxPolicySection({ tenantId, isAdmin }) {
  return <TaxPolicyCard tenantId={tenantId} isAdmin={isAdmin} />
}
