import { Outlet } from "react-router-dom";

export default function DashboardAdmin() {
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-[#171717]">
			<Outlet />
		</div>
	);
}