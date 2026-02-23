import { Outlet } from 'react-router-dom'
import { SuperAdminDataProvider } from './SuperAdminDataContext'

function SuperAdminRouteLayout() {
    return (
        <SuperAdminDataProvider>
            <Outlet />
        </SuperAdminDataProvider>
    )
}

export default SuperAdminRouteLayout
