import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'src/components/ui/card'

/**
 * @param {{
 *   title: string
 *   description?: string
 *   children: import('react').ReactNode
 *   className?: string
 * }} props
 */
export default function FormSection({ title, description, children, className }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
