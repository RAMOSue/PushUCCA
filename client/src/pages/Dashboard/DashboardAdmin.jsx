import { useContext } from "react";
import { UserContext } from "../../../context/userContext";
import { Outlet } from "react-router-dom";
import SideNavbar from "../../components/navigation/SideNavbar";
import RightNavbar from "../../components/navigation/RightNavbar";

export default function DashboardAdmin() {
	const { user } = useContext(UserContext);

	return (
		<div className="min-h-screen bg-surface">
			{/* Side Navigation Bar */}
			<SideNavbar role="admin" />

			{/* Right Navigation Bar */}
			<RightNavbar />

			{/* Main content area - Pages handle their own PageLayout */}
			<Outlet />
		</div>
	);
}