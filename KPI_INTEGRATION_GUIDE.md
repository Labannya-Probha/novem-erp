# KPI Integration Guide

## File to upload
- `src/components/KPICards.jsx` → NEW file

## Add to each module (one line each)

### 1. Reservations.jsx — top of return(), before the main content
```jsx
import KPICards from '../components/KPICards.jsx'
// ...inside return():
<KPICards module="reservations" />
```

### 2. Dashboard.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="dashboard" />
```

### 3. HousekeepingHub.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="housekeeping" />
```

### 4. NightAudit.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="nightaudit" />
```

### 5. RestaurantPOS.jsx — inside return(), after the title div
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="pos" />
```

### 6. InventoryHub.jsx — after the <p> description tag
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="inventory" />
```

### 7. AccountingHub.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="accounting" />
```

### 8. VatCenter.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="vat" />
```

### 9. HrOffice.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="hr" />
```

### 10. TaskManagement.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="tasks" />
```

### 11. Facilities.jsx
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="facilities" />
```

### 12. ReportsHub.jsx — after the <p> tag in the main return
```jsx
import KPICards from '../components/KPICards.jsx'
<KPICards module="reports" />
```
